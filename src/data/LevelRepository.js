/**
 * LevelRepository.js — The single source for levels and progression.
 *
 * Builds the campaign from the level packs, caches compiled runtime levels,
 * tracks per-level bests, computes unlock gating, and vends generated
 * Daily/Endless levels and player-authored custom levels.
 */
import { ALL_PACKS } from '../levels/index.js';
import { createLevel } from '../engine/LevelModel.js';
import { SaveKeys } from './SaveManager.js';
import { generate, generateDaily } from '../ai/Generator.js';

export class LevelRepository {
  constructor({ save }) {
    this.save = save;
    this.progress = save.get(SaveKeys.PROGRESS) || {};
    this.custom = save.get(SaveKeys.CUSTOM) || [];
    this._cache = new Map();
    this._defs = new Map();

    this.worlds = ALL_PACKS.map((p) => ({
      id: p.id,
      name: p.name,
      world: p.world,
      levelIds: p.levels.map((l) => l.id),
    }));
    for (const p of ALL_PACKS) for (const def of p.levels) this._defs.set(def.id, def);
    for (const def of this.custom) this._defs.set(def.id, def);
  }

  /* --------------------------------------------------------------- lookups */

  getDef(id) {
    return this._defs.get(id) || null;
  }

  getLevel(id) {
    if (this._cache.has(id)) return this._cache.get(id);
    const def = this._defs.get(id);
    if (!def) return null;
    const level = createLevel(def);
    this._cache.set(id, level);
    return level;
  }

  buildFromDef(def) {
    return createLevel(def);
  }

  /** Flat list of campaign level ids in play order. */
  orderedIds() {
    return this.worlds.flatMap((w) => w.levelIds);
  }

  nextLevelId(id) {
    const ids = this.orderedIds();
    const i = ids.indexOf(id);
    return i >= 0 && i + 1 < ids.length ? ids[i + 1] : null;
  }

  firstPlayableId() {
    for (const w of this.campaign()) {
      for (const l of w.levels) if (l.unlocked && !l.completed) return l.id;
    }
    return this.orderedIds()[0] || null;
  }

  /* -------------------------------------------------------------- progress */

  progressFor(id) {
    return this.progress[id] || null;
  }

  isCompleted(id) {
    return !!this.progress[id]?.completed;
  }

  starsFor(id) {
    return this.progress[id]?.stars || 0;
  }

  recordResult(id, { stars, moves, timeMs, score }) {
    const prev = this.progress[id] || {
      completed: false, stars: 0, bestMoves: Infinity, bestTimeMs: Infinity, bestScore: 0, plays: 0,
    };
    this.progress[id] = {
      completed: true,
      stars: Math.max(prev.stars, stars),
      bestMoves: Math.min(prev.bestMoves, moves),
      bestTimeMs: Math.min(prev.bestTimeMs, timeMs || Infinity),
      bestScore: Math.max(prev.bestScore, score || 0),
      plays: (prev.plays || 0) + 1,
    };
    this.save.set(SaveKeys.PROGRESS, this.progress);
    return { firstClear: !prev.completed, improvedStars: stars > prev.stars };
  }

  totalStars() {
    let s = 0;
    for (const id of Object.keys(this.progress)) s += this.progress[id].stars || 0;
    return s;
  }

  maxStars() {
    return this.orderedIds().length * 3;
  }

  /* ------------------------------------------------------- unlock gating */

  worldCompletedCount(wi) {
    const w = this.worlds[wi];
    return w ? w.levelIds.filter((id) => this.isCompleted(id)).length : 0;
  }

  worldUnlocked(wi) {
    if (wi <= 0) return true;
    const prev = this.worlds[wi - 1];
    return this.worldCompletedCount(wi - 1) >= Math.ceil(prev.levelIds.length * 0.5);
  }

  levelUnlocked(wi, li) {
    if (!this.worldUnlocked(wi)) return false;
    if (li === 0) return true;
    return this.isCompleted(this.worlds[wi].levelIds[li - 1]);
  }

  /** The campaign as worlds → levels, annotated with unlock/complete/stars. */
  campaign() {
    return this.worlds.map((w, wi) => ({
      id: w.id,
      name: w.name,
      world: w.world,
      unlocked: this.worldUnlocked(wi),
      stars: w.levelIds.reduce((s, id) => s + this.starsFor(id), 0),
      maxStars: w.levelIds.length * 3,
      levels: w.levelIds.map((id, li) => {
        const def = this._defs.get(id);
        return {
          id,
          name: def?.name || id,
          index: li,
          difficulty: def?.difficulty,
          unlocked: this.levelUnlocked(wi, li),
          completed: this.isCompleted(id),
          stars: this.starsFor(id),
        };
      }),
    }));
  }

  /* --------------------------------------------------- custom & generated */

  registerCustom(def) {
    const i = this.custom.findIndex((l) => l.id === def.id);
    if (i >= 0) this.custom[i] = def;
    else this.custom.push(def);
    this._defs.set(def.id, def);
    this._cache.delete(def.id);
    this.save.set(SaveKeys.CUSTOM, this.custom);
  }

  deleteCustom(id) {
    this.custom = this.custom.filter((l) => l.id !== id);
    this._defs.delete(id);
    this._cache.delete(id);
    this.save.set(SaveKeys.CUSTOM, this.custom);
  }

  listCustom() {
    return this.custom.slice();
  }

  daily(dateStr) {
    const res = generateDaily(dateStr);
    if (!res) return null;
    this._cache.set(res.level.id, res.level);
    return res.level;
  }

  endless(difficulty, seed) {
    const res = generate({ seed, difficulty });
    if (!res) return null;
    this._cache.set(res.level.id, res.level);
    return res.level;
  }
}
