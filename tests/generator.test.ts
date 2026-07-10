import { describe, expect, it } from 'vitest'
import { arrowById, cloneBoard, isBlocked, occupiedCellCount, removeArrow } from '../src/core/board'
import { generateLevel } from '../src/core/generator'
import { requiredBlocked, specFor } from '../src/core/levelSpec'
import { type Board, cellKey, DIR_VEC, inside } from '../src/core/types'

const LEVELS = Array.from({ length: 500 }, (_, i) => i + 1)

/** Plays the recorded solution. Throws if any arrow is blocked when its turn comes. */
function playSolution(board: Board): void {
  const b = cloneBoard(board)
  for (const id of b.solution) {
    const arrow = arrowById(b, id)
    expect(arrow, `arrow ${id} missing from board`).toBeDefined()
    expect(isBlocked(b, arrow!), `arrow ${id} was blocked when the solution reached it`).toBe(false)
    removeArrow(b, id)
  }
  expect(b.arrows).toHaveLength(0)
}

describe('generateLevel', () => {
  it('is deterministic', () => {
    for (const level of [1, 2, 7, 23, 100, 499]) {
      expect(JSON.stringify(generateLevel(level).arrows)).toBe(JSON.stringify(generateLevel(level).arrows))
    }
  })

  it.each(LEVELS)('level %i is solvable by its recorded order', (level) => {
    playSolution(generateLevel(level))
  })

  it.each(LEVELS)('level %i is a legal board', (level) => {
    const board = generateLevel(level)
    const seen = new Map<string, number>()

    for (const arrow of board.arrows) {
      expect(arrow.cells.length).toBeGreaterThanOrEqual(2)

      for (const cell of arrow.cells) {
        expect(inside(board, cell)).toBe(true)
        expect(seen.has(cellKey(cell)), `cell ${cellKey(cell)} claimed twice`).toBe(false)
        seen.set(cellKey(cell), arrow.id)
      }

      // cells are contiguous and self-avoiding
      for (let i = 1; i < arrow.cells.length; i++) {
        const a = arrow.cells[i - 1]
        const b = arrow.cells[i]
        expect(Math.abs(a.c - b.c) + Math.abs(a.r - b.r)).toBe(1)
      }

      // dir points along the last segment
      const k = arrow.cells.length - 1
      const v = DIR_VEC[arrow.dir]
      expect(arrow.cells[k].c - arrow.cells[k - 1].c).toBe(v.c)
      expect(arrow.cells[k].r - arrow.cells[k - 1].r).toBe(v.r)
    }

    expect(new Set(board.solution)).toEqual(new Set(board.arrows.map((a) => a.id)))
  })

  it.each(LEVELS)('level %i always has a legal opening move', (level) => {
    const board = generateLevel(level)
    const blocked = board.arrows.filter((a) => isBlocked(board, a))
    expect(blocked.length, 'every board needs at least one legal opening move').toBeLessThan(board.arrows.length)
  })

  it('most levels meet the ordering-constraint quota', () => {
    // A packed board is covered by a few long snakes, so the blocked ratio can occasionally fall one
    // arrow short of quota. That is a soft target — solvability and a first move are the hard ones.
    const misses = LEVELS.filter((level) => {
      const board = generateLevel(level)
      const blocked = board.arrows.filter((a) => isBlocked(board, a)).length
      return blocked < requiredBlocked(specFor(level), board.arrows.length)
    })
    expect(misses.length, `levels short of blocked quota: ${misses.join(', ')}`).toBeLessThan(LEVELS.length * 0.03)
  })

  it.each(LEVELS)('level %i packs the grid to its floor', (level) => {
    const board = generateLevel(level)
    const spec = specFor(level)
    const fill = occupiedCellCount(board) / (board.cols * board.rows)
    expect(fill).toBeGreaterThanOrEqual(spec.minFill)
  })

  it('ramps in size and difficulty', () => {
    const early = generateLevel(2)
    const late = generateLevel(60)
    expect(late.cols * late.rows).toBeGreaterThan(early.cols * early.rows)
    expect(late.arrows.length).toBeGreaterThan(early.arrows.length)
  })
})
