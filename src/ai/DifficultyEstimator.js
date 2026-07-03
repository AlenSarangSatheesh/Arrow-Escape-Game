/**
 * DifficultyEstimator.js — Estimate how hard a level is to solve.
 *
 * Difficulty is a weighted blend of: optimal solution length, number of distinct
 * mechanics in play, average branching factor (choices per rest-state along the
 * solution), board size, and hazard count. The blend is mapped to a named tier.
 *
 * This is used both to label handcrafted levels and to steer the generator.
 */
import { Tile, EntityType, Difficulty, DIFFICULTY_ORDER } from '../core/Constants.js';
import { GameState } from '../engine/GameState.js';
import { resolve, enumerateMoves } from '../engine/Simulation.js';
import { solve } from './Solver.js';

const WEIGHTS = Object.freeze({
  moves: 2.2,
  mechanics: 3.0,
  branching: 1.5,
  area: 0.35,
  hazards: 2.0,
});

// Upper bound (exclusive) of each tier, walked in order.
const THRESHOLDS = Object.freeze([
  [Difficulty.TUTORIAL, 8],
  [Difficulty.EASY, 16],
  [Difficulty.MEDIUM, 26],
  [Difficulty.HARD, 38],
  [Difficulty.EXPERT, 52],
  [Difficulty.MASTER, Infinity],
]);

const MECHANIC_TILES = new Set([
  Tile.ARROW, Tile.MIRROR, Tile.REVERSE, Tile.ROTATE, Tile.ICE, Tile.CONVEYOR,
  Tile.ONEWAY, Tile.COLOR_GATE, Tile.LOCK, Tile.STOP, Tile.FAKE_EXIT, Tile.VOID,
]);

/** Count the distinct mechanic types present in a level. */
function countMechanics(level) {
  const kinds = new Set();
  for (let i = 0; i < level.types.length; i++) {
    const t = level.types[i];
    if (MECHANIC_TILES.has(t)) kinds.add('t' + t);
  }
  for (const e of level.entities) kinds.add('e' + e.type);
  return kinds.size;
}

/** Count hazards (lasers, void cells, fake exits). */
function countHazards(level) {
  let h = 0;
  for (let i = 0; i < level.types.length; i++) {
    if (level.types[i] === Tile.VOID) h++;
    if (level.types[i] === Tile.FAKE_EXIT) h++;
  }
  for (const e of level.entities) if (e.type === EntityType.LASER) h++;
  return h;
}

/** Average number of legal launches across the states on the optimal path. */
function averageBranching(level, moves) {
  if (!moves || !moves.length) {
    return enumerateMoves(GameState.fromLevel(level)).length;
  }
  let state = GameState.fromLevel(level);
  let total = enumerateMoves(state).length;
  let count = 1;
  for (const dir of moves) {
    const r = resolve(state, dir);
    if (r.illegal) break;
    state = r.state;
    if (!state.isPlaying) break;
    total += enumerateMoves(state).length;
    count++;
  }
  return total / count;
}

/**
 * @typedef {Object} DifficultyReport
 * @property {boolean} solvable
 * @property {number} score
 * @property {string} difficulty     a {@link Difficulty}
 * @property {number} optimalMoves
 * @property {number} mechanics
 * @property {number} branching
 * @property {number} hazards
 */

/**
 * @param {import('../engine/LevelModel.js').RuntimeLevel} level
 * @param {SolveResult} [precomputedSolve]
 * @returns {DifficultyReport}
 */
export function estimateDifficulty(level, precomputedSolve = null) {
  const sol = precomputedSolve || solve(level);
  const optimalMoves = sol.solvable ? sol.optimalMoves : 0;
  const mechanics = countMechanics(level);
  const branching = averageBranching(level, sol.moves);
  const hazards = countHazards(level);
  const area = level.width * level.height;

  const score =
    WEIGHTS.moves * optimalMoves +
    WEIGHTS.mechanics * mechanics +
    WEIGHTS.branching * Math.max(0, branching - 1) +
    WEIGHTS.area * Math.sqrt(area) +
    WEIGHTS.hazards * hazards;

  let difficulty = Difficulty.MASTER;
  for (const [tier, bound] of THRESHOLDS) {
    if (score < bound) {
      difficulty = tier;
      break;
    }
  }
  if (!sol.solvable) difficulty = DIFFICULTY_ORDER[DIFFICULTY_ORDER.length - 1];

  return {
    solvable: sol.solvable,
    score: Math.round(score * 10) / 10,
    difficulty,
    optimalMoves,
    mechanics,
    branching: Math.round(branching * 100) / 100,
    hazards,
  };
}

/** Suggested par: optimal moves plus a small, difficulty-scaled slack. */
export function suggestPar(optimalMoves, difficulty) {
  const slack = { tutorial: 0, easy: 1, medium: 2, hard: 2, expert: 3, master: 3 };
  return optimalMoves + (slack[difficulty] ?? 2);
}
