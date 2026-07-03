/**
 * index.js — The campaign: an ordered list of level packs (worlds).
 *
 * Each world past the tutorial combines a small set of handcrafted "signature"
 * levels (which introduce that world's mechanic) with a larger set of curated,
 * solver-verified generated levels. `LevelRepository` consumes this to build the
 * campaign, gate progression, and index levels by id.
 */
import { tutorialPack } from './packs/tutorial.js';
import { SIGNATURE_PACKS } from './packs/signature.js';
import { easyGenerated } from './generated/easy.js';
import { mediumGenerated } from './generated/medium.js';
import { hardGenerated } from './generated/hard.js';
import { expertGenerated } from './generated/expert.js';
import { masterGenerated } from './generated/master.js';

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
  { id: 'easy', name: 'Meadow', world: 1, levels: [...SIGNATURE_PACKS.easy, ...easyGenerated] },
  { id: 'medium', name: 'Crossroads', world: 2, levels: [...SIGNATURE_PACKS.medium, ...mediumGenerated] },
  { id: 'hard', name: 'Foundry', world: 3, levels: [...SIGNATURE_PACKS.hard, ...hardGenerated] },
  { id: 'expert', name: 'Observatory', world: 4, levels: [...SIGNATURE_PACKS.expert, ...expertGenerated] },
  { id: 'master', name: 'Labyrinth', world: 5, levels: [...SIGNATURE_PACKS.master, ...masterGenerated] },
];

/** Every raw level definition, flattened in campaign order. */
export function allLevelDefs() {
  return ALL_PACKS.flatMap((p) => p.levels);
}

/** Total level count across all worlds. */
export function levelCount() {
  return ALL_PACKS.reduce((n, p) => n + p.levels.length, 0);
}
