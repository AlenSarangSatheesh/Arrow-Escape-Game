/**
 * GameController.js — Orchestrates a single play session.
 *
 * Responsibilities: hold the current state, apply launches through the pure
 * simulation, drive undo/redo/restart/hint, run the timer, and compute the
 * win result (stars + score). It talks to the outside world in two ways only:
 *   - it emits events on an {@link EventBus} (UI/audio/save listen);
 *   - it calls an injected `presenter` for animation and sound.
 * This keeps `game/` free of any static dependency on render/ or audio/, so the
 * whole session logic stays testable with a no-op presenter.
 */
import { resolve } from '../engine/Simulation.js';
import { GameState } from '../engine/GameState.js';
import { solve } from '../ai/Solver.js';
import { suggestPar } from '../ai/DifficultyEstimator.js';
import { Outcome, Status } from '../core/Constants.js';
import { Events } from '../core/EventBus.js';
import { MoveHistory } from './MoveHistory.js';
import { Hints } from './Hints.js';
import { computeStars, computeScore } from './Scoring.js';

const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());

/** A presenter that does nothing — used as a safe default and in tests. */
const NOOP_PRESENTER = {
  setLevel() {},
  setState() {},
  animateMove: () => Promise.resolve(),
  setHint() {},
  clearHint() {},
  playSound() {},
  shake() {},
};

export class GameController {
  constructor({ bus, presenter } = {}) {
    this.bus = bus;
    this.presenter = presenter || NOOP_PRESENTER;
    this.hints = new Hints();
    this.level = null;
    this.state = null;
    this.history = null;
    this.optimal = 0;
    this.par = 0;
    this.busy = false;
    this.finished = false;
    this.attempts = 0;
    this.hintDir = null;
    this._start = 0;
    this._paused = false;
    this._pauseStart = 0;
  }

  /** Load a runtime level and begin the session. */
  load(level) {
    this.level = level;
    this.state = GameState.fromLevel(level);
    this.history = new MoveHistory(this.state);
    this.hints.reset();

    const sol = solve(level);
    this.optimal = level.optimalMoves ?? (sol.solvable ? sol.optimalMoves : 0);
    this.par = level.par || suggestPar(this.optimal, level.difficulty);

    this.busy = false;
    this.finished = false;
    this.attempts = 0;
    this.hintDir = null;
    this._paused = false;
    this._start = now();

    this.presenter.setLevel(level);
    this.presenter.setState(this.state);
    this.presenter.clearHint();
    this.bus?.emit(Events.LEVEL_LOADED, { level, optimal: this.optimal, par: this.par });
    this._emitStatus();
  }

  /** Attempt a launch in `dir`; async because it awaits the slide animation. */
  async launch(dir) {
    if (this.busy || this.finished || !this.state?.isPlaying) return;
    const r = resolve(this.state, dir);
    if (r.illegal) {
      this.bus?.emit(Events.MOVE_ILLEGAL, { dir, outcome: r.outcome });
      this.presenter.playSound('blocked');
      this.presenter.shake();
      return;
    }

    this.busy = true;
    if (this.hintDir != null) this.clearHint();

    const outcome = r.outcome;
    const committing = outcome === Outcome.STOP || outcome === Outcome.WON;
    this.presenter.playSound(
      outcome === Outcome.WON ? 'win' : outcome === Outcome.FELL || outcome === Outcome.DEAD ? 'fail' : 'move',
    );
    if (committing) this.presenter.setState(r.state);
    await this.presenter.animateMove(r.path, { outcome });

    if (committing) {
      this.history.push(r.state, dir);
      this.state = r.state;
      this.bus?.emit(Events.MOVE_APPLIED, {
        dir, path: r.path, outcome, state: this.state, moves: this.history.moveCount,
      });
      this._emitStatus();
      if (outcome === Outcome.WON) this._finishWin();
    } else {
      this.attempts++;
      this.presenter.setState(this.state); // snap the token back to safety
      this.bus?.emit(Events.LEVEL_FAILED, { reason: outcome, attempts: this.attempts });
    }
    this.busy = false;
  }

  undo() {
    if (this.busy || this.finished) return;
    const s = this.history.undo();
    if (!s) return;
    this.state = s;
    this.clearHint();
    this.presenter.setState(s);
    this.bus?.emit(Events.MOVE_UNDONE, { moves: this.history.moveCount });
    this._emitStatus();
  }

  redo() {
    if (this.busy || this.finished) return;
    const s = this.history.redo();
    if (!s) return;
    this.state = s;
    this.presenter.setState(s);
    this._emitStatus();
  }

  restart() {
    if (this.busy) return;
    this.finished = false;
    this.state = GameState.fromLevel(this.level);
    this.history.reset(this.state);
    this.hints.reset();
    this.clearHint();
    this._start = now();
    this._paused = false;
    this.presenter.setState(this.state);
    this.bus?.emit(Events.LEVEL_RESET, {});
    this._emitStatus();
  }

  /** Reveal the next optimal move as a hint; returns the direction or null. */
  hint() {
    if (this.busy || this.finished || !this.state?.isPlaying) return null;
    const d = this.hints.next(this.state);
    if (d == null) return null;
    this.hintDir = d;
    this.presenter.setHint(d);
    this.bus?.emit(Events.HINT_SHOWN, { dir: d, used: this.hints.used });
    this._emitStatus();
    return d;
  }

  clearHint() {
    if (this.hintDir != null) {
      this.hintDir = null;
      this.presenter.clearHint();
    }
  }

  /** The remaining optimal solution from the current state (for "show solution"). */
  currentSolution() {
    return this.hints.solution(this.state);
  }

  pause() {
    if (!this._paused) {
      this._paused = true;
      this._pauseStart = now();
    }
  }

  resume() {
    if (this._paused) {
      this._start += now() - this._pauseStart;
      this._paused = false;
    }
  }

  get timeMs() {
    return (this._paused ? this._pauseStart : now()) - this._start;
  }

  _finishWin() {
    this.finished = true;
    const moves = this.history.moveCount;
    const gemsCollected = this.state.collected.size;
    const gemTotal = this.level.lookup.gemCount;
    const timeMs = this.timeMs;
    const hintsUsed = this.hints.used;
    const stars = computeStars({ moves, par: this.par, optimalMoves: this.optimal, hintsUsed, gemsCollected, gemTotal });
    const score = computeScore({ moves, optimalMoves: this.optimal, timeMs, hintsUsed, gemsCollected });
    this.bus?.emit(Events.LEVEL_WON, {
      levelId: this.level.id, stars, score, moves, timeMs, hintsUsed,
      gemsCollected, gemTotal, optimal: this.optimal, par: this.par, replay: this.history.replay,
    });
  }

  getStatus() {
    return {
      moves: this.history ? this.history.moveCount : 0,
      par: this.par,
      optimal: this.optimal,
      timeMs: this.timeMs,
      hintsUsed: this.hints.used,
      gems: this.state ? this.state.collected.size : 0,
      gemTotal: this.level ? this.level.lookup.gemCount : 0,
      canUndo: this.history ? this.history.canUndo() : false,
      status: this.state ? this.state.status : Status.PLAYING,
      finished: this.finished,
    };
  }

  _emitStatus() {
    this.bus?.emit(Events.STATUS, this.getStatus());
  }
}
