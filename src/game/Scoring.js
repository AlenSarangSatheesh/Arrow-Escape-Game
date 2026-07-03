/**
 * Scoring.js — Pure star and score calculation.
 *
 * Kept free of any I/O so the same logic can drive the HUD today and a future
 * online leaderboard tomorrow.
 *
 * Stars:
 *  1 — level completed.
 *  2 — completed within par.
 *  3 — completed at the optimal move count, with all gems, and no hints used.
 */
import { SCORING } from '../core/Constants.js';

/**
 * @param {Object} r
 * @param {number} r.moves          moves the player used
 * @param {number} r.par            level par
 * @param {number} r.optimalMoves   solver optimum
 * @param {number} r.hintsUsed
 * @param {number} r.gemsCollected
 * @param {number} r.gemTotal
 * @returns {1|2|3}
 */
export function computeStars({ moves, par, optimalMoves, hintsUsed = 0, gemsCollected = 0, gemTotal = 0 }) {
  const effectivePar = Math.max(par || 0, optimalMoves || 0);
  let stars = 1;
  if (moves <= effectivePar) stars = 2;
  const gemsOk = gemTotal === 0 || gemsCollected >= gemTotal;
  if (moves <= (optimalMoves || moves) && gemsOk && hintsUsed === 0) stars = 3;
  return stars;
}

/**
 * @param {Object} r  as computeStars plus `timeMs`
 * @returns {number} a non-negative score
 */
export function computeScore({ moves, optimalMoves, timeMs = 0, hintsUsed = 0, gemsCollected = 0 }) {
  const seconds = Math.floor(timeMs / 1000);
  const over = Math.max(0, moves - (optimalMoves || moves));
  const score =
    SCORING.BASE -
    SCORING.MOVE_PENALTY * over -
    SCORING.TIME_PENALTY * seconds -
    SCORING.HINT_PENALTY * hintsUsed +
    SCORING.GEM_BONUS * gemsCollected;
  return Math.max(SCORING.MIN_SCORE, Math.round(score));
}
