// EMBERKEEP — shots: deterministic staging for the entry's screenshots.
// ?shot=start|play|upgrade|victory&seed=<n> stages a scene from the real
// game state and the real renderer, then main.js paints one frame and sets
// window.__shotReady. Nothing here runs during normal play.

import { ARENA, UPGRADES } from './tuning.js';
import {
  addText, burst, createWorld, rollUpgrades, spawnEnemy,
  startRun, updateWorld,
} from './world.js';
import { ScriptedInput } from './input.js';

/** Read the shot request from the URL, or null when this is a normal visit. */
export function parseShotQuery() {
  const params = new URLSearchParams(window.location.search);
  const name = params.get('shot');
  if (!name) return null;
  const seed = Number(params.get('seed') || 7);
  return { name, seed: Number.isFinite(seed) ? seed : 7 };
}

/** Stage a named scene into a fresh world. Returns the staged world. */
export function stageShot(name, seed) {
  const world = createWorld(seed);
  if (name === 'start') {
    stageTitle(world);
  } else if (name === 'play') {
    stagePlay(world);
  } else if (name === 'upgrade') {
    stageUpgrade(world);
  } else if (name === 'victory') {
    stageVictory(world);
  } else {
    stageTitle(world);
  }
  world.shake = 0;
  world.flash = 0;
  return world;
}

/** The title screen, flame flickering at a fixed moment. */
function stageTitle(world) {
  world.state = 'title';
  world.animTime = 2.5;
  world.best = 24830;
}

/**
 * A busy mid-game moment: wave 6, the light radius up, several enemy kinds
 * around the flame (some burning inside the glow, some dim silhouettes
 * beyond it), sparks in flight, damage numbers rising, a healthy score.
 * Built from the real rules: a real run, real upgrades, real enemies, then
 * a short burst of real simulation with a scripted autopilot.
 */
