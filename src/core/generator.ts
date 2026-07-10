import { cloneBoard, isBlocked, occupiedCellCount } from './board'
import { requiredBlocked, specFor } from './levelSpec'
import { hashLevel, mulberry32, type Rng, shuffle } from './rng'
import {
  type Arrow,
  type Board,
  type Cell,
  type Dir,
  DIRS,
  DIR_VEC,
  inside,
  key,
  type LevelSpec,
  opposite,
  perpendicular,
  step,
} from './types'

const ATTEMPTS = 40
const MAX_MISSES = 60

/**
 * Reverse construction.
 *
 * Arrows are inserted in the reverse of their removal order: A_n goes into an empty grid, A_1 into
 * a nearly full one. Each insertion requires the arrow's escape ray to be clear of everything
 * already on the board (and of its own body).
 *
 * At forward removal step i the board holds exactly A_i..A_n. The ray of A_i was required clear of
 * A_{i+1}..A_n and of its own body, and A_1..A_{i-1} are already gone. So 1, 2, ..., n is always a
 * valid solution that never touches a blocked arrow. Arrows inserted later (removed earlier) are
 * free to land on the rays of arrows inserted earlier — that is exactly where the puzzle comes from.
 */
const cache = new Map<number, Board>()

/** Deterministic per level. Returns a fresh copy each call — the caller mutates it as they play. */
export function generateLevel(level: number): Board {
  let board = cache.get(level)
  if (!board) {
    board = buildLevel(level)
    cache.set(level, board)
  }
  return cloneBoard(board)
}

function buildLevel(level: number): Board {
  const spec = specFor(level)
  if (level <= 1) return tutorialBoard(spec)

  const seed = hashLevel(level)
  let best: Board | null = null
  let bestScore = -Infinity

  for (let attempt = 0; attempt < ATTEMPTS; attempt++) {
    const board = build(spec, mulberry32(seed + attempt * 7919))
    if (!board) continue

    const fill = occupiedCellCount(board) / (spec.cols * spec.rows)
    const blocked = board.arrows.filter((a) => isBlocked(board, a)).length
    const enoughBlocked = blocked >= requiredBlocked(spec, board.arrows.length)

    if (enoughBlocked && fill >= spec.targetFill) return board

    // Lexicographic: never fall back to a board below minFill if any attempt cleared it, then
    // prefer boards that meet the blocked threshold, then prefer the densest. Blocked count is a
    // threshold, not something to maximise — otherwise a sparse, fragmented board with many short
    // blocked arrows outscores a dense one.
    const score = (fill >= spec.minFill ? 10000 : 0) + (enoughBlocked ? 1000 : 0) + fill * 100
    if (score > bestScore) {
      best = board
      bestScore = score
    }
  }

  return best ?? tutorialBoard(spec)
}

function build(spec: LevelSpec, rng: Rng): Board | null {
  const occ = new Map<string, number>()
  const placed: Arrow[] = []
  const target = Math.floor(spec.cols * spec.rows * spec.targetFill)
  let occupied = 0
  let misses = 0

  while (occupied < target && misses < MAX_MISSES) {
    // Early insertions are removed last, so give them long interior rays that later arrows can
    // block. Late insertions face a full board and hug the border, where the ray is trivially free.
    const deep = occupied < target * 0.45
    const arrow = placeOne(spec, rng, occ, placed.length, deep)
    if (!arrow) {
      misses++
      continue
    }
    for (const cell of arrow.cells) occ.set(key(cell.c, cell.r), arrow.id)
    placed.push(arrow)
    occupied += arrow.cells.length
    misses = 0
  }

  if (placed.length < 2) return null

  return {
    cols: spec.cols,
    rows: spec.rows,
    arrows: placed,
    vacated: new Set(),
    solution: placed.map((a) => a.id).reverse(),
  }
}

interface Candidate {
  head: Cell
  dir: Dir
  rayLen: number
}

function placeOne(spec: LevelSpec, rng: Rng, occ: Map<string, number>, id: number, deep: boolean): Arrow | null {
  const candidates: Candidate[] = []

  for (let r = 0; r < spec.rows; r++) {
    for (let c = 0; c < spec.cols; c++) {
      if (occ.has(key(c, r))) continue
      const cell = { c, r }
      for (const dir of DIRS) {
        // Every arrow is at least two cells, so the cell behind the head must be free too.
        const v = DIR_VEC[dir]
        const back = { c: c - v.c, r: r - v.r }
        if (!inside(spec, back) || occ.has(key(back.c, back.r))) continue

        const rayLen = clearRayLength(spec, occ, cell, dir)
        if (rayLen !== null) candidates.push({ head: cell, dir, rayLen })
      }
    }
  }

  if (candidates.length === 0) return null

  shuffle(rng, candidates)
  // Array.sort is stable, so ties keep their shuffled order.
  //
  // Early: long interior rays, so later arrows have something to land on and block.
  // Late: short rays (easy to place in a packed grid) but avoid rayLen === 0 — a head already on
  // the border pointing outward can never be blocked by anything, and a board full of those has no
  // ordering constraint at all. Break remaining ties toward the most constrained head so we fill
  // corners before open space.
  candidates.sort(
    deep
      ? (a, b) => b.rayLen - a.rayLen
      : (a, b) =>
          (a.rayLen === 0 ? 1 : 0) - (b.rayLen === 0 ? 1 : 0) ||
          a.rayLen - b.rayLen ||
          freeNeighbours(spec, occ, a.head, EMPTY) - freeNeighbours(spec, occ, b.head, EMPTY),
  )

  const poolSize = Math.max(1, Math.floor(candidates.length * 0.25))
  const pick = candidates[Math.floor(rng() * poolSize)]

  const cells = growBody(spec, rng, occ, pick.head, pick.dir, deep)
  if (!cells || cells.length < 2) return null

  return { id, cells, dir: pick.dir, red: false }
}

