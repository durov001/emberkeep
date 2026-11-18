// The 12 relics. Each relic is a small object with a draw key (its glyph is
// drawn in code in render.js), a description, and an apply() that mutates the
// player's derived stats. Two concrete synergies are detected by
// synergiesOf(): Ember Glass + Bright Oath and Quick Hands + Shatter Spark.

export const RELICS = [
  {
    id: 'widewick', name: 'Wide Wick', desc: '+30 light radius',
    apply(s) { s.lightRadius += 30; },
  },
  {
    id: 'spareflare', name: 'Spare Flare', desc: '+1 nova charge',
    apply(s) { s.novaCharges += 1; },
  },
  {
    id: 'quickhands', name: 'Quick Hands', desc: '+25% spark rate',
    apply(s) { s.sparkRate *= 1.25; },
  },
  {
    id: 'copperlantern', name: 'Copper Lantern', desc: 'Ember flies to you',
    apply(s) { s.magnet = true; },
  },
  {
    id: 'emberglass', name: 'Ember Glass', desc: 'Nova leaves burning ground (4s)',
    apply(s) { s.burningGround = true; },
  },
  {
    id: 'kindledheart', name: 'Kindled Heart', desc: '+25 max HP',
    apply(s) { s.maxHp += 25; },
  },
  {
    id: 'brightoath', name: 'Bright Oath', desc: 'KINDLE costs 10 less LIGHT',
    apply(s) { s.kindleDiscount += 10; },
  },
  {
    id: 'thornwick', name: 'Thorn Wick', desc: 'Touching you burns attackers',
    apply(s) { s.thorns += 12; },
  },
  {
    id: 'swiftember', name: 'Swift Ember', desc: '+15% move speed',
    apply(s) { s.speed *= 1.15; },
  },
  {
    id: 'deepwell', name: 'Deep Well', desc: '+25 max LIGHT',
    apply(s) { s.lightMax += 25; },
  },
  {
    id: 'shatterspark', name: 'Shatter Spark', desc: 'Sparks pierce +1 enemy',
    apply(s) { s.pierce += 1; },
  },
  {
    id: 'gloombane', name: 'Gloom Bane', desc: '+25% damage to bosses',
    apply(s) { s.bossDamage += 0.25; },
  },
];

export function relicById(id) {
  return RELICS.find((r) => r.id === id);
}

// Synergies: pairs that unlock a named bonus when both are owned.
export const SYNERGIES = [
  {
    ids: ['emberglass', 'brightoath'],
    name: 'Eternal Flame',
    desc: 'Lit braziers stay lit for the whole run',
    flag: 'permaBraziers',
  },
  {
    ids: ['quickhands', 'shatterspark'],
    name: 'Twin Sparks',
    desc: 'Every spark splits into two',
    flag: 'splitSparks',
  },
];

export function synergiesOf(ownedIds) {
  const set = new Set(ownedIds);
  const active = [];
  const flags = { permaBraziers: false, splitSparks: false };
  for (const syn of SYNERGIES) {
    if (syn.ids.every((id) => set.has(id))) {
      active.push(syn);
      flags[syn.flag] = true;
    }
  }
  return { active, flags };
}

// Draft 3 relics the player does not own yet. When the pool runs dry, offer
// ember caches instead (a draft must never be empty).
export function draftRelics(rng, ownedIds) {
  const owned = new Set(ownedIds);
  const pool = RELICS.filter((r) => !owned.has(r.id));
  const out = [];
  const shuffled = pool.slice();
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(rng.next() * (i + 1));
    const t = shuffled[i];
    shuffled[i] = shuffled[j];
    shuffled[j] = t;
  }
  for (let i = 0; i < 3 && i < shuffled.length; i++) out.push(shuffled[i]);
  while (out.length < 3) {
    out.push({
      id: `embercache${out.length}`,
      name: 'Ember Cache',
      desc: '+40 ember, banked at once',
      apply() {},
      cache: true,
    });
  }
  return out;
}
