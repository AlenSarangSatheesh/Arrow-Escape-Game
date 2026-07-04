# Arrow Escape — Game Design Document

> **Status:** Living document · **Version:** 1.0 · **Authoritative source:** This GDD conforms to the project Design Brief. Where the two disagree, the Design Brief wins and this document should be corrected.

---

## 1. Title & One-Liner

**Arrow Escape** — a calm, tactile slide-and-redirect grid puzzle. Launch a token that slides until it hits something; arrows redirect it. Route yourself to the Exit using the fewest launches.

Arrow Escape sits at the intersection of two feelings that rarely share a room: the **calm, premium serenity** of a high-end mobile puzzler (think *Monument Valley* or *Mekorama*) and the **crisp, deductive logic** of a Zachtronics box. Every level is a small deterministic machine. You are not fighting reflexes or a clock — you are reading a system and finding its shortest path.

---

## 2. Design Pillars

Every feature, level, and line of code should defend at least one of these. When a decision is unclear, ask which pillar it serves.

| # | Pillar | What it means in practice |
|---|--------|---------------------------|
| **P1** | **Deterministic clarity** | A state plus a launch direction always produces exactly one outcome. No hidden randomness in resolution. This makes the game *solvable*, *hintable*, *generatable*, and *fair*. |
| **P2** | **Calm & tactile** | Soft geometric visuals, generous negative space, satisfying micro-feedback (squash, bounce, chime). The game should feel good to touch even when you are not solving anything. |
| **P3** | **One idea at a time** | Each world introduces a single new mechanic in isolation, teaches it wordlessly, then combines it. Complexity is *earned*, never dumped. |
| **P4** | **Elegant minimal solutions** | The joy is the "aha" of the short path. Par and 3-star gating reward economy of moves, not grinding. |
| **P5** | **Respectful & accessible** | No punitive game-over in normal play. Full keyboard play, reduced motion, colorblind-safe encoding, screen-reader board description. Nobody is locked out. |

---

## 3. Target Audience & Platforms

**Audience.** Puzzle players who enjoy *thinking* over *twitch*: fans of logic puzzles, sliding-tile games, and premium mobile puzzlers. Age-agnostic; the tutorial floor is low (an eight-level guided on-ramp) while the Master world and boss puzzles provide a deep ceiling for enthusiasts.

**Platforms.**

- **Primary:** Modern evergreen browsers on **desktop** (keyboard-first) and **mobile/tablet** (touch-first). Installable as a **PWA**; works fully **offline** via service-worker precache.
- **Rendering budget:** instant load (< 100 KB critical path), a smooth 60 fps, no binary art or audio assets (visuals are drawn, audio is synthesized).
- **No app store dependency:** it is a website first. Store wrappers are a future consideration, not a requirement.

---

## 4. Core Gameplay — the "Flow" Model

### 4.1 The board

The board is a rectangular grid of **tiles** (cells). Coordinates are `(col x, row y)` with the origin at the **top-left**. The player controls a single **token** that rests on a tile.

```
        x →
   +----+----+----+----+----+
 y | 0,0| 1,0| 2,0| 3,0| 4,0|
 ↓ +----+----+----+----+----+
   | 0,1| 1,1| 2,1| 3,1| 4,1|
   +----+----+----+----+----+
   | 0,2| 1,2| 2,2| 3,2| 4,2|
   +----+----+----+----+----+
```

### 4.2 A launch

The player inputs one of **four directions** — Up, Down, Left, Right. The token then **slides**, resolving **one tile at a time** in the current direction. It does not stop on its own until the board tells it to.

A **move** is defined as **one launch from a rest state to the next rest state (or a fail).** Your score is measured in moves — that is, launches — not in tiles travelled.

### 4.3 Tile-by-tile resolution rules

At each tile the token enters, resolution proceeds by tile type:

| Tile / condition | Effect on the sliding token |
|------------------|-----------------------------|
| **FLOOR** | Continue in the current direction. |
| **ARROW(dir)** | Current direction **becomes** `dir`; continue sliding. |
| **MIRROR("/" or "\\")** | Reflect the current direction. `/`: Right↔Up, Left↔Down. `\\`: Right↔Down, Left↔Up. Continue. |
| **WALL / edge-with-wall / STOP pad** | Token **stops** on the last valid tile — a **rest state**. |
| **VOID / open edge** | Token **falls** → soft fail (unless a flying mechanic applies). |
| **EXIT (real)** | Level complete. |
| **PORTAL(a)** | Teleport to paired **PORTAL(b)**, keep direction, continue. |
| **CONVEYOR(dir)** | While the token *rests* on it after stopping, it is **nudged** one tile in `dir` (creates additional motion). |
| **ICE** | Frictionless floor: it **skids the token straight past the very next redirect tile** (an arrow immediately after ice is ignored). |

### 4.4 Determinism and the safety valve

**Determinism (Pillar P1).** Given a board state and a launch direction, the resulting rest state is fully determined. There is no randomness in resolution. This single property is what makes exact solving, hinting, difficulty scoring, and generation *tractable* — the entire intelligent-systems layer depends on it.

**Cycle safety.** A slide could in principle loop forever (e.g., four arrows in a ring). The engine tracks visited `(position, direction)` pairs during a single slide; if resolution would revisit a `(pos, dir)` it has already seen, the slide is a **cycle**. Such a move is treated as **illegal / ignored** — no infinite loop ever occurs. The level generator additionally **forbids unavoidable cycles**, so a solvable path always exists.

### 4.5 Worked example — a single slide

Consider this `5×3` fragment. `S` is the start, `→ ↑` are arrow tiles pointing in those directions, `▚` is a `\\` mirror, `#` is a wall, `E` is the real exit.

```
   x: 0    1    2    3    4
     +----+----+----+----+----+
 y0  | S  |    | →  |    | #  |
     +----+----+----+----+----+
 y1  |    |    |    |    | E  |
     +----+----+----+----+----+
 y2  |    |    | ↑  |    | #  |
     +----+----+----+----+----+
```

The token rests at `S = (0,0)`. The player launches **Right**. Resolution proceeds tile by tile:

1. Enter `(1,0)` — FLOOR. Direction stays **Right**. Continue.
2. Enter `(2,0)` — **ARROW(Right)**. Direction is already Right; continue.
3. Enter `(3,0)` — FLOOR. Continue Right.
4. Enter `(4,0)` — **WALL** (`#`). Cannot occupy. Token **stops** on the last valid tile, `(3,0)`. New rest state: `(3,0)`.

That is **one move**. The token now rests at `(3,0)`. Suppose the player launches **Down**:

1. Enter `(3,1)` — FLOOR. Continue Down.
2. Enter `(3,2)` — FLOOR. Continue Down.
3. Attempt to enter `(3,3)` — **open edge / VOID**. The token would fall → **soft fail**, prompting an automatic Undo.

Instead the player, from `(3,0)`, launches **Left** then re-plans — or, better, routes through the arrow at `(2,0)` earlier. This illustrates the core loop: *read the machine, predict the rest state, choose the launch that advances you toward the Exit in the fewest moves.*

> **Reading tip for level authors:** because the token slides until stopped, walls and stop pads are as important as arrows — they are where *thought* happens. An arrow with nothing to stop against just sends you off a cliff.

---

## 5. Game Loops

### 5.1 Moment-to-moment loop (seconds)

```
        ┌──────────────────────────────────────────────┐
        │                                              │
        ▼                                              │
  READ the board  →  PREDICT the rest state  →  LAUNCH (a direction)
        │                                              │
        │                                              ▼
        │                                    OBSERVE the slide
        │                                    (redirects, stops)
        │                                              │
        │                        ┌─────────────────────┤
        │                        ▼                     ▼
        │                   reached Exit?          soft fail /
        │                   → WIN feedback         wrong rest?
        │                        │                     │
        │                        ▼                     ▼
        └────────────────  next level            UNDO / RESTART ──┐
                                                                  │
                        (re-read, re-plan) ◄──────────────────────┘
```

The satisfying beat is the gap between **predict** and **observe**: you commit to a launch, watch the token thread the machine, and get the small dopamine hit of a clean stop on the tile you intended (or the instructive surprise of a redirect you missed).

