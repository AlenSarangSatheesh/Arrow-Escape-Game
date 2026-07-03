/**
 * Simulation.js — The deterministic rules of Arrow Escape.
 *
 * `resolve(state, dir)` takes a rest-state and a launch direction and returns the
 * next rest-state (or a win/fail), along with the full tile path the token
 * travelled. It is the single authority on movement — every other system
 * (controller, solver, generator, hint engine, replay) calls into it.
 *
 * Guarantees:
 *  - Pure: no DOM, no timers, no `Math.random`. Same input → same output.
 *  - Terminating: cycle detection + a hard step guard prevent infinite slides.
 *  - Total: illegal launches return `{ illegal:true }` and never mutate input.
 *
 * The board "phase" (for moving walls, timed doors, and lasers) is fixed at the
 * current move index for the whole slide, so the world only changes *between*
 * moves — this keeps each move deterministic and the solver sound.
 */
import {
  Dir,
  DIR_VECTORS,
  ALL_DIRS,
  Tile,
  EntityType,
  Outcome,
  Status,
  opposite,
  reflect,
  rotateCW,
} from '../core/Constants.js';
import { portalPartner } from './LevelModel.js';

const DX = DIR_VECTORS.map((v) => v.x);
const DY = DIR_VECTORS.map((v) => v.y);

/* --------------------------------------------------- Cyclic-mechanic geometry */

/** Ping-pong an integer `t` back and forth across [from, to]. */
function pingPong(t, from, to) {
  const span = to - from;
  if (span <= 0) return from;
  const period = 2 * span;
  const m = ((t % period) + period) % period;
  return from + (m <= span ? m : period - m);
}

/** Cell currently occupied by a moving wall at the given phase. */
function movingWallCell(w, phase) {
  const pos = pingPong(phase + (w.phase || 0), w.from ?? 0, w.to ?? 0);
  return w.axis === 1 ? { x: w.line, y: pos } : { x: pos, y: w.line };
}

/** Is a timed door closed (solid) at the given phase? */
function timedWallClosed(d, phase) {
  const period = Math.max(1, d.period ?? 2);
  const openFor = d.openFor ?? (Math.floor(period / 2) || 1);
  return ((phase + (d.phase || 0)) % period) >= openFor;
}

/* ------------------------------------------------------------ Group / toggles */

const groupActive = (state, group) => state.groups.get(group) ?? false;

/** A toggle is "active" when its group is active, unless inverted. */
const toggleActive = (state, e) => groupActive(state, e.group ?? 0) !== !!e.invert;

/** A laser is emitting unless gated off by an inactive (or inverted) group. */
function laserActive(state, laser) {
  if (laser.group == null) return laser.on !== false;
  return groupActive(state, laser.group) !== !!laser.invert;
}

/* -------------------------------------------------------------- Cell queries */

function entityAt(level, x, y, type) {
  const list = level.lookup.byCell.get(y * level.width + x);
  if (!list) return null;
  for (const e of list) if (e.type === type) return e;
  return null;
}

/** Is this void cell currently covered by an active bridge? */
function isBridged(level, state, x, y) {
  const list = level.lookup.byCell.get(y * level.width + x);
  if (!list) return false;
  for (const e of list) {
    if (e.type === EntityType.TOGGLE && e.mode === 'bridge' && toggleActive(state, e)) return true;
  }
  return false;
}

/** Is a moving wall occupying this cell at the given phase? */
function movingWallAt(level, state, x, y, phase) {
  for (const w of level.lookup.movingWalls) {
    const c = movingWallCell(w, phase);
    if (c.x === x && c.y === y) return true;
  }
  return false;
}

/**
 * Can a token travelling `dir` enter cell (x,y)? Considers static terrain gates
 * plus dynamic blockers (toggle walls, moving walls, timed doors, laser emitters).
 * Assumes (x,y) is in bounds.
 */
