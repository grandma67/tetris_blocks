import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Game, STONE } from '../js/game.js';
import { makePiece, SHAPES } from '../js/pieces.js';
import { CONFIG } from '../js/config.js';

const N = CONFIG.boardSize;

/** Random legal move; spends a rotate token only when nothing fits as-is. */
function botMove(g, rng) {
  const moves = [];
  for (const p of g.tray.filter(Boolean))
    for (let r = 0; r < g.size; r++) for (let c = 0; c < g.size; c++) if (g.canPlace(p, r, c)) moves.push([p.id, r, c]);
  if (!moves.length) {
    const p = g.tray.find((x) => x && g.fitsRotated(x));
    assert.ok(p, 'not over implies a legal move or a useful rotation');
    assert.ok(g.rotatePiece(p.id).ok);
    return;
  }
  const [id, r, c] = moves[Math.floor(rng() * moves.length)];
  assert.ok(g.tryPlace(id, r, c).ok);
}

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
    while (!g.over && guard++ < 5000) botMove(g, rng);
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
    while (!g.over && guard++ < 20000) botMove(g, rng);
    assert.ok(g.over, `${size}x${size}/${pieces} should end`);
  }
});

// ---------------------------------------------------------------- Twists

test('rotating spends a token and keeps the piece id', () => {
  const g = new Game({ rng: seeded(31) });
  g.tray = [makePiece('L:0'), makePiece('O:0'), null];
  const id = g.tray[0].id;
  const r = g.rotatePiece(id);
  assert.ok(r.ok);
  assert.equal(g.tray[0].key, 'L:1');
  assert.equal(g.tray[0].id, id);
  assert.equal(g.rotations, CONFIG.rotate.start - 1);
  assert.equal(g.rotatePiece(g.tray[1].id).reason, 'symmetric', 'O does not change when rotated');
  assert.equal(g.rotations, CONFIG.rotate.start - 1, 'no token spent on symmetric pieces');
  g.rotations = 0;
  assert.equal(g.rotatePiece(id).reason, 'empty');
});

test('rotation is unavailable when the twist is off', () => {
  const g = new Game({ twists: { rotate: false, bombs: false }, rng: seeded(32) });
  g.tray = [makePiece('L:0'), null, null];
  assert.equal(g.rotations, 0);
  assert.equal(g.rotatePiece(g.tray[0].id).ok, false);
});

test('a bomb follows its block when the piece rotates', () => {
  const g = new Game({ rng: seeded(33) });
  const p = makePiece('I4:0', undefined, 3); // bomb on the right end of a horizontal I
  g.tray = [p, null, null];
  g.rotatePiece(p.id);
  const turned = g.tray[0];
  assert.equal(turned.key, 'I4:1');
  assert.deepEqual(turned.shape.cells[turned.bomb], [3, 0], 'right end becomes the bottom');
});

test('not game over while a rotation would make a piece fit', () => {
  const g = new Game({ rng: seeded(34) });
  // Only a vertical 1×4 gap is open in column 0.
  g.grid = g.grid.map(() => 0);
  for (let r = 0; r < 4; r++) g.grid[r * N] = null;
  g.tray = [makePiece('I4:0'), null, null];
  assert.equal(g.fits(g.tray[0]), false);
  assert.equal(g.checkGameOver(), false);
  g.rotations = 0;
  assert.equal(g.checkGameOver(), true);
});

test('3+ line clears earn a rotate token', () => {
  const g = new Game({ rng: seeded(35) });
  for (let r = 0; r < 3; r++) for (let c = 1; c < N; c++) g.grid[r * N + c] = 0;
  g.grid[N * (N - 1)] = 0;
  g.tray = [makePiece('I3:1'), makePiece('M1:0'), null];
  const res = g.tryPlace(g.tray[0].id, 0, 0);
  assert.equal(res.lineCount, 3);
  assert.equal(res.tokenEarned, true);
  assert.equal(g.rotations, CONFIG.rotate.start + 1);
});

