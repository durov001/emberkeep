// EMBERKEEP — tuning: every number the game plays by lives in this one file.
// The world, the renderer and the upgrade screen all read from here, so a
// balance change never means hunting through the simulation code.

/** Logical canvas size. The page scales the canvas to fit the window. */
export const VIEW = { width: 1280, height: 720 };

/** The arena the player and enemies move inside (HUD bars sit above and below). */
export const ARENA = { x: 36, y: 92, width: 1208, height: 552 };

/** The palette: deep indigo night, warm amber flame, ember orange accents. */
export const PALETTE = {
  night: '#070818',
  nightDeep: '#04050f',
  arenaFloor: '#0d0f26',
  arenaLine: '#23265a',
  amber: '#ffb347',
  ember: '#ff7a29',
  flameCore: '#fff3c4',
  gold: '#ffd94a',
  violet: '#8b7bff',
  blood: '#ff4d5e',
  bone: '#e8e6f0',
  dim: '#9a97b8',
};

/** The Last Ember's starting stats. Upgrades modify a copy of these. */
export const PLAYER_BASE = {
  radius: 16,
  speed: 262,
  maxHp: 100,
  lightRadius: 178,
  burnDps: 14,
  sparkDamage: 12,
  sparkRate: 2.3,
  sparkSpeed: 580,
  sparkRange: 470,
  dashCharges: 2,
  dashRecharge: 3.1,
  dashSpeed: 920,
  dashTime: 0.16,
  novaRadius: 265,
  novaDamage: 48,
  novaCooldown: 9,
  magnet: 115,
  emberValue: 10,
  regen: 0,
  armor: 0,
};

/** Enemy kinds. hp and speed grow a little with each wave (see waveScaling). */
export const ENEMY_TYPES = {
  wisp: {
    name: 'Wisp', hp: 30, speed: 72, radius: 15, contact: 10,
    score: 50, embers: 2, body: '#1c1440', rim: '#7b6cf0', eye: '#b7a8ff',
  },
  crawler: {
    name: 'Crawler', hp: 16, speed: 178, radius: 11, contact: 8,
    score: 40, embers: 1, body: '#241033', rim: '#c65df0', eye: '#ff9df5',
  },
  spitter: {
    name: 'Spitter', hp: 42, speed: 56, radius: 17, contact: 8,
    score: 90, embers: 3, body: '#101c33', rim: '#4dc9e8', eye: '#aef3ff',
    shoots: true, shotInterval: 2.4, shotSpeed: 215, shotDamage: 12, holdRange: 330,
  },
  brute: {
    name: 'Brute', hp: 230, speed: 40, radius: 30, contact: 22,
    score: 200, embers: 6, body: '#2b0f1e', rim: '#ff4d5e', eye: '#ffb3ba',
  },
  splitter: {
    name: 'Splitter', hp: 58, speed: 88, radius: 19, contact: 10,
    score: 120, embers: 3, body: '#14261f', rim: '#57e389', eye: '#c8ffd9',
    splitsInto: 'wisp', splitCount: 2,
  },
};

/** The Gloommaw, boss of wave 10. Its phases are driven by its health. */
export const BOSS = {
  name: 'Gloommaw', hp: 2600, speed: 46, radius: 58, contact: 30,
  score: 5000, embers: 40, body: '#1a0a24', rim: '#ff4d5e', eye: '#ffd94a',
  summonInterval: 7, chargeWindup: 0.9, chargeTime: 0.65, chargeSpeed: 640,
  chargeRecover: 0.9, phase2At: 0.66, phase3At: 0.33,
};

/** How enemy health and speed scale with the wave number (wave is 1-based). */
export function waveScaling(wave) {
  return {
    hpMul: 1 + (wave - 1) * 0.09,
    speedMul: Math.min(1.35, 1 + (wave - 1) * 0.02),
  };
}

