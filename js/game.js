// Game state machine. No DOM access — it returns rich result objects that the
// UI layer turns into rendering, sound and effects.
import { CONFIG } from './config.js';
import { createGrid, canPlace, place, findFullLines, clearLines, fitsAnywhere, isEmpty } from './board.js';
import { randomPiece, makePiece } from './pieces.js';

export class Game {
  constructor({ size = CONFIG.boardSize, pieces = CONFIG.piecesPerRound, rng = Math.random } = {}) {
    this.size = size;
    this.piecesPerRound = pieces;
    this.rng = rng;
    this.reset();
  }

  reset() {
    this.grid = createGrid(this.size);
    this.tray = [];
    this.score = 0;
    this.combo = 0;
    this.movesSinceClear = 0;
    this.stats = { lines: 0, moves: 0, bestCombo: 0, boardClears: 0, rounds: 0 };
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

  /** Can this piece go anywhere on the current board? */
  fits(piece) {
    return fitsAnywhere(this.grid, this.size, piece.shape);
  }

  checkGameOver() {
    const remaining = this.tray.filter(Boolean);
    return remaining.length > 0 && !remaining.some((p) => this.fits(p));
  }

  multiplierFor(combo) {
    return 1 + Math.max(0, combo - 1) * CONFIG.scoring.comboStep;
  }

  tryPlace(pieceId, row, col) {
    const piece = this.pieceById(pieceId);
    if (!piece || !this.canPlace(piece, row, col)) return { ok: false };

    const s = CONFIG.scoring;
    const color = piece.shape.familyIndex;
    this.grid = place(this.grid, this.size, piece.shape, row, col, color);
    this.tray = this.tray.map((p) => (p && p.id === pieceId ? null : p));
    this.stats.moves++;

    const placedCells = piece.shape.cells.map(([r, c]) => (row + r) * this.size + col + c);
    const lines = findFullLines(this.grid, this.size);
    const lineCount = lines.rows.length + lines.cols.length;

    let points = placedCells.length * s.perCell;
    let linePoints = 0;
    let cleared = [];
    let boardClear = false;

    if (lineCount > 0) {
      this.combo++;
      this.movesSinceClear = 0;
      this.stats.bestCombo = Math.max(this.stats.bestCombo, this.combo);
      this.stats.lines += lineCount;
      const res = clearLines(this.grid, this.size, lines);
      this.grid = res.grid;
      cleared = res.cleared;
      linePoints = Math.round(s.lineBase * (lineCount * (lineCount + 1)) / 2 * this.multiplierFor(this.combo));
      if (isEmpty(this.grid)) {
        boardClear = true;
        linePoints += s.boardClearBonus;
        this.stats.boardClears++;
      }
    } else if (++this.movesSinceClear >= s.comboGrace) {
      this.combo = 0;
    }

    points += linePoints;
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
      points,
      linePoints,
      combo: this.combo,
      multiplier: lineCount ? this.multiplierFor(this.combo) : 1,
      boardClear,
      newRound,
      gameOver: this.over,
    };
  }

  toJSON() {
    return {
      v: 1,
      size: this.size,
      pieces: this.piecesPerRound,
      grid: this.grid,
      tray: this.tray.map((p) => (p ? p.key : null)),
      score: this.score,
      combo: this.combo,
      movesSinceClear: this.movesSinceClear,
      stats: this.stats,
      over: this.over,
    };
  }

  static fromJSON(data, opts = {}) {
    if (!data || data.v !== 1) return null;
    // A saved game only resumes if it was played with the current settings.
    if (data.size !== (opts.size ?? CONFIG.boardSize)) return null;
    if ((data.pieces ?? CONFIG.piecesPerRound) !== (opts.pieces ?? CONFIG.piecesPerRound)) return null;
    try {
      const g = new Game(opts);
      g.grid = data.grid.slice();
      g.tray = data.tray.map((k) => (k ? makePiece(k) : null));
      g.score = data.score;
      g.combo = data.combo;
      g.movesSinceClear = data.movesSinceClear;
      g.stats = { ...g.stats, ...data.stats };
      g.over = data.over;
      if (g.grid.length !== g.size * g.size) return null;
      return g;
    } catch {
      return null;
    }
  }
}