test('a bomb in a cleared line blasts its 3×3 area and chains', () => {
  const g = new Game({ rng: seeded(36) });
  // Row 2 nearly full; blocks above and below it to be blasted.
  for (let c = 0; c < N - 1; c++) g.grid[2 * N + c] = 0;
  g.grid[1 * N + 3] = 1; // above the bomb at (2,3)
  g.grid[3 * N + 4] = 1; // below-right, carries a second bomb
  g.grid[4 * N + 5] = 2; // within the second bomb's blast only
  g.grid[7 * N + 7] = 3; // far away, survives
  g.bombs = new Set([2 * N + 3, 3 * N + 4]);
  g.tray = [makePiece('M1:0'), makePiece('M1:0'), null];
  const res = g.tryPlace(g.tray[0].id, 2, N - 1);
  assert.equal(res.lineCount, 1);
  assert.deepEqual(res.explosions, [2 * N + 3, 3 * N + 4]);
  assert.deepEqual(res.blasted.map((b) => b.index).sort((a, b) => a - b), [1 * N + 3, 3 * N + 4, 4 * N + 5]);
  assert.equal(res.blastPoints, 3 * CONFIG.bombs.perBlastCell);
  assert.equal(g.grid[7 * N + 7], 3);
  assert.equal(g.bombs.size, 0);
  assert.equal(g.grid.filter((v) => v !== null).length, 1);
});

test('placed bomb pieces leave a bomb on the board and preview shows the blast', () => {
  const g = new Game({ rng: seeded(37) });
  for (let c = 0; c < N - 1; c++) g.grid[c] = 0;
  g.grid[N + 6] = 1;
  const bombPiece = makePiece('M1:0', undefined, 0);
  g.tray = [bombPiece, makePiece('M1:0'), null];
  const preview = g.previewClear(bombPiece, 0, N - 1);
  assert.deepEqual(preview.rows, [0]);
  assert.deepEqual(preview.blast, [N + 6]);

  const g2 = new Game({ rng: seeded(38) });
  const p = makePiece('O:0', undefined, 2);
  g2.tray = [p, null, makePiece('M1:0')];
  g2.tryPlace(p.id, 4, 4);
  assert.deepEqual([...g2.bombs], [5 * N + 4]);
});

test('bomb pieces are dealt only when bombs are on', () => {
  const on = new Game({ rng: seeded(39) });
  const off = new Game({ twists: { rotate: true, bombs: false }, rng: seeded(39) });
  let onBombs = 0;
  for (let i = 0; i < 200; i++) {
    on.dealRound();
    off.dealRound();
    onBombs += on.tray.filter((p) => p.bomb !== null).length;
    assert.ok(off.tray.every((p) => p.bomb === null));
  }
  assert.ok(onBombs > 20 && onBombs < 120, `~10% of 600 pieces, got ${onBombs}`);
});

test('save/load keeps bombs, rotations and twists', () => {
  const g = new Game({ rng: seeded(40) });
  g.tray = [makePiece('T:0', undefined, 1), null, makePiece('M1:0')];
  g.bombs = new Set([10]);
  g.grid[10] = 2;
  g.rotations = 5;
  const json = JSON.parse(JSON.stringify(g.toJSON()));
  const h = Game.fromJSON(json, { twists: CONFIG.defaultTwists });
  assert.equal(h.tray[0].bomb, 1);
  assert.deepEqual([...h.bombs], [10]);
  assert.equal(h.rotations, 5);
  assert.equal(Game.fromJSON(json, { twists: { rotate: false, bombs: false } }), null);
});

// ---------------------------------------------------------------- Levels mode

test('level targets keep growing', () => {
  let prev = 0;
  for (let n = 1; n <= 200; n++) {
    const t = CONFIG.levels.target(n);
    assert.ok(t > prev, `level ${n}`);
    prev = t;
  }
  assert.equal(CONFIG.levels.target(1), 100);
});

