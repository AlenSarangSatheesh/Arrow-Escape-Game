/**
 * build-levels.mjs — Generate curated, solver-verified level packs.
 *
 * The generator carves guaranteed-solvable puzzles from a seed; this script runs
 * it deterministically, filters for non-trivial and unique boards, and writes the
 * results as static data modules under src/levels/generated/. Because the seeds
 * are fixed, re-running reproduces the exact same packs.
 *
 * Run: `npm run build:levels`
 */
import { writeFile, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { generate } from '../src/ai/Generator.js';

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));
await mkdir(resolve(ROOT, 'src/levels/generated'), { recursive: true });

const WORLDS = [
  { diff: 'easy', world: 1, count: 16, minMoves: 2 },
  { diff: 'medium', world: 2, count: 16, minMoves: 3 },
  { diff: 'hard', world: 3, count: 16, minMoves: 4 },
  { diff: 'expert', world: 4, count: 14, minMoves: 5 },
  { diff: 'master', world: 5, count: 14, minMoves: 5 },
];

const TITLES = {
  easy: 'Warmup', medium: 'Crossing', hard: 'Tangle', expert: 'Gauntlet', master: 'Labyrinth',
};

function serialize(level, meta) {
  return {
    id: meta.id,
    name: meta.name,
    difficulty: meta.diff,
    world: meta.world,
    index: meta.index,
    width: level.width,
    height: level.height,
    openEdges: false,
    types: Array.from(level.types),
    params: Array.from(level.params),
    start: { x: level.start.x, y: level.start.y },
    par: level.par,
    optimalMoves: level.optimalMoves,
    mechanics: level.mechanics || [],
  };
}

for (const w of WORLDS) {
  const levels = [];
  const seen = new Set();
  let seed = 1000;
  let guard = 0;
  while (levels.length < w.count && guard < 4000) {
    guard++;
    const res = generate({ seed: `${w.diff}:${seed++}`, difficulty: w.diff });
    if (!res) continue;
    const sol = res.solution;
    if (!sol.solvable || sol.optimalMoves < w.minMoves) continue;
    const key = Array.from(res.level.types).join('') + '|' + Array.from(res.level.params).join('');
    if (seen.has(key)) continue;
    seen.add(key);
    const index = levels.length;
    levels.push(serialize(res.level, {
      id: `${w.diff}-g${index + 1}`,
      name: `${TITLES[w.diff]} ${index + 1}`,
      diff: w.diff,
      world: w.world,
      index,
    }));
  }

  const varName = `${w.diff}Generated`;
  const body = levels.map((l) => '  ' + JSON.stringify(l)).join(',\n');
  const module = `/**
 * ${w.diff}.js — Curated, solver-verified generated levels (World ${w.world}).
 * Produced by scripts/build-levels.mjs. Do not edit by hand.
 */
export const ${varName} = [
${body},
];
`;
  const path = resolve(ROOT, 'src/levels/generated', `${w.diff}.js`);
  await writeFile(path, module, 'utf8');
  console.log(`Wrote ${levels.length} ${w.diff} levels -> src/levels/generated/${w.diff}.js`);
}

console.log('Done.');
