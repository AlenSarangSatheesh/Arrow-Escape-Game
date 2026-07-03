# Arrow Escape — UX Specification

> **Status:** Living document. Normative for all UI/UX work.
> **Source of truth:** `docs/design-brief.md` (the Authoritative Design Brief). Where this
> document elaborates, it must remain consistent with the brief; where they ever appear to
> conflict, the brief wins and this file is corrected.
> **Scope:** Screen inventory, navigation, layouts, HUD, responsive behavior, input models,
> onboarding, error/empty/loading patterns, and accessibility annotations.

Arrow Escape is a slide-and-redirect grid puzzle: launch a token that slides until it hits
something, use arrows and other tiles to redirect it, and route to the Exit in the fewest
launches. The product tone is **calm, premium, modern, tactile** — a high-end mobile puzzler
with the crisp logic of a good systems puzzle. Every screen below serves that tone: generous
negative space, soft geometric minimalism, restrained motion, and a HUD that never shouts.

This document defines the *experience layer*. It does not define the simulation rules
(`docs/design-brief.md` §2) or the level data model (`LEVEL_FORMAT.md`), but it references both.

---

## Table of contents

1. [Design principles for the UX layer](#1-design-principles-for-the-ux-layer)
2. [Screen inventory](#2-screen-inventory)
3. [Navigation flow map](#3-navigation-flow-map)
4. [Global chrome, overlays & transitions](#4-global-chrome-overlays--transitions)
5. [Screen specifications](#5-screen-specifications)
6. [HUD specification](#6-hud-specification)
7. [Responsive behavior & breakpoints](#7-responsive-behavior--breakpoints)
8. [Interaction models — touch vs keyboard vs pointer](#8-interaction-models--touch-vs-keyboard-vs-pointer)
9. [Onboarding & tutorial coach-mark flow](#9-onboarding--tutorial-coach-mark-flow)
10. [Error, empty & loading patterns](#10-error-empty--loading-patterns)
11. [Accessibility — cross-cutting rules](#11-accessibility--cross-cutting-rules)
12. [Motion & reduced-motion reference](#12-motion--reduced-motion-reference)
13. [Appendix — wireframe legend](#13-appendix--wireframe-legend)

---

## 1. Design principles for the UX layer

These are the constraints every screen decision is measured against.

| # | Principle | Practical consequence |
|---|-----------|-----------------------|
| P1 | **Board is the hero.** | On Gameplay, the board gets the largest safe square; HUD is a thin, calm frame around it. Chrome recedes. |
| P2 | **One primary action per screen.** | Each screen has exactly one visually dominant call-to-action. Secondary actions are quieter. |
| P3 | **No punitive dead-ends.** | Soft-fail offers instant Undo, never a hard "Game Over" wall in normal play (brief §3). |
| P4 | **Everything reachable two ways.** | Full keyboard parity with touch/pointer; nothing is mouse-only or hover-only. |
| P5 | **State is always legible.** | Moves, par, stars, collectibles, and undo availability are visible or one glance away at all times during play. |
| P6 | **Never rely on color alone.** | Shape, icon, pattern, and text carry meaning alongside color (brief §11). |
| P7 | **Motion is a courtesy, not a gate.** | All motion has a reduced-motion equivalent; no information is delivered only through animation. |
| P8 | **Save-safe cosmetics.** | Theme/palette changes are purely visual; they never alter layout semantics or gameplay. |

UI is DOM/CSS; the board is Canvas 2D (brief §13). The UI dispatches *intents* to the
`GameController` and never mutates the engine directly (brief §19). Screens are therefore thin
view+input adapters over pure state.

---

## 2. Screen inventory

Seventeen addressable screens/overlays, grouped by role. "Kind" distinguishes **full screens**
(own the viewport) from **overlays** (render above a dimmed parent, preserving context).

| ID | Screen | Kind | Purpose (one line) |
|----|--------|------|--------------------|
| S0 | Loading | Full | Boot: fetch critical path, hydrate saves, warm audio graph. |
| S1 | Splash | Full | Brand moment + "press to begin" audio-unlock gesture. |
| S2 | Main Menu | Full | Hub: Play, Daily, Endless, Editor, and settings/stats entry. |
| S3 | World / Level Select | Full | Choose a world, then a level; shows stars, locks, progress. |
| S4 | Gameplay + HUD | Full | The puzzle itself; the core loop lives here. |
| S5 | Pause | Overlay | Suspend play; resume/restart/settings/quit. |
| S6 | Settings | Full/Overlay | Audio, motion, palette, controls, data (export/import/reset). |
| S7 | Statistics | Full | Lifetime totals and per-world breakdown. |
| S8 | Achievements | Full | Unlocked + in-progress achievement grid. |
| S9 | Credits | Full | Contributors, license, acknowledgements. |
| S10 | Level Complete | Overlay | Win summary: stars earned, moves, time, next steps. |
| S11 | Game Over / soft-fail | Overlay | Soft-fail prompt (undo/retry); hardcore-only hard fail. |
| S12 | Tutorial | Full (S4 variant) | Guided levels with coach marks; teaches Flow. |
| S13 | Help / How-to-play | Full/Overlay | Reference of mechanics, controls, symbols. |
| S14 | Level Editor | Full | Author/edit/validate/share custom levels. |
| S15 | Daily / Endless entry | Full/Overlay | Mode framing: seed/date (Daily), streak/run (Endless). |

Loading (S0) and Splash (S1) are shown once per cold start. Everything else is re-enterable.

---

## 3. Navigation flow map

Solid arrows = user-driven navigation. `‹back›` returns to the immediate parent (Esc / hardware
back / on-screen back). Overlays float above their parent and return to it on dismiss.

```
                              ┌──────────────┐
        cold start  ───────▶  │  S0 LOADING  │   (auto-advances when boot completes)
                              └──────┬───────┘
                                     │ ready
                                     ▼
                              ┌──────────────┐
                              │  S1 SPLASH   │   (tap / key = audio-unlock gesture)
                              └──────┬───────┘
                                     │ begin
                                     ▼
              ┌──────────────────────────────────────────────────┐
              │                 S2  MAIN MENU                     │
              │  Play · Daily · Endless · Editor · Stats ·        │
              │  Achievements · Settings · Help · Credits         │
              └─┬───┬───┬────┬───────┬────────┬───────┬────┬──────┘
                │   │   │    │       │        │       │    │
      ┌─────────┘   │   │    │       │        │       │    └───────────┐
      ▼             ▼   │    ▼       ▼        ▼       ▼                ▼
┌───────────┐ ┌────────┐│┌────────┐┌────────┐┌────────┐┌────────┐ ┌─────────┐
│ S3 WORLD/ │ │S15 DAY-││ │S14     ││S7 STATS││S8 ACH- ││S6 SET- │ │S9       │
│ LEVEL SEL │ │  LY /  ││ │ EDITOR ││        ││ IEVE-  ││ TINGS  │ │ CREDITS │
│           │ │ ENDLESS││ │        │└────────┘│ MENTS  │└────────┘ └─────────┘
└─────┬─────┘ └───┬────┘│ └───┬────┘          └────────┘   ▲
      │           │     │     │  test-play         S13 HELP─┘ (also reachable from S4 pause)
      │ pick lvl  │ play │     │
      ▼           ▼     ▼     ▼
┌───────────────────────────────────────────┐
│               S4  GAMEPLAY + HUD           │◀── first-run ──▶ ┌───────────────┐
│  (Tutorial S12 is a guided variant of S4)  │   auto-routes    │ S12 TUTORIAL  │
└─┬───────┬───────────┬───────────┬──────────┘                  └───────┬───────┘
  │ pause │ soft-fail │  win      │ help                                 │ done
  ▼       ▼           ▼           ▼                                      ▼
┌──────┐┌───────────┐┌───────────┐┌──────────┐                    (returns to S3
│ S5   ││ S11 SOFT- ││ S10 LEVEL ││ S13 HELP │                     or next tutorial
│PAUSE ││   FAIL    ││ COMPLETE  ││ (overlay)│                     step)
└──┬───┘└─────┬─────┘└─────┬─────┘└────┬─────┘
   │          │            │           │
   │ resume   │ undo→S4    │ next→S4   │ close→S4
   │ restart→S4            │ replay→S4
   │ settings→S6           │ select→S3
   │ quit→S2 or S3         │ menu→S2
   ▼
(S5 also opens S6 Settings and S13 Help as nested overlays,
 then returns to S5, then to S4.)
```

**Back-stack rules**

- Full screens push onto a back-stack; `‹back›` pops one level toward S2.
- Overlays (S5, S10, S11, and overlay-mode S6/S13) do **not** push a screen; they suspend the
  parent and restore it verbatim (board camera, scroll position, focus) on dismiss.
- Hardware/browser Back maps to `‹back›`. From S2, Back offers a "Leave Arrow Escape?" confirm
  (PWA/standalone) or yields to the browser.
- Deep links: `?level=<id>`, `?daily=<yyyy-mm-dd>`, `?code=<share>` route S0 → (S1 if first
  gesture needed) → S4/S3 with the target pre-selected.

---

## 4. Global chrome, overlays & transitions

**Persistent chrome.** There is no global top bar during gameplay (P1). Menu-family screens
(S2, S3, S6–S9, S13, S14) share a lightweight header:

```
┌──────────────────────────────────────────────────────────┐
│  ‹ Back        S c r e e n   T i t l e            ⚙  ?     │   ← 56px, sticky
└──────────────────────────────────────────────────────────┘
```

- `‹ Back` — pops the stack. Hidden on S2 (root).
- Title — current screen name, `role="heading" aria-level="1"`.
- `⚙` Settings and `?` Help are global affordances (open as overlays, return to caller).

**Overlay scrim.** Overlays dim the parent to ~55% and blur 2px (blur disabled under
reduced-motion / low-power). The scrim is `aria-hidden` for the parent while an overlay traps
focus. Tapping the scrim dismisses **non-decision** overlays (Pause, Help); it never dismisses
decision overlays that require a choice (Level Complete, soft-fail) — those need an explicit
action so progress state is intentional.

**Transition tiers** (brief §14): 150 ms (snappy input feedback), 250 ms (screen/overlay
cross-fade + slight rise), 400 ms (celebratory, e.g. Level Complete star cascade). Under
reduced motion all transitions become ≤120 ms opacity cross-fades with no translation.

---

## 5. Screen specifications

Each screen below gives **Purpose · Key elements · Actions (primary/secondary) · States · ASCII
wireframe · Accessibility**. Wireframes show the desktop/tablet frame; responsive deltas are in
§7. Legend in §13.

---

### S0 — Loading

**Purpose.** Cold-boot: load the <100 KB critical path, register the service worker, read and
migrate `arrowEscape.v1.*` saves, and construct (not yet start) the audio graph. Advances
automatically to Splash when boot completes.

**Key elements.** Wordmark, a determinate progress indicator (or calm indeterminate shimmer if
progress is unknown), a single-line status caption, and an offline/first-run hint.

**Actions.** Primary: none (auto-advance). Secondary: retry (error state only).

**States.**

| State | Trigger | Presentation |
|-------|---------|--------------|
| default | boot underway | Progress fills; caption cycles ("Preparing board…", "Loading your progress…"). |
| loading | same as default | Determinate bar 0–100% when byte totals known; else 3-dot shimmer. |
| empty | no saved profile | Silent; a first-run flag routes S1→S12 later. No visible difference here. |
| error | save parse fails / quota / SW error | Non-blocking banner: "Couldn't read saved data." + **Retry** and **Start fresh** (start fresh never deletes; it loads defaults and quarantines the old blob). |

**Wireframe.**

```
┌──────────────────────────────────────────────┐
│                                                │
│                                                │
│                 A R R O W                      │
│                 E S C A P E                    │
│                                                │
│           ▓▓▓▓▓▓▓▓▓▓░░░░░░░░  62%              │
│                                                │
│            Loading your progress…              │
│                                                │
│                                                │
│           ⤓ works offline · v1                 │
└──────────────────────────────────────────────┘
```

**Accessibility.** Root is `role="status" aria-live="polite" aria-busy="true"`. The caption is
the live-region text; progress uses `role="progressbar"` with `aria-valuenow/min/max` (omit
`aria-valuenow` for indeterminate). No autofocus target yet (no interactive elements in default
state). Under reduced motion the shimmer becomes a static bar. Error banner receives focus and is
`role="alert"`.

---

### S1 — Splash

**Purpose.** Brand moment and — critically — the **first user gesture** that unlocks WebAudio
(brief §15). Nothing plays sound before this tap/key.

**Key elements.** Centered logo with a subtle idle animation, a "Press to begin" affordance
(full-screen hit target), and quiet version/attribution line.

**Actions.** Primary: **Begin** (tap anywhere / any key / Enter) → resumes AudioContext, then
routes to S2 (or S12 on first run). Secondary: none.

**States.** default (idle) · reduced-motion (static logo, gentle opacity pulse only).

**Wireframe.**

```
┌──────────────────────────────────────────────┐
│                                                │
│                                                │
│                    ◆                           │
│                 A R R O W                      │
│                 E S C A P E                    │
│                                                │
│              ─ press to begin ─                │
│                                                │
│                                                │
│         a calm slide-and-redirect puzzle       │
└──────────────────────────────────────────────┘
```

**Accessibility.** The whole splash is a single `<button>`-semantic target: `role="button"`,
label "Begin Arrow Escape", autofocused. Enter/Space/tap all activate. Announce on entry via a
polite live region: "Arrow Escape. Press any key to begin." Logo idle animation is
`prefers-reduced-motion` gated.

---

### S2 — Main Menu

**Purpose.** The hub. One clear primary path (Play/Continue) plus mode and meta entries.

**Key elements.** Wordmark; **Continue** (resume last unfinished level) or **Play** (if none);
**Daily**, **Endless**, **Level Editor**; a meta row: **Stats**, **Achievements**, **Settings**,
**Help**, **Credits**; and a slim progress ribbon (total stars / levels completed).

**Actions.**

- Primary: **Continue / Play** → S3 (or straight to S4 for the exact resume target).
- Secondary: Daily → S15, Endless → S15, Editor → S14, and each meta entry to its screen.

**States.**

| State | Presentation |
|-------|--------------|
| default | Full menu; Continue shows the level name + world it resumes. |
| empty (new player) | Primary reads **Play** and routes into Tutorial (S12); Daily/Endless still available but Endless may be lightly gated with a tooltip "Finish the Tutorial to unlock scoring." |
| loading | Menu renders immediately from cached save; the progress ribbon shows a subtle skeleton until totals compute. |
| error | If saves are quarantined (from S0), a dismissible info chip: "Playing on a fresh profile — your old data is safe. Restore in Settings › Data." |

**Wireframe.**

```
┌──────────────────────────────────────────────┐
│                 A R R O W  E S C A P E         │
│                                                │
│        ┌──────────────────────────────┐        │
│        │   ▶  CONTINUE                 │        │  ← primary, largest
│        │      World 2 · “Crosswinds”   │        │
│        └──────────────────────────────┘        │
│                                                │
│     ┌────────────┐  ┌────────────┐             │
│     │ ◔ DAILY    │  │ ∞ ENDLESS  │             │
│     └────────────┘  └────────────┘             │
│     ┌────────────┐                             │
│     │ ✎ EDITOR   │                             │
│     └────────────┘                             │
│                                                │
│   ★ 148/300     ▦ 62/100 levels                │
│                                                │
│   [ Stats ] [ Achievements ] [ Settings ]      │
│   [ Help ]  [ Credits ]                         │
└──────────────────────────────────────────────┘
```

**Accessibility.** `<nav aria-label="Main menu">` wrapping a list of links/buttons. Focus lands
on Continue/Play. Logical tab order top→bottom, left→right matching visual order. The star/level
ribbon is decorative-plus-text: e.g. `aria-label="148 of 300 stars, 62 of 100 levels completed"`.

---

### S3 — World / Level Select

**Purpose.** Two-tier chooser: pick a **World** (Tutorial, Easy…Master — brief §6), then a
**Level** within it. Communicates progress, stars, and lock/unlock gating (stars-gated,
brief §10).

**Key elements.** World rail/carousel (with per-world star totals and lock state); level grid
for the active world (each tile: index, star pips 0–3, completed/locked/new markers); a world
summary header (name, mechanics introduced, completion %).

**Actions.**

- Primary: select an unlocked level → S4.
- Secondary: switch world; open a locked level to see its unlock requirement; jump to next
  incomplete level ("Continue" shortcut).

**States.**

| State | Presentation |
|-------|--------------|
| default | Active world's levels in a responsive grid; locked levels dimmed with a lock glyph. |
| empty | For a world with zero unlocked levels (future/unreleased world): a placeholder card "Coming soon" or "Unlock by earning ★N in the previous world." |
| loading | Grid shows shimmer skeleton tiles while progress hydrates (typically instant from cache). |
| error | Per-level tile error (corrupt custom level in a pack) shows a "!" badge and is non-selectable with a tooltip. |

**Wireframe.**

```
┌──────────────────────────────────────────────┐
│ ‹ Back      SELECT LEVEL              ⚙   ?    │
├──────────────────────────────────────────────┤
│  ◀  [Tut] [ Easy ] [Med] [Hard] [Exp] [Mas] ▶ │  ← world rail
│         World 1 · EASY   ★34/54   68% done     │
│         teaches: arrows · mirrors · gems       │
├──────────────────────────────────────────────┤
│  ┌────┐ ┌────┐ ┌────┐ ┌────┐ ┌────┐ ┌────┐    │
│  │ 1  │ │ 2  │ │ 3  │ │ 4  │ │ 5  │ │ 6  │    │
│  │★★★│ │★★★│ │★★☆│ │★☆☆│ │ ▶  │ │ 🔒 │    │
│  └────┘ └────┘ └────┘ └────┘ └────┘ └────┘    │
│  ┌────┐ ┌────┐ ┌────┐  …                       │
│  │ 🔒 │ │ 🔒 │ │ 🔒 │                          │
│  └────┘ └────┘ └────┘                          │
│                                                │
│                       [ ▶ Continue: Level 5 ]  │
└──────────────────────────────────────────────┘
```

**Accessibility.** World rail is a `role="tablist"`; each world a `tab`; the level grid its
`tabpanel`. Level tiles are buttons with a full label: "Level 3, 2 of 3 stars, completed" or
"Level 6, locked, earn 20 stars to unlock." Arrow keys move within the grid (roving tabindex);
Left/Right on the rail switch worlds. Locked tiles are `aria-disabled="true"` but still focusable
so their requirement can be read. Star pips carry text, not color alone.

---

### S4 — Gameplay + HUD

**Purpose.** The core loop: read the board, launch the token, watch it slide and redirect, reach
the Exit in as few launches as possible. Everything else in the app exists to get here and back.

**Key elements.** The **Canvas board** (largest safe square, P1); the **HUD** (fully specced in
§6): moves, par, timer, stars-preview, collectibles, and the action cluster
undo/restart/hint/pause; optional on-screen D-pad (touch); the level title/index chip.

**Actions.**

- Primary: **Launch** (Up/Down/Left/Right) via keyboard, swipe, D-pad, or edge-tap
  (brief §12). One launch = one move (brief §2).
- Secondary: **Undo** (U), **Restart** (R), **Hint** (H), **Pause** (Esc). Optional: peek at
  Help (`?`).

**States.**

| State | Trigger | Presentation |
|-------|---------|--------------|
| default (rest) | token at rest | Board idle-shimmers; HUD live; input armed. |
| animating | launch in flight | Token slides; inputs queued/locked until rest; HUD counters update on rest. |
| invalid move | launch that changes nothing / illegal (e.g. immediate wall, or cycle-guarded, brief §2) | Token nudge + wood-block SFX + live-region "Invalid move — nothing changed." No move counter increment. |
| soft-fail | token falls to VOID / hazard (brief §3) | Freeze, then S11 overlay with auto-Undo prompt. |
| win | token reaches real Exit | Win burst → S10 overlay. |
| loading | level asset/solve pending | Board area shows skeleton; HUD disabled; par shows "—" until solver reports optimal. |
| error | level failed to load/parse | Inline board-area error card with **Retry** / **Back to select**. |

**Wireframe (desktop/tablet).**

```
┌──────────────────────────────────────────────┐
│  W1·L5 “Slipstream”     ⏸        ★ ☆ ☆         │  ← title + pause + star preview
├──────────────────────────────────────────────┤
│  Moves 4 / par 3      ⏱ 00:27     ◈ 1/2        │  ← HUD top strip
│ ┌──────────────────────────────────────────┐ │
│ │                                            │ │
│ │        [ CANVAS  BOARD  — grid ]           │ │
│ │        token ● slides & redirects          │ │
│ │                                            │ │
│ └──────────────────────────────────────────┘ │
│                                                │
│   [ ↶ Undo ]  [ ⟲ Restart ]  [ 💡 Hint ]       │  ← action cluster
└──────────────────────────────────────────────┘
```

**Accessibility.** The canvas has `role="application"` with an `aria-label` summarizing the board
and a companion **screen-reader board description** region (brief §11) that can be toggled on for
low-vision play ("Board 5×5. Token at column 2, row 4. Exit at column 5, row 1. Arrows: …").
Optional **grid coordinates** overlay. Every launch result is announced in a polite live region:
"Slid right, redirected up, stopped at column 5, row 2. 4 moves." Wins/fails announce assertively.
Full keyboard model in §8. Focus never leaves the play surface unexpectedly; Esc goes to Pause.
HUD action buttons are real focusable buttons with labels + shortcut hints
(`aria-keyshortcuts="U"`, etc.).

---

### S5 — Pause

**Purpose.** Suspend play without losing context; branch to resume, restart, settings, help, or
leave.

**Key elements.** Current level chip; Resume (primary); Restart; Settings; Help; Quit to Select /
Menu. Timer is paused while this overlay is open (timer is scoring-only, brief §4).

**Actions.** Primary: **Resume**. Secondary: Restart · Settings (nested overlay) · Help (nested
overlay) · Quit.

**States.** default · (nested Settings/Help open) · quit-confirm (only if there is unsaved run
progress worth confirming; otherwise quit is immediate since progress is per-level and safe).

**Wireframe.**

```
        ┌────────────────────────────────┐
        │            PAUSED               │
        │      W1 · L5 “Slipstream”        │
        │                                  │
        │      ┌────────────────────┐      │
        │      │   ▶  RESUME        │      │  ← primary
        │      └────────────────────┘      │
        │      [ ⟲ Restart level     ]      │
        │      [ ⚙ Settings          ]      │
        │      [ ? Help              ]      │
        │      [ ⭠ Quit to levels    ]      │
        └────────────────────────────────┘
```

**Accessibility.** `role="dialog" aria-modal="true"` labelled "Paused." Focus moves to Resume on
open; focus is trapped; Esc resumes (symmetry with Esc-to-pause). Scrim tap resumes. On close,
focus returns to the board. Announce "Game paused" / "Resumed" politely.

---

### S6 — Settings

**Purpose.** Configure audio, motion, palette/theme, controls, and data. Persists to
`arrowEscape.v1.settings` (debounced, guarded — brief §10). Reachable full-screen from S2 or as an
overlay from S5.

**Key elements.** Grouped sections: **Audio** (master/SFX/music volumes, mute), **Motion**
(reduced motion toggle — defaults from `prefers-reduced-motion`), **Visual** (theme: Aurora/
Sunset/Mono/Forest/Neon; colorblind palette: deuter/prot/trit/high-contrast; UI scale),
**Gameplay** (haptics toggle, hint budget behavior, hardcore mode), **Controls** (swipe/D-pad/
edge-tap toggles, key rebinds view), **Data** (Export profile JSON, Import, Reset).

**Actions.** Primary: changes apply live (no explicit Save). Secondary: Export · Import · Reset
(destructive → confirm). Back returns to caller.

**States.**

| State | Presentation |
|-------|--------------|
| default | All controls at current values. |
| loading | Import parsing shows an inline spinner on the Data section. |
| empty | (n/a) |
| error | Import invalid → inline error under Import: "This file isn't a valid Arrow Escape profile." Quota write failure → toast: "Couldn't save that setting (storage full)." |

**Wireframe.**

```
┌──────────────────────────────────────────────┐
│ ‹ Back        SETTINGS                          │
├──────────────────────────────────────────────┤
│ AUDIO                                          │
│   Master   [────●─────]   80%                  │
│   SFX      [──────●───]   90%   [ mute ]        │
│   Music    [●─────────]    off                 │
│ MOTION                                         │
│   Reduced motion            (•) On  ( ) Off    │
│ VISUAL                                         │
│   Theme     [ Aurora ▾ ]                        │
│   Palette   [ High-contrast ▾ ]                 │
│   UI scale  [ – ]  100%  [ + ]                  │
│ GAMEPLAY                                       │
│   Haptics   ( ) On  (•) Off                     │
│   Hardcore  ( ) On  (•) Off                     │
│ CONTROLS                                       │
│   Swipe ✓   D-pad ✓   Edge-tap ✓  [ Keys… ]     │
│ DATA                                           │
│   [ Export profile ] [ Import ] [ Reset… ]     │
└──────────────────────────────────────────────┘
```

**Accessibility.** Sections use `role="group"` with `aria-labelledby` section headings. Sliders
are native `range` with `aria-valuetext` in percent; toggles are `role="switch"`; segmented
options are radio groups. Changing a setting announces its new value politely ("Reduced motion
on"). Reset is `aria-describedby` a warning and requires a confirm dialog. Theme/palette changes
must not move focus.

---

### S7 — Statistics

**Purpose.** Show lifetime totals and per-world breakdown from `arrowEscape.v1.statistics`
(brief §10): total moves, time, hints used, levels completed, perfect solves, gems, streaks.

**Key elements.** Headline stat cards; a per-world table (levels done, stars, best-in-world);
lifetime counters; streak indicator. Numbers use tabular numerals (brief §14).

**Actions.** Primary: none (read-only). Secondary: filter by world; Back.

**States.** default · **empty** (new player: friendly zero-state) · loading (skeleton cards).

**Wireframe.**

```
┌──────────────────────────────────────────────┐
│ ‹ Back        STATISTICS                        │
├──────────────────────────────────────────────┤
│  ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐  │
│  │ Levels │ │ Stars  │ │Perfect │ │ Streak │  │
│  │  62    │ │  148   │ │  41    │ │  6 🔥  │  │
│  └────────┘ └────────┘ └────────┘ └────────┘  │
│  Total moves 3,204 · Time 4h 12m · Hints 9     │
│  Gems 87 · Best streak 14                       │
│                                                │
│  World        Done   ★     Perfect             │
│  ─────────────────────────────────────         │
│  Tutorial     8/8    24    8                    │
│  Easy         12/18  31    9                    │
│  Medium        …                                │
└──────────────────────────────────────────────┘
```

**Empty state.** "No stats yet — play your first level to start tracking." with a **Play** CTA.

**Accessibility.** The per-world breakdown is a real `<table>` with `<caption>` and scope'd
headers. Stat cards are `role="group"` with a combined label ("Levels completed: 62"). Streak
flame has a text equivalent, not emoji-only. Read-only; tab order flows cards → table → Back.

---

### S8 — Achievements

**Purpose.** Display unlocked and in-progress achievements from `arrowEscape.v1.achievements`.

**Key elements.** Grid of achievement cards (icon, title, description, progress bar or
unlocked-date); a summary ("23 / 50 unlocked"); optional category filter. Locked achievements
show a hint or are teased with a redacted title if secret.

**Actions.** Primary: none. Secondary: filter (All / Unlocked / In-progress / Secret); Back.

**States.** default · empty (all locked → still show the grid, encouraging) · loading (skeleton).

**Wireframe.**

```
┌──────────────────────────────────────────────┐
│ ‹ Back      ACHIEVEMENTS        23/50 unlocked │
├──────────────────────────────────────────────┤
│ [ All ] [ Unlocked ] [ In-progress ] [ Secret ]│
│  ┌───────────────┐ ┌───────────────┐           │
│  │ ✔ First Flow  │ │ ✔ No Hints    │           │
│  │ Finish lvl 1  │ │ Beat a world  │           │
│  │ unlocked 6/12 │ │ hint-free     │           │
│  └───────────────┘ └───────────────┘           │
│  ┌───────────────┐ ┌───────────────┐           │
│  │ ◔ Gem Hoarder │ │ 🔒 ??? (secret)│           │
│  │ 87/100 gems   │ │ hidden        │           │
│  │ ▓▓▓▓▓▓▓░░ 87%  │ │               │           │
│  └───────────────┘ └───────────────┘           │
└──────────────────────────────────────────────┘
```

**Accessibility.** Filter is a radio/segmented control. Each card is a `role="group"` /
`listitem` with a full label including state ("Gem Hoarder, in progress, 87 of 100 gems"). Progress
bars use `role="progressbar"`. Unlock animations are reduced-motion aware (fade, no confetti burst
when reduced).

---

### S9 — Credits

**Purpose.** Attribution and license. Names project contributors and the MIT license
(brief §21). **No mention of automated tooling** anywhere.

**Key elements.** Contributors list (maintainer: AlenSarangSatheesh), acknowledgements (fonts/
system stack, techniques), license summary + link, version, and a "back to menu" affordance.

**Actions.** Primary: Back. Secondary: open license text (overlay); external repo link (if any).

**States.** default only (static content). No empty/error/loading beyond the outer app boot.

**Wireframe.**

```
┌──────────────────────────────────────────────┐
│ ‹ Back        CREDITS                           │
├──────────────────────────────────────────────┤
│              A R R O W  E S C A P E             │
│              v1 · MIT License                   │
│                                                │
│  Maintainer                                    │
│    AlenSarangSatheesh                          │
│  Contributors                                  │
│    project contributors                        │
│                                                │
│  Built with vanilla ES modules, Canvas 2D,     │
│  and the Web Audio API. Typography: system     │
│  geometric sans (Inter / SF / Segoe).          │
│                                                │
│  [ View license ]                              │
└──────────────────────────────────────────────┘
```

**Accessibility.** Plain reading order; headings structured `h1→h2`. Links are descriptive.
Scrollable region is keyboard-scrollable and focus-visible. Nothing time-based.

---

### S10 — Level Complete

**Purpose.** Celebrate the win and present clear next steps with the outcome summary
(stars, moves vs par/optimal, time, collectibles) per brief §4.

**Key elements.** Animated star reveal (0–3, capped by hints if used — brief §8); moves and
"optimal N / par M"; time; collectibles collected; **Next level** (primary); Replay, Level select,
Menu. If a new best or a new star tier was reached, badge it ("New best: 3 moves!").

**Actions.** Primary: **Next level** (→ S4 with next level; or "Back to select" if world done).
Secondary: Replay (deterministic playback, brief §9) · Level select (S3) · Main menu (S2) ·
Share code (export run, brief §17) if enabled.

**States.**

| State | Presentation |
|-------|--------------|
| default | Full summary + star cascade. |
| loading | If next level must load, primary shows a brief spinner label "Loading…". |
| empty | Last level of a world/game → primary becomes "Back to worlds" + a completion flourish. |
| error | Next level failed to load → keep overlay, show "Couldn't load the next level" + Retry / Select. |

**Wireframe.**

```
        ┌────────────────────────────────┐
        │        LEVEL COMPLETE           │
        │          ★   ★   ★              │  ← cascade reveal
        │                                  │
        │   Moves  3   (optimal 3)         │
        │   Time   00:41                   │
        │   Gems   2 / 2   ✔               │
        │   ─ New best: 3 moves ─          │
        │                                  │
        │      ┌────────────────────┐      │
        │      │   ▶  NEXT LEVEL    │      │  ← primary
        │      └────────────────────┘      │
        │   [ ⟳ Replay ] [ ▦ Levels ]      │
        │   [ ⌂ Menu ]                     │
        └────────────────────────────────┘
```

**Accessibility.** `role="dialog" aria-modal="true"` labelled "Level complete." On open, an
assertive live announcement: "Level complete. 3 stars. 3 moves, optimal. Time 41 seconds."
Focus moves to **Next level**. Star cascade is decorative; the count is announced as text. Under
reduced motion the stars fade in together (no cascade), and the win particle burst is replaced by
a static glow. Focus trapped; Esc = Level select (safe default, never accidental data loss).

---

### S11 — Game Over / soft-fail

**Purpose.** Handle the token falling into VOID or hitting a hazard (brief §3). Standard play has
**no punitive game-over** — this is a gentle "that didn't work" with an instant recovery. A true
hard fail exists only when **Hardcore** is enabled in Settings.

**Key elements (soft-fail, default).** Cause line ("Fell into the void" / "Hit the laser"),
**Undo** (primary — restores the pre-fall rest state), Restart, and a quiet tip after repeated
fails on the same level (offer a hint).

**Key elements (hard-fail, hardcore only).** "Run ended" summary with Restart level / Quit; still
never deletes progress.

**Actions.** Primary: **Undo** (soft) / **Restart** (hard). Secondary: Restart / Hint (soft);
Quit (hard).

**States.**

| State | Presentation |
|-------|--------------|
| default (soft) | Auto-shown on fall; primary Undo. Timer paused. |
| repeated | After ≥3 fails on this level, surface "Want a hint?" inline (respects hint budget/star cap). |
| hard (hardcore) | Full-stop card, Restart/Quit only. |
| loading/error | (n/a — pure state restore) |

**Wireframe (soft-fail).**

```
        ┌────────────────────────────────┐
        │        THAT DIDN’T WORK          │
        │      ⤓ The token fell away        │
        │                                  │
        │      ┌────────────────────┐      │
        │      │   ↶  UNDO          │      │  ← primary, autofocus
        │      └────────────────────┘      │
        │      [ ⟲ Restart level     ]      │
        │      [ 💡 Show a hint      ]      │  ← appears after repeats
        └────────────────────────────────┘
```

**Accessibility.** `role="alertdialog" aria-modal="true"` — assertive announcement of the cause:
"The token fell into the void. Undo to try again." Focus to **Undo**. Esc = Undo (the safe,
expected recovery). Never trap the player: Undo/Restart are always immediately available. The
cause is text + icon, never color-only.

---

### S12 — Tutorial

**Purpose.** Teach **Flow** and the foundational tiles (arrows, walls/stop, exit, mirrors —
brief §6) through 8 guided, unmissable levels using coach marks. It is a *variant of S4* with an
overlay coach-mark layer and constrained inputs.

**Key elements.** The gameplay board + HUD (HUD progressively revealed), a **coach-mark** system
(spotlight + caption + arrow to the relevant element), a "Try it" gate that waits for the correct
input, and Skip/Next controls. Non-relevant HUD actions are hidden or disabled until introduced.

**Actions.** Primary: perform the taught action (context-dependent: "Swipe right", "Undo now").
Secondary: **Next** (advance a static step), **Skip tutorial** (with confirm), **Replay step**.

**States.**

| State | Presentation |
|-------|--------------|
| default | Coach mark visible; input constrained to the taught action. |
| awaiting-input | The board is armed only for the correct move; wrong inputs give a soft nudge + re-explain. |
| complete-step | Success micro-celebration → auto-advance or **Next**. |
| skipped | Confirm → jump to S3 Easy world. |

**Wireframe.**

```
┌──────────────────────────────────────────────┐
│  TUTORIAL 3/8 · Redirect                        │
├──────────────────────────────────────────────┤
│ ┌──────────────────────────────────────────┐ │
│ │        [ CANVAS BOARD ]                     │ │
│ │             ● ───▶  ▧(arrow)                │ │
│ │           ┌───────────────────────┐         │ │
│ │           │ Arrows bend your path. │  ◀coach │ │
│ │           │ Swipe RIGHT to launch. │  mark   │ │
│ │           └───────────▼───────────┘         │ │
│ └──────────────────────────────────────────┘ │
│  Moves 0                                        │
│  [ Skip tutorial ]                  [ Next ▸ ]  │
└──────────────────────────────────────────────┘
```

**Accessibility.** Each coach mark is a focus-trapping `role="dialog"` (or an
`aria-describedby` on the spotlighted control) that is announced on appearance and moves focus to
its action. The spotlight has a non-color cue (dashed ring + label). Constrained input still has a
full keyboard equivalent ("Press Right arrow"). Reduced motion removes the pulsing spotlight in
favor of a static outline. Skip is always reachable via keyboard.

Full coach-mark flow logic is in [§9](#9-onboarding--tutorial-coach-mark-flow).

---

### S13 — Help / How-to-play

**Purpose.** A reference: how Flow works, the controls, and a legend of every tile/entity symbol
introduced so far. Reachable full-screen (S2) or as an overlay (from Pause/Gameplay).

**Key elements.** Sections — **Basics** (launch → slide → redirect → exit), **Controls** (per
input model), **Symbol legend** (arrow, mirror, wall/stop, exit, fake exit, portal, gate, key/
lock, gem, conveyor, laser, etc. — matching brief §5), and **Tips**. Legend entries show the
glyph + shape + name so meaning never rests on color.

**Actions.** Primary: Close/Back (return to caller). Secondary: jump-to-section; "replay
tutorial" link.

**States.** default · (overlay vs full — same content, different frame) · progressive: only
mechanics the player has encountered are shown expanded; not-yet-seen ones are collapsed/teased to
avoid spoilers.

**Wireframe.**

```
┌──────────────────────────────────────────────┐
│ ‹ Back        HOW TO PLAY                       │
├──────────────────────────────────────────────┤
│ BASICS                                         │
│   Launch a direction → the token SLIDES until   │
│   it hits something. Arrows redirect it. Reach  │
│   the glowing EXIT in the fewest launches.      │
│ CONTROLS                                       │
│   Keyboard: ← ↑ → ↓ / WASD · U undo · R restart │
│             H hint · Esc pause · Enter confirm  │
│   Touch:    swipe · on-screen D-pad · edge-tap  │
│ LEGEND                                         │
│   ▶ arrow (redirect)     ▤ wall / stop          │
│   ╱ ╲ mirror (reflect)   ◎ exit   ◌ fake exit   │
│   ⬡ portal (paired)      ⛒ gate (one-way)       │
│   ◈ gem (collectible)    ⌁ laser (hazard)       │
└──────────────────────────────────────────────┘
```

**Accessibility.** Sections are landmark-labelled; legend is a definition list (`<dl>`) pairing
glyph + name + behavior. Controls table is a real table. As overlay: `role="dialog"`, focus
trap, Esc/scrim closes and restores the parent (board/pause). Each glyph has descriptive alt text.

---

### S14 — Level Editor

**Purpose.** Author, edit, validate, and share custom levels stored under
`arrowEscape.v1.customLevels` (brief §10) using the level data model (brief §17 / `LEVEL_FORMAT.md`).
Validation is solver-backed (must be solvable; par/optimal filled by the solver — brief §8, §18).

**Key elements.** A **canvas grid** with adjustable width/height; a **palette** of tile/entity
tools (floor, wall/stop, arrows ×4, mirrors, exit, fake exit, portal pair, gate, key/lock, gem,
conveyor, laser…); **Start/Exit** placement; tool inspector (params, e.g. arrow direction, portal
pairing, key color); a **Validate/Solve** action (reports solvable? optimal moves, difficulty
label); **Test-play** (jumps into S4 with the draft); **Save/Load**; **Share** (export/import
base64url code with version + checksum — brief §17).

**Actions.**

- Primary: place/erase the selected tool on the grid (tap/drag).
- Secondary: select tool · resize board · set Start/Exit · **Validate** · **Test-play** · Save ·
  Load · **Share code** (export) · Import code · Undo/Redo · Clear.

**States.**

| State | Presentation |
|-------|--------------|
| default | Editable grid + palette. |
| empty | New/blank grid ("Place a Start and an Exit to begin."). |
| validating | Solver runs → inline spinner + progress; grid locked briefly. |
| valid | Green check: "Solvable in N moves · Difficulty: Medium." Enables Test-play/Save/Share. |
| invalid | Blocked reasons listed: "No exit placed", "No start", "Unsolvable", "Trivial (0 moves)", "Contains unavoidable cycle". Test-play disabled for structural errors. |
| error | Import bad code → "That share code is invalid or from a newer version." (checksum/version mismatch). Save quota fail → toast. |

**Wireframe.**

```
┌──────────────────────────────────────────────────────┐
│ ‹ Back    LEVEL EDITOR   [ Validate ] [ ▶ Test ] [ ⇪ ] │
├───────────────┬──────────────────────────────────────┤
│ PALETTE       │  BOARD   w[ 6 ]  h[ 6 ]   [undo][redo]│
│ ┌───┐ Floor   │  ┌───┬───┬───┬───┬───┬───┐            │
│ │▤ │ Wall/Stop│  │ S │   │ ▶ │   │   │   │            │
│ ├───┤          │  ├───┼───┼───┼───┼───┼───┤            │
│ │▶ │ Arrow →  │  │   │   │   │ ╲ │   │   │            │
│ │▲ │ Arrow ↑  │  ├───┼───┼───┼───┼───┼───┤            │
│ ├───┤          │  │   │ ◈ │   │   │   │ ◎ │  ◎=exit   │
│ │╱╲│ Mirror   │  ├───┼───┼───┼───┼───┼───┤            │
│ │◎ │ Exit     │  │ … │                                 │
│ │◌ │ FakeExit │  └───┴───┴───┴───┴───┴───┘            │
│ │⬡ │ Portal   │  INSPECTOR: Arrow  dir[→▾]             │
│ │◈ │ Gem      │  ── VALID ✓ solvable in 4 · Medium ──  │
│ └───┘          │  [ Save ] [ Load ] [ Share code ]     │
└───────────────┴──────────────────────────────────────┘
```

**Accessibility.** The palette is a `role="toolbar"` / listbox of tools with labels and shortcuts.
The editable grid is a 2D `role="grid"` with cells addressable by keyboard (arrow-key navigation,
Enter/Space to place the selected tool, Delete to erase); the current tool and cell contents are
announced ("Placed arrow right at column 3, row 1"). Validation results are announced via a live
region. On mobile the palette collapses to a bottom sheet (see §7). Share-code fields are labelled
inputs with copy/paste affordances. Reduced motion disables any grid ripple feedback.

---

### S15 — Daily / Endless entry

**Purpose.** Frame the two generated modes before play. **Daily** is a single seeded puzzle per
date (result cached in `arrowEscape.v1.daily`, brief §10); **Endless** is an infinite generated
run with escalating difficulty and a streak. Both use the seeded generator that guarantees
solvable, non-degenerate, deduped boards (brief §18).

**Key elements.**

- *Daily:* today's date, the seed (shown/hidden), today's result if already played (stars, moves),
  a streak/calendar strip, and **Play today** (or **View result** if done).
- *Endless:* current run status (level index, streak, best), difficulty ramp indicator, and
  **Start run** / **Resume run**.

**Actions.** Primary: **Play** (Daily) / **Start/Resume** (Endless) → S4. Secondary: view past
results / calendar (Daily); reset run (Endless, confirm); share result code.

**States.**

| State | Presentation |
|-------|--------------|
| default | Mode framing + primary CTA. |
| daily-done | Primary becomes "View result"; shows today's stars/moves; countdown to next daily. |
| loading | Generating the seeded board → "Building today's puzzle…" spinner; CTA disabled. |
| empty | Endless with no run yet → "Start your first Endless run." |
| error | Generation failure (rare) → "Couldn't build a puzzle — try again." + Retry. Offline Daily uses the deterministic seed locally, so it still works offline. |

**Wireframe (combined entry).**

```
┌──────────────────────────────────────────────┐
│ ‹ Back        DAILY & ENDLESS                   │
├──────────────────────────────────────────────┤
│  ◔ DAILY — 2026-07-03                           │
│     Seed #A19F4  ·  streak 6 🔥                  │
│     [ mon ✔ ][ tue ✔ ][ wed ✔ ][ thu ● ]…      │
│     ┌────────────────────┐                      │
│     │  ▶  PLAY TODAY     │                      │  ← primary
│     └────────────────────┘                      │
│                                                │
│  ∞ ENDLESS                                      │
│     Run: level 12 · streak 12 · best 21         │
│     Difficulty ramp  ▁▂▃▄▅▆                      │
│     [ ▶ Resume run ]   [ Reset… ]               │
└──────────────────────────────────────────────┘
```

**Accessibility.** Date and seed are text (seed also copyable). Calendar strip cells are labelled
("Tuesday, completed, 3 stars"). Streak flame has a text equivalent. Generation loading uses
`aria-busy` + polite "Building today's puzzle." Primary CTA autofocused. Reset (Endless) confirms
and warns it clears the current streak.

---

## 6. HUD specification

The HUD is the persistent gameplay overlay on S4/S12. It must remain readable, calm, and never
occlude the board's playable area. All counters use **tabular numerals** so digits don't jitter.

### 6.1 Elements

| Element | Content | Behavior | Update timing |
|---------|---------|----------|---------------|
| **Moves** | `Moves N` | Count of launches from a rest state (brief §2). Increments only on a *valid* move. | On rest after each valid launch. |
| **Par** | `/ par M` | Target move budget = solver-optimal + small slack (brief §4). Static per level; `—` until solver reports. | On level load / solve complete. |
| **Optimal** (context) | shown on complete / hint | The solver-optimal count; used for 2★/3★ gating. | On S10; on demand. |
| **Timer** | `⏱ mm:ss` | Scoring-only; **no** timer loss (brief §3–4). Pauses on Pause/soft-fail overlays. | Per second while at rest & playing. |
| **Stars preview** | `★ ☆ ☆` | Live projection of achievable stars given current moves/hints/collectibles. | On each move / hint / gem pickup. |
| **Collectibles** | `◈ c / t` | Gems collected / total on this level (brief §4, §6). Hidden if the level has none. | On gem pickup. |
| **Undo** | `↶` (U) | Pop one state snapshot (unlimited undo, brief §9). Disabled at initial state. | On move / undo. |
| **Restart** | `⟲` (R) | Reset to level initial state; attempts++ (brief §9). | On press. |
| **Hint** | `💡` (H) | Reveal next optimal launch (brief §8). Shows remaining budget; using it caps this attempt's stars per rules. Disabled when budget exhausted or `hintsAllowed=0`. | On press / budget change. |
| **Pause** | `⏸` (Esc) | Open S5. | On press. |
| **Level chip** | `W·L "name"` | Identifies the current level. | On load. |

### 6.2 Layout & priority

The HUD splits into a **top strip** (status: moves/par, timer, collectibles, star preview) and an
**action cluster** (undo/restart/hint; pause lives in the header). Priority order when space is
tight (drop/collapse from lowest priority up): Level name → Timer → Star preview → Collectibles →
Par → Moves. Moves, Undo, Restart, Hint, Pause are **never** hidden.

```
DESKTOP / TABLET (status top, actions bottom)
┌───────────────────────────────────────────────┐
│ W1·L5 “Slipstream”              ⏸       ★☆☆     │
│ Moves 4 / par 3     ⏱ 00:27         ◈ 1/2       │
│  ┌───────────────────────────────────────────┐ │
│  │                BOARD                        │ │
│  └───────────────────────────────────────────┘ │
│     [ ↶ Undo ]  [ ⟲ Restart ]  [ 💡 Hint 2 ]    │
└───────────────────────────────────────────────┘

MOBILE (status compact top, actions as a bottom bar above the thumb zone)
┌─────────────────────────┐
│ Mv 4/3  ⏱0:27 ◈1/2 ★☆☆ ⏸│
│ ┌─────────────────────┐ │
│ │        BOARD         │ │
│ └─────────────────────┘ │
│  ↶      ⟲      💡·2      │  ← 44px targets, thumb-reachable
└─────────────────────────┘
```

### 6.3 HUD states

- **Hint budget exhausted:** Hint button disabled, label "Hint 0", tooltip "No hints left."
- **Undo unavailable:** at initial state, Undo disabled + `aria-disabled`.
- **Over par:** Moves count switches to a "you're past par" treatment (icon + text, not color
  only — e.g. a small `!` and label "over par"); this is informational, never blocking.
- **Collectibles absent:** the `◈` cluster is removed entirely (not shown as 0/0).
- **Solve pending:** par shows `—`; Hint disabled with "Solving…" until the solver returns.

### 6.4 HUD accessibility

- Each counter is a labelled live-updating value: `Moves` uses `aria-live="polite"` and reads
  "4 moves, par 3." Timer is **not** a live region (would be noisy); it's readable on focus/demand.
- Star preview announces changes politely ("On track for 2 stars") but is debounced to avoid
  chatter.
- Action buttons are real `<button>`s with `aria-keyshortcuts` (`U`, `R`, `H`, `Escape`) and
  visible focus rings ≥3:1 contrast. Disabled buttons remain discoverable and explain why.
- The move-result announcement (see S4) is the primary channel; the HUD counters are the visual
  mirror of the same state.

---

## 7. Responsive behavior & breakpoints

Layout is fluid within three ranges. The **board always gets the largest safe square** that fits
after reserving HUD space; UI scales relative to it.

| Breakpoint | Range | Primary layout intent |
|------------|-------|-----------------------|
| **Mobile** | ≤ 599 px (portrait phones) | Single column; HUD status compressed to one line; action cluster becomes a thumb-reachable bottom bar; D-pad/swipe primary. |
| **Tablet** | 600–1023 px | Board centered with breathing room; HUD status top, actions bottom; menus in comfortable single/two-column. |
| **Desktop** | ≥ 1024 px | Centered board with generous margins; keyboard-first; menus may use multi-column grids and side rails (e.g. editor palette as a fixed left rail). |

Orientation: on **mobile landscape**, move the action cluster to a right-hand vertical strip and
keep the board square on the left, so the thumb zone isn't split by a wide board.

### 7.1 Per-screen adaptations

| Screen | Mobile | Tablet | Desktop |
|--------|--------|--------|---------|
| S2 Menu | Stacked buttons full-width; meta row wraps to 2 cols. | Centered column, larger primary. | Centered column; meta row inline. |
| S3 Select | World rail is a horizontal swipe carousel; level grid 3–4 cols. | Rail as tabs; grid 5–6 cols. | Rail as tabs; grid 6–8 cols with a world-summary side panel. |
| S4 Gameplay | Status one line; bottom action bar + optional D-pad; board fits width. | Board centered; actions below. | Large centered board; actions below; keyboard hints visible. |
| S6 Settings | Full-screen, single column, sectioned. | Single column, wider. | Two-column sections. |
| S10/S11/S5 overlays | Near-full-screen sheets from bottom. | Centered cards. | Centered cards. |
| S14 Editor | Palette becomes a **bottom sheet**; inspector a collapsible panel; grid pinch-zoom/pan. | Palette left rail (narrow); grid center. | Palette left rail; inspector right; grid center — full three-pane. |
| S13 Help | Accordion sections. | Two columns for legend. | Two/three columns; legend as a grid. |

### 7.2 Board fit & camera

- The board fits-to-view by default; large levels enable pan/zoom with virtualized draw (only
  visible tiles rendered — brief §13). On mobile, pinch-zoom and one-finger pan; on desktop,
  scroll-to-zoom + drag-pan; keyboard pans with modifier + arrows when zoomed.
- UI scale (Settings) multiplies HUD/type sizing independently of board fit, honoring the min
  44px touch-target rule at every scale.

### 7.3 Safe areas & targets

- Respect device safe-area insets (notches, home indicators); the bottom action bar sits above the
  home indicator.
- Minimum interactive target 44×44 px at all breakpoints (brief §11); spacing prevents mis-taps in
  the action cluster.

---

## 8. Interaction models — touch vs keyboard vs pointer

Three fully-supported input models, all reaching the same *intents* dispatched to
`GameController` (brief §12, §19). No action is exclusive to one model.

### 8.1 Keyboard (desktop-first, always available)

| Key(s) | Action |
|--------|--------|
| `←↑→↓` / `WASD` | Launch in that direction (one move). |
| `U` | Undo |
| `R` | Restart |
| `H` | Hint |
| `Esc` | Pause (and: close overlay / safe-cancel) |
| `Enter` / `Space` | Confirm primary action / activate focused control |
| `Tab` / `Shift+Tab` | Move focus (menus/HUD); board itself is one focus stop |
| `?` | Open Help overlay |

Focus-visible is mandatory everywhere (brief §11). During flight (animating state), directional
keys are queued or ignored until rest to preserve determinism; the queue is at most one input deep
to avoid surprise chains.

### 8.2 Touch (mobile/tablet)

| Gesture | Action |
|---------|--------|
| **Swipe** (up/down/left/right) on the board | Launch in that direction (primary). Direction from dominant axis; short flicks count if past a small threshold. |
| **On-screen D-pad** (optional, Settings) | Tap a direction to launch — accessibility/precision alternative to swipe. |
| **Edge-tap** (optional, Settings) | Tap the board edge adjacent to a direction to launch that way (brief §12). |
| **Tap HUD buttons** | Undo/Restart/Hint/Pause. |
| **Pinch / one-finger drag** | Zoom / pan a large board. |

Haptics (Settings-toggled) fire on **stop**, **redirect**, and **win** (brief §12). Swipe and pan
are disambiguated: a pan gesture requires the board to be zoomed in; otherwise directional swipes
launch.

### 8.3 Pointer/mouse (desktop optional)

Mouse users can click the D-pad or edge-tap zones, or simply use the keyboard. Click-drag on a
zoomed board pans; wheel zooms. Hover reveals tooltips but **never** gates any action (P4).

### 8.4 Input parity & conflicts

- The same move-result live announcement fires regardless of input source.
- Only one input model needs to be learned; Help and coach marks present the model matching the
  current device but mention the others.
- If a swipe would be ambiguous with pan, pan only engages when zoomed; when fit-to-view, all
  swipes are launches.

---

## 9. Onboarding & tutorial coach-mark flow

Onboarding lives in the 8 Tutorial levels (S12), teaching Flow → walls/stop → exit → mirrors
(brief §6, §73). It is guided and **unmissable** by design: each step arms only the correct input,
so a new player cannot get lost.

### 9.1 First-run routing

```
S0 Loading ──(no saved profile)──▶ set firstRun flag
S1 Splash  ──begin──▶ if firstRun: S12 Tutorial (step 1)
                       else:        S2 Main Menu
```

A player can **Skip tutorial** at any step (confirm), landing in S3 → Easy world. Skipping still
sets tutorial-complete so it won't re-trigger; Help/Tutorial can be replayed from S13/S2.

### 9.2 Coach-mark anatomy

```
        ┌───────────────────────────┐
        │  Arrows bend your path.    │   ← caption (concise, 1–2 lines)
        │  Swipe RIGHT to launch.    │   ← the required action, per input model
        └─────────────┬─────────────┘
                      ▼  (pointer to the spotlighted element)
              ░░░░░[ ▶ arrow tile ]░░░░░   ← spotlight: dashed ring + dim surround
```

- **Spotlight:** dims everything except the target; the target gets a dashed ring (shape cue, not
  color-only) and a gentle pulse (static outline under reduced motion).
- **Gate:** the step does not advance until the taught input is performed correctly ("Try it"),
  except pure *reading* steps which advance on **Next**.
- **Recovery:** a wrong/ineffective input triggers a soft nudge + re-explain, never a failure.

### 9.3 Step sequence (illustrative, 8 levels)

| Step | Teaches | Gate |
|------|---------|------|
| 1 | Launch & slide: "Swipe/press a direction; the token slides until it stops." | Perform any launch to a wall/stop. |
| 2 | Walls & stop pads as rest points. | Reach a stop pad. |
| 3 | Arrows redirect. | Route through an arrow to redirect. |
| 4 | The Exit: reach it to win. | Reach the real exit. |
| 5 | Undo: recover a mistake. | Press Undo once. |
| 6 | Mirrors reflect ( `/` and `\` ). | Route through a mirror. |
| 7 | Fewest launches / par & stars. | Beat within par. |
| 8 | Free solve combining the above; HUD fully revealed. | Complete unaided. |

Coach marks are introduced *just-in-time*: the HUD reveals each element the moment it becomes
relevant (Undo appears at step 5, par/stars at step 7), avoiding early overwhelm.

### 9.4 Post-tutorial nudges

New mechanics beyond the tutorial (portals, gates, lasers…) get a **single lightweight coach
mark** the first time they appear in the main campaign (a one-line "New: portals keep your
direction" tip), tracked per-mechanic so it's shown once. These respect reduced motion and are
dismissible.

### 9.5 Onboarding accessibility

- Each coach mark announces on appearance and moves focus to its action control; the caption is the
  accessible description.
- The required action always has a keyboard equivalent phrasing ("Press the Right arrow").
- Skip is always keyboard-reachable and clearly labelled.
- Spotlight relies on shape + text, never color alone; pulse is reduced-motion gated.

---

## 10. Error, empty & loading patterns

Consistent patterns so every screen behaves predictably (brief §10 mandates guarded, resilient
storage; the UI surfaces those failures gently).

### 10.1 Loading

| Pattern | Where | Rule |
|---------|-------|------|
| **App boot** | S0 | Determinate bar when byte totals known; indeterminate shimmer otherwise; caption cycles. |
| **Skeletons** | S3, S7, S8 grids/cards | Show layout-shaped placeholders; avoid spinners for content that renders from cache near-instantly. |
| **Inline spinner** | Solver runs (S14 validate), next-level load (S10), daily generation (S15) | Local spinner + label; disable the dependent CTA; keep the rest interactive. |
| **`aria-busy`** | all | Set on the region being loaded; announce start/finish politely. |

### 10.2 Empty

| Screen | Empty message | CTA |
|--------|---------------|-----|
| S7 Stats | "No stats yet — play your first level to start tracking." | Play |
| S8 Achievements | Grid still shows locked cards (encouraging), summary "0/50". | — |
| S14 Editor | "Place a Start and an Exit to begin." | (place tools) |
| S15 Endless | "Start your first Endless run." | Start run |
| S3 (future world) | "Coming soon" / unlock hint. | — |

Empty states are friendly, explain the next action, and never look like an error.

### 10.3 Error

| Class | Example | Presentation | Recovery |
|-------|---------|--------------|----------|
| **Storage read** | corrupt save at boot | S0 banner (`role="alert"`) | Retry · Start fresh (quarantine, non-destructive) |
| **Storage write** | quota exceeded | non-blocking toast | auto-retry debounced; suggest Export |
| **Level load/parse** | bad level in pack / custom | inline card in board area | Retry · Back to select |
| **Share code** | bad/newer-version code | inline field error | correct/paste again |
| **Generation** | rare generator failure | inline card | Retry (deterministic offline seed still works) |

Principles: errors are **specific** ("storage full", not "error 42"), **non-destructive**
(nothing is deleted; bad data is quarantined and restorable in Settings › Data), and always offer a
**forward path**.

### 10.4 Offline

The app precaches via service worker (brief §13) and works offline. Daily uses a deterministic
seed so it plays offline; if a network-only future feature (leaderboard) is added, its absence is
shown as a quiet "offline" chip, never a blocking error.

---

## 11. Accessibility — cross-cutting rules

These apply to **every** screen, on top of the per-screen annotations above. They implement
brief §11.

**Keyboard.** Full play and full navigation by keyboard (arrows/WASD + Enter/Esc/U/R/H). Logical,
predictable tab order matching visual order. Focus-visible rings everywhere, ≥3:1 contrast. No
keyboard traps except intentional modal focus-traps (dialogs), each escapable via Esc.

**Focus management.**
- On screen change, focus moves to the screen's `h1`/primary control.
- On overlay open, focus moves into the overlay (primary action) and is trapped; on close it
  returns to the invoking control.
- Roving tabindex for grids (level select, editor) so arrow keys navigate cells and Tab exits the
  grid as one stop.

**ARIA & semantics.**
- Landmarks: `header`, `nav`, `main`, `dialog`. One `h1` per screen; ordered headings.
- Buttons are `<button>`; toggles `role="switch"`; segmented choices are radio groups; tabs use
  the tablist/tab/tabpanel pattern (world rail).
- Canvas board is `role="application"` with a descriptive label + optional screen-reader board
  description and grid-coordinate mode for low vision.

**Live regions.**
- Polite: move results, HUD counter changes (debounced), setting changes, generation progress.
- Assertive: win ("Level complete…"), soft-fail cause, invalid-move feedback that needs immediate
  awareness.
- Announcements are text equivalents of every audio/visual cue — **no essential audio-only or
  color-only information** (arrows have shape, gates have icons, colors also encoded by pattern/
  symbol).

**Reduced motion.** Honors `prefers-reduced-motion` and the explicit Settings toggle: disables
parallax/particles, shortens tweens, uses cross-fades, replaces star cascades and win bursts with
static states, and turns coach-mark pulses into static outlines. No information is conveyed only by
motion.

**Color & contrast.** Selectable colorblind-safe palettes (deuter/prot/trit/high-contrast) and
themes; text and UI meet contrast minimums; meaning never rests on hue alone. Focus and state also
carry shape/text.

**Targets & scaling.** Minimum 44×44 px touch targets; UI scale control; layouts reflow without
loss of function; content is operable at increased zoom.

**Per-screen focus order (summary).**

| Screen | Focus lands on | Notable order |
|--------|----------------|---------------|
| S1 Splash | Begin (whole surface) | single stop |
| S2 Menu | Continue/Play | primary → modes → meta |
| S3 Select | active world tab / continue | rail → grid (roving) → continue |
| S4 Gameplay | board (application) | board → HUD actions → pause |
| S5 Pause | Resume | resume → restart → settings → help → quit |
| S6 Settings | first control / Back | sections top→bottom |
| S10 Complete | Next level | primary → secondary |
| S11 Soft-fail | Undo | undo → restart → hint |
| S14 Editor | grid or palette | palette → grid (roving) → validate/actions |

---

## 12. Motion & reduced-motion reference

Durations follow the brief's tiers (§14). Every animated cue has a static equivalent.

| Interaction | Full motion | Reduced motion |
|-------------|-------------|----------------|
| Input feedback (button press, invalid nudge) | 150 ms spring | 0–120 ms opacity only |
| Screen / overlay transition | 250 ms cross-fade + slight rise | ≤120 ms opacity cross-fade |
| Token launch | squash/stretch, slide, bounce on stop | direct slide, no squash; shorter |
| Redirect | particle burst | small static flash / none |
| Win | rising arpeggio + particle burst + star cascade | static glow + stars fade in together |
| Coach-mark spotlight | gentle pulse | static dashed outline |
| Background | parallax grid | static tinted grid |

---

## 13. Appendix — wireframe legend

ASCII wireframes above use these conventions:

```
┌ ┐ └ ┘ │ ─ ├ ┤ ┬ ┴ ┼   box borders / dividers
[ Label ]               a button
( ) / (•)               radio (unselected / selected)
[────●────]             slider (● = thumb)
[ Value ▾ ]             dropdown / select
▓▓░░                    progress fill / track
★ / ☆                   earned / empty star
🔒                       locked
▶ ▲ ◀ ▼                 arrow tile directions
╱ ╲                     mirror tiles
▤                       wall / stop pad
◎ / ◌                   real exit / fake exit
⬡                       portal (paired)
⛒                       one-way gate
◈                       gem (collectible)
⌁                       laser (hazard)
●                       player token
◀coach                  points to the spotlighted element
‹ Back  ⚙  ?            header: back, settings, help
```

Glyphs here are documentation shorthand; the shipped art is soft geometric minimalism per
brief §14, and every symbol is paired with shape + label in-product so meaning never depends on
color or a single glyph alone.

---

*End of UX Specification. Keep this file in sync with `docs/design-brief.md`; when they diverge,
the brief is authoritative and this document is corrected.*
