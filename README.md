<div align="center">

# Arrows

**A grid packed with woven arrows. Tap one and it slides out — if its path is clear.**

[How to play](#how-to-play) · [Getting started](#getting-started) · [How it works](#how-it-works) · [Project layout](#project-layout)

![Vanilla TypeScript](https://img.shields.io/badge/vanilla-TypeScript-3178c6)
![No framework](https://img.shields.io/badge/dependencies-zero%20runtime-brightgreen)
![Tests](https://img.shields.io/badge/tests-2010%20passing-success)
![Bundle](https://img.shields.io/badge/bundle-6.9%20kB%20gzipped-blue)

</div>

---

## What is Arrows?

Arrows is a tap-only logic puzzle built on one idea: **the arrow leaves, not you.**

Every arrow is a snake of grid cells with an arrowhead at one end. Tap it and it escapes the board in
the direction its head points — but only if every cell on the straight ray from its head to the edge
is empty. The arrows are woven tightly together, so almost nothing can leave until something else
does. The puzzle is finding the order.

The satisfying part is the motion: when an arrow escapes, its **head runs straight out while its body
follows the head's route like a train** — so a bent, coiled arrow *straightens itself out* as it
leaves the board.

## How to play

- **Tap an arrow** to send it out along the way its head points.
- An arrow can only leave if the straight path from its head to the board edge is **completely clear**
  — including its own body, which can curl around in front of its own head.
- **Tap a blocked arrow** and it lunges at whatever is in its way, flashes red, and snaps back. That
  costs a life.
- You get **3 lives**. Lose the third and the level restarts.
- Clear every arrow to advance. Levels 1–3 are a penalty-free tutorial.

Cells an arrow vacates are marked with faint dots, so the board's shape reveals itself as it empties.

## Getting started

```bash
npm install
npm run dev      # http://localhost:5173
npm run test     # 2010 tests
npm run build    # typecheck + static bundle to dist/
```

The build is a folder of static files — host it anywhere.

## How it works

### The rule

An arrow is a self-avoiding path of cells `[tail … head]`. Its escape ray is the straight line of
cells from `head + dir` out past the board edge. It may leave **iff every cell on that ray is empty.**

That single check is enough, and it's worth seeing why the "train" motion needs no extra collision
test: as the arrow escapes, its body only ever traverses cells the head has already passed through,
or cells the arrow itself already occupied. Both are provably free at the moment the body reaches
them. **The head's ray is the only thing to check.**

### Levels are procedural, seeded, and provably solvable

Level *N* is generated deterministically from `mulberry32(hash(N))` — the same level every time — and
is **always solvable without losing a life.**

That guarantee comes from building each board by **reverse construction**: arrows are inserted in the
*reverse* of their intended removal order. `Aₙ` goes into an empty grid; `A₁` goes in last, against a
nearly-full one. Each arrow is only placed where its escape ray is clear of everything already on the
board.

> **Why it's solvable.** At removal step *i* the board holds exactly `Aᵢ … Aₙ`. Arrow `Aᵢ`'s ray was
> required clear of `Aᵢ₊₁ … Aₙ` when it was inserted, and `A₁ … Aᵢ₋₁` are already gone. So the order
> `1, 2, …, n` is always a valid, life-free solution. ∎

The difficulty comes for free: an arrow inserted *later* (removed *earlier*) may land squarely on the
ray of one inserted earlier, blocking it. Dense packing produces exactly the ordering constraints the
puzzle needs, while `A₁` — inserted last against a full board — is always a legal opening move.

Boards grow from 4×5 up to 11×14, packing to ~90% of the grid, with snakes getting longer and more
twisted as the level number climbs. See [`src/core/generator.ts`](src/core/generator.ts).

### The escape animation

The straightening motion is not simulated — it falls out of SVG almost for free.

Each arrow's path is drawn as its body polyline **extended by a straight run** past the board edge.
Rendering that path with `stroke-dasharray: bodyLen, totalLen` and sliding `stroke-dashoffset` moves a
body-length window of visible stroke along it. The head runs out along the straight extension while
the tail is reeled through the bends — so the arrow straightens as it goes.

The head glides at a constant speed, so every arrow travels at the same readable pace regardless of
how far it has to go. See [`src/render/escape.ts`](src/render/escape.ts).

Arrows also escape **concurrently**: the model frees a tapped arrow's cells immediately, so you can
tap the next arrow without waiting for the current one to finish sliding out.

## Project layout

```
src/core/     types · seeded rng · board rules (ray, isBlocked) · level generator · geometry
src/render/   SVG board view · escape + lunge animations · confetti
src/game/     pure game state · controller · localStorage progress
src/ui/       hearts HUD · intro / level-select screen · rolling level counter
tests/        board rules + generator solvability property tests
```

The core is pure and DOM-free: `tap(state, id)` mutates the model and reports what happened, and the
controller drives the matching animation. Nothing in `src/core` knows about SVG.

## Testing

```bash
npm run test
```

The suite is mostly a property test over the generator: **500 generated levels are each replayed in
their recorded solution order**, asserting no arrow is ever blocked when its turn comes, every board
is legal (contiguous, self-avoiding, non-overlapping arrows), and every board has a legal opening move.
If the reverse-construction invariant ever breaks, those 500 seeds will catch it.

## Notes

Progress (highest level unlocked) is stored in `localStorage` under `arrows.progress.v1`.

To inspect the escape animation frame by frame, slow it down from the browser console:

```js
window.__ARROWS_SLOWMO = 20
```