### 5.2 Session loop (minutes to a sitting)

```
  Enter game (Menu / Daily / Endless)
        │
        ▼
  Pick a level  ──►  Solve it  ──►  Level Complete (stars, par, time)
        │                │                     │
        │                │                     ▼
        │                │            Improve? (chase 3 stars / optimal)
        │                │                     │
        │                └─────────◄───────────┘
        ▼
  Unlock progress (stars gate next world)
        │
        ▼
  Stats / Achievements / Themes  ──►  return to level select or leave
```

Retention hooks: **3-star chasing** (replay for the optimal path), **stars-gated unlocks** (next world), **Daily** (one shared seed per day), **Endless** (infinite fresh boards), and **cosmetic theme unlocks**.

---

## 6. Controls

Controls are **launch-centric**: the player expresses one of four directions per move. Every input maps to a direction or a HUD verb.

### 6.1 Desktop

| Input | Action |
|-------|--------|
| **Arrow keys** / **WASD** | Launch Up / Down / Left / Right |
| **U** | Undo (unlimited) |
| **R** | Restart level |
| **H** | Hint (reveal next optimal launch) |
| **Esc** | Pause |
| **Enter** | Confirm / advance dialogs |

Focus is visible everywhere; the entire game is playable **keyboard-only** (Pillar P5).

### 6.2 Touch / mobile

| Input | Action |
|-------|--------|
| **Swipe** (up/down/left/right) | Launch in that direction |
| **On-screen D-pad** (optional) | Launch via tap |
| **Tap HUD targets** | Undo / Restart / Hint / Pause |
| **Haptics** (toggle) | Buzz on stop, redirect, and win |

### 6.3 Shared (both input models)

- **Tap an adjacent-direction board edge** to launch that way (optional convenience).
- All touch targets are a **minimum of 44 px**.

---

## 7. Win / Lose Conditions

| Outcome | Trigger | Consequence |
|---------|---------|-------------|
| **WIN** | Token reaches the **real** Exit. | Level complete; stars awarded; progress saved. |
| **Soft LOSE** | Token falls into VOID / off an open edge, **or** hits a hazard (e.g., a laser). | **No punitive game-over.** An automatic **Undo prompt** appears; the player steps back and continues. |
| **(Optional) Hardcore** | Same triggers, opt-in mode. | Stricter fail handling for players who want stakes. Off by default. |

There is **no timer-based loss** in standard mode. The timer exists **for scoring only** — it never ends a level.

> A **fake exit** looks like an exit but **rejects** the token (visually "off": dashed, cracked). Reaching a fake exit does not win and does not fail — it simply is not the real exit, so the token resolves against it like any non-exit tile per its concrete rule.

---

## 8. Mechanics Catalog

The complete mechanic set, ordered by teaching sequence. Each is introduced **one per world**, in isolation, then combined. "Tier" is the world where it is first taught.

> **Legend for interactions:** mechanics are listed by number so cross-references stay stable.

