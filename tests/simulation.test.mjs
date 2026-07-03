/**
 * simulation.test.mjs — Behavioural tests for the deterministic slide engine.
 */
import { suite, test, assert, eq } from './harness.mjs';
import { createLevel } from '../src/engine/LevelModel.js';
import { GameState } from '../src/engine/GameState.js';
import { resolve } from '../src/engine/Simulation.js';
import { Tile, Dir, MirrorOrient, EntityType, GameColor, Outcome, Status } from '../src/core/Constants.js';

suite('simulation');

/** Build a `height x width` all-floor 2D cell grid. */
function board(w, h) {
  return Array.from({ length: h }, () => Array.from({ length: w }, () => Tile.FLOOR));
}

function make(def) {
  return GameState.fromLevel(createLevel(def));
}

test('slides straight to the exit', () => {
  const s = make({
    id: 't', width: 5, height: 1, start: { x: 0, y: 0 },
    cells: [[Tile.START, Tile.FLOOR, Tile.FLOOR, Tile.FLOOR, Tile.EXIT]],
  });
  const r = resolve(s, Dir.RIGHT);
  eq(r.outcome, Outcome.WON, 'should win');
  eq(r.state.moveCount, 1, 'one move');
});

test('an arrow redirects the slide', () => {
  const cells = board(5, 5);
  cells[0][4] = [Tile.ARROW, Dir.DOWN];
  cells[4][4] = Tile.EXIT;
  const s = make({ id: 't', width: 5, height: 5, start: { x: 0, y: 0 }, cells });
  const r = resolve(s, Dir.RIGHT);
  eq(r.outcome, Outcome.WON, 'arrow routes to exit');
});

test('a "\\" mirror reflects right into down', () => {
  const cells = board(5, 5);
  cells[0][4] = [Tile.MIRROR, MirrorOrient.BACKSLASH];
  cells[4][4] = Tile.EXIT;
  const s = make({ id: 't', width: 5, height: 5, start: { x: 0, y: 0 }, cells });
  eq(resolve(s, Dir.RIGHT).outcome, Outcome.WON);
});

test('reverse arrow bounces the token back', () => {
  const s = make({
    id: 't', width: 5, height: 1, start: { x: 0, y: 0 },
    cells: [[Tile.START, Tile.FLOOR, Tile.REVERSE, Tile.FLOOR, Tile.EXIT]],
  });
  const r = resolve(s, Dir.RIGHT);
  eq(r.outcome, Outcome.STOP, 'bounces, does not exit');
  eq(r.state.player.x, 0, 'returns to the left wall');
});

test('stop pad halts the slide before the exit', () => {
  const s = make({
    id: 't', width: 5, height: 1, start: { x: 0, y: 0 },
    cells: [[Tile.START, Tile.FLOOR, Tile.STOP, Tile.FLOOR, Tile.EXIT]],
  });
  const r = resolve(s, Dir.RIGHT);
  eq(r.outcome, Outcome.STOP);
  eq(r.state.player.x, 2, 'rests on the stop pad');
  eq(resolve(r.state, Dir.RIGHT).outcome, Outcome.WON, 'can continue to exit');
});

test('fake exit stops but does not win', () => {
  const s = make({
    id: 't', width: 5, height: 1, start: { x: 0, y: 0 },
    cells: [[Tile.START, Tile.FLOOR, Tile.FLOOR, Tile.FLOOR, Tile.FAKE_EXIT]],
  });
  const r = resolve(s, Dir.RIGHT);
  eq(r.outcome, Outcome.STOP);
  assert(r.state.status === Status.PLAYING, 'still playing');
});

test('a lock blocks without its key', () => {
  const s = make({
    id: 't', width: 5, height: 1, start: { x: 0, y: 0 },
    cells: [[Tile.START, Tile.FLOOR, [Tile.LOCK, GameColor.RED], Tile.FLOOR, Tile.EXIT]],
  });
  const r = resolve(s, Dir.RIGHT);
  eq(r.outcome, Outcome.STOP);
  eq(r.state.player.x, 1, 'stops before the lock');
});

test('collecting a key opens its lock', () => {
  const s = make({
    id: 't', width: 5, height: 1, start: { x: 0, y: 0 },
    cells: [[Tile.START, Tile.FLOOR, [Tile.LOCK, GameColor.RED], Tile.FLOOR, Tile.EXIT]],
    entities: [{ type: EntityType.KEY, color: GameColor.RED, x: 1, y: 0 }],
  });
  eq(resolve(s, Dir.RIGHT).outcome, Outcome.WON);
});

test('a portal teleports and preserves direction', () => {
  const cells = board(5, 5);
  cells[4][4] = Tile.EXIT;
  const s = make({
    id: 't', width: 5, height: 5, start: { x: 0, y: 0 }, cells,
    entities: [
      { type: EntityType.PORTAL, channel: 0, x: 1, y: 0 },
      { type: EntityType.PORTAL, channel: 0, x: 0, y: 4 },
    ],
  });
  eq(resolve(s, Dir.RIGHT).outcome, Outcome.WON, 'teleports then slides to exit');
});

