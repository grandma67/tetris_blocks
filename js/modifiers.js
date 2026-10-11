// Level twists (stones, gravity, rising floor) as pure grid functions, plus
// the seeded choice of which twists a level gets.
import { CONFIG } from './config.js';
import { SeededRng, levelSeed } from './rng.js';

export const MODIFIERS = {
  stones: { icon: '🪨', name: 'Stones', short: 'Stone', desc: 'A stone drops in every few rounds' },
  gravity: { icon: '⬇', name: 'Gravity', short: 'Gravity', desc: 'Blocks fall after every clear' },
  rising: { icon: '⬆', name: 'Rising floor', short: 'Rise', desc: 'A junk row pushes up every few rounds' },
};

/** Which twists level `n` has. Deterministic: depends only on the level number. */
export function levelModifiers(n) {
  const cfg = CONFIG.levels.modifiers;
  if (n < cfg.from) return [];
  const rng = new SeededRng(levelSeed(n, 1));
  if (rng.next() < cfg.originalChance) return [];
  const pool = Object.keys(MODIFIERS);
  const first = pool.splice(Math.floor(rng.next() * pool.length), 1)[0];
  if (n >= cfg.doubleFrom && rng.next() < cfg.doubleChance) {
    return [first, pool[Math.floor(rng.next() * pool.length)]];
  }
  return [first];
}

/**
 * Blocks fall straight down within each column. Returns the new grid and bomb
 * set plus, for each moved block, its new index and how many rows it fell.
 */
export function applyGravity(grid, size, bombs) {
  const next = new Array(grid.length).fill(null);
  const nextBombs = new Set();
  const fallen = [];
  for (let c = 0; c < size; c++) {
    let target = size - 1;
    for (let r = size - 1; r >= 0; r--) {
      const from = r * size + c;
      if (grid[from] === null) continue;
      const to = target * size + c;
      next[to] = grid[from];
      if (bombs.has(from)) nextBombs.add(to);
      if (target !== r) fallen.push([to, target - r]);
      target--;
    }
  }
  return { grid: next, bombs: nextBombs, fallen };
}

/**
 * Everything moves up one row and a junk row with a single gap appears at the
 * bottom. `overflow` is true when blocks were pushed off the top.
 */
export function riseFloor(grid, size, bombs, junk, rand) {
  let overflow = false;
  for (let c = 0; c < size; c++) if (grid[c] !== null) overflow = true;
  const next = grid.slice(size).concat(new Array(size).fill(junk));
  const gap = Math.floor(rand() * size);
  next[(size - 1) * size + gap] = null;
  const nextBombs = new Set([...bombs].filter((i) => i >= size).map((i) => i - size));
  return { grid: next, bombs: nextBombs, overflow, gap };
}

/** Index of a random empty cell (that doesn't complete a line), or null. */
export function pickStoneCell(grid, size, rand) {
  const empty = [];
  grid.forEach((v, i) => v === null && empty.push(i));
  for (let tries = 0; tries < 30 && empty.length; tries++) {
    const i = empty[Math.floor(rand() * empty.length)];
    const r = Math.floor(i / size);
    const c = i % size;
    let rowFull = true;
    let colFull = true;
    for (let j = 0; j < size; j++) {
      if (j !== c && grid[r * size + j] === null) rowFull = false;
      if (j !== r && grid[j * size + c] === null) colFull = false;
    }
    if (!rowFull && !colFull) return i;
  }
  return null;
}
