/**
 * MoveHistory.js — Undo/redo stack and replay recording for a play session.
 *
 * Every committed move pushes a full state snapshot (cheap thanks to
 * {@link GameState#clone}) and the launch direction. This powers unlimited undo,
 * redo, and a deterministic replay/solution export (just the direction list).
 */
export class MoveHistory {
  constructor(initialState) {
    this.reset(initialState);
  }

  reset(initialState) {
    /** @type {import('../engine/GameState.js').GameState[]} */
    this._states = [initialState];
    /** @type {number[]} */
    this._dirs = [];
    this._redoStates = [];
    this._redoDirs = [];
  }

  get current() {
    return this._states[this._states.length - 1];
  }

  get moveCount() {
    return this._dirs.length;
  }

  /** The launch-direction sequence taken so far (a replay). */
  get replay() {
    return [...this._dirs];
  }

  push(state, dir) {
    this._states.push(state);
    this._dirs.push(dir);
    this._redoStates.length = 0;
    this._redoDirs.length = 0;
  }

  canUndo() {
    return this._states.length > 1;
  }

  undo() {
    if (!this.canUndo()) return null;
    const state = this._states.pop();
    const dir = this._dirs.pop();
    this._redoStates.push(state);
    this._redoDirs.push(dir);
    return this.current;
  }

  canRedo() {
    return this._redoStates.length > 0;
  }

  redo() {
    if (!this.canRedo()) return null;
    const state = this._redoStates.pop();
    const dir = this._redoDirs.pop();
    this._states.push(state);
    this._dirs.push(dir);
    return this.current;
  }
}
