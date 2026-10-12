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

/**
 * Bombs caught in a cleared line blow up the 3×3 area around them; bombs hit
 * by a blast chain-react. `gridBefore` is the grid before lines were cleared,
 * `clearedIdx` the indices the lines removed, `bombs` a Set of bomb indices.
 * Returns the explosion centers (in detonation order) and the extra blasted
 * cells (index + color) that weren't already part of a cleared line.
 */
export function detonate(gridBefore, size, clearedIdx, bombs) {
  const gone = new Set(clearedIdx);
  const queue = [...bombs].filter((b) => gone.has(b));
  const exploded = new Set();
  const explosions = [];
  const blasted = [];
  while (queue.length) {
    const b = queue.shift();
    if (exploded.has(b)) continue;
    exploded.add(b);
    explosions.push(b);
    const br = Math.floor(b / size);
    const bc = b % size;
    for (let r = br - 1; r <= br + 1; r++) {
      for (let c = bc - 1; c <= bc + 1; c++) {
        if (r < 0 || c < 0 || r >= size || c >= size) continue;
        const i = r * size + c;
        if (gridBefore[i] === null || gone.has(i)) continue;
        gone.add(i);
        blasted.push({ index: i, color: gridBefore[i] });
        if (bombs.has(i)) queue.push(i);
      }
    }
  }
  return { explosions, blasted };
}

/**
 * Can every shape be placed, one after another in some order, with full lines
 * clearing between drops? `settle(grid)` runs after each clear (e.g. gravity).
 * Gives up (returns false) after `budget` placements tried, so it stays cheap.
 */
export function canPlaceAll(grid, size, shapes, { settle = (g) => g, budget = 20000 } = {}) {
  let tries = 0;
  const solve = (g, left) => {
    if (!left.length) return true;
    const seen = new Set();
    for (let k = 0; k < left.length; k++) {
      const shape = left[k];
      if (seen.has(shape.key)) continue;
      seen.add(shape.key);
      const rest = left.filter((_, j) => j !== k);
      for (let r = 0; r <= size - shape.h; r++) {
        for (let c = 0; c <= size - shape.w; c++) {
          if (!canPlace(g, size, shape, r, c)) continue;
          if (++tries > budget) return false;
          let next = place(g, size, shape, r, c, -1);
          const lines = findFullLines(next, size);
          if (lines.rows.length || lines.cols.length) next = settle(clearLines(next, size, lines).grid);
          if (solve(next, rest)) return true;
        }
      }
    }
    return false;
  };
  return solve(grid, shapes);
}
