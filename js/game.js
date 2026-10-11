// Game state machine. No DOM access — it returns rich result objects that the
// UI layer turns into rendering, sound and effects.
import { CONFIG } from './config.js';
import { createGrid, canPlace, place, findFullLines, clearLines, fitsAnywhere, isEmpty, detonate } from './board.js';
import { randomPiece, makePiece, rotateShape, orientations, shapeByKey } from './pieces.js';

const NO_TWISTS = { rotate: false, bombs: false };
const sameTwists = (a, b) => !!a.rotate === !!b.rotate && !!a.bombs === !!b.bombs;

export class Game {
  constructor({ size = CONFIG.boardSize, pieces = CONFIG.piecesPerRound, twists = CONFIG.defaultTwists, rng = Math.random } = {}) {
    this.size = size;
    this.piecesPerRound = pieces;
    this.twists = { ...NO_TWISTS, ...twists };
    this.rng = rng;
    this.reset();
  }

  reset() {
    this.grid = createGrid(this.size);
    this.bombs = new Set();
    this.tray = [];
    this.score = 0;
    this.combo = 0;
    this.movesSinceClear = 0;
    this.rotations = this.twists.rotate ? CONFIG.rotate.start : 0;
    this.stats = { lines: 0, moves: 0, bestCombo: 0, boardClears: 0, rounds: 0, explosions: 0 };
    this.over = false;
    this.dealRound();
  }

  /** Deal a fresh set of pieces, trying to ensure at least one can be placed. */
  dealRound() {
    const { piecesPerRound } = this;
    let pieces;
    for (let attempt = 0; attempt < CONFIG.generator.fairnessAttempts; attempt++) {
      pieces = Array.from({ length: piecesPerRound }, () => randomPiece(this.rng, this.score));
      if (pieces.some((p) => fitsAnywhere(this.grid, this.size, p.shape))) break;
    }
    if (this.twists.bombs) {
      for (const p of pieces) {
        if (this.rng() < CONFIG.bombs.chance) p.bomb = Math.floor(this.rng() * p.shape.cells.length);
      }
    }
    this.tray = pieces;
    this.stats.rounds++;
    this.over = this.checkGameOver();
  }

  pieceById(id) {
    return this.tray.find((p) => p && p.id === id) || null;
  }

  canPlace(piece, row, col) {
    return !this.over && canPlace(this.grid, this.size, piece.shape, row, col);
  }

  /** Can this piece go anywhere on the current board as it is? */
  fits(piece) {
    return fitsAnywhere(this.grid, this.size, piece.shape);
  }

  /** Could spending rotate tokens make this piece fit? */
  fitsRotated(piece) {
    if (!this.twists.rotate || this.rotations <= 0) return false;
    return orientations(piece.key, this.rotations)
      .slice(1)
      .some((k) => fitsAnywhere(this.grid, this.size, shapeByKey(k)));
  }

  checkGameOver() {
    const remaining = this.tray.filter(Boolean);
    return remaining.length > 0 && !remaining.some((p) => this.fits(p) || this.fitsRotated(p));
  }

  /** Spend a token to turn a tray piece 90° clockwise. */
  rotatePiece(pieceId) {
    const piece = this.pieceById(pieceId);
    if (!piece || this.over || !this.twists.rotate) return { ok: false, reason: 'disabled' };
    const turned = rotateShape(piece.key);
    if (!turned) return { ok: false, reason: 'symmetric' };
    if (this.rotations <= 0) return { ok: false, reason: 'empty' };
    const bomb = piece.bomb === null ? null : turned.indexMap[piece.bomb];
    const next = makePiece(turned.key, piece.id, bomb);
    this.tray = this.tray.map((p) => (p === piece ? next : p));
    this.rotations--;
    this.over = this.checkGameOver();
    return { ok: true, piece: next };
  }

  multiplierFor(combo) {
    return 1 + Math.max(0, combo - 1) * CONFIG.scoring.comboStep;
  }

  /** Bomb indices on the board if `piece` were placed at row/col. */
  bombsWith(piece, row, col) {
    const bombs = new Set(this.bombs);
    if (piece.bomb !== null) {
      const [r, c] = piece.shape.cells[piece.bomb];
      bombs.add((row + r) * this.size + col + c);
    }
    return bombs;
  }

  /** What a drop at row/col would clear: full lines plus any bomb blast area. */
  previewClear(piece, row, col) {
    if (!canPlace(this.grid, this.size, piece.shape, row, col)) return { rows: [], cols: [], blast: [] };
    const placed = place(this.grid, this.size, piece.shape, row, col, -1);
    const lines = findFullLines(placed, this.size);
    if (!lines.rows.length && !lines.cols.length) return { ...lines, blast: [] };
    const { cleared } = clearLines(placed, this.size, lines);
    const { blasted } = detonate(placed, this.size, cleared.map((c) => c.index), this.bombsWith(piece, row, col));
    return { ...lines, blast: blasted.map((b) => b.index) };
  }

