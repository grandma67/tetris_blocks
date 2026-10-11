// Small seedable PRNG (mulberry32). Its whole state is one integer, so a
// level's random sequence can be saved and resumed exactly.
export class SeededRng {
  constructor(seed) {
    this.state = seed >>> 0;
  }

  next() {
    let t = (this.state = (this.state + 0x6d2b79f5) >>> 0);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
}

/** Stable seed for (level, purpose) — the same for every player. */
export function levelSeed(level, salt = 0) {
  let h = (Math.imul(level, 2654435761) ^ Math.imul(salt + 1, 40503)) >>> 0;
  h = Math.imul(h ^ (h >>> 16), 2246822507) >>> 0;
  return (h ^ (h >>> 13)) >>> 0;
}
