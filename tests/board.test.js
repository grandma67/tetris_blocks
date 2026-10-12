import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createGrid, canPlace, place, findFullLines, clearLines, fitsAnywhere, canPlaceAll, previewLines, isEmpty } from '../js/board.js';
import { shapeByKey } from '../js/pieces.js';

const N = 8;
const fillRow = (g, r, skip = -1) => { for (let c = 0; c < N; c++) if (c !== skip) g[r * N + c] = 0; return g; };

test('canPlace respects bounds and occupancy', () => {
  const g = createGrid(N);
  const I4 = shapeByKey('I4:0');
  assert.equal(canPlace(g, N, I4, 0, 4), true);
  assert.equal(canPlace(g, N, I4, 0, 5), false);
  assert.equal(canPlace(g, N, I4, -1, 0), false);
  const g2 = place(g, N, I4, 0, 0, 1);
  assert.equal(canPlace(g2, N, I4, 0, 0), false);
  assert.equal(canPlace(g2, N, I4, 1, 0), true);
  assert.ok(isEmpty(g), 'place must not mutate');
});

test('findFullLines detects rows and columns', () => {
  const g = fillRow(createGrid(N), 3);
  for (let r = 0; r < N; r++) g[r * N + 5] = 2;
  assert.deepEqual(findFullLines(g, N), { rows: [3], cols: [5] });
});

test('clearLines empties the union of lines once', () => {
  const g = fillRow(createGrid(N), 0);
  for (let r = 0; r < N; r++) g[r * N] = 1;
  const { grid, cleared } = clearLines(g, N, findFullLines(g, N));
  assert.equal(cleared.length, N + N - 1);
  assert.ok(isEmpty(grid));
});

test('previewLines predicts a completing placement', () => {
  const g = fillRow(createGrid(N), 7, 3);
  const mono = shapeByKey('M1:0');
  assert.deepEqual(previewLines(g, N, mono, 7, 3), { rows: [7], cols: [] });
  assert.deepEqual(previewLines(g, N, mono, 6, 3), { rows: [], cols: [] });
});

test('fitsAnywhere is false on a checkerboard for a domino', () => {
  const g = createGrid(N).map((_, i) => ((Math.floor(i / N) + (i % N)) % 2 ? 0 : null));
  assert.equal(fitsAnywhere(g, N, shapeByKey('D2:0')), false);
  assert.equal(fitsAnywhere(g, N, shapeByKey('M1:0')), true);
});

test('canPlaceAll needs room for every piece, counting line clears', () => {
  const q3 = shapeByKey('Q3:0');
  // Only a 5×3 pocket is open (plus stray holes so no line can complete): one 3×3 fits, two never do.
  const g = createGrid(N).fill(0);
  for (let r = 0; r < 5; r++) for (let c = 0; c < 3; c++) g[r * N + c] = null;
  for (const i of [7, 15, 23, 31, 39, 5 * N + 3, 6 * N + 4, 7 * N + 5, 5 * N + 6]) g[i] = null;
  assert.ok(fitsAnywhere(g, N, q3));
  assert.equal(canPlaceAll(g, N, [q3]), true);
  assert.equal(canPlaceAll(g, N, [q3, q3]), false);
  // A row one block short: the monomino clears it, then the 1×8 bar fits there.
  const h = fillRow(createGrid(N), 0, 0);
  for (let r = 1; r < N; r++) fillRow(h, r);
  const bar = { key: 'bar', cells: [...Array(N)].map((_, c) => [0, c]), h: 1, w: N };
  assert.equal(canPlaceAll(h, N, [bar, shapeByKey('M1:0')]), true);
  assert.equal(canPlaceAll(h, N, [bar]), false);
});
