export type Dir = 'N' | 'E' | 'S' | 'W'

export interface Cell {
  c: number
  r: number
}

export const DIRS: readonly Dir[] = ['N', 'E', 'S', 'W']

export const DIR_VEC: Record<Dir, Cell> = {
  N: { c: 0, r: -1 },
  E: { c: 1, r: 0 },
  S: { c: 0, r: 1 },
  W: { c: -1, r: 0 },
}

const OPPOSITE: Record<Dir, Dir> = { N: 'S', S: 'N', E: 'W', W: 'E' }
const PERPENDICULAR: Record<Dir, Dir[]> = { N: ['E', 'W'], S: ['E', 'W'], E: ['N', 'S'], W: ['N', 'S'] }

export const opposite = (d: Dir): Dir => OPPOSITE[d]
export const perpendicular = (d: Dir): Dir[] => [...PERPENDICULAR[d]]

/** An arrow is a self-avoiding orthogonal path of cells, tail-first. */
export interface Arrow {
  id: number
  /** cells[0] is the tail, cells[cells.length - 1] is the head. Always length >= 2. */
  cells: Cell[]
  /** The direction the arrowhead points: cells[k] - cells[k-1]. */
  dir: Dir
  /** Sticky mark: the player tapped this arrow while it was blocked. Purely cosmetic. */
  red: boolean
}

export interface Board {
  cols: number
  rows: number
  arrows: Arrow[]
  /** Keys of cells an arrow once occupied and has now vacated. Drives the dot layer. */
  vacated: Set<string>
  /** Arrow ids in an order that clears the board without ever hitting a blocked arrow. */
  solution: number[]
}

export interface LevelSpec {
  level: number
  cols: number
  rows: number
  maxBodyLen: number
  turnProb: number
  /** Packing the generator aims for, and stops adding arrows at. */
  targetFill: number
  /** Packing the generator guarantees. Greedy snake packing cannot always hit `targetFill`. */
  minFill: number
  /** Fraction of arrows that must start blocked, so escape order actually matters. */
  minBlockedRatio: number
  /** Tutorial levels do not charge a life for a blocked tap. */
  penaltyFree: boolean
}

export const key = (c: number, r: number): string => `${c},${r}`
export const cellKey = (cell: Cell): string => key(cell.c, cell.r)
export const head = (a: Arrow): Cell => a.cells[a.cells.length - 1]
export const step = (cell: Cell, d: Dir): Cell => ({ c: cell.c + DIR_VEC[d].c, r: cell.r + DIR_VEC[d].r })

export const inside = (dims: { cols: number; rows: number }, cell: Cell): boolean =>
  cell.c >= 0 && cell.r >= 0 && cell.c < dims.cols && cell.r < dims.rows