function cellBlocksEntry(level, state, x, y, dir, phase) {
  const i = y * level.width + x;
  const t = level.types[i];
  if (t === Tile.WALL) return true;
  if (t === Tile.ONEWAY && level.params[i] !== dir) return true;
  if (t === Tile.LOCK && !state.keys.has(level.params[i])) return true;
  if (t === Tile.COLOR_GATE && state.carriedColor !== level.params[i]) return true;

  const list = level.lookup.byCell.get(i);
  if (list) {
    for (const e of list) {
      if (e.type === EntityType.LASER) return true; // emitter body is solid
      if (e.type === EntityType.TOGGLE && e.mode === 'wall' && toggleActive(state, e)) return true;
      if (e.type === EntityType.TWALL && timedWallClosed(e, phase)) return true;
    }
  }
  if (level.lookup.movingWalls.length && movingWallAt(level, state, x, y, phase)) return true;
  return false;
}

/* --------------------------------------------------------------- Laser beams */

/** Compute the set of lethal cell indices for the current phase (once per slide). */
function computeLethalCells(level, state, phase) {
  const lasers = level.lookup.lasers;
  if (!lasers.length) return EMPTY_SET;
  const W = level.width;
  const H = level.height;
  const lethal = new Set();
  const guard = W * H * 4;
  for (const laser of lasers) {
    if (!laserActive(state, laser)) continue;
    let x = laser.x;
    let y = laser.y;
    let dir = laser.dir;
    let steps = 0;
    while (steps++ < guard) {
      x += DX[dir];
      y += DY[dir];
      if (x < 0 || y < 0 || x >= W || y >= H) break;
      const i = y * W + x;
      const t = level.types[i];
      if (t === Tile.WALL) break;
      if (level.lookup.emitterCells.has(i)) break;
      // Dynamic solids stop the beam.
      const list = level.lookup.byCell.get(i);
      let blocked = false;
      if (list) {
        for (const e of list) {
          if (e.type === EntityType.TOGGLE && e.mode === 'wall' && toggleActive(state, e)) blocked = true;
          if (e.type === EntityType.TWALL && timedWallClosed(e, phase)) blocked = true;
        }
      }
      if (blocked) break;
      if (level.lookup.movingWalls.length && movingWallAt(level, state, x, y, phase)) break;
      // Mirrors reflect the beam.
      if (t === Tile.MIRROR) {
        lethal.add(i);
        dir = reflect(dir, level.params[i]);
        continue;
      }
      lethal.add(i);
    }
  }
  return lethal;
}
const EMPTY_SET = new Set();

/* ---------------------------------------------------------- Entry side-effects */

/** Apply pickups and switch toggles as the token enters (x,y). Mutates `state`. */
function applyEntryEffects(state, level, x, y) {
  const list = level.lookup.byCell.get(y * level.width + x);
  if (!list) return;
  for (const e of list) {
    switch (e.type) {
      case EntityType.GEM:
        if (e.id != null) state.collected.add(e.id);
        else state.collected.add(`gem_${x},${y}`);
        break;
      case EntityType.KEY:
        state.keys.add(e.color ?? 0);
        break;
      case EntityType.PAINT:
        state.carriedColor = e.color ?? 0;
        break;
      case EntityType.SWITCH: {
        const targets = e.targets || [e.group ?? 0];
        for (const g of targets) state.groups.set(g, !groupActive(state, g));
        break;
      }
      default:
        break;
    }
  }
}

/** Increment a charge arrow; return its direction once armed, else null. */
function applyCharge(state, level, x, y) {
  const e = entityAt(level, x, y, EntityType.CHARGE);
  if (!e) return null;
  const i = y * level.width + x;
  const count = (state.charges.get(i) || 0) + 1;
  state.charges.set(i, count);
  return count >= (e.threshold ?? 2) ? e.dir : null;
}

/* ------------------------------------------------------------------- resolve */

