/**
 * SaveManager.js — Namespaced, versioned localStorage wrapper.
 *
 * All persistence flows through here so quota errors, private-mode failures, and
 * schema versioning are handled in one place. Every value is JSON; every read is
 * defensive (a corrupt or missing entry yields the fallback rather than throwing).
 */
import { SAVE_NAMESPACE, SAVE_VERSION } from '../core/Constants.js';

export const SaveKeys = Object.freeze({
  SETTINGS: 'settings',
  PROGRESS: 'progress',
  UNLOCKS: 'unlocks',
  ACHIEVEMENTS: 'achievements',
  STATISTICS: 'statistics',
  CUSTOM: 'customLevels',
  DAILY: 'daily',
});

export class SaveManager {
  constructor(namespace = SAVE_NAMESPACE) {
    this.ns = namespace;
    this._ok = this._probe();
  }

  _probe() {
    try {
      const k = `${this.ns}.__probe__`;
      localStorage.setItem(k, '1');
      localStorage.removeItem(k);
      return true;
    } catch {
      return false;
    }
  }

  get available() {
    return this._ok;
  }

  _key(k) {
    return `${this.ns}.${k}`;
  }

  get(key, fallback = null) {
    if (!this._ok) return fallback;
    try {
      const raw = localStorage.getItem(this._key(key));
      return raw == null ? fallback : JSON.parse(raw);
    } catch {
      return fallback;
    }
  }

  set(key, value) {
    if (!this._ok) return false;
    try {
      localStorage.setItem(this._key(key), JSON.stringify(value));
      return true;
    } catch (err) {
      console.warn(`[save] failed to write "${key}":`, err);
      return false;
    }
  }

  remove(key) {
    if (!this._ok) return;
    try {
      localStorage.removeItem(this._key(key));
    } catch {
      /* ignore */
    }
  }

  /** Serialize the entire profile to a JSON string for backup/transfer. */
  exportProfile() {
    const out = { app: 'arrow-escape', version: SAVE_VERSION };
    for (const k of Object.values(SaveKeys)) out[k] = this.get(k, null);
    return JSON.stringify(out);
  }

  /** Restore a profile from `exportProfile` output. Validates loosely. */
  importProfile(json) {
    const data = typeof json === 'string' ? JSON.parse(json) : json;
    if (!data || typeof data !== 'object') throw new Error('Invalid profile');
    for (const k of Object.values(SaveKeys)) {
      if (k in data && data[k] != null) this.set(k, data[k]);
    }
    return true;
  }

  clearAll() {
    for (const k of Object.values(SaveKeys)) this.remove(k);
  }
}
