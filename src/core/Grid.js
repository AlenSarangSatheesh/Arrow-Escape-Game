/**
 * Grid.js — Index math for a rectangular tile grid stored in row-major order.
 *
 * Cells are addressed either by `(x, y)` coordinates or by a flat index
 * `i = y * width + x`. These helpers keep that conversion in one place so the
 * engine, solver, renderer, and editor all agree.
 */

export const cellIndex = (x, y, width) => y * width + x;

export const cellX = (index, width) => index % width;

export const cellY = (index, width) => (index / width) | 0;

export const inBounds = (x, y, width, height) =>
  x >= 0 && y >= 0 && x < width && y < height;

/**
 * Iterate every coordinate in a grid, invoking `fn(x, y, index)`.
 * @param {number} width @param {number} height @param {(x:number,y:number,i:number)=>void} fn
 */
export function forEachCell(width, height, fn) {
  let i = 0;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++, i++) fn(x, y, i);
  }
}
