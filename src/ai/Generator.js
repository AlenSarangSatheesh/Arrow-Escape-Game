/**
 * Generator.js — Seeded procedural level generator.
 *
 * Strategy: rather than fill randomly and hope for solvability, we *carve a
 * solution first*. Starting from the spawn cell we lay down a chain of launches
 * — each a straight run or an arrow/mirror turn — ending on a stop pad, with the
 * final run ending on the exit. This guarantees at least one solution by
 * construction. We then sprinkle verified decoy tiles (which never touch the
 * protected solution path), and finally the solver measures the true optimal and
 * the estimator labels the difficulty.
 *
 * Everything is driven by a seeded {@link RNG}, so a given seed always yields the
 * same level — which is exactly what Daily Challenges and shareable seeds need.
 */
import {
  Tile,
  ALL_DIRS,
  DIR_VECTORS,
  MirrorOrient,
  Difficulty,
  DIFFICULTY_ORDER,
  opposite,
  rotateCW,
  rotateCCW,
  reflect,
} from '../core/Constants.js';
import { RNG, hashSeed } from '../core/RNG.js';
import { createLevel } from '../engine/LevelModel.js';
import { solve } from './Solver.js';
import { estimateDifficulty, suggestPar } from './DifficultyEstimator.js';

const DX = DIR_VECTORS.map((v) => v.x);
const DY = DIR_VECTORS.map((v) => v.y);

const PRESETS = {
  tutorial: { w: 5, h: 5, stops: [2, 3], decoys: 1 },
  easy: { w: 6, h: 6, stops: [3, 4], decoys: 3 },
  medium: { w: 7, h: 7, stops: [4, 5], decoys: 5 },
  hard: { w: 8, h: 8, stops: [5, 7], decoys: 7 },
  expert: { w: 9, h: 9, stops: [6, 8], decoys: 9 },
  master: { w: 10, h: 10, stops: [7, 9], decoys: 11 },
};

const perpendicular = (d) => [rotateCW(d), rotateCCW(d)];

/** Cells strictly after (x,y) travelling `dir`, while they remain plain floor. */
function rayForward(x, y, dir, types, W, H) {
  const out = [];
  let cx = x;
  let cy = y;
  for (;;) {
    cx += DX[dir];
    cy += DY[dir];
    if (cx < 0 || cy < 0 || cx >= W || cy >= H) break;
    const i = cy * W + cx;
    if (types[i] !== Tile.FLOOR) break;
    out.push({ x: cx, y: cy, i });
  }
  return out;
}

/** Carve one move (a launch that ends on a stop pad, or the exit if final). */
function placeMove(rng, ctx, pos, lastDir, isFinal) {
  const { types, params, W, H, guarded } = ctx;
  const dirs = rng.shuffle(ALL_DIRS.filter((d) => d !== opposite(lastDir)));

  for (const d1 of dirs) {
    const ray1 = rayForward(pos.x, pos.y, d1, types, W, H);
    if (!ray1.length) continue;

    // Prefer an arrow/mirror turn (it is the whole point of the game).
    const corners = rng.shuffle(ray1.filter((c) => !guarded.has(c.i)));
    for (const corner of corners) {
      for (const d2 of rng.shuffle(perpendicular(d1))) {
        const ray2 = rayForward(corner.x, corner.y, d2, types, W, H);
        const landings = ray2.filter((c) => !guarded.has(c.i));
        if (!landings.length) continue;
        const landing = rng.pick(landings);

        if (rng.bool(0.35)) {
          const orient = reflect(d1, MirrorOrient.SLASH) === d2 ? MirrorOrient.SLASH : MirrorOrient.BACKSLASH;
          types[corner.i] = Tile.MIRROR;
          params[corner.i] = orient;
        } else {
          types[corner.i] = Tile.ARROW;
          params[corner.i] = d2;
        }
        types[landing.i] = isFinal ? Tile.EXIT : Tile.STOP;
        guardPath(guarded, ray1, corner.i);
        guardPath(guarded, ray2, landing.i);
        guarded.add(pos.y * W + pos.x);
        return { landing, endDir: d2 };
      }
    }

    // Straight fallback.
    const straight = ray1.filter((c) => !guarded.has(c.i));
    if (straight.length) {
      const landing = rng.pick(straight);
      types[landing.i] = isFinal ? Tile.EXIT : Tile.STOP;
      guardPath(guarded, ray1, landing.i);
      guarded.add(pos.y * W + pos.x);
      return { landing, endDir: d1 };
    }
  }
  return null;
}

function guardPath(guarded, ray, untilIndex) {
  for (const c of ray) {
    guarded.add(c.i);
    if (c.i === untilIndex) break;
  }
}