  tryPlace(pieceId, row, col) {
    const piece = this.pieceById(pieceId);
    if (!piece || !this.canPlace(piece, row, col)) return { ok: false };

    const s = CONFIG.scoring;
    const color = piece.shape.familyIndex;
    this.bombs = this.bombsWith(piece, row, col);
    this.grid = place(this.grid, this.size, piece.shape, row, col, color);
    this.tray = this.tray.map((p) => (p && p.id === pieceId ? null : p));
    this.stats.moves++;

    const placedCells = piece.shape.cells.map(([r, c]) => (row + r) * this.size + col + c);
    const lines = findFullLines(this.grid, this.size);
    const lineCount = lines.rows.length + lines.cols.length;

    let points = placedCells.length * s.perCell;
    let linePoints = 0;
    let blastPoints = 0;
    let cleared = [];
    let explosions = [];
    let blasted = [];
    let boardClear = false;
    let tokenEarned = false;

    if (lineCount > 0) {
      this.combo++;
      this.movesSinceClear = 0;
      this.stats.bestCombo = Math.max(this.stats.bestCombo, this.combo);
      this.stats.lines += lineCount;
      const before = this.grid;
      const res = clearLines(before, this.size, lines);
      cleared = res.cleared;
      ({ explosions, blasted } = detonate(before, this.size, cleared.map((c) => c.index), this.bombs));
      const grid = res.grid.slice();
      for (const b of blasted) grid[b.index] = null;
      for (const i of [...cleared, ...blasted]) this.bombs.delete(i.index);
      this.grid = grid;
      this.stats.explosions += explosions.length;

      linePoints = Math.round(s.lineBase * (lineCount * (lineCount + 1)) / 2 * this.multiplierFor(this.combo));
      blastPoints = blasted.length * CONFIG.bombs.perBlastCell;
      if (isEmpty(this.grid)) {
        boardClear = true;
        linePoints += s.boardClearBonus;
        this.stats.boardClears++;
      }
      if (this.twists.rotate && (lineCount >= CONFIG.rotate.earnLines || boardClear) && this.rotations < CONFIG.rotate.max) {
        this.rotations++;
        tokenEarned = true;
      }
    } else if (++this.movesSinceClear >= s.comboGrace) {
      this.combo = 0;
    }

    points += linePoints + blastPoints;
    this.score += points;

    let newRound = false;
    if (this.tray.every((p) => p === null)) {
      this.dealRound();
      newRound = true;
    } else {
      this.over = this.checkGameOver();
    }

    return {
      ok: true,
      piece,
      row,
      col,
      placedCells,
      lines,
      lineCount,
      cleared,
      explosions,
      blasted,
      points,
      linePoints,
      blastPoints,
      combo: this.combo,
      multiplier: lineCount ? this.multiplierFor(this.combo) : 1,
      boardClear,
      tokenEarned,
      rotations: this.rotations,
      newRound,
      gameOver: this.over,
    };
  }

  toJSON() {
    return {
      v: 1,
      size: this.size,
      pieces: this.piecesPerRound,
      twists: this.twists,
      grid: this.grid,
      bombs: [...this.bombs],
      tray: this.tray.map((p) => (p ? [p.key, p.bomb] : null)),
      score: this.score,
      combo: this.combo,
      movesSinceClear: this.movesSinceClear,
      rotations: this.rotations,
      stats: this.stats,
      over: this.over,
    };
  }

  static fromJSON(data, opts = {}) {
    if (!data || data.v !== 1) return null;
    // A saved game only resumes if it was played with the current settings.
    if (data.size !== (opts.size ?? CONFIG.boardSize)) return null;
    if ((data.pieces ?? CONFIG.piecesPerRound) !== (opts.pieces ?? CONFIG.piecesPerRound)) return null;
    if (!sameTwists(data.twists ?? NO_TWISTS, opts.twists ?? CONFIG.defaultTwists)) return null;
    try {
      const g = new Game(opts);
      g.grid = data.grid.slice();
      g.bombs = new Set(data.bombs ?? []);
      g.tray = data.tray.map((t) => {
        if (!t) return null;
        const [key, bomb] = Array.isArray(t) ? t : [t, null];
        return makePiece(key, undefined, bomb ?? null);
      });
      g.score = data.score;
      g.combo = data.combo;
      g.movesSinceClear = data.movesSinceClear;
      g.rotations = data.rotations ?? g.rotations;
      g.stats = { ...g.stats, ...data.stats };
      g.over = data.over;
      if (g.grid.length !== g.size * g.size) return null;
      return g;
    } catch {
      return null;
    }
  }
}
