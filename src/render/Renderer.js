/**
 * Renderer.js — Canvas board renderer.
 *
 * Owns the <canvas>, draws the board and every tile/entity in the active theme,
 * animates the token along its resolved slide path, and emits particle feedback.
 * It is a pure adapter: it reads game state and a palette, and never mutates the
 * engine. The render loop runs only while a board is visible and pauses when
 * idle-and-static (reduced motion) to save battery.
 */
import { Tile, EntityType, DIR_VECTORS, MirrorOrient, COLOR_GLYPHS } from '../core/Constants.js';
import { Camera } from './Camera.js';
import { ParticleSystem } from './ParticleSystem.js';
import { Easing, clamp01 } from './Animator.js';
import { readPalette, DEFAULT_PALETTE } from './palettes.js';

const PER_CELL_MS = 68;
const MIN_ANIM_MS = 130;
const MAX_ANIM_MS = 900;

const DX = DIR_VECTORS.map((v) => v.x);
const DY = DIR_VECTORS.map((v) => v.y);

/** Rounded-rectangle path helper (fallback for older canvas engines). */
function rr(ctx, x, y, w, h, r) {
  const rad = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  if (ctx.roundRect) {
    ctx.roundRect(x, y, w, h, rad);
  } else {
    ctx.moveTo(x + rad, y);
    ctx.arcTo(x + w, y, x + w, y + h, rad);
    ctx.arcTo(x + w, y + h, x, y + h, rad);
    ctx.arcTo(x, y + h, x, y, rad);
    ctx.arcTo(x, y, x + w, y, rad);
    ctx.closePath();
  }
}

export class Renderer {
  /** @param {HTMLCanvasElement} canvas */
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.camera = new Camera();
    this.particles = new ParticleSystem();
    this.palette = DEFAULT_PALETTE;
    this.reducedMotion = false;

    this.level = null;
    this.state = null;
    this.hintDir = null;

