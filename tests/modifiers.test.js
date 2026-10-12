import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Game, STONE } from '../js/game.js';
import { makePiece } from '../js/pieces.js';
import { CONFIG } from '../js/config.js';
import { levelModifiers, applyGravity, stoneFloor, pickStoneCell } from '../js/modifiers.js';
import { SeededRng, levelSeed } from '../js/rng.js';

const N = 8;
const blank = () => new Array(N * N).fill(null);

test('seeded rng is deterministic and resumable from its state', () => {
  const a = new SeededRng(levelSeed(7));
  const b = new SeededRng(levelSeed(7));
  const seqA = Array.from({ length: 5 }, () => a.next());
  assert.deepEqual(seqA, Array.from({ length: 5 }, () => b.next()));
  const c = new SeededRng(0);
  c.state = a.state;
  assert.equal(c.next(), a.next());
  assert.notEqual(levelSeed(7), levelSeed(8));
});

test('level twists depend only on the level number', () => {
  assert.deepEqual(levelModifiers(1), [], 'level 1 is always normal');
  const kinds = new Set();
  let normal = 0;
  for (let n = 2; n <= 200; n++) {
    const m = levelModifiers(n);
    assert.deepEqual(m, levelModifiers(n));
    if (!m.length) normal++;
    m.forEach((k) => kinds.add(k));
    if (n < CONFIG.levels.modifiers.doubleFrom) assert.ok(m.length <= 1);
    assert.equal(new Set(m).size, m.length, 'no duplicate twist');
  }
  assert.deepEqual([...kinds].sort(), ['floor', 'gravity', 'stones']);
  assert.ok(normal > 30 && normal < 120, `some levels play normally (${normal}/199)`);
});

test('same level deals the same opening pieces and stones for everyone', () => {
  const a = new Game({ mode: 'levels' });
  const b = new Game({ mode: 'levels' });
  for (const g of [a, b]) {
    g.level = 9;
    g.setupLevel();
  }
  assert.deepEqual(a.grid, b.grid);
  assert.deepEqual(a.tray.map((p) => [p.key, p.bomb]), b.tray.map((p) => [p.key, p.bomb]));
});

test('gravity compacts each column and moves bombs along', () => {
  const g = blank();
  g[0 * N + 2] = 1; // top of column 2
  g[3 * N + 2] = 2;
  g[7 * N + 5] = 3; // already at the bottom
  const { grid, bombs, fallen } = applyGravity(g, N, new Set([0 * N + 2]));
  assert.equal(grid[7 * N + 2], 2);
  assert.equal(grid[6 * N + 2], 1);
  assert.equal(grid[7 * N + 5], 3);
  assert.deepEqual([...bombs], [6 * N + 2]);
  assert.deepEqual(fallen.sort(), [[6 * N + 2, 6], [7 * N + 2, 4]].sort());
});

test('stone floor fills the lowest open row, keeps one gap, and climbs', () => {
  const g = blank();
  g[7 * N + 1] = 4; // a placed block in the bottom row turns to stone
  let f = stoneFloor(g, N, new Set([7 * N + 1]), STONE, () => 0.5);
  assert.equal(f.row, 7);
  const bottom = f.grid.slice(7 * N);
  assert.equal(bottom.filter((v) => v === null).length, 1, 'exactly one gap');
  assert.equal(bottom[f.gap % N], null);
  assert.equal(f.grid[7 * N + 1], STONE);
  assert.equal(f.bombs.size, 0, 'bombs in the row are gone');
  assert.equal(f.cells.length, N - 1, 'the placed block counts as converted');
  // Next time it climbs to the row above.
  f = stoneFloor(f.grid, N, f.bombs, STONE, () => 0.1);
  assert.equal(f.row, 6);
  assert.equal(f.grid.filter((v) => v === STONE).length, 2 * (N - 1));
});

test('stone floor never completes a column', () => {
  const g = blank();
  for (let r = 0; r < N - 1; r++) g[r * N + 3] = 1; // column 3 full except the bottom
  const f = stoneFloor(g, N, new Set(), STONE, () => 0.99);
  assert.equal(f.row, 7);
  assert.equal(f.grid[7 * N + 3], null, 'left open so column 3 does not fill');
  for (let c = 0; c < N; c++) {
    assert.ok([...Array(N)].some((_, r) => f.grid[r * N + c] === null), `column ${c} not full`);
  }
});

