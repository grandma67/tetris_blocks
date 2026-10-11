import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Game, STONE } from '../js/game.js';
import { makePiece } from '../js/pieces.js';
import { CONFIG } from '../js/config.js';
import { levelModifiers, applyGravity, riseFloor, pickStoneCell } from '../js/modifiers.js';
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
  assert.deepEqual([...kinds].sort(), ['gravity', 'rising', 'stones']);
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

test('rising floor shifts rows up and adds a junk row with one gap', () => {
  const g = blank();
  g[7 * N + 1] = 4;
  const r = riseFloor(g, N, new Set([7 * N + 1]), STONE, () => 0.5);
  assert.equal(r.overflow, false);
  assert.equal(r.grid[6 * N + 1], 4);
  assert.deepEqual([...r.bombs], [6 * N + 1]);
  const bottom = r.grid.slice(7 * N);
  assert.equal(bottom.filter((v) => v === null).length, 1);
  assert.equal(bottom[r.gap], null);
  g[3] = 1;
  assert.equal(riseFloor(g, N, new Set(), STONE, () => 0).overflow, true);
});

test('stone cells never complete a line', () => {
  const g = blank();
  for (let c = 0; c < N - 1; c++) g[c] = 0; // row 0 missing only (0,7)
  for (let i = 0; i < 50; i++) {
    const idx = pickStoneCell(g, N, Math.random);
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
  // Row 7: full except col 0. Col 0 has a block at row 5 that will fall into (7,0)
  // once row 6 (full except nothing) clears... build it step by step:
  for (let c = 1; c < N; c++) g.grid[7 * N + c] = 0; // bottom row missing (7,0)
  for (let c = 0; c < N - 1; c++) g.grid[6 * N + c] = 1; // row 6 missing (6,7)
  g.grid[5 * N] = 2; // will fall from (5,0) after row 6 clears, landing in (7,0)? no: (6,0) is cleared → falls to (7,0)? (7,0) empty → yes
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
  assert.equal(res.points, 1 + 10 + res.cascadePoints);
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

test('rising floor fires every few rounds and can crush you', () => {
  const g = levelGame(['rising']);
  g.levelRound = CONFIG.levels.modifiers.riseEvery; // next refill rises
  g.grid[7 * N + 3] = 1;
  g.tray = [makePiece('M1:0'), null, null];
  const res = g.tryPlace(g.tray[0].id, 0, 0);
  assert.ok(res.roundEvents?.rise, 'rise on refill');
  assert.equal(g.grid[6 * N + 3], 1, 'blocks moved up');
  assert.equal(res.gameOver, true, 'the block placed in row 0 was pushed off the top');
  assert.equal(res.crushed, true);
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