/** The ten waves: name, composition, and how fast the dark pours in. */
export const WAVES = [
  { name: 'First Shadows', spawnInterval: 1.15, mix: { wisp: 6 } },
  { name: 'They Multiply', spawnInterval: 1.05, mix: { wisp: 8, crawler: 3 } },
  { name: 'Spitting Dark', spawnInterval: 0.95, mix: { wisp: 6, crawler: 6, spitter: 2 } },
  { name: 'The Swarm Thickens', spawnInterval: 0.85, mix: { wisp: 10, crawler: 6, spitter: 3 } },
  { name: 'Splitting Horrors', spawnInterval: 0.8, mix: { wisp: 6, crawler: 8, spitter: 4, splitter: 2 } },
  { name: 'Brute Force', spawnInterval: 0.7, mix: { wisp: 10, crawler: 8, spitter: 4, splitter: 3, brute: 1 } },
  { name: 'No Mercy', spawnInterval: 0.62, mix: { crawler: 12, spitter: 5, splitter: 4, brute: 2 } },
  { name: 'The Long Night', spawnInterval: 0.55, mix: { wisp: 14, crawler: 10, spitter: 6, splitter: 4, brute: 2 } },
  { name: 'Last Stand', spawnInterval: 0.48, mix: { crawler: 16, spitter: 8, splitter: 6, brute: 3 } },
  { name: 'GLOOMMAW', spawnInterval: 10, mix: {}, boss: true },
];

/** Total enemies in a wave's mix (boss waves count the boss as one). */
export function waveEnemyCount(wave) {
  const def = WAVES[wave - 1];
  if (!def) return 0;
  let n = def.boss ? 1 : 0;
  for (const k of Object.keys(def.mix)) n += def.mix[k];
  return n;
}

/** The upgrade pool: blessings of the flame, offered 1-of-3 between waves. */
export const UPGRADES = [
  { id: 'wide-light', icon: '◉', name: 'Wide Light', desc: 'Light radius +30. The dark shrinks back.', apply: (p) => { p.lightRadius += 30; } },
  { id: 'fierce-burn', icon: '♨', name: 'Fierce Burn', desc: 'Burn damage +9 per second inside your light.', apply: (p) => { p.burnDps += 9; } },
  { id: 'swift-flame', icon: '»', name: 'Swift Flame', desc: 'Move speed +12%. Outrun what hunts you.', apply: (p) => { p.speed *= 1.12; } },
  { id: 'stout-heart', icon: '♥', name: 'Stout Heart', desc: 'Max health +25 and heal 25 now.', apply: (p) => { p.maxHp += 25; p.hp = Math.min(p.maxHp, p.hp + 25); } },
  { id: 'extra-dash', icon: '↯', name: 'Extra Dash', desc: '+1 dash charge. Dodge twice as often.', apply: (p) => { p.dashCharges += 1; p.dashReady = Math.min(p.dashCharges, p.dashReady + 1); } },
  { id: 'quick-dash', icon: '↻', name: 'Quick Dash', desc: 'Dash recharges 22% faster.', apply: (p) => { p.dashRecharge *= 0.78; } },
  { id: 'grand-nova', icon: '✹', name: 'Grand Nova', desc: 'Nova damage +45 and radius +35.', apply: (p) => { p.novaDamage += 45; p.novaRadius += 35; } },
  { id: 'ready-nova', icon: '◐', name: 'Ready Nova', desc: 'Nova cooldown 25% shorter.', apply: (p) => { p.novaCooldown *= 0.75; } },
  { id: 'rapid-sparks', icon: '⁂', name: 'Rapid Sparks', desc: 'Spark fire rate +22%.', apply: (p) => { p.sparkRate *= 1.22; } },
  { id: 'heavy-sparks', icon: '◆', name: 'Heavy Sparks', desc: 'Spark damage +6.', apply: (p) => { p.sparkDamage += 6; } },
  { id: 'wide-magnet', icon: '◎', name: 'Wide Magnet', desc: 'Ember pickup radius +65.', apply: (p) => { p.magnet += 65; } },
  { id: 'slow-regen', icon: '✚', name: 'Slow Regen', desc: 'Regenerate +0.9 health every second.', apply: (p) => { p.regen += 0.9; } },
  { id: 'ember-hoard', icon: '●', name: 'Ember Hoard', desc: 'Every ember is worth 50% more score.', apply: (p) => { p.emberValue *= 1.5; } },
  { id: 'thick-skin', icon: '⬢', name: 'Thick Skin', desc: 'Take 15% less damage from every hit.', apply: (p) => { p.armor = Math.min(0.6, p.armor + 0.15); } },
];

/** Combo: kills without taking damage build a score multiplier (cap x5). */
export const COMBO = { window: 3.0, perStep: 8, maxMult: 5 };

/** How often a kill drops a healing heart, and how much it heals. */
export const HEART = { dropChance: 0.08, heal: 15 };

/** Local storage key for the best score. */
export const BEST_KEY = 'emberkeep-best';