test('a rotating arrow advances clockwise after use', () => {
  const cells = board(5, 5);
  cells[2][2] = [Tile.ROTATE, Dir.UP];
  const s = make({ id: 't', width: 5, height: 5, start: { x: 0, y: 2 }, cells });
  const r = resolve(s, Dir.RIGHT);
  eq(r.outcome, Outcome.STOP);
  eq(r.state.player.y, 0, 'redirected upward to the top wall');
  const idx = 2 * 5 + 2;
  eq(r.state.rotations.get(idx), Dir.RIGHT, 'UP advanced to RIGHT');
});

test('ice makes the token skid past the next arrow', () => {
  const cells = board(5, 5);
  cells[0][1] = Tile.ICE;
  cells[0][2] = [Tile.ARROW, Dir.DOWN];
  cells[0][4] = Tile.EXIT;
  const withIce = make({ id: 't', width: 5, height: 5, start: { x: 0, y: 0 }, cells });
  eq(resolve(withIce, Dir.RIGHT).outcome, Outcome.WON, 'skids to the exit');

  const cells2 = board(5, 5);
  cells2[0][2] = [Tile.ARROW, Dir.DOWN];
  cells2[0][4] = Tile.EXIT;
  const noIce = make({ id: 't2', width: 5, height: 5, start: { x: 0, y: 0 }, cells: cells2 });
  const r = resolve(noIce, Dir.RIGHT);
  eq(r.outcome, Outcome.STOP, 'without ice the arrow diverts downward');
  assert(r.state.player.y === 4, 'ends at the bottom, not the exit');
});

test('a conveyor carries the token when it would stop', () => {
  const cells = board(3, 3);
  cells[0][2] = [Tile.CONVEYOR, Dir.DOWN];
  cells[2][2] = Tile.EXIT;
  const s = make({ id: 't', width: 3, height: 3, start: { x: 0, y: 0 }, cells });
  eq(resolve(s, Dir.RIGHT).outcome, Outcome.WON, 'carried down into the exit');
});

test('a switch toggles a wall open mid-slide', () => {
  const cells = board(5, 1);
  const s = make({
    id: 't', width: 5, height: 1, start: { x: 0, y: 0 }, cells,
    groups: { 1: true },
    entities: [
      { type: EntityType.SWITCH, id: 's1', x: 1, y: 0, targets: [1] },
      { type: EntityType.TOGGLE, mode: 'wall', group: 1, x: 3, y: 0 },
    ],
  });
  cells[0][4] = Tile.EXIT;
  const s2 = make({
    id: 't', width: 5, height: 1, start: { x: 0, y: 0 },
    cells: [[Tile.START, Tile.FLOOR, Tile.FLOOR, Tile.FLOOR, Tile.EXIT]],
    groups: { 1: true },
    entities: [
      { type: EntityType.SWITCH, id: 's1', x: 1, y: 0, targets: [1] },
      { type: EntityType.TOGGLE, mode: 'wall', group: 1, x: 3, y: 0 },
    ],
  });
  eq(resolve(s2, Dir.RIGHT).outcome, Outcome.WON, 'switch opens the wall, slide reaches exit');
});

test('opposing arrows are detected as an illegal cycle', () => {
  const s = make({
    id: 't', width: 4, height: 1, start: { x: 0, y: 0 },
    cells: [[Tile.START, [Tile.ARROW, Dir.RIGHT], [Tile.ARROW, Dir.LEFT], Tile.FLOOR]],
  });
  const r = resolve(s, Dir.RIGHT);
  assert(r.illegal, 'cycle is illegal');
  eq(r.outcome, Outcome.CYCLE);
  eq(r.state.moveCount, 0, 'state unchanged');
});

test('falling into a void fails the attempt', () => {
  const s = make({
    id: 't', width: 3, height: 1, start: { x: 0, y: 0 },
    cells: [[Tile.START, Tile.VOID, Tile.EXIT]],
  });
  const r = resolve(s, Dir.RIGHT);
  eq(r.outcome, Outcome.FELL);
  assert(r.state.status === Status.FAILED);
});

test('open edges let the token slide off and fall', () => {
  const cells = [[Tile.START, Tile.FLOOR, Tile.FLOOR]];
  const walled = make({ id: 't', width: 3, height: 1, start: { x: 0, y: 0 }, cells });
  eq(resolve(walled, Dir.RIGHT).outcome, Outcome.STOP, 'bordered board stops at the edge');
  const open = make({ id: 't', width: 3, height: 1, start: { x: 0, y: 0 }, cells, openEdges: true });
  eq(resolve(open, Dir.RIGHT).outcome, Outcome.FELL, 'open board falls off the edge');
});

test('launching into a wall is an illegal no-op', () => {
  const s = make({
    id: 't', width: 3, height: 1, start: { x: 0, y: 0 },
    cells: [[Tile.START, Tile.WALL, Tile.EXIT]],
  });
  const r = resolve(s, Dir.RIGHT);
  assert(r.illegal, 'no legal move');
  eq(r.outcome, Outcome.NONE);
  eq(r.state.moveCount, 0);
});
