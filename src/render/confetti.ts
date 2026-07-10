import { mulberry32 } from '../core/rng'

interface Flake {
  x: number
  y: number
  vx: number
  vy: number
  rot: number
  vr: number
  w: number
  h: number
  color: string
  life: number
}

const COLORS = ['#14142e', '#464b73', '#5867f1', '#aab2f0', '#ffffff', '#f3455b']

/** Two upward corner cannons, gravity + rotation, ~1.7s life. Seeded so it can't NaN on replays. */
export function fireConfetti(canvas: HTMLCanvasElement): void {
  const ctx = canvas.getContext('2d')
  if (!ctx) return

  const dpr = Math.min(window.devicePixelRatio || 1, 2)
  const W = canvas.clientWidth
  const H = canvas.clientHeight
  canvas.width = W * dpr
  canvas.height = H * dpr
  ctx.scale(dpr, dpr)

  const rng = mulberry32((W * 131 + H * 17) | 0 || 1)
  const flakes: Flake[] = []

  for (const [cx, sign] of [[W * 0.08, 1], [W * 0.92, -1]] as const) {
    for (let i = 0; i < 70; i++) {
      const ang = -Math.PI / 2 + sign * (0.15 + rng() * 0.5)
      const spd = 6 + rng() * 9
      flakes.push({
        x: cx,
        y: H + 8,
        vx: Math.cos(ang) * spd,
        vy: Math.sin(ang) * spd,
        rot: rng() * Math.PI,
        vr: (rng() - 0.5) * 0.4,
        w: 5 + rng() * 5,
        h: 8 + rng() * 6,
        color: COLORS[(rng() * COLORS.length) | 0],
        life: 0,
      })
    }
  }

  const gravity = 0.22
  const maxLife = 105
  let last = performance.now()

  const frame = (now: number) => {
    const dt = Math.min(2.5, (now - last) / 16.67)
    last = now
    ctx.clearRect(0, 0, W, H)
    let alive = false

    for (const f of flakes) {
      f.life += dt
      if (f.life > maxLife) continue
      alive = true
      f.vy += gravity * dt
      f.x += f.vx * dt
      f.y += f.vy * dt
      f.rot += f.vr * dt

      ctx.save()
      ctx.translate(f.x, f.y)
      ctx.rotate(f.rot)
      ctx.globalAlpha = Math.max(0, 1 - f.life / maxLife)
      ctx.fillStyle = f.color
      ctx.fillRect(-f.w / 2, -f.h / 2, f.w, f.h)
      ctx.restore()
    }

    if (alive) requestAnimationFrame(frame)
    else ctx.clearRect(0, 0, W, H)
  }
  requestAnimationFrame(frame)
}
