/**
 * signature.js — Handcrafted "signature" levels that introduce and showcase each
 * mechanic. Grouped by world; combined with the curated generated packs to form
 * the full campaign. Every level here is verified solvable by `npm run levels`.
 */
import { definePack } from '../LevelBuilder.js';
import { Tile, Dir, GameColor, EntityType, MirrorOrient } from '../../core/Constants.js';

const ROTATE_DOWN = { q: [Tile.ROTATE, Dir.DOWN] };
const CONVEYOR_DOWN = { C: [Tile.CONVEYOR, Dir.DOWN] };
const ONEWAY_RIGHT = { '}': [Tile.ONEWAY, Dir.RIGHT] };
const LOCK_RED = { L: [Tile.LOCK, GameColor.RED] };
const GATE_BLUE = { G: [Tile.COLOR_GATE, GameColor.BLUE] };

/* ------------------------------------------------------- World 1 · Easy */
const easySignature = definePack([
  {
    id: 'e-sig1', name: 'Decoy', difficulty: 'easy', world: 1, index: 0,
    mechanics: ['arrow', 'fakeExit'],
    map: ['S..X', '#..v', 'E..<'],
  },
  {
    id: 'e-sig2', name: 'Reflections', difficulty: 'easy', world: 1, index: 1,
    mechanics: ['mirror'],
    map: ['S..\\', '#...', 'E../'],
  },
  {
    id: 'e-sig3', name: 'Treasure', difficulty: 'easy', world: 1, index: 2,
    mechanics: ['arrow', 'gem'],
    map: ['S..v', '#...', 'E..<'],
    entities: [{ type: EntityType.GEM, id: 'g1', x: 3, y: 1 }],
  },
  {
    id: 'e-sig4', name: 'Past the Fake', difficulty: 'easy', world: 1, index: 3,
    mechanics: ['fakeExit'],
    map: ['S.X.E'],
  },
]);

/* ----------------------------------------------------- World 2 · Medium */
const mediumSignature = definePack([
  {
    id: 'm-sig1', name: 'Wormhole', difficulty: 'medium', world: 2, index: 0,
    mechanics: ['portal'],
    map: ['S....', '.....', '....E'],
    entities: [
      { type: EntityType.PORTAL, channel: 0, x: 2, y: 0 },
      { type: EntityType.PORTAL, channel: 0, x: 2, y: 2 },
    ],
  },
  {
    id: 'm-sig2', name: 'Locked', difficulty: 'medium', world: 2, index: 1,
    mechanics: ['key', 'lock'],
    map: ['S...L.E'], legend: LOCK_RED,
    entities: [{ type: EntityType.KEY, color: GameColor.RED, x: 2, y: 0 }],
  },
  {
    id: 'm-sig3', name: 'Color Coded', difficulty: 'medium', world: 2, index: 2,
    mechanics: ['colorGate'],
    map: ['S...G.E'], legend: GATE_BLUE,
    entities: [{ type: EntityType.PAINT, color: GameColor.BLUE, x: 2, y: 0 }],
  },
  {
    id: 'm-sig4', name: 'One Way', difficulty: 'medium', world: 2, index: 3,
    mechanics: ['oneway', 'arrow'],
    map: ['S}.v', '#...', 'E..<'], legend: ONEWAY_RIGHT,
  },
]);

/* ------------------------------------------------------- World 3 · Hard */
const hardSignature = definePack([
  {
    id: 'h-sig1', name: 'Spin', difficulty: 'hard', world: 3, index: 0,
    mechanics: ['rotate'],
    map: ['S.q.', '#...', 'E.<.'], legend: ROTATE_DOWN,
  },
  {
    id: 'h-sig2', name: 'Conveyor', difficulty: 'hard', world: 3, index: 1,
    mechanics: ['conveyor'],
    map: ['S..C', '....', '...E'], legend: CONVEYOR_DOWN,
  },
  {
    id: 'h-sig3', name: 'Switchback', difficulty: 'hard', world: 3, index: 2,
    mechanics: ['switch', 'toggleWall'],
    map: ['S...E'],
    groups: { 1: true },
    entities: [
      { type: EntityType.SWITCH, id: 's1', x: 1, y: 0, targets: [1] },
      { type: EntityType.TOGGLE, mode: 'wall', group: 1, x: 3, y: 0 },
    ],
  },
  {
    id: 'h-sig4', name: 'Drawbridge', difficulty: 'hard', world: 3, index: 3,
    mechanics: ['switch', 'bridge'],
    map: ['S.V.E'],
    entities: [
      { type: EntityType.SWITCH, id: 's1', x: 1, y: 0, targets: [1] },
      { type: EntityType.TOGGLE, mode: 'bridge', group: 1, x: 2, y: 0 },
    ],
  },
]);

/* ----------------------------------------------------- World 4 · Expert */
const expertSignature = definePack([
  {
    id: 'x-sig1', name: 'Timing', difficulty: 'expert', world: 4, index: 0,
    mechanics: ['movingWall'],
    map: ['S...E', '.....', '.....'],
    entities: [{ type: EntityType.MWALL, axis: 1, line: 2, from: 0, to: 2, phase: 0 }],
  },
  {
    id: 'x-sig2', name: 'Timed Gate', difficulty: 'expert', world: 4, index: 1,
    mechanics: ['timedDoor'],
    map: ['S.T.E'],
    entities: [{ type: EntityType.TWALL, x: 2, y: 0, period: 2, openFor: 1, phase: 0 }],
  },
  {
    id: 'x-sig3', name: 'Slippery', difficulty: 'expert', world: 4, index: 2,
    mechanics: ['ice'],
    map: ['SIvE', '....'],
  },
  {
    id: 'x-sig4', name: 'Which Way', difficulty: 'expert', world: 4, index: 3,
    mechanics: ['fakeExit'],
    map: ['X.S.E'],
  },
]);

/* ----------------------------------------------------- World 5 · Master */
const masterSignature = definePack([
  {
    id: 'r-sig1', name: 'Charged', difficulty: 'master', world: 5, index: 0,
    mechanics: ['charge'],
    map: ['S.C..O', '#.....', '#.E...'],
    entities: [{ type: EntityType.CHARGE, x: 2, y: 0, dir: Dir.DOWN, threshold: 2 }],
  },
  {
    id: 'r-sig2', name: 'Relay', difficulty: 'master', world: 5, index: 1,
    mechanics: ['portal'],
    map: ['S.A..B.E'],
    entities: [
      { type: EntityType.PORTAL, channel: 0, x: 2, y: 0 },
      { type: EntityType.PORTAL, channel: 0, x: 5, y: 0 },
    ],
  },
  {
    id: 'r-sig3', name: 'Grand Detour', difficulty: 'master', world: 5, index: 2,
    mechanics: ['arrow', 'stop'],
    map: ['S...O', '#...v', 'E...<'],
  },
]);

export const SIGNATURE_PACKS = {
  easy: easySignature,
  medium: mediumSignature,
  hard: hardSignature,
  expert: expertSignature,
  master: masterSignature,
};
