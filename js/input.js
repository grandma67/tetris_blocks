// Pointer-based drag & drop (mouse, touch and pen through one code path).
import { buildPieceEl } from './renderer.js';

export class DragController {
  /**
   * @param {object} o
   * @param {HTMLElement} o.trayEl
   * @param {import('./renderer.js').Renderer} o.renderer
   * @param {() => import('./game.js').Game} o.getGame
   * @param {(pieceId:number,row:number,col:number)=>void} o.onDrop
   * @param {() => void} o.onPick
   * @param {() => void} o.onCancel
   * @param {(pieceId:number) => void} o.onTap   quick tap on a tray piece (rotate)
   * @param {(lines:object)=>object} o.previewLines
   */
  constructor(o) {
    Object.assign(this, o);
    this.drag = null;
    this.trayEl.addEventListener('pointerdown', (e) => this.start(e));
    window.addEventListener('pointermove', (e) => this.move(e), { passive: false });
    window.addEventListener('pointerup', (e) => this.end(e));
    window.addEventListener('pointercancel', () => this.cancel());
  }

  start(e) {
    if (this.drag || (e.pointerType === 'mouse' && e.button !== 0)) return;
    const game = this.getGame();
    if (game.over) return;
    // The whole slot is the grab area, so small pieces are easy to pick up.
    const src = e.target.closest('.piece') || e.target.closest('.slot')?.querySelector('.piece');
    if (!src) return;
    const piece = game.pieceById(Number(src.dataset.pieceId));
    if (!piece) return;
    e.preventDefault();

    const m = this.renderer.metrics();
    const ghost = buildPieceEl(piece, m.cell, m.step - m.cell, 'piece drag-ghost');
    document.body.appendChild(ghost);
    const touch = e.pointerType !== 'mouse';
    const w = piece.shape.w * m.step - (m.step - m.cell);
    const h = piece.shape.h * m.step - (m.step - m.cell);

    this.drag = {
      piece, src, ghost, m, w, h,
      lift: touch ? m.cell * 1.1 + h / 2 : 0,
      row: null, col: null, valid: false,
      x0: e.clientX, y0: e.clientY, t0: performance.now(), moved: false,
    };
    src.classList.add('dragging');
    this.position(e.clientX, e.clientY);
    this.onPick();
  }

  position(x, y) {
    const d = this.drag;
    const left = x - d.w / 2;
    const top = y - d.h / 2 - d.lift;
    d.ghost.style.transform = `translate(${left}px, ${top}px)`;

    const col = Math.round((left - d.m.left) / d.m.step);
    const row = Math.round((top - d.m.top) / d.m.step);
    if (row === d.row && col === d.col) return;
    d.row = row;
    d.col = col;
    const game = this.getGame();
    d.valid = game.canPlace(d.piece, row, col);
    d.ghost.classList.toggle('valid', d.valid);
    if (d.valid) this.renderer.showPreview(d.piece, row, col, this.previewLines(d.piece, row, col));
    else this.renderer.clearPreview();
  }

  move(e) {
    if (!this.drag) return;
    e.preventDefault();
    if (Math.hypot(e.clientX - this.drag.x0, e.clientY - this.drag.y0) > 10) this.drag.moved = true;
    this.position(e.clientX, e.clientY);
  }

  end() {
    if (!this.drag) return;
    const d = this.drag;
    this.renderer.clearPreview();
    // A quick tap without dragging is a rotate request, not a failed drop.
    if (!d.moved && performance.now() - d.t0 < 350) {
      this.drag = null;
      d.ghost.remove();
      d.src.classList.remove('dragging');
      this.onTap(d.piece.id);
      return;
    }
    if (d.valid) {
      d.ghost.remove();
      this.drag = null;
      this.onDrop(d.piece.id, d.row, d.col);
    } else {
      this.cancel();
    }
  }

  /** Fly the ghost back to its tray slot. */
  cancel() {
    if (!this.drag) return;
    const d = this.drag;
    this.drag = null;
    this.renderer.clearPreview();
    const r = d.src.getBoundingClientRect();
    d.ghost.classList.add('returning');
    d.ghost.style.transform = `translate(${r.left + r.width / 2 - d.w / 2}px, ${r.top + r.height / 2 - d.h / 2}px) scale(0.5)`;
    const finish = () => {
      d.ghost.remove();
      d.src.classList.remove('dragging');
    };
    d.ghost.addEventListener('transitionend', finish, { once: true });
    setTimeout(finish, 300);
    this.onCancel();
  }
}
