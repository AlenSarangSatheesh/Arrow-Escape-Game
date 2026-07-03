/**
 * Solver.js — Exact breadth-first search over rest-states.
 *
 * Because a launch resolves deterministically to exactly one next rest-state,
 * the reachable state space is a graph whose edges are launches. BFS therefore
 * yields the provably minimum number of moves to the exit — the value that
 * powers par, star thresholds, the hint engine, and generator validation.
 *
 * States are deduplicated by {@link GameState#hash}. A configurable exploration
 * budget bounds worst-case cost on pathological boards.
 */
import { Outcome } from '../core/Constants.js';
import { GameState } from '../engine/GameState.js';
import { successorMoves } from '../engine/Simulation.js';

/**
 * @typedef {Object} SolveResult
 * @property {boolean} solvable
 * @property {number[]} [moves]        optimal launch-direction sequence
 * @property {number} [optimalMoves]   moves.length
 * @property {number} explored         states expanded
 * @property {string} [reason]         e.g. 'budget' when the search was cut off
 */

const DEFAULTS = { requireAllGems: false, maxStates: 300000 };

/** Reconstruct the direction sequence from `fromHash` back to `startHash`. */
function reconstruct(parent, fromHash, startHash) {
  const dirs = [];
  let h = fromHash;
  while (h !== startHash) {
    const p = parent.get(h);
    if (!p) break;
    dirs.push(p.dir);
    h = p.prev;
  }
  return dirs.reverse();
}

/**
 * Solve from an arbitrary state (used for hints as well as full solves).
 * @param {GameState} state
 * @param {Partial<typeof DEFAULTS>} [opts]
 * @returns {SolveResult}
 */
export function solveFrom(state, opts = {}) {
  const { requireAllGems, maxStates } = { ...DEFAULTS, ...opts };
  const needGems = requireAllGems && state.level.lookup.gemCount > 0;

  const startHash = state.hash();
  if (state.isWon && (!needGems || state.allGemsCollected)) {
    return { solvable: true, moves: [], optimalMoves: 0, explored: 0 };
  }

  const queue = [state];
  let head = 0;
  const visited = new Set([startHash]);
  const parent = new Map(); // hash -> { prev, dir }
  let explored = 0;

  while (head < queue.length) {
    const cur = queue[head++];
    if (++explored > maxStates) return { solvable: false, explored, reason: 'budget' };
    const curHash = cur.hash();

    for (const { dir, result } of successorMoves(cur)) {
      const ns = result.state;
      if (result.outcome === Outcome.WON) {
        if (!needGems || ns.allGemsCollected) {
          const moves = reconstruct(parent, curHash, startHash);
          moves.push(dir);
          return { solvable: true, moves, optimalMoves: moves.length, explored };
        }
        continue; // reached an exit without all gems: a dead end for this goal
      }
      const h = ns.hash();
      if (!visited.has(h)) {
        visited.add(h);
        parent.set(h, { prev: curHash, dir });
        queue.push(ns);
      }
    }
  }
  return { solvable: false, explored };
}

/**
 * Solve a level from its initial state.
 * @param {import('../engine/LevelModel.js').RuntimeLevel} level
 * @param {Partial<typeof DEFAULTS>} [opts]
 * @returns {SolveResult}
 */
export function solve(level, opts = {}) {
  return solveFrom(GameState.fromLevel(level), opts);
}

/**
 * The next optimal launch direction from a given state, or null if unreachable.
 * @param {GameState} state
 * @returns {number|null}
 */
export function nextHint(state) {
  const r = solveFrom(state);
  return r.solvable && r.moves.length ? r.moves[0] : null;
}

/**
 * Heuristic uniqueness check: does exactly one first move lead to an
 * optimal-length solution? Useful for the generator to prefer crisp puzzles.
 * @param {import('../engine/LevelModel.js').RuntimeLevel} level
 * @returns {boolean}
 */
export function hasUniqueFirstMove(level) {
  const base = solve(level);
  if (!base.solvable) return false;
  const start = GameState.fromLevel(level);
  let optimalFirsts = 0;
  for (const { dir, result } of successorMoves(start)) {
    if (result.outcome === Outcome.WON) {
      if (base.optimalMoves === 1) optimalFirsts++;
      continue;
    }
    const r = solveFrom(result.state);
    if (r.solvable && r.optimalMoves + 1 === base.optimalMoves) optimalFirsts++;
    void dir;
  }
  return optimalFirsts === 1;
}
