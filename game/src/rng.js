// Seeded RNG (mulberry32) — every run of the game with the same seed plays
// the same spawn order, so the screenshot modes are deterministic.

export function makeRng(seed) {
  let a = seed >>> 0;
  return {
    next() {
      a |= 0;
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    },
  };
}

export function rand(rng, lo, hi) {
  return lo + rng.next() * (hi - lo);
}

export function randInt(rng, lo, hi) {
  return Math.floor(rand(rng, lo, hi + 1));
}

export function pick(rng, arr) {
  return arr[Math.floor(rng.next() * arr.length)];
}

export function chance(rng, p) {
  return rng.next() < p;
}

// Fisher-Yates shuffle, in place, using the seeded rng.
export function shuffle(rng, arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng.next() * (i + 1));
    const t = arr[i];
    arr[i] = arr[j];
    arr[j] = t;
  }
  return arr;
}
