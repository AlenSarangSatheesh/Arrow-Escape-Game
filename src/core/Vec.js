/**
 * Vec.js — Tiny helpers for 2D integer grid coordinates.
 *
 * Coordinates are plain `{ x, y }` objects. These helpers are pure and allocate
 * only when necessary; hot paths in the simulation use scalar math directly.
 */

export const vec = (x, y) => ({ x, y });

export const addVec = (a, b) => ({ x: a.x + b.x, y: a.y + b.y });

export const eqVec = (a, b) => a.x === b.x && a.y === b.y;

export const manhattan = (a, b) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y);

/** Stable string key for a coordinate (used in sets/maps). */
export const vecKey = (x, y) => `${x},${y}`;

/** Parse a `"x,y"` key back into a coordinate. */
export function parseVecKey(key) {
  const i = key.indexOf(',');
  return { x: Number(key.slice(0, i)), y: Number(key.slice(i + 1)) };
}
