/**
 * Camera.js — Maps board cells to screen pixels.
 *
 * Fits the whole board inside the available viewport with padding, keeping cells
 * square and the board centered. Also supports the inverse mapping used by the
 * editor and touch input.
 */
export class Camera {
  constructor() {
    this.cell = 32;
    this.ox = 0;
    this.oy = 0;
    this.cols = 0;
    this.rows = 0;
    this.pad = 18;
    this.boardW = 0;
    this.boardH = 0;
  }

  /** Fit `cols x rows` cells into a viewport of the given CSS pixel size. */
  fit(viewportW, viewportH, cols, rows) {
    this.cols = cols;
    this.rows = rows;
    const cell = Math.floor(
      Math.min((viewportW - this.pad * 2) / cols, (viewportH - this.pad * 2) / rows),
    );
    this.cell = Math.max(10, cell);
    this.boardW = this.cell * cols;
    this.boardH = this.cell * rows;
    this.ox = Math.round((viewportW - this.boardW) / 2);
    this.oy = Math.round((viewportH - this.boardH) / 2);
    return this;
  }

  cellRect(x, y) {
    return { x: this.ox + x * this.cell, y: this.oy + y * this.cell, s: this.cell };
  }

  cellCenter(x, y) {
    return { x: this.ox + (x + 0.5) * this.cell, y: this.oy + (y + 0.5) * this.cell };
  }

  screenToCell(sx, sy) {
    return {
      x: Math.floor((sx - this.ox) / this.cell),
      y: Math.floor((sy - this.oy) / this.cell),
    };
  }
}
