import { center, type Layout, layoutFor } from '../core/geometry'
import type { Arrow, Board } from '../core/types'
import { type ArrowView, layoutArrowView, makeArrowView } from './arrowView'
import { animateEscape } from './escape'
import { animateLunge } from './lunge'

const SVG = 'http://www.w3.org/2000/svg'

/**
 * Pure renderer for a board. Emits arrow taps; the controller decides what a tap means and calls
 * back into the animation methods. Holds no game rules of its own.
 */
export class BoardView {
  private svg: SVGSVGElement
  private dotLayer: SVGGElement
  private arrowLayer: SVGGElement
  private board: Board
  private L: Layout
  private views = new Map<number, ArrowView>()

  constructor(svg: SVGSVGElement, board: Board, private onArrowTap: (id: number) => void) {
    this.svg = svg
    this.board = board
    this.dotLayer = svg.querySelector('#layer-dots') as SVGGElement
    this.arrowLayer = svg.querySelector('#layer-arrows') as SVGGElement
    this.L = this.computeLayout()
    this.render()
    window.addEventListener('resize', this.onResize)
    this.svg.addEventListener('pointerdown', this.onPointerDown)
  }

  get layout(): Layout {
    return this.L
  }

  private computeLayout(): Layout {
    const rect = this.svg.getBoundingClientRect()
    const w = rect.width || 360
    const h = rect.height || 560
    this.svg.setAttribute('viewBox', `0 0 ${w} ${h}`)
    return layoutFor(this.board, w, h)
  }

  private render(): void {
    this.dotLayer.replaceChildren()
    this.arrowLayer.replaceChildren()
    this.views.clear()
    this.renderDots()
    for (const arrow of this.board.arrows) this.addArrowView(arrow)
  }

  private renderDots(): void {
    this.dotLayer.replaceChildren()
    const r = Math.max(1.5, this.L.cell * 0.07)
    for (const k of this.board.vacated) {
      const [c, rr] = k.split(',').map(Number)
      const p = center({ c, r: rr }, this.L)
      const dot = document.createElementNS(SVG, 'circle')
      dot.classList.add('dot')
      dot.setAttribute('cx', p.x.toFixed(2))
      dot.setAttribute('cy', p.y.toFixed(2))
      dot.setAttribute('r', r.toFixed(2))
      this.dotLayer.append(dot)
    }
  }

  private addArrowView(arrow: Arrow): void {
    const v = makeArrowView(arrow, this.L)
    this.arrowLayer.append(v.group)
    this.views.set(arrow.id, v)
  }

  /**
   * Forgiving hit-testing: a tap anywhere within (or up to ~0.9 cell from) a cell an arrow occupies
   * selects that arrow, ties broken by nearest cell centre. Far more tolerant than requiring a hit
   * on the thin shaft, and unambiguous because each cell belongs to at most one arrow. Escaping
   * arrows are already gone from the model, so their old cells fall through to the next-nearest.
   */
  private onPointerDown = (e: PointerEvent): void => {
    const ctm = this.svg.getScreenCTM()
    if (!ctm) return
    const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(ctm.inverse())

    const maxDist = this.L.cell * 0.9
    let bestId: number | null = null
    let bestDist = maxDist
    for (const arrow of this.board.arrows) {
      for (const cell of arrow.cells) {
        const c = center(cell, this.L)
        const d = Math.hypot(p.x - c.x, p.y - c.y)
        if (d < bestDist) {
          bestDist = d
          bestId = arrow.id
        }
      }
    }

    if (bestId !== null) {
      e.preventDefault()
      this.onArrowTap(bestId)
    }
  }

  /** Animate a legal escape. The model must already reflect the removal before dots refresh. */
  escape(id: number, onDone: () => void): void {
    const v = this.views.get(id)
    if (!v) return onDone()
    this.views.delete(id)
    animateEscape(v, this.L, onDone)
  }

  /** Animate a blocked tap. `gap` is the clear-cell count between head and blocker. */
  lunge(id: number, gap: number, onDone: () => void): void {
    const v = this.views.get(id)
    if (!v) return onDone()
    // Transient red: the arrow flushes red while it bumps the blocker, then fades back to ink.
    v.group.classList.add('arrow--red')
    animateLunge(v, this.L, gap, () => {
      v.group.classList.remove('arrow--red')
      onDone()
    })
  }

  refreshDots(): void {
    this.renderDots()
  }

  /** Brief whole-board tint toward red on a failed tap. */
  flash(): void {
    const stage = this.svg.parentElement
    stage?.classList.add('board--flash')
    window.setTimeout(() => stage?.classList.remove('board--flash'), 300)
  }

  setBoard(board: Board): void {
    this.board = board
    this.L = this.computeLayout()
    this.render()
  }

  private onResize = (): void => {
    this.L = this.computeLayout()
    this.renderDots()
    for (const [, v] of this.views) layoutArrowView(v, this.L)
  }

  destroy(): void {
    window.removeEventListener('resize', this.onResize)
    this.svg.removeEventListener('pointerdown', this.onPointerDown)
  }
}
