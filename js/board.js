// Pure board logic. The grid is a flat array of length size*size where each
// entry is either null (empty) or a color index. Functions never mutate input.

export const createGrid = (size) => new Array(size * size).fill(null);

export function canPlace(grid, size, shape, row, col) {
  for (const [r, c] of shape.cells) {
    const rr = row + r;
    const cc = col + c;
    if (rr < 0 || cc < 0 || rr >= size || cc >= size) return false;
    if (grid[rr * size + cc] !== null) return false;
  }
  return true;
}

export function place(grid, size, shape, row, col, color) {
  const next = grid.slice();
  for (const [r, c] of shape.cells) next[(row + r) * size + col + c] = color;
  return next;
}

export function findFullLines(grid, size) {
  const rows = [];
  const cols = [];
  for (let i = 0; i < size; i++) {
    let rowFull = true;
    let colFull = true;
    for (let j = 0; j < size; j++) {
      if (grid[i * size + j] === null) rowFull = false;
      if (grid[j * size + i] === null) colFull = false;
    }
    if (rowFull) rows.push(i);
    if (colFull) cols.push(i);
  }
  return { rows, cols };
}

/** Returns the new grid plus the cleared cells (index + color) for animation. */
export function clearLines(grid, size, { rows, cols }) {
  const hit = new Set();
  for (const r of rows) for (let c = 0; c < size; c++) hit.add(r * size + c);
  for (const c of cols) for (let r = 0; r < size; r++) hit.add(r * size + c);
  const next = grid.slice();
  const cleared = [];
  for (const i of hit) {
    cleared.push({ index: i, color: grid[i] });
    next[i] = null;
  }
  return { grid: next, cleared };
}

/** Lines that would be completed if `shape` were dropped at row/col. */
export function previewLines(grid, size, shape, row, col) {
  if (!canPlace(grid, size, shape, row, col)) return { rows: [], cols: [] };
  return findFullLines(place(grid, size, shape, row, col, -1), size);
}

export function fitsAnywhere(grid, size, shape) {
  for (let r = 0; r <= size - shape.h; r++) {
    for (let c = 0; c <= size - shape.w; c++) {
      if (canPlace(grid, size, shape, r, c)) return true;
    }
  }
  return false;
}

export const isEmpty = (grid) => grid.every((v) => v === null);
