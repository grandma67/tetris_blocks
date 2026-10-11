// DOM rendering for the board and the piece tray.
export const PALETTE_SIZE = 8;
// Values >= 100 are non-piece blocks (level stones), drawn in the theme's grey.
export const colorVar = (colorIndex) =>
  colorIndex >= 100 ? 'var(--stone)' : `var(--p${((colorIndex % PALETTE_SIZE) + PALETTE_SIZE) % PALETTE_SIZE})`;

export function buildPieceEl(piece, cell, gap, cls = 'piece') {
  const { shape } = piece;
  const el = document.createElement('div');
  el.className = cls;
  el.style.gridTemplateColumns = `repeat(${shape.w}, ${cell}px)`;
  el.style.gridTemplateRows = `repeat(${shape.h}, ${cell}px)`;
  el.style.gap = `${gap}px`;
  shape.cells.forEach(([r, c], i) => {
    const b = document.createElement('div');
    b.className = i === piece.bomb ? 'block bomb' : 'block';
    if (i === piece.bomb) b.style.fontSize = `${Math.round(cell * 0.62)}px`;
    b.style.gridRow = r + 1;
    b.style.gridColumn = c + 1;
    b.style.setProperty('--c', colorVar(shape.familyIndex));
    el.appendChild(b);
  });
  return el;
}

export class Renderer {
  constructor({ boardEl, boardFxEl, trayEl, size }) {
    this.boardEl = boardEl;
    this.boardFxEl = boardFxEl;
    this.trayEl = trayEl;
    this.previewed = [];
    this.lineHinted = [];
    this.setSize(size);
  }

  setSize(size) {
    this.size = size;
    this.cells = [];
    this.previewed = [];
    this.lineHinted = [];
    this.boardEl.innerHTML = '';
    this.boardFxEl.innerHTML = '';
    this.boardEl.style.setProperty('--size', size);
    for (let i = 0; i < size * size; i++) {
      const c = document.createElement('div');
      c.className = 'cell';
      this.boardEl.appendChild(c);
      this.cells.push(c);
    }
  }

  /** Tray grid: up to 3 slots per row, so 4–6 pieces use two rows. */
  setTraySlots(count) {
    const cols = Math.min(count, 3);
    const rows = Math.ceil(count / 3);
    this.trayEl.style.gridTemplateColumns = `repeat(${cols}, 1fr)`;
    this.trayEl.style.gridTemplateRows = `repeat(${rows}, 1fr)`;
    document.documentElement.style.setProperty('--tray-rows', rows);
  }

  renderBoard(grid, bombs = new Set()) {
    grid.forEach((v, i) => {
      const cell = this.cells[i];
      const filled = v !== null;
      cell.classList.toggle('filled', filled);
      cell.classList.toggle('bomb', filled && bombs.has(i));
      cell.classList.toggle('stone', filled && v >= 100);
      cell.classList.remove('dead');
      if (filled) cell.style.setProperty('--c', colorVar(v));
      else cell.style.removeProperty('--c');
    });
  }

  /** Board geometry in viewport coordinates. */
  metrics() {
    const first = this.cells[0].getBoundingClientRect();
    const second = this.cells[1].getBoundingClientRect();
    return { left: first.left, top: first.top, cell: first.width, step: second.left - first.left };
  }

  cellCenter(index) {
    const r = this.cells[index].getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  }

  // ---------- Tray ----------

  /** fitFn(piece) → 'fits' | 'rotate' (fits only if turned) | 'no' */
  renderTray(tray, fitFn) {
    this.trayEl.innerHTML = '';
    this.setTraySlots(tray.length);
    const cols = Math.min(tray.length, 3);
    const rows = Math.ceil(tray.length / 3);
    const slotW = this.trayEl.clientWidth / cols;
    const slotH = this.trayEl.clientHeight / rows;
    // Pieces are at most 5 blocks long; leave room for the grab padding.
    const mini = Math.max(8, Math.min(26, Math.floor((slotW - 22) / 5), Math.floor((slotH - 22) / 5)));
    this.mini = mini;
    tray.forEach((piece, i) => {
      const slot = document.createElement('div');
      slot.className = 'slot';
      slot.dataset.slot = i;
      if (piece) {
        const el = this.trayPiece(piece, fitFn);
        el.style.animationDelay = `${i * 70}ms`;
        slot.appendChild(el);
      }
      this.trayEl.appendChild(slot);
    });
  }

  trayPiece(piece, fitFn) {
    const el = buildPieceEl(piece, this.mini, Math.max(1, Math.round(this.mini / 10)), 'piece mini');
    el.dataset.pieceId = piece.id;
    this.applyFit(el, fitFn(piece));
    return el;
  }

  applyFit(el, fit) {
    el.classList.toggle('unfit', fit !== 'fits');
    el.classList.toggle('needs-rotate', fit === 'rotate');
  }

  /** Swap a tray piece for its rotated version with a spin. */
  replaceTrayPiece(piece, fitFn) {
    const old = this.pieceEl(piece.id);
    if (!old) return;
    const el = this.trayPiece(piece, fitFn);
    el.classList.add('spin-in');
    old.replaceWith(el);
  }

  pieceEl(pieceId) {
    return this.trayEl.querySelector(`.piece[data-piece-id="${pieceId}"]`);
  }

  updateTrayFit(fitFn, tray) {
    this.trayEl.querySelectorAll('.piece').forEach((el) => {
      const piece = tray.find((p) => p && String(p.id) === el.dataset.pieceId);
      if (piece) this.applyFit(el, fitFn(piece));
    });
  }

