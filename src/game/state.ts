import { blockerIndex, isCleared, occupancy, removeArrow } from '../core/board'
import { generateLevel } from '../core/generator'
import { specFor } from '../core/levelSpec'
import type { Board, LevelSpec } from '../core/types'

export const START_LIVES = 3

export interface GameState {
  level: number
  spec: LevelSpec
  board: Board
  lives: number
}

export function startLevel(level: number): GameState {
  return { level, spec: specFor(level), board: generateLevel(level), lives: START_LIVES }
}

export type TapResult =
  | { kind: 'escape'; id: number; cleared: boolean }
  | { kind: 'blocked'; id: number; gap: number; costLife: boolean; gameOver: boolean }
  | { kind: 'ignored' }

/**
 * Applies a tap to the model and reports what happened, so the controller can drive the matching
 * animation. Mutates `state.board` (removes the arrow) / `state.lives` as appropriate.
 */
export function tap(state: GameState, id: number): TapResult {
  const arrow = state.board.arrows.find((a) => a.id === id)
  if (!arrow) return { kind: 'ignored' }

  const idx = blockerIndex(state.board, arrow, occupancy(state.board))

  if (idx === -1) {
    removeArrow(state.board, id)
    return { kind: 'escape', id, cleared: isCleared(state.board) }
  }

  // Blocked: the view shows transient red during the bump-and-return; it is not persisted on the
  // model, so the arrow returns to its normal colour afterwards. Optional life loss off-tutorial.
  const costLife = !state.spec.penaltyFree
  if (costLife) state.lives = Math.max(0, state.lives - 1)
  return { kind: 'blocked', id, gap: idx, costLife, gameOver: costLife && state.lives === 0 }
}
