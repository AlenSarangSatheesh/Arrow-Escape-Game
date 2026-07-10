import type { LevelSpec } from './types'

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))

/**
 * Difficulty ramp. Level 1 is hand-authored (three straight arrows, nothing can block anything);
 * from level 2 on the generator takes over and the board grows, densifies and twists.
 *
 * `minBlockedRatio` is a fraction of the arrow count rather than an absolute — a dense board is
 * covered by a few long snakes, so demanding "8 blocked arrows" would force lots of short ones and
 * fragment the grid.
 */
export function specFor(level: number): LevelSpec {
  if (level <= 1) {
    return {
      level: 1,
      cols: 5,
      rows: 6,
      maxBodyLen: 6,
      turnProb: 0,
      targetFill: 0.6,
      minFill: 0.6,
      minBlockedRatio: 0,
      penaltyFree: true,
    }
  }

  const t = level - 2
  return {
    level,
    cols: clamp(4 + Math.floor(t * 0.45), 4, 11),
    rows: clamp(5 + Math.floor(t * 0.55), 5, 14),
    maxBodyLen: clamp(4 + Math.floor(t * 0.8), 4, 20),
    turnProb: clamp(0.12 + t * 0.02, 0.12, 0.38),
    targetFill: clamp(0.55 + t * 0.025, 0.55, 0.9),
    minFill: clamp(0.5 + t * 0.02, 0.5, 0.72),
    minBlockedRatio: clamp(t * 0.045, 0, 0.7),
    penaltyFree: level <= 3,
  }
}

/** How many arrows must start blocked, so the level has a real ordering constraint. */
export function requiredBlocked(spec: LevelSpec, arrowCount: number): number {
  if (spec.level < 4) return 0
  return Math.max(1, Math.ceil(arrowCount * spec.minBlockedRatio))
}
