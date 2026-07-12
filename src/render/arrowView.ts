import { arrowheadPoints, type Layout, pathD, points } from '../core/geometry'
import type { Arrow } from '../core/types'
import { head } from '../core/types'

const SVG = 'http://www.w3.org/2000/svg'

export interface ArrowView {
  arrow: Arrow
  group: SVGGElement
  shaft: SVGPathElement
  headEl: SVGPolygonElement
}

export function strokeWidth(L: Layout): number {
  return Math.max(3, L.cell * 0.2)
}

// Taps are hit-tested at the board level (nearest occupied cell), so arrows need no per-shape hit
// target — the whole cell an arrow covers, plus a margin, is tappable. See BoardView.
export function makeArrowView(arrow: Arrow, L: Layout): ArrowView {
  const group = document.createElementNS(SVG, 'g')
  group.classList.add('arrow')
  group.dataset.id = String(arrow.id)
  if (arrow.red) group.classList.add('arrow--red')

  const shaft = document.createElementNS(SVG, 'path')
  shaft.classList.add('arrow__shaft')
  shaft.setAttribute('stroke-width', String(strokeWidth(L)))

  const headEl = document.createElementNS(SVG, 'polygon')
  headEl.classList.add('arrow__head')

  group.append(shaft, headEl)
  const v = { arrow, group, shaft, headEl }
  layoutArrowView(v, L)
  return v
}

/** Draws the arrow at rest: shaft = body polyline, arrowhead at the head cell. */
export function layoutArrowView(v: ArrowView, L: Layout): void {
  const pts = points(v.arrow.cells, L)
  // Stop the shaft a touch short of the head centre so the arrowhead isn't drawn over the stroke.
  const shaftPts = pts.slice()
  const last = shaftPts[shaftPts.length - 1]
  const prev = shaftPts[shaftPts.length - 2]
  const dx = last.x - prev.x
  const dy = last.y - prev.y
  const seg = Math.hypot(dx, dy) || 1
  const back = Math.min(seg * 0.5, L.cell * 0.18)
  shaftPts[shaftPts.length - 1] = { x: last.x - (dx / seg) * back, y: last.y - (dy / seg) * back }

  v.shaft.setAttribute('d', pathD(shaftPts))
  v.headEl.setAttribute('points', arrowheadPoints(centerOfHead(v, L), v.arrow.dir, L.cell))
}

function centerOfHead(v: ArrowView, L: Layout) {
  return points([head(v.arrow)], L)[0]
}
