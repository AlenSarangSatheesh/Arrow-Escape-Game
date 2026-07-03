/**
 * codec.test.mjs — Round-trip and safety tests for the level share-code codec.
 */
import { suite, test, assert, eq, throws } from './harness.mjs';
import { encodeLevel, decodeLevel } from '../src/levels/LevelCodec.js';
import { createLevel } from '../src/engine/LevelModel.js';
import { solve } from '../src/ai/Solver.js';
import { Tile, EntityType, GameColor } from '../src/core/Constants.js';

// Minimal btoa/atob polyfill for the Node test environment.
if (typeof globalThis.btoa !== 'function') {
  globalThis.btoa = (s) => Buffer.from(s, 'binary').toString('base64');
  globalThis.atob = (s) => Buffer.from(s, 'base64').toString('binary');
}

suite('codec');

const sample = {
  name: 'Round Trip',
  width: 5,
  height: 1,
  openEdges: false,
  start: { x: 0, y: 0 },
  types: [Tile.START, Tile.FLOOR, Tile.LOCK, Tile.FLOOR, Tile.EXIT],
  params: [0, 0, GameColor.RED, 0, 0],
  entities: [{ type: EntityType.KEY, color: GameColor.RED, x: 1, y: 0 }],
};

test('encodes and decodes without loss', () => {
  const code = encodeLevel(sample);
  const back = decodeLevel(code);
  eq(back.width, 5);
  eq(back.height, 1);
  eq(back.name, 'Round Trip');
  eq(Array.from(back.types).join(','), sample.types.join(','));
  eq(back.entities.length, 1);
  eq(back.entities[0].type, EntityType.KEY);
});

test('decoded level is playable', () => {
  const back = decodeLevel(encodeLevel(sample));
  assert(solve(createLevel(back)).solvable, 'decoded level solvable');
});

test('rejects a corrupt code', () => {
  const code = encodeLevel(sample);
  throws(() => decodeLevel(code.slice(0, -2) + 'zz'), 'checksum mismatch should throw');
});

test('rejects a non-Arrow-Escape code', () => {
  throws(() => decodeLevel('hello world'));
});