  // ---------- Drag preview ----------

  /** lines: { rows, cols, blast } — blast = extra cells a bomb would destroy */
  showPreview(piece, row, col, lines) {
    this.clearPreview();
    for (const [r, c] of piece.shape.cells) {
      const cell = this.cells[(row + r) * this.size + col + c];
      cell.classList.add('ghost');
      cell.style.setProperty('--g', colorVar(piece.shape.familyIndex));
      this.previewed.push(cell);
    }
    const hint = new Set();
    for (const r of lines.rows) for (let c = 0; c < this.size; c++) hint.add(r * this.size + c);
    for (const c of lines.cols) for (let r = 0; r < this.size; r++) hint.add(r * this.size + c);
    for (const i of lines.blast || []) {
      this.cells[i].classList.add('will-blast');
      this.lineHinted.push(this.cells[i]);
    }
    for (const i of hint) {
      this.cells[i].classList.add('will-clear');
      this.cells[i].style.setProperty('--g', colorVar(piece.shape.familyIndex));
      this.lineHinted.push(this.cells[i]);
    }
  }

  clearPreview() {
    for (const c of this.previewed) c.classList.remove('ghost');
    for (const c of this.lineHinted) c.classList.remove('will-clear', 'will-blast');
    this.previewed = [];
    this.lineHinted = [];
  }

  // ---------- Animations ----------

  animatePlace(indices) {
    for (const i of indices) {
      const cell = this.cells[i];
      cell.classList.remove('pop');
      void cell.offsetWidth;
      cell.classList.add('pop');
    }
  }

  /** Gravity: moved blocks drop in from `rows` cells above. */
  animateFall(fallen) {
    const { step } = this.metrics();
    for (const [index, rows] of fallen) {
      const cell = this.cells[index];
      cell.style.setProperty('--fall', `${rows * step}px`);
      cell.classList.remove('fall');
      void cell.offsetWidth;
      cell.classList.add('fall');
    }
  }

  /** A stone drops into one cell (optionally after a delay, for a row sweep). */
  animateStone(index, delay = 0) {
    const cell = this.cells[index];
    cell.style.animationDelay = delay ? `${delay}ms` : '';
    cell.classList.remove('stone-drop');
    void cell.offsetWidth;
    cell.classList.add('stone-drop');
    cell.addEventListener('animationend', () => (cell.style.animationDelay = ''), { once: true });
  }

  /**
   * Spawns detached copies of cleared blocks that fly out, staggered by their
   * distance from where the piece landed — the board itself is already empty.
   */
  animateClear(cleared, origin, intensity) {
    const boardRect = this.boardFxEl.getBoundingClientRect();
    const oR = Math.floor(origin / this.size);
    const oC = origin % this.size;
    let maxDelay = 0;
    for (const { index, color } of cleared) {
      const rect = this.cells[index].getBoundingClientRect();
      const r = Math.floor(index / this.size);
      const c = index % this.size;
      const dist = Math.abs(r - oR) + Math.abs(c - oC);
      const delay = dist * (intensity > 1 ? 28 : 38);
      maxDelay = Math.max(maxDelay, delay);
      const b = document.createElement('div');
      b.className = `block clearing${intensity > 2 ? ' epic' : ''}`;
      b.style.setProperty('--c', colorVar(color));
      b.style.left = `${rect.left - boardRect.left}px`;
      b.style.top = `${rect.top - boardRect.top}px`;
      b.style.width = b.style.height = `${rect.width}px`;
      b.style.animationDelay = `${delay}ms`;
      b.style.setProperty('--dx', `${(c - oC) * 6}px`);
      b.style.setProperty('--dy', `${(r - oR) * 6}px`);
      b.style.setProperty('--rot', `${(Math.random() - 0.5) * 120}deg`);
      this.boardFxEl.appendChild(b);
      b.addEventListener('animationend', () => b.remove(), { once: true });
    }
    return maxDelay;
  }

  flashLines(lines) {
    const els = [];
    const boardRect = this.boardFxEl.getBoundingClientRect();
    const first = this.cells[0].getBoundingClientRect();
    const last = this.cells[this.size * this.size - 1].getBoundingClientRect();
    const mk = (style) => {
      const el = document.createElement('div');
      el.className = 'line-flash';
      Object.assign(el.style, style);
      this.boardFxEl.appendChild(el);
      el.addEventListener('animationend', () => el.remove(), { once: true });
      els.push(el);
    };
    for (const r of lines.rows) {
      const rect = this.cells[r * this.size].getBoundingClientRect();
      mk({ left: `${first.left - boardRect.left}px`, top: `${rect.top - boardRect.top}px`, width: `${last.right - first.left}px`, height: `${rect.height}px` });
    }
    for (const c of lines.cols) {
      const rect = this.cells[c].getBoundingClientRect();
      mk({ left: `${rect.left - boardRect.left}px`, top: `${first.top - boardRect.top}px`, width: `${rect.width}px`, height: `${last.bottom - first.top}px` });
    }
  }

  /** Game over: filled blocks fade to grey row by row. */
  gameOverWave() {
    this.cells.forEach((cell, i) => {
      if (!cell.classList.contains('filled')) return;
      cell.style.transitionDelay = `${Math.floor(i / this.size) * 70 + (i % this.size) * 15}ms`;
      cell.classList.add('dead');
    });
  }

  clearGameOver() {
    this.cells.forEach((c) => {
      c.classList.remove('dead');
      c.style.transitionDelay = '';
    });
  }
}
