/**
 * Statistics.js — Aggregate lifetime play statistics.
 *
 * Per-level bests live in the LevelRepository progress; this module owns the
 * cross-cutting totals shown on the Statistics screen and used to evaluate
 * achievements.
 */
import { SaveKeys } from './SaveManager.js';

export const DEFAULT_STATS = Object.freeze({
  completedIds: [],
  threeStarIds: [],
  totalMoves: 0,
  totalTimeMs: 0,
  hintsUsed: 0,
  gems: 0,
  attempts: 0,
  fails: 0,
  wins: 0,
  dailyPlayed: 0,
  endlessPlayed: 0,
  editorPlays: 0,
  bestStreak: 0,
  currentStreak: 0,
  firstPlayedAt: null,
  lastPlayedAt: null,
});

export class Statistics {
  constructor({ save }) {
    this.save = save;
    this.data = { ...DEFAULT_STATS, ...(save.get(SaveKeys.STATISTICS) || {}) };
    // Ensure arrays exist after a partial load.
    this.data.completedIds = this.data.completedIds || [];
    this.data.threeStarIds = this.data.threeStarIds || [];
  }

  _persist() {
    this.save.set(SaveKeys.STATISTICS, this.data);
  }

  _stamp(nowMs) {
    if (!this.data.firstPlayedAt) this.data.firstPlayedAt = nowMs;
    this.data.lastPlayedAt = nowMs;
  }

  recordWin(payload, nowMs = Date.now()) {
    const d = this.data;
    this._stamp(nowMs);
    d.wins++;
    d.totalMoves += payload.moves || 0;
    d.totalTimeMs += payload.timeMs || 0;
    d.hintsUsed += payload.hintsUsed || 0;
    d.gems += payload.gemsCollected || 0;
    d.currentStreak++;
    d.bestStreak = Math.max(d.bestStreak, d.currentStreak);
    if (!d.completedIds.includes(payload.levelId)) d.completedIds.push(payload.levelId);
    if (payload.stars >= 3 && !d.threeStarIds.includes(payload.levelId)) {
      d.threeStarIds.push(payload.levelId);
    }
    this._persist();
  }

  recordFail(nowMs = Date.now()) {
    this._stamp(nowMs);
    this.data.fails++;
    this.data.attempts++;
    this.data.currentStreak = 0;
    this._persist();
  }

  recordMode(mode) {
    if (mode === 'daily') this.data.dailyPlayed++;
    else if (mode === 'endless') this.data.endlessPlayed++;
    else if (mode === 'editor') this.data.editorPlays++;
    this._persist();
  }

  get levelsCompleted() {
    return this.data.completedIds.length;
  }

  get threeStars() {
    return this.data.threeStarIds.length;
  }

  get averageMoves() {
    return this.data.wins ? this.data.totalMoves / this.data.wins : 0;
  }

  snapshot() {
    return {
      ...this.data,
      levelsCompleted: this.levelsCompleted,
      threeStars: this.threeStars,
      averageMoves: this.averageMoves,
    };
  }

  reset() {
    this.data = { ...DEFAULT_STATS, completedIds: [], threeStarIds: [] };
    this._persist();
  }
}