| # | Mechanic | Tier | Rule (what it does) | Why it's fun | Teaching notes | Key interactions |
|---|----------|------|---------------------|--------------|----------------|------------------|
| 1 | **Arrow (4-dir)** | Tutorial | On entry, sets the token's direction to the arrow's direction; slide continues. | The core verb: you *route* motion instead of aiming it. | First tile ever taught. Single arrow, single wall, obvious redirect. | Chains with other arrows (2,5,11), reflected by mirrors' logic being distinct; feeds portals (8) and conveyors (12). |
| 2 | **Wall / Stop pad** | Tutorial | Impassable. Token stops on the last valid tile before it — a rest state. | Creates *rest points*; where planning happens. Without stops there is no puzzle. | Teach immediately after arrows: "arrows send, walls stop." | Defines nearly every rest state; pairs with arrows to build corridors; boundaries for ice lakes (18). |
| 3 | **Exit / Fake exit** | Tutorial→Easy | Real exit = win on entry. Fake exit looks like an exit but rejects the token. | The "read carefully" hook; decoys punish assumptions. | Tutorial shows the real exit clearly; fake exits arrive in Easy so the contrast is learned. | Multi-exit boss levels (19,23) lean on distinguishing real vs. fake. |
| 4 | **Mirror ("/", "\\")** | Easy | Reflects direction. `/`: Right↔Up, Left↔Down. `\\`: Right↔Down, Left↔Up. | Diagonal reads; feels like light bouncing. | Introduce each diagonal separately with a clean 90° bounce. | Essential to laser routing (17); combines with arrows (1) for tight switchbacks. |
| 5 | **Reverse arrow** | Easy | Flips direction 180° on entry. | A satisfying "boomerang"; enables back-and-forth setups. | One reverse tile against a wall to show the U-turn. | With walls (2) can create precise oscillation stops; contrast with rotating arrow (11). |
| 6 | **Collectible (gem)** | Easy | Optional pickup on the tile; collected when passed over. | Adds an optional optimization layer; needed for 3 stars. | First gem sits directly on the obvious path — free, to teach the icon. | Interacts with 3-star scoring (§9); tension with optimal-move routing. |
| 7 | **One-way gate** | Medium | Passable in one direction only; blocks the opposite. | Introduces *directional legality*; forces approach planning. | Show a gate that must be entered "with the grain." | Combines with portals (8) and conveyors (12) for forced flows; pairs with locked tiles (9). |
| 8 | **Portal / Teleporter (paired)** | Medium | Entering portal A teleports the token to its paired portal B; **direction is kept**; slide continues. | Non-local movement; spatial "wormhole" reasoning. | Two portals, straight shot in, obvious exit side. | Direction-preservation matters with arrows (1) and mirrors (4) placed just past B; pairs are entities in the level format. |
| 9 | **Key + Locked tile** | Medium | Picking up a key opens locks of the **same color**; locked tiles are walls until opened. | Order-of-operations puzzles; unlock sequencing. | Single key, single same-color lock, short detour. | Layers with color gates (10); locks act as temporary walls (2). |
| 10 | **Color gate + color pickup** | Medium | A color gate is passable only while the token is **carrying** that color (from a color pickup). | State you *carry*; adds a resource dimension. | One pickup, one matching gate on the path. | Distinct from keys (9): color is a carried state, not a consumed unlock; encoded by symbol + pattern for accessibility. |
| 11 | **Rotating arrow** | Hard | Acts as an arrow, but **rotates 90° clockwise each time the token leaves it**. | Temporal state: the board *changes as you use it*. | Show one rotating arrow with a target that only lines up after N passes. | Interacts with move counting; pairs with reverse (5) and mirrors (4) for evolving routes. |
| 12 | **Conveyor** | Hard | After the token comes to rest **on** a conveyor, the conveyor **nudges** it one tile in its direction (extra motion beyond the launch). | Rest states become *unstable*; timing and positioning. | Teach with a conveyor that gently delivers the token onto a needed tile. | Combines with one-way gates (7), portals (8), and stop pads (2) to control where the nudge lands. |
| 13 | **Pressure switch + toggle wall/bridge** | Hard | Stepping on / resting on a switch toggles linked walls or bridges (open↔closed). | Cause-and-effect state puzzles; remote consequences. | One switch, one visible toggled wall; show the link. | Underpins timed doors (16) and moving walls (15); switch→target links are entities. |
| 14 | **Bridge / crossover** | Hard | Perpendicular paths cross without interfering; or a **toggled bridge** spans a void. | Enables layered routes and clean 2D crossings. | Show two crossing corridors, then a bridge over a gap. | Toggled bridges pair with switches (13); crossovers matter for laser routing (17) and dense boards. |
| 15 | **Moving wall** | Expert | Shifts position on a step cycle: its phase is a function of the **move count** (`phase = f(moveCount)`). | The board breathes; you time launches to gaps. | Introduce a slow, clearly-telegraphed shuttle. | Deterministic on move count (P1); combines with timed doors (16) for choreography. |
| 16 | **Timed door** | Expert | Opens/closes based on move-count **parity or period**. | Rhythm inside a logic puzzle; plan around the beat. | Door open on even moves, closed on odd — shown with a counter. | Sibling to moving walls (15); both are pure functions of move count, keeping the level solvable. |
| 17 | **Laser + emitter / mirror routing** | Expert | A beam blocks or kills the token unless rerouted (via mirrors) or disabled (via switch). | Reroute-the-beam spatial logic; a hazard you *reshape*. | Start with a beam you simply avoid, then one you must reroute with a mirror (4). | Heavy synergy with mirrors (4), switches (13), and crossovers (14); a hazard for soft-fail (§7). |
| 18 | **Ice** | Expert | Frictionless: crossing ice makes the token **skid straight past the very next redirect tile** (the immediately-following arrow or mirror is ignored). | Subverts expectation — the arrow you were counting on is skipped. | Place an arrow right after an ice tile and show it being ignored. | Combines with arrows/mirrors (1, 4) to build "obvious but wrong" routes. |
| 19 | **Multiple real exits + fake exits** | Expert | More than one real exit may exist alongside fakes; reaching **any real** exit wins. | Choice and mis-direction; the "which one?" tension. | Late-Expert: two reals, one fake, distinct routes. | Culmination of exit reading (3); central to bosses (23). |
| 20 | **Numbered / charge arrow** *(invented)* | Master | Acts as **floor** until it has been hit **N times**; only then does it redirect like an arrow. | A counter you must "charge" — routing to build up hits. | Introduce a 2-charge arrow with a loop that feeds it twice. | Interacts with rotating arrow (11) and reverse (5) to accumulate hits; pure function of hit count (P1). |
| 21 | **Magnet tile** *(invented)* | Master | When the token comes adjacent to a magnet, it is **pulled one extra tile toward** the magnet. | An attractive force bending your clean lines. | Show a magnet that helpfully pulls the token onto a target. | Combines with conveyors (12) for compound extra-motion; positioning against walls (2) matters. |
| 22 | **Fuse tile** *(invented)* | Master | Once activated, must be reached within **K moves** or it **seals** (becomes impassable). | A self-imposed clock inside a timerless game; urgency. | Introduce with a generous K and a short route. | Pairs with timed doors (16) and moving walls (15) for time-pressure choreography; sealing turns it into a wall (2). |
| 23 | **Boss puzzle** | Master | Large, multi-phase levels that **combine 4+ mechanics** with sub-goals. | The graduation exam; everything you learned, at once. | Never a *new* rule — only a masterful recombination. | Draws on any/all of 1–22; typically uses multi-exit (19) and staged sub-goals via switches (13) and fuses (22). |

