// Game state machine. No DOM access — it returns rich result objects that the
// UI layer turns into rendering, sound and effects.
import { CONFIG } from './config.js';
import { createGrid, canPlace, place, findFullLines, clearLines, fitsAnywhere, isEmpty, detonate } from './board.js';
import { randomPiece, makePiece, rotateShape, orientations, shapeByKey } from './pieces.js';
import { SeededRng, levelSeed } from './rng.js';
import { levelModifiers, applyGravity, stoneFloor, pickStoneCell } from './modifiers.js';

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
    this.levelRng = null; // levels mode: seeded from the level number
    this.modifiers = [];
    this.levelRound = 0;
    this.roundEvents = null;
    this.reset();
  }

  /** Random number: seeded per level in levels mode, free-running in endless. */
  rand() {
    return this.levelRng ? this.levelRng.next() : this.rng();
  }

  hasModifier(name) {
    return this.modifiers.includes(name);
  }

  /** Rounds until the next stone drop / stone-floor row (0 = when the tray refills next). */
  roundsUntil(name) {
    const every = name === 'floor' ? CONFIG.levels.modifiers.floorEvery : CONFIG.levels.modifiers.stoneEvery;
    return (every - (this.levelRound % every)) % every;
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
    this.runId = Math.floor(Math.random() * 2 ** 31).toString(36);
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

  /** Checkpoint for retrying the current level after losing it. */
  get checkpoint() {
    return { level: this.level, score: this.levelStart, rotations: this.levelStartRotations, runId: this.runId };
  }

  /** Resume a levels run at a checkpoint (score and tokens as they were when the level began). */
  startAtLevel({ level, score = 0, rotations, runId }) {
    this.level = Math.max(1, level | 0);
    this.score = score;
    if (this.twists.rotate && Number.isInteger(rotations)) this.rotations = Math.min(CONFIG.rotate.max, rotations);
    if (runId) this.runId = runId;
    this.over = false;
    this.setupLevel();
  }

  /** Fresh board for the current level, seeded with stones that never complete a line. */
  setupLevel() {
    const n = this.size;
    this.grid = createGrid(n);
    this.bombs = new Set();
    this.combo = 0;
    this.movesSinceClear = 0;
    this.levelStart = this.score;
    this.levelStartRotations = this.rotations;
    this.levelRng = new SeededRng(levelSeed(this.level));
    this.modifiers = levelModifiers(this.level);
    this.levelRound = 0;
    let stones = CONFIG.levels.stones(this.level, n);
    for (let guard = 0; stones > 0 && guard < 500; guard++) {
      const i = Math.floor(this.rand() * n * n);
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
    this.applyRoundModifiers();
    const { piecesPerRound } = this;
    const rand = () => this.rand();
    let pieces;
    for (let attempt = 0; attempt < CONFIG.generator.fairnessAttempts; attempt++) {
      pieces = Array.from({ length: piecesPerRound }, () => randomPiece(rand, this.difficulty));
      if (pieces.some((p) => fitsAnywhere(this.grid, this.size, p.shape))) break;
    }
    if (this.twists.bombs) {
      for (const p of pieces) {
        if (this.rand() < CONFIG.bombs.chance) p.bomb = Math.floor(this.rand() * p.shape.cells.length);
      }
    }
    this.tray = pieces;
    this.stats.rounds++;
    this.over = this.checkGameOver();
  }

  /** Stone drops / stone floor fire when the tray refills (never on a level's first round). */
  applyRoundModifiers() {
    const events = {};
    const cfg = CONFIG.levels.modifiers;
    const lr = this.levelRound;
    if (this.mode === 'levels' && lr > 0) {
      if (this.hasModifier('floor') && lr % cfg.floorEvery === 0) {
        const f = stoneFloor(this.grid, this.size, this.bombs, STONE, () => this.rand());
        if (f) {
          this.grid = f.grid;
          this.bombs = f.bombs;
          events.floor = { row: f.row, gap: f.gap, cells: f.cells };
        }
      }
      if (this.hasModifier('stones') && lr % cfg.stoneEvery === 0) {
        const i = pickStoneCell(this.grid, this.size, () => this.rand());
        if (i !== null) {
          this.grid = this.grid.slice();
          this.grid[i] = STONE;
          events.stone = i;
        }
      }
    }
    this.levelRound++;
    this.roundEvents = Object.keys(events).length ? events : null;
  }

  /**
   * Gravity twist: after a clear, blocks fall; any lines that form clear too
   * (each cascade bumps the combo). Returns one step per fall for animation.
   */
  cascade() {
    const s = CONFIG.scoring;
    const steps = [];
    for (let guard = 0; guard < 30; guard++) {
      const fall = applyGravity(this.grid, this.size, this.bombs);
      if (!fall.fallen.length) break;
      this.grid = fall.grid;
      this.bombs = fall.bombs;
      const lines = findFullLines(this.grid, this.size);
      const lineCount = lines.rows.length + lines.cols.length;
      const step = { grid: this.grid, bombs: new Set(this.bombs), fallen: fall.fallen, lines, lineCount, cleared: [], explosions: [], blasted: [], points: 0, combo: this.combo, after: this.grid, afterBombs: new Set(this.bombs) };
      steps.push(step);
      if (!lineCount) break;
      this.combo++;
      this.stats.bestCombo = Math.max(this.stats.bestCombo, this.combo);
      this.stats.lines += lineCount;
      const before = this.grid;
      const res = clearLines(before, this.size, lines);
      const { explosions, blasted } = detonate(before, this.size, res.cleared.map((c) => c.index), this.bombs);
      const grid = res.grid.slice();
      for (const b of blasted) grid[b.index] = null;
      for (const c of [...res.cleared, ...blasted]) this.bombs.delete(c.index);
      this.grid = grid;
      this.stats.explosions += explosions.length;
      Object.assign(step, {
        cleared: res.cleared,
        explosions,
        blasted,
        combo: this.combo,
        points: Math.round(s.lineBase * (lineCount * (lineCount + 1)) / 2 * this.multiplierFor(this.combo)) + blasted.length * CONFIG.bombs.perBlastCell,
        after: this.grid,
        afterBombs: new Set(this.bombs),
      });
    }
    return steps;
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
    let steps = [];
    let cascadePoints = 0;
    let firstGrid = null;
    let firstBombs = null;

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
      firstGrid = this.grid;
      firstBombs = new Set(this.bombs);
      if (this.hasModifier('gravity')) {
        steps = this.cascade();
        cascadePoints = steps.reduce((sum, st) => sum + st.points, 0);
      }
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

    points += linePoints + blastPoints + cascadePoints;
    this.score += points;

    // The board after this move and its cascades, before any refill events / level change.
    const settled = { grid: this.grid, bombs: new Set(this.bombs) };

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
      firstGrid,
      firstBombs,
      settled,
      steps,
      cascadePoints,
      roundEvents: newRound && !levelUp ? this.roundEvents : null,
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
      levelRound: this.levelRound,
      levelStartRotations: this.levelStartRotations,
      runId: this.runId,
      rngState: this.levelRng ? this.levelRng.state : null,
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
      if (g.mode === 'levels') {
        g.modifiers = levelModifiers(g.level);
        g.levelRound = data.levelRound ?? 1;
        g.levelRng = new SeededRng(0);
        g.levelRng.state = data.rngState ?? levelSeed(g.level);
      }
      g.levelStartRotations = data.levelStartRotations ?? g.rotations;
      if (data.runId) g.runId = data.runId;
      g.stats = { ...g.stats, ...data.stats };
      g.over = data.over;
      if (g.grid.length !== g.size * g.size) return null;
      return g;
    } catch {
      return null;
    }
  }
}