/**
 * @typedef {Object} MoveResult
 * @property {string} outcome   one of Outcome
 * @property {import('./GameState.js').GameState} state  next state (or original if illegal)
 * @property {Array<{x:number,y:number,dir:number,teleport?:boolean}>} path
 * @property {boolean} [illegal]
 */

/**
 * Resolve a single launch from a rest-state.
 * @param {import('./GameState.js').GameState} state
 * @param {number} dir  a {@link Dir}
 * @returns {MoveResult}
 */
export function resolve(state, dir) {
  if (state.status !== Status.PLAYING) {
    return { outcome: Outcome.NONE, state, path: [], illegal: true };
  }
  const level = state.level;
  const W = level.width;
  const H = level.height;
  const s = state.clone();
  const phase = state.moveCount;
  const lethal = computeLethalCells(level, s, phase);

  let x = state.player.x;
  let y = state.player.y;
  let curDir = dir;
  const path = [{ x, y, dir: curDir }];
  const visited = new Set();
  const guard = W * H * 8 + 32;
  let steps = 0;
  let moved = false;
  let pendingRotate = null; // { i, usedDir }
  let iceSkid = false; // set by ICE; skids straight past the immediately-following redirect

  const illegal = (outcome) => ({ outcome, state, path, illegal: true });

  while (true) {
    if (++steps > guard) return illegal(Outcome.CYCLE);

    const nx = x + DX[curDir];
    const ny = y + DY[curDir];
    const offgrid = nx < 0 || ny < 0 || nx >= W || ny >= H;
    const blocked = !offgrid && cellBlocksEntry(level, s, nx, ny, curDir, phase);

    if (offgrid || blocked) {
      // Sliding off an open edge is a fall.
      if (offgrid && level.openEdges && !blocked) {
        moved = true;
        return finalizeFail(state, s, Outcome.FELL, path);
      }
      // Conveyor at the resting cell may carry the token onward.
      const here = y * W + x;
      if (level.types[here] === Tile.CONVEYOR) {
        const cd = level.params[here];
        const cx = x + DX[cd];
        const cy = y + DY[cd];
        const cOff = cx < 0 || cy < 0 || cx >= W || cy >= H;
        const cBlocked = !cOff && cellBlocksEntry(level, s, cx, cy, cd, phase);
        if ((!cOff && !cBlocked) || (cOff && level.openEdges)) {
          pendingRotate = null;
          curDir = cd;
          continue;
        }
      }
      pendingRotate = null;
      return finalizeStop(state, s, x, y, path, moved);
    }

    // Leaving the current cell — a pending rotating arrow now advances.
    if (pendingRotate) {
      s.rotations.set(pendingRotate.i, rotateCW(pendingRotate.usedDir));
      pendingRotate = null;
    }

    x = nx;
    y = ny;
    moved = true;

    // Process the entered cell; a chained teleport re-processes the destination.
    let justTeleported = false;
    while (true) {
      const key = `${x},${y},${curDir}`;
      if (visited.has(key)) return illegal(Outcome.CYCLE);
      visited.add(key);
      path.push({ x, y, dir: curDir, teleport: justTeleported });

      const i = y * W + x;
      if (lethal.has(i)) return finalizeFail(state, s, Outcome.DEAD, path);
      applyEntryEffects(s, level, x, y);

      const t = level.types[i];
      if (t === Tile.VOID && !isBridged(level, s, x, y)) {
        return finalizeFail(state, s, Outcome.FELL, path);
      }
      if (t === Tile.EXIT) return finalizeWin(state, s, x, y, path);
      if (t === Tile.STOP || t === Tile.FAKE_EXIT) {
        return finalizeStop(state, s, x, y, path, true);
      }

      if (!justTeleported) {
        const partner = portalPartner(level, x, y);
        if (partner) {
          x = partner.x;
          y = partner.y;
          justTeleported = true;
          continue; // re-process arrival cell
        }
      }
      justTeleported = false;

      // Redirects. ICE arms a "skid" that ignores the very next redirect tile.
      const isRedirect =
        t === Tile.ARROW || t === Tile.MIRROR || t === Tile.REVERSE || t === Tile.ROTATE;
      if (t === Tile.ICE) {
        iceSkid = true;
      } else if (isRedirect) {
        if (iceSkid) {
          iceSkid = false; // skid straight through this redirect
        } else if (t === Tile.ARROW) {
          curDir = level.params[i];
        } else if (t === Tile.MIRROR) {
          curDir = reflect(curDir, level.params[i]);
        } else if (t === Tile.REVERSE) {
          curDir = opposite(curDir);
        } else {
          // ROTATE: use the current orientation, advance it when we leave.
          const used = s.rotations.has(i) ? s.rotations.get(i) : level.params[i];
          curDir = used;
          pendingRotate = { i, usedDir: used };
        }
      } else {
        iceSkid = false;
        const charged = applyCharge(s, level, x, y);
        if (charged != null) curDir = charged;
      }
      break; // done processing; outer loop attempts the next step
    }
  }
}

