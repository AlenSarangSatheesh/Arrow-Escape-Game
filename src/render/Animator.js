/**
 * Animator.js — Easing functions and a tiny time-based tween manager.
 *
 * The renderer uses these for the token's motion along a slide path and for HUD
 * flourishes. All easings take and return a normalized `t` in [0, 1].
 */
export const clamp01 = (t) => (t < 0 ? 0 : t > 1 ? 1 : t);

export const Easing = Object.freeze({
  linear: (t) => t,
  outQuad: (t) => 1 - (1 - t) * (1 - t),
  inOutQuad: (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2),
  outCubic: (t) => 1 - Math.pow(1 - t, 3),
  inOutCubic: (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
  outBack: (t) => {
    const c1 = 1.70158;
    const c3 = c1 + 1;
    return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
  },
  outElastic: (t) => {
    if (t === 0 || t === 1) return t;
    const c4 = (2 * Math.PI) / 3;
    return Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * c4) + 1;
  },
});

/**
 * A minimal tween manager. Register value tweens; call `update(now)` each frame.
 * Chiefly used for small UI/HUD effects; the slide animation is handled inline
 * by the renderer for tighter control.
 */
export class Tweener {
  constructor() {
    this._tweens = [];
  }

  add({ duration = 300, ease = Easing.outCubic, onUpdate, onComplete, delay = 0 }) {
    const tween = { duration, ease, onUpdate, onComplete, delay, elapsed: 0, done: false };
    this._tweens.push(tween);
    return tween;
  }

  update(dtMs) {
    for (const tw of this._tweens) {
      if (tw.done) continue;
      tw.elapsed += dtMs;
      if (tw.elapsed < tw.delay) continue;
      const t = clamp01((tw.elapsed - tw.delay) / tw.duration);
      tw.onUpdate?.(tw.ease(t), t);
      if (t >= 1) {
        tw.done = true;
        tw.onComplete?.();
      }
    }
    if (this._tweens.some((t) => t.done)) {
      this._tweens = this._tweens.filter((t) => !t.done);
    }
  }

  get active() {
    return this._tweens.length > 0;
  }

  clear() {
    this._tweens.length = 0;
  }
}
