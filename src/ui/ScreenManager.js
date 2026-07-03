/**
 * ScreenManager.js — Swaps full-screen views with a consistent transition.
 *
 * Screens are factory functions `(app, params) => { el, onEnter?, onExit?,
 * destroy? }`. The manager keeps a navigation stack so `back()` works, and calls
 * lifecycle hooks so screens can start/stop timers, renderers, and listeners.
 */
export class ScreenManager {
  constructor(root) {
    this.root = root;
    this.stack = [];
    this._transitioning = false;
  }

  get current() {
    return this.stack[this.stack.length - 1] || null;
  }

  /** Navigate to a new screen, optionally replacing the current one. */
  go(factory, app, params = {}, { replace = false, root = false } = {}) {
    const instance = factory(app, params);
    if (!instance || !instance.el) return null;
    instance.el.classList.add('screen');

    const previous = this.current;
    if (root) {
      this._clearAll();
    } else if (replace && previous) {
      this._exit(previous, true);
      this.stack.pop();
    }

    this.root.appendChild(instance.el);
    this.stack.push(instance);
    // Commit the pre-enter (hidden) state, then toggle to visible. Doing this
    // synchronously (rather than in requestAnimationFrame) keeps screens visible
    // even when rAF is throttled, e.g. in a background tab.
    void instance.el.offsetWidth;
    instance.el.classList.add('is-active');
    instance.onEnter?.();

    if (previous && !replace) previous.el.classList.remove('is-active');
    if (previous && !replace) previous.onExit?.();
    return instance;
  }

  /** Pop back to the previous screen. */
  back(app) {
    if (this.stack.length <= 1) return;
    const top = this.stack.pop();
    this._exit(top, true);
    const prev = this.current;
    if (prev) {
      prev.el.classList.add('is-active');
      prev.onEnter?.();
    }
    void app;
  }

  _exit(instance, destroy) {
    instance.el.classList.add('is-exiting');
    instance.el.classList.remove('is-active');
    instance.onExit?.();
    const el = instance.el;
    setTimeout(() => {
      if (destroy) instance.destroy?.();
      el.remove();
    }, 280);
  }

  _clearAll() {
    for (const s of this.stack) {
      s.onExit?.();
      s.destroy?.();
      s.el.remove();
    }
    this.stack.length = 0;
  }
}
