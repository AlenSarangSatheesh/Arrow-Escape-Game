import { arrowheadPoints, type Layout, pathD, points } from '../core/geometry'
import { DIR_VEC, head } from '../core/types'
import type { ArrowView } from './arrowView'
import { layoutArrowView } from './arrowView'

/**
 * Blocked-tap feedback: the arrow's head lunges forward toward the blocker, stopping just short of
 * it (revealing what blocks it), then snaps back. The body does not move. No board shake.
 *
 * `gap` is the number of clear interior cells between the head and the blocker (blockerIndex).
 */
export function animateLunge(v: ArrowView, L: Layout, gap: number, onDone: () => void): void {
  // Travel right up to the blocker (one arrowhead-length short of it), then return.
  const reach = Math.min((gap + 0.6) * L.cell, L.cell * 3)
  const dir = DIR_VEC[v.arrow.dir]
  const basePts = points(v.arrow.cells, L)
  const headPt = basePts[basePts.length - 1]

  const outMs = 200 // decelerate into the block
  const holdMs = 90 // pause against it
  const backMs = 240 // ease back home
  const easeOut = (t: number) => 1 - (1 - t) * (1 - t)
  const easeIn = (t: number) => t * t
  // Seed the clock from the first frame's timestamp: a rAF timestamp can predate performance.now(),
  // which would make elapsed negative and end the animation on frame one.
  let start: number | null = null

  const frame = (now: number) => {
    if (start === null) start = now
    const elapsed = now - start
    let s: number
    if (elapsed < outMs) s = easeOut(elapsed / outMs) * reach
    else if (elapsed < outMs + holdMs) s = reach
    else if (elapsed < outMs + holdMs + backMs) s = (1 - easeIn((elapsed - outMs - holdMs) / backMs)) * reach
    else s = -1

    if (s < 0) {
      layoutArrowView(v, L)
      onDone()
      return
    }

    // Stretch the shaft's final vertex forward by s; the arrowhead rides it.
    const stretched = basePts.slice()
    const lead = { x: headPt.x + dir.c * s, y: headPt.y + dir.r * s }
    stretched[stretched.length - 1] = lead
    v.shaft.setAttribute('d', pathD(stretched))
    v.headEl.setAttribute('points', arrowheadPoints(headCenter(v, L, s), v.arrow.dir, L.cell))

    requestAnimationFrame(frame)
  }
  requestAnimationFrame(frame)
}

function headCenter(v: ArrowView, L: Layout, s: number) {
  const dir = DIR_VEC[v.arrow.dir]
  const hp = points([head(v.arrow)], L)[0]
  return { x: hp.x + dir.c * s, y: hp.y + dir.r * s }
}
