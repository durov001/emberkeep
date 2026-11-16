// EMBERKEEP — world: the whole simulation. State, spawning, waves, combat,
// the boss, pickups, particles and upgrades. The renderer only draws what
// this module owns; the loop only calls updateWorld with a fixed step.

import {
  ARENA, BOSS, COMBO, ENEMY_TYPES, HEART, PALETTE, PLAYER_BASE,
  UPGRADES, WAVES, waveEnemyCount, waveScaling, BEST_KEY,
} from './tuning.js';
import { Rng } from './rng.js';

/** The best score kept in localStorage (0 when nothing is stored). */
export function loadBest() {
  try {
    return Number(window.localStorage.getItem(BEST_KEY) || 0) || 0;
  } catch (err) {
    return 0;
  }
}

export function saveBest(score) {
  try {
    window.localStorage.setItem(BEST_KEY, String(Math.floor(score)));
  } catch (err) { /* storage is best-effort */ }
}

/** The score multiplier from the current kill streak. */
export function multiplierOf(world) {
  return Math.min(COMBO.maxMult, 1 + Math.floor(world.combo / COMBO.perStep));
}

/** Stars and drifting ash for the arena background, fixed per seed. */
function makeAmbient(rng) {
  const stars = [];
  for (let i = 0; i < 90; i++) {
    stars.push({ x: rng.range(0, 1280), y: rng.range(0, 720), r: rng.range(0.5, 1.6), tw: rng.range(0, Math.PI * 2) });
  }
  const ash = [];
  for (let i = 0; i < 60; i++) {
    ash.push({ x: rng.range(0, 1280), y: rng.range(0, 720), vx: rng.range(-8, 8), vy: rng.range(-18, -6), r: rng.range(0.8, 2.2) });
  }
  return { stars, ash };
}

/** A fresh world: title screen, no run in progress. */
export function createWorld(seed) {
  const rng = new Rng(seed);
  return {
    seed,
    rng,
    state: 'title',
    time: 0,
    animTime: 0,
    player: null,
    enemies: [],
    sparks: [],
    orbs: [],
    embers: [],
    hearts: [],
    particles: [],
    texts: [],
    wave: 0,
    spawnQueue: [],
    spawnTimer: 0,
    waveTotal: 0,
    waveKills: 0,
    waveMix: {},
    score: 0,
    kills: 0,
    embersCollected: 0,
    combo: 0,
    comboTimer: 0,
    bestCombo: 0,
    shake: 0,
    flash: 0,
    banner: null,
    upgradeChoices: [],
    boss: null,
    novaFx: null,
    best: loadBest(),
    ambient: makeAmbient(rng),
    stats: { shots: 0, damageDealt: 0 },
  };
}

/** A fresh player at the arena's centre, with base stats. */
function freshPlayer() {
  return {
    x: ARENA.x + ARENA.width / 2,
    y: ARENA.y + ARENA.height / 2,
    vx: 0, vy: 0,
    angle: -Math.PI / 2,
    hp: PLAYER_BASE.maxHp,
    ...PLAYER_BASE,
    dashReady: PLAYER_BASE.dashCharges,
    dashTimer: 0,
    dashing: 0,
    dashX: 0, dashY: 0,
    novaTimer: 0,
    invuln: 0,
    fireTimer: 0,
  };
}

/** Begin a new run: reset everything and open wave 1. */
export function startRun(world) {
  world.player = freshPlayer();
  world.enemies = [];
  world.sparks = [];
  world.orbs = [];
  world.embers = [];
  world.hearts = [];
  world.particles = [];
  world.texts = [];
  world.score = 0;
  world.kills = 0;
  world.embersCollected = 0;
  world.combo = 0;
  world.comboTimer = 0;
  world.bestCombo = 0;
  world.time = 0;
  world.shake = 0;
  world.flash = 0;
  world.boss = null;
  world.novaFx = null;
  world.upgradeChoices = [];
  world.stats = { shots: 0, damageDealt: 0 };
  world.state = 'playing';
  beginWave(world, 1);
}