test('stone floor returns null when no row has room', () => {
  const g = blank().map((_, i) => (i % N === 0 ? null : 1)); // every row has a single gap
  assert.equal(stoneFloor(g, N, new Set(), STONE, () => 0.5), null);
});

test('stone cells never complete a line', () => {
  const g = blank();
  for (let c = 0; c < N - 1; c++) g[c] = 0; // row 0 missing only (0,7)
  const rng = new SeededRng(levelSeed(3));
  for (let i = 0; i < 50; i++) {
    const idx = pickStoneCell(g, N, () => rng.next());
    assert.notEqual(idx, 7);
    assert.equal(g[idx], null);
  }
});

function levelGame(mods) {
  const g = new Game({ mode: 'levels' });
  g.modifiers = mods;
  g.grid = blank();
  g.bombs = new Set();
  g.score = 0;
  g.levelStart = 0;
  g.level = 1;
  return g;
}

test('gravity cascade clears newly formed lines and bumps the combo', () => {
  const g = levelGame(['gravity']);
  // Placing at (6,7) clears row 6; the block at (5,0) then falls into the
  // hole at (7,0) and completes row 7 as a cascade.
  for (let c = 1; c < N; c++) g.grid[7 * N + c] = 0; // bottom row missing (7,0)
  for (let c = 0; c < N - 1; c++) g.grid[6 * N + c] = 1; // row 6 missing (6,7)
  g.grid[5 * N] = 2;
  g.grid[0] = 3; // keeps the board non-empty
  g.tray = [makePiece('M1:0'), makePiece('O:0'), null];
  const res = g.tryPlace(g.tray[0].id, 6, 7);
  assert.equal(res.lineCount, 1, 'first clear: row 6');
  assert.ok(res.steps.length >= 1);
  const second = res.steps.find((st) => st.lineCount > 0);
  assert.ok(second, 'falling block completes row 7');
  assert.equal(second.combo, 2);
  assert.ok(res.cascadePoints > 0);
  assert.equal(g.combo, 2);
  assert.equal(res.points, 1 + CONFIG.scoring.lineBase + res.cascadePoints);
});

test('without gravity, nothing falls', () => {
  const g = levelGame([]);
  for (let c = 0; c < N - 1; c++) g.grid[6 * N + c] = 1;
  g.grid[2 * N] = 2;
  g.tray = [makePiece('M1:0'), makePiece('O:0'), null];
  const res = g.tryPlace(g.tray[0].id, 6, 7);
  assert.deepEqual(res.steps, []);
  assert.equal(g.grid[2 * N], 2);
});

test('stone floor fires every few rounds without ending the game', () => {
  const g = levelGame(['floor']);
  g.levelRound = CONFIG.levels.modifiers.floorEvery; // next refill adds a stone row
  g.grid[3] = 1; // existing blocks are not pushed off the top
  g.tray = [makePiece('M1:0'), null, null];
  const res = g.tryPlace(g.tray[0].id, 0, 0);
  assert.ok(res.roundEvents?.floor, 'stone row on refill');
  assert.equal(res.roundEvents.floor.row, 7);
  assert.equal(g.grid[3], 1);
  assert.notEqual(g.grid[0], null, 'the piece placed in the top row stays');
  assert.equal(res.gameOver, false);
  assert.equal(g.roundsUntil('floor'), CONFIG.levels.modifiers.floorEvery - 1);
});

test('stones drop every few rounds', () => {
  const g = levelGame(['stones']);
  g.levelRound = CONFIG.levels.modifiers.stoneEvery;
  g.tray = [makePiece('M1:0'), null, null];
  const res = g.tryPlace(g.tray[0].id, 4, 4);
  assert.ok(Number.isInteger(res.roundEvents?.stone));
  assert.equal(g.grid[res.roundEvents.stone], STONE);
  assert.equal(g.roundsUntil('stones'), CONFIG.levels.modifiers.stoneEvery - 1);
});

test('save/load resumes the seeded sequence exactly', () => {
  const g = new Game({ mode: 'levels' });
  g.level = 12;
  g.setupLevel();
  g.rand();
  g.rand();
  const json = JSON.parse(JSON.stringify(g.toJSON()));
  const h = Game.fromJSON(json, { mode: 'levels' });
  assert.deepEqual(h.modifiers, g.modifiers);
  assert.equal(h.levelRound, g.levelRound);
  assert.equal(h.rand(), g.rand());
});