### 8.1 Teaching philosophy (applies to all mechanics)

- **Isolate, then combine.** A mechanic debuts on a board where it is the *only* new idea and its behavior is unmissable (Pillar P3).
- **Show, don't tell.** The first encounter is engineered so the correct action also *demonstrates* the rule. Coach marks are a fallback, not the primary teacher.
- **Never rely on color alone.** Arrows have shape, gates have icons, colors are also encoded by pattern/symbol (Pillar P5).

---

## 9. Difficulty Progression by World

Content is organized into a guided **Tutorial** plus five worlds. Each world owns a mechanic cluster and escalates by combining within that cluster and reaching back into earlier worlds.

| World | Levels | Teaches (new mechanics) | Character of the challenge |
|-------|--------|--------------------------|-----------------------------|
| **Tutorial** | 8 | Flow, walls, exit, mirrors | Guided and **unmissable**. Establishes the core verb and reading habit. |
| **Easy (World 1)** | ~18 | Arrows, mirrors, reverse, decoy exits, gems | Clean single-idea puzzles; introduces optional gems and the fake-exit "read carefully" hook. |
| **Medium (World 2)** | ~18 | One-way gates, portals, keys, color | Legality and state: directional gates, non-local portals, unlock sequencing, carried color. |
| **Hard (World 3)** | ~18 | Rotating arrow, conveyor, pressure switch, bridge/crossover | The board gains *state and motion of its own*; cause-and-effect planning. |
| **Expert (World 4)** | ~18 | Moving wall, timed door, laser routing, ice lake, multi-exit | Timing and hazards; choreography against move-count functions; reroute-the-beam logic. |
| **Master (World 5)** | ~20 + bosses | Charge arrow, magnet, fuse, boss puzzles | The invented mechanics and full recombination. Bosses combine 4+ mechanics with sub-goals. |

