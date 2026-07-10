import { type Arrow, type Board, type Cell, cellKey, head, inside, step } from './types'

export function occupancy(board: Board): Map<string, number> {
  const occ = new Map<string, number>()
  for (const a of board.arrows) for (const cell of a.cells) occ.set(cellKey(cell), a.id)
  return occ
}

/**
 * The cells the head sweeps through on its way out — interior cells only.
 * An empty array means the head already sits on the border pointing outward.
 */
export function rayCells(board: Board, arrow: Arrow): Cell[] {
  const cells: Cell[] = []
  let p = step(head(arrow), arrow.dir)
  while (inside(board, p)) {
    cells.push(p)
    p = step(p, arrow.dir)
  }
  return cells
}

/**
 * Index into rayCells() of the first cell occupied by *any* arrow, or -1 if the ray is clear.
 *
 * An arrow's own body counts: a body can curl around and sit in front of its own head.
 * Nothing else needs checking — as the arrow escapes, its body only ever traverses cells the
 * head has already passed through, which are free by the time the body reaches them.
 */
export function blockerIndex(board: Board, arrow: Arrow, occ = occupancy(board)): number {
  const ray = rayCells(board, arrow)
  for (let i = 0; i < ray.length; i++) if (occ.has(cellKey(ray[i]))) return i
  return -1
}

export function isBlocked(board: Board, arrow: Arrow, occ = occupancy(board)): boolean {
  return blockerIndex(board, arrow, occ) !== -1
}

export function arrowById(board: Board, id: number): Arrow | undefined {
  return board.arrows.find((a) => a.id === id)
}

/** Removes the arrow and marks every cell it held as vacated (which reveals a grid dot). */
export function removeArrow(board: Board, id: number): void {
  const i = board.arrows.findIndex((a) => a.id === id)
  if (i === -1) return
  for (const cell of board.arrows[i].cells) board.vacated.add(cellKey(cell))
  board.arrows.splice(i, 1)
}

export const isCleared = (board: Board): boolean => board.arrows.length === 0

export const occupiedCellCount = (board: Board): number =>
  board.arrows.reduce((n, a) => n + a.cells.length, 0)

export function cloneBoard(board: Board): Board {
  return {
    cols: board.cols,
    rows: board.rows,
    arrows: board.arrows.map((a) => ({ ...a, cells: a.cells.map((c) => ({ ...c })) })),
    vacated: new Set(board.vacated),
    solution: [...board.solution],
  }
}
