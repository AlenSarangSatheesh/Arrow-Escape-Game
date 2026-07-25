// Tiny synthesized sound effects — no audio files, so the single-file build stays self-contained.
// The AudioContext is created lazily on the first tap (a user gesture), satisfying autoplay policy.

type Osc = OscillatorType

interface ToneOpts {
  type: Osc
  from: number
  to?: number
  dur: number
  gain: number
  delay?: number
  /** lowpass cutoff, for a duller tone */
  lowpass?: number
}

let ctx: AudioContext | null = null
let muted = false

const KEY = 'arrows.muted.v1'
try {
  muted = localStorage.getItem(KEY) === '1'
} catch {
  /* storage unavailable */
}

function getCtx(): AudioContext | null {
  const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!AC) return null
  if (!ctx) ctx = new AC()
  if (ctx.state === 'suspended') void ctx.resume()
  return ctx
}

function tone(c: AudioContext, o: ToneOpts): void {
  const t0 = c.currentTime + (o.delay ?? 0)
  const osc = c.createOscillator()
  osc.type = o.type
  osc.frequency.setValueAtTime(o.from, t0)
  if (o.to && o.to !== o.from) osc.frequency.exponentialRampToValueAtTime(o.to, t0 + o.dur)

  const g = c.createGain()
  g.gain.setValueAtTime(0.0001, t0)
  g.gain.exponentialRampToValueAtTime(o.gain, t0 + 0.008) // quick attack
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + o.dur) // exponential decay

  if (o.lowpass) {
    const f = c.createBiquadFilter()
    f.type = 'lowpass'
    f.frequency.value = o.lowpass
    osc.connect(f)
    f.connect(g)
  } else {
    osc.connect(g)
  }
  g.connect(c.destination)

  osc.start(t0)
  osc.stop(t0 + o.dur + 0.03)
}

/** Bright rising two-note blip — a legal escape. */
export function playEscape(): void {
  if (muted) return
  const c = getCtx()
  if (!c) return
  tone(c, { type: 'triangle', from: 660, to: 990, dur: 0.1, gain: 0.16 })
  tone(c, { type: 'triangle', from: 990, to: 1320, dur: 0.12, gain: 0.12, delay: 0.07 })
}

/** Low, dull descending thud — a blocked (wrong) tap. */
export function playBlocked(): void {
  if (muted) return
  const c = getCtx()
  if (!c) return
  tone(c, { type: 'sawtooth', from: 190, to: 90, dur: 0.2, gain: 0.16, lowpass: 900 })
}

export function isMuted(): boolean {
  return muted
}

/** Returns the new muted state. */
export function toggleMuted(): boolean {
  muted = !muted
  try {
    localStorage.setItem(KEY, muted ? '1' : '0')
  } catch {
    /* ignore */
  }
  return muted
}