/* ---------------------------------------------------------------- finalizers */

function finalizeStop(original, s, x, y, path, moved) {
  if (!moved) return { outcome: Outcome.NONE, state: original, path, illegal: true };
  s.player = { x, y };
  s.moveCount = original.moveCount + 1;
  s.status = Status.PLAYING;
  s.lastPath = path;
  s.lastOutcome = Outcome.STOP;
  return { outcome: Outcome.STOP, state: s, path };
}

function finalizeWin(original, s, x, y, path) {
  s.player = { x, y };
  s.moveCount = original.moveCount + 1;
  s.status = Status.WON;
  s.lastPath = path;
  s.lastOutcome = Outcome.WON;
  return { outcome: Outcome.WON, state: s, path };
}

function finalizeFail(original, s, outcome, path) {
  const last = path[path.length - 1];
  s.player = { x: last.x, y: last.y };
  s.moveCount = original.moveCount + 1;
  s.status = Status.FAILED;
  s.lastPath = path;
  s.lastOutcome = outcome;
  return { outcome, state: s, path };
}

/* ------------------------------------------------------------------ helpers */

/**
 * Enumerate the launch directions that produce a real move (stop, win, or fail),
 * with their resolved results. Used by the solver, hints, and input feedback.
 * @param {import('./GameState.js').GameState} state
 * @returns {Array<{dir:number, result:MoveResult}>}
 */
export function enumerateMoves(state) {
  const moves = [];
  for (const dir of ALL_DIRS) {
    const result = resolve(state, dir);
    if (!result.illegal && result.outcome !== Outcome.NONE && result.outcome !== Outcome.CYCLE) {
      moves.push({ dir, result });
    }
  }
  return moves;
}

/** Directions that lead to a non-failing continuation or a win (for the solver). */
export function successorMoves(state) {
  const out = [];
  for (const dir of ALL_DIRS) {
    const result = resolve(state, dir);
    if (result.illegal) continue;
    if (result.outcome === Outcome.STOP || result.outcome === Outcome.WON) {
      out.push({ dir, result });
    }
  }
  return out;
}

/**
 * Replay a sequence of launch directions from a fresh state of `level`.
 * @param {import('./LevelModel.js').RuntimeLevel} level
 * @param {number[]} dirs
 * @returns {{state:import('./GameState.js').GameState, outcomes:string[]}}
 */
export function replay(level, dirs, GameStateClass) {
  let state = GameStateClass.fromLevel(level);
  const outcomes = [];
  for (const d of dirs) {
    const r = resolve(state, d);
    outcomes.push(r.outcome);
    if (!r.illegal) state = r.state;
    if (state.status !== Status.PLAYING) break;
  }
  return { state, outcomes };
}
