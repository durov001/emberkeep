// KINDLE + the LIGHT meter: the game's central trade.
// Light is both your weapon and your currency for ground. Lighting a brazier
// costs LIGHT (your glow shrinks, your sparks weaken), but a lit brazier
// burns every shadow inside its radius for the rest of the night.

import { tv } from './tuning.js';
import { ARENA } from './realms.js';
import { rand } from './rng.js';

export function lightRadius(light, stats) {
  return tv('glowBase') + tv('glowPerLight') * light + (stats.lightRadius - tv('baseLightRadius'));
}

export function sparkDamageMul(light) {
  return 0.5 + 0.005 * light;
}

export function kindleCost(stats) {
  return Math.max(5, tv('kindleCost') - stats.kindleDiscount);
}

export function makeBrazier(x, y) {
  return { x, y, lit: false, burn: 0, flame: Math.random() * Math.PI * 2 };
}

// Scatter braziers across the arena, away from the walls and from each other.
export function makeBraziers(rng, count) {
  const out = [];
  let guard = 0;
  while (out.length < count && guard++ < 200) {
    const x = rand(rng, 140, ARENA.w - 140);
    const y = rand(rng, 120, ARENA.h - 120);
    if (Math.hypot(x - ARENA.w / 2, y - ARENA.h / 2) < 150) continue;
    if (out.some((b) => Math.hypot(b.x - x, b.y - y) < 220)) continue;
    out.push(makeBrazier(x, y));
  }
  return out;
}

export function nearestUnlitBrazier(braziers, x, y, range) {
  let best = null;
  let bestD = range;
  for (const b of braziers) {
    if (b.lit) continue;
    const d = Math.hypot(b.x - x, b.y - y);
    if (d < bestD) {
      bestD = d;
      best = b;
    }
  }
  return best;
}

// Burn every shadow standing inside a lit brazier's radius. Returns the
// number of enemies that took burn damage this tick.
export function burnShadows(braziers, enemies, dt) {
  const radius = tv('brazierBurnRadius');
  const dps = tv('brazierBurnDps');
  let burned = 0;
  for (const b of braziers) {
    if (!b.lit) continue;
    for (const e of enemies) {
      if (e.dead) continue;
      if (Math.hypot(e.x - b.x, e.y - b.y) < radius + e.r) {
        e.hp -= dps * dt;
        e.burning = 0.4;
        burned++;
      }
    }
  }
  return burned;
}