/** Open a wave: build its spawn queue, announce it, summon the boss if any. */
export function beginWave(world, n) {
  const def = WAVES[n - 1];
  world.wave = n;
  world.waveTotal = waveEnemyCount(n);
  world.waveKills = 0;
  world.waveMix = { ...def.mix };
  world.spawnQueue = [];
  for (const type of Object.keys(def.mix)) {
    for (let i = 0; i < def.mix[type]; i++) world.spawnQueue.push(type);
  }
  world.spawnQueue = world.rng.shuffle(world.spawnQueue);
  world.spawnTimer = 1.0;
  world.banner = { title: `WAVE ${n}`, sub: def.name, t: 0, life: 2.4 };
  if (def.boss) {
    spawnBoss(world);
  }
}

/** Spawn one enemy of a type at a random arena edge. */
export function spawnEnemy(world, type, x, y) {
  const def = ENEMY_TYPES[type];
  const scale = waveScaling(world.wave);
  const side = world.rng.int(0, 3);
  const px = x !== undefined ? x : (side === 0 ? ARENA.x + 24 : side === 1 ? ARENA.x + ARENA.width - 24 : world.rng.range(ARENA.x + 40, ARENA.x + ARENA.width - 40));
  const py = y !== undefined ? y : (side === 2 ? ARENA.y + 24 : side === 3 ? ARENA.y + ARENA.height - 24 : world.rng.range(ARENA.y + 40, ARENA.y + ARENA.height - 40));
  const hp = Math.round(def.hp * scale.hpMul);
  const enemy = {
    type, x: px, y: py, vx: 0, vy: 0,
    hp, maxHp: hp,
    radius: def.radius,
    speed: def.speed * scale.speedMul,
    contact: def.contact,
    score: def.score,
    embers: def.embers,
    wobble: world.rng.range(0, Math.PI * 2),
    shotTimer: world.rng.range(1, def.shotInterval || 2),
    strafeDir: world.rng.chance(0.5) ? 1 : -1,
    strafeTimer: world.rng.range(1, 3),
    burnTick: 0,
    burnAcc: 0,
    flash: 0,
    boss: false,
  };
  world.enemies.push(enemy);
  return enemy;
}

/** Summon the Gloommaw at the top of the arena, with a roar. */
export function spawnBoss(world) {
  const enemy = {
    type: 'boss', x: ARENA.x + ARENA.width / 2, y: ARENA.y + 120, vx: 0, vy: 0,
    hp: BOSS.hp, maxHp: BOSS.hp,
    radius: BOSS.radius, speed: BOSS.speed, contact: BOSS.contact,
    score: BOSS.score, embers: BOSS.embers,
    wobble: 0, shotTimer: 0, strafeDir: 1, strafeTimer: 0,
    burnTick: 0, burnAcc: 0, flash: 0, boss: true,
    phase: 1, mode: 'chase', modeTimer: 0,
    chargeX: 0, chargeY: 0, chargeCooldown: 3, summonTimer: BOSS.summonInterval,
  };
  world.enemies.push(enemy);
  world.boss = enemy;
  return enemy;
}

/** A floating text (damage numbers, pickups, score). */
export function addText(world, x, y, text, color, size = 15) {
  if (world.texts.length > 60) world.texts.shift();
  world.texts.push({ x, y, text, color, size, t: 0, life: 0.9 });
}

/** A burst of particles. */
export function burst(world, x, y, color, n, speed, life = 0.5, r = 3) {
  for (let i = 0; i < n; i++) {
    const a = world.rng.angle();
    const v = world.rng.range(speed * 0.3, speed);
    world.particles.push({
      x, y,
      vx: Math.cos(a) * v, vy: Math.sin(a) * v,
      r: world.rng.range(r * 0.5, r * 1.4),
      color, t: 0, life: world.rng.range(life * 0.6, life * 1.3),
    });
  }
  if (world.particles.length > 400) world.particles.splice(0, world.particles.length - 400);
}

/** Damage an enemy; kills it when its health runs out. */
function damageEnemy(world, enemy, amount, sound, silent = false) {
  if (enemy.hp <= 0) return;
  enemy.hp -= amount;
  enemy.flash = 0.1;
  world.stats.damageDealt += amount;
  if (enemy.hp <= 0) killEnemy(world, enemy, sound);
  else if (!silent && sound) sound.hit();
}

