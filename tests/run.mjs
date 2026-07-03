/**
 * run.mjs — Entry point for the test suite. Imports every test module (which
 * register their cases) and then runs them. Invoked by `npm test`.
 */
import { run } from './harness.mjs';

await import('./simulation.test.mjs');
await import('./solver.test.mjs');
await import('./levels.test.mjs');

await run();
