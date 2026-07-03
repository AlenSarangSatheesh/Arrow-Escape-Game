/**
 * Constants.js — Shared enumerations and immutable constants.
 *
 * This module is the vocabulary of the whole game. It has no dependencies and no
 * side effects, so it can be imported by the pure engine, the solver, the renderer,
 * and the UI alike.
 */

/* ------------------------------------------------------------------ Directions */

/**
 * Cardinal directions as small integers. The numeric order is clockwise starting
 * from UP, which makes rotation a simple modular add.
 * @readonly
 * @enum {number}
 */
export const Dir = Object.freeze({
  UP: 0,
  RIGHT: 1,
  DOWN: 2,
  LEFT: 3,
});

/** Unit displacement vectors indexed by {@link Dir}. */
export const DIR_VECTORS = Object.freeze([
  Object.freeze({ x: 0, y: -1 }), // UP
  Object.freeze({ x: 1, y: 0 }), // RIGHT
  Object.freeze({ x: 0, y: 1 }), // DOWN
  Object.freeze({ x: -1, y: 0 }), // LEFT
]);

/** All four directions, for convenient iteration. */
export const ALL_DIRS = Object.freeze([Dir.UP, Dir.RIGHT, Dir.DOWN, Dir.LEFT]);

/** Human-readable names indexed by {@link Dir}. */
export const DIR_NAMES = Object.freeze(['up', 'right', 'down', 'left']);

/** @returns {number} the opposite direction (180°). */
export const opposite = (dir) => (dir + 2) & 3;

/** @returns {number} the direction rotated 90° clockwise. */
export const rotateCW = (dir) => (dir + 1) & 3;

/** @returns {number} the direction rotated 90° counter-clockwise. */
export const rotateCCW = (dir) => (dir + 3) & 3;

/** Mirror orientations. */
export const MirrorOrient = Object.freeze({
  SLASH: 0, // "/"
  BACKSLASH: 1, // "\"
});

// Reflection lookup tables indexed by [UP, RIGHT, DOWN, LEFT].
// "/"  swaps UP<->RIGHT and DOWN<->LEFT.
// "\"  swaps UP<->LEFT  and DOWN<->RIGHT.
const REFLECT_SLASH = [Dir.RIGHT, Dir.UP, Dir.LEFT, Dir.DOWN];
const REFLECT_BACKSLASH = [Dir.LEFT, Dir.DOWN, Dir.RIGHT, Dir.UP];

/**
 * Reflect a travelling direction off a diagonal mirror.
 * @param {number} dir incoming direction
 * @param {number} orientation {@link MirrorOrient}
 * @returns {number} outgoing direction
 */
export function reflect(dir, orientation) {
  return orientation === MirrorOrient.SLASH ? REFLECT_SLASH[dir] : REFLECT_BACKSLASH[dir];
}

/* ---------------------------------------------------------------------- Tiles */

/**
 * Terrain tile types. Each cell of the board has exactly one tile type plus a
 * single numeric parameter whose meaning depends on the type (see TILE_PARAM).
 * Richer, relational objects (portals, switches, gems, lasers, moving walls) are
 * modelled as entities instead — see {@link EntityType}.
 * @readonly
 * @enum {number}
 */
export const Tile = Object.freeze({
  FLOOR: 0, // slideable ground
  WALL: 1, // solid; stops a slide
  START: 2, // spawn marker (behaves as floor)
  EXIT: 3, // the real goal
  FAKE_EXIT: 4, // looks like an exit but only stops you (decoy)
  STOP: 5, // stop pad: forces a slide to rest here
  VOID: 6, // hole: falling in fails the attempt
  ARROW: 7, // redirects to param direction
  MIRROR: 8, // reflects; param = MirrorOrient
  REVERSE: 9, // reverses to the opposite direction
  ROTATE: 10, // rotating arrow; param = initial dir, advances on leave
  ICE: 11, // slide straight through, ignoring any redirect beneath
  CONVEYOR: 12, // only acts when you would stop on it: carries you along param dir
  ONEWAY: 13, // gate passable only while travelling in param dir
  COLOR_GATE: 14, // passable only while carrying matching paint (param = color)
  LOCK: 15, // passable only if the matching key was collected (param = color)
});

