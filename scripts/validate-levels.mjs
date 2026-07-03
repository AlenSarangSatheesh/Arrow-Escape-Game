/**
 * validate-levels.mjs — Confirm every packaged level is solvable and report its
 * optimal move count against its declared par. Run via `npm run levels`.
 */
import { createLevel } from '../src/engine/LevelModel.js';
import { solve } from '../src/ai/Solver.js';
import { estimateDifficulty } from '../src/ai/DifficultyEstimator.js';
import { ALL_PACKS } from '../src/levels/index.js';

let failures = 0;
let total = 0;

for (const pack of ALL_PACKS) {
  console.log(`\n# ${pack.name} (${pack.levels.length} levels)`);
  for (const def of pack.levels) {
    total++;
    let level;
    try {
      level = createLevel(def);
    } catch (err) {
      failures++;
      console.error(`  ✗ ${def.id}: build error — ${err.message}`);
      continue;
    }
    const r = solve(level);
    if (!r.solvable) {
      failures++;
      console.error(`  ✗ ${def.id} "${def.name}": UNSOLVABLE`);
      continue;
    }
    const d = estimateDifficulty(level, r);
    const parNote = def.par && def.par < r.optimalMoves ? `  ⚠ par ${def.par} < optimal ${r.optimalMoves}` : '';
    console.log(
      `  ✓ ${def.id.padEnd(12)} optimal ${String(r.optimalMoves).padStart(2)}  ` +
        `label ${d.difficulty.padEnd(8)} score ${String(d.score).padStart(5)}${parNote}`,
    );
  }
}

console.log(`\n${failures === 0 ? '✓' : '✗'} ${total - failures}/${total} levels valid.`);
process.exit(failures === 0 ? 0 : 1);
