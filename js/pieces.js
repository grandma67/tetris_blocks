// Piece catalogue. Shapes are drawn as ASCII so they're easy to read and add.
// Each family lists every orientation it can be dealt in (pieces never rotate
// once dealt). `weight` is relative spawn frequency; `tier` is used to make
// bigger pieces a bit more common as the score grows.

const FAMILIES = [
  // --- Classic tetrominoes ---
  { id: 'I4', weight: 6, tier: 1, shapes: [['####'], ['#', '#', '#', '#']] },
  { id: 'O',  weight: 6, tier: 1, shapes: [['##', '##']] },
  { id: 'T',  weight: 6, tier: 1, shapes: [['###', '.#.'], ['.#', '##', '.#'], ['.#.', '###'], ['#.', '##', '#.']] },
  { id: 'S',  weight: 5, tier: 1, shapes: [['.##', '##.'], ['#.', '##', '.#']] },
  { id: 'Z',  weight: 5, tier: 1, shapes: [['##.', '.##'], ['.#', '##', '#.']] },
  { id: 'J',  weight: 6, tier: 1, shapes: [['#..', '###'], ['##', '#.', '#.'], ['###', '..#'], ['.#', '.#', '##']] },
  { id: 'L',  weight: 6, tier: 1, shapes: [['..#', '###'], ['#.', '#.', '##'], ['###', '#..'], ['##', '.#', '.#']] },

  // --- Small fillers keep the board breathable ---
  { id: 'M1', weight: 2, tier: 0, shapes: [['#']] },
  { id: 'D2', weight: 3, tier: 0, shapes: [['##'], ['#', '#']] },
  { id: 'I3', weight: 4, tier: 0, shapes: [['###'], ['#', '#', '#']] },
  { id: 'V3', weight: 4, tier: 0, shapes: [['##', '#.'], ['##', '.#'], ['.#', '##'], ['#.', '##']] },

  // --- Big pieces: the real threat ---
  { id: 'I5', weight: 2, tier: 2, shapes: [['#####'], ['#', '#', '#', '#', '#']] },
  { id: 'Q3', weight: 0.8, tier: 2, shapes: [['###', '###', '###']] },
  { id: 'R6', weight: 2, tier: 2, shapes: [['###', '###'], ['##', '##', '##']] },
  { id: 'V5', weight: 2, tier: 2, shapes: [['###', '#..', '#..'], ['###', '..#', '..#'], ['#..', '#..', '###'], ['..#', '..#', '###']] },

  // --- Diagonals: blocks that only touch at the corners ---
  { id: 'X2', weight: 2,   tier: 0, shapes: [['#.', '.#'], ['.#', '#.']] },
  { id: 'X3', weight: 1.5, tier: 1, shapes: [['#..', '.#.', '..#'], ['..#', '.#.', '#..']] },

  // --- Pentominoes ---
  { id: 'P5', weight: 1.5, tier: 1, shapes: [['##', '##', '#.'], ['###', '.##'], ['.#', '##', '##'], ['##.', '###']] },
  { id: 'U5', weight: 1.5, tier: 1, shapes: [['#.#', '###'], ['##', '#.', '##'], ['###', '#.#'], ['##', '.#', '##']] },
  { id: 'L5', weight: 1.2, tier: 1, shapes: [['#...', '####'], ['##', '#.', '#.', '#.'], ['####', '...#'], ['.#', '.#', '.#', '##']] },
  { id: 'J5', weight: 1.2, tier: 1, shapes: [['...#', '####'], ['#.', '#.', '#.', '##'], ['####', '#...'], ['##', '.#', '.#', '.#']] },
  { id: 'PL', weight: 1.2, tier: 2, shapes: [['.#.', '###', '.#.']] },
  { id: 'T5', weight: 1.2, tier: 2, shapes: [['###', '.#.', '.#.'], ['..#', '###', '..#'], ['.#.', '.#.', '###'], ['#..', '###', '#..']] },
  { id: 'W5', weight: 1.2, tier: 2, shapes: [['#..', '##.', '.##'], ['.##', '##.', '#..'], ['##.', '.##', '..#'], ['..#', '.##', '##.']] },

  // --- Oddballs: rare, awkward, satisfying when they land ---
  { id: 'X5',   weight: 0.8, tier: 2, shapes: [['#.#', '.#.', '#.#']] },
  { id: 'RING', weight: 0.8, tier: 2, shapes: [['###', '#.#', '###']] },
  { id: 'H7',   weight: 0.8, tier: 2, shapes: [['#.#', '###', '#.#'], ['###', '.#.', '###']] },
];

function parse(rows) {
  const cells = [];
  rows.forEach((row, r) => [...row].forEach((ch, c) => { if (ch === '#') cells.push([r, c]); }));
  return { cells, h: rows.length, w: Math.max(...rows.map((r) => r.length)) };
}

export const SHAPES = FAMILIES.flatMap((fam, familyIndex) =>
  fam.shapes.map((rows, rot) => ({ key: `${fam.id}:${rot}`, family: fam.id, familyIndex, ...parse(rows) })),
);

const BY_KEY = new Map(SHAPES.map((s) => [s.key, s]));
export const shapeByKey = (key) => BY_KEY.get(key);

// Bigger pieces become more likely as the score climbs (caps at ~2x).
function familyWeight(fam, score) {
  const ramp = Math.min(1, score / 4000);
  if (fam.tier === 2) return fam.weight * (1 + ramp);
  if (fam.tier === 0) return fam.weight * (1 - 0.4 * ramp);
  return fam.weight;
}

let nextId = 1;

export function randomPiece(rng = Math.random, score = 0) {
  const weights = FAMILIES.map((f) => familyWeight(f, score));
  let roll = rng() * weights.reduce((a, b) => a + b, 0);
  let fi = 0;
  while (roll >= weights[fi] && fi < FAMILIES.length - 1) roll -= weights[fi++];
  const fam = FAMILIES[fi];
  const rot = Math.floor(rng() * fam.shapes.length);
  return makePiece(`${fam.id}:${rot}`);
}

/** `bomb` is the index into shape.cells that carries a bomb, or null. */
export function makePiece(key, id = nextId++, bomb = null) {
  const shape = shapeByKey(key);
  if (!shape) throw new Error(`Unknown shape ${key}`);
  return { id, key, shape, bomb };
}

// ---------------------------------------------------------------- Rotation

const cellKey = (cells) => cells.map(([r, c]) => `${r},${c}`).sort().join(' ');

/**
 * Rotates a shape 90° clockwise. Returns the matching orientation's key and,
 * for each original cell, its index in the rotated shape (so a bomb follows).
 * Returns null for shapes that look the same rotated (O, monomino, 3×3).
 */
export function rotateShape(key) {
  const shape = shapeByKey(key);
  const turned = shape.cells.map(([r, c]) => [c, shape.h - 1 - r]);
  const want = cellKey(turned);
  const target = SHAPES.find((s) => s.family === shape.family && cellKey(s.cells) === want);
  if (!target || target.key === key) return null;
  const indexMap = turned.map(([r, c]) => target.cells.findIndex(([tr, tc]) => tr === r && tc === c));
  return { key: target.key, indexMap };
}

/** Keys reachable from `key` with at most `turns` clockwise rotations. */
export function orientations(key, turns) {
  const keys = [key];
  let k = key;
  for (let i = 0; i < Math.min(turns, 3); i++) {
    const next = rotateShape(k);
    if (!next || keys.includes(next.key)) break;
    keys.push(next.key);
    k = next.key;
  }
  return keys;
}
