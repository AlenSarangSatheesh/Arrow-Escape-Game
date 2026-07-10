import { describe, expect, it } from 'vitest'
import { blockerIndex, isBlocked, isCleared, rayCells, removeArrow } from '../src/core/board'
import type { Arrow, Board } from '../src/core/types'

const arrow = (id: number, cells: [number, number][], dir: Arrow['dir']): Arrow => ({
  id,
  cells: cells.map(([c, r]) => ({ c, r })),
  dir,
  red: false,
})

const board = (cols: number, rows: number, arrows: Arrow[]): Board => ({
  cols,
  rows,
  arrows,
  vacated: new Set(),
  solution: arrows.map((a) => a.id),
})

describe('rayCells', () => {
  it('is empty when the head already sits on the border pointing out', () => {
    const b = board(4, 4, [arrow(0, [[1, 1], [1, 0]], 'N')])
    expect(rayCells(b, b.arrows[0])).toEqual([])
  })

  it('lists the interior cells between the head and the edge', () => {
    const b = board(4, 4, [arrow(0, [[0, 3], [0, 2]], 'N')])
    expect(rayCells(b, b.arrows[0])).toEqual([{ c: 0, r: 1 }, { c: 0, r: 0 }])
  })
})

describe('isBlocked', () => {
  it('is false for a clear ray', () => {
    const b = board(4, 4, [arrow(0, [[0, 3], [0, 2]], 'N')])
    expect(isBlocked(b, b.arrows[0])).toBe(false)
  })

  it('is true when another arrow sits on the ray', () => {
    const b = board(4, 4, [
      arrow(0, [[0, 3], [0, 2]], 'N'),
      arrow(1, [[1, 0], [0, 0]], 'W'),
    ])
    expect(isBlocked(b, b.arrows[0])).toBe(true)
    expect(blockerIndex(b, b.arrows[0])).toBe(1)
  })

  // An arrow's body can curl around in front of its own head.
  it('is true when the arrow blocks itself', () => {
    const self = arrow(0, [[0, 0], [0, 1], [1, 1], [1, 2], [2, 2], [2, 1]], 'N')
    const b = board(4, 4, [self])
    expect(rayCells(b, self)).toEqual([{ c: 2, r: 0 }])
    expect(isBlocked(b, self)).toBe(false)

    // now make the body sit directly above the head
    const trap = arrow(0, [[2, 0], [1, 0], [1, 1], [1, 2], [2, 2], [2, 1]], 'N')
    expect(isBlocked(board(4, 4, [trap]), trap)).toBe(true)
  })

  it('unblocks once the blocker leaves', () => {
    const b = board(4, 4, [
      arrow(0, [[0, 3], [0, 2]], 'N'),
      arrow(1, [[1, 0], [0, 0]], 'W'),
    ])
    removeArrow(b, 1)
    expect(isBlocked(b, b.arrows[0])).toBe(false)
  })
})

describe('removeArrow', () => {
  it('vacates every cell the arrow held', () => {
    const b = board(4, 4, [arrow(0, [[0, 3], [0, 2]], 'N')])
    removeArrow(b, 0)
    expect([...b.vacated].sort()).toEqual(['0,2', '0,3'])
    expect(isCleared(b)).toBe(true)
  })
})
