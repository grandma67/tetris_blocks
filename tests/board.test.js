import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createGrid, canPlace, place, findFullLines, clearLines, fitsAnywhere, previewLines, isEmpty } from '../js/board.js';
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
