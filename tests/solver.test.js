import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Game, STONE } from '../js/game.js';
import { makePiece } from '../js/pieces.js';
import { solveLevel, play, canPlayAhead } from '../js/solver.js';
import { CONFIG } from '../js/config.js';

const TWISTS = { rotate: true, bombs: true };
const opts = { mode: 'levels', size: 8, pieces: 3, twists: TWISTS };

function levelGame(level) {
  const g = new Game(opts);
  g.startAtLevel({ level, score: 0, rotations: 3 });
  return g;
}

test('solves a level and the moves replay to a level-up', () => {
  for (const level of [1, 4, 9]) {
    const g = levelGame(level);
    const res = solveLevel(g.clone());
    assert.equal(res.status, 'win', `level ${level}`);
    const replay = Game.fromJSON(g.toJSON(), opts);
    let last;
    for (const m of res.moves) {
      last = play(replay, m);
      assert.ok(last, 'every move is legal');
    }
    assert.ok(last.levelUp, `level ${level} cleared by the last move`);
  }
});

test('a game that is already over has no solution', () => {
  const g = levelGame(3);
  g.grid = g.grid.map((_, i) => (Math.floor(i / 8) === i % 8 ? null : STONE)); // only diagonal holes
  g.tray = [makePiece('O:0'), makePiece('O:0'), makePiece('O:0')];
  g.over = g.checkGameOver();
  assert.equal(g.over, true);
  assert.equal(solveLevel(g.clone()).status, 'impossible');
});

test('gives up at the time limit', () => {
  const g = levelGame(5);
  let t = 0;
  const res = solveLevel(g.clone(), { timeLimit: 10, now: () => (t += 5) });
  assert.equal(res.status, 'timeout');
});

test('every level starts with the next 20 pieces placeable, the same for everyone', () => {
  for (const level of [2, 7, 15, 30]) {
    const a = levelGame(level);
    const b = levelGame(level);
    assert.deepEqual(a.grid, b.grid, 'same layout');
    assert.deepEqual(a.tray.map((p) => [p.key, p.bomb]), b.tray.map((p) => [p.key, p.bomb]), 'same tray');
    assert.ok(canPlayAhead(a, 20, 20000), `level ${level}`);
  }
});

test('a level that fails the look-ahead is redrawn from the same seed', () => {
  const real = CONFIG.levels.lookahead;
  CONFIG.levels.lookahead = { ...real, budget: 0, attempts: 4 }; // every check fails
  let draws = 0;
  try {
    const g = new Game(opts);
    const lay = g.layStones;
    g.layStones = function () {
      draws++;
      return lay.call(this);
    };
    g.startAtLevel({ level: 6, score: 0, rotations: 3 });
  } finally {
    CONFIG.levels.lookahead = real;
  }
  assert.equal(draws, 4, 'redrawn until the attempt cap');
});
