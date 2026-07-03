/**
 * GameState.js — The mutable-but-cloneable dynamic state of a play session.
 *
 * A GameState references an immutable {@link RuntimeLevel} and layers on the
 * things that change as the player moves: position, collected items, toggle
 * groups, rotating-arrow orientations, and charge counters.
 *
 * Two responsibilities make this class special:
 *  - `clone()` — cheap enough to snapshot on every move (powers unlimited undo).
 *  - `hash()`  — a canonical key so the solver can dedupe visited states.
 *
 * It contains no game rules; all transitions live in {@link Simulation}.
 */
import { Status } from '../core/Constants.js';

export class GameState {
  /** @param {import('./LevelModel.js').RuntimeLevel} level */
  constructor(level) {
    this.level = level;
    this.player = { x: level.start.x, y: level.start.y };
    this.moveCount = 0;
    this.status = Status.PLAYING;

    /** @type {Set<number>} collected key colors (permanent). */
    this.keys = new Set();
    /** @type {number|null} currently carried paint color. */
    this.carriedColor = null;
    /** @type {Set<string>} collected gem ids. */
    this.collected = new Set();
    /** @type {Map<number,boolean>} toggle-group active states. */
    this.groups = new Map(Object.entries(level.groupsInit || {}).map(([k, v]) => [Number(k), !!v]));
    /** @type {Map<number,number>} rotating-arrow current directions, by cell index. */
    this.rotations = new Map();
    /** @type {Map<number,number>} charge-arrow hit counters, by cell index. */
    this.charges = new Map();
    /** Last resolved slide path (for the renderer); not part of identity. */
    this.lastPath = null;
    this.lastOutcome = null;
  }

  static fromLevel(level) {
    return new GameState(level);
  }

  /** Deep-copy the dynamic state; the immutable level is shared by reference. */
  clone() {
    const s = Object.create(GameState.prototype);
    s.level = this.level;
    s.player = { x: this.player.x, y: this.player.y };
    s.moveCount = this.moveCount;
    s.status = this.status;
    s.keys = new Set(this.keys);
    s.carriedColor = this.carriedColor;
    s.collected = new Set(this.collected);
    s.groups = new Map(this.groups);
    s.rotations = new Map(this.rotations);
    s.charges = new Map(this.charges);
    s.lastPath = this.lastPath;
    s.lastOutcome = this.lastOutcome;
    return s;
  }

  get isPlaying() {
    return this.status === Status.PLAYING;
  }

  get isWon() {
    return this.status === Status.WON;
  }

  get allGemsCollected() {
    return this.collected.size >= this.level.lookup.gemCount;
  }

  /**
   * Canonical identity string for solver deduplication. Includes only what can
   * affect future play: position, cyclic phase, carried color/keys, collected
   * gems, group states, rotations, and charges. Raw move count is excluded
   * (that is the search depth) but its phase modulo the level period is kept.
   * @returns {string}
   */
  hash() {
    const phase = this.level.period > 1 ? this.moveCount % this.level.period : 0;
    let h = `${this.player.x},${this.player.y}|${phase}|${this.carriedColor ?? '_'}`;
    if (this.keys.size) h += '|k' + [...this.keys].sort((a, b) => a - b).join(',');
    if (this.collected.size) h += '|c' + [...this.collected].sort().join(',');
    if (this.groups.size) {
      h += '|g' + [...this.groups.entries()].sort((a, b) => a[0] - b[0]).map(([k, v]) => `${k}:${v ? 1 : 0}`).join(',');
    }
    if (this.rotations.size) {
      h += '|r' + [...this.rotations.entries()].sort((a, b) => a[0] - b[0]).map(([k, v]) => `${k}:${v}`).join(',');
    }
    if (this.charges.size) {
      h += '|h' + [...this.charges.entries()].sort((a, b) => a[0] - b[0]).map(([k, v]) => `${k}:${v}`).join(',');
    }
    return h;
  }
}