/** A kill: score, combo, ember drops, splits, and a burst of light. */
function killEnemy(world, enemy, sound) {
  const p = world.player;
  const mult = multiplierOf(world);
  world.kills++;
  world.combo++;
  world.comboTimer = COMBO.window;
  world.bestCombo = Math.max(world.bestCombo, world.combo);
  world.waveKills++;
  const gained = enemy.score * mult;
  world.score += gained;
  addText(world, enemy.x, enemy.y - enemy.radius, `+${gained}`, PALETTE.gold, enemy.boss ? 26 : 15);
  burst(world, enemy.x, enemy.y, PALETTE.amber, enemy.boss ? 60 : 14, enemy.boss ? 320 : 180, 0.7, 4);
  burst(world, enemy.x, enemy.y, PALETTE.ember, enemy.boss ? 40 : 8, 140, 0.5, 3);
  if (sound) sound.kill();
  for (let i = 0; i < enemy.embers; i++) {
    const a = world.rng.angle();
    world.embers.push({
      x: enemy.x, y: enemy.y,
      vx: Math.cos(a) * world.rng.range(40, 130),
      vy: Math.sin(a) * world.rng.range(40, 130),
      value: p.emberValue, t: 0,
    });
  }
  if (world.rng.chance(HEART.dropChance)) {
    world.hearts.push({ x: enemy.x, y: enemy.y, vx: 0, vy: -30, t: 0 });
  }
  const def = ENEMY_TYPES[enemy.type];
  if (def && def.splitsInto) {
    for (let i = 0; i < def.splitCount; i++) {
      const child = spawnEnemy(world, def.splitsInto, enemy.x + (i === 0 ? -14 : 14), enemy.y);
      child.hp = Math.round(child.hp * 0.7);
      child.maxHp = child.hp;
    }
  }
  if (enemy.boss) {
    world.boss = null;
    world.shake = Math.min(20, world.shake + 14);
    if (sound) sound.stopBossDrone();
  }
  const idx = world.enemies.indexOf(enemy);
  if (idx >= 0) world.enemies.splice(idx, 1);
}

/** Hurt the player: armor, invulnerability, combo reset, death. */
function hurtPlayer(world, amount, sound) {
  const p = world.player;
  if (p.invuln > 0 || p.dashing > 0 || world.state !== 'playing') return;
  const taken = Math.max(1, Math.round(amount * (1 - p.armor)));
  p.hp -= taken;
  p.invuln = 0.7;
  world.combo = 0;
  world.comboTimer = 0;
  world.flash = 1;
  world.shake = Math.min(16, world.shake + 8);
  addText(world, p.x, p.y - 30, `-${taken}`, PALETTE.blood, 20);
  burst(world, p.x, p.y, PALETTE.blood, 12, 200, 0.5, 3);
  if (sound) sound.hurt();
  if (p.hp <= 0) {
    p.hp = 0;
    world.state = 'gameover';
    if (world.score > world.best) {
      world.best = Math.floor(world.score);
      saveBest(world.best);
    }
    if (sound) {
      sound.stopBossDrone();
      sound.gameOver();
    }
  }
}

/** The pulse nova: burn everything nearby, shatter orbs, shake the screen. */
function fireNova(world, sound) {
  const p = world.player;
  p.novaTimer = p.novaCooldown;
  world.novaFx = { x: p.x, y: p.y, t: 0, radius: p.novaRadius };
  world.shake = Math.min(18, world.shake + 10);
  burst(world, p.x, p.y, PALETTE.amber, 36, 380, 0.6, 4);
  for (const enemy of world.enemies.slice()) {
    if (Math.hypot(enemy.x - p.x, enemy.y - p.y) <= p.novaRadius + enemy.radius) {
      addText(world, enemy.x, enemy.y - enemy.radius, String(Math.round(p.novaDamage)), PALETTE.ember, 17);
      damageEnemy(world, enemy, p.novaDamage, null, true);
    }
  }
  world.orbs = world.orbs.filter((o) => Math.hypot(o.x - p.x, o.y - p.y) > p.novaRadius);
  if (sound) sound.nova();
}

/** The nearest enemy inside spark range, or null. */
function nearestEnemy(world) {
  const p = world.player;
  let best = null;
  let bestD = p.sparkRange;
  for (const e of world.enemies) {
    const d = Math.hypot(e.x - p.x, e.y - p.y);
    if (d < bestD) {
      bestD = d;
      best = e;
    }
  }
  return best;
}

