/**
 * EventBus.js — Minimal, dependency-free publish/subscribe.
 *
 * The bus is the decoupling seam between systems: the game controller emits
 * intents and state changes, and adapters (render, audio, UI) subscribe. No
 * module reaches into another's internals. This also makes future features
 * (analytics, leaderboards, telemetry) additive rather than invasive.
 */
export class EventBus {
  constructor() {
    /** @type {Map<string, Set<Function>>} */
    this._listeners = new Map();
  }

  /**
   * Subscribe to an event.
   * @param {string} event
   * @param {(payload:*) => void} handler
   * @returns {() => void} an unsubscribe function
   */
  on(event, handler) {
    let set = this._listeners.get(event);
    if (!set) {
      set = new Set();
      this._listeners.set(event, set);
    }
    set.add(handler);
    return () => this.off(event, handler);
  }

  /** Subscribe for a single invocation. */
  once(event, handler) {
    const off = this.on(event, (payload) => {
      off();
      handler(payload);
    });
    return off;
  }

  /** Remove a specific handler. */
  off(event, handler) {
    const set = this._listeners.get(event);
    if (set) {
      set.delete(handler);
      if (set.size === 0) this._listeners.delete(event);
    }
  }

  /**
   * Emit an event to all subscribers. Handler errors are isolated so one bad
   * listener cannot break the others or the emitter.
   * @param {string} event
   * @param {*} [payload]
   */
  emit(event, payload) {
    const set = this._listeners.get(event);
    if (!set) return;
    // Copy to a temp array so handlers may safely unsubscribe during dispatch.
    for (const handler of [...set]) {
      try {
        handler(payload);
      } catch (err) {
        console.error(`[EventBus] listener for "${event}" threw:`, err);
      }
    }
  }

  /** Remove every listener (used on teardown). */
  clear() {
    this._listeners.clear();
  }
}

/** Canonical event names, centralized to avoid typos across modules. */
export const Events = Object.freeze({
  // Session lifecycle
  LEVEL_LOADED: 'level:loaded',
  LEVEL_RESET: 'level:reset',
  // Moves
  MOVE_APPLIED: 'move:applied', // { from, to, path, outcome, state }
  MOVE_ILLEGAL: 'move:illegal', // { dir, reason }
  MOVE_UNDONE: 'move:undone',
  STATUS: 'session:status', // { moves, par, optimal, timeMs, ... } — HUD updates
  // Pickups / state
  GEM_COLLECTED: 'gem:collected',
  KEY_COLLECTED: 'key:collected',
  SWITCH_TOGGLED: 'switch:toggled',
  // Win / lose
  LEVEL_WON: 'level:won', // { stars, moves, time, score }
  LEVEL_FAILED: 'level:failed', // { reason }
  // Meta
  HINT_SHOWN: 'hint:shown',
  ACHIEVEMENT_UNLOCKED: 'achievement:unlocked',
  SETTINGS_CHANGED: 'settings:changed',
  SCREEN_CHANGED: 'screen:changed',
});
