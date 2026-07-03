/**
 * AudioManager.js — Fully synthesized sound, no binary assets.
 *
 * Every effect is generated with the Web Audio API, so the whole soundtrack adds
 * zero download weight and retints trivially. Audio is created lazily and only
 * after a user gesture (to satisfy autoplay policies) and always respects the
 * player's volume and mute settings.
 */
export class AudioManager {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.sfx = null;
    this.music = null;
    this._musicNodes = null;
    this.settings = { master: 0.8, sfx: 0.9, music: 0.4, muted: false, musicOn: false };
  }

  /** Create the audio graph on first use. Safe to call repeatedly. */
  _ensure() {
    if (this.ctx) return true;
    const Ctor = window.AudioContext || window.webkitAudioContext;
    if (!Ctor) return false;
    this.ctx = new Ctor();
    this.master = this.ctx.createGain();
    this.sfx = this.ctx.createGain();
    this.music = this.ctx.createGain();
    this.sfx.connect(this.master);
    this.music.connect(this.master);
    this.master.connect(this.ctx.destination);
    this._applyVolumes();
    return true;
  }

  /** Resume the context after a user gesture. */
  unlock() {
    if (!this._ensure()) return;
    if (this.ctx.state === 'suspended') this.ctx.resume();
  }

  setSettings(partial) {
    Object.assign(this.settings, partial);
    if (this.ctx) this._applyVolumes();
    if (this.settings.musicOn && !this.settings.muted) this.startMusic();
    else this.stopMusic();
  }

  _applyVolumes() {
    const g = this.settings.muted ? 0 : this.settings.master;
    this.master.gain.value = g;
    this.sfx.gain.value = this.settings.sfx;
    this.music.gain.value = this.settings.music;
  }

  _tone(type, freq, dur, when = 0, gain = 0.3, glideTo = null) {
    const t0 = this.ctx.currentTime + when;
    const osc = this.ctx.createOscillator();
    const env = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (glideTo != null) osc.frequency.exponentialRampToValueAtTime(glideTo, t0 + dur);
    env.gain.setValueAtTime(0.0001, t0);
    env.gain.exponentialRampToValueAtTime(gain, t0 + 0.008);
    env.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(env);
    env.connect(this.sfx);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }

  /** Play a named sound effect. */
  play(name) {
    if (this.settings.muted) return;
    if (!this._ensure()) return;
    if (this.ctx.state === 'suspended') this.ctx.resume();
    switch (name) {
      case 'move':
        this._tone('triangle', 330, 0.09, 0, 0.22);
        break;
      case 'stop':
        this._tone('sine', 200, 0.12, 0, 0.28, 120);
        break;
      case 'redirect':
        this._tone('sine', 660, 0.09, 0, 0.18);
        break;
      case 'win':
        [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => this._tone('triangle', f, 0.16, i * 0.09, 0.24));
        break;
      case 'fail':
        this._tone('sawtooth', 300, 0.32, 0, 0.24, 110);
        break;
      case 'blocked':
        this._tone('square', 150, 0.07, 0, 0.14);
        break;
      case 'ui':
        this._tone('triangle', 880, 0.05, 0, 0.12);
        break;
      case 'star':
        [988, 1319, 1760].forEach((f, i) => this._tone('sine', f, 0.14, i * 0.06, 0.16));
        break;
      case 'unlock':
        [659, 880, 1175].forEach((f, i) => this._tone('triangle', f, 0.2, i * 0.1, 0.2));
        break;
      default:
        break;
    }
  }

  /** Start a soft generative ambient pad. */
  startMusic() {
    if (!this._ensure() || this._musicNodes) return;
    const base = 110;
    const nodes = [];
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 700;
    filter.connect(this.music);
    for (const mult of [1, 1.5, 2.0]) {
      const osc = this.ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = base * mult;
      const g = this.ctx.createGain();
      g.gain.value = 0.08;
      // Slow tremolo for movement.
      const lfo = this.ctx.createOscillator();
      const lfoGain = this.ctx.createGain();
      lfo.frequency.value = 0.05 + Math.random() * 0.06;
      lfoGain.gain.value = 0.04;
      lfo.connect(lfoGain);
      lfoGain.connect(g.gain);
      osc.connect(g);
      g.connect(filter);
      osc.start();
      lfo.start();
      nodes.push(osc, lfo);
    }
    this._musicNodes = nodes;
  }

  stopMusic() {
    if (!this._musicNodes) return;
    for (const n of this._musicNodes) {
      try {
        n.stop();
      } catch {
        /* already stopped */
      }
    }
    this._musicNodes = null;
  }
}
