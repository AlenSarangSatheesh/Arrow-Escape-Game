/**
 * themes.js — Cosmetic theme catalogue.
 *
 * The actual colors live as CSS custom properties in `styles/tokens.css`; the
 * Canvas renderer reads the resolved values at runtime. This file only declares
 * which themes exist and how they unlock, so gameplay is never affected by the
 * chosen theme.
 */
export const THEMES = Object.freeze([
  { id: 'aurora', label: 'Aurora', description: 'Cool teal and indigo — the default calm.', unlockStars: 0 },
  { id: 'sunset', label: 'Sunset', description: 'Warm corals and amber.', unlockStars: 20 },
  { id: 'forest', label: 'Forest', description: 'Mossy greens and deep pine.', unlockStars: 45 },
  { id: 'neon', label: 'Neon', description: 'High-energy electric night.', unlockStars: 80 },
  { id: 'mono', label: 'Mono', description: 'High-contrast monochrome for clarity.', unlockStars: 120 },
]);

export const DEFAULT_THEME = 'aurora';

export const themeById = (id) => THEMES.find((t) => t.id === id) || THEMES[0];
