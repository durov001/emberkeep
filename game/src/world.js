// The world: one night's arena. Holds braziers, decor, hazards, ember
// pickups and the spawn director that feeds enemies in over the night.

import { tv } from './tuning.js';
import { ARENA, realmForNight } from './realms.js';
import { makeBraziers } from './kindle.js';
import { kindsForNight, makeEnemy, makeBoss } from './enemies.js';
import { rand, randInt, pick, shuffle } from './rng.js';

export function enemiesForNight(night) {
  return tv('enemiesBase') + tv('enemiesPerNight') * night;
}

export function makeWorld(night, rng, mods) {
  const realm = realmForNight(night);
  const brazierCount = Math.max(2, tv('brazierCount') + (mods.brazierDelta || 0));
  const world = {
    night,
    realm,
    time: 0,
    braziers: makeBraziers(rng, brazierCount),
    decor: makeDecor(realm, rng),
    hazards: makeHazards(realm, rng),
    embers: [],
    spawnQueue: buildSpawnQueue(night, rng, mods),
    spawnTimer: 0.8,
    boss: null,
    bossSpawned: false,
    bossAnnounced: false,
    nightCleared: false,
  };
  return world;
}

function makeDecor(realm, rng) {
  const out = [];
  const n = realm.decor === 'trees' ? 14 : realm.decor === 'ruins' ? 10 : 12;
  for (let i = 0; i < n; i++) {
    const x = rand(rng, 60, ARENA.w - 60);
    const y = rand(rng, 60, ARENA.h - 60);
    if (Math.hypot(x - ARENA.w / 2, y - ARENA.h / 2) < 130) continue;
    out.push({ x, y, s: rand(rng, 0.7, 1.4), rot: rand(rng, 0, Math.PI * 2), kind: realm.decor });
  }
  return out;
}

function makeHazards(realm, rng) {
  const out = [];
  if (realm.hazard === 'vein') {
    for (let i = 0; i < 5; i++) {
      out.push({ x: rand(rng, 120, ARENA.w - 120), y: rand(rng, 110, ARENA.h - 110), r: rand(rng, 26, 40), kind: 'vein', taken: false });
    }
  } else if (realm.hazard === 'thorn') {
    for (let i = 0; i < 4; i++) {
      out.push({ x: rand(rng, 140, ARENA.w - 140), y: rand(rng, 120, ARENA.h - 120), r: rand(rng, 40, 58), kind: 'thorn' });
    }
  } else {
    for (let i = 0; i < 3; i++) {
      out.push({ x: rand(rng, 160, ARENA.w - 160), y: rand(rng, 130, ARENA.h - 130), r: rand(rng, 30, 44), kind: 'rift', pulse: rand(rng, 0, 6) });
    }
  }
  return out;
}

function buildSpawnQueue(night, rng, mods) {
  const total = enemiesForNight(night);
  const kinds = kindsForNight(night);
  const queue = [];
  // Early nights lean on wisps; later nights mix everything.
  for (let i = 0; i < total; i++) {
    let kind;
    if (i < 3) kind = 'wisp';
    else if (night <= 2) kind = pick(rng, ['wisp', 'wisp', 'crawler']);
    else kind = pick(rng, kinds);
    queue.push(kind);
  }
  const head = queue.slice(0, 3);
  const tail = shuffle(rng, queue.slice(3));
  const mixed = head.concat(tail);
  if (mods.bruteStart) mixed.unshift('brute', 'brute', 'brute');
  if (mods.skipFirstWave) mixed.splice(0, Math.min(6, mixed.length));
  return mixed;
}

export function spawnPoint(rng, player) {
  // Spawn at the arena edge, away from the player.
  for (let tries = 0; tries < 12; tries++) {
    const edge = randInt(rng, 0, 3);
    let x;
    let y;
    if (edge === 0) { x = rand(rng, 40, ARENA.w - 40); y = 44; }
    else if (edge === 1) { x = rand(rng, 40, ARENA.w - 40); y = ARENA.h - 44; }
    else if (edge === 2) { x = 44; y = rand(rng, 40, ARENA.h - 40); }
    else { x = ARENA.w - 44; y = rand(rng, 40, ARENA.h - 40); }
    if (Math.hypot(x - player.x, y - player.y) > 320) return { x, y };
  }
  return { x: 60, y: 60 };
}

// Advance the spawn director. Returns newly spawned enemies.
export function updateSpawns(world, dt, rng, player, hpMul, dmgMul, onSpawn) {
  const out = [];
  world.time += dt;
  // Boss nights: the boss arrives once a third of the queue is out.
  const bossNight = world.night === 4 || world.night === 7;
  if (bossNight && !world.bossSpawned && world.spawnQueue.length < enemiesForNight(world.night) * 0.66) {
    world.bossSpawned = true;
    const bossId = world.night === 4 ? 'warden' : 'gloommaw';
    const p = spawnPoint(rng, player);
    const boss = makeBoss(bossId, p.x, p.y, hpMul, dmgMul);
    world.boss = boss;
    out.push(boss);
    onSpawn?.(boss);
  }
  if (world.spawnQueue.length > 0) {
    world.spawnTimer -= dt;
    if (world.spawnTimer <= 0) {
      world.spawnTimer = tv('spawnInterval');
      const kind = world.spawnQueue.shift();
      const p = spawnPoint(rng, player);
      const e = makeEnemy(kind, p.x, p.y, hpMul, dmgMul);
      out.push(e);
      onSpawn?.(e);
    }
  }
  return out;
}

export function nightCleared(world, enemies) {
  return world.spawnQueue.length === 0 && enemies.every((e) => e.dead) && (world.boss === null || world.boss.dead);
}
