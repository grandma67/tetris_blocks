// Game state machine. No DOM access — it returns rich result objects that the
// UI layer turns into rendering, sound and effects.
import { CONFIG } from './config.js';
import { createGrid, canPlace, place, findFullLines, clearLines, fitsAnywhere, isEmpty, detonate } from './board.js';
import { randomPiece, makePiece, rotateShape, orientations, shapeByKey } from './pieces.js';

const NO_TWISTS = { rotate: false, bombs: false };
/** Grid value for level stone blocks (rendered grey, not a piece color). */
export const STONE = 100;
const sameTwists = (a, b) => !!a.rotate === !!b.rotate && !!a.bombs === !!b.bombs;

export class Game {
  constructor({ mode = 'endless', size = CONFIG.boardSize, pieces = CONFIG.piecesPerRound, twists = CONFIG.defaultTwists, rng = Math.random } = {}) {
    this.mode = mode;
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
    this.level = 1;
    this.levelStart = 0;
    if (this.mode === 'levels') this.setupLevel();
    else this.dealRound();
  }

  get levelTarget() {
    return CONFIG.levels.target(this.level);
  }

  get levelScore() {
    return this.score - this.levelStart;
  }

  /** Piece sizes ramp with score in endless mode and with level in levels mode. */
  get difficulty() {
    return this.mode === 'levels' ? (this.level - 1) * CONFIG.levels.difficultyPerLevel : this.score;
  }

  /** Fresh board for the current level, seeded with stones that never complete a line. */
  setupLevel() {
    const n = this.size;
    this.grid = createGrid(n);
    this.bombs = new Set();
    this.combo = 0;
    this.movesSinceClear = 0;
    this.levelStart = this.score;
    let stones = CONFIG.levels.stones(this.level, n);
    for (let guard = 0; stones > 0 && guard < 500; guard++) {
      const i = Math.floor(this.rng() * n * n);
      if (this.grid[i] !== null) continue;
      this.grid[i] = STONE;
      const { rows, cols } = findFullLines(this.grid, n);
      if (rows.length || cols.length) this.grid[i] = null;
      else stones--;
    }
    this.dealRound();
  }

  /** Deal a fresh set of pieces, trying to ensure at least one can be placed. */
  dealRound() {
    const { piecesPerRound } = this;
    let pieces;
    for (let attempt = 0; attempt < CONFIG.generator.fairnessAttempts; attempt++) {
      pieces = Array.from({ length: piecesPerRound }, () => randomPiece(this.rng, this.difficulty));
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

    // Levels mode: hitting the target moves straight on to a fresh board.
    let levelUp = null;
    if (this.mode === 'levels' && this.levelScore >= this.levelTarget) {
      levelUp = { level: this.level, grid: this.grid, bombs: new Set(this.bombs), tokenBonus: false };
      this.level++;
      if (this.twists.rotate && this.rotations < CONFIG.rotate.max) {
        this.rotations++;
        levelUp.tokenBonus = true;
      }
    }

    let newRound = false;
    if (levelUp) {
      this.setupLevel();
      newRound = true;
    } else if (this.tray.every((p) => p === null)) {
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
      levelUp,
      rotations: this.rotations,
      newRound,
      gameOver: this.over,
    };
  }

  toJSON() {
    return {
      v: 1,
      mode: this.mode,
      level: this.level,
      levelStart: this.levelStart,
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
    if ((data.mode ?? 'endless') !== (opts.mode ?? 'endless')) return null;
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
      g.level = data.level ?? 1;
      g.levelStart = data.levelStart ?? 0;
      g.stats = { ...g.stats, ...data.stats };
      g.over = data.over;
      if (g.grid.length !== g.size * g.size) return null;
      return g;
    } catch {
      return null;
    }
  }
}
