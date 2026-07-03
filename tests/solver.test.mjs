/**
 * solver.test.mjs — Tests for the solver, difficulty estimator, and generator.
 */
import { suite, test, assert, eq } from './harness.mjs';
import { createLevel } from '../src/engine/LevelModel.js';
import { GameState } from '../src/engine/GameState.js';
import { solve, nextHint } from '../src/ai/Solver.js';
import { estimateDifficulty } from '../src/ai/DifficultyEstimator.js';
import { generate, generateDaily } from '../src/ai/Generator.js';
import { Tile, Dir, Difficulty } from '../src/core/Constants.js';

suite('solver');

test('finds the one-move optimal for a straight corridor', () => {
  const level = createLevel({
    id: 't', width: 5, height: 1, start: { x: 0, y: 0 },
    cells: [[Tile.START, Tile.FLOOR, Tile.FLOOR, Tile.FLOOR, Tile.EXIT]],
  });
  const r = solve(level);
  assert(r.solvable, 'solvable');
  eq(r.optimalMoves, 1);
});

test('counts two moves when a stop pad interrupts the corridor', () => {
  const level = createLevel({
    id: 't', width: 5, height: 1, start: { x: 0, y: 0 },
    cells: [[Tile.START, Tile.FLOOR, Tile.STOP, Tile.FLOOR, Tile.EXIT]],
  });
  const r = solve(level);
  assert(r.solvable);
  eq(r.optimalMoves, 2);
});

test('reports an unreachable exit as unsolvable', () => {
  const level = createLevel({
    id: 't', width: 3, height: 1, start: { x: 0, y: 0 },
    cells: [[Tile.START, Tile.WALL, Tile.EXIT]],
  });
  assert(!solve(level).solvable, 'walled-off exit is unsolvable');
});

test('nextHint returns the first optimal direction', () => {
  const level = createLevel({
    id: 't', width: 5, height: 1, start: { x: 0, y: 0 },
    cells: [[Tile.START, Tile.FLOOR, Tile.STOP, Tile.FLOOR, Tile.EXIT]],
  });
  eq(nextHint(GameState.fromLevel(level)), Dir.RIGHT);
});

test('estimateDifficulty returns a valid tier', () => {
  const level = createLevel({
    id: 't', width: 5, height: 1, start: { x: 0, y: 0 },
    cells: [[Tile.START, Tile.FLOOR, Tile.STOP, Tile.FLOOR, Tile.EXIT]],
  });
  const d = estimateDifficulty(level);
  assert(d.solvable);
  assert(Object.values(Difficulty).includes(d.difficulty), 'named tier');
});

suite('generator');

for (const diff of ['easy', 'medium', 'hard']) {
  test(`generates a solvable ${diff} level`, () => {
    const res = generate({ seed: 4242, difficulty: diff });
    assert(res && res.level, `produced a ${diff} level`);
    const r = solve(res.level);
    assert(r.solvable, 'generated level is solvable');
    assert(r.optimalMoves >= 2, 'non-trivial');
  });
}

test('daily generation is deterministic for a date', () => {
  const a = generateDaily('2026-07-04');
  const b = generateDaily('2026-07-04');
  assert(a && b, 'both generated');
  eq(a.level.id, b.level.id);
  eq(a.solution.optimalMoves, b.solution.optimalMoves);
  eq(Array.from(a.level.types).join(''), Array.from(b.level.types).join(''), 'identical board');
});