/** How many of each enemy type are still to come in this wave (queued + alive). */
export function waveRemainingByType(world) {
  const out = {};
  for (const t of world.spawnQueue) out[t] = (out[t] || 0) + 1;
  for (const e of world.enemies) {
    if (!e.boss) out[e.type] = (out[e.type] || 0) + 1;
  }
  return out;
}

/** Roll three distinct upgrades for the between-wave choice. */
export function rollUpgrades(world) {
  world.upgradeChoices = world.rng.shuffle(UPGRADES).slice(0, 3);
  return world.upgradeChoices;
}

/** Apply an upgrade, then open the next wave. */
export function applyUpgrade(world, id, sound) {
  const def = UPGRADES.find((u) => u.id === id);
  if (!def) return;
  def.apply(world.player);
  if (sound) sound.upgrade();
  world.upgradeChoices = [];
  world.state = 'playing';
  beginWave(world, world.wave + 1);
  if (sound) sound.waveHorn();
}

/** Win the run: the boss is dead and the dark is spent. */
function winRun(world, sound) {
  world.state = 'victory';
  if (world.score > world.best) {
    world.best = Math.floor(world.score);
    saveBest(world.best);
  }
  if (sound) {
    sound.stopBossDrone();
    sound.victory();
  }
}

/** One fixed simulation step. Only runs while the state is 'playing'. */
export function updateWorld(world, input, sound, dt) {
  if (world.state !== 'playing') return;
  const p = world.player;
  const rng = world.rng;
  world.time += dt;
  world.animTime += dt;

  // --- player movement and dash ---
  const axis = input.moveAxis();
  p.angle = Math.atan2(input.mouseY - p.y, input.mouseX - p.x);
  if (input.wasPressed('Space') && p.dashReady > 0 && p.dashing <= 0) {
    p.dashReady--;
    p.dashing = p.dashTime;
    const dx = axis.x !== 0 || axis.y !== 0 ? axis.x : Math.cos(p.angle);
    const dy = axis.x !== 0 || axis.y !== 0 ? axis.y : Math.sin(p.angle);
    p.dashX = dx;
    p.dashY = dy;
    if (sound) sound.dash();
  }
  if (p.dashing > 0) {
    p.dashing -= dt;
    p.vx = p.dashX * p.dashSpeed;
    p.vy = p.dashY * p.dashSpeed;
    world.particles.push({
      x: p.x, y: p.y, vx: -p.dashX * 40, vy: -p.dashY * 40,
      r: rng.range(4, 8), color: PALETTE.amber, t: 0, life: 0.35,
    });
  } else {
    p.vx = axis.x * p.speed;
    p.vy = axis.y * p.speed;
  }
  p.x = Math.max(ARENA.x + p.radius, Math.min(ARENA.x + ARENA.width - p.radius, p.x + p.vx * dt));
  p.y = Math.max(ARENA.y + p.radius, Math.min(ARENA.y + ARENA.height - p.radius, p.y + p.vy * dt));

  // --- dash recharge, nova cooldown, regen, invulnerability ---
  if (p.dashReady < p.dashCharges) {
    p.dashTimer += dt;
    if (p.dashTimer >= p.dashRecharge) {
      p.dashTimer = 0;
      p.dashReady++;
    }
  }
  if (p.novaTimer > 0) p.novaTimer -= dt;
  if (p.invuln > 0) p.invuln -= dt;
  if (p.regen > 0 && p.hp > 0) p.hp = Math.min(p.maxHp, p.hp + p.regen * dt);
  if (input.wasPressed('KeyE') && p.novaTimer <= 0) fireNova(world, sound);

  // --- auto-fire sparks at the nearest enemy ---
  p.fireTimer -= dt;
  if (p.fireTimer <= 0) {
    const target = nearestEnemy(world);
    if (target) {
      const a = Math.atan2(target.y - p.y, target.x - p.x);
      world.sparks.push({
        x: p.x + Math.cos(a) * (p.radius + 4),
        y: p.y + Math.sin(a) * (p.radius + 4),
        vx: Math.cos(a) * p.sparkSpeed,
        vy: Math.sin(a) * p.sparkSpeed,
        damage: p.sparkDamage,
        life: p.sparkRange / p.sparkSpeed + 0.15,
      });
      world.stats.shots++;
      p.fireTimer = 1 / p.sparkRate;
      if (sound) sound.shoot();
    } else {
      p.fireTimer = 0.08;
    }
  }

  // --- sparks fly and hit ---
  for (const s of world.sparks.slice()) {
    s.x += s.vx * dt;
    s.y += s.vy * dt;
    s.life -= dt;
    let dead = s.life <= 0;
    if (!dead) {
      for (const e of world.enemies) {
        if (Math.hypot(e.x - s.x, e.y - s.y) <= e.radius + 5) {
          addText(world, e.x, e.y - e.radius - 4, String(Math.round(s.damage)), PALETTE.flameCore, 14);
          const kb = e.boss || e.type === 'brute' ? 12 : 70;
          const d = Math.max(1, Math.hypot(e.x - p.x, e.y - p.y));
          e.vx += ((e.x - p.x) / d) * kb;
          e.vy += ((e.y - p.y) / d) * kb;
          damageEnemy(world, e, s.damage, sound);
          dead = true;
          break;
        }
      }
    }
    if (dead) {
      const i = world.sparks.indexOf(s);
      if (i >= 0) world.sparks.splice(i, 1);
    }
  }

  // --- enemies: light burn, movement, spitter shots, boss phases ---
  for (const e of world.enemies.slice()) {
    if (e.flash > 0) e.flash -= dt;
    const dx = p.x - e.x;
    const dy = p.y - e.y;
    const dist = Math.max(1, Math.hypot(dx, dy));
    const nx = dx / dist;
    const ny = dy / dist;

    // Light is the weapon: inside the radius, shadows burn.
    if (dist < p.lightRadius + e.radius) {
      const burn = p.burnDps * dt;
      e.burnAcc += burn;
      e.burnTick += dt;
      e.hp -= burn;
      world.stats.damageDealt += burn;
      if (e.burnTick >= 0.5) {
        addText(world, e.x, e.y - e.radius - 4, String(Math.round(e.burnAcc)), PALETTE.ember, 13);
        e.burnTick = 0;
        e.burnAcc = 0;
        if (rng.chance(0.6)) {
          world.particles.push({ x: e.x + rng.range(-8, 8), y: e.y - e.radius, vx: 0, vy: -40, r: 3, color: PALETTE.amber, t: 0, life: 0.4 });
        }
      }
      if (e.hp <= 0) {
        killEnemy(world, e, sound);
        continue;
      }
    }

    if (e.boss) {
      updateBoss(world, e, dt, sound, nx, ny, dist);
    } else if (e.type === 'spitter') {
      e.strafeTimer -= dt;
      if (e.strafeTimer <= 0) {
        e.strafeTimer = rng.range(1.2, 2.6);
        e.strafeDir *= -1;
      }
      let mx = 0;
      let my = 0;
      if (dist > 380) { mx = nx; my = ny; }
      else if (dist < 260) { mx = -nx; my = -ny; }
      else { mx = -ny * e.strafeDir; my = nx * e.strafeDir; }
      e.x += (mx * e.speed + e.vx) * dt;
      e.y += (my * e.speed + e.vy) * dt;
      e.shotTimer -= dt;
      if (e.shotTimer <= 0 && dist < 560) {
        e.shotTimer = ENEMY_TYPES.spitter.shotInterval * rng.range(0.85, 1.2);
        world.orbs.push({
          x: e.x, y: e.y,
          vx: nx * ENEMY_TYPES.spitter.shotSpeed,
          vy: ny * ENEMY_TYPES.spitter.shotSpeed,
          damage: ENEMY_TYPES.spitter.shotDamage, life: 6,
        });
        burst(world, e.x, e.y, ENEMY_TYPES.spitter.rim, 4, 80, 0.3, 2);
      }
    } else {
      // Chasers wobble as they drift toward the flame.
      const wob = Math.sin(world.time * 3 + e.wobble) * 0.45;
      const wx = nx - ny * wob;
      const wy = ny + nx * wob;
      const wl = Math.max(0.001, Math.hypot(wx, wy));
      e.x += ((wx / wl) * e.speed + e.vx) * dt;
      e.y += ((wy / wl) * e.speed + e.vy) * dt;
    }
    e.vx *= 0.86;
    e.vy *= 0.86;
    e.x = Math.max(ARENA.x + e.radius, Math.min(ARENA.x + ARENA.width - e.radius, e.x));
    e.y = Math.max(ARENA.y + e.radius, Math.min(ARENA.y + ARENA.height - e.radius, e.y));

    // Contact with the flame hurts the flame.
    if (dist < e.radius + p.radius + 2) {
      hurtPlayer(world, e.contact, sound);
      e.x -= nx * 26;
      e.y -= ny * 26;
    }
  }

  // --- enemies push each other apart so they never stack ---
  const list = world.enemies;
  for (let i = 0; i < list.length; i++) {
    for (let j = i + 1; j < list.length; j++) {
      const a = list[i];
      const b = list[j];
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const d = Math.hypot(dx, dy);
      const min = a.radius + b.radius;
      if (d > 0.01 && d < min) {
        const push = ((min - d) / d) * 0.5;
        if (!a.boss) { a.x -= dx * push * 0.5; a.y -= dy * push * 0.5; }
        if (!b.boss) { b.x += dx * push * 0.5; b.y += dy * push * 0.5; }
      }
    }
  }

  // --- dark orbs fly and hit ---
  for (const o of world.orbs.slice()) {
    o.x += o.vx * dt;
    o.y += o.vy * dt;
    o.life -= dt;
    let dead = o.life <= 0 || o.x < ARENA.x || o.x > ARENA.x + ARENA.width || o.y < ARENA.y || o.y > ARENA.y + ARENA.height;
    if (!dead && Math.hypot(o.x - p.x, o.y - p.y) <= p.radius + 7) {
      hurtPlayer(world, o.damage, sound);
      dead = true;
    }
    if (dead) {
      const i = world.orbs.indexOf(o);
      if (i >= 0) world.orbs.splice(i, 1);
    }
  }

  // --- embers drift, then fly to the flame inside the magnet radius ---
  for (const m of world.embers.slice()) {
    m.t += dt;
    m.vx *= 0.92;
    m.vy *= 0.92;
    const dx = p.x - m.x;
    const dy = p.y - m.y;
    const d = Math.max(1, Math.hypot(dx, dy));
    if (d < p.magnet) {
      const pull = 620 * (1 - d / (p.magnet + 60)) + 160;
      m.vx += (dx / d) * pull * dt * 4;
      m.vy += (dy / d) * pull * dt * 4;
    }
    m.x += m.vx * dt;
    m.y += m.vy * dt;
    if (d < p.radius + 10) {
      const mult = multiplierOf(world);
      const gained = Math.round(m.value * mult);
      world.score += gained;
      world.embersCollected++;
      addText(world, m.x, m.y - 8, `+${gained}`, PALETTE.gold, 12);
      if (world.embersCollected % 12 === 0) burst(world, p.x, p.y, PALETTE.gold, 8, 140, 0.4, 2);
      if (sound) sound.pickup();
      const i = world.embers.indexOf(m);
      if (i >= 0) world.embers.splice(i, 1);
    } else if (m.t > 25) {
      const i = world.embers.indexOf(m);
      if (i >= 0) world.embers.splice(i, 1);
    }
  }

  // --- hearts heal ---
  for (const h of world.hearts.slice()) {
    h.t += dt;
    h.vy += 60 * dt;
    h.x += h.vx * dt;
    h.y += h.vy * dt;
    if (h.y > ARENA.y + ARENA.height - 12) h.y = ARENA.y + ARENA.height - 12;
    if (Math.hypot(h.x - p.x, h.y - p.y) < p.radius + 12) {
      p.hp = Math.min(p.maxHp, p.hp + HEART.heal);
      addText(world, p.x, p.y - 30, `+${HEART.heal}`, '#7dffa8', 16);
      burst(world, p.x, p.y, '#7dffa8', 10, 120, 0.5, 3);
      if (sound) sound.heal();
      const i = world.hearts.indexOf(h);
      if (i >= 0) world.hearts.splice(i, 1);
    } else if (h.t > 18) {
      const i = world.hearts.indexOf(h);
      if (i >= 0) world.hearts.splice(i, 1);
    }
  }

  // --- particles, texts, banner, shake, flash, combo ---
  for (const pt of world.particles.slice()) {
    pt.t += dt;
    pt.x += pt.vx * dt;
    pt.y += pt.vy * dt;
    pt.vy += 30 * dt;
    if (pt.t >= pt.life) {
      const i = world.particles.indexOf(pt);
      if (i >= 0) world.particles.splice(i, 1);
    }
  }
  for (const t of world.texts.slice()) {
    t.t += dt;
    t.y -= 34 * dt;
    if (t.t >= t.life) {
      const i = world.texts.indexOf(t);
      if (i >= 0) world.texts.splice(i, 1);
    }
  }
  if (world.banner) {
    world.banner.t += dt;
    if (world.banner.t >= world.banner.life) world.banner = null;
  }
  if (world.novaFx) {
    world.novaFx.t += dt;
    if (world.novaFx.t > 0.45) world.novaFx = null;
  }
  if (world.shake > 0) world.shake = Math.max(0, world.shake - 42 * dt);
  if (world.flash > 0) world.flash = Math.max(0, world.flash - 2.2 * dt);
  if (world.comboTimer > 0) {
    world.comboTimer -= dt;
    if (world.comboTimer <= 0) world.combo = 0;
  }

  // --- spawning: the dark pours in from the edges ---
  if (world.spawnQueue.length > 0) {
    world.spawnTimer -= dt;
    if (world.spawnTimer <= 0 && world.enemies.length < 36) {
      const def = WAVES[world.wave - 1];
      spawnEnemy(world, world.spawnQueue.shift());
      world.spawnTimer = def.spawnInterval * rng.range(0.8, 1.2);
    }
  }

  // --- wave clear: upgrade, or victory on wave 10 ---
  if (world.state === 'playing' && world.spawnQueue.length === 0 && world.enemies.length === 0) {
    if (world.wave >= 10) {
      winRun(world, sound);
    } else {
      const bonus = 250 * world.wave;
      world.score += bonus;
      world.state = 'upgrade';
      rollUpgrades(world);
    }
  }
}

