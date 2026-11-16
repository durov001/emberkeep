// EMBERKEEP — seeded random numbers. The whole game draws its luck from one
// small generator, so a screenshot staged with a fixed seed stages the same
// world every time, and a run can be replayed exactly.

/** mulberry32: a tiny fast seeded PRNG with a good spread for game use. */
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Turns any string into a 32-bit seed (FNV-1a hash). */
export function hashSeed(text) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** A random source with the helpers the game needs. */
export class Rng {
  constructor(seed) {
    this.next = mulberry32(typeof seed === 'string' ? hashSeed(seed) : seed);
  }

  /** A float in [0, 1). */
  float() {
    return this.next();
  }

  /** A float in [min, max). */
  range(min, max) {
    return min + this.next() * (max - min);
  }

  /** An integer in [min, max] inclusive. */
  int(min, max) {
    return min + Math.floor(this.next() * (max - min + 1));
  }

  /** True with probability p (0..1). */
  chance(p) {
    return this.next() < p;
  }

  /** One element of an array, uniformly. */
  pick(list) {
    return list[Math.floor(this.next() * list.length)];
  }

  /** A new array with the elements shuffled (Fisher-Yates). */
  shuffle(list) {
    const out = list.slice();
    for (let i = out.length - 1; i > 0; i--) {
      const j = Math.floor(this.next() * (i + 1));
      const tmp = out[i];
      out[i] = out[j];
      out[j] = tmp;
    }
    return out;
  }

  /** An angle in radians, uniform over the full circle. */
  angle() {
    return this.next() * Math.PI * 2;
  }
}