function stagePlay(world) {
  startRun(world);
  const p = world.player;
  // The run has earned a few blessings by wave 6.
  const earned = ['wide-light', 'heavy-sparks', 'rapid-sparks', 'fierce-burn', 'stout-heart'];
  applyNamedUpgrades(world, earned);
  p.hp = 78;
  // Wave 6, eleven of twenty-six slain.
  world.wave = 6;
  world.waveTotal = 26;
  world.waveKills = 11;
  world.waveMix = { wisp: 10, crawler: 8, spitter: 4, splitter: 3, brute: 1 };
  world.spawnQueue = [];
  world.enemies = [];
  world.score = 8450;
  world.kills = 63;
  world.embersCollected = 41;
  world.combo = 17;
  world.comboTimer = 2.4;
  world.bestCombo = 21;
  world.best = 12400;
  world.time = 214;
  world.banner = null;
  p.x = ARENA.x + ARENA.width * 0.42;
  p.y = ARENA.y + ARENA.height * 0.52;
  // A fixed cast spread across the arena: some burning inside the glow,
  // some dim silhouettes with glowing eyes beyond it.
  const cast = [
    ['wisp', -140, -70], ['wisp', 170, 100], ['wisp', -320, 180], ['wisp', 380, -200],
    ['wisp', -480, -120], ['wisp', 480, 220],
    ['crawler', 110, -170], ['crawler', -210, -160], ['crawler', 300, 190], ['crawler', -400, -80],
    ['crawler', 520, -40],
    ['spitter', 420, 80], ['spitter', -460, 240],
    ['splitter', 240, -280], ['splitter', -180, 240],
    ['brute', 480, -180],
  ];
  for (const [type, dx, dy] of cast) {
    const e = spawnEnemy(world, type, p.x + dx, p.y + dy);
    if (type === 'brute') e.hp = Math.round(e.maxHp * 0.62);
    if (type === 'splitter') e.hp = Math.round(e.maxHp * 0.8);
  }
  // Embers on the floor, a heart, and numbers already in the air.
  for (let i = 0; i < 9; i++) {
    const a = world.rng.angle();
    const r = world.rng.range(60, 260);
    world.embers.push({ x: p.x + Math.cos(a) * r, y: p.y + Math.sin(a) * r, vx: 0, vy: 0, value: p.emberValue, t: 0 });
  }
  world.hearts.push({ x: p.x + 200, y: p.y + 120, vx: 0, vy: 0, t: 0 });
  addText(world, p.x + 150, p.y - 120, '24', '#fff3c4', 15);
  addText(world, p.x - 120, p.y - 90, '18', '#ff7a29', 14);
  addText(world, p.x + 60, p.y + 140, '+150', '#ffd94a', 15);
  burst(world, p.x + 260, p.y + 160, '#ffb347', 10, 160, 0.6, 3);
  // Let the real rules run for a short burst: sparks fly, burn ticks land.
  const auto = new ScriptedInput();
  auto.mouseX = p.x + 220;
  auto.mouseY = p.y - 140;
  for (let i = 0; i < 55; i++) {
    const a = (i / 55) * Math.PI * 1.2;
    auto.axis = { x: Math.cos(a) * 0.6, y: Math.sin(a) * 0.6 };
    updateWorld(world, auto, null, 1 / 60);
    if (world.state !== 'playing') break;
  }
  world.state = 'playing';
  // Frame the shot: a live combo, a healthy flame, fresh numbers in the air.
  world.combo = 17;
  world.comboTimer = 2.4;
  world.bestCombo = 21;
  p.hp = 86;
  addText(world, p.x + 120, p.y - 110, '24', '#fff3c4', 15);
  addText(world, p.x - 90, p.y - 80, '18', '#ff7a29', 14);
  addText(world, p.x + 40, p.y + 120, '+150', '#ffd94a', 15);
  for (let i = 0; i < 5; i++) {
    const a = world.rng.angle();
    const r = world.rng.range(80, 240);
    world.embers.push({ x: p.x + Math.cos(a) * r, y: p.y + Math.sin(a) * r, vx: 0, vy: 0, value: p.emberValue, t: 0 });
  }
  world.animTime = 3.7;
}

/** Apply upgrade definitions by id, without opening the next wave. */
function applyNamedUpgrades(world, ids) {
  for (const id of ids) {
    const def = UPGRADES.find((u) => u.id === id);
    if (def) def.apply(world.player);
  }
}

/** The between-wave choice after wave 5, three blessings on the table. */
function stageUpgrade(world) {
  startRun(world);
  const p = world.player;
  applyNamedUpgrades(world, ['wide-light', 'heavy-sparks', 'stout-heart']);
  p.hp = 96;
  world.wave = 5;
  world.waveTotal = 26;
  world.waveKills = 26;
  world.waveMix = {};
  world.spawnQueue = [];
  world.enemies = [];
  world.embers = [];
  world.score = 6230;
  world.kills = 58;
  world.embersCollected = 36;
  world.best = 12400;
  world.time = 168;
  world.banner = null;
  world.state = 'upgrade';
  rollUpgrades(world);
  world.animTime = 1.8;
}

/** The victory screen after the Gloommaw falls. */
function stageVictory(world) {
  startRun(world);
  const p = world.player;
  applyNamedUpgrades(world, ['wide-light', 'fierce-burn', 'heavy-sparks', 'rapid-sparks', 'stout-heart', 'grand-nova']);
  p.hp = 41;
  world.wave = 10;
  world.waveTotal = 1;
  world.waveKills = 1;
  world.spawnQueue = [];
  world.enemies = [];
  world.score = 24830;
  world.kills = 187;
  world.embersCollected = 312;
  world.combo = 0;
  world.bestCombo = 24;
  world.time = 482;
  world.best = 24830;
  world.banner = null;
  world.state = 'victory';
  world.animTime = 2.2;
}
