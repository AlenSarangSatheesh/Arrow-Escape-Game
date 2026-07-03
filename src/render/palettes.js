/**
 * palettes.js — Bridge between the CSS theme and the Canvas renderer.
 *
 * All colors are defined once, as CSS custom properties in `styles/tokens.css`.
 * The renderer reads the resolved values here so that switching a theme (a class
 * on <html>) automatically retints the board with no duplicated color data.
 * A hardcoded default palette keeps the renderer working in headless contexts.
 */

// paletteKey -> CSS custom property name.
const VARS = {
  boardBg: '--g-board-bg',
  panel: '--g-panel',
  grid: '--g-grid',
  tile: '--g-tile',
  tileEdge: '--g-tile-edge',
  wall: '--g-wall',
  wallEdge: '--g-wall-edge',
  stop: '--g-stop',
  start: '--g-start',
  exit: '--g-exit',
  exitGlow: '--g-exit-glow',
  fakeExit: '--g-fake-exit',
  voidColor: '--g-void',
  arrow: '--g-arrow',
  mirror: '--g-mirror',
  reverse: '--g-reverse',
  rotate: '--g-rotate',
  ice: '--g-ice',
  conveyor: '--g-conveyor',
  oneway: '--g-oneway',
  player: '--g-player',
  playerEdge: '--g-player-edge',
  playerGlow: '--g-player-glow',
  gem: '--g-gem',
  keyColor: '--g-key',
  lock: '--g-lock',
  portalA: '--g-portal-a',
  portalB: '--g-portal-b',
  laser: '--g-laser',
  switchColor: '--g-switch',
  bridge: '--g-bridge',
  mwall: '--g-mwall',
  text: '--g-text',
  accent: '--color-accent',
  danger: '--color-danger',
  star: '--color-star',
};

export const DEFAULT_PALETTE = Object.freeze({
  boardBg: '#141a33',
  panel: '#1b2140',
  grid: 'rgba(255,255,255,0.05)',
  tile: '#222a4e',
  tileEdge: '#2f3968',
  wall: '#10132a',
  wallEdge: '#39427a',
  stop: '#f4b740',
  start: '#7bdff2',
  exit: '#38e8b0',
  exitGlow: 'rgba(56,232,176,0.5)',
  fakeExit: '#6b7299',
  voidColor: '#05060f',
  arrow: '#7aa2ff',
  mirror: '#b39dff',
  reverse: '#ff8fab',
  rotate: '#ffd166',
  ice: '#9fe7ff',
  conveyor: '#8ea0c9',
  oneway: '#88e0a3',
  player: '#ffd36e',
  playerEdge: '#b8862f',
  playerGlow: 'rgba(255,211,110,0.55)',
  gem: '#4ade80',
  keyColor: '#ffd166',
  lock: '#c98b5a',
  portalA: '#b78cff',
  portalB: '#56d0ff',
  laser: '#ff5d73',
  switchColor: '#f2a65a',
  bridge: '#8b6f47',
  mwall: '#5a6285',
  text: '#e7ecff',
  accent: '#7c5cff',
  danger: '#ff5d73',
  star: '#ffcf5c',
  colors: ['#ff5d73', '#4aa3ff', '#46d69b', '#ffcf5c', '#b98cff', '#4fe3e3'],
});

/**
 * Read the active palette from resolved CSS custom properties.
 * @param {HTMLElement} [root]
 * @returns {typeof DEFAULT_PALETTE}
 */
export function readPalette(root) {
  if (typeof getComputedStyle !== 'function' || (typeof document === 'undefined' && !root)) {
    return DEFAULT_PALETTE;
  }
  const el = root || document.documentElement;
  const cs = getComputedStyle(el);
  const get = (v, fallback) => {
    const val = cs.getPropertyValue(v).trim();
    return val || fallback;
  };
  const out = {};
  for (const [key, cssVar] of Object.entries(VARS)) {
    out[key] = get(cssVar, DEFAULT_PALETTE[key]);
  }
  out.colors = [];
  for (let i = 0; i < 6; i++) {
    out.colors[i] = get(`--g-c${i}`, DEFAULT_PALETTE.colors[i]);
  }
  return out;
}
