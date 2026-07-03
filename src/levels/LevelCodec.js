/**
 * LevelCodec.js — Compact, shareable level codes.
 *
 * Encodes a level definition as a URL-safe base64 string prefixed with a version
 * tag and suffixed with a checksum. Decoding validates the version and checksum
 * and sanitizes every field, so an imported code can never inject unexpected
 * structure (it is JSON, never evaluated).
 */
import { Tile, TILE_COUNT, EntityType } from '../core/Constants.js';

const PREFIX = 'AE1';
const VALID_ENTITY_TYPES = new Set(Object.values(EntityType));

/* ----------------------------------------------------------- base64url utils */

function toBase64Url(str) {
  const b64 = btoa(unescape(encodeURIComponent(str)));
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(b64url) {
  const b64 = b64url.replace(/-/g, '+').replace(/_/g, '/');
  const pad = b64.length % 4 ? '='.repeat(4 - (b64.length % 4)) : '';
  return decodeURIComponent(escape(atob(b64 + pad)));
}

/** FNV-1a 32-bit checksum, base36-encoded. */
function checksum(str) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(36);
}

/* ----------------------------------------------------------------- encoding */

/**
 * Encode a level definition to a share code.
 * @param {Object} def  a def with width/height/types/params/start/entities
 * @returns {string}
 */
export function encodeLevel(def) {
  const payload = {
    v: 1,
    n: (def.name || 'Custom Level').slice(0, 60),
    w: def.width,
    h: def.height,
    o: def.openEdges ? 1 : 0,
    s: [def.start.x, def.start.y],
    t: Array.from(def.types || []),
    p: Array.from(def.params || []),
    e: (def.entities || []).map((e) => ({ ...e })),
  };
  const json = JSON.stringify(payload);
  return `${PREFIX}.${toBase64Url(json)}.${checksum(json)}`;
}

/* ----------------------------------------------------------------- decoding */

/**
 * Decode and validate a share code into a level definition.
 * @param {string} code
 * @returns {Object} a def suitable for createLevel
 * @throws {Error} on malformed, wrong-version, or corrupt codes
 */
export function decodeLevel(code) {
  const parts = String(code).trim().split('.');
  if (parts.length !== 3 || parts[0] !== PREFIX) {
    throw new Error('Not a valid Arrow Escape level code.');
  }
  const json = fromBase64Url(parts[1]);
  if (checksum(json) !== parts[2]) throw new Error('Level code is corrupt (checksum mismatch).');

  const data = JSON.parse(json);
  const w = clampInt(data.w, 1, 40);
  const h = clampInt(data.h, 1, 40);
  const size = w * h;

  const types = new Uint8Array(size);
  const params = new Uint8Array(size);
  const srcT = Array.isArray(data.t) ? data.t : [];
  const srcP = Array.isArray(data.p) ? data.p : [];
  for (let i = 0; i < size; i++) {
    const t = srcT[i] | 0;
    types[i] = t >= 0 && t < TILE_COUNT ? t : Tile.FLOOR;
    params[i] = clampInt(srcP[i] || 0, 0, 255);
  }

  const entities = (Array.isArray(data.e) ? data.e : [])
    .filter((e) => e && VALID_ENTITY_TYPES.has(e.type))
    .map((e) => ({ ...e, x: clampInt(e.x, 0, w - 1), y: clampInt(e.y, 0, h - 1) }));

  const sx = clampInt(data.s?.[0], 0, w - 1);
  const sy = clampInt(data.s?.[1], 0, h - 1);

  return {
    id: `custom-${checksum(json)}`,
    name: typeof data.n === 'string' ? data.n.slice(0, 60) : 'Custom Level',
    difficulty: 'custom',
    world: -1,
    width: w,
    height: h,
    openEdges: !!data.o,
    types,
    params,
    start: { x: sx, y: sy },
    entities,
  };
}

function clampInt(v, lo, hi) {
  const n = Math.round(Number(v) || 0);
  return Math.max(lo, Math.min(hi, n));
}
