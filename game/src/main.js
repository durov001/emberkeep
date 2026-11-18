// EMBERKEEP v2 — main loop, state machine, combat, screens and HUD.
// The game is a 2D canvas arena survival: guard the Last Ember through
// 7 nights in 3 realms. Light is both weapon and currency.

import { tv, DIFFICULTIES, WORKSHOP, workshopCost } from './tuning.js';
import { ARENA, realmForNight, forkPair } from './realms.js';
import { createInput } from './input.js';
import { makeRng, rand } from './rng.js';
import { makeWorld, updateSpawns, nightCleared, spawnPoint } from './world.js';
import { makeEnemy, updateEnemy } from './enemies.js';
import { draftRelics, synergiesOf, relicById } from './relics.js';
import { kindleCost, nearestUnlitBrazier, burnShadows, sparkDamageMul, lightRadius } from './kindle.js';
import { drawScene, ENEMY_COLORS } from './render.js';
import { sfx, setMuted, isMuted } from './sound.js';
import { getShotParam, stageShot } from './shots.js';

const META_KEY = 'emberkeep-meta-v2';

function loadMeta() {
  try {
    const raw = localStorage.getItem(META_KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* storage unavailable — play with defaults */ }
  return { ember: 0, workshop: { vitality: 0, wickcraft: 0, sparkforge: 0, swiftfoot: 0 }, best: null };
}

function saveMeta(meta) {
  try {
    localStorage.setItem(META_KEY, JSON.stringify(meta));
  } catch { /* ignore */ }
}

function el(id) {
  return document.getElementById(id);
}

export function createGame(canvas) {
  const ctx = canvas.getContext('2d');
  const input = createInput(canvas);
  const meta = loadMeta();

  const game = {
    canvas, ctx, input, meta,
    screen: 'start',
    difficulty: 'ember',
    night: 1,
    endless: false,
    time: 0,
    runTime: 0,
    rng: makeRng((Date.now() % 2147483647) || 7),
    shotMode: false,
    shotTime: 0,
    player: null,
    stats: null,
    world: null,
    enemies: [],
    sparks: [],
    projectiles: [],
    burningGround: [],
    novaFx: [],
    floaters: [],
    trail: [],
    relics: [],
    kills: 0,
    combo: 0,
    comboTimer: 0,
    score: 0,
    draft: [],
    forkOptions: [],
    pendingExtraDraft: false,
    nightMods: null,
    bossHpMul: 1,
    best: meta.best,
    victoryStats: null,
    defeatStats: null,
    promptBrazier: null,
    toastTimer: 0,
    hitSfxTimer: 0,
    fireTimer: 0,
    dashTimer: 0,
    novaChargeTimer: 0,
  };

  game.resetPlayer = function resetPlayer() {
    game.player = {
      x: ARENA.w / 2, y: ARENA.h / 2,
      hp: 100, maxHp: 100, light: 80, lightMax: 100,
      ember: 0, dashCharges: 2, novaCd: 0, novaCharges: 1,
      iframes: 0, dead: false,
    };
  };

  game.computeStats = function computeStats() {
    const w = meta.workshop;
    const s = {
      maxHp: tv('playerHp') + w.vitality * 10,
      speed: tv('playerSpeed') * (1 + w.swiftfoot * 0.04),
      lightRadius: tv('baseLightRadius') + w.wickcraft * 8,
      sparkDamage: tv('sparkDamage') * (1 + w.sparkforge * 0.08),
      sparkRate: tv('sparkRate'),
      pierce: 0,
      magnet: false,
      burningGround: false,
      bossDamage: 0,
      thorns: 0,
      kindleDiscount: 0,
      lightMax: tv('lightMax'),
      novaCharges: 1,
    };
    for (const id of game.relics) {
      const r = relicById(id);
      if (r) r.apply(s);
    }
    const syn = synergiesOf(game.relics);
    s.synergies = syn.active;
    s.flags = syn.flags;
    game.stats = s;
    if (game.player) {
      game.player.maxHp = s.maxHp;
      game.player.lightMax = s.lightMax;
    }
    return s;
  };

  game.resetPlayer();
  game.computeStats();

  // ---- night setup -------------------------------------------------------

  game.startNightState = function startNightState(night, rng, scale) {
    const litBefore = game.world ? game.world.braziers.filter((b) => b.lit).length : 0;
    game.night = night;
    game.world = makeWorld(night, rng, game.nightMods || {});
    game.enemies = [];
    game.sparks = [];
    game.projectiles = [];
    game.burningGround = [];
    game.novaFx = [];
    game.floaters = [];
    game.trail = [];
    game.fireTimer = 0;
    game.scale = scale;
    game.player.x = ARENA.w / 2;
    game.player.y = ARENA.h / 2;
    game.player.iframes = 0;
    game.player.dashCharges = tv('dashCharges');
    game.player.novaCharges = game.stats.novaCharges;
    game.player.novaCd = 0;
    // Eternal Flame synergy: lit braziers carry into the next night.
    if (game.stats.flags.permaBraziers && litBefore > 0) {
      for (let i = 0; i < Math.min(litBefore, game.world.braziers.length); i++) {
        game.world.braziers[i].lit = true;
      }
    }
    game.nightMods = null;
  };

  game.startNight = function startNight(night) {
    const diff = DIFFICULTIES[game.difficulty];
    let hpMul = diff.enemyMul;
    let dmgMul = diff.enemyMul;
    if (night > 7) {
      const extra = 1 + tv('endlessScale') * (night - 7);
      hpMul *= extra;
      dmgMul *= extra;
    }
    if (game.nightMods && game.nightMods.hpMul) hpMul *= game.nightMods.hpMul;
    game.startNightState(night, game.rng, { hpMul, dmgMul });
    game.showScreen('play');
    const realm = game.world.realm;
    game.toast(`NIGHT ${night} — ${realm.name.toUpperCase()}`, realm.tagline);
    if (night === 4) game.toast('NIGHT 4 — THE HOLLOW WARDEN STIRS', 'Something old guards the Gloomwood.');
    if (night === 7) game.toast('NIGHT 7 — GLOOMMAW', 'The dark itself comes to eat the flame.');
    game.updateHud();
  };

  game.startRun = function startRun(difficulty) {
    game.difficulty = difficulty;
    game.endless = false;
    game.night = 1;
    game.relics = [];
    game.kills = 0;
    game.combo = 0;
    game.comboTimer = 0;
    game.score = 0;
    game.runTime = 0;
    game.bossHpMul = 1;
    game.pendingExtraDraft = false;
    game.victoryStats = null;
    game.defeatStats = null;
    game.rng = makeRng((Date.now() % 2147483647) || 7);
    game.resetPlayer();
    game.computeStats();
    game.player.hp = game.stats.maxHp;
    game.player.light = 80;
    game.startNight(1);
    sfx.click();
  };

  // ---- combat ------------------------------------------------------------

  game.addEnemy = function addEnemy(e) {
    const c = ENEMY_COLORS[e.kind] || ENEMY_COLORS.wisp;
    e.color = c.color;
    e.rim = c.rim;
    e.eyeColor = c.eye;
    if (e.boss) {
      e.hp *= game.bossHpMul;
      e.maxHp *= game.bossHpMul;
    }
    game.enemies.push(e);
    return e;
  };

  game.killEnemy = function killEnemy(e) {
    e.dead = true;
    game.kills++;
    game.combo++;
    game.comboTimer = tv('comboWindow');
    const gain = Math.round(tv('scorePerKill') * game.combo * DIFFICULTIES[game.difficulty].scoreMul);
    game.score += gain;
    game.player.light = Math.min(game.player.lightMax, game.player.light + tv('lightPerKill'));
    game.floaters.push({ x: e.x, y: e.y - e.r - 6, text: `+${gain}`, color: '#ffd166', life: 0.9 });
    // Ember drops.
    const drops = e.boss ? 6 : e.kind === 'brute' ? 3 : Math.random() < 0.7 ? 1 : 0;
    for (let i = 0; i < drops; i++) {
      game.world.embers.push({
        x: e.x + rand(game.rng, -24, 24),
        y: e.y + rand(game.rng, -24, 24),
      });
    }
    if (e.splits) {
      for (let i = 0; i < 2; i++) {
        const w = makeEnemy('wisp', e.x + rand(game.rng, -20, 20), e.y + rand(game.rng, -20, 20), game.scale.hpMul, game.scale.dmgMul);
        game.addEnemy(w);
      }
    }
    if (e.boss) {
      game.toast(`${e.name.toUpperCase()} FALLS`, e.kind === 'gloommaw' ? 'The dark breaks. Dawn is coming.' : 'The Gloomwood breathes again.');
      sfx.win();
    } else {
      sfx.kill();
    }
  };

  game.damagePlayer = function damagePlayer(amount, fromX, fromY) {
    const p = game.player;
    if (p.iframes > 0 || p.dead) return;
    p.hp -= amount;
    p.iframes = 0.6;
    const dx = p.x - fromX;
    const dy = p.y - fromY;
    const d = Math.hypot(dx, dy) || 1;
    p.x = Math.max(40, Math.min(ARENA.w - 40, p.x + (dx / d) * 26));
    p.y = Math.max(40, Math.min(ARENA.h - 40, p.y + (dy / d) * 26));
    game.combo = 0;
    game.floaters.push({ x: p.x, y: p.y - 30, text: `-${Math.round(amount)}`, color: '#ff5a4e', life: 0.9 });
    sfx.hurt();
    if (p.hp <= 0) {
      p.hp = 0;
      p.dead = true;
      game.defeat();
    }
  };

  game.fireNova = function fireNova() {
    const p = game.player;
    if (p.novaCd > 0 || p.novaCharges <= 0) return;
    p.novaCharges--;
    p.novaCd = tv('novaCooldown');
    const radius = tv('novaRadius');
    game.novaFx.push({ x: p.x, y: p.y, r: 10, alpha: 1 });
    for (const e of game.enemies) {
      if (e.dead) continue;
      const d = Math.hypot(e.x - p.x, e.y - p.y);
      if (d < radius + e.r) {
        e.hp -= tv('novaDamage');
        e.hitFlash = 0.12;
        const nx = (e.x - p.x) / (d || 1);
        const ny = (e.y - p.y) / (d || 1);
        e.knockX += nx * 320;
        e.knockY += ny * 320;
      }
    }
    if (game.stats.burningGround) {
      game.burningGround.push({ x: p.x, y: p.y, r: radius * 0.8, life: 4 });
    }
    sfx.nova();
  };

  game.tryKindle = function tryKindle() {
    const p = game.player;
    const b = nearestUnlitBrazier(game.world.braziers, p.x, p.y, tv('kindleRange'));
    if (!b) return;
    const cost = kindleCost(game.stats);
    if (p.light < cost) {
      game.floaters.push({ x: p.x, y: p.y - 34, text: 'NOT ENOUGH LIGHT', color: '#ff5a4e', life: 1 });
      return;
    }
    p.light -= cost;
    b.lit = true;
    game.floaters.push({ x: b.x, y: b.y - 40, text: 'KINDLED', color: '#ffb347', life: 1.2 });
    sfx.kindle();
  };

  game.update = function update(dt) {
    const p = game.player;
    const s = game.stats;
    game.time += dt;
    game.runTime += dt;
    game.hitSfxTimer -= dt;

    // Movement.
    const mv = input.moveVector();
    p.x = Math.max(40, Math.min(ARENA.w - 40, p.x + mv.x * s.speed * dt));
    p.y = Math.max(40, Math.min(ARENA.h - 40, p.y + mv.y * s.speed * dt));

    // Dash.
    game.dashTimer += dt;
    if (game.dashTimer >= tv('dashRecharge') && p.dashCharges < tv('dashCharges')) {
      game.dashTimer = 0;
      p.dashCharges++;
    }
    if (input.pressed('Space') && p.dashCharges > 0) {
      p.dashCharges--;
      game.dashTimer = 0;
      let dx = mv.x;
      let dy = mv.y;
      if (dx === 0 && dy === 0) {
        const ax = input.mouse.x - p.x;
        const ay = input.mouse.y - p.y;
        const ad = Math.hypot(ax, ay) || 1;
        dx = ax / ad;
        dy = ay / ad;
      }
      const dist = tv('dashDistance');
      for (let i = 1; i <= 4; i++) {
        game.trail.push({ x: p.x + (dx * dist * i) / 4, y: p.y + (dy * dist * i) / 4, life: 0.25 });
      }
      p.x = Math.max(40, Math.min(ARENA.w - 40, p.x + dx * dist));
      p.y = Math.max(40, Math.min(ARENA.h - 40, p.y + dy * dist));
      p.iframes = Math.max(p.iframes, tv('dashIframes'));
      sfx.dash();
    }
    p.iframes = Math.max(0, p.iframes - dt);

    // Nova.
    p.novaCd = Math.max(0, p.novaCd - dt);
    game.novaChargeTimer += dt;
    if (game.novaChargeTimer >= tv('novaCooldown') && p.novaCharges < s.novaCharges) {
      game.novaChargeTimer = 0;
      p.novaCharges++;
    }
    if (input.pressed('KeyE')) game.fireNova();

    // Kindle.
    if (input.pressed('KeyF')) game.tryKindle();
    game.promptBrazier = nearestUnlitBrazier(game.world.braziers, p.x, p.y, tv('kindleRange'));

    // Sparks auto-fire at the nearest enemy in range.
    game.fireTimer -= dt;
    let nearest = null;
    let nearestD = tv('sparkRange');
    for (const e of game.enemies) {
      if (e.dead) continue;
      const d = Math.hypot(e.x - p.x, e.y - p.y);
      if (d < nearestD) {
        nearestD = d;
        nearest = e;
      }
    }
    if (nearest && game.fireTimer <= 0) {
      game.fireTimer = 1 / s.sparkRate;
      const baseDmg = s.sparkDamage * sparkDamageMul(p.light);
      const angles = s.flags.splitSparks ? [-0.16, 0.16] : [0];
      for (const off of angles) {
        const a = Math.atan2(nearest.y - p.y, nearest.x - p.x) + off;
        game.sparks.push({
          x: p.x, y: p.y,
          vx: Math.cos(a) * tv('sparkSpeed'),
          vy: Math.sin(a) * tv('sparkSpeed'),
          damage: baseDmg, pierce: s.pierce, life: 1.2,
        });
      }
      sfx.shoot();
    }

    // Sparks move and hit.
    for (const sp of game.sparks) {
      sp.x += sp.vx * dt;
      sp.y += sp.vy * dt;
      sp.life -= dt;
      if (sp.life <= 0) continue;
      for (const e of game.enemies) {
        if (e.dead || sp.pierce < 0) continue;
        if (sp.hit && sp.hit.has(e.id)) continue;
        if (Math.hypot(e.x - sp.x, e.y - sp.y) < e.r + 6) {
          if (!sp.hit) sp.hit = new Set();
          sp.hit.add(e.id);
          sp.pierce--;
          let dmg = sp.damage;
          if (e.boss) dmg *= 1 + s.bossDamage;
          e.hp -= dmg;
          e.hitFlash = 0.1;
          e.knockX += (sp.vx / tv('sparkSpeed')) * 60;
          e.knockY += (sp.vy / tv('sparkSpeed')) * 60;
          if (game.hitSfxTimer <= 0) {
            game.hitSfxTimer = 0.06;
            sfx.hit();
          }
        }
      }
    }
    game.sparks = game.sparks.filter((sp) => sp.life > 0 && sp.pierce >= 0 && sp.x > 0 && sp.x < ARENA.w && sp.y > 0 && sp.y < ARENA.h);

    // Spawns.
    const spawned = updateSpawns(game.world, dt, game.rng, p, game.scale.hpMul, game.scale.dmgMul, (e) => {
      if (e.boss) {
        game.toast(`${e.name.toUpperCase()} AWAKENS`, e.kind === 'gloommaw' ? 'Night 7. End it.' : 'The Warden guards the deep wood.');
        sfx.boss();
      }
    });
    for (const e of spawned) game.addEnemy(e);

    // Enemies move and attack.
    for (const e of game.enemies) {
      if (e.dead) continue;
      e.hitFlash = Math.max(0, e.hitFlash - dt);
      e.burning = Math.max(0, e.burning - dt);
      const shots = updateEnemy(e, dt, p, {
        time: game.time,
        arena: ARENA,
        onBossPhase(boss) {
          game.toast('GLOOMMAW — PHASE 2', 'It charges. It summons. Do not stand still.');
          sfx.boss();
        },
        onBossSummon(boss) {
          for (let i = 0; i < 3; i++) {
            const a = (i / 3) * Math.PI * 2;
            game.addEnemy(makeEnemy('wisp', boss.x + Math.cos(a) * 80, boss.y + Math.sin(a) * 80, game.scale.hpMul, game.scale.dmgMul));
          }
        },
      });
      for (const sh of shots) game.projectiles.push(sh);
      // Contact damage.
      if (Math.hypot(e.x - p.x, e.y - p.y) < e.r + 14) {
        if (s.thorns > 0) {
          e.hp -= s.thorns;
          e.hitFlash = 0.1;
        }
        game.damagePlayer(e.damage, e.x, e.y);
      }
    }

    // Hostile projectiles.
    for (const pr of game.projectiles) {
      pr.x += pr.vx * dt;
      pr.y += pr.vy * dt;
      pr.life -= dt;
      if (Math.hypot(pr.x - p.x, pr.y - p.y) < pr.r + 13) {
        pr.life = 0;
        game.damagePlayer(pr.damage, pr.x - pr.vx * 0.01, pr.y - pr.vy * 0.01);
      }
    }
    game.projectiles = game.projectiles.filter((pr) => pr.life > 0);

    // Brazier burn + burning ground.
    burnShadows(game.world.braziers, game.enemies, dt);
    for (const g of game.burningGround) {
      g.life -= dt;
      for (const e of game.enemies) {
        if (e.dead) continue;
        if (Math.hypot(e.x - g.x, e.y - g.y) < g.r + e.r) {
          e.hp -= 26 * dt;
          e.burning = 0.4;
        }
      }
    }
    game.burningGround = game.burningGround.filter((g) => g.life > 0);

    // Deaths.
    for (const e of game.enemies) {
      if (!e.dead && e.hp <= 0) game.killEnemy(e);
    }
    game.enemies = game.enemies.filter((e) => !e.dead);

    // Hazards.
    for (const hz of game.world.hazards) {
      const d = Math.hypot(p.x - hz.x, p.y - hz.y);
      if (hz.kind === 'vein' && !hz.taken && d < hz.r + 14) {
        hz.taken = true;
        p.light = Math.min(p.lightMax, p.light + 10);
        p.ember += 5;
        game.floaters.push({ x: p.x, y: p.y - 30, text: '+10 LIGHT  +5 EMBER', color: '#ffb347', life: 1 });
        sfx.pickup();
      } else if (hz.kind === 'thorn' && d < hz.r) {
        p.hp -= 8 * dt;
        if (p.hp <= 0) {
          p.hp = 0;
          p.dead = true;
          game.defeat();
          return;
        }
      }
    }

    // Ember pickups.
    for (const em of game.world.embers) {
      const d = Math.hypot(em.x - p.x, em.y - p.y);
      if (s.magnet && d < 170) {
        em.x += ((p.x - em.x) / (d || 1)) * 340 * dt;
        em.y += ((p.y - em.y) / (d || 1)) * 340 * dt;
      }
      if (d < 24) {
        em.taken = true;
        p.light = Math.min(p.lightMax, p.light + tv('lightPerEmber'));
        p.ember++;
        sfx.pickup();
      }
    }
    game.world.embers = game.world.embers.filter((em) => !em.taken);

    // Combo decay.
    game.comboTimer -= dt;
    if (game.comboTimer <= 0) game.combo = 0;

    // FX decay.
    for (const n of game.novaFx) {
      n.r += 700 * dt;
      n.alpha -= dt * 1.6;
    }
    game.novaFx = game.novaFx.filter((n) => n.alpha > 0 && n.r < tv('novaRadius') * 1.4);
    for (const f of game.floaters) {
      f.y -= 24 * dt;
      f.life -= dt;
    }
    game.floaters = game.floaters.filter((f) => f.life > 0);
    for (const t of game.trail) t.life -= dt;
    game.trail = game.trail.filter((t) => t.life > 0);

    // Night cleared?
    if (game.screen === 'play' && !p.dead && nightCleared(game.world, game.enemies)) {
      game.endNight();
    }
  };

  // ---- night flow ----------------------------------------------------------

  game.endNight = function endNight() {
    const night = game.night;
    // Bank the night's ember.
    meta.ember += game.player.ember;
    saveMeta(meta);
    if (night === 7 && !game.endless) {
      game.victory();
      return;
    }
    game.draft = draftRelics(game.rng, game.relics);
    game.showScreen('draft');
    sfx.relic();
  };

  game.chooseRelic = function chooseRelic(relic) {
    if (relic.cache) {
      game.player.ember += 40;
      meta.ember += 40;
      saveMeta(meta);
    } else {
      game.relics.push(relic.id);
      game.computeStats();
    }
    sfx.relic();
    if (game.pendingExtraDraft) {
      game.pendingExtraDraft = false;
      game.draft = draftRelics(game.rng, game.relics);
      game.showScreen('draft');
      return;
    }
    if ([2, 4, 6].includes(game.night) && !game.endless) {
      game.forkOptions = forkPair(game.night, game.rng);
      game.showScreen('fork');
    } else {
      game.startNight(game.night + 1);
    }
  };

  game.chooseFork = function chooseFork(route) {
    const p = game.player;
    game.nightMods = game.nightMods || {};
    if (route.id === 'forge') {
      game.pendingExtraDraft = true;
      game.nightMods.hpMul = 1.2;
    } else if (route.id === 'moonwell') {
      p.hp = p.maxHp;
      game.nightMods.brazierDelta = -1;
    } else if (route.id === 'ashvault') {
      p.ember += 60;
      meta.ember += 60;
      saveMeta(meta);
      game.nightMods.bruteStart = true;
    } else if (route.id === 'hollowgate') {
      game.nightMods.skipFirstWave = true;
      game.bossHpMul *= 1.15;
    }
    sfx.click();
    game.startNight(game.night + 1);
  };

  game.victory = function victory() {
    const mins = Math.floor(game.runTime / 60);
    const secs = Math.floor(game.runTime % 60);
    game.victoryStats = {
      nights: 7,
      kills: game.kills,
      relics: game.relics.map((id) => relicById(id).name),
      ember: game.player.ember,
      score: game.score,
      time: `${mins}:${String(secs).padStart(2, '0')}`,
      difficulty: DIFFICULTIES[game.difficulty].label,
    };
    if (!game.best || game.score > game.best.score) {
      game.best = { score: game.score, night: 7, kills: game.kills };
      meta.best = game.best;
      saveMeta(meta);
    }
    sfx.win();
    game.showScreen('victory');
  };

  game.defeat = function defeat() {
    game.defeatStats = {
      night: game.night,
      kills: game.kills,
      relics: game.relics.map((id) => relicById(id).name),
      ember: game.player.ember,
      score: game.score,
    };
    if (!game.best || game.score > game.best.score) {
      game.best = { score: game.score, night: game.night, kills: game.kills };
      meta.best = game.best;
      saveMeta(meta);
    }
    sfx.lose();
    game.showScreen('defeat');
  };

  game.continueEndless = function continueEndless() {
    game.endless = true;
    game.player.hp = game.player.maxHp;
    game.startNight(8);
  };

  // ---- screens (DOM) -------------------------------------------------------

  game.toast = function toast(title, sub) {
    const t = el('toast');
    t.innerHTML = `<div class="toast-title">${title}</div>${sub ? `<div class="toast-sub">${sub}</div>` : ''}`;
    t.classList.add('show');
    game.toastTimer = 2.6;
  };

  game.showScreen = function showScreen(name) {
    game.screen = name;
    const screen = el('screen');
    const hud = el('hud');
    hud.classList.toggle('hidden', name !== 'play');
    if (name === 'play') {
      screen.innerHTML = '';
      screen.classList.add('hidden');
      return;
    }
    screen.classList.remove('hidden');
    if (name === 'start') screen.innerHTML = startHtml(game);
    else if (name === 'draft') screen.innerHTML = draftHtml(game);
    else if (name === 'fork') screen.innerHTML = forkHtml(game);
    else if (name === 'pause') screen.innerHTML = pauseHtml(game);
    else if (name === 'victory') screen.innerHTML = victoryHtml(game);
    else if (name === 'defeat') screen.innerHTML = defeatHtml(game);
    wireScreen(game);
  };

  function workshopHtml(game) {
    const rows = WORKSHOP.map((t) => {
      const lvl = game.meta.workshop[t.id] || 0;
      const maxed = lvl >= 5;
      const cost = maxed ? 0 : workshopCost(t, lvl);
      const pips = Array.from({ length: 5 }, (_, i) => `<span class="pip${i < lvl ? ' on' : ''}"></span>`).join('');
      return `<div class="ws-row">
        <div class="ws-name">${t.name}<span class="ws-desc">${t.desc}</span></div>
        <div class="ws-pips">${pips}</div>
        <button class="ws-buy" data-track="${t.id}" ${maxed || game.meta.ember < cost ? 'disabled' : ''}>${maxed ? 'MAX' : `UPGRADE — ${cost} ember`}</button>
      </div>`;
    }).join('');
    return `<div class="workshop"><div class="ws-head">EMBER WORKSHOP <span class="ws-bank">Banked ember: ${game.meta.ember}</span></div>${rows}
      <div class="ws-note">Upgrades are permanent. They apply to every run from now on.</div></div>`;
  }

  function difficultyHtml(game) {
    return Object.entries(DIFFICULTIES).map(([id, d]) => `
      <button class="diff-btn${game.difficulty === id ? ' active' : ''}" data-diff="${id}">
        <span class="diff-name">${d.label}</span>
        <span class="diff-blurb">${d.blurb}</span>
      </button>`).join('');
  }

  function startHtml(game) {
    const best = game.best
      ? `Best run: ${game.best.score} pts — Night ${game.best.night} — ${game.best.kills} kills`
      : 'No runs yet. The flame is waiting.';
    return `<div class="panel start-panel">
      <div class="title">EMBERKEEP</div>
      <div class="subtitle">Guard the Last Ember — 7 Nights, 3 Realms</div>
      <div class="winlose"><span><b>WIN:</b> Slay Gloommaw on Night 7.</span><span><b>LOSE:</b> Your HP reaches 0.</span></div>
      <div class="pitch">Light is your weapon <b>and</b> your currency. KINDLE braziers to claim ground from the dark — it costs LIGHT, and your glow and sparks shrink with it. Spend light to hold land, or keep it to kill.</div>
      <div class="controls">
        <span><b>WASD / Arrows</b> Move</span><span><b>Mouse</b> Aim</span><span><b>Sparks</b> Auto-fire</span>
        <span><b>SPACE</b> Dash (2 charges)</span><span><b>E</b> Nova</span><span><b>F</b> KINDLE brazier</span>
        <span><b>P</b> Pause</span><span><b>M</b> Mute</span>
      </div>
      <div class="diff-row">${difficultyHtml(game)}</div>
      ${workshopHtml(game)}
      <div class="best">${best}</div>
      <button class="big-btn" data-action="start">LIGHT THE FIRST NIGHT</button>
      <div class="foot">An original game. All art drawn in code, all sound synthesized live.</div>
    </div>`;
  }

  function draftHtml(game) {
    const owned = new Set(game.relics);
    const cards = game.draft.map((r) => {
      const completes = synergiesOf([...owned, r.id]).active.filter((s) => !synergiesOf([...owned]).active.includes(s));
      return `<button class="relic-card" data-relic="${r.id}">
        <span class="relic-name">${r.name}</span>
        <span class="relic-desc">${r.desc}</span>
        ${completes.length ? `<span class="relic-syn">Completes synergy: ${completes[0].name}</span>` : ''}
      </button>`;
    }).join('');
    const ownedList = game.relics.map((id) => relicById(id).name).join(' · ') || 'None yet';
    return `<div class="panel">
      <div class="panel-title">NIGHT ${game.night} CLEARED</div>
      <div class="panel-sub">The dark retreats. Choose one relic.</div>
      <div class="relic-row">${cards}</div>
      <div class="owned">Your build: ${ownedList}</div>
    </div>`;
  }

  function forkHtml(game) {
    const [a, b] = game.forkOptions;
    const card = (r) => `<button class="fork-card" data-fork="${r.id}">
      <span class="fork-name">${r.name}</span>
      <span class="fork-reward">+ ${r.reward}</span>
      <span class="fork-danger">- ${r.danger}</span>
      <span class="fork-blurb">${r.blurb}</span>
    </button>`;
    const ownedList = game.relics.map((id) => relicById(id).name).join(' · ') || 'None yet';
    const realms = realmForNight(1).name + ' (Nights 1-2)  ·  ' + realmForNight(3).name + ' (Nights 3-5)  ·  ' + realmForNight(6).name + ' (Nights 6-7)';
    return `<div class="panel">
      <div class="panel-title">THE ROAD FORKS</div>
      <div class="panel-sub">Night ${game.night} is done. Two roads lead on. Both cost something.</div>
      <div class="fork-row">${card(a)}${card(b)}</div>
      <div class="owned">Your build: ${ownedList}</div>
      <div class="realm-preview">The journey: ${realms}</div>
    </div>`;
  }

  function pauseHtml(game) {
    return `<div class="panel">
      <div class="panel-title">PAUSED</div>
      <div class="panel-sub">Night ${game.night} — ${game.world.realm.name}. The flame waits.</div>
      <div class="btn-row">
        <button class="big-btn" data-action="resume">RESUME</button>
        <button class="big-btn ghost" data-action="restart">RESTART RUN</button>
        <button class="big-btn ghost" data-action="title">QUIT TO TITLE</button>
      </div>
      <div class="panel-sub">Sound: ${isMuted() ? 'OFF' : 'ON'} — press M to toggle.</div>
    </div>`;
  }

  function victoryHtml(game) {
    const v = game.victoryStats;
    const unlock = v.ember >= 30
      ? `You banked ${v.ember} ember. That buys a Workshop upgrade on your next run — your next ember starts stronger.`
      : `You banked ${v.ember} ember toward the Workshop. Every run feeds the next.`;
    return `<div class="panel">
      <div class="panel-title win">THE DAWN RETURNS</div>
      <div class="panel-sub">Gloommaw is ash. The Last Ember becomes the first morning.</div>
      <div class="recap">
        <div><span>Nights survived</span><b>${v.nights}</b></div>
        <div><span>Kills</span><b>${v.kills}</b></div>
        <div><span>Score</span><b>${v.score}</b></div>
        <div><span>Time</span><b>${v.time}</b></div>
        <div><span>Difficulty</span><b>${v.difficulty}</b></div>
        <div><span>Ember banked</span><b>${v.ember}</b></div>
      </div>
      <div class="owned">Relics carried: ${v.relics.join(' · ') || 'None'}</div>
      <div class="unlock">${unlock}</div>
      <div class="btn-row">
        <button class="big-btn" data-action="restart">PLAY AGAIN</button>
        <button class="big-btn" data-action="endless">ENDLESS — NIGHT 8+</button>
      </div>
    </div>`;
  }

  function defeatHtml(game) {
    const d = game.defeatStats;
    return `<div class="panel">
      <div class="panel-title lose">THE EMBER DIES</div>
      <div class="panel-sub">Night ${d.night} takes the flame. The Workshop keeps your ember — come back stronger.</div>
      <div class="recap">
        <div><span>Night reached</span><b>${d.night} / 7</b></div>
        <div><span>Kills</span><b>${d.kills}</b></div>
        <div><span>Score</span><b>${d.score}</b></div>
        <div><span>Ember banked</span><b>${d.ember}</b></div>
      </div>
      <div class="owned">Relics carried: ${d.relics.join(' · ') || 'None'}</div>
      <div class="btn-row">
        <button class="big-btn" data-action="restart">TRY AGAIN</button>
        <button class="big-btn ghost" data-action="title">BACK TO TITLE</button>
      </div>
    </div>`;
  }

  function wireScreen(game) {
    const screen = el('screen');
    screen.querySelectorAll('[data-action]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const a = btn.dataset.action;
        if (a === 'start' || a === 'restart') game.startRun(game.difficulty);
        else if (a === 'resume') game.showScreen('play');
        else if (a === 'title') game.toTitle();
        else if (a === 'endless') game.continueEndless();
      });
    });
    screen.querySelectorAll('[data-diff]').forEach((btn) => {
      btn.addEventListener('click', () => {
        game.difficulty = btn.dataset.diff;
        sfx.click();
        game.showScreen('start');
      });
    });
    screen.querySelectorAll('[data-track]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const track = WORKSHOP.find((t) => t.id === btn.dataset.track);
        const lvl = game.meta.workshop[track.id] || 0;
        const cost = workshopCost(track, lvl);
        if (lvl < 5 && game.meta.ember >= cost) {
          game.meta.ember -= cost;
          game.meta.workshop[track.id] = lvl + 1;
          saveMeta(game.meta);
          game.computeStats();
          sfx.relic();
          game.showScreen('start');
        }
      });
    });
    screen.querySelectorAll('[data-relic]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const r = game.draft.find((x) => x.id === btn.dataset.relic);
        if (r) game.chooseRelic(r);
      });
    });
    screen.querySelectorAll('[data-fork]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const r = game.forkOptions.find((x) => x.id === btn.dataset.fork);
        if (r) game.chooseFork(r);
      });
    });
  }

  game.toTitle = function toTitle() {
    game.rng = makeRng((Date.now() % 2147483647) || 7);
    game.relics = [];
    game.computeStats();
    game.resetPlayer();
    game.startNightState(1, game.rng, { hpMul: 1, dmgMul: 1 });
    game.world.braziers[0].lit = true;
    game.showScreen('start');
  };

  // ---- HUD -----------------------------------------------------------------

  game.updateHud = function updateHud() {
    const p = game.player;
    const s = game.stats;
    el('hpFill').style.width = `${(p.hp / p.maxHp) * 100}%`;
    el('hpText').textContent = `HP ${Math.ceil(p.hp)} / ${p.maxHp}`;
    el('lightFill').style.width = `${(p.light / p.lightMax) * 100}%`;
    el('lightText').textContent = `LIGHT ${Math.floor(p.light)} / ${p.lightMax}`;
    const realm = game.world ? game.world.realm : realmForNight(game.night);
    el('nightLabel').textContent = game.endless || game.night > 7 ? `NIGHT ${game.night} — ENDLESS` : `NIGHT ${game.night} / 7`;
    el('realmLabel').textContent = realm.name;
    const remaining = game.world ? game.world.spawnQueue.length + game.enemies.filter((e) => !e.dead).length : 0;
    el('enemiesLeft').textContent = game.world && game.world.boss && !game.world.boss.dead
      ? 'BOSS'
      : `${remaining} shadows left`;
    el('scoreVal').textContent = game.score;
    el('killsVal').textContent = game.kills;
    el('comboVal').textContent = game.combo > 1 ? `x${game.combo} COMBO` : '';
    el('emberVal').textContent = p.ember;
    // Relic chips + synergy badges.
    el('relicRow').innerHTML = game.relics.map((id) => {
      const r = relicById(id);
      return `<span class="relic-chip" title="${r.desc}">${r.name}</span>`;
    }).join('') || '<span class="relic-chip dim">No relics yet</span>';
    el('synergyRow').innerHTML = (s.synergies || []).map((syn) => `<span class="syn-badge">${syn.name}: ${syn.desc}</span>`).join('');
    // Dash pips + nova.
    el('dashPips').innerHTML = Array.from({ length: tv('dashCharges') }, (_, i) =>
      `<span class="dash-pip${i < p.dashCharges ? ' on' : ''}"></span>`).join('') + '<span class="hud-key">SPACE — DASH</span>';
    el('novaLabel').textContent = p.novaCharges > 0
      ? `NOVA [E] READY x${p.novaCharges}`
      : `NOVA [E] ${Math.ceil(p.novaCd)}s`;
    el('novaLabel').classList.toggle('ready', p.novaCharges > 0);
    // Boss bar.
    const boss = game.world && game.world.boss;
    const bossBar = el('bossBar');
    if (boss && !boss.dead) {
      bossBar.classList.remove('hidden');
      el('bossName').textContent = boss.phase === 2 ? `${boss.name} — PHASE 2` : boss.name;
      el('bossFill').style.width = `${Math.max(0, (boss.hp / boss.maxHp) * 100)}%`;
    } else {
      bossBar.classList.add('hidden');
    }
    // Kindle prompt, positioned over the brazier.
    const prompt = el('kindlePrompt');
    if (game.promptBrazier && game.screen === 'play') {
      const b = game.promptBrazier;
      const cost = kindleCost(s);
      const afford = p.light >= cost;
      prompt.classList.remove('hidden');
      prompt.classList.toggle('poor', !afford);
      prompt.style.left = `${(b.x / ARENA.w) * 100}%`;
      prompt.style.top = `${((b.y - 78) / ARENA.h) * 100}%`;
      prompt.textContent = afford ? `KINDLE [F] — ${cost} LIGHT` : `KINDLE [F] — NEED ${cost} LIGHT`;
    } else {
      prompt.classList.add('hidden');
    }
    // Toast fade.
    if (game.toastTimer > 0) {
      game.toastTimer -= 1 / 60;
      if (game.toastTimer <= 0) el('toast').classList.remove('show');
    }
  };

  game.renderFrame = function renderFrame() {
    const t = game.shotMode ? game.shotTime : game.time;
    drawScene(ctx, game, t);
  };

  // ---- loop ------------------------------------------------------------------

  let last = performance.now();
  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    if (!game.shotMode) {
      if (input.pressed('KeyP') && (game.screen === 'play' || game.screen === 'pause')) {
        game.showScreen(game.screen === 'play' ? 'pause' : 'play');
      }
      if (input.pressed('KeyM')) {
        setMuted(!isMuted());
        game.toast(isMuted() ? 'SOUND OFF' : 'SOUND ON', '');
      }
      if (game.screen === 'play') {
        game.update(dt);
        game.updateHud();
      }
      game.renderFrame();
      input.endFrame();
    }
    requestAnimationFrame(frame);
  }

  // ---- boot ------------------------------------------------------------------

  const shot = getShotParam();
  if (shot) {
    stageShot(game, shot);
    // Frozen frame: the loop keeps painting the same staged scene.
    requestAnimationFrame(frame);
  } else {
    game.toTitle();
    requestAnimationFrame(frame);
  }

  return game;
}

// Boot when the module loads.
const canvas = document.getElementById('game');
window.__emberkeep = createGame(canvas);