**Target scope:** **100+** handcrafted / hand-curated levels, plus the **infinite** generated **Endless** and one-per-day **Daily**.

### 9.1 Difficulty estimation (for the generator & for labeling)

Each level is scored by a weighted sum, then bucketed into a world tier:

```
score = w1 · optimalMoves
      + w2 · distinctMechanics
      + w3 · branchingFactor            (dead ends / decision nodes)
      + w4 · boardArea^0.5
      + w5 · (uniqueSolution ? 0 : penalty)
      + w6 · hazardCount

bucket(score) → { Tutorial, Easy, Medium, Hard, Expert, Master }
```

This gives the generator a feedback signal and gives every level a consistent, comparable label.

---

## 10. Scoring, the 3-Star Model & Par

### 10.1 Objectives

- **Primary:** reach a real exit.
- **Secondary (optional):** time, hints used, collectibles.

### 10.2 Star rating (0–3)

| Stars | Requirement |
|:-----:|-------------|
| ⭐ | Complete the level. |
| ⭐⭐ | Complete within **par** moves. `par = solver-optimal + small slack`. |
| ⭐⭐⭐ | Complete at **solver-optimal** moves **and** collect all collectibles (if any). |

- **Par** is derived from the solver's optimal move count plus a small slack, so 2 stars is achievable by a thoughtful player and 3 stars is the connoisseur's target.
- **Hints and stars:** using a hint **caps that attempt's stars at 2** (unless configured otherwise). Chasing 3 stars means solving it yourself.

### 10.3 Score number (stats & leaderboard-readiness)

A numeric score is computed by a **pure `Scoring` module** so a future online leaderboard can reuse it unchanged:

```
score = base
      + moveBonus        (fewer moves relative to par → higher)
      + timeBonus        (faster → higher; time is scoring-only, never a loss)
      + collectibleBonus (all gems → full bonus)
```

| Term | Depends on | Notes |
|------|-----------|-------|
| `base` | Level completion | Awarded for any win. |
| `moveBonus` | Moves vs. par/optimal | Peaks at solver-optimal. |
| `timeBonus` | Completion time | Timer never ends a level; it only feeds this term. |
| `collectibleBonus` | Gems collected | Full when all collectibles are taken. |

Keeping `Scoring` pure (no DOM, no globals) means the same function powers the HUD, local stats, Daily results, and any future leaderboard.

---

## 11. Hint System (solver-backed)

The hint system is not a scripted crutch — it is powered by the same solver that validates and labels levels, so it is always correct and always optimal.

- **Solver.** BFS over **rest-states** (moves are unweighted) yields the optimal move count. For large boards, **A\*** with a cheap **admissible heuristic** (Manhattan-to-nearest-exit divided by max slide length) keeps it fast.
- **Progressive hint.** A hint reveals the **next optimal launch direction** — surfaced as an arrow flash on the HUD. Ask again for the following optimal move.
- **Show solution.** Replays the full optimal path as a **ghost animation** of the token.
- **Budget & cost.** There is a **hint budget per level**, and using a hint **caps that attempt's stars at 2** per §10.2.

---

## 12. Rewards, Unlocks & Progression Gating

Progression is **stars-gated**: solving is its own reward, and accumulated stars open new content.

```
  Solve levels  →  earn stars  →  reach a world's star threshold  →  unlock next world
        │                                                                │
        ▼                                                                ▼
  local best (moves/time/stars) saved                          new mechanics to learn
        │
        ▼
  totals & streaks feed Statistics & Achievements  →  cosmetic Theme unlocks
```

| Reward type | How earned | Effect on gameplay |
|-------------|-----------|--------------------|
| **Stars** | Completing levels; better play → more stars | Gate the next world's unlock. |
| **World unlocks** | Crossing a star threshold | Access to the next mechanic cluster. |
| **Achievements** | Milestones (perfect solves, gem totals, streaks, no-hint runs) | Bragging rights + progress counters; **no** gameplay advantage. |
| **Themes** | Progression milestones | **Purely cosmetic**, save-safe; palette tokens only. |
| **Statistics** | Passive accumulation | Totals: moves, time, hints, levels completed, perfect solves, gems, streaks. |

