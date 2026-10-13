// Level solver. Levels are seeded, so every future tray, stone drop and floor
// row follows deterministically from the moves made — the solver can play the
// real Game model forward and search for a move sequence that reaches the goal.
import { Game } from './game.js';
import { canPlace, place, findFullLines, clearLines } from './board.js';
import { orientations, shapeByKey } from './pieces.js';

/**
 * Search for a way to finish the current level.
 * Returns { status: 'win', moves } | { status: 'impossible' } | { status: 'timeout' },
 * where each move is { slot, turns, row, col }: rotate the tray piece in `slot`
 * `turns` times, then drop it at row/col.
 */
export function solveLevel(state, { timeLimit = 10000, now = () => Date.now() } = {}) {
  const root = Game.fromJSON(state, { mode: 'levels', size: state.size, pieces: state.pieces, twists: state.twists });
  if (!root || root.mode !== 'levels') return { status: 'impossible' };
  if (root.over) return { status: 'impossible' };
  const deadline = now() + timeLimit;

  // Iterative widening: greedy passes that only follow the best few moves find
  // most wins fast; the last pass tries everything, so finishing it is a proof.
  for (const width of [2, 4, 8, Infinity]) {
    const seen = new Set();
    let timedOut = false;
    const search = (game) => {
      const key = stateKey(game);
      if (seen.has(key)) return null;
      seen.add(key);
      for (const move of candidateMoves(game).slice(0, width)) {
        if (now() > deadline) {
          timedOut = true;
          return null;
        }
        const child = game.clone();
        child.setupLevel = () => {}; // the next level's board is irrelevant here
        const res = play(child, move);
        if (!res) continue;
        if (res.levelUp) return [move];
        if (child.over) continue;
        const rest = search(child);
        if (rest) return [move, ...rest];
        if (timedOut) return null;
      }
      return null;
    };
    const moves = search(root);
    if (moves) return { status: 'win', moves };
    if (timedOut) return { status: 'timeout' };
  }
  return { status: 'impossible' };
}

/** Apply a solver move to a Game. Returns the tryPlace result, or null if illegal. */
export function play(game, { slot, turns, row, col }) {
  for (let t = 0; t < turns; t++) {
    if (!game.rotatePiece(game.tray[slot]?.id).ok) return null;
  }
  const piece = game.tray[slot];
  if (!piece) return null;
  const res = game.tryPlace(piece.id, row, col);
  return res.ok ? res : null;
}

function stateKey(g) {
  const tray = g.tray.map((p) => (p ? `${p.key}/${p.bomb}` : '-')).sort().join(',');
  return `${g.grid.map((v) => (v === null ? '.' : v >= 100 ? 's' : 'x')).join('')}|${[...g.bombs].sort((a, b) => a - b)}|${tray}|${g.score}|${g.combo}|${g.movesSinceClear}|${g.rotations}|${g.levelRound}|${g.levelRng.state}`;
}

/**
 * Every legal move, best first by a quick look-ahead of the resulting board.
 * Rotations cost tokens the player keeps for later levels, so they come last.
 */
function candidateMoves(game) {
  const { size, grid } = game;
  const moves = [];
  const done = new Set();
  game.tray.forEach((piece, slot) => {
    if (!piece) return;
    const keys = game.twists.rotate ? orientations(piece.key, game.rotations) : [piece.key];
    keys.forEach((key, turns) => {
      const id = `${piece.key}/${piece.bomb}/${turns}`;
      if (done.has(id)) return; // identical tray pieces give identical moves
      done.add(id);
      const shape = shapeByKey(key);
      for (let row = 0; row <= size - shape.h; row++) {
        for (let col = 0; col <= size - shape.w; col++) {
          if (!canPlace(grid, size, shape, row, col)) continue;
          moves.push({ slot, turns, row, col, rank: rate(grid, size, shape, row, col) - turns * 500 });
        }
      }
    });
  });
  moves.sort((a, b) => b.rank - a.rank);
  return moves.map(({ rank, ...m }) => m);
}

/** Lines cleared count most; after that, keep the board open and unfragmented. */
function rate(grid, size, shape, row, col) {
  let g = place(grid, size, shape, row, col, 0);
  const lines = findFullLines(g, size);
  const cleared = lines.rows.length + lines.cols.length;
  if (cleared) g = clearLines(g, size, lines).grid;
  let empty = 0;
  let lonely = 0;
  let edges = 0;
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      const i = r * size + c;
      const open = g[i] === null;
      if (c + 1 < size && open !== (g[i + 1] === null)) edges++;
      if (r + 1 < size && open !== (g[i + size] === null)) edges++;
      if (!open) continue;
      empty++;
      const nOpen =
        (r > 0 && g[i - size] === null) + (r + 1 < size && g[i + size] === null) +
        (c > 0 && g[i - 1] === null) + (c + 1 < size && g[i + 1] === null);
      if (nOpen === 0) lonely++;
    }
  }
  return cleared * cleared * 60 + empty * 2 - lonely * 8 - edges;
}
