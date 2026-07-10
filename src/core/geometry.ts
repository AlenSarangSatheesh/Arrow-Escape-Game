import { type Arrow, type Board, type Cell, type Dir, DIR_VEC, head } from './types'

export interface Pt {
  x: number
  y: number
}

export interface Layout {
  /** Cell pitch in px. */
  cell: number
  /** Board origin (top-left of cell 0,0) inside the play area. */
  ox: number
  oy: number
  /** Play-area size. Arrows are clipped at these edges, not at the board's. */
  w: number
  h: number
}

/**
 * The reference game uses a *fixed* cell pitch — boards physically grow with the level rather
 * than being scaled to fit. We reproduce that, clamping only so a huge board still fits.
 */
const PITCH_RATIO = 0.055
const MAX_CELL = 36
const PAD = 14

export function layoutFor(board: Pick<Board, 'cols' | 'rows'>, w: number, h: number): Layout {
  const cell = Math.min(w * PITCH_RATIO, MAX_CELL, (w - PAD * 2) / board.cols, (h - PAD * 2) / board.rows)
  return {
    cell,
    ox: (w - board.cols * cell) / 2,
    oy: (h - board.rows * cell) / 2,
    w,
    h,
  }
}

export const center = (cell: Cell, L: Layout): Pt => ({
  x: L.ox + (cell.c + 0.5) * L.cell,
  y: L.oy + (cell.r + 0.5) * L.cell,
})

export const points = (cells: Cell[], L: Layout): Pt[] => cells.map((c) => center(c, L))

export const pathD = (pts: Pt[]): string =>
  pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(2)} ${p.y.toFixed(2)}`).join(' ')

export function polylineLength(pts: Pt[]): number {
  let len = 0
  for (let i = 1; i < pts.length; i++) len += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y)
  return len
}

/** Distance from a point to the play-area edge, travelling along `dir`. */
export function distanceToEdge(p: Pt, dir: Dir, L: Layout): number {
  switch (dir) {
    case 'N': return p.y
    case 'S': return L.h - p.y
    case 'W': return p.x
    case 'E': return L.w - p.x
  }
}

export interface ArrowGeometry {
  /** Body polyline followed by one point far outside the play area, along `dir`. */
  extended: Pt[]
  bodyPts: Pt[]
  bodyLen: number
  /** How far the arrow must travel for its tail to clear the play area. */
  exitLen: number
  totalLen: number
}

export function arrowGeometry(arrow: Arrow, L: Layout): ArrowGeometry {
  const bodyPts = points(arrow.cells, L)
  const bodyLen = polylineLength(bodyPts)
  const headPt = bodyPts[bodyPts.length - 1]
  const v = DIR_VEC[arrow.dir]

  // The tail sits `bodyLen` behind the head, so it clears the edge only after the head has
  // travelled that much further. The extra 1.5 cells hides the arrowhead too.
  const exitLen = distanceToEdge(headPt, arrow.dir, L) + bodyLen + L.cell * 1.5
  const exitPt: Pt = { x: headPt.x + v.c * exitLen, y: headPt.y + v.r * exitLen }

  return { extended: [...bodyPts, exitPt], bodyPts, bodyLen, exitLen, totalLen: bodyLen + exitLen }
}

/** The three vertices of the arrowhead, given where the head of the shaft currently is. */
export function arrowheadPoints(at: Pt, dir: Dir, cell: number): string {
  const v = DIR_VEC[dir]
  const perp = { x: -v.r, y: v.c }
  const tipLen = cell * 0.34
  const backLen = cell * 0.1
  const halfW = cell * 0.27

  const tip = { x: at.x + v.c * tipLen, y: at.y + v.r * tipLen }
  const base = { x: at.x - v.c * backLen, y: at.y - v.r * backLen }
  const a = { x: base.x + perp.x * halfW, y: base.y + perp.y * halfW }
  const b = { x: base.x - perp.x * halfW, y: base.y - perp.y * halfW }

  return `${tip.x.toFixed(2)},${tip.y.toFixed(2)} ${a.x.toFixed(2)},${a.y.toFixed(2)} ${b.x.toFixed(2)},${b.y.toFixed(2)}`
}

export const headCell = head
