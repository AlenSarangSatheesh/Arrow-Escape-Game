/**
 * Achievements.js — Evaluates and persists achievement unlocks.
 *
 * Call `evaluate(ctx)` after meaningful events (a win, mode change). Newly
 * satisfied achievements are unlocked, saved, and announced via
 * `ACHIEVEMENT_UNLOCKED` so the UI can pop a toast.
 */
import { SaveKeys } from './SaveManager.js';
import { Events } from '../core/EventBus.js';
import { ACHIEVEMENTS } from '../config/achievements.js';

export class Achievements {
  constructor({ save, bus }) {
    this.save = save;
    this.bus = bus;
    this.unlocked = new Set(save.get(SaveKeys.ACHIEVEMENTS) || []);
  }

  isUnlocked(id) {
    return this.unlocked.has(id);
  }

  /**
   * Evaluate all achievements against `ctx`. Returns the list of newly unlocked
   * definitions (also emitted individually on the bus).
   */
  evaluate(ctx) {
    const newly = [];
    for (const def of ACHIEVEMENTS) {
      if (this.unlocked.has(def.id)) continue;
      let ok = false;
      try {
        ok = !!def.condition(ctx);
      } catch {
        ok = false;
      }
      if (ok) {
        this.unlocked.add(def.id);
        newly.push(def);
      }
    }
    if (newly.length) {
      this._persist();
      for (const def of newly) this.bus?.emit(Events.ACHIEVEMENT_UNLOCKED, def);
    }
    return newly;
  }

  /** All achievements annotated with their unlocked state, for the UI. */
  list() {
    return ACHIEVEMENTS.map((def) => ({ ...def, unlocked: this.unlocked.has(def.id) }));
  }

  get count() {
    return this.unlocked.size;
  }

  get total() {
    return ACHIEVEMENTS.length;
  }

  _persist() {
    this.save.set(SaveKeys.ACHIEVEMENTS, [...this.unlocked]);
  }

  reset() {
    this.unlocked.clear();
    this._persist();
  }
}
