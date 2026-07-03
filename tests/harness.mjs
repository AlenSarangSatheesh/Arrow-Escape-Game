/**
 * harness.mjs — A zero-dependency test runner.
 *
 * Test files import { test, assert, eq } and register cases; `run.mjs` imports
 * them and calls `run()`. Keeps CI free of any npm dependencies.
 */
const cases = [];
let currentSuite = 'default';

export function suite(name) {
  currentSuite = name;
}

export function test(name, fn) {
  cases.push({ suite: currentSuite, name, fn });
}

export function assert(cond, msg = 'assertion failed') {
  if (!cond) throw new Error(msg);
}

export function eq(actual, expected, msg = '') {
  if (actual !== expected) {
    throw new Error(`${msg} — expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

export function deepEq(actual, expected, msg = '') {
  const a = JSON.stringify(actual);
  const b = JSON.stringify(expected);
  if (a !== b) throw new Error(`${msg} — expected ${b}, got ${a}`);
}

export function throws(fn, msg = 'expected function to throw') {
  let threw = false;
  try {
    fn();
  } catch {
    threw = true;
  }
  if (!threw) throw new Error(msg);
}

export async function run() {
  let passed = 0;
  const failures = [];
  const started = Date.now();
  for (const c of cases) {
    try {
      await c.fn();
      passed++;
    } catch (err) {
      failures.push({ ...c, err });
    }
  }
  const dur = Date.now() - started;
  const total = cases.length;

  for (const f of failures) {
    console.error(`  ✗ [${f.suite}] ${f.name}\n      ${f.err.message}`);
  }
  console.log(
    `\n${failures.length === 0 ? '✓' : '✗'} ${passed}/${total} tests passed ` +
      `(${failures.length} failed) in ${dur}ms`,
  );
  if (failures.length > 0) process.exitCode = 1;
}
