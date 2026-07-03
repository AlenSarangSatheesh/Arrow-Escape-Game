/**
 * InputManager.js — Unified keyboard, pointer, and swipe input.
 *
 * Translates raw input into two high-level intents: `onLaunch(dir)` and
 * `onAction(name)`. It never touches game state directly — the controller
 * decides what to do (and ignores input while a move is animating).
 */
import { Dir } from '../core/Constants.js';

const KEY_DIRS = {
  ArrowUp: Dir.UP, KeyW: Dir.UP,
  ArrowRight: Dir.RIGHT, KeyD: Dir.RIGHT,
  ArrowDown: Dir.DOWN, KeyS: Dir.DOWN,
  ArrowLeft: Dir.LEFT, KeyA: Dir.LEFT,
};

const KEY_ACTIONS = {
  KeyU: 'undo',
  KeyR: 'restart',
  KeyH: 'hint',
  Escape: 'pause',
  Enter: 'confirm',
};

const SWIPE_THRESHOLD = 24; // px

export class InputManager {
  constructor({ onLaunch, onAction } = {}) {
    this.onLaunch = onLaunch || (() => {});
    this.onAction = onAction || (() => {});
    this.enabled = true;
    this._boardEl = null;
    this._pointer = null;

    this._onKeyDown = this._handleKeyDown.bind(this);
    this._onPointerDown = this._handlePointerDown.bind(this);
    this._onPointerUp = this._handlePointerUp.bind(this);
  }

  /** Attach keyboard globally and swipe handling to the board element. */
  attach(boardEl) {
    this._boardEl = boardEl;
    document.addEventListener('keydown', this._onKeyDown);
    if (boardEl) {
      boardEl.addEventListener('pointerdown', this._onPointerDown);
      window.addEventListener('pointerup', this._onPointerUp);
      window.addEventListener('pointercancel', this._onPointerUp);
    }
  }

  detach() {
    document.removeEventListener('keydown', this._onKeyDown);
    if (this._boardEl) {
      this._boardEl.removeEventListener('pointerdown', this._onPointerDown);
      window.removeEventListener('pointerup', this._onPointerUp);
      window.removeEventListener('pointercancel', this._onPointerUp);
    }
  }

  setEnabled(v) {
    this.enabled = !!v;
  }

  _isTypingTarget(el) {
    if (!el) return false;
    const tag = el.tagName;
    return tag === 'INPUT' || tag === 'TEXTAREA' || el.isContentEditable;
  }

  _handleKeyDown(e) {
    if (!this.enabled || this._isTypingTarget(e.target)) return;

    // Undo/redo with modifiers.
    if ((e.ctrlKey || e.metaKey) && e.code === 'KeyZ') {
      e.preventDefault();
      this.onAction(e.shiftKey ? 'redo' : 'undo');
      return;
    }
    if ((e.ctrlKey || e.metaKey) && e.code === 'KeyY') {
      e.preventDefault();
      this.onAction('redo');
      return;
    }

    if (e.code in KEY_DIRS) {
      if (e.repeat) return; // avoid overshooting from held keys
      e.preventDefault();
      this.onLaunch(KEY_DIRS[e.code]);
      return;
    }
    if (e.code in KEY_ACTIONS) {
      e.preventDefault();
      this.onAction(KEY_ACTIONS[e.code]);
    }
  }

  _handlePointerDown(e) {
    if (!this.enabled) return;
    this._pointer = { id: e.pointerId, x: e.clientX, y: e.clientY };
  }

  _handlePointerUp(e) {
    if (!this._pointer || e.pointerId !== this._pointer.id) return;
    const dx = e.clientX - this._pointer.x;
    const dy = e.clientY - this._pointer.y;
    this._pointer = null;
    if (!this.enabled) return;

    const adx = Math.abs(dx);
    const ady = Math.abs(dy);
    if (Math.max(adx, ady) < SWIPE_THRESHOLD) return; // a tap, not a swipe
    if (adx > ady) this.onLaunch(dx > 0 ? Dir.RIGHT : Dir.LEFT);
    else this.onLaunch(dy > 0 ? Dir.DOWN : Dir.UP);
  }
}