    this.cssW = 0;
    this.cssH = 0;
    this._running = false;
    this._raf = 0;
    this._lastTs = 0;
    this._move = null; // active token animation
    this._time = 0; // seconds since start (for idle pulses)
    this._onResize = () => this.resize();
  }

  setPalette(p) {
    this.palette = p || readPalette();
  }

  refreshPalette() {
    this.palette = readPalette();
  }

  setReducedMotion(v) {
    this.reducedMotion = !!v;
  }

  setLevel(level) {
    this.level = level;
    this.particles.clear();
    this._move = null;
    this.resize();
  }

  setState(state) {
    this.state = state;
  }

  setHint(dir) {
    this.hintDir = dir;
  }

  clearHint() {
    this.hintDir = null;
  }

  /* -------------------------------------------------------------- lifecycle */

  start() {
    if (this._running) return;
    this._running = true;
    this.refreshPalette();
    window.addEventListener('resize', this._onResize);
    this.resize();
    this._lastTs = 0;
    this._raf = requestAnimationFrame((ts) => this._loop(ts));
  }

  stop() {
    this._running = false;
    if (this._raf) cancelAnimationFrame(this._raf);
    this._raf = 0;
    window.removeEventListener('resize', this._onResize);
  }

  resize() {
    const cssW = this.canvas.clientWidth || this.canvas.parentElement?.clientWidth || 320;
    const cssH = this.canvas.clientHeight || this.canvas.parentElement?.clientHeight || 320;
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    this.canvas.width = Math.round(cssW * dpr);
    this.canvas.height = Math.round(cssH * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.cssW = cssW;
    this.cssH = cssH;
    if (this.level) this.camera.fit(cssW, cssH, this.level.width, this.level.height);
  }

  _loop(ts) {
    if (!this._running) return;
    const dt = this._lastTs ? Math.min(0.05, (ts - this._lastTs) / 1000) : 0;
    this._lastTs = ts;
    this._time += dt;

    if (this._move) this._advanceMove(ts);
    this.particles.update(dt);
    this.draw();

    this._raf = requestAnimationFrame((t) => this._loop(t));
  }

  /* ------------------------------------------------------------- animation */

  /**
   * Animate the token along a resolved slide path.
   * @param {Array<{x:number,y:number,dir:number,teleport?:boolean}>} path
   * @param {{outcome?:string, onRedirect?:Function}} [opts]
   * @returns {Promise<void>}
   */
  animateMove(path, opts = {}) {
    return new Promise((resolve) => {
      if (!path || path.length <= 1 || this.reducedMotion) {
        this._spawnOutcome(path, opts.outcome);
        resolve();
        return;
      }
      // Build cumulative distances (teleport segments are instantaneous).
      const segs = [];
      let dist = 0;
      for (let i = 1; i < path.length; i++) {
        const jump = !!path[i].teleport;
        const len = jump ? 0 : 1;
        segs.push({ from: path[i - 1], to: path[i], len, at: dist, jump, fired: false });
        dist += len;
      }
      const duration = Math.max(MIN_ANIM_MS, Math.min(MAX_ANIM_MS, dist * PER_CELL_MS));
      this._move = { path, segs, total: dist || 1, duration, startTs: 0, resolve, opts };
      if (!this._running) {
        // Not looping (e.g., off-screen) — resolve immediately at the end state.
        this._spawnOutcome(path, opts.outcome);
        this._move = null;
        resolve();
      }
    });
  }

  _advanceMove(ts) {
    const m = this._move;
    if (!m.startTs) m.startTs = ts;
    const t = clamp01((ts - m.startTs) / m.duration);
    const eased = Easing.inOutCubic(t);
    const target = eased * m.total;

    // Fire sparkles as the token crosses redirect cells.
    for (const seg of m.segs) {
      if (!seg.fired && !seg.jump && target >= seg.at + seg.len * 0.5) {
        seg.fired = true;
        const type = this.level.types[seg.to.y * this.level.width + seg.to.x];
        if (type === Tile.ARROW || type === Tile.MIRROR || type === Tile.REVERSE || type === Tile.ROTATE) {
          const c = this.camera.cellCenter(seg.to.x, seg.to.y);
          this.particles.burst(c.x, c.y, this.palette.arrow, 6, { speed: 60, life: 0.3, size: 2 });
        }
      }
    }

    if (t >= 1) {
      const last = m.path[m.path.length - 1];
      this._tokenPos = { x: last.x, y: last.y };
      this._spawnOutcome(m.path, m.opts.outcome);
      const done = m.resolve;
      this._move = null;
      done();
      return;
    }

    // Interpolate along the segment list.
    let acc = target;
    let pos = m.path[0];
    for (const seg of m.segs) {
      if (seg.jump) {
        pos = seg.to;
        continue;
      }
      if (acc <= seg.len) {
        const f = seg.len ? acc / seg.len : 1;
        pos = { x: seg.from.x + (seg.to.x - seg.from.x) * f, y: seg.from.y + (seg.to.y - seg.from.y) * f };
        break;
      }
      acc -= seg.len;
      pos = seg.to;
    }
    this._tokenPos = pos;
  }

  _spawnOutcome(path, outcome) {
    if (!path || !path.length) return;
    const last = path[path.length - 1];
    const c = this.camera.cellCenter(last.x, last.y);
    if (outcome === 'won') {
      this.particles.burst(c.x, c.y, this.palette.exit, 26, { speed: 180, life: 0.8, size: 4 });
      this.particles.burst(c.x, c.y, this.palette.star, 16, { speed: 120, life: 0.9, size: 3 });
    } else if (outcome === 'fell' || outcome === 'dead') {
      this.particles.burst(c.x, c.y, this.palette.danger, 18, { speed: 140, life: 0.6, size: 3, gravity: 260 });
    } else if (outcome === 'stop') {
      this.particles.burst(c.x, c.y, this.palette.tileEdge, 8, { speed: 70, life: 0.3, size: 2 });
    }
  }

  get animating() {
    return !!this._move || this.particles.activeCount > 0;
  }

  /* ----------------------------------------------------------------- draw */

  draw() {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.cssW, this.cssH);
    if (!this.level) return;

    this._drawBoardPanel(ctx);
    const { width: W, height: H, types, params } = this.level;
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        this._drawCell(ctx, x, y, types[y * W + x], params[y * W + x]);
      }
    }
    this._drawStart(ctx);
    this._drawEntities(ctx);
    this._drawHint(ctx);
    this._drawToken(ctx);
    this.particles.draw(ctx);
  }

  _drawBoardPanel(ctx) {
    const c = this.camera;
    ctx.save();
    ctx.fillStyle = this.palette.boardBg;
    rr(ctx, c.ox - 8, c.oy - 8, c.boardW + 16, c.boardH + 16, 16);
    ctx.fill();
    ctx.restore();
  }

  _drawCell(ctx, x, y, type, param) {
    const { x: px, y: py, s } = this.camera.cellRect(x, y);
    const pal = this.palette;
    const pad = Math.max(1, s * 0.06);
    const ix = px + pad;
    const iy = py + pad;
    const is = s - pad * 2;
    const radius = s * 0.18;

    // Grid separator dot pattern via subtle floor tiles for everything walkable.
    const drawFloor = (fill = pal.tile) => {
      ctx.fillStyle = fill;
      rr(ctx, ix, iy, is, is, radius);
      ctx.fill();
      ctx.strokeStyle = pal.tileEdge;
      ctx.lineWidth = Math.max(1, s * 0.02);
      ctx.stroke();
    };

    switch (type) {
      case Tile.WALL: {
        ctx.fillStyle = pal.wall;
        rr(ctx, px + pad * 0.5, py + pad * 0.5, s - pad, s - pad, radius * 0.7);
        ctx.fill();
        ctx.strokeStyle = pal.wallEdge;
        ctx.lineWidth = Math.max(1, s * 0.02);
        ctx.stroke();
        return;
      }
      case Tile.VOID: {
        ctx.fillStyle = pal.voidColor;
        rr(ctx, ix, iy, is, is, radius);
        ctx.fill();
        return;
      }
      case Tile.EXIT:
        drawFloor();
        this._drawExit(ctx, px, py, s, false);
        return;
      case Tile.FAKE_EXIT:
        drawFloor();
        this._drawExit(ctx, px, py, s, true);
        return;
      case Tile.STOP:
        drawFloor();
        this._ring(ctx, px + s / 2, py + s / 2, s * 0.26, pal.stop, s * 0.06);
        return;
      case Tile.ARROW:
        drawFloor();
        this._chevron(ctx, px + s / 2, py + s / 2, s * 0.24, param, pal.arrow, s * 0.1);
        return;
      case Tile.MIRROR:
        drawFloor(pal.tile);
        this._mirror(ctx, px, py, s, param);
        return;
      case Tile.REVERSE:
        drawFloor();
        this._chevron(ctx, px + s / 2 - s * 0.11, py + s / 2, s * 0.16, 3, pal.reverse, s * 0.09);
        this._chevron(ctx, px + s / 2 + s * 0.11, py + s / 2, s * 0.16, 1, pal.reverse, s * 0.09);
        return;
      case Tile.ROTATE: {
        drawFloor();
        const dir = this.state?.rotations?.get(y * this.level.width + x) ?? param;
        this._ring(ctx, px + s / 2, py + s / 2, s * 0.2, pal.rotate, s * 0.05);
        this._chevron(ctx, px + s / 2, py + s / 2, s * 0.16, dir, pal.rotate, s * 0.08);
        return;
      }
      case Tile.ICE:
        drawFloor(pal.ice);
        ctx.globalAlpha = 0.35;
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = Math.max(1, s * 0.03);
        ctx.beginPath();
        ctx.moveTo(ix + is * 0.2, iy + is * 0.6);
        ctx.lineTo(ix + is * 0.5, iy + is * 0.25);
        ctx.stroke();
        ctx.globalAlpha = 1;
        return;
      case Tile.CONVEYOR:
        drawFloor(pal.conveyor);
        this._chevron(ctx, px + s / 2, py + s / 2, s * 0.16, param, pal.tile, s * 0.08);
        return;
      case Tile.ONEWAY:
        drawFloor();
        this._chevron(ctx, px + s / 2, py + s / 2, s * 0.2, param, pal.oneway, s * 0.09);
        return;
      case Tile.COLOR_GATE:
      case Tile.LOCK: {
        drawFloor();
        const color = (this.palette.colors && this.palette.colors[param]) || pal.lock;
        this._ring(ctx, px + s / 2, py + s / 2, s * 0.26, color, s * 0.07);
        this._glyph(ctx, px + s / 2, py + s / 2, s * 0.28, type === Tile.LOCK ? '⚿' : (COLOR_GLYPHS[param] || '◆'), color);
        return;
      }
      default:
        drawFloor();
    }
  }

  _drawExit(ctx, px, py, s, fake) {
    const cx = px + s / 2;
    const cy = py + s / 2;
    const pal = this.palette;
    const pulse = this.reducedMotion ? 0.5 : 0.5 + 0.5 * Math.sin(this._time * 3);
    if (!fake) {
      ctx.save();
      ctx.shadowColor = pal.exitGlow;
      ctx.shadowBlur = s * (0.3 + 0.25 * pulse);
      this._ring(ctx, cx, cy, s * 0.3, pal.exit, s * 0.08);
      this._ring(ctx, cx, cy, s * (0.14 + 0.05 * pulse), pal.exit, s * 0.05);
      ctx.restore();
    } else {
      ctx.save();
      ctx.setLineDash([s * 0.1, s * 0.08]);
      this._ring(ctx, cx, cy, s * 0.3, pal.fakeExit, s * 0.06);
      ctx.restore();
    }
  }

  _drawStart(ctx) {
    if (!this.level?.start) return;
    const c = this.camera.cellCenter(this.level.start.x, this.level.start.y);
    const s = this.camera.cell;
    ctx.save();
    ctx.globalAlpha = 0.5;
    this._ring(ctx, c.x, c.y, s * 0.3, this.palette.start, s * 0.04);
    ctx.restore();
  }

  _drawEntities(ctx) {
    const level = this.level;
    const s = this.camera.cell;
    const pal = this.palette;
    const phase = this.state?.moveCount ?? 0;

    // Lasers (beams) beneath movers so token/particles read clearly.
    for (const e of level.lookup.lasers) {
      this._drawLaser(ctx, e, phase);
    }

    for (const e of level.entities) {
      const c = this.camera.cellCenter(e.x, e.y);
      switch (e.type) {
        case EntityType.PORTAL: {
          const color = (e.channel ?? 0) % 2 === 0 ? pal.portalA : pal.portalB;
          this._ring(ctx, c.x, c.y, s * 0.3, color, s * 0.07);
          this._ring(ctx, c.x, c.y, s * 0.16, color, s * 0.05);
          break;
        }
        case EntityType.GEM: {
          if (this.state?.collected?.has(e.id)) break;
          this._diamond(ctx, c.x, c.y, s * 0.22, pal.gem);
          break;
        }
        case EntityType.KEY: {
          if (this.state?.keys?.has(e.color)) break;
          const color = pal.colors[e.color] || pal.keyColor;
          this._glyph(ctx, c.x, c.y, s * 0.4, '🔑', color);
          break;
        }
        case EntityType.PAINT: {
          const color = pal.colors[e.color] || pal.accent;
          this._diamond(ctx, c.x, c.y, s * 0.2, color);
          break;
        }
        case EntityType.SWITCH: {
          const on = this._groupActive(e.targets ? e.targets[0] : e.group);
          this._ring(ctx, c.x, c.y, s * 0.22, pal.switchColor, s * 0.06);
          ctx.fillStyle = on ? pal.switchColor : pal.tileEdge;
          ctx.beginPath();
          ctx.arc(c.x, c.y, s * 0.1, 0, Math.PI * 2);
          ctx.fill();
          break;
        }
        case EntityType.TOGGLE: {
          const active = this._toggleActive(e);
          if (e.mode === 'bridge') {
            if (active) {
              ctx.fillStyle = pal.bridge;
              const r = this.camera.cellRect(e.x, e.y);
              rr(ctx, r.x + s * 0.1, r.y + s * 0.1, s * 0.8, s * 0.8, s * 0.15);
              ctx.fill();
            }
          } else if (active) {
            ctx.fillStyle = pal.mwall;
            const r = this.camera.cellRect(e.x, e.y);
            rr(ctx, r.x + s * 0.08, r.y + s * 0.08, s * 0.84, s * 0.84, s * 0.12);
            ctx.fill();
          }
          break;
        }
        case EntityType.TWALL: {
          if (this._timedClosed(e, phase)) {
            ctx.fillStyle = pal.mwall;
            const r = this.camera.cellRect(e.x, e.y);
            rr(ctx, r.x + s * 0.08, r.y + s * 0.08, s * 0.84, s * 0.84, s * 0.12);
            ctx.fill();
          } else {
            this._ring(ctx, c.x, c.y, s * 0.28, pal.mwall, s * 0.04);
          }
          break;
        }
        case EntityType.CHARGE: {
          this._chevron(ctx, c.x, c.y, s * 0.18, e.dir, pal.rotate, s * 0.08);
          break;
        }
        default:
          break;
      }
    }

    // Moving walls on top (they occupy a computed cell).
    for (const w of level.lookup.movingWalls) {
      const cell = this._movingWallCell(w, phase);
      const r = this.camera.cellRect(cell.x, cell.y);
      ctx.fillStyle = pal.mwall;
      rr(ctx, r.x + s * 0.06, r.y + s * 0.06, s * 0.88, s * 0.88, s * 0.12);
      ctx.fill();
    }
  }

  _drawLaser(ctx, laser, phase) {
    if (!this._laserActive(laser)) return;
    const W = this.level.width;
    const H = this.level.height;
    let x = laser.x;
    let y = laser.y;
    let dir = laser.dir;
    const pts = [this.camera.cellCenter(x, y)];
    let guard = W * H * 2;
    while (guard-- > 0) {
      x += DX[dir];
      y += DY[dir];
      if (x < 0 || y < 0 || x >= W || y >= H) break;
      const t = this.level.types[y * W + x];
      if (t === Tile.WALL) break;
      pts.push(this.camera.cellCenter(x, y));
      if (t === Tile.MIRROR) {
        const p = this.level.params[y * W + x];
        dir = p === MirrorOrient.SLASH ? [1, 0, 3, 2][dir] : [3, 2, 1, 0][dir];
      }
    }
    ctx.save();
    ctx.strokeStyle = this.palette.laser;
    ctx.globalAlpha = 0.8;
    ctx.lineWidth = Math.max(2, this.camera.cell * 0.08);
    ctx.shadowColor = this.palette.laser;
    ctx.shadowBlur = this.camera.cell * 0.3;
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (const p of pts) ctx.lineTo(p.x, p.y);
    ctx.stroke();
    ctx.restore();
  }

  _drawHint(ctx) {
    if (this.hintDir == null || !this.state) return;
    const c = this.camera.cellCenter(this.state.player.x, this.state.player.y);
    const s = this.camera.cell;
    const pulse = this.reducedMotion ? 0 : Math.sin(this._time * 6) * s * 0.08;
    const off = s * 0.55 + pulse;
    const hx = c.x + DX[this.hintDir] * off;
    const hy = c.y + DY[this.hintDir] * off;
    ctx.save();
    ctx.globalAlpha = 0.9;
    this._chevron(ctx, hx, hy, s * 0.22, this.hintDir, this.palette.accent, s * 0.1);
    ctx.restore();
  }

  _drawToken(ctx) {
    if (!this.state) return;
    const pos = this._move ? this._tokenPos : this.state.player;
    if (!pos) return;
    const c = this.camera.cellCenter(pos.x, pos.y);
    const s = this.camera.cell;
    const pal = this.palette;
    const breathe = this.reducedMotion || this._move ? 0 : Math.sin(this._time * 2.5) * s * 0.015;
    const r = s * 0.3 + breathe;

    ctx.save();
    ctx.shadowColor = pal.playerGlow;
    ctx.shadowBlur = s * 0.4;
    const grad = ctx.createRadialGradient(c.x - r * 0.3, c.y - r * 0.3, r * 0.1, c.x, c.y, r);
    grad.addColorStop(0, '#ffffff');
    grad.addColorStop(0.25, pal.player);
    grad.addColorStop(1, pal.playerEdge);
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(c.x, c.y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  /* --------------------------------------------------------- draw helpers */

  _ring(ctx, cx, cy, radius, color, width) {
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.stroke();
  }

  _chevron(ctx, cx, cy, size, dir, color, width) {
    // Chevron pointing in `dir`. Base drawn pointing right, then rotated.
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate((dir * Math.PI) / 2 - Math.PI / 2); // dir 0=up baseline
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(-size, size * 0.55);
    ctx.lineTo(0, -size * 0.55);
    ctx.lineTo(size, size * 0.55);
    ctx.stroke();
    ctx.restore();
  }

  _mirror(ctx, px, py, s, orient) {
    ctx.save();
    ctx.strokeStyle = this.palette.mirror;
    ctx.lineWidth = s * 0.1;
    ctx.lineCap = 'round';
    ctx.shadowColor = this.palette.mirror;
    ctx.shadowBlur = s * 0.15;
    ctx.beginPath();
    if (orient === MirrorOrient.SLASH) {
      ctx.moveTo(px + s * 0.28, py + s * 0.72);
      ctx.lineTo(px + s * 0.72, py + s * 0.28);
    } else {
      ctx.moveTo(px + s * 0.28, py + s * 0.28);
      ctx.lineTo(px + s * 0.72, py + s * 0.72);
    }
    ctx.stroke();
    ctx.restore();
  }

  _diamond(ctx, cx, cy, r, color) {
    ctx.save();
    ctx.fillStyle = color;
    ctx.shadowColor = color;
    ctx.shadowBlur = r * 0.8;
    ctx.beginPath();
    ctx.moveTo(cx, cy - r);
    ctx.lineTo(cx + r, cy);
    ctx.lineTo(cx, cy + r);
    ctx.lineTo(cx - r, cy);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  _glyph(ctx, cx, cy, size, glyph, color) {
    ctx.save();
    ctx.fillStyle = color;
    ctx.font = `${size}px system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(glyph, cx, cy);
    ctx.restore();
  }

  /* ---------------------------------------------- dynamic-state predicates */

  _groupActive(group) {
    return this.state?.groups?.get(group) ?? false;
  }

  _toggleActive(e) {
    return this._groupActive(e.group ?? 0) !== !!e.invert;
  }

  _laserActive(laser) {
    if (laser.group == null) return laser.on !== false;
    return this._groupActive(laser.group) !== !!laser.invert;
  }

  _timedClosed(d, phase) {
    const period = Math.max(1, d.period ?? 2);
    const openFor = d.openFor ?? (Math.floor(period / 2) || 1);
    return ((phase + (d.phase || 0)) % period) >= openFor;
  }

  _movingWallCell(w, phase) {
    const from = w.from ?? 0;
    const to = w.to ?? 0;
    const span = to - from;
    let pos = from;
    if (span > 0) {
      const period = 2 * span;
      const m = ((phase + (w.phase || 0)) % period + period) % period;
      pos = from + (m <= span ? m : period - m);
    }
    return w.axis === 1 ? { x: w.line, y: pos } : { x: pos, y: w.line };
  }

  /** Convert client coordinates to a board cell (for the editor). */
  pickCell(clientX, clientY) {
    const rect = this.canvas.getBoundingClientRect();
    return this.camera.screenToCell(clientX - rect.left, clientY - rect.top);
  }
}