/** The Gloommaw's brain: chase, summon, and a telegraphed charge. */
function updateBoss(world, boss, dt, sound, nx, ny, dist) {
  const p = world.player;
  const frac = boss.hp / boss.maxHp;
  if (frac <= BOSS.phase3At) boss.phase = 3;
  else if (frac <= BOSS.phase2At) boss.phase = 2;

  boss.summonTimer -= dt;
  const summonEvery = boss.phase === 3 ? 5.5 : BOSS.summonInterval;
  if (boss.summonTimer <= 0) {
    boss.summonTimer = summonEvery;
    const kind = boss.phase === 3 ? 'crawler' : 'wisp';
    for (let i = 0; i < 2; i++) {
      const a = world.rng.angle();
      spawnEnemy(world, kind, boss.x + Math.cos(a) * (boss.radius + 20), boss.y + Math.sin(a) * (boss.radius + 20));
    }
    burst(world, boss.x, boss.y, PALETTE.violet, 16, 200, 0.6, 3);
  }

  if (boss.chargeCooldown > 0) boss.chargeCooldown -= dt;
  const speed = boss.speed * (boss.phase === 3 ? 1.35 : boss.phase === 2 ? 1.15 : 1);

  if (boss.mode === 'chase') {
    boss.x += nx * speed * dt;
    boss.y += ny * speed * dt;
    if (boss.phase >= 2 && boss.chargeCooldown <= 0 && dist < 540 && dist > 120) {
      boss.mode = 'windup';
      boss.modeTimer = BOSS.chargeWindup;
      boss.chargeX = nx;
      boss.chargeY = ny;
    }
  } else if (boss.mode === 'windup') {
    boss.modeTimer -= dt;
    if (boss.modeTimer <= 0) {
      boss.mode = 'charging';
      boss.modeTimer = BOSS.chargeTime;
      if (sound) sound.bossRoar();
    }
  } else if (boss.mode === 'charging') {
    boss.x += boss.chargeX * BOSS.chargeSpeed * dt;
    boss.y += boss.chargeY * BOSS.chargeSpeed * dt;
    world.particles.push({
      x: boss.x, y: boss.y, vx: -boss.chargeX * 60, vy: -boss.chargeY * 60,
      r: world.rng.range(5, 10), color: PALETTE.blood, t: 0, life: 0.4,
    });
    boss.modeTimer -= dt;
    if (boss.modeTimer <= 0) {
      boss.mode = 'recover';
      boss.modeTimer = BOSS.chargeRecover;
      boss.chargeCooldown = boss.phase === 3 ? 3 : 4.5;
      world.shake = Math.min(14, world.shake + 6);
    }
  } else if (boss.mode === 'recover') {
    boss.modeTimer -= dt;
    if (boss.modeTimer <= 0) boss.mode = 'chase';
  }
}