test('level 1 starts empty; later levels seed stones without full lines', () => {
  const g = new Game({ mode: 'levels', rng: seeded(51) });
  assert.equal(g.level, 1);
  assert.ok(g.grid.every((v) => v === null));
  for (const level of [2, 5, 10, 40]) {
    g.level = level;
    g.setupLevel();
    const stones = g.grid.filter((v) => v === STONE).length;
    assert.equal(stones, CONFIG.levels.stones(level, N), `level ${level}`);
    const { rows, cols } = (() => {
      const full = { rows: [], cols: [] };
      for (let i = 0; i < N; i++) {
        if ([...Array(N)].every((_, j) => g.grid[i * N + j] !== null)) full.rows.push(i);
        if ([...Array(N)].every((_, j) => g.grid[j * N + i] !== null)) full.cols.push(i);
      }
      return full;
    })();
    assert.equal(rows.length + cols.length, 0);
  }
});

test('reaching the target advances to a fresh level', () => {
  const g = new Game({ mode: 'levels', rng: seeded(52) });
  g.score = 95; // 5 short of level 1's 100
  for (let c = 0; c < N - 1; c++) g.grid[c] = 0;
  g.grid[5 * N] = 1;
  g.tray = [makePiece('M1:0'), makePiece('O:0'), null];
  const tokens = g.rotations;
  const res = g.tryPlace(g.tray[0].id, 0, N - 1);
  assert.ok(res.levelUp);
  assert.equal(res.levelUp.level, 1);
  assert.equal(res.levelUp.grid[5 * N], 1, 'pre-reset board is reported for animation');
  assert.equal(g.level, 2);
  assert.equal(g.levelStart, g.score);
  assert.equal(g.levelScore, 0);
  assert.equal(g.rotations, tokens + 1);
  assert.equal(g.tray.filter(Boolean).length, CONFIG.piecesPerRound, 'new tray for the new level');
  assert.equal(g.grid.filter((v) => v !== null && v !== STONE).length, 0, 'old blocks are gone');
  assert.equal(res.newRound, true);
});

test('not reaching the target keeps the level', () => {
  const g = new Game({ mode: 'levels', rng: seeded(53) });
  g.tray = [makePiece('O:0'), makePiece('M1:0'), null];
  const res = g.tryPlace(g.tray[0].id, 0, 0);
  assert.equal(res.levelUp, null);
  assert.equal(g.level, 1);
  assert.equal(g.levelScore, 4);
});

test('levels and endless saves do not mix; level survives save/load', () => {
  const g = new Game({ mode: 'levels', rng: seeded(54) });
  g.level = 7;
  g.levelStart = 1234;
  g.score = 1300;
  const json = JSON.parse(JSON.stringify(g.toJSON()));
  assert.equal(Game.fromJSON(json, { mode: 'endless' }), null);
  const h = Game.fromJSON(json, { mode: 'levels' });
  assert.equal(h.level, 7);
  assert.equal(h.levelScore, 66);
  assert.equal(Game.fromJSON(new Game({ rng: seeded(55) }).toJSON(), { mode: 'levels' }), null);
});

test('random play in levels mode advances and eventually ends', () => {
  const rng = seeded(56);
  let maxLevel = 0;
  for (let run = 0; run < 15; run++) {
    const g = new Game({ mode: 'levels', rng });
    let guard = 0;
    while (!g.over && guard++ < 5000) botMove(g, rng);
    assert.ok(g.over);
    maxLevel = Math.max(maxLevel, g.level);
  }
  assert.ok(maxLevel >= 2, `random bot should clear level 1 sometimes (max ${maxLevel})`);
});

test('a levels run can resume at a checkpoint', () => {
  const g = new Game({ mode: 'levels', rng: seeded(60) });
  g.level = 6;
  g.score = 2000;
  g.rotations = 5;
  g.setupLevel();
  const cp = g.checkpoint;
  assert.deepEqual(cp, { level: 6, score: 2000, rotations: 5, runId: g.runId });

  const retry = new Game({ mode: 'levels', rng: seeded(61) });
  retry.startAtLevel(cp);
  assert.equal(retry.level, 6);
  assert.equal(retry.score, 2000);
  assert.equal(retry.levelScore, 0);
  assert.equal(retry.rotations, 5);
  assert.equal(retry.runId, g.runId);
  assert.equal(retry.over, false);
  // Same level → same seeded start.
  assert.deepEqual(retry.grid, g.grid);
  assert.deepEqual(retry.tray.map((p) => p.key), g.tray.map((p) => p.key));
});
