/**
 * LevelModel.js — Normalize an authored level definition into an efficient,
 * indexed runtime model consumed by the simulation, renderer, and editor.
 *
 * Authored levels may be terse and human-friendly; this module turns them into
 * typed-array terrain plus pre-indexed entity lookups. It is pure (no DOM).
 */
import { Tile, EntityType } from '../core/Constants.js';
import { cellIndex } from '../core/Grid.js';
import { lcmAll } from '../core/utils.js';

/**
 * @typedef {Object} Entity  A relational board object placed on a cell.
 * @property {string} type   one of EntityType
 * @property {number} x
 * @property {number} y
 * // plus type-specific fields (channel, id, targets, color, dir, group, ...)
 */

/**
 * @typedef {Object} RuntimeLevel
 * @property {string} id
 * @property {number} width
 * @property {number} height
 * @property {boolean} openEdges
 * @property {Uint8Array} types
 * @property {Uint8Array} params
 * @property {{x:number,y:number}} start
 * @property {Entity[]} entities
 * @property {Object} index      pre-built lookups (see build below)
 * @property {number} period     step period for cyclic mechanics (>=1)
 */

/** Read a cell entry that may be an int, `[t,p]`, or `{t,p}`. */
function readCell(entry) {
  if (entry == null) return { t: Tile.FLOOR, p: 0 };
  if (typeof entry === 'number') return { t: entry, p: 0 };
  if (Array.isArray(entry)) return { t: entry[0] | 0, p: entry[1] | 0 };
  return { t: entry.t | 0, p: entry.p | 0 };
}

/**
 * Normalize a raw level definition.
 * @param {Object} def
 * @returns {RuntimeLevel}
 */
export function createLevel(def) {
  const width = def.width | 0;
  const height = def.height | 0;
  if (width <= 0 || height <= 0) {
    throw new Error(`Level "${def.id}" has invalid dimensions ${width}x${height}`);
  }
  const size = width * height;
  const types = new Uint8Array(size);
  const params = new Uint8Array(size);

  // Terrain: prefer explicit typed arrays; otherwise build from a 2D `cells` grid.
  if (def.types && def.params) {
    types.set(def.types);
    params.set(def.params);
  } else if (def.cells) {
    for (let y = 0; y < height; y++) {
      const row = def.cells[y] || [];
      for (let x = 0; x < width; x++) {
        const { t, p } = readCell(row[x]);
        const i = cellIndex(x, y, width);
        types[i] = t;
        params[i] = p;
      }
    }
  }
  // else: an all-floor board (valid; entities/start may still be set).

  // Locate start: explicit def.start wins, else the first START tile, else (0,0).
  let start = def.start ? { x: def.start.x | 0, y: def.start.y | 0 } : null;
  if (!start) {
    for (let i = 0; i < size && !start; i++) {
      if (types[i] === Tile.START) start = { x: i % width, y: (i / width) | 0 };
    }
  }
  if (!start) start = { x: 0, y: 0 };

  const entities = (def.entities || []).map((e) => ({ ...e, x: e.x | 0, y: e.y | 0 }));

  const level = {
    id: def.id || 'untitled',
    name: def.name || def.id || 'Untitled',
    world: def.world ?? 0,
    index: def.index ?? 0,
    difficulty: def.difficulty || 'easy',
    author: def.author || '',
    version: def.version ?? 1,
    width,
    height,
    openEdges: !!def.openEdges,
    types,
    params,
    start,
    entities,
    par: def.par ?? 0,
    optimalMoves: def.optimalMoves ?? null,
    hintsAllowed: def.hintsAllowed ?? true,
    mechanics: def.mechanics || [],
    tags: def.tags || [],
    themeHint: def.themeHint || null,
    groupsInit: def.groups ? { ...def.groups } : {},
  };

  level.lookup = buildIndex(level);
  level.period = computePeriod(level);
  return level;
}

/** Build fast lookups from the entity list. */
function buildIndex(level) {
  const byCell = new Map(); // cellIndex -> Entity[]
  const portals = new Map(); // channel -> [{x,y}]
  const switches = new Map(); // id -> Entity
  const togglesByGroup = new Map(); // group -> Entity[]
  const lasers = [];
  const movingWalls = [];
  const timedWalls = [];
  const charges = [];
  const gems = [];
  const emitterCells = new Set();

  for (const e of level.entities) {
    const i = cellIndex(e.x, e.y, level.width);
    if (!byCell.has(i)) byCell.set(i, []);
    byCell.get(i).push(e);

    switch (e.type) {
      case EntityType.PORTAL: {
        const ch = e.channel ?? 0;
        if (!portals.has(ch)) portals.set(ch, []);
        portals.get(ch).push({ x: e.x, y: e.y });
        break;
      }
      case EntityType.SWITCH:
        switches.set(e.id ?? `${e.x},${e.y}`, e);
        break;
      case EntityType.TOGGLE: {
        const g = e.group ?? 0;
        if (!togglesByGroup.has(g)) togglesByGroup.set(g, []);
        togglesByGroup.get(g).push(e);
        break;
      }
      case EntityType.LASER:
        lasers.push(e);
        emitterCells.add(i);
        break;
      case EntityType.MWALL:
        movingWalls.push(e);
        break;
      case EntityType.TWALL:
        timedWalls.push(e);
        break;
      case EntityType.CHARGE:
        charges.push(e);
        break;
      case EntityType.GEM:
        gems.push({ id: e.id ?? `gem_${gems.length}`, x: e.x, y: e.y });
        break;
      default:
        break;
    }
  }

  const exits = [];
  for (let i = 0; i < level.types.length; i++) {
    if (level.types[i] === Tile.EXIT) exits.push({ x: i % level.width, y: (i / level.width) | 0 });
  }

  return {
    byCell,
    portals,
    switches,
    togglesByGroup,
    lasers,
    movingWalls,
    timedWalls,
    charges,
    gems,
    emitterCells,
    exits,
    gemCount: gems.length,
  };
}

/** Least common multiple of every cyclic mechanic's period (for phase hashing). */
function computePeriod(level) {
  const periods = [];
  for (const w of level.lookup?.movingWalls || level.entities.filter((e) => e.type === EntityType.MWALL)) {
    const span = Math.max(1, (w.to ?? 0) - (w.from ?? 0));
    periods.push(2 * span); // ping-pong period
  }
  for (const d of level.lookup?.timedWalls || level.entities.filter((e) => e.type === EntityType.TWALL)) {
    periods.push(Math.max(1, d.period ?? 2));
  }
  return periods.length ? lcmAll(periods) : 1;
}

/** Return the paired portal cell for a portal at (x,y), or null. */
export function portalPartner(level, x, y) {
  for (const cells of level.lookup.portals.values()) {
    if (cells.length < 2) continue;
    const idx = cells.findIndex((c) => c.x === x && c.y === y);
    if (idx !== -1) return cells[(idx + 1) % cells.length];
  }
  return null;
}

/** Entities on a given cell (never null). */
export function entitiesAt(level, x, y) {
  return level.lookup.byCell.get(cellIndex(x, y, level.width)) || EMPTY;
}
const EMPTY = Object.freeze([]);
