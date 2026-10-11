import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Game } from '../js/game.js';
import { makePiece, SHAPES } from '../js/pieces.js';
import { CONFIG } from '../js/config.js';

const N = CONFIG.boardSize;

function seeded(seed = 1) {
  return () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
}

test('every shape is well-formed', () => {
  for (const s of SHAPES) {
    assert.ok(s.cells.length > 0, s.key);
    assert.ok(s.cells.every(([r, c]) => r < s.h && c < s.w), s.key);
    assert.ok(s.w <= N && s.h <= N, s.key);
  }
});

test('new game deals a full tray', () => {
  const g = new Game({ rng: seeded(7) });
  assert.equal(g.tray.length, CONFIG.piecesPerRound);
  assert.equal(g.over, false);
});

test('placing scores per cell and removes piece from tray', () => {
  const g = new Game({ rng: seeded(3) });
  g.tray = [makePiece('O:0'), makePiece('I3:0'), makePiece('M1:0')];
  const res = g.tryPlace(g.tray[0].id, 0, 0);
  assert.ok(res.ok);
  assert.equal(res.points, 4);
  assert.equal(g.score, 4);
  assert.equal(g.tray[0], null);
  assert.equal(g.tryPlace(g.tray[1].id, 0, 0).ok, false, 'occupied');
});

test('line clear awards points and combo builds', () => {
  const g = new Game({ rng: seeded(5) });
  for (let c = 0; c < N - 1; c++) g.grid[c] = 0;
  for (let c = 0; c < N - 1; c++) g.grid[N + c] = 0;
  g.grid[2 * N] = 0; // keep board non-empty after clears
  g.tray = [makePiece('M1:0'), makePiece('M1:0'), makePiece('I5:0')];
  const r1 = g.tryPlace(g.tray[0].id, 0, N - 1);
  assert.equal(r1.lineCount, 1);
  assert.equal(r1.combo, 1);
  assert.equal(r1.points, 1 + CONFIG.scoring.lineBase);
  const r2 = g.tryPlace(g.tray[1].id, 1, N - 1);
  assert.equal(r2.combo, 2);
  assert.equal(r2.points, 1 + Math.round(CONFIG.scoring.lineBase * (1 + CONFIG.scoring.comboStep)));
  assert.equal(r2.boardClear, false);
});

test('clearing everything grants board-clear bonus', () => {
  const g = new Game({ rng: seeded(9) });
  for (let c = 0; c < N - 1; c++) g.grid[c] = 0;
  g.tray = [makePiece('M1:0'), makePiece('M1:0'), makePiece('M1:0')];
  const r = g.tryPlace(g.tray[0].id, 0, N - 1);
  assert.equal(r.boardClear, true);
  assert.equal(r.points, 1 + CONFIG.scoring.lineBase + CONFIG.scoring.boardClearBonus);
});

test('emptying the tray deals a new round', () => {
  const g = new Game({ rng: seeded(11) });
  g.tray = [makePiece('M1:0'), null, null];
  const r = g.tryPlace(g.tray[0].id, 4, 4);
  assert.equal(r.newRound, true);
  assert.equal(g.tray.filter(Boolean).length, CONFIG.piecesPerRound);
});

test('game over when no remaining piece fits', () => {
  const g = new Game({ rng: seeded(13) });
  g.grid = g.grid.map((_, i) => ((Math.floor(i / N) + (i % N)) % 2 ? 0 : null));
  g.grid[0] = null;
  g.grid[1] = null; // the only room for a domino... and the monomino we place takes it
  g.tray = [makePiece('M1:0'), makePiece('O:0'), null];
  const r = g.tryPlace(g.tray[0].id, 0, 1);
  assert.equal(r.gameOver, true);
  assert.equal(g.over, true);
  assert.equal(g.tryPlace(g.tray[1].id, 0, 0).ok, false);
});

test('save/load round-trips', () => {
  const g = new Game({ rng: seeded(17) });
  g.tray = [makePiece('T:2'), makePiece('L:1'), null];
  g.tryPlace(g.tray[0].id, 3, 3);
  const json = JSON.parse(JSON.stringify(g.toJSON()));
  const h = Game.fromJSON(json);
  assert.deepEqual(h.grid, g.grid);
  assert.equal(h.score, g.score);
  assert.deepEqual(h.tray.map((p) => p && p.key), g.tray.map((p) => p && p.key));
  assert.equal(Game.fromJSON({ v: 99 }), null);
});

test('simulated games always terminate and keep score consistent', () => {
  const rng = seeded(42);
  for (let run = 0; run < 30; run++) {
    const g = new Game({ rng });
    let guard = 0;
    while (!g.over && guard++ < 5000) {
      const moves = [];
      for (const p of g.tray.filter(Boolean))
        for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) if (g.canPlace(p, r, c)) moves.push([p.id, r, c]);
      assert.ok(moves.length > 0, 'not over implies a legal move exists');
      const [id, r, c] = moves[Math.floor(rng() * moves.length)];
      assert.ok(g.tryPlace(id, r, c).ok);
    }
    assert.ok(g.over, 'random play should eventually lose');
    assert.ok(g.score >= g.stats.moves);
  }
});

test('board size and pieces per round are configurable', () => {
  for (const size of CONFIG.boardSizes) {
    for (let pieces = CONFIG.piecesRange[0]; pieces <= CONFIG.piecesRange[1]; pieces++) {
      const g = new Game({ size, pieces, rng: seeded(size * 10 + pieces) });
      assert.equal(g.grid.length, size * size);
      assert.equal(g.tray.length, pieces);
    }
  }
});

test('every shape fits on the smallest board', () => {
  const size = Math.min(...CONFIG.boardSizes);
  assert.ok(SHAPES.every((s) => s.w <= size && s.h <= size));
});

test('saved game only resumes with matching settings', () => {
  const g = new Game({ size: 10, pieces: 5, rng: seeded(21) });
  const json = JSON.parse(JSON.stringify(g.toJSON()));
  assert.ok(Game.fromJSON(json, { size: 10, pieces: 5 }));
  assert.equal(Game.fromJSON(json, { size: 8, pieces: 5 }), null);
  assert.equal(Game.fromJSON(json, { size: 10, pieces: 3 }), null);
  assert.equal(Game.fromJSON(json, { size: 10, pieces: 5 }).piecesPerRound, 5);
});

test('random play terminates on every mode', () => {
  const rng = seeded(99);
  for (const size of [6, 10]) for (const pieces of [1, 6]) {
    const g = new Game({ size, pieces, rng });
    let guard = 0;
    while (!g.over && guard++ < 20000) {
      const p = g.tray.find((x) => x && g.fits(x));
      const spots = [];
      for (let r = 0; r < size; r++) for (let c = 0; c < size; c++) if (g.canPlace(p, r, c)) spots.push([r, c]);
      const [r, c] = spots[Math.floor(rng() * spots.length)];
      assert.ok(g.tryPlace(p.id, r, c).ok);
    }
    assert.ok(g.over, `${size}x${size}/${pieces} should end`);
  }
});
