/**
 * Hints.js — Solver-backed hint provider for a session.
 *
 * Wraps the solver to answer "what is the next optimal launch from here?" and to
 * produce a full optimal solution for the "show solution" ghost. Tracks how many
 * hints have been consumed (which caps the attempt's star rating).
 */
import { solveFrom } from '../ai/Solver.js';

export class Hints {
  constructor() {
    this.used = 0;
  }

  reset() {
    this.used = 0;
  }

  /**
   * The next optimal direction from `state`, or null if none. Increments the
   * used counter when a hint is actually available.
   * @param {import('../engine/GameState.js').GameState} state
   * @returns {number|null}
   */
  next(state) {
    const r = solveFrom(state);
    if (!r.solvable || !r.moves.length) return null;
    this.used++;
    return r.moves[0];
  }

  /**
   * The full optimal remaining solution from `state` (does not count as a used
   * hint until revealed by the caller's policy).
   * @param {import('../engine/GameState.js').GameState} state
   * @returns {number[]|null}
   */
  solution(state) {
    const r = solveFrom(state);
    return r.solvable ? r.moves : null;
  }
}
