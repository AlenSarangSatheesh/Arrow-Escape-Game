/**
 * RNG.js — Deterministic, seedable pseudo-random number generator.
 *
 * The pure engine and AI must never call `Math.random()`; all randomness flows
 * through an explicit RNG so that generated levels, daily challenges, and replays
 * are perfectly reproducible from a seed.
 *
 * Algorithm: mulberry32 — fast, tiny, and good enough for level generation.
 */

/** Hash an arbitrary string into a 32-bit unsigned integer seed (xfnv-1a-ish). */
export function hashSeed(str) {
  let h = 2166136261 >>> 0;
  const s = String(str);
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export class RNG {
  /** @param {number|string} [seed] */
  constructor(seed = 0x9e3779b9) {
    this._state = (typeof seed === 'string' ? hashSeed(seed) : seed >>> 0) || 1;
  }

  /** @returns {number} float in [0, 1). */
  next() {
    let t = (this._state += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /** @returns {number} integer in [0, maxExclusive). */
  int(maxExclusive) {
    return Math.floor(this.next() * maxExclusive);
  }

  /** @returns {number} integer in [min, max] inclusive. */
  range(min, max) {
    return min + this.int(max - min + 1);
  }

  /** @returns {boolean} true with probability p (default 0.5). */
  bool(p = 0.5) {
    return this.next() < p;
  }

  /** @returns {*} a random element of a non-empty array. */
  pick(arr) {
    return arr[this.int(arr.length)];
  }

  /**
   * Fisher–Yates shuffle in place using this RNG, then returns the array.
   * @template T @param {T[]} arr @returns {T[]}
   */
  shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = this.int(i + 1);
      const tmp = arr[i];
      arr[i] = arr[j];
      arr[j] = tmp;
    }
    return arr;
  }

  /** @returns {RNG} an independent generator derived from this one. */
  fork() {
    return new RNG((this._state ^ (this.int(0xffffffff) + 0x1234567)) >>> 0);
  }

  /** Serialize the internal state (for save/replay reproducibility). */
  getState() {
    return this._state >>> 0;
  }

  /** Restore a previously serialized state. */
  setState(state) {
    this._state = state >>> 0 || 1;
    return this;
  }
}
