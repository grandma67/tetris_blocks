import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SHAPES, rotateShape, randomPiece } from '../js/pieces.js';
import { CONFIG } from '../js/config.js';

test('every shape is well-formed and fits the tray and the smallest board', () => {
  const minBoard = Math.min(...CONFIG.boardSizes);
  for (const s of SHAPES) {
    assert.ok(s.cells.length > 0, `${s.key} has no cells`);
    assert.ok(s.cells.every(([r, c]) => r >= 0 && c >= 0 && r < s.h && c < s.w), `${s.key} has a cell outside its box`);
    assert.equal(new Set(s.cells.map(String)).size, s.cells.length, `${s.key} repeats a cell`);
    assert.ok(s.w <= 5 && s.h <= 5 && s.w <= minBoard, `${s.key} is too big`);
    assert.ok(s.cells.some(([r]) => r === 0) && s.cells.some(([, c]) => c === 0), `${s.key} has an empty edge`);
  }
});

test('every family lists all of its rotations', () => {
  for (const s of SHAPES) {
    const turned = rotateShape(s.key);
    if (!turned) continue;
    assert.equal(shapeFamily(turned.key), s.family);
    assert.ok(turned.indexMap.every((i) => i >= 0), `${s.key} rotation loses cells`);
  }
  // A shape whose rotation is missing from its family would return null from
  // rotateShape; check that only rotation-symmetric shapes do.
  for (const s of SHAPES.filter((x) => !rotateShape(x.key))) {
    const cells = s.cells.map(([r, c]) => `${c},${s.h - 1 - r}`).sort().join(' ');
    assert.equal(cells, s.cells.map(([r, c]) => `${r},${c}`).sort().join(' '), `${s.key} is missing a rotation`);
  }
});

test('the generator can deal every family', () => {
  const seen = new Set();
  let x = 1;
  const rng = () => ((x = (x * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 20000; i++) seen.add(randomPiece(rng, 2000).shape.family);
  assert.equal(seen.size, new Set(SHAPES.map((s) => s.family)).size);
});

const shapeFamily = (key) => key.split(':')[0];
