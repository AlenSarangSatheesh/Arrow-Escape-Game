/**
 * Settings.js — Player preferences with sensible defaults and persistence.
 *
 * Emits `SETTINGS_CHANGED` so adapters (renderer reduced-motion, audio volumes,
 * theme class on <html>) react without polling.
 */
import { SaveKeys } from './SaveManager.js';
import { DEFAULT_THEME } from '../config/themes.js';
import { Events } from '../core/EventBus.js';

export const DEFAULT_SETTINGS = Object.freeze({
  theme: DEFAULT_THEME,
  reducedMotion: 'auto', // 'auto' | 'on' | 'off'
  sound: true,
  sfxVolume: 0.9,
  musicVolume: 0.4,
  music: false,
  colorblind: 'none', // 'none' | 'deuter' | 'prot' | 'trit' | 'high'
  highContrast: false,
  haptics: true,
  showTimer: true,
  confirmReset: false,
});

export class Settings {
  constructor({ save, bus }) {
    this.save = save;
    this.bus = bus;
    this.values = { ...DEFAULT_SETTINGS, ...(save.get(SaveKeys.SETTINGS) || {}) };
  }

  get(key) {
    return this.values[key];
  }

  all() {
    return { ...this.values };
  }

  set(key, value) {
    this.values[key] = value;
    this._persist();
    this.bus?.emit(Events.SETTINGS_CHANGED, { key, value, settings: this.all() });
  }

  update(partial) {
    Object.assign(this.values, partial);
    this._persist();
    this.bus?.emit(Events.SETTINGS_CHANGED, { settings: this.all() });
  }

  reset() {
    this.values = { ...DEFAULT_SETTINGS };
    this._persist();
    this.bus?.emit(Events.SETTINGS_CHANGED, { settings: this.all() });
  }

  _persist() {
    this.save.set(SaveKeys.SETTINGS, this.values);
  }

  /** Resolve the effective reduced-motion state (respecting the OS setting). */
  reducedMotionActive() {
    const mode = this.values.reducedMotion;
    if (mode === 'on') return true;
    if (mode === 'off') return false;
    return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  }
}
