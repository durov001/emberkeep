// Enemies: 5 kinds with distinct silhouettes and behavior, plus the two
// bosses. Each kind is a stat block; makeEnemy stamps one out with the
// night's difficulty scaling. updateEnemy moves and attacks; the drawing of
// each silhouette lives in render.js.

import { tv } from './tuning.js';

export const KINDS = {
  wisp: { name: 'Wisp', r: 13, hp: 'wispHp', speed: 'wispSpeed', damage: 'wispDamage', ranged: false, firstNight: 1 },
  crawler: { name: 'Crawler', r: 20, hp: 'crawlerHp', speed: 'crawlerSpeed', damage: 'crawlerDamage', ranged: false, firstNight: 2 },
  spitter: { name: 'Spitter', r: 15, hp: 'spitterHp', speed: 'spitterSpeed', damage: 'spitterDamage', ranged: true, firstNight: 3 },
  splitter: { name: 'Splitter', r: 17, hp: 'splitterHp', speed: 'splitterSpeed', damage: 'splitterDamage', ranged: false, firstNight: 4, splits: true },
  brute: { name: 'Brute', r: 26, hp: 'bruteHp', speed: 'bruteSpeed', damage: 'bruteDamage', ranged: false, firstNight: 5 },
};

export const BOSSES = {
  warden: { name: 'Hollow Warden', r: 44, hp: 'wardenHp', speed: 70, damage: 26, night: 4 },
  gloommaw: { name: 'Gloommaw', r: 62, hp: 'gloommawHp', speed: 62, damage: 30, night: 7 },
};

let nextId = 1;

export function makeEnemy(kindId, x, y, hpMul, dmgMul) {
  const k = KINDS[kindId];
  return {
    id: nextId++,
    kind: kindId,
    name: k.name,
    x, y, r: k.r,
    hp: tv(k.hp) * hpMul,
    maxHp: tv(k.hp) * hpMul,
    speed: tv(k.speed) * (0.9 + Math.random() * 0.2),
    damage: tv(k.damage) * dmgMul,
    ranged: k.ranged,
    splits: !!k.splits,
    boss: false,
    shootCd: 1 + Math.random(),
    wobble: Math.random() * Math.PI * 2,
    hitFlash: 0,
    burning: 0,
    knockX: 0,
    knockY: 0,
    dead: false,
  };
}

export function makeBoss(bossId, x, y, hpMul, dmgMul) {
  const b = BOSSES[bossId];
  return {
    id: nextId++,
    kind: bossId,
    name: b.name,
    x, y, r: b.r,
    hp: tv(b.hp) * hpMul,
    maxHp: tv(b.hp) * hpMul,
    speed: b.speed,
    damage: b.damage * dmgMul,
    ranged: false,
    boss: true,
    phase: 1,
    shootCd: 2,
    chargeCd: 4,
    charging: 0,
    chargeVx: 0,
    chargeVy: 0,
    summonCd: 6,
    wobble: 0,
    hitFlash: 0,
    burning: 0,
    knockX: 0,
    knockY: 0,
    dead: false,
  };
}

// Which kinds may appear on a given night.
export function kindsForNight(night) {
  return Object.keys(KINDS).filter((k) => KINDS[k].firstNight <= night);
}

// Move one enemy toward the player; ranged kinds keep their distance and
// fire. Returns projectiles the enemy fired this tick (may be empty).
export function updateEnemy(e, dt, player, ctx) {
  const dx = player.x - e.x;
  const dy = player.y - e.y;
  const dist = Math.hypot(dx, dy) || 1;
  const nx = dx / dist;
  const ny = dy / dist;
  const shots = [];

  if (e.boss && e.kind === 'gloommaw' && e.phase === 2 && e.charging > 0) {
    // Phase 2 charge: straight line, fast, telegraphed by the wind-up.
    e.x += e.chargeVx * dt;
    e.y += e.chargeVy * dt;
    e.charging -= dt;
  } else if (e.ranged && dist < 300) {
    // Spitters back away and shoot.
    e.x -= nx * e.speed * 0.6 * dt;
    e.y -= ny * e.speed * 0.6 * dt;
    e.shootCd -= dt;
    if (e.shootCd <= 0 && dist < 380) {
      e.shootCd = 2.2;
      shots.push({ x: e.x, y: e.y, vx: nx * 260, vy: ny * 260, r: 6, damage: e.damage, hostile: true, life: 3 });
    }
  } else {
    const wob = Math.sin(ctx.time * 3 + e.wobble) * 0.35;
    const px = nx - ny * wob * 0.4;
    const py = ny + nx * wob * 0.4;
    e.x += px * e.speed * dt;
    e.y += py * e.speed * dt;
  }

  // Boss behaviours.
  if (e.boss) {
    e.shootCd -= dt;
    if (e.kind === 'warden' && e.shootCd <= 0) {
      // Radial burst of 8 bolts.
      e.shootCd = 3.2;
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2 + ctx.time;
        shots.push({ x: e.x, y: e.y, vx: Math.cos(a) * 200, vy: Math.sin(a) * 200, r: 7, damage: e.damage * 0.6, hostile: true, life: 3.5 });
      }
    }
    if (e.kind === 'gloommaw') {
      if (e.phase === 1 && e.hp < e.maxHp * 0.5) {
        e.phase = 2;
        e.speed *= 1.35;
        ctx.onBossPhase?.(e);
      }
      if (e.phase === 2) {
        e.summonCd -= dt;
        if (e.summonCd <= 0) {
          e.summonCd = 7;
          ctx.onBossSummon?.(e);
        }
        e.chargeCd -= dt;
        if (e.chargeCd <= 0 && e.charging <= 0) {
          e.chargeCd = 5;
          e.charging = 0.7;
          e.chargeVx = nx * 560;
          e.chargeVy = ny * 560;
        }
      }
    }
  }

  // Knockback decay.
  e.x += e.knockX * dt;
  e.y += e.knockY * dt;
  e.knockX *= Math.pow(0.001, dt);
  e.knockY *= Math.pow(0.001, dt);

  // Stay inside the arena.
  e.x = Math.max(30 + e.r, Math.min(ctx.arena.w - 30 - e.r, e.x));
  e.y = Math.max(30 + e.r, Math.min(ctx.arena.h - 30 - e.r, e.y));
  return shots;
}
