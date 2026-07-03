/**
 * Tiles.js — Static metadata about terrain tile types.
 *
 * The {@link Simulation} switches on tile types directly for speed, but the
 * editor, renderer, and validators need declarative metadata (names, whether a
 * tile takes a direction/color parameter, whether it is solid). That lives here
 * so there is a single source of truth for "what is a tile".
 */
import { Tile, Dir, MirrorOrient } from '../core/Constants.js';

/**
 * @typedef {Object} TileMeta
 * @property {string} key         machine name
 * @property {string} label       human label
 * @property {string} param       parameter kind: 'none' | 'dir' | 'orient' | 'color'
 * @property {boolean} solid      blocks entry unconditionally
 * @property {boolean} redirects  changes travel direction on pass
 * @property {boolean} stops      forces a slide to rest
 * @property {boolean} terminal   reaching it ends the slide (exit/void)
 */

/** @type {Record<number, TileMeta>} */
export const TILE_META = {
  [Tile.FLOOR]: { key: 'floor', label: 'Floor', param: 'none', solid: false, redirects: false, stops: false, terminal: false },
  [Tile.WALL]: { key: 'wall', label: 'Wall', param: 'none', solid: true, redirects: false, stops: false, terminal: false },
  [Tile.START]: { key: 'start', label: 'Start', param: 'none', solid: false, redirects: false, stops: false, terminal: false },
  [Tile.EXIT]: { key: 'exit', label: 'Exit', param: 'none', solid: false, redirects: false, stops: true, terminal: true },
  [Tile.FAKE_EXIT]: { key: 'fakeExit', label: 'Fake Exit', param: 'none', solid: false, redirects: false, stops: true, terminal: false },
  [Tile.STOP]: { key: 'stop', label: 'Stop Pad', param: 'none', solid: false, redirects: false, stops: true, terminal: false },
  [Tile.VOID]: { key: 'void', label: 'Void', param: 'none', solid: false, redirects: false, stops: false, terminal: true },
  [Tile.ARROW]: { key: 'arrow', label: 'Arrow', param: 'dir', solid: false, redirects: true, stops: false, terminal: false },
  [Tile.MIRROR]: { key: 'mirror', label: 'Mirror', param: 'orient', solid: false, redirects: true, stops: false, terminal: false },
  [Tile.REVERSE]: { key: 'reverse', label: 'Reverse', param: 'none', solid: false, redirects: true, stops: false, terminal: false },
  [Tile.ROTATE]: { key: 'rotate', label: 'Rotating Arrow', param: 'dir', solid: false, redirects: true, stops: false, terminal: false },
  [Tile.ICE]: { key: 'ice', label: 'Ice', param: 'none', solid: false, redirects: false, stops: false, terminal: false },
  [Tile.CONVEYOR]: { key: 'conveyor', label: 'Conveyor', param: 'dir', solid: false, redirects: false, stops: false, terminal: false },
  [Tile.ONEWAY]: { key: 'oneway', label: 'One-Way Gate', param: 'dir', solid: false, redirects: false, stops: false, terminal: false },
  [Tile.COLOR_GATE]: { key: 'colorGate', label: 'Color Gate', param: 'color', solid: false, redirects: false, stops: false, terminal: false },
  [Tile.LOCK]: { key: 'lock', label: 'Lock', param: 'color', solid: false, redirects: false, stops: false, terminal: false },
};

/** @returns {TileMeta} metadata for a tile type (defaults to FLOOR). */
export const tileMeta = (type) => TILE_META[type] || TILE_META[Tile.FLOOR];

/** Default parameter value for a freshly placed tile of the given type. */
export function defaultParam(type) {
  const kind = tileMeta(type).param;
  if (kind === 'dir') return Dir.RIGHT;
  if (kind === 'orient') return MirrorOrient.SLASH;
  if (kind === 'color') return 0;
  return 0;
}
