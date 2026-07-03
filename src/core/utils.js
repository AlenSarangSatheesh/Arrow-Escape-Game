/**
 * utils.js — Small, generic, side-effect-free helpers.
 *
 * Anything here that is imported by the pure engine (clamp, lerp, mod, deepFreeze)
 * must stay pure. Timer-based helpers (debounce, throttle, raf) are only used by
 * adapters.
 */

/* ----------------------------------------------------------------------- Math */

export const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);

export const lerp = (a, b, t) => a + (b - a) * t;

export const invLerp = (a, b, v) => (a === b ? 0 : (v - a) / (b - a));

export const approxEq = (a, b, eps = 1e-6) => Math.abs(a - b) < eps;

/** Always-positive modulo (unlike `%` for negative operands). */
export const mod = (n, m) => ((n % m) + m) % m;

/** Least common multiple of a list of positive integers (>= 1). */
export function lcmAll(nums) {
  const gcd = (a, b) => (b ? gcd(b, a % b) : a);
  return nums.reduce((acc, n) => (n > 0 ? (acc * n) / gcd(acc, n) : acc), 1);
}

/* --------------------------------------------------------------- Formatting */

/** Format milliseconds as `M:SS` (or `H:MM:SS` past an hour). */
export function formatTime(ms) {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const s = totalSec % 60;
  const m = Math.floor(totalSec / 60) % 60;
  const h = Math.floor(totalSec / 3600);
  const pad = (n) => String(n).padStart(2, '0');
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}

/* ----------------------------------------------------------------- Objects */

/** Recursively freeze an object graph (shallow-cycle-safe). */
export function deepFreeze(obj) {
  if (obj && typeof obj === 'object' && !Object.isFrozen(obj)) {
    Object.freeze(obj);
    for (const key of Object.keys(obj)) deepFreeze(obj[key]);
  }
  return obj;
}

/** Structured deep clone with a JSON fallback for older runtimes. */
export function deepClone(obj) {
  if (typeof structuredClone === 'function') return structuredClone(obj);
  return JSON.parse(JSON.stringify(obj));
}

/** Monotonic-ish unique id generator (per session). */
let _uidCounter = 0;
export const uid = (prefix = 'id') => `${prefix}_${(_uidCounter++).toString(36)}`;

/* -------------------------------------------------------- Timing (adapters) */

/** Debounce: fire `fn` after `wait` ms of quiet. */
export function debounce(fn, wait = 200) {
  let timer = null;
  const debounced = (...args) => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      fn(...args);
    }, wait);
  };
  debounced.cancel = () => timer && clearTimeout(timer);
  return debounced;
}

/** Throttle: fire `fn` at most once per `wait` ms (leading edge). */
export function throttle(fn, wait = 100) {
  let last = 0;
  let timer = null;
  return (...args) => {
    const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
    const remaining = wait - (now - last);
    if (remaining <= 0) {
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
      last = now;
      fn(...args);
    } else if (!timer) {
      timer = setTimeout(() => {
        last = typeof performance !== 'undefined' ? performance.now() : Date.now();
        timer = null;
        fn(...args);
      }, remaining);
    }
  };
}
