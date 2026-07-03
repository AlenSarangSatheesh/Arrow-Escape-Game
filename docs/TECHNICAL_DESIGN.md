# Arrow Escape — Technical Design Document (TDD)

> Companion documents: [`GAME_DESIGN.md`](./GAME_DESIGN.md), [`UX_SPECIFICATION.md`](./UX_SPECIFICATION.md), [`ART_DIRECTION.md`](./ART_DIRECTION.md), [`LEVEL_FORMAT.md`](./LEVEL_FORMAT.md).
>
> This document describes **how Arrow Escape is built**. It is the reference for anyone contributing engine, AI, rendering, or platform code. It formalizes the design brief into concrete data models, algorithms, module boundaries, and budgets. Where the brief is authoritative on *what* the game does, this document is authoritative on *how the code is structured*.

---

## Table of contents

1. [Goals & constraints](#1-goals--constraints)
2. [Folder structure](#2-folder-structure)
3. [Layered architecture](#3-layered-architecture)
4. [Module & class diagram](#4-module--class-diagram)
5. [The `GameState` data model](#5-the-gamestate-data-model)
6. [The deterministic slide `Simulation`](#6-the-deterministic-slide-simulation)
7. [State management & the `EventBus` intent flow](#7-state-management--the-eventbus-intent-flow)
8. [Rendering pipeline](#8-rendering-pipeline)
9. [Input handling](#9-input-handling)
10. [Save system](#10-save-system)
11. [Level system & `LevelRepository`](#11-level-system--levelrepository)
12. [Editor system](#12-editor-system)
13. [AI: Generator, Solver & Difficulty Estimator](#13-ai-generator-solver--difficulty-estimator)
14. [Performance strategy & budgets](#14-performance-strategy--budgets)
15. [Testing approach](#15-testing-approach)
16. [Future expansion & seams](#16-future-expansion--seams)

---

## 1. Goals & constraints

Arrow Escape is a slide-and-redirect grid puzzle. The player launches a token that slides until it hits something; arrows and mirrors redirect it. The objective is to route the token to the Exit in the fewest launches. Everything technical follows from one property: **given a state and a launch direction, the resulting rest-state is deterministic**. Determinism is what makes exact solving, hinting, difficulty scoring, generation, and replay tractable.

### 1.1 Hard constraints

| Constraint | Rationale | Consequence for the codebase |
| --- | --- | --- |
| **Vanilla ES6 modules, no framework** | Longevity, zero dependency churn, trivial onboarding. | Native `import`/`export` only. No React/Vue/Svelte. No global state. |
| **No build step required to run** | `git clone` → open `index.html` → it works. | No transpiler, bundler, or JSX. Code ships as authored. Optional tooling (a minifier for release) must never be *required*. |
| **Canvas 2D board + DOM/CSS UI** | Canvas for the high-frequency board render; DOM for accessible, styleable menus/HUD. | Two distinct render surfaces with a clean boundary. The board never lives in the DOM; the HUD never lives on the canvas. |
| **Offline-capable PWA** | Instant load, install-to-home-screen, works on a plane. | `service-worker.js` precaches the critical path; `manifest.webmanifest` describes the app. Critical path **< 100 KB**. |
| **Pure, zero-DOM engine & AI** | Testability, portability, determinism, future headless use (server-side daily validation, multiplayer authority). | `src/engine/**` and `src/ai/**` import nothing from `render/`, `input/`, `audio/`, `ui/`, `data/`, or any browser global (`window`, `document`, `localStorage`, `performance`, `Date`). |

### 1.2 Design principles (from the brief, made concrete)

- **No global mutable state.** Dependencies are injected through constructors. The only cross-cutting singleton-like object is a per-app `EventBus`, itself passed in, never reached for globally.
- **Single responsibility.** Each module does one thing. A file that both simulates and renders is a bug.
- **UI never mutates the engine directly.** The UI dispatches *intents* to `GameController`; the controller owns the transition. This is enforced by the dependency rule in §3.
- **Determinism is sacred.** No `Math.random()` in `engine/` or `ai/` — all randomness flows through a seeded `RNG` from `core/`. No wall-clock reads in the sim. Timers used for scoring live outside the pure core.
- **Everything the solver needs, the game needs.** The same `Simulation.resolveLaunch` powers gameplay, hints, the solver, difficulty estimation, and replay. There is exactly one implementation of the rules.

### 1.3 Non-goals (for v1)

- No server, no accounts, no network calls at runtime (design *for* them — §16 — but do not build them).
- No native app shell; the PWA is the distribution.
- No binary asset pipeline; audio is synthesized (WebAudio), art is drawn/derived from tokens.

---

## 2. Folder structure

The repository is organized so that the dependency direction is legible from the tree alone: `core` is depended upon by everything; `engine` and `ai` are pure; the adapter folders (`render`, `input`, `audio`, `ui`, `data`) wrap the pure core.

```text
Arrow-Escape-Game/
├── index.html                     # Single entry document; loads styles + src/main.js (type=module)
├── manifest.webmanifest           # PWA manifest (name, icons, theme_color, display=standalone)
├── service-worker.js              # Offline precache + runtime cache strategy
├── package.json                   # Metadata + scripts (test, optional release minify); no runtime deps
├── README.md                      # Project overview, quick start, screenshots
├── LICENSE                        # MIT
├── CONTRIBUTING.md                # How to build a level, run tests, submit a PR
├── CODE_OF_CONDUCT.md
├── CHANGELOG.md                   # Keep-a-Changelog format
├── SECURITY.md                    # Reporting process (note: no runtime network surface)
├── .gitignore
├── .editorconfig
├── .github/
│   ├── workflows/ci.yml           # Runs tests/ (node --test) on push/PR
│   ├── ISSUE_TEMPLATE/*
│   └── PULL_REQUEST_TEMPLATE.md
├── docs/
│   ├── GAME_DESIGN.md
│   ├── TECHNICAL_DESIGN.md        # ← this file
│   ├── UX_SPECIFICATION.md
│   ├── ART_DIRECTION.md
│   └── LEVEL_FORMAT.md
├── src/
│   ├── core/                      # Math, data structures, utilities. Depends on nothing.
│   │   ├── Constants.js           # Enums: Dir, TileType, EntityType, EventName, keys, tiers
│   │   ├── EventBus.js            # Tiny pub/sub (on/off/once/emit)
│   │   ├── Grid.js                # 2D typed-array grid, index<->(x,y), bounds, neighbors
│   │   ├── Vec.js                 # Integer vector ops (add, eq, dir->delta, rotate, reflect)
│   │   ├── RNG.js                 # Seeded PRNG (mulberry32/xorshift); deterministic streams
│   │   └── utils.js               # clamp, debounce, deepFreeze, assert, hashing helpers
│   ├── engine/                    # PURE. Zero DOM, zero browser globals.
│   │   ├── GameState.js           # Immutable-by-convention state; clone/apply
│   │   ├── Simulation.js          # resolveLaunch(state, dir) -> outcome (THE rules engine)
│   │   ├── Tiles.js               # Per-tile-type behavior table (redirect/stop/hazard/exit)
│   │   ├── Entities.js            # Portals, switches, keys, gems, lasers, conveyors...
│   │   └── Rules.js               # Win/lose predicates, legality, star computation inputs
│   ├── ai/                        # PURE. Depends on core + engine only.
│   │   ├── Solver.js              # BFS/A* over rest-states -> optimal move sequence
│   │   ├── DifficultyEstimator.js # Weighted score -> difficulty bucket
│   │   └── Generator.js           # Seeded, solver-validated level synthesis
│   ├── game/                      # Session orchestration. Depends on core/engine/ai.
│   │   ├── GameController.js      # Owns current GameState; applies intents; emits events
│   │   ├── MoveHistory.js         # Undo/redo stack (structural sharing)
│   │   ├── Scoring.js             # Pure score computation (leaderboard-ready)
│   │   └── Hints.js              # Solver-backed next-move + full-solution ghost
│   ├── render/                    # Adapter: draws state to canvas. Reads, never mutates.
│   │   ├── Renderer.js            # Layered DPR-aware canvas pipeline
│   │   ├── Camera.js              # Pan/zoom, fit-to-view, world<->screen transforms
│   │   ├── ParticleSystem.js      # Pooled particles
│   │   ├── Animator.js            # Tween/spring timelines, interpolation state
│   │   └── palettes.js            # Theme -> resolved color tables for canvas
│   ├── input/                     # Adapter: raw events -> semantic intents.
│   │   ├── InputManager.js        # Keyboard/mouse/touch -> intent objects on EventBus
│   │   └── Gestures.js            # Swipe/tap detection, thresholds
│   ├── audio/
│   │   └── AudioManager.js        # WebAudio synthesized SFX + generative pad
│   ├── ui/                        # Adapter: DOM screens/HUD. Dispatches intents only.
│   │   ├── ScreenManager.js       # Screen stack, transitions, reduced-motion aware
│   │   ├── screens/*              # MainMenu, LevelSelect, Gameplay, Pause, Settings, ...
│   │   ├── components/*           # HUD, StarMeter, Toast, Modal, Toggle, Slider, ...
│   │   └── editor/*               # Editor UI panels (palette, inspector, validation)
│   ├── data/                      # Adapter: persistence & catalogs.
│   │   ├── SaveManager.js         # localStorage arrowEscape.v1.* + migration
│   │   ├── Settings.js            # Typed settings model + defaults
│   │   ├── Statistics.js          # Aggregate counters
│   │   ├── Achievements.js        # Unlock evaluation against events
│   │   └── LevelRepository.js     # Unified access to built-in + custom + daily levels
│   ├── levels/
│   │   ├── packs/*                # Human-authored Level[] JS modules (readable)
│   │   └── LevelCodec.js          # base64url share codes (version + checksum)
│   ├── config/
│   │   ├── achievements.js        # Declarative achievement definitions
│   │   ├── mechanics.js           # Mechanic metadata (id, world, teaches, icon)
│   │   └── themes.js              # Theme token sets (Aurora/Sunset/Mono/Forest/Neon)
│   └── main.js                    # Composition root: wires everything, injects deps
├── styles/
│   ├── tokens.css                 # CSS custom properties (color/space/type/motion tokens)
│   ├── base.css                   # Reset, base typography, focus rings
│   ├── screens.css                # Per-screen layout
│   ├── components.css             # HUD, buttons, modals, toggles
│   └── animations.css             # Keyframes; gated by prefers-reduced-motion
└── tests/
    ├── simulation.test.mjs        # Rules/determinism/cycle/portal/mirror coverage
    ├── solver.test.mjs            # Optimality + feasibility coverage
    └── run.mjs                    # Zero-dependency test runner
```

---

## 3. Layered architecture

The system is a set of concentric layers. Inner layers know nothing about outer layers. The **pure core** (`core` + `engine` + `ai`) can run headless in Node with no DOM. The **adapters** (`render`, `input`, `audio`, `ui`, `data`) translate between the outside world and the pure core, and are the *only* code allowed to touch browser globals.

```text
                         OUTSIDE WORLD (browser, DOM, WebAudio, localStorage)
        ┌──────────────────────────────────────────────────────────────────────┐
        │  ADAPTERS  (may touch window/document/localStorage/Audio/performance)  │
        │                                                                        │
        │   input/  ──intents──▶   ui/   ◀──renders/reads──  render/            │
        │      │                    │                            ▲               │
        │      │                    │ (dispatch intents)         │ (read state)  │
        │      ▼                    ▼                            │               │
        │   audio/            ┌───────────────────────┐          │               │
        │      ▲              │        game/          │──────────┘               │
        │      └──events──────│   (GameController)    │                          │
        │   data/  ◀─persist──└───────────┬───────────┘                          │
        └──────────────────────────────────┼─────────────────────────────────────┘
                                            │  uses (never the reverse)
                                            ▼
        ┌──────────────────────────────────────────────────────────────────────┐
        │  PURE CORE  (no DOM, no browser globals, deterministic)                │
        │                                                                        │
        │        ai/  (Solver, Generator, DifficultyEstimator)                   │
        │          │  uses                                                       │
        │          ▼                                                             │
        │        engine/  (GameState, Simulation, Tiles, Entities, Rules)        │
        │          │  uses                                                       │
        │          ▼                                                             │
        │        core/  (Constants, EventBus, Grid, Vec, RNG, utils)             │
        └──────────────────────────────────────────────────────────────────────┘
```

### 3.1 Dependency rule (enforced, not aspirational)

The allowed import directions are:

| Layer | May import from | Must **never** import from |
| --- | --- | --- |
| `core` | (nothing) | anything else |
| `engine` | `core` | `ai`, `game`, any adapter, browser globals |
| `ai` | `core`, `engine` | `game`, any adapter, browser globals |
| `game` | `core`, `engine`, `ai` | `render`, `input`, `audio`, `ui`, DOM |
| `render` | `core`, `engine`, `game` (read-only) | `input`, `ui`, `data`, and must not mutate state |
| `input` | `core`, `game` (intents via EventBus) | `render`, `engine` internals |
| `audio` | `core` | `engine` internals |
| `ui` | `core`, `game` (intents), `data` (view models) | **`engine` — never mutates it directly** |
| `data` | `core`, `engine` types (for serialization) | `ui`, `render` |
| `levels` | `core`, `engine` types | adapters |
| `config` | `core` | everything else |

**The load-bearing invariant:** *UI never mutates the engine directly.* A screen cannot call `state.token.x = 3` or `Simulation.resolveLaunch(...)` and keep the result. It emits an intent (`EventName.INTENT_LAUNCH`, `INTENT_UNDO`, `INTENT_RESTART`, `INTENT_HINT`) onto the `EventBus`; `GameController` is the sole owner of the current `GameState` and the sole caller of `Simulation`. The controller then emits *result* events (`STATE_CHANGED`, `MOVE_RESOLVED`, `LEVEL_COMPLETE`, `SOFT_FAIL`) that `render`, `audio`, `ui`, and `data` react to. This makes the game a unidirectional data flow:

```text
   input ─▶ INTENT_* ─▶ EventBus ─▶ GameController ─▶ Simulation (pure)
                                          │
                                          ├─▶ MoveHistory.push(prevState)
                                          ├─▶ new GameState
                                          └─▶ emit STATE_CHANGED / MOVE_RESOLVED / LEVEL_COMPLETE / SOFT_FAIL
                                                        │
                       ┌────────────────────────────────┼───────────────────────────┐
                       ▼                                 ▼                           ▼
                    render/ (draw)                   audio/ (sfx)               data/ (persist)
                                                                                     │
                                                                                  ui/ (HUD update)
```

Because the sim is pure, the same `GameController.tryLaunch` path that a human triggers is exactly what `Solver` and `Generator` exercise in isolation. There is no "gameplay rules" and "solver rules" divergence — there is one `Simulation`.

---

## 4. Module & class diagram

```text
core/
  Constants        Dir{U,D,L,R}  TileType{...}  EntityType{...}  EventName{...}  StorageKey{...}  Tier{...}
  EventBus         on(evt,fn) off(evt,fn) once(evt,fn) emit(evt,payload)
  Grid             (w,h,cells:TypedArray)  idx(x,y) get(x,y) set(x,y,v) inBounds(x,y) forEach()
  Vec              add() eq() DELTA[dir] rotateCW(dir) reflect(dir, mirror)
  RNG              (seed)  next() nextInt(n) fork(label) -> RNG
  utils            clamp() debounce() deepFreeze() assert() fnv1a(str)

engine/  (pure)
  Tiles            behavior(tileType): { onEnter(sim, ctx) -> Action }   // table-driven
  Entities         resolvePortal(state,pos) switchTargets(state,id) laserCells(state) ...
  GameState        { level, grid, token:{x,y}, dir, carrying, collected:Set,
                     switches:Map, moveCount, status }  clone() withToken() withStatus()
  Rules            isWin(state) isSoftFail(outcome) legalDirs(state) starInputs(state,history)
  Simulation       resolveLaunch(state, dir) -> Outcome
                   Outcome = { nextState, path:[{x,y,dir}], result:'REST'|'EXIT'|'FALL'|'HAZARD'|'ILLEGAL', events:[] }

ai/  (pure)
  Solver               solve(state) -> { solvable, optimalMoves, path:[dir], nodesExpanded }
  DifficultyEstimator  estimate(level, solveResult) -> { score, tier }
  Generator            generate(params) -> Level     // seeded; solver-validated; canonical-dedup

game/
  GameController   (deps: {eventBus, simulation, solver})
                   load(level)  tryLaunch(dir)  undo()  restart()  requestHint()
                   holds: current GameState, MoveHistory, attempt meta
  MoveHistory      push(state) undo() -> state  canUndo()  clear()
  Scoring          score({moves, optimal, time, gems, hintsUsed}) -> { total, stars, breakdown }
  Hints            next(state) -> dir            fullSolution(state) -> [dir]

render/                                   input/               audio/
  Renderer (static+dynamic layers)          InputManager         AudioManager
  Camera   (fit/pan/zoom)                    Gestures            (WebAudio synth)
  ParticleSystem (pooled)
  Animator (springs/tweens)
  palettes (theme -> colors)

ui/                                        data/                          levels/
  ScreenManager                              SaveManager                    packs/*  (Level[])
  screens/*                                  Settings                       LevelCodec
  components/*                               Statistics
  editor/*                                   Achievements
                                             LevelRepository

config/  achievements  mechanics  themes            main.js  (composition root)
```

Ownership summary:

- **`GameController`** is the only object that holds and swaps the live `GameState`.
- **`Simulation`** is the only object that computes transitions.
- **`SaveManager`** is the only object that touches `localStorage`.
- **`Renderer`** is the only object that touches the canvas 2D context.
- **`AudioManager`** is the only object that touches WebAudio.
- **`ScreenManager`** is the only object that mounts/unmounts DOM screens.

---

## 5. The `GameState` data model

`GameState` is a plain, serializable, immutable-*by-convention* object. The engine never mutates a `GameState` in place; it produces a new one via `clone()` + targeted `with*` helpers. Immutability is what makes undo (§7) and the solver's frontier (§13) cheap and correct.

### 5.1 Shape

```js
// engine/GameState.js  (illustrative shape; no DOM, no methods that touch the outside world)
GameState = {
  level:      LevelRef,          // { id, width, height, par, optimalMoves, mechanics, hintsAllowed }
  grid:       Grid,              // core/Grid: width*height typed array of packed (tileType<<8 | param)
  token:      { x, y },          // integer cell coordinates, origin top-left
  dir:        Dir | null,        // resting token has no direction; set during a slide only
  carrying:   { color?: ColorId, keys: Set<ColorId> },   // color pickups + collected keys
  collected:  Set<EntityId>,     // gems already taken
  switches:   Map<SwitchId, bool>,   // pressure/toggle state (drives toggle walls/bridges/doors)
  moveCount:  int,               // number of launches resolved so far (drives phase = f(moveCount))
  status:     'PLAYING' | 'WON' | 'SOFT_FAIL',
}
```

### 5.2 Field semantics

| Field | Meaning | Who reads it | Who writes it |
| --- | --- | --- | --- |
| `grid` | Immutable board topology for the level. Tile type + param packed per cell. | `Simulation`, `Renderer`, `Solver` | Set at load; never mutated during play (dynamic tiles derive their state from `switches`/`moveCount`). |
| `token` | Current rest position. | everyone | `Simulation` (produces new coords) |
| `dir` | Transient slide direction; `null` at rest. | `Simulation` (during a slide), `Renderer` (glint) | `Simulation` |
| `carrying` | Color the token holds + keys picked up. Gates check this. | `Simulation`, HUD | `Simulation` on pickup |
| `collected` | Gems taken this run (needed for 3-star). | `Rules`, `Scoring`, HUD | `Simulation` on pickup |
| `switches` | Boolean state of toggles/pressure switches. Toggle walls/bridges/timed doors read it. | `Tiles`, `Entities` | `Simulation` when a switch is entered |
| `moveCount` | Global step counter. Moving walls / timed doors compute `phase = f(moveCount)`. | `Tiles`, `Entities`, HUD (par) | `GameController` increments per resolved launch |
| `status` | Terminal flag for the current run. | `Rules`, `GameController` | `Simulation` sets `WON`/`SOFT_FAIL`; `GameController` resets on load/restart |

### 5.3 Determinism guarantees

- All coordinates and counters are integers. No floating point in the sim.
- Time-varying tiles are **pure functions of `moveCount` and `switches`**, both of which are inside `GameState`. There is no hidden clock. A given `GameState` fully determines every dynamic tile's phase, so `resolveLaunch(state, dir)` depends only on `state` and `dir`.
- `GameState` is JSON-serializable (Sets/Maps are encoded as arrays by the codec) so it can be snapshotted, transmitted, and replayed.

---

## 6. The deterministic slide `Simulation`

`Simulation.resolveLaunch(state, dir)` resolves **one launch**: it advances the token tile-by-tile from a rest-state until it reaches the next rest-state, the exit, a fall, a hazard, or is deemed illegal (an unavoidable cycle). It returns a fresh `Outcome` and **does not mutate the input state**.

### 6.1 Outcome contract

```js
Outcome = {
  nextState : GameState,          // new state (input state is untouched)
  path      : [{ x, y, dir }],    // every cell visited, in order — drives animation & ghost replay
  result    : 'REST' | 'EXIT' | 'FALL' | 'HAZARD' | 'ILLEGAL',
  events    : [ { type, ... } ],  // e.g. REDIRECT, MIRROR, PORTAL, GEM, KEY, STOP, LASER_HIT
}
```

- `REST` — token stopped on a valid tile (wall/edge/stop pad ahead). This is a normal move.
- `EXIT` — token entered the **real** exit; `nextState.status = 'WON'`.
- `FALL` — token entered a void / left an open edge; `nextState.status = 'SOFT_FAIL'`.
- `HAZARD` — token hit an active laser; `nextState.status = 'SOFT_FAIL'`.
- `ILLEGAL` — the slide would loop forever (cycle on `(pos,dir)`) with no rest reachable, **or** the very first step is blocked. The move is ignored; `nextState === state` semantics (no history push). Fake exits also resolve here as a "reject" — the token passes through/over them as floor and continues (they never terminate).

### 6.2 Per-tile resolution table

Each tile type maps to a behavior in `engine/Tiles.js`. Resolution processes the tile the token is *entering*.

| Tile | Effect on entering |
| --- | --- |
| `FLOOR` / `ICE` | Continue in current direction. (Ice additionally forbids a voluntary stop mid-lake — enforced by the "cannot rest here" flag in §6.3.) |
| `ARROW(dir)` | Set current direction to `dir`; continue. |
| `REVERSE` | Flip direction 180°; continue. |
| `MIRROR('/')` / `MIRROR('\\')` | Reflect current direction (`Vec.reflect`): `/` swaps R↔U and L↔D; `\\` swaps R↔D and L↔U. Continue. |
| `ROTATING_ARROW` | Redirect like `ARROW(current stored dir)`; queue a 90° CW rotation applied *on leaving* the tile. |
| `WALL` / `STOP_PAD` | The token cannot enter; it **rests on the previous cell**. `result = REST`. |
| `ONE_WAY(dir)` | Passable only when moving along `dir`; otherwise treated as `WALL` (rest on previous cell). |
| `PORTAL(id)` | Teleport to the paired portal's cell, **keep direction**, continue from there. |
| `EXIT(real)` | If `real`: `result = EXIT`. If fake: treat as `FLOOR` (reject) and continue. |
| `VOID` / open edge | `result = FALL`. |
| `GATE(locked, color)` | If locked and token lacks matching key/color: treat as `WALL`. Else pass (and, for keyed gates, consume as configured). |
| `CONVEYOR(dir)` | Does not affect the in-flight slide; applies a one-tile nudge **after** the token comes to rest on it (a follow-up micro-resolution, see §6.4). |
| `LASER` cell (active) | `result = HAZARD`. |
| `MAGNET`, `FUSE`, `CHARGE_ARROW` | Invented mechanics; behaviors defined in `Tiles`/`Entities` and resolved inline (charge arrow acts as floor until hit `N` times; magnet pulls one extra tile on adjacency; fuse tracks a deadline in `switches`/`moveCount`). |

### 6.3 Pseudocode — `resolveLaunch`

```text
function resolveLaunch(state, launchDir):
    # Guard: token must be at rest and the launch must have a first step.
    dir  ← launchDir
    pos  ← state.token
    working ← state.clone()          # never mutate the input
    path    ← []
    events  ← []
    visited ← empty Set              # keys of "(x,y,dir)" for cycle detection
    steps   ← 0

    loop:
        # --- Cycle / runaway detection -------------------------------------
        key ← encode(pos.x, pos.y, dir)
        if key in visited:
            return Outcome(nextState=state, path, result='ILLEGAL', events)   # unavoidable loop
        visited.add(key)
        steps ← steps + 1
        if steps > MAX_SLIDE_STEPS:                                           # hard safety valve
            return Outcome(nextState=state, path, result='ILLEGAL', events)

        # --- Look at the next cell in the current direction ----------------
        next ← pos + DELTA[dir]

        # (a) Off the board or explicit VOID -> fall
        if not grid.inBounds(next) OR tileAt(working, next) is VOID_or_open_edge:
            path.append({x:next.x, y:next.y, dir})
            return Outcome(nextState = working.withStatus('SOFT_FAIL'),
                           path, result='FALL', events=events+[{type:'FALL', at:next}])

        tile ← resolveDynamicTile(working, next)   # applies moveCount/switch phase → concrete tile

        # (b) Blocking tiles -> REST on current cell (do not enter `next`)
        if tile is WALL
           OR tile is STOP_PAD
           OR (tile is ONE_WAY(d) and d ≠ dir)
           OR (tile is GATE(locked) and not tokenCanPass(working, tile)):
            # Ice constraint: if the CURRENT cell forbids resting, this is an illegal stop.
            if cellForbidsRest(working, pos):
                return Outcome(nextState=state, path, result='ILLEGAL', events)
            working ← working.withToken(pos.x, pos.y).withDir(null)
            return Outcome(nextState=commitEntitySideEffects(working),
                           path, result='REST', events=events+[{type:'STOP', at:pos}])

        # (c) Hazard -> soft fail
        if tile is LASER and laserActive(working, next):
            path.append({x:next.x, y:next.y, dir})
            return Outcome(nextState = working.withStatus('SOFT_FAIL'),
                           path, result='HAZARD', events=events+[{type:'LASER_HIT', at:next}])

        # (d) Enter `next`: record, collect pickups, apply redirection
        pos ← next
        path.append({x:pos.x, y:pos.y, dir})
        collectPickups(working, pos, events)       # gems, keys, color; mutates `working` only

        switch tile.kind:
            case ARROW(d):        dir ← d
            case REVERSE:         dir ← opposite(dir)
            case MIRROR(m):       dir ← reflect(dir, m); events.append({type:'MIRROR'})
            case ROTATING_ARROW:  dir ← tile.storedDir
                                  working ← rotateArrowCW(working, pos)   # applied on leaving
                                  events.append({type:'REDIRECT'})
            case PORTAL(id):      pos ← pairedPortalCell(working, id)     # keep `dir`
                                  path.append({x:pos.x, y:pos.y, dir})
                                  events.append({type:'PORTAL', to:pos})
            case CHARGE_ARROW(n): if hits(pos) + 1 >= n: dir ← tile.storedDir
                                  working ← bumpCharge(working, pos)
            case MAGNET:          # handled as adjacency pull below
            case EXIT(real):
                if real:
                    return Outcome(nextState = working.withStatus('WON'),
                                   path, result='EXIT', events=events+[{type:'EXIT', at:pos}])
                # fake exit: treat as floor (reject) — do nothing, fall through to continue
            case FLOOR, ICE, FAKE_EXIT:  pass    # continue in current direction

        # (e) Optional magnet pull: if adjacent to a MAGNET, nudge one extra tile toward it
        applyMagnetAdjacency(working, pos, dir)   # may advance pos by one, keeping dir

    # end loop
```

Supporting notes:

- **`resolveDynamicTile(state, cell)`** collapses time-varying tiles to a concrete tile using only `state.moveCount` and `state.switches` — e.g. a moving wall's occupancy is `phase(moveCount) === WALL_PHASE`, a timed door is `open = (moveCount % period) < openWindow`. Purity holds because both inputs live in `GameState`.
- **Cycle detection** keys on `(x, y, dir)` because a token revisiting the same cell heading the same way is provably in an infinite loop (the board is static within a single launch). This is the brief's "safety valve" — the move is declared `ILLEGAL` and ignored, never hung. `MAX_SLIDE_STEPS` (e.g. `width*height*8`) is a belt-and-suspenders bound.
- **Portals keep direction** and re-enter the loop at the paired cell; two portals pointing into each other are prevented from becoming an infinite loop by the same `(pos,dir)` cycle set.
- **Side effects are staged on `working`**, never on the input `state`. On `ILLEGAL`, `working` is discarded and the *original* `state` is returned — the move never happened.
- **`commitEntitySideEffects`** finalizes rest-time effects (e.g. arming a conveyor nudge, sealing a fuse). Pickups already applied to `working` are retained on a successful `REST`/`EXIT`.

### 6.4 Conveyor follow-up (post-rest nudge)

Per the brief, a conveyor "nudges one tile in `dir` while resting on it after stop." This is modeled as a **post-move micro-resolution** owned by `GameController`, not by `resolveLaunch`, so that it is animated as a distinct beat and remains undoable:

```text
after a REST outcome:
    if tokenCell is CONVEYOR(dir):
        follow ← resolveLaunch(outcome.nextState, dir)   # a fresh, deterministic launch in `dir`
        chain outcome.path ++ follow.path                 # for animation
        outcome.nextState ← follow.nextState
        (repeat while the new rest cell is a conveyor and a fixed-point isn't reached;
         guarded by the same cycle set so conveyor loops are ILLEGAL, not infinite)
```

Because a conveyor nudge is itself a deterministic `resolveLaunch`, the solver treats "rest on conveyor" states correctly with no special case: the successor of a launch already includes any forced conveyor motion.

### 6.5 Why `Outcome.path` matters

`path` is the single source for three consumers:

1. **`Animator`** tweens the token along `path` at slide speed, firing particle bursts on `MIRROR`/`REDIRECT`/`PORTAL` events.
2. **`Hints`/`Replay`** renders a ghost token along `path` for "show solution".
3. **`Solver`** ignores `path` (it only needs `nextState`), keeping search fast; the visualization is a free by-product.

---

## 7. State management & the `EventBus` intent flow

### 7.1 Ownership

`GameController` owns the mutable *reference* to the current `GameState` (the state objects themselves are immutable). Nothing else swaps it. The controller exposes intent methods and emits result events; it never touches the DOM, canvas, or storage.

```js
// game/GameController.js  (illustrative)
class GameController {
  constructor({ eventBus, simulation, solver }) { /* injected deps only */ }

  load(level)      { this._state = GameState.fromLevel(level); this._history.clear();
                     this._emit(EventName.STATE_CHANGED, this._view()); }

  tryLaunch(dir) {
    if (this._state.status !== 'PLAYING') return;
    const outcome = this._simulation.resolveLaunch(this._state, dir);
    if (outcome.result === 'ILLEGAL') {
      this._emit(EventName.MOVE_REJECTED, { dir });   // e.g. shake + a11y "invalid move"
      return;
    }
    this._history.push(this._state);                  // snapshot BEFORE applying
    this._state = { ...outcome.nextState, moveCount: this._state.moveCount + 1 };
    this._emit(EventName.MOVE_RESOLVED, { outcome, view: this._view() });
    if (outcome.result === 'EXIT')  this._emit(EventName.LEVEL_COMPLETE, this._completion());
    if (outcome.result === 'FALL' || outcome.result === 'HAZARD')
                                    this._emit(EventName.SOFT_FAIL, { outcome });
  }

  undo()        { if (!this._history.canUndo()) return;
                  this._state = this._history.undo();
                  this._emit(EventName.STATE_CHANGED, this._view()); }

  restart()     { this._state = this._history.baseState(); this._history.clear();
                  this._emit(EventName.STATE_CHANGED, this._view()); }

  requestHint() { const dir = this._hints.next(this._state);
                  this._emit(EventName.HINT_READY, { dir }); }   // caps stars per Rules
}
```

### 7.2 The intent flow

The `EventBus` (`core/EventBus.js`) is a minimal typed pub/sub:

```js
class EventBus {
  on(name, fn)   { /* subscribe */ return () => this.off(name, fn); }
  once(name, fn) { /* one-shot */ }
  off(name, fn)  { /* unsubscribe */ }
  emit(name, payload) { /* synchronous dispatch to subscribers */ }
}
```

Two channels, one direction each:

| Direction | Prefix | Emitter | Consumer |
| --- | --- | --- | --- |
| **Intents** (requests) | `INTENT_*` | `input/`, `ui/` | `game/GameController` |
| **Facts** (results) | past-tense events | `game/GameController` | `render/`, `audio/`, `ui/`, `data/` |

Canonical event names (`core/Constants.js → EventName`):

```text
INTENT_LAUNCH   { dir }          INTENT_UNDO           INTENT_RESTART
INTENT_HINT                      INTENT_PAUSE          INTENT_SET_SETTING { key, value }
INTENT_LOAD_LEVEL { levelId }

STATE_CHANGED   { view }         MOVE_RESOLVED { outcome, view }   MOVE_REJECTED { dir }
LEVEL_COMPLETE  { stars, score, moves, time }
SOFT_FAIL       { outcome }      HINT_READY { dir }
SETTINGS_CHANGED { settings }    ACHIEVEMENT_UNLOCKED { id }
```

This is why **UI never mutates the engine**: a button's click handler calls `eventBus.emit(INTENT_UNDO)`, full stop. The controller decides whether undo is possible and emits `STATE_CHANGED`; the HUD re-renders from the resulting *view model* (a read-only projection of `GameState` — never the live state object).

### 7.3 Undo / restart / replay via `MoveHistory`

`MoveHistory` is a stack of immutable `GameState` snapshots. Because states are immutable and share structure (the `grid` reference is identical across snapshots; only `token`, `dir`, `collected`, `switches`, `moveCount`, `status` differ), snapshots are cheap — undo is *unlimited* as promised in the brief.

```text
history: [ S0(base), S1, S2, ... , Sn ]      ← push prev-state on each accepted launch
undo():   pop Sn, current ← Sn-1
restart(): current ← S0, clear stack (attempt count preserved by GameController)
replay(seq): fold resolveLaunch over S0 with the recorded [dir] sequence → reproduces the run
```

Replay stores only the **launch-direction sequence** (`[Dir]`), not states — the deterministic sim regenerates everything. This same sequence is the payload for share codes and the solver's "show solution".

---

## 8. Rendering pipeline

The renderer is a **read-only** adapter. It never mutates `GameState`; it consumes the current state (via `MOVE_RESOLVED`/`STATE_CHANGED`) plus an `Animator` timeline and paints. Canvas 2D draws the board; DOM/CSS draws the HUD and menus.

### 8.1 DPR-aware canvas

```text
cssW, cssH   = layout size of the canvas element
dpr          = window.devicePixelRatio (clamped, e.g. min(dpr, 2) for perf)
canvas.width  = round(cssW * dpr)
canvas.height = round(cssH * dpr)
ctx.setTransform(dpr, 0, 0, dpr, 0, 0)      # draw in CSS pixels, render at device resolution
```

All tile sprites are pre-rendered once per (theme, tileSize, dpr) into offscreen canvases and blitted — never re-drawn vector-by-vector each frame.

### 8.2 Layered redraw

Two logical layers minimize per-frame work:

```text
┌──────────────────────────────────────────────┐
│ STATIC LAYER  (offscreen canvas)              │  Board topology: floor, walls, arrows,
│   • redrawn ONLY when level/theme/camera      │  mirrors, exits, static entities.
│     changes (rare)                            │  Cached; blitted each frame in one drawImage.
├──────────────────────────────────────────────┤
│ DYNAMIC LAYER (main canvas, on top)           │  Token, particles, dynamic tiles (timed
│   • redrawn every animating frame             │  doors/moving walls in transition), ghost,
│                                               │  hint flash, selection highlights.
└──────────────────────────────────────────────┘
```

When nothing is animating (token at rest, no particles), the loop is **idle**: it skips redraw entirely until the next intent or animation, saving battery.

### 8.3 RAF fixed-timestep loop with interpolation

Logic (animation stepping) runs on a **fixed timestep**; rendering interpolates between the last two logic states for smooth 60 fps regardless of display refresh.

```text
FIXED_DT = 1000/120         # logic ticks per second (animation/spring integration)
accumulator = 0
prevTime = performance.now()

function frame(now):
    dt = min(now - prevTime, MAX_FRAME_DT)   # clamp to avoid spiral-of-death after a stall
    prevTime = now
    accumulator += dt

    while accumulator >= FIXED_DT:
        animator.step(FIXED_DT)              # advance tweens/springs by a fixed slice
        accumulator -= FIXED_DT

    alpha = accumulator / FIXED_DT           # interpolation factor in [0,1)
    if renderer.isDirty() or animator.isActive():
        renderer.draw(state, animator, alpha)  # interpolate token position between ticks

    requestAnimationFrame(frame)
```

- **Interpolation** (`alpha`) blends the token's previous and current animated position so motion is smooth even when logic ticks and display refresh disagree.
- **Idle detection** (`isDirty || isActive`) means a static board costs ~0 draw calls.

### 8.4 Virtualized draw & camera

`Camera` (world↔screen transform) supports pan/zoom and **fit-to-view** (a level always fits the viewport by default). For large levels, only visible tiles are drawn:

```text
visibleRect = camera.worldViewport()                # in tile coords
for y in visibleRect.rows:
    for x in visibleRect.cols:
        drawTileSprite(x, y)                         # cached sprite blit; culls off-screen tiles
```

This keeps draw cost proportional to *screen* area, not *board* area — a 200×200 board renders as cheaply as a 12×12 one.

### 8.5 Particles & pooling

`ParticleSystem` maintains a fixed-capacity pool. Emitting a burst (redirect/win/stop) reuses dead particles; nothing allocates during the frame. Reduced-motion disables emission entirely.

```text
pool: Array<Particle>(CAP), each { active, x, y, vx, vy, life, ... }
emit(n, origin): grab up to n inactive particles, initialize in place
step(dt): integrate active particles; deactivate when life <= 0   # zero per-frame allocation
```

### 8.6 Reduced motion

When `prefers-reduced-motion` or the settings toggle is on: parallax and particles are off, tweens are shortened to cross-fades, and the loop still uses the same structure but with near-instant `Animator` durations. Motion tiers are the design's 150/250/400 ms; reduced-motion collapses these.

---

## 9. Input handling

`InputManager` and `Gestures` translate raw device events into semantic `INTENT_*` events on the `EventBus`. Input code **never** calls the controller's mutators directly and never reads `GameState` — it only produces intents. This keeps desktop, touch, and future input sources (gamepad, network) interchangeable.

### 9.1 Mapping

| Source | Event | Intent |
| --- | --- | --- |
| Keyboard | Arrow keys / WASD | `INTENT_LAUNCH { dir }` |
| Keyboard | `U` / `R` / `H` / `Esc` / `Enter` | `INTENT_UNDO` / `INTENT_RESTART` / `INTENT_HINT` / `INTENT_PAUSE` / confirm |
| Touch | Swipe (via `Gestures`) | `INTENT_LAUNCH { dir }` |
| Touch | On-screen D-pad button | `INTENT_LAUNCH { dir }` |
| Both | Tap on an adjacent board edge (optional) | `INTENT_LAUNCH { dir }` |
| Mobile | (feedback) | `AudioManager`/haptics react to result events, not input |

### 9.2 Gesture detection

`Gestures` resolves a swipe to a cardinal direction using distance and dominant-axis thresholds, with a dead-zone to reject taps:

```text
onPointerUp:
    dx = end.x - start.x;  dy = end.y - start.y
    if hypot(dx,dy) < SWIPE_MIN: return            # too short -> treat as tap
    dir = abs(dx) > abs(dy) ? (dx>0 ? R : L) : (dy>0 ? D : U)
    emit(INTENT_LAUNCH, { dir })
```

### 9.3 Accessibility hooks

Input honors full keyboard play, focus-visible, and 44 px minimum touch targets (the on-screen controls are DOM buttons in `ui/`, styled via `components.css`). State results are announced through an ARIA live region owned by `ui/`, driven by result events (e.g. `LEVEL_COMPLETE → "reached exit"`, `MOVE_REJECTED → "invalid move"`).

---

## 10. Save system

`data/SaveManager` is the **only** module that touches `localStorage`. It reads/writes namespaced, versioned keys, migrates old versions, debounces writes, and survives quota/private-mode failures.

### 10.1 Key schema

All keys are prefixed `arrowEscape.v1.`:

| Key | Contents |
| --- | --- |
| `arrowEscape.v1.settings` | audio vol, sfx, music, reducedMotion, colorblindPalette, haptics, theme, controls |
| `arrowEscape.v1.progress` | per-level `{ completed, bestMoves, bestTime, stars, attempts }`, keyed by `levelId` |
| `arrowEscape.v1.unlocks` | world/level unlock state (stars-gated) |
| `arrowEscape.v1.achievements` | unlocked set + progress counters |
| `arrowEscape.v1.statistics` | totals: moves, time, hintsUsed, levelsCompleted, perfectSolves, gems, streaks |
| `arrowEscape.v1.customLevels` | editor-made levels + imported share codes |
| `arrowEscape.v1.daily` | `{ [date]: { seed, result } }` cache |
| `arrowEscape.v1.meta` | `{ schemaVersion }` — drives migration |

### 10.2 Versioning & migration

The `v1` in the namespace is the **schema epoch**; within it, `meta.schemaVersion` (an integer) drives forward migrations. On boot, `SaveManager` runs a migration chain:

```text
load():
    meta = readRaw('arrowEscape.v1.meta') ?? { schemaVersion: 0 }
    while meta.schemaVersion < CURRENT_SCHEMA_VERSION:
        migrations[meta.schemaVersion](store)      # e.g. 0->1 backfills `streaks`
        meta.schemaVersion += 1
    writeRaw('arrowEscape.v1.meta', meta)
```

Each migration is a pure `(store) -> void` transform registered in an ordered table. A hard format break (incompatible with `v1`) bumps the namespace to `arrowEscape.v2.*` and migrates by reading the old namespace once.

### 10.3 Debounced, fault-tolerant writes

```text
write(key, value):
    cache[key] = value                 # in-memory truth is always current
    schedule flush(key) in DEBOUNCE_MS (e.g. 400ms), coalescing repeated writes

flush(key):
    try:
        localStorage.setItem(fullKey(key), JSON.stringify(cache[key]))
    catch QuotaExceededError:
        emit(STORAGE_FULL)             # UI surfaces a non-blocking notice
        attempt eviction of least-critical data (e.g. daily cache) and retry once
    catch SecurityError / private-mode:
        degrade to in-memory only      # game remains playable this session; warn once
```

- **In-memory cache is authoritative during a session**; `localStorage` is a durability backend. A failed flush never loses in-session state.
- **Debouncing** coalesces the many small writes a play session produces (progress ticks, stat increments) into few actual `setItem` calls.
- **Export/import**: `SaveManager.exportProfile()` serializes all keys to a single JSON blob; `importProfile(json)` validates and restores, enabling manual backup and (later) cloud sync.

---

## 11. Level system & `LevelRepository`

### 11.1 Level shape

A `Level` (see `LEVEL_FORMAT.md`) is a pure data object:

```js
Level = {
  id, name, world, index, author, version,
  width, height,
  tiles,                       // compact typed array OR RLE string encoding tileType+param per cell
  entities: [ { type, x, y, ...params } ],   // portal pairs, switches→targets, keys, gems, lasers
  start: { x, y },
  exits:     [ { x, y, real: true } ],
  fakeExits: [ { x, y } ],
  par, optimalMoves,           // optimalMoves filled by the solver
  tags, mechanics: [ ... ], difficulty,
  themeHint?, hintsAllowed
}
```

- **Human-authored packs** live in `src/levels/packs/*` as JS modules exporting `Level[]`, kept readable (arrays of literals, commented). No build step touches them.
- **`LevelCodec`** produces a compact base64url **share code** with a version byte and checksum for import/export/share, and validates on decode.

### 11.2 `LevelRepository`

`data/LevelRepository` is the single façade over *all* level sources. Screens ask it for levels; they never import packs directly. This is the seam that later admits daily/generated/marketplace levels without touching UI.

```js
class LevelRepository {
  constructor({ packs, saveManager, generator, codec }) { /* injected */ }

  worlds()                     // catalog metadata (for Level Select)
  getById(levelId)             // built-in or custom
  customLevels()               // from saveManager
  saveCustom(level)            // editor output → customLevels
  importCode(shareCode)        // codec.decode → validate → add to custom
  exportCode(level)            // codec.encode
  daily(dateString)            // seed = hash(dateString) → generator.generate(...)
  endless(seed)                // generator.generate(...) on demand
}
```

Every source returns the *same* `Level` shape, so `GameController.load` and `Renderer` are source-agnostic.

---

## 12. Editor system

The level editor lives in `ui/editor/*` (DOM UI) and produces plain `Level` objects validated against the pure engine before saving. It is an adapter — it dispatches intents and reads view models, never mutating `GameState` during play.

### 12.1 Structure

```text
ui/editor/
  EditorScreen        # hosts the canvas board + tool panels
  Palette             # pick tile/entity to place (arrows, mirrors, walls, exits, portals, ...)
  Inspector           # edit selected cell/entity params (arrow dir, portal pair id, gate color)
  Validator           # runs Solver + Rules checks; surfaces problems inline
  Toolbar             # resize board, set start/exit, test-play, export share code
```

### 12.2 Authoring flow

```text
place/erase tiles on the grid  ─▶  build an in-progress Level object
        │
        ▼
Validator.check(level):
    • start set? at least one REAL exit?          (structural)
    • Solver.solve(state).solvable === true?      (feasibility)
    • no unavoidable cycle from start?            (uses Simulation cycle detection)
    • fills level.optimalMoves, suggests par      (solver output)
    • DifficultyEstimator.estimate(...) → tier    (labeling)
        │
        ▼
Test-play in place (spins up a throwaway GameController over the draft)
        │
        ▼
LevelRepository.saveCustom(level)  /  exportCode(level)  →  arrowEscape.v1.customLevels
```

Because the editor validates through the **same** `Simulation`/`Solver` the game uses, an editor level that validates is guaranteed playable and solvable — no separate rules to drift out of sync.

---

## 13. AI: Generator, Solver & Difficulty Estimator

All three live in `src/ai/**`, are **pure**, and depend only on `core` + `engine`. They share the one `Simulation`.

### 13.1 Solver (BFS / A*)

The state graph is **rest-states**; edges are the four launches. Each launch has unit cost, so the shortest launch-count solution is a shortest path.

```text
solve(startState):
    if startState is a win: return { solvable:true, optimalMoves:0, path:[] }
    frontier ← queue([startState]);   cameFrom ← { hash(startState): null }
    while frontier not empty:
        s ← frontier.pop()                     # BFS: FIFO (optimal in unit-cost graph)
        for dir in [U,D,L,R]:
            out ← Simulation.resolveLaunch(s, dir)
            if out.result == 'ILLEGAL': continue
            ns ← out.nextState;  h ← hash(canonicalize(ns))
            if h in cameFrom: continue
            cameFrom[h] ← { prev: hash(s), dir }
            if out.result == 'EXIT':
                return { solvable:true, optimalMoves: depth, path: reconstruct(cameFrom, h) }
            if out.result in ('FALL','HAZARD'): continue    # dead branch (soft-fail state)
            frontier.push(ns)
    return { solvable:false }
```

- **BFS** guarantees the minimum launch count (`optimalMoves`) on small/medium boards.
- **A\*** is used for large boards with an **admissible heuristic**: `h = ceil(manhattan(token, nearestRealExit) / maxSlideLength)` — never overestimates the launches remaining, so A* stays optimal while expanding far fewer nodes.
- **State hashing** (`canonicalize`) folds `token`, `dir`(null at rest), `collected`, `carrying`, `switches`, and `moveCount`-derived dynamic phase into a stable key so equivalent states dedupe.

The solver backs **hints** (`Hints.next(state)` = first `dir` of the current optimal path) and **feasibility** for the editor and generator. Using a hint caps that attempt's stars per the rules module.

### 13.2 Difficulty Estimator

The estimator maps a level + its solve result to a numeric score, then to a tier bucket, exactly per the brief:

```text
score = w1 * optimalMoves
      + w2 * distinctMechanics
      + w3 * branchingFactor        # decision nodes / dead ends encountered during search
      + w4 * sqrt(boardArea)        # boardArea = width * height
      + w5 * (uniqueSolution ? 0 : penalty)
      + w6 * hazardCount
```

```text
estimate(level, solveResult):
    branchingFactor = solveResult.decisionNodes / max(1, solveResult.nodesExpanded)
    uniqueSolution  = countOptimalSolutions(level) == 1     # solver variant that counts optima
    score = w1*solveResult.optimalMoves
          + w2*distinct(level.mechanics)
          + w3*branchingFactor
          + w4*sqrt(level.width * level.height)
          + w5*(uniqueSolution ? 0 : PENALTY)
          + w6*hazardCount(level)
    tier = bucket(score)    # → { Tutorial, Easy, Medium, Hard, Expert, Master }
    return { score, tier }
```

Weights `w1..w6` and bucket thresholds live in `config/` so they can be tuned without code changes. The estimator both **labels** handcrafted levels and **feeds back** into the generator's accept/reject.

### 13.3 Generator

The generator is **seeded** (deterministic given a seed + params), **solver-validated**, prefers **unique** solutions, rejects **trivial/degenerate** boards, respects requested mechanics, and **dedupes** via a canonical hash so it never repeats a layout.

```text
generate({ seed, targetTier, mechanics, size }):
    rng ← RNG(seed)                                  # all randomness flows through here (pure)
    repeat up to MAX_ATTEMPTS:
        candidate ← layout(rng, size, mechanics)     # place walls/arrows/mirrors/entities
        state     ← GameState.fromLevel(candidate)
        # Reject unsolvable or unavoidably-cyclic boards
        result ← Solver.solve(state)
        if not result.solvable: continue
        # Reject trivial (too few moves) and degenerate (no redirection used)
        if result.optimalMoves < MIN_MOVES(targetTier): continue
        if not usesMechanics(result.path, mechanics): continue
        # Prefer unique solution
        if countOptimalSolutions(candidate) != 1: continue      # (relaxable per params)
        # Dedup against seen layouts
        h ← canonicalHash(candidate)
        if h in seenLayouts: continue
        # Difficulty must match the request
        { tier } ← DifficultyEstimator.estimate(candidate, result)
        if tier != targetTier: continue
        candidate.optimalMoves ← result.optimalMoves
        candidate.par          ← result.optimalMoves + SLACK(targetTier)
        seenLayouts.add(h)
        return candidate
    throw GenerationExhausted   # caller retries with a new seed / relaxed params
```

This powers **Endless** (`generate` on demand) and **Daily** (`seed = hash(dateString)`), both surfaced through `LevelRepository`. Determinism means the same daily seed yields the same puzzle for every player — the seam a future server-validated daily/leaderboard needs.

---

## 14. Performance strategy & budgets

### 14.1 Budgets

| Metric | Budget | How it's met |
| --- | --- | --- |
| Critical-path payload | **< 100 KB** (uncompressed JS/CSS on first paint) | No framework/build; lazy-load non-essential screens & packs via dynamic `import()`; synthesized audio (no binaries). |
| Steady-state frame rate | **60 fps** | Layered canvas, cached sprites, idle skip, pooled particles, fixed-timestep + interpolation. |
| Time to interactive | **Instant** (precached PWA) | Service worker precaches shell; first level loads from cache. |
| Per-frame allocations while animating | **~0** | Object pooling; reuse of vectors/particles; no closures in the hot loop. |
| Solver latency (hint) | Sub-frame on typical boards | BFS with hashing; A* on large boards; results cached per state. |
| Offline | **Full play** | `service-worker.js` precache; all logic client-side; no runtime network. |

### 14.2 Techniques (already referenced, consolidated)

- **Pre-rendered tile sprites** per (theme, size, dpr); board blitted from the static layer in one `drawImage`.
- **Dirty/idle loop**: no redraw when nothing animates.
- **Virtualized draw**: only visible tiles painted; cost ∝ screen area.
- **Camera fit-to-view** so large levels never over-draw.
- **Pooled particles**, no per-frame `new`.
- **Precomputed slide outcomes are not cached across launches** (state changes), but **solver results are memoized per canonical state** to make repeated hints free.
- **DPR clamp** (e.g. ≤ 2) caps backing-store size on very high-density displays.

### 14.3 Service worker strategy

```text
install:  precache [ index.html, styles/*.css, src/**/*.js (critical), manifest, icons ]
activate: purge old caches keyed by build hash
fetch:    cache-first for app shell + core JS/CSS;
          stale-while-revalidate for level packs;
          network-never-required (game is fully offline-capable)
```

---

## 15. Testing approach

Tests run under Node with a **zero-dependency** runner (`tests/run.mjs`) and the pure core — no browser, no DOM, no framework. CI (`.github/workflows/ci.yml`) runs them on every push/PR.

### 15.1 What is tested

The pure layers are the contract, so they carry the coverage:

- **`simulation.test.mjs`** — the rules engine:
  - determinism (`resolveLaunch(s, d)` is a pure function of `(s, d)`),
  - each tile behavior (arrow, reverse, mirror `/` and `\\`, one-way, gate, portal keeps-direction, conveyor nudge, hazard, exit vs. fake exit),
  - **cycle detection** returns `ILLEGAL` (never hangs),
  - **portal loops** and **conveyor loops** are `ILLEGAL`, not infinite,
  - `FALL`/`HAZARD` produce `SOFT_FAIL` and leave the input state untouched,
  - dynamic tiles are pure functions of `moveCount`/`switches`.
- **`solver.test.mjs`** — the search:
  - `solve` finds the known `optimalMoves` on fixture levels,
  - BFS and A* agree on optimal count,
  - unsolvable fixtures report `solvable:false`,
  - hint = first move of the optimal path.

### 15.2 The runner

```js
// tests/run.mjs  (illustrative)
const tests = [];
export function test(name, fn) { tests.push({ name, fn }); }
export function assert(cond, msg) { if (!cond) throw new Error(msg || 'assertion failed'); }
export function eq(a, b, msg) { assert(JSON.stringify(a) === JSON.stringify(b), msg); }

// import the .test.mjs files, then:
let pass = 0, fail = 0;
for (const t of tests) {
  try { await t.fn(); pass++; }
  catch (e) { fail++; console.error(`✗ ${t.name}\n   ${e.message}`); }
}
console.log(`${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
```

The `.test.mjs` files import fixtures (small handcrafted `Level` objects with known solutions) and assert against `Simulation`/`Solver`. Because these modules are pure and DOM-free, they import and run in Node exactly as they do in the browser.

---

## 16. Future expansion & seams

The brief lists features to **design for, not build now**. Each is unlocked by an existing seam — a pure boundary or adapter interface already present — so adding it is additive, not invasive.

| Future feature | Enabling seam (already present) | What "adding it" looks like |
| --- | --- | --- |
| **Online leaderboard** | Pure `Scoring` module (deterministic score from `{moves, optimal, time, gems, hintsUsed}`) + versioned save + `EventBus` `LEVEL_COMPLETE`. | A new `data/` adapter subscribes to `LEVEL_COMPLETE`, posts the pure score; server re-validates via the same deterministic sim. No gameplay code changes. |
| **Daily challenge** | Deterministic seeded `Generator` + `LevelRepository.daily(date)` + `arrowEscape.v1.daily` cache. | Wire a "Daily" entry screen to the existing repository method; identical seed → identical puzzle everywhere. |
| **Cloud save** | `SaveManager` export/import profile JSON + versioned schema + migration chain. | A cloud adapter behind the *same* `SaveManager` interface syncs the JSON blob; migration already handles version skew. |
| **Multiplayer race** | Deterministic `Simulation` + replay (launch-direction sequence) + `EventBus`. | Two clients share a seed/level, exchange `[dir]` sequences; each replays deterministically. Server can be authoritative by running the identical pure sim headless. |
| **Level marketplace** | `LevelCodec` share codes (versioned + checksum) + `LevelRepository.import/exportCode`. | A browse/publish adapter lists codes; import path already validates and adds to `customLevels`. |
| **PWA / install** | `manifest.webmanifest` + `service-worker.js` (present now). | Already shipping; extend precache lists as content grows. |
| **User accounts / seasonal events** | `EventBus` events + `config/themes.js` + daily/theme hooks. | Account adapter keys saves; seasonal events swap theme tokens and daily seeds — cosmetic/data only, gameplay untouched. |

The through-line: because the **core is pure and deterministic**, the **UI only dispatches intents**, **persistence is versioned behind one adapter**, and **levels flow through one repository**, every future feature attaches at an interface that already exists. Nothing above requires reopening `engine/` or changing the rules — the single `Simulation` remains the one source of truth for how the game behaves.

---

*This document formalizes the architecture described in the project design brief. When a discrepancy arises between this document and the game's runtime behavior, prefer fixing the discrepancy and updating this document in the same change so the two never drift.*
