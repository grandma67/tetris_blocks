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
  { id: 'Q3', weight: 2, tier: 2, shapes: [['###', '###', '###']] },
  { id: 'R6', weight: 2, tier: 2, shapes: [['###', '###'], ['##', '##', '##']] },
  { id: 'V5', weight: 2, tier: 2, shapes: [['###', '#..', '#..'], ['###', '..#', '..#'], ['#..', '#..', '###'], ['..#', '..#', '###']] },
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

export function makePiece(key, id = nextId++) {
  const shape = shapeByKey(key);
  if (!shape) throw new Error(`Unknown shape ${key}`);
  return { id, key, shape };
}
