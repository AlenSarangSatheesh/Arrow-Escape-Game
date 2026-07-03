# Art Direction & Design System — Arrow Escape

> **Status:** Authoritative for all visual work.
> **Audience:** Contributors touching rendering, UI, themes, iconography, or motion.
> **Companion docs:** `LEVEL_FORMAT.md`, `UX_SPEC.md`, `ARCHITECTURE.md`.

This document is the visual counterpart to the design brief. It formalizes the look, feel, and
design-token system of Arrow Escape so that every screen, tile, and animation feels like it came
from one hand. If you are adding a new mechanic, a new screen, or a new theme, this is the contract
you build against.

---

## Table of contents

1. [Visual identity & mood](#1-visual-identity--mood)
2. [The token system](#2-the-token-system)
3. [Color: themes & semantic roles](#3-color-themes--semantic-roles)
4. [Spacing, radius, elevation, z-index](#4-spacing-radius-elevation-z-index)
5. [Typography](#5-typography)
6. [Motion & transitions](#6-motion--transitions)
7. [Component styles](#7-component-styles)
8. [Iconography](#8-iconography)
9. [Game object visual spec](#9-game-object-visual-spec)
10. [Particles & feedback effects](#10-particles--feedback-effects)
11. [Shadow & gradient language](#11-shadow--gradient-language)
12. [Do / Don't](#12-do--dont)
13. [Accessibility](#13-accessibility)

---

## 1. Visual identity & mood

Arrow Escape is a **calm, premium, tactile** logic puzzler. The reference points are Monument
Valley and Mekorama for their serene, sculptural surfaces, married to the crisp, legible logic of a
Zachtronics board. Nothing shouts. Everything reads.

**Mood keywords:** soft geometric minimalism · rounded · tactile · restrained · luminous · quiet
confidence.

**The five pillars of the look:**

| Pillar | What it means in practice |
| --- | --- |
| **Rounded geometry** | Tiles, chips, chevrons and cards use generous corner radii. No hard 90° corners on interactive surfaces. |
| **Soft depth** | Depth comes from long, low-opacity shadows and a hint of inner light — never harsh drop shadows or skeuomorphic bevels. |
| **Restrained color** | Each theme is a tight, harmonious palette. Color is a scarce resource spent on meaning (player, exit, active state), not decoration. |
| **Generous negative space** | Boards breathe. Padding is deliberate. Density is the enemy of calm. |
| **Delightful micro-motion** | Squash, bounce, shimmer, pulse — small, physical, purposeful. Motion confirms; it never distracts. |

**The one-line brand test:** *If a frame feels loud, cramped, or literal, it is off-brand.* Soften
it, space it out, or remove color until the logic is what draws the eye.

```
        ┌─────────────────────────────────────────────┐
        │   quiet background gradient + faint grid     │
        │                                              │
        │        ╭─────╮   ↑    ╭─────╮                │
        │        │ ▢▢▢ │  ███   │ ◎◎◎ │   ← exit ring  │
        │        ╰─────╯        ╰─────╯                │
        │           player      wall                   │
        │                                              │
        │   negative space is a feature, not a gap     │
        └─────────────────────────────────────────────┘
```

---

## 2. The token system

All visual constants live as **design tokens** — a single, themeable source of truth consumed by
both the DOM UI (CSS custom properties) and the Canvas renderer (a resolved JS token object). No
component hard-codes a hex value, a pixel radius, or a duration. This keeps themes cosmetic and
save-safe, exactly as the brief requires: *theme changes palette tokens only; gameplay identical.*

**Token layers (from raw to semantic):**

```
  ┌────────────────┐    ┌────────────────────┐    ┌───────────────────────┐
  │  Primitive      │ →  │  Semantic           │ →  │  Component              │
  │  --teal-500     │    │  --color-accent     │    │  --btn-primary-bg       │
  │  --space-3      │    │  --color-surface    │    │  --card-radius          │
  │  16px, #2DD4BF  │    │  role, not value    │    │  reads semantic tokens  │
  └────────────────┘    └────────────────────┘    └───────────────────────┘
        theme-defined         theme-mapped              theme-agnostic
```

- **Primitive tokens** are the raw palette and scales. They differ per theme.
- **Semantic tokens** name a *role* (`--color-danger`, `--color-surface`, `--color-accent`).
  Components only ever reference semantic (and component) tokens, never primitives.
- **Component tokens** compose semantics for a specific widget.

**Consumption contract:**

```js
// data/theme.js — resolved token object, injected (never a global).
export const resolveTheme = (themeId) => {
  const t = THEMES[themeId] ?? THEMES.aurora;
  applyCssVariables(t);   // sets --color-*, --space-*, etc. on :root for DOM UI
  return t;               // returned to the Canvas renderer for board drawing
};
```

Rules:

- The renderer receives the **resolved** token object at theme-change time and caches derived
  sprites; it never reads the DOM.
- Reduced-motion and colorblind palette selections are **also** tokens (see §13) — they compose on
  top of the theme, they do not fork it.
- Every token below has a concrete example value. Themes override the *values*, never the *names*.

---

## 3. Color: themes & semantic roles

Five cosmetic themes ship. **Aurora** is the default. Each is a full palette; the game is identical
across all of them.

### 3.1 Theme palettes (primitive tokens)

Each theme defines the same 12 palette slots. Values are illustrative and tuned for contrast — see
§13 for the contrast targets they must satisfy.

#### Aurora (default — cool teal / indigo, light)

| Token | Hex | Role hint |
| --- | --- | --- |
| `--bg-0` | `#0E1220` | Deepest backdrop (parallax base) |
| `--bg-1` | `#EEF2F8` | App background |
| `--surface-1` | `#FFFFFF` | Cards, panels |
| `--surface-2` | `#F5F8FC` | Raised inner surface |
| `--board` | `#E7EDF6` | Board field |
| `--tile` | `#FDFEFF` | Floor tile |
| `--ink-1` | `#1A2233` | Primary text |
| `--ink-2` | `#5A6478` | Secondary text |
| `--accent` | `#2DD4BF` | Player / primary action (teal) |
| `--accent-2` | `#6366F1` | Secondary accent (indigo) |
| `--success` | `#22C55E` | Exit / win |
| `--danger` | `#F43F5E` | Hazard / fail |

#### Sunset (warm, light)

| Token | Hex | Token | Hex |
| --- | --- | --- | --- |
| `--bg-1` | `#FBF1E9` | `--ink-1` | `#2A1D18` |
| `--surface-1` | `#FFF9F4` | `--ink-2` | `#7A6559` |
| `--board` | `#F3E3D6` | `--accent` | `#FB7185` |
| `--tile` | `#FFFCF9` | `--accent-2` | `#F59E0B` |
| `--bg-0` | `#2A1A22` | `--success` | `#16A34A` |
| `--surface-2` | `#FDF3EB` | `--danger` | `#DC2626` |

#### Mono (high-contrast / print)

| Token | Hex | Token | Hex |
| --- | --- | --- | --- |
| `--bg-1` | `#FFFFFF` | `--ink-1` | `#000000` |
| `--surface-1` | `#FFFFFF` | `--ink-2` | `#3A3A3A` |
| `--board` | `#F0F0F0` | `--accent` | `#111111` |
| `--tile` | `#FFFFFF` | `--accent-2` | `#555555` |
| `--bg-0` | `#000000` | `--success` | `#1B5E20` |
| `--surface-2` | `#F7F7F7` | `--danger` | `#B00020` |

> Mono leans on shape, pattern, and weight rather than hue — it doubles as the accessibility
> high-contrast baseline and as a print/screenshot-friendly skin.

#### Forest (deep green, light-earthy)

| Token | Hex | Token | Hex |
| --- | --- | --- | --- |
| `--bg-1` | `#EAF2EA` | `--ink-1` | `#182619` |
| `--surface-1` | `#FBFDFA` | `--ink-2` | `#4E5E4F` |
| `--board` | `#DCE9DB` | `--accent` | `#2F9E6E` |
| `--tile` | `#FCFEFB` | `--accent-2` | `#8B5E3C` |
| `--bg-0` | `#0F1A12` | `--success` | `#3FAE5A` |
| `--surface-2` | `#F1F7EF` | `--danger` | `#E4572E` |

#### Neon (dark)

| Token | Hex | Token | Hex |
| --- | --- | --- | --- |
| `--bg-1` | `#0B0F1A` | `--ink-1` | `#EAF0FF` |
| `--surface-1` | `#141A2B` | `--ink-2` | `#8A94B0` |
| `--board` | `#101627` | `--accent` | `#22D3EE` |
| `--tile` | `#1A2236` | `--accent-2` | `#A855F7` |
| `--bg-0` | `#05070E` | `--success` | `#4ADE80` |
| `--surface-2` | `#1B2338` | `--danger` | `#FB7185` |

> Neon is the only default-dark theme. Glows are stronger (higher shadow blur, additive-feel
> highlights), but must still respect reduced-motion by dropping animated bloom.

### 3.2 Semantic color roles

Components reference these. Each maps onto theme primitives; the mapping is what changes per theme.

| Semantic token | Maps to (Aurora) | Used for |
| --- | --- | --- |
| `--color-bg` | `--bg-1` | App/page background |
| `--color-surface` | `--surface-1` | Panels, cards, modals |
| `--color-surface-raised` | `--surface-2` | Nested/raised surfaces |
| `--color-board` | `--board` | Play-field field color |
| `--color-tile` | `--tile` | Floor tiles |
| `--color-text` | `--ink-1` | Primary text |
| `--color-text-muted` | `--ink-2` | Secondary/label text |
| `--color-accent` | `--accent` | Player token, primary buttons, focus |
| `--color-accent-2` | `--accent-2` | Secondary emphasis, links |
| `--color-success` | `--success` | Exit, win state, 3-star |
| `--color-danger` | `--danger` | Hazards, fail, destructive actions |
| `--color-warning` | `#F59E0B`* | Timed/caution states |
| `--color-border` | `rgba(ink-1, .08)` | Hairline separators |
| `--color-overlay` | `rgba(bg-0, .55)` | Modal scrim |
| `--color-focus-ring` | `--accent` @ 2px | Keyboard focus outline |

\* `--color-warning` is theme-tuned but always a distinct amber/orange that survives all colorblind
palettes (paired with a caution icon — never color alone).

**Mechanic color roles** (for keys, locks, color gates — always paired with a shape/symbol, §13):

| Role token | Aurora hex | Encoded shape/pattern |
| --- | --- | --- |
| `--mech-red` | `#EF4444` | ● solid circle + diagonal hatch |
| `--mech-blue` | `#3B82F6` | ■ square + dots |
| `--mech-green` | `#22C55E` | ▲ triangle + vertical lines |
| `--mech-yellow` | `#EAB308` | ◆ diamond + cross-hatch |
| `--mech-purple` | `#A855F7` | ⬟ pentagon + rings |

---

## 4. Spacing, radius, elevation, z-index

### 4.1 Spacing scale (4px base)

A single geometric-ish scale. Use tokens, never raw pixels.

| Token | px | Typical use |
| --- | --- | --- |
| `--space-0` | 0 | Reset |
| `--space-1` | 4 | Icon-to-label gap, hairline insets |
| `--space-2` | 8 | Chip padding, tight stacks |
| `--space-3` | 12 | Control internal padding |
| `--space-4` | 16 | Default gap / card padding |
| `--space-5` | 24 | Section spacing |
| `--space-6` | 32 | Panel padding, modal inset |
| `--space-7` | 48 | Screen gutters |
| `--space-8` | 64 | Hero / splash rhythm |

### 4.2 Radius scale

| Token | px | Use |
| --- | --- | --- |
| `--radius-xs` | 4 | Tags, tiny chips |
| `--radius-sm` | 8 | Inputs, toggles |
| `--radius-md` | 12 | Buttons, HUD chips |
| `--radius-lg` | 16 | Cards, panels |
| `--radius-xl` | 24 | Modals, sheets |
| `--radius-tile` | 20% of cell | Board tiles (relative to cell size) |
| `--radius-pill` | 999px | Pills, sliders, star track |
| `--radius-full` | 50% | Player chip, portals, dots |

### 4.3 Elevation / shadow tiers

Soft, long, low-opacity. Shadow color is `--bg-0` at low alpha (dark, theme-tinted), never pure
black. Neon adds a colored accent glow layer on interactive elements.

| Token | Value (Aurora) | Use |
| --- | --- | --- |
| `--elev-0` | `none` | Flush surfaces, board field |
| `--elev-1` | `0 1px 2px rgba(14,18,32,.06), 0 1px 1px rgba(14,18,32,.04)` | Tiles, resting chips |
| `--elev-2` | `0 4px 12px rgba(14,18,32,.08), 0 1px 3px rgba(14,18,32,.05)` | Cards, HUD chips, buttons |
| `--elev-3` | `0 12px 28px rgba(14,18,32,.14), 0 4px 8px rgba(14,18,32,.08)` | Popovers, toasts |
| `--elev-4` | `0 24px 60px rgba(14,18,32,.22), 0 8px 16px rgba(14,18,32,.12)` | Modals, sheets |
| `--elev-glow` | `0 0 24px rgba(var(--accent-rgb), .45)` | Player, exit, focus (Neon amplifies) |

> **Inner light:** raised surfaces may add a `1px` inset top highlight
> (`inset 0 1px 0 rgba(255,255,255,.6)` on light themes) for the tactile "soft plastic" read.
> Reduced-motion does not affect shadows; it affects *animated* glow only.

### 4.4 Z-index layers

A fixed, documented stack. Do not invent intermediate values inline.

| Token | Value | Layer |
| --- | --- | --- |
| `--z-board` | 0 | Canvas board |
| `--z-board-fx` | 10 | Particle/FX canvas overlay |
| `--z-hud` | 100 | In-game HUD chips & controls |
| `--z-nav` | 200 | Top nav / back buttons |
| `--z-popover` | 400 | Tooltips, coach marks, hint flash |
| `--z-toast` | 500 | Toasts / live-region banners |
| `--z-overlay` | 800 | Modal scrim |
| `--z-modal` | 900 | Modals, sheets, pause menu |
| `--z-loader` | 1000 | Loading / splash / transition curtain |

---

## 5. Typography

One geometric sans for everything, with a robust system fallback so the critical path stays tiny
(brief: `<100KB` critical path). **Tabular numerals** are mandatory on every counter (moves, par,
timer, stars, score, coordinates) so digits do not jitter as they change.

### 5.1 Font stack

```css
--font-ui:
  "Inter", ui-sans-serif, "SF Pro Text", "Segoe UI", Roboto,
  system-ui, -apple-system, "Helvetica Neue", Arial, sans-serif;

--font-numeric: var(--font-ui);         /* same family */
font-variant-numeric: tabular-nums;      /* on all counters */
font-feature-settings: "tnum" 1, "cv01" 1;
```

- Inter is preferred but **never blocking**; the system stack renders instantly and Inter swaps in
  with `font-display: swap`. No layout shift because metrics are close and counters are tabular.
- No secondary display face. Hierarchy comes from **size + weight + color**, not from mixing fonts.

### 5.2 Type scale

| Token | Size / line-height | Weight | Use |
| --- | --- | --- | --- |
| `--text-display` | 40 / 44 | 800 | Splash / win title |
| `--text-h1` | 32 / 38 | 700 | Screen titles |
| `--text-h2` | 24 / 30 | 700 | Section headings |
| `--text-h3` | 20 / 26 | 600 | Card titles |
| `--text-body-lg` | 18 / 28 | 500 | Intro copy, dialog body |
| `--text-body` | 16 / 24 | 400 | Default body |
| `--text-label` | 14 / 20 | 600 | Buttons, labels, HUD chips |
| `--text-caption` | 12 / 16 | 500 | Captions, meta, tags |
| `--text-num-hud` | 20 / 24 | 700 · **tnum** | HUD counters (moves, timer) |
| `--text-num-big` | 48 / 52 | 800 · **tnum** | Level-complete stat numbers |

**Rules:**

- Headings use `--color-text`; supporting copy uses `--color-text-muted`.
- Letter-spacing: `-0.01em` on `h1`/`h2`/display for a tighter, friendlier read; `0` elsewhere.
- Max line length for prose: ~66ch.
- Never set counters in a proportional-figure context.

---

## 6. Motion & transitions

Motion is physical and consistent. Three duration tiers cover the entire product (brief:
`150/250/400ms`).

### 6.1 Timing tiers

| Token | Duration | Use |
| --- | --- | --- |
| `--dur-fast` | 150ms | Input feedback: button press, chip tap, hover, toggle flip, focus ring. |
| `--dur-base` | 250ms | Standard transitions: card enter, HUD update, toast in/out, tab switch. |
| `--dur-slow` | 400ms | Screen transitions, modal open, level intro, win celebration staging. |

### 6.2 Easing

| Token | Curve | Use |
| --- | --- | --- |
| `--ease-out` | `cubic-bezier(0.16, 1, 0.3, 1)` | Entrances (spring-like ease-out). |
| `--ease-in-out` | `cubic-bezier(0.65, 0, 0.35, 1)` | Transitions between two states/screens. |
| `--ease-snap` | `cubic-bezier(0.34, 1.56, 0.64, 1)` | Snappy feedback with a tiny overshoot (chip stop bounce, button press-release). |
| `--ease-linear` | `linear` | Continuous loops (shimmer, portal spin, conveyor). |

### 6.3 Motion language

- **Entrances:** ease-out spring, slight scale from `0.96 → 1` + fade.
- **Transitions:** ease-in-out cross-move or cross-fade.
- **Feedback:** fast + snap; the token squashes on launch, stretches in flight, bounces on stop.
- **Loops:** linear, subtle, low-amplitude (idle shimmer, exit pulse).

```
launch:   ▢  →  ▬  (squash)  →  ▯  (stretch, in flight)  →  ▢  (bounce on stop, ease-snap)
timing:      150ms feedback   |   travel = per-tile step  |   250→400ms celebrate on win
```

- **Reduced motion:** parallax and particles off; travel tweens shortened and cross-faded; loops
  paused; `--ease-snap` overshoot removed (falls back to `--ease-out`). Nothing essential is lost —
  every animated cue has a static equivalent.

---

## 7. Component styles

All components read semantic/component tokens only. Minimum interactive target is **44×44px**.

### 7.1 Buttons

Three variants: **primary** (accent fill), **secondary** (surface + border), **ghost** (text-only).
All share the same geometry and state machine.

| Property | Value |
| --- | --- |
| Radius | `--radius-md` (12px) |
| Padding | `--space-3` × `--space-5` (12/24) |
| Text | `--text-label` (14/600) |
| Min height | 44px |
| Elevation | `--elev-2` (primary/secondary), `none` (ghost) |
| Transition | `--dur-fast` `--ease-snap` |

**State matrix:**

| State | Primary | Secondary | Ghost |
| --- | --- | --- | --- |
| Default | accent bg, on-accent text | surface bg, border, text | transparent, accent text |
| Hover | +6% brightness, `--elev-2→3` | surface-raised bg | 8% accent tint bg |
| Active/press | scale `0.97`, shadow inset feel | scale `0.97` | scale `0.97` |
| Focus-visible | 2px `--color-focus-ring` outline, 2px offset | same | same |
| Disabled | 40% opacity, no shadow, no pointer | 40% opacity | 40% opacity |
| Loading | spinner replaces label, width locked | — | — |

> On-accent text color is chosen per theme to meet ≥4.5:1 (see §13). Never assume white.

### 7.2 Panels / cards

- Background `--color-surface`, radius `--radius-lg` (16px), padding `--space-6` (32px),
  elevation `--elev-2`.
- Optional 1px top inset highlight for tactile depth.
- Title `--text-h3`; body `--text-body`; meta `--text-caption` in `--color-text-muted`.
- Level-select cards show a mini-board thumbnail, star row, and best-moves badge.

```
╭──────────────────────────────╮
│  World 2 · Level 07           │   ← --text-caption, muted
│  ┌────────┐                   │
│  │ ▢ → ◎ │   ★ ★ ☆            │   ← thumbnail + star row
│  └────────┘   Best: 6 moves   │
╰──────────────────────────────╯   radius-lg, elev-2
```

### 7.3 Modals / sheets

- Scrim `--color-overlay` at `--z-overlay`; content at `--z-modal`.
- Radius `--radius-xl` (24px), padding `--space-6`, elevation `--elev-4`, max-width ~480px, centered
  (desktop) or bottom-sheet (mobile, slides up).
- Enter: `--dur-slow` `--ease-out`, scale `0.96→1` + fade; scrim fades `--dur-base`.
- Dismiss on Esc, scrim click, and an explicit close button (44px). Focus trapped; focus returns to
  the invoking control on close.

### 7.4 Toasts

- Bottom-center (desktop) / above thumb (mobile), `--z-toast`, radius `--radius-lg`, elevation
  `--elev-3`, padding `--space-3`/`--space-4`.
- Leading status icon + `--text-body`. Success/danger/info variants tint the icon and a 3px leading
  bar — **never** the whole surface (keeps contrast and colorblind-safety).
- Auto-dismiss 3–4s; enter/exit `--dur-base`. Also mirrored to an ARIA live region.

### 7.5 HUD chips

Compact pill readouts for moves, par, timer, gems.

| Property | Value |
| --- | --- |
| Shape | pill (`--radius-pill`), height 32–40px |
| Padding | `--space-2`/`--space-3` |
| Content | icon + `--text-num-hud` (**tabular**) |
| Surface | `--color-surface` @ ~85% + backdrop blur, `--elev-2` |
| Update anim | value scales `1→1.12→1` on change, `--dur-fast` `--ease-snap` |

```
┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐
│ ↻  4/6   │  │ ⏱ 00:37  │  │ 💎 2/3   │  │ ★ ★ ☆   │
└──────────┘  └──────────┘  └──────────┘  └──────────┘
   moves/par     timer        gems           stars
```

### 7.6 Star display

- Three stars on a `--radius-pill` track. Earned stars use `--color-success` (or the mechanic-gold
  `#FBBF24` accent), unearned are `--color-text-muted` outlines.
- **Never color-only:** earned = filled solid shape; unearned = hollow outline. The difference is
  legible in Mono and all colorblind palettes.
- Level-complete: stars pop in sequentially, `--dur-base` staggered ~120ms each, `--ease-snap`, with
  a particle burst per star (suppressed under reduced motion → simple fade-in).

### 7.7 Toggles & sliders

**Toggle (switch):**

- Track `--radius-pill`, 44×24; knob `--radius-full`.
- Off: track `--color-border`, knob `--color-surface`. On: track `--color-accent`, knob white.
- Knob travels `--dur-fast` `--ease-snap`. **State also shown by knob position + an on/off glyph**
  (✓ / ✕), not color alone.

**Slider:**

- Track `--radius-pill`, 4px; filled portion `--color-accent`; thumb `--radius-full` 20px with
  `--elev-2`.
- Focus-visible ring on thumb; keyboard arrow steps; value announced via live region.
- Used for audio/music/sfx volumes and UI scale.

---

## 8. Iconography

- **Single line style:** 2px stroke, rounded caps and joins, drawn on a 24×24 grid with ~2px
  padding. Geometric, friendly, matches the type.
- **Currentcolor:** icons inherit text color via `stroke: currentColor` so they theme for free.
- **Sizes:** 16 (inline/caption), 20 (buttons/HUD), 24 (nav), 32 (feature). Snap to the pixel grid
  for crispness.
- **No filled/duotone mixing** in one context; pick line icons and stay consistent.
- **Meaning-bearing icons are never decorative-only** — every status/mechanic icon has a text label
  or accessible name (see §13).
- Inline SVG (no icon font, no external requests — matches the offline/no-binary-assets constraint).

Core set (illustrative): `undo ↩`, `restart ⟳`, `hint 💡/bulb`, `pause ⏸`, `settings ⚙`,
`sound 🔊`, `star ★`, `gem ◆`, `lock 🔒`, `key ⚿`, `close ✕`, `back ‹`, direction chevrons `▲▶▼◀`.

---

## 9. Game object visual spec

The board is drawn on Canvas 2D with a static layer (immutable tiles) and a dynamic layer
(token/particles). Every object below has a **shape identity** so it reads without color — critical
for accessibility and for the print/Mono theme. Sizes are relative to cell size `C`.

### 9.1 Player token

- A rounded **chip**: filled circle-square (`--radius-full`), diameter `0.7·C`, fill `--color-accent`,
  `--elev-2` resting shadow + `--elev-glow` faint aura.
- A subtle **directional glint** (a small highlight arc) hints last-travel direction.
- Motion: **squash** on launch, **stretch** in flight (deform along travel axis), **bounce** on stop
  (`--ease-snap`), **particle burst** on redirect and on win.

### 9.2 The four directional arrows

- **Chunky rounded chevrons**, `0.6·C`, fill `--color-accent-2`, pointing U/D/L/R.
- **Idle shimmer:** a slow linear highlight sweep (loop, `--ease-linear`), disabled by reduced motion.
- Direction must read at a glance from silhouette alone (shape, not color).

```
   Up        Down       Left       Right
   ╱▲╲       ╲▼╱        ◀──        ──▶
   direction encoded by the chevron shape itself
```

### 9.3 Mirrors ("/" and "\\")

- A rounded **diagonal bar** across the cell, `--color-accent-2`, with a faint glossy specular line
  to sell reflectivity.
- `/` and `\` are mirror-image silhouettes — unambiguous without color. On reflect, a short spark
  particle fires at the contact point.

### 9.4 Reverse arrow

- A **circular double-headed / U-turn glyph** (◀▶ enclosed in a ring), distinct from directional
  chevrons. On hit, the token does a visible 180° flip with a pivot squash.

### 9.5 Rotating arrow

- A directional chevron inside a **notched rotation ring** with a small CW indicator.
- Rotates 90° CW each time the token *leaves* it; the rotation animates `--dur-base` `--ease-snap`
  and leaves a faint arc trail so the state change is obvious.

### 9.6 Exit portal (real)

- A **glowing ring** (`--radius-full`, `--color-success`) with a pulsing inward **draw-in** gradient
  and slow rotation. `--elev-glow` in success hue. Reads as "goal / safe / go here".
- On win: the ring expands, the token is drawn in, particles bloom (staged under §10).

### 9.7 Fake exit (decoy)

- Deliberately **"off"**: a **dashed, cracked** ring in a desaturated/`--color-text-muted` tone, no
  glow, no pulse (or a stuttering, broken pulse). On contact it **rejects** with a short shake + dull
  thud, distinct silhouette (dashed vs solid) so it is never mistaken under any palette.

```
   real exit         fake exit
   ╭───────╮         ╭╌╌ ╌╌╮
   │ ((◎)) │         ┆  ⌵  ┆   ← dashed ring, crack, no glow
   ╰───────╯         ╰╌ ╌╌╌╯
   glowing, pulsing   broken, muted, static
```

### 9.8 Portals (paired teleporters)

- Two matching **swirl rings**; each pair shares a hue from the mechanic palette **and a shared index
  glyph** (a small paired number/symbol) so pairs are identifiable without relying on color.
- Slow linear swirl; on teleport, a quick in/out ripple at both ends; direction is preserved.

### 9.9 Keys & locks

- **Key:** a rounded key glyph tinted with a mechanic color **and stamped with that color's shape**
  (circle/square/triangle/diamond/pentagon — see §3.2).
- **Lock:** a padlock glyph on a lock tile, carrying the same color + shape stamp. A key opens locks
  of the matching color; on open, the lock does a click-pop and dissolves.

### 9.10 Color gates & color pickups

- **Color pickup:** a small faceted **gem-of-color** carrying the mechanic color + shape.
- **Color gate:** a translucent barrier tinted with the mechanic color, showing its **shape glyph**.
  Passable only while carrying the matching color; a locked gate shows a subtle cross-bar and blocks
  with a soft bump if entered without the color.

### 9.11 Switches (pressure) & toggle walls/bridges

- **Pressure switch:** a recessed rounded pad; **up** = raised with a ring, **pressed** = depressed +
  lit. State is shown by depth and a lit/unlit dot, not color alone.
- **Toggle wall / bridge:** linked targets share the switch's mechanic color **and** a matching index
  glyph. Active/solid vs inactive/open differ by **fill vs hollow-dashed** outline, so state reads in
  Mono. Transitions animate `--dur-base`.

### 9.12 Bridges / crossovers

- A **raised rounded platform** with a visible over/under seam where perpendicular paths cross.
- Toggled bridges over void render as **dashed/hollow when open** (fall-through) and **solid raised
  when closed** (traversable) — a shape difference, plus a small elevation shadow when solid.

### 9.13 Walls & moving walls

- **Wall:** a solid raised block, `--color-ink-2`-ish neutral, `--radius-tile`, `--elev-1`, clearly
  above the floor plane (top inset highlight + base shadow). Reads as impassable mass.
- **Moving wall:** same block with **motion-track dashes** on its travel axis and a subtle phase
  indicator; it shifts on the step-cycle (`phase = f(moveCount)`), animating between cells
  `--dur-base` so the player can read the next position.

### 9.14 Lasers (emitter / mirror / beam)

- **Emitter:** a rounded nozzle tinted `--color-danger`; **beam:** a thin glowing danger-hued line
  with a faint core + outer bloom (bloom off under reduced motion).
- Beam blocks/kills unless rerouted (via mirror routing) or disabled (via switch). Contact triggers a
  danger flash + soft-fail (undo prompt). Because danger is hue-encoded, the beam also has a
  **hazard-stripe texture** so it is unmistakable in colorblind palettes.

### 9.15 Ice

- A **cool, translucent frosted tile** with a faint crystalline pattern and a light specular sheen.
- Encodes "cannot voluntarily stop mid-lake." A subtle animated glint (off under reduced motion)
  reinforces slickness; the frost pattern carries the meaning statically.

### 9.16 Conveyor

- A tile with **directional chevron banding** that animates as a slow linear scroll in its push
  direction (scroll paused under reduced motion; the static chevrons still show direction).
- After a rest on it, it nudges the token one tile in its direction, with a matching slide tween.

### 9.17 Gems (collectibles)

- Small faceted **diamonds** (`--color-accent-2` or a warm gold), gently bobbing/rotating (idle
  loop). Needed for 3-star runs.
- On collect: a satisfying pop + sparkle burst + the gem HUD chip increments (scale-pulse §7.5).

**Object legend (shape-first identity):**

| Object | Silhouette | Primary color role | Static tell (no color) |
| --- | --- | --- | --- |
| Player | filled chip | `--color-accent` | glow + directional glint |
| Arrow | chevron | `--color-accent-2` | pointing direction |
| Mirror | diagonal bar | `--color-accent-2` | `/` vs `\` orientation |
| Reverse | U-turn ring | `--color-accent-2` | enclosed double-head |
| Rotating | chevron + ring | `--color-accent-2` | notched CW ring |
| Exit | solid glowing ring | `--color-success` | pulsing draw-in |
| Fake exit | dashed cracked ring | muted | dashed + crack |
| Portal | swirl ring | mech color | paired index glyph |
| Key/Lock | key / padlock | mech color | color-shape stamp |
| Color gate | tinted barrier | mech color | shape glyph + bar |
| Switch | recessed pad | neutral/accent | up vs pressed depth |
| Toggle wall/bridge | block / platform | mech color | solid vs dashed |
| Wall | raised block | neutral | mass + elevation |
| Moving wall | block + track dashes | neutral | motion-track dashes |
| Laser | beam + nozzle | `--color-danger` | hazard stripes |
| Ice | frosted tile | cool tint | crystalline pattern |
| Conveyor | chevron banding | neutral | direction bands |
| Gem | faceted diamond | gold/accent-2 | facet silhouette |

---

## 10. Particles & feedback effects

Particles are **pooled** (brief: object pooling, no per-frame allocation) and rendered on the dynamic
FX layer (`--z-board-fx`). Every particle effect has a **non-particle fallback** for reduced motion.

| Event | Effect | Duration / feel | Reduced-motion fallback |
| --- | --- | --- | --- |
| Launch | small dust puff behind token; squash | `--dur-fast`, snap | squash only, no puff |
| Redirect (arrow/mirror) | spark burst at contact point | ~200ms, radial | single flash frame |
| Stop / rest | soft ring pulse + chip bounce | `--dur-fast`, snap | bounce trimmed, no ring |
| Collect gem | sparkle burst + gold pop | ~300ms | icon pop + HUD pulse |
| Reach exit (win) | bloom + ring expand + confetti motes | `--dur-slow` staged | ring + fade, no confetti |
| Soft-fail (void/laser) | dissolve/shatter + danger flash | `--dur-base` | quick fade + shake |
| Invalid / illegal move | short shake + muted bump | `--dur-fast` | shake only, live-region text |
| Hint reveal | pulsing arrow flash on HUD/board | loop until acted | static highlighted arrow |

**Feedback principles:**

- Every action gets an **immediate** visual acknowledgement within `--dur-fast`.
- Feedback is **layered** with audio (synthesized SFX) and optional haptics, but is never
  audio-only — all cues have a visible equivalent.
- Particle counts scale down on low-DPR / large boards to protect 60fps.

---

## 11. Shadow & gradient language

**Shadows** (see §4.3): long, soft, low-opacity, theme-tinted toward `--bg-0` — never harsh black,
never crisp. They imply that objects float slightly above a calm surface. Board tiles sit on
`--elev-1`; interactive UI on `--elev-2`; overlays climb the tiers. Neon amplifies with an additive
accent glow but keeps the same restraint elsewhere.

**Gradients** are restrained and directional:

- **Background:** a soft, large-radius gradient from `--bg-1` toward a slightly cooler/warmer tint,
  with a faint parallax grid over it (parallax off under reduced motion → static gradient).
- **Surfaces:** near-flat, at most a 1–2% top-to-bottom sheen for the tactile plastic read.
- **Player / exit:** subtle radial gradient (center-light → edge) plus glow.
- **Never** use rainbow, banded, or high-chroma gradients. If a gradient calls attention to itself,
  it is wrong. Aim for "lit surface," not "graphic."

```
   background:  ▓▓▒▒░░  (soft directional, ~4–8% delta)  + faint grid
   surface:     ░░░░    (near-flat, 1–2% sheen, top-lit)
   player/exit: ( ◉ )   (radial center-light + accent glow)
```

---

## 12. Do / Don't

**Do**

- Use tokens for every color, space, radius, duration, and z-index.
- Encode meaning with **shape + label + color** together — color is the last, not the only, channel.
- Keep motion in the 150/250/400 tiers with the documented easings.
- Preserve generous negative space; let the board breathe.
- Verify every new surface meets contrast targets in all five themes **and** the high-contrast
  palette.
- Provide a reduced-motion fallback for any new animation or particle effect.
- Keep icons single-line, `currentColor`, on the 24px grid.

**Don't**

- Hard-code hex values, pixel radii, or millisecond durations in components.
- Rely on hue alone to distinguish state, mechanic, or status.
- Introduce a second display font or mix icon styles in one context.
- Use harsh/black drop shadows, high-chroma or banded gradients, or skeuomorphic bevels.
- Add loud, attention-grabbing motion, autoplaying loops that ignore reduced-motion, or particles
  without a fallback.
- Let counters use proportional figures (always tabular).
- Fork a theme to fix a one-off; fix the token or the semantic mapping instead.

---

## 13. Accessibility

Accessibility is a design constraint, not a mode. The rules below are binding on every screen and
every game object.

### 13.1 Never color-only

Every meaningful distinction is carried by **at least two channels**:

| Distinction | Channel 1 | Channel 2 | Channel 3 |
| --- | --- | --- | --- |
| Mechanic color (key/lock/gate/portal) | hue | shape stamp (●■▲◆⬟) | pattern (hatch/dots/…) |
| Real vs fake exit | hue/glow | solid vs dashed ring | pulse vs broken/none |
| Earned vs unearned star | fill color | solid vs hollow | — |
| Toggle on/off | track color | knob position | ✓ / ✕ glyph |
| Hazard (laser) | danger hue | hazard stripes | motion + flash on contact |
| Toggle wall/bridge state | mech hue | solid vs dashed | index glyph |

### 13.2 Colorblind-safe palettes

Selectable palettes (a settings token layered over the theme): **deuteranopia**, **protanopia**,
**tritanopia**, and **high-contrast**. Each remaps the mechanic and semantic *hues* to a set with
maximal separation for that vision type, while the shape/pattern encodings stay identical — so even a
perfect palette is backed by non-color cues. High-contrast doubles as the Mono-style baseline.

- Palette selection is a **token overlay**, not a theme fork: it swaps hue values, nothing else.
- Chosen palette persists in `settings` (save system) and applies everywhere, including thumbnails
  and the editor.

### 13.3 Contrast targets

| Content | Target (WCAG) |
| --- | --- |
| Body / label text on its surface | ≥ 4.5:1 (AA) |
| Large text (≥24px or ≥18.66px bold) | ≥ 3:1 |
| Icons & essential UI glyphs vs background | ≥ 3:1 |
| Focus ring vs adjacent colors | ≥ 3:1 |
| Game object vs its tile/board | ≥ 3:1 (plus shape encoding) |

- On-accent text color is chosen **per theme** to meet ≥4.5:1 — never assume white passes.
- New tokens must be contrast-checked in **all five themes and the high-contrast palette** before
  merge.

### 13.4 Motion, focus & input

- **Reduced motion** respects `prefers-reduced-motion` *and* an in-app toggle: disables
  parallax/particles, shortens tweens, cross-fades, and pauses idle loops. Documented fallbacks in
  §6, §10.
- **Full keyboard play:** arrows/WASD to launch; `U` undo, `R` restart, `H` hint, `Esc` pause,
  `Enter` confirm. **Focus-visible everywhere** with a high-contrast ring (`--color-focus-ring`);
  focus is trapped in modals and restored on close.
- **Touch targets** are ≥44×44px, everywhere, on every platform.
- **ARIA & live regions:** DOM UI carries roles/labels; a polite live region announces state
  ("reached exit," "invalid move," volume values). Optional grid-coordinate and screen-reader board
  description modes support low-vision play.
- **No audio-only cues:** every SFX/haptic has a visual equivalent.

---

*Consistency is the feature. When in doubt, spend a token — not a new value — and let shape, space,
and quiet motion carry the meaning.*
