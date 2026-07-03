/**
 * index.js — The campaign: an ordered list of level packs (worlds).
 *
 * Additional packs are appended here as they are authored. `LevelRepository`
 * consumes this to build the campaign, compute progression gating, and index
 * levels by id.
 */
import { tutorialPack } from './packs/tutorial.js';

/**
 * @typedef {Object} Pack
 * @property {string} id
 * @property {string} name
 * @property {number} world
 * @property {Array<Object>} levels  raw level definitions
 */

/** @type {Pack[]} */
export const ALL_PACKS = [
  { id: 'tutorial', name: 'Tutorial', world: 0, levels: tutorialPack },
];

/** Every raw level definition, flattened in campaign order. */
export function allLevelDefs() {
  return ALL_PACKS.flatMap((p) => p.levels);
}
