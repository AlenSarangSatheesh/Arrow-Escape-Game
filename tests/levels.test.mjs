/**
 * levels.test.mjs — Guards that every shipped campaign level is solvable and that
 * the campaign meets its size floor. Runs in CI via `npm test`.
 */
import { suite, test, assert } from './harness.mjs';
import { ALL_PACKS, levelCount } from '../src/levels/index.js';
import { createLevel } from '../src/engine/LevelModel.js';
import { solve } from '../src/ai/Solver.js';

suite('levels');

for (const pack of ALL_PACKS) {
  test(`every "${pack.name}" level is solvable`, () => {
    for (const def of pack.levels) {
      const level = createLevel(def);
      const r = solve(level);
      assert(r.solvable, `${def.id} ("${def.name}") is unsolvable`);
      assert(r.optimalMoves >= 1, `${def.id} has no moves`);
    }
  });
}

test('campaign ships at least 100 levels', () => {
  const n = levelCount();
  assert(n >= 100, `campaign has only ${n} levels`);
});
