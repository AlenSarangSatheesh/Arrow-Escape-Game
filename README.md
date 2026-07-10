# Arrows

A web clone of the mobile "arrow escape" puzzle. A grid is packed with woven, bent arrows; tap an
arrow to send it out of the board along the way its head points. Tap a blocked one and you lose a
life. Clear every arrow to advance.

Built from a reference screen recording (`Timeline 1.mp4`) with vanilla TypeScript + inline SVG,
bundled by Vite. No framework.

## Run

```bash
npm install
npm run dev        # http://localhost:5173
npm run test       # 2010 tests: 500 generated levels proven solvable
npm run build      # typecheck + production bundle to dist/
```

## How it works

- **Mechanic.** An arrow escapes only if every cell on the straight ray from its head to the board
  edge is empty. On escape the head runs straight out and the body follows its route like a train,
  so a bent arrow straightens as it leaves. A blocked tap lunges toward the blocker, snaps back, and
  leaves the arrow marked red (cosmetic memory — it stays tappable). Three lives; the third loss
  restarts the level. Levels 1–3 are a penalty-free tutorial.

- **Levels are procedural and seeded.** Level *N* is deterministic (`mulberry32(hash(N))`) and always
  solvable without losing a life. They are built by *reverse construction*: arrows are inserted in the
  reverse of their removal order, each requiring its escape ray clear at insert time — which proves
  the forward order `1..n` is a valid, life-free solution. See `src/core/generator.ts`.

- **The escape animation** is an SVG `stroke-dashoffset` slide along an extended path
  (`src/render/escape.ts`) — the body-length window of visible stroke moves along the body polyline
  and off a straight extension past the edge, which produces the straightening for free.

## Layout

```
src/core/     types, seeded rng, board rules (ray/isBlocked), generator, geometry
src/render/   SVG board view, escape + lunge animations, confetti
src/game/     pure game state, controller, localStorage progress
src/ui/       hud (hearts), intro/level-select screens, rolling level counter
tests/        board rules + generator solvability property tests
```

Dev note: set `window.__ARROWS_SLOWMO = 20` in the console to slow the escape animation for
inspection.