**Design rule:** unlocks never sell power. Everything cosmetic is optional; everything gameplay-relevant is a *new idea to learn*, not a stat boost. Save state is namespaced and versioned (`arrowEscape.v1.*`), with progress, unlocks, achievements, statistics, and custom levels persisted locally and exportable as a full profile JSON.

---

## 13. Themes

Themes are **unlockable, purely cosmetic, and save-safe**. A theme swaps **palette tokens only** — gameplay is identical across all of them, which keeps determinism and solver behavior untouched.

| Theme | Mood | Palette character |
|-------|------|-------------------|
| **Aurora** *(default)* | Calm, premium | Cool teal / indigo. |
| **Sunset** | Warm, cozy | Warm oranges / pinks. |
| **Mono** | High-contrast / print | Restrained monochrome; excellent for clarity and printing. |
| **Forest** | Grounded, natural | Greens and earth tones. |
| **Neon** | Nocturnal, energetic | Dark background with vivid accents. |

Because a theme changes only palette tokens, it composes cleanly with **colorblind-safe palettes** and **reduced-motion** settings.

---

## 14. Audio Design

All audio is **synthesized at runtime via WebAudio** — no binary sound files. This keeps the download tiny, the sound themeable, and the whole system mutable.

| Event | Sound character |
|-------|-----------------|
| **Launch** | Soft marimba / pluck. |
| **Stop** | Wood-block "tok." |
| **Redirect** | Bright chime. |
| **Win** | Rising arpeggio. |
| **Fail** | Low thud. |
| **UI** | Light ticks. |

- **Ambient music:** an optional generative pad, **off by default**, volume-controlled, respecting settings.
- **Policy compliance:** all audio is gated behind a **user gesture** (browser autoplay policy) and behind Settings volumes; everything is fully mutable.
- **Accessibility (Pillar P5):** **no essential audio-only cues.** Every sound has a visual equivalent (a redirect chime always coincides with a visible redirect flash, etc.).

---

## 15. Visual Style Summary

**Soft geometric minimalism.** Rounded tiles, subtle depth via long soft shadows and inner light, restrained gradients, generous negative space, and delightful micro-animations. The aesthetic target is *premium and consistent* — nothing shouts.

| Element | Look |
|---------|------|
| **Player token** | A rounded "chip" with a subtle directional glint. |
| **Arrows** | Chunky rounded chevrons with an animated idle shimmer; direction reads at a glance. |
| **Exit** | A glowing portal ring with a pulsing draw-in. |
| **Fake exit** | Visually "off" — dashed, cracked. |
| **Background** | Layered soft gradient with a faint parallax grid, theme-tinted (static under reduced motion). |
| **Typography** | One geometric sans for UI (system-stack fallback: Inter / SF / Segoe), **tabular numerals** for counters, clear hierarchy, large friendly headings. |

Rendering uses **Canvas 2D** for the board and **DOM/CSS** for menus, HUD, and overlays, with DPR-aware crisp drawing and a static/dynamic layer split for performance.

---

## 16. Animation & Feel Language

Feel is a first-class feature (Pillar P2). The token is *alive*:

- **Squash & stretch** on launch.
- **Bounce** on stop.
- **Particle burst** on redirect and on win.

**Motion tiers (consistent everywhere):**

| Tier | Duration | Used for |
|------|----------|----------|
| Snappy | **150 ms** | Immediate input feedback. |
| Standard | **250 ms** | Most transitions. |
| Expressive | **400 ms** | Entrances and celebratory moments. |

**Easing vocabulary:** ease-out **spring** for entrances, **ease-in-out** for transitions, quick snappy feedback for input. Under **reduced motion**, parallax and particles are disabled, tweens are shortened, and cross-fades replace movement — the game stays fully playable and still feels intentional.

---

## 17. Accessibility Summary

Accessibility is a pillar (P5), not a checkbox. Highlights:

- **Full keyboard play:** arrows / WASD to launch; `U` undo, `R` restart, `H` hint, `Esc` pause, `Enter` confirm. **Focus-visible everywhere.**
- **Reduced motion:** respects `prefers-reduced-motion` plus an in-game toggle; disables parallax/particles, shortens tweens, uses cross-fades.
- **Colorblind-safe:** never rely on color alone — arrows carry shape, gates carry icons, colors are reinforced by pattern/symbol. Selectable palettes (deuteranopia / protanopia / tritanopia / high-contrast).
- **Scalable UI:** minimum **44 px** touch targets; ARIA roles and labels on DOM UI; **live-region announcements** for state ("reached exit", "invalid move").
- **Low-vision aids:** optional **grid coordinates** and a **screen-reader board description**; high-contrast focus rings.
- **No audio-only essentials:** every audio cue has a visual equivalent.

---

## 18. Game Modes

| Mode | What it is | Notes |
|------|-----------|-------|
| **Campaign** | The curated journey: Tutorial + five worlds, 100+ levels, stars-gated unlocks. | The main experience; where mechanics are taught in sequence. |
| **Daily** | One puzzle per day from a **shared seed** (same for everyone that date). | Seed + result cached by date; scaffolded for future leaderboards. |
| **Endless** | An infinite stream of freshly generated, guaranteed-solvable boards. | Powered by the seeded generator; difficulty can scale as you go. |
| **Editor** | Build your own levels, then play, save, export, and share them. | Custom levels persist locally and import/export via compact **share codes** (versioned, checksummed base64url). |

All generated content (Daily, Endless, and generator-assisted Editor validation) is **guaranteed solvable by the solver**, **prefers unique solutions**, **rejects trivial/degenerate boards**, and **dedupes layouts via a canonical hash** to avoid repetition.

---

## 19. Glossary

| Term | Definition |
|------|-----------|
| **Token** | The single chip the player launches and routes. |
| **Tile / Cell** | One grid square, addressed `(col x, row y)` from the top-left origin. |
| **Launch** | A single directional input that starts a slide. |
| **Slide** | The tile-by-tile motion of the token after a launch, until it reaches a rest state or fails. |
| **Move** | One launch from a rest state to the next rest state (or a fail). The scoring unit. |
| **Rest state** | A stable position where the token has stopped (against a wall, stop pad, or edge). |
| **Flow** | The signature slide-and-redirect resolution model (§4). |
| **Arrow** | A tile that sets the token's direction on entry. |
| **Mirror** | A `/` or `\\` tile that reflects the token's direction 90°. |
| **Reverse arrow** | A tile that flips the token's direction 180°. |
| **Wall / Stop pad** | Impassable tile / tile that halts the token, creating a rest state. |
| **Exit** | The win tile. A **fake exit** looks like one but rejects the token. |
| **Void** | An open edge or hole; entering it is a soft fail (falling). |
| **Portal** | Paired teleporter; entering one exits the other with direction preserved. |
| **Conveyor** | A tile that nudges the resting token one extra tile in its direction. |
| **Ice** | A frictionless tile that makes the token skid past the next redirect tile. |
| **Collectible / Gem** | Optional pickup; all gems are required for 3 stars. |
| **Par** | Solver-optimal move count plus a small slack; the 2-star threshold. |
| **Optimal** | The solver's minimum move count; the 3-star move requirement. |
| **Star** | 0–3 rating per level (complete / within par / optimal + all gems). |
| **Solver** | The BFS/A\* system that finds optimal paths, validates solvability, and backs hints. |
| **Generator** | The seeded system that produces solvable, deduped, non-trivial boards for Endless/Daily. |
| **Soft fail** | A non-punitive loss (void/hazard) that prompts an automatic Undo instead of a game-over. |
| **Cycle** | A slide that would revisit a `(pos, dir)` pair; such a move is illegal/ignored. |
| **Rest-state graph** | The abstract graph the solver searches: nodes are rest states, edges are legal launches. |
| **Theme** | A cosmetic palette-token swap; gameplay-neutral and save-safe. |

---

*Arrow Escape is an open-source project, MIT-licensed. Contributions to levels, mechanics, accessibility, and documentation are welcome — start with the Design Brief and the Level Format spec, and keep every change consistent with the pillars above.*
