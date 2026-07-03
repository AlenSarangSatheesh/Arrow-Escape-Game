/**
 * ParticleSystem.js — Pooled 2D particles for tactile feedback.
 *
 * Particles are pre-allocated and recycled so that bursts on redirect, stop, and
 * win never allocate on the hot path. The system is inert when empty, so it costs
 * nothing while the board is idle.
 */
export class ParticleSystem {
  constructor(max = 400) {
    this.max = max;
    /** @type {Array} */
    this.particles = new Array(max);
    for (let i = 0; i < max; i++) {
      this.particles[i] = {
        active: false, x: 0, y: 0, vx: 0, vy: 0, life: 0, maxLife: 1,
        size: 3, color: '#fff', gravity: 0, shape: 'circle', spin: 0, rot: 0,
      };
    }
    this._next = 0;
    this.activeCount = 0;
  }

  _acquire() {
    // Linear scan for a free slot; if none, overwrite the round-robin slot.
    for (let n = 0; n < this.max; n++) {
      const i = (this._next + n) % this.max;
      if (!this.particles[i].active) {
        this._next = (i + 1) % this.max;
        return this.particles[i];
      }
    }
    const p = this.particles[this._next];
    this._next = (this._next + 1) % this.max;
    return p;
  }

  emit(opts) {
    const p = this._acquire();
    if (!p.active) this.activeCount++;
    p.active = true;
    p.x = opts.x;
    p.y = opts.y;
    p.vx = opts.vx ?? 0;
    p.vy = opts.vy ?? 0;
    p.life = opts.life ?? 0.6;
    p.maxLife = p.life;
    p.size = opts.size ?? 3;
    p.color = opts.color ?? '#ffffff';
    p.gravity = opts.gravity ?? 0;
    p.shape = opts.shape ?? 'circle';
    p.spin = opts.spin ?? 0;
    p.rot = opts.rot ?? 0;
    return p;
  }

  /** A radial burst of `count` particles at (x, y). */
  burst(x, y, color, count = 14, opts = {}) {
    const speed = opts.speed ?? 120;
    const spread = opts.spread ?? speed * 0.6;
    for (let i = 0; i < count; i++) {
      const a = (Math.PI * 2 * i) / count + (opts.angleJitter ?? 0.4) * (Math.random() - 0.5);
      const s = speed + (Math.random() - 0.5) * spread;
      this.emit({
        x, y,
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s,
        life: (opts.life ?? 0.55) * (0.7 + Math.random() * 0.6),
        size: (opts.size ?? 3) * (0.6 + Math.random() * 0.8),
        color,
        gravity: opts.gravity ?? 0,
        shape: opts.shape ?? 'circle',
        spin: opts.spin ?? 0,
        rot: Math.random() * Math.PI,
      });
    }
  }

  update(dt) {
    if (this.activeCount === 0) return;
    for (const p of this.particles) {
      if (!p.active) continue;
      p.life -= dt;
      if (p.life <= 0) {
        p.active = false;
        this.activeCount--;
        continue;
      }
      p.vy += p.gravity * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.rot += p.spin * dt;
    }
  }

  draw(ctx) {
    if (this.activeCount === 0) return;
    ctx.save();
    for (const p of this.particles) {
      if (!p.active) continue;
      const a = Math.max(0, Math.min(1, p.life / p.maxLife));
      ctx.globalAlpha = a;
      ctx.fillStyle = p.color;
      if (p.shape === 'square') {
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        const s = p.size * a;
        ctx.fillRect(-s, -s, s * 2, s * 2);
        ctx.restore();
      } else {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * a, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();
  }

  clear() {
    for (const p of this.particles) p.active = false;
    this.activeCount = 0;
  }
}
