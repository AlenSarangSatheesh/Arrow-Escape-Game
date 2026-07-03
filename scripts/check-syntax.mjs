/**
 * Zero-dependency syntax check: runs `node --check` on every JS/MJS file under
 * src/, scripts/, and tests/. Used by CI as a lightweight lint gate.
 */
import { readdir } from 'node:fs/promises';
import { join, resolve, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const run = promisify(execFile);
const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));
const DIRS = ['src', 'scripts', 'tests'];
const EXT = new Set(['.js', '.mjs']);

async function* walk(dir) {
  let entries = [];
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(full);
    else if (EXT.has(extname(entry.name))) yield full;
  }
}

let checked = 0;
let failed = 0;
for (const dir of DIRS) {
  for await (const file of walk(join(ROOT, dir))) {
    checked++;
    try {
      await run(process.execPath, ['--check', file]);
    } catch (err) {
      failed++;
      console.error(`Syntax error in ${file}\n${err.stderr || err.message}`);
    }
  }
}

console.log(`Checked ${checked} file(s), ${failed} with errors.`);
process.exit(failed === 0 ? 0 : 1);