const EMPTY: ReadonlySet<string> = new Set()

/** How many orthogonal neighbours of `cell` are still free. Drives most-constrained-first packing. */
function freeNeighbours(
  spec: LevelSpec,
  occ: Map<string, number>,
  cell: Cell,
  used: ReadonlySet<string>,
): number {
  let n = 0
  for (const dir of DIRS) {
    const v = DIR_VEC[dir]
    const p = { c: cell.c + v.c, r: cell.r + v.r }
    if (!inside(spec, p)) continue
    const k = key(p.c, p.r)
    if (!occ.has(k) && !used.has(k)) n++
  }
  return n
}

/** Number of interior cells on the escape ray, or null if any of them is occupied. */
function clearRayLength(spec: LevelSpec, occ: Map<string, number>, head: Cell, dir: Dir): number | null {
  const v = DIR_VEC[dir]
  let p = { c: head.c + v.c, r: head.r + v.r }
  let len = 0
  while (inside(spec, p)) {
    if (occ.has(key(p.c, p.r))) return null
    len++
    p = { c: p.c + v.c, r: p.r + v.r }
  }
  return len
}

/**
 * Grows the body backwards from the head as a self-avoiding walk with a straight-ahead bias.
 * The body may never enter the escape ray — an arrow must not block itself.
 * Returns cells tail-first.
 */
function growBody(
  spec: LevelSpec,
  rng: Rng,
  occ: Map<string, number>,
  head: Cell,
  dir: Dir,
  deep: boolean,
): Cell[] | null {
  const v = DIR_VEC[dir]

  const ray = new Set<string>()
  for (let p = { c: head.c + v.c, r: head.r + v.r }; inside(spec, p); p = { c: p.c + v.c, r: p.r + v.r }) {
    ray.add(key(p.c, p.r))
  }

  const free = (cell: Cell, used: Set<string>) => {
    const k = key(cell.c, cell.r)
    return inside(spec, cell) && !occ.has(k) && !used.has(k) && !ray.has(k)
  }

  const used = new Set<string>([key(head.c, head.r)])
  const path: Cell[] = [head]

  let cur = { c: head.c - v.c, r: head.r - v.r }
  if (!free(cur, used)) return null
  path.push(cur)
  used.add(key(cur.c, cur.r))

  let walkDir = opposite(dir)

  // Bimodal lengths, as in the reference (a 12x14 board there holds two 2-cell stubs alongside a
  // 20-cell snake). Long snakes laid into open space set the structure and pack the grid; short
  // ones squeezed in afterwards fill the holes and, being numerous, create the ordering constraints.
  const skew = deep ? 0.55 : 1.8
  const targetLen = 2 + Math.floor(Math.pow(rng(), skew) * (spec.maxBodyLen - 1))
  const hardCap = spec.maxBodyLen + 8

  while (path.length < hardCap) {
    // Past the target length, keep going only to swallow a dead-end corridor that nothing else
    // could ever reach.
    if (path.length >= targetLen && freeNeighbours(spec, occ, cur, used) !== 1) break

    // Enter the tightest cell available, so we don't strand single-cell holes behind us.
    const turns = shuffle(rng, perpendicular(walkDir)).sort(
      (a, b) => freeNeighbours(spec, occ, step(cur, a), used) - freeNeighbours(spec, occ, step(cur, b), used),
    )
    const options = rng() > spec.turnProb ? [walkDir, ...turns] : [...turns, walkDir]

    let moved = false
    for (const nd of options) {
      const next = step(cur, nd)
      if (!free(next, used)) continue
      path.push(next)
      used.add(key(next.c, next.r))
      cur = next
      walkDir = nd
      moved = true
      break
    }
    if (!moved) break
  }

  return path.reverse()
}

/** Level 1: three straight arrows in alternating columns, all trivially escapable. */
function tutorialBoard(spec: LevelSpec): Board {
  const arrows: Arrow[] = [0, 2, 4].map((c, id) => ({
    id,
    cells: Array.from({ length: spec.rows }, (_, i) => ({ c, r: spec.rows - 1 - i })),
    dir: 'N' as const,
    red: false,
  }))
  return { cols: spec.cols, rows: spec.rows, arrows, vacated: new Set(), solution: [0, 1, 2] }
}