/** Add decoy tiles on cells that are not part of the solution path. */
function addDecoys(rng, level, ctx, count) {
  const { types, params, W, H, guarded } = ctx;
  const free = [];
  for (let i = 0; i < types.length; i++) {
    if (types[i] === Tile.FLOOR && !guarded.has(i)) free.push(i);
  }
  rng.shuffle(free);
  let added = 0;
  for (const i of free) {
    if (added >= count) break;
    const prevT = types[i];
    const prevP = params[i];
    const roll = rng.next();
    if (roll < 0.45) {
      types[i] = Tile.ARROW;
      params[i] = rng.pick(ALL_DIRS);
    } else if (roll < 0.7) {
      types[i] = Tile.WALL;
    } else if (roll < 0.85) {
      types[i] = Tile.STOP;
    } else {
      types[i] = Tile.MIRROR;
      params[i] = rng.bool() ? MirrorOrient.SLASH : MirrorOrient.BACKSLASH;
    }
    // Keep the level solvable; revert a decoy that breaks it.
    if (!solve(level).solvable) {
      types[i] = prevT;
      params[i] = prevP;
    } else {
      added++;
    }
  }
}

/**
 * @typedef {Object} GenerateResult
 * @property {import('../engine/LevelModel.js').RuntimeLevel} level
 * @property {import('./Solver.js').SolveResult} solution
 * @property {import('./DifficultyEstimator.js').DifficultyReport} report
 */

/** Distance between two difficulty tiers (for best-effort matching). */
function tierDistance(a, b) {
  return Math.abs(DIFFICULTY_ORDER.indexOf(a) - DIFFICULTY_ORDER.indexOf(b));
}

/**
 * Generate a solvable level.
 * @param {Object} opts
 * @param {number|string} opts.seed
 * @param {string} [opts.difficulty]
 * @param {number} [opts.width]
 * @param {number} [opts.height]
 * @param {number} [opts.maxAttempts]
 * @returns {GenerateResult|null}
 */
export function generate(opts = {}) {
  const difficulty = opts.difficulty || Difficulty.EASY;
  const preset = PRESETS[difficulty] || PRESETS.easy;
  const W = opts.width || preset.w;
  const H = opts.height || preset.h;
  const maxAttempts = opts.maxAttempts ?? 140;
  const seed = opts.seed ?? 1;

  let best = null;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const rng = new RNG(hashSeed(`${seed}:${difficulty}:${attempt}`));
    const types = new Uint8Array(W * H);
    const params = new Uint8Array(W * H);
    const guarded = new Set();
    const start = { x: rng.range(0, W - 1), y: rng.range(0, H - 1) };
    guarded.add(start.y * W + start.x);

    const ctx = { types, params, W, H, guarded };
    const stops = rng.range(preset.stops[0], preset.stops[1]);
    let pos = start;
    let lastDir = -1;
    let ok = true;

    for (let m = 0; m < stops; m++) {
      const res = placeMove(rng, ctx, pos, lastDir, m === stops - 1);
      if (!res) {
        ok = false;
        break;
      }
      pos = res.landing;
      lastDir = res.endDir;
    }
    if (!ok) continue;

    const level = createLevel({
      id: `gen-${difficulty}-${seed}-${attempt}`,
      name: 'Generated',
      difficulty,
      width: W,
      height: H,
      openEdges: false,
      types,
      params,
      start: { x: start.x, y: start.y },
    });

    addDecoys(rng, level, ctx, preset.decoys);

    const solution = solve(level);
    if (!solution.solvable || solution.optimalMoves < 2) continue;

    const report = estimateDifficulty(level, solution);
    level.optimalMoves = solution.optimalMoves;
    level.par = suggestPar(solution.optimalMoves, report.difficulty);
    level.difficulty = report.difficulty;
    level.mechanics = collectMechanics(level);
    level.seed = seed;

    const candidate = { level, solution, report };
    if (report.difficulty === difficulty) return candidate;

    const dist = tierDistance(report.difficulty, difficulty);
    if (!best || dist < best.dist) best = { ...candidate, dist };
  }

  return best;
}

/** Names of the mechanics present, for tagging generated levels. */
function collectMechanics(level) {
  const names = new Set();
  for (const t of level.types) {
    if (t === Tile.ARROW) names.add('arrow');
    else if (t === Tile.MIRROR) names.add('mirror');
    else if (t === Tile.STOP) names.add('stop');
    else if (t === Tile.WALL) names.add('wall');
  }
  return [...names];
}

/**
 * Deterministic daily challenge for a `YYYY-MM-DD` date string.
 * @param {string} dateStr
 * @param {string} [difficulty]
 */
export function generateDaily(dateStr, difficulty = Difficulty.MEDIUM) {
  const res = generate({ seed: `daily:${dateStr}`, difficulty });
  if (res) {
    res.level.id = `daily-${dateStr}`;
    res.level.name = `Daily · ${dateStr}`;
    res.level.tags = ['daily'];
  }
  return res;
}
