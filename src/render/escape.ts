import { arrowGeometry, arrowheadPoints, type Layout, pathD } from '../core/geometry'
import { DIR_VEC } from '../core/types'
import type { ArrowView } from './arrowView'

// The head glides out at a constant, deliberately SLOW speed so you can watch the arrow travel
// across the board and off the edge — not blink away. Lower = slower. Higher would look like it
// "disappears" rather than travels.
const GLIDE_CELLS_PER_SEC = 9

/**
 * Duration for a constant-speed glide over `travelPx` — the FULL distance the head covers, which is
 * the body length plus the run out to (and past) the board edge, not just the body length. Basing it
 * on travel distance is what makes the arrow visibly travel out instead of blinking away.
 *
 * Note: we intentionally do NOT honour prefers-reduced-motion here. The arrow travelling out is the
 * game's core feedback (it shows which arrow left and where the path went), not decorative motion —
 * suppressing it just makes the board change inexplicably. The blocked-tap lunge is unconditional for
 * the same reason.
 */
function duration(travelPx: number, cell: number): number {
  const cells = travelPx / cell
  const ms = (cells / GLIDE_CELLS_PER_SEC) * 1000
  const slow = (window as unknown as { __ARROWS_SLOWMO?: number }).__ARROWS_SLOWMO ?? 1
  // Wide ceiling so long-travel arrows keep the slow glide instead of being sped up by a clamp.
  return Math.max(500, Math.min(3500, ms)) * slow
}

// Constant velocity with a very short ease-in so the launch is prompt (like the lunge) without a
// hard jerk. Never accelerates at the end — that is what read as "disappearing".
const ease = (t: number) => {
  const k = 0.08 // fraction of the glide spent ramping up to full speed
  if (t < k) return (t * t) / (2 * k) / (1 - k / 2)
  return (t - k / 2) / (1 - k / 2)
}

/**
 * Animates the arrow off the board using the stroke-dashoffset trick.
 *
 * The shaft's `d` is the body polyline extended by a straight run past the play-area edge. Rendering
 * it with `dasharray = [bodyLen, totalLen]` and sliding `dashoffset` from 0 to -exitLen moves a
 * body-length window of visible stroke along that path: the head runs out along the straight
 * extension while the tail is reeled through the bends, so a bent arrow straightens as it leaves.
 * The board itself clips everything past the edge.
 */
export function animateEscape(v: ArrowView, L: Layout, onDone: () => void): void {
  const geo = arrowGeometry(v.arrow, L)
  const v2 = DIR_VEC[v.arrow.dir]

  v.group.classList.add('arrow--escaping')
  v.hit.style.pointerEvents = 'none'

  v.shaft.setAttribute('d', pathD(geo.extended))
  v.shaft.style.strokeDasharray = `${geo.bodyLen} ${geo.totalLen}`
  v.shaft.style.strokeDashoffset = '0'

  const headPt = geo.bodyPts[geo.bodyPts.length - 1]
  const dur = duration(geo.exitLen, L.cell)
  if (import.meta.env.DEV) (window as unknown as { __lastEscapeMs?: number }).__lastEscapeMs = dur
  // Seed from the first frame's timestamp — a rAF timestamp can predate performance.now().
  let start: number | null = null

  const frame = (now: number) => {
    if (start === null) start = now
    const t = Math.min(1, (now - start) / dur)
    const s = ease(t) * geo.exitLen

    // Slide the visible window forward along the extended path.
    v.shaft.style.strokeDashoffset = String(-s)

    // The arrowhead rides the leading edge. It never leaves the final straight segment, so its
    // heading is constant — no tangent sampling needed.
    const hx = headPt.x + v2.c * s
    const hy = headPt.y + v2.r * s
    v.headEl.setAttribute('points', arrowheadPoints({ x: hx, y: hy }, v.arrow.dir, L.cell))

    if (t < 1) {
      requestAnimationFrame(frame)
    } else {
      v.group.remove()
      onDone()
    }
  }

  requestAnimationFrame(frame)
}