/** Number of terrain tile types (used to size palettes/lookup tables). */
export const TILE_COUNT = 16;

/** Tile types that redirect a moving token (subject to ICE override). */
export const REDIRECTORS = Object.freeze(
  new Set([Tile.ARROW, Tile.MIRROR, Tile.REVERSE, Tile.ROTATE]),
);

/** Tile types that cause a slide to come to rest when reached. */
export const STOPPERS = Object.freeze(new Set([Tile.STOP, Tile.FAKE_EXIT]));

/* ------------------------------------------------------------------- Entities */

/**
 * Relational / stateful board objects layered on top of terrain cells.
 * @readonly
 * @enum {string}
 */
export const EntityType = Object.freeze({
  PORTAL: 'portal', // { channel } — paired teleporter, keeps direction
  SWITCH: 'switch', // { id, targets:[group], momentary } — toggles TOGGLE groups
  TOGGLE: 'toggle', // { group, solidWhenOn } — a wall/bridge controlled by switches
  GEM: 'gem', // { id } — optional collectible
  KEY: 'key', // { color } — permanently opens LOCKs of that color
  PAINT: 'paint', // { color } — sets the carried color for COLOR_GATEs
  LASER: 'laser', // { dir, channel } — emits a lethal beam until blocked
  MWALL: 'mwall', // { axis, from, to, period, phase } — wall that patrols on a step cycle
  TWALL: 'twall', // { period, phase, openFor } — door open/closed on a step cycle
  CHARGE: 'charge', // { dir, threshold } — acts as floor until hit `threshold` times
});

/* --------------------------------------------------------------------- Colors */

/**
 * Semantic color ids for keys, locks, paint and gates. Never rely on the color
 * alone for readability — the renderer also encodes each with a distinct symbol.
 * @readonly
 * @enum {number}
 */
export const GameColor = Object.freeze({
  RED: 0,
  BLUE: 1,
  GREEN: 2,
  YELLOW: 3,
  PURPLE: 4,
  CYAN: 5,
});

export const COLOR_COUNT = 6;

/** Distinct glyphs paired with each color (accessibility: never color-only). */
export const COLOR_GLYPHS = Object.freeze(['●', '◆', '▲', '★', '⬢', '✦']);

/* --------------------------------------------------------------------- Status */

/** Outcome of resolving a single launch. */
export const Outcome = Object.freeze({
  NONE: 'none', // nothing happened (illegal / immediately blocked)
  STOP: 'stop', // came to rest against a wall / stop pad
  WON: 'won', // reached the real exit
  FELL: 'fell', // fell into the void
  DEAD: 'dead', // hit a hazard (laser)
  CYCLE: 'cycle', // would loop forever — treated as illegal
});

/** Overall play status of a {@link GameState}. */
export const Status = Object.freeze({
  PLAYING: 'playing',
  WON: 'won',
  FAILED: 'failed', // fell or died; awaiting undo/restart
});

/** Difficulty tiers, in ascending order. */
export const Difficulty = Object.freeze({
  TUTORIAL: 'tutorial',
  EASY: 'easy',
  MEDIUM: 'medium',
  HARD: 'hard',
  EXPERT: 'expert',
  MASTER: 'master',
});

export const DIFFICULTY_ORDER = Object.freeze([
  Difficulty.TUTORIAL,
  Difficulty.EASY,
  Difficulty.MEDIUM,
  Difficulty.HARD,
  Difficulty.EXPERT,
  Difficulty.MASTER,
]);

/** Star thresholds and scoring weights, kept here so scoring is tweakable in one place. */
export const SCORING = Object.freeze({
  BASE: 1000,
  MOVE_PENALTY: 50, // points lost per move over optimal
  TIME_PENALTY: 2, // points lost per second
  HINT_PENALTY: 150, // points lost per hint used
  GEM_BONUS: 250, // points per gem collected
  MIN_SCORE: 100,
});

/** Global schema version for saved data; bump on breaking save changes. */
export const SAVE_VERSION = 1;
export const SAVE_NAMESPACE = 'arrowEscape.v1';
