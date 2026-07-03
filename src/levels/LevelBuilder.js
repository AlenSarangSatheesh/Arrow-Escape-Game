/**
 * LevelBuilder.js — Author levels from readable ASCII maps.
 *
 * Handcrafted levels are far easier to read, review, and edit as text art than
 * as arrays of numbers. This module parses a map of characters (plus an optional
 * per-level legend and an entity list) into the raw definition consumed by
 * {@link createLevel}. Terrain that needs a parameter beyond the built-in glyphs
 * (rotating arrows, one-way gates, conveyors, colored gates/locks) is supplied
 * through a per-level `legend` override or the `entities` array.
 */
import { Tile, Dir, MirrorOrient } from '../core/Constants.js';

/** Default glyph → tile mapping. A value is a tile id or `[tile, param]`. */
export const DEFAULT_LEGEND = Object.freeze({
  '.': Tile.FLOOR,
  ' ': Tile.FLOOR,
  '#': Tile.WALL,
  S: Tile.START,
  E: Tile.EXIT,
  X: Tile.FAKE_EXIT,
  O: Tile.STOP,
  V: Tile.VOID,
  '^': [Tile.ARROW, Dir.UP],
  '>': [Tile.ARROW, Dir.RIGHT],
  v: [Tile.ARROW, Dir.DOWN],
  '<': [Tile.ARROW, Dir.LEFT],
  '/': [Tile.MIRROR, MirrorOrient.SLASH],
  '\\': [Tile.MIRROR, MirrorOrient.BACKSLASH],
  R: Tile.REVERSE,
  I: Tile.ICE,
});

/**
 * Parse an ASCII map into terrain cells.
 * @param {string[]} rows  equal-length rows of glyphs
 * @param {Object} [legend]  overrides/additions to {@link DEFAULT_LEGEND}
 * @returns {{ width:number, height:number, cells:Array<Array<number|[number,number]>>, start:{x:number,y:number}|null }}
 */
export function parseMap(rows, legend = {}) {
  const map = { ...DEFAULT_LEGEND, ...legend };
  const height = rows.length;
  const width = rows.reduce((w, r) => Math.max(w, r.length), 0);
  const cells = [];
  let start = null;

  for (let y = 0; y < height; y++) {
    const row = [];
    for (let x = 0; x < width; x++) {
      const ch = rows[y][x] ?? '.';
      const mapped = ch in map ? map[ch] : Tile.FLOOR;
      row.push(mapped);
      if (ch === 'S') start = { x, y };
    }
    cells.push(row);
  }
  return { width, height, cells, start };
}

/**
 * Build a raw level definition from a friendly spec.
 * @param {Object} def  may include `map` (string[]) and `legend`, or explicit
 *   `cells`/`types`/`params`; plus `entities`, `start`, and metadata.
 * @returns {Object} a raw def ready for {@link createLevel}
 */
export function defineLevel(def) {
  if (!def.map) return { ...def };
  const parsed = parseMap(def.map, def.legend);
  return {
    ...def,
    width: def.width ?? parsed.width,
    height: def.height ?? parsed.height,
    cells: parsed.cells,
    start: def.start ?? parsed.start ?? { x: 0, y: 0 },
  };
}

/** Convenience: build many level defs from a compact array of specs. */
export function definePack(defs) {
  return defs.map(defineLevel);
}
