import { arrowheadPoints, type Layout, pathD, points } from '../core/geometry'
import type { Arrow } from '../core/types'
import { head } from '../core/types'

const SVG = 'http://www.w3.org/2000/svg'

export interface ArrowView {
  arrow: Arrow
  group: SVGGElement
  shaft: SVGPathElement
  headEl: SVGPolygonElement
  hit: SVGPathElement
}

export function strokeWidth(L: Layout): number {
  return Math.max(3, L.cell * 0.2)
}

export function makeArrowView(arrow: Arrow, L: Layout, onTap: (id: number) => void): ArrowView {
  const group = document.createElementNS(SVG, 'g')
  group.classList.add('arrow')
  group.dataset.id = String(arrow.id)
  if (arrow.red) group.classList.add('arrow--red')

  const shaft = document.createElementNS(SVG, 'path')
  shaft.classList.add('arrow__shaft')
  shaft.setAttribute('stroke-width', String(strokeWidth(L)))

  const headEl = document.createElementNS(SVG, 'polygon')
  headEl.classList.add('arrow__head')

  const hit = document.createElementNS(SVG, 'path')
  hit.classList.add('arrow__hit')
  hit.setAttribute('stroke-width', String(L.cell * 0.85))

  group.append(shaft, headEl, hit)
  layoutArrowView({ arrow, group, shaft, headEl, hit }, L)

  const fire = (e: Event) => {
    e.preventDefault()
    onTap(arrow.id)
  }
  hit.addEventListener('pointerdown', fire)

  return { arrow, group, shaft, headEl, hit }
}

/** Draws the arrow at rest: shaft = body polyline, arrowhead at the head cell, hit path = shaft. */
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

  const d = pathD(shaftPts)
  v.shaft.setAttribute('d', d)
  v.hit.setAttribute('d', pathD(pts))
  v.headEl.setAttribute('points', arrowheadPoints(centerOfHead(v, L), v.arrow.dir, L.cell))
}

function centerOfHead(v: ArrowView, L: Layout) {
  return points([head(v.arrow)], L)[0]
}
