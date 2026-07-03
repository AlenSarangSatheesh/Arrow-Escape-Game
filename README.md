<div align="center">

# Arrow Escape

**A polished slide-and-redirect grid puzzle for the browser.**
Launch your token, obey every arrow, and route yourself to the exit.

[Play](#getting-started) · [How to play](#how-to-play) · [Documentation](docs/) · [Contributing](CONTRIBUTING.md)

![License](https://img.shields.io/badge/license-MIT-blue)
![No frameworks](https://img.shields.io/badge/dependencies-zero-brightgreen)
![PWA](https://img.shields.io/badge/PWA-offline%20ready-8b5cf6)
![Vanilla JS](https://img.shields.io/badge/vanilla-ES2022-f7df1e)

</div>

---

## What is Arrow Escape?

Arrow Escape is a minimalist logic puzzle built on one deceptively deep idea: **you don't step,
you slide.** Choose a direction and your token glides across the board until it hits a wall or a
stop pad. Every **arrow** it crosses redirects it. Your job is to pick the right *sequence of
launches* so the arrows carry you to the **exit** — in as few moves as possible.

The game grows in difficulty not by making mazes bigger, but by **introducing new mechanics** —
mirrors, portals, keys, color gates, rotating arrows, conveyors, lasers, moving walls, and more —
each taught in its own world and then combined into devious late-game puzzles.

## Features

- 🧩 **100+ handcrafted levels** across six difficulty worlds, plus **Daily** and **Endless** modes.
- 🧠 **Intelligent systems** — an exact solver powers optimal-move stars, progressive hints,
  difficulty estimation, and a procedural generator that only ships solvable puzzles.
- 🎨 **Premium, themeable presentation** — five cosmetic themes, smooth 60fps Canvas rendering,
  particles, and tactile micro-animations.
- 🛠️ **Full level editor** — draw, validate, play instantly, and share levels as compact codes.
- ♿ **Accessible by design** — full keyboard play, reduced-motion mode, colorblind-safe palettes,
  and never color-only.
- 📱 **Works everywhere** — desktop, tablet, and mobile with touch/swipe controls.
- 🚀 **Zero dependencies, offline-ready** — vanilla ES modules, no build step, installable PWA.

## Getting started

You need [Node.js](https://nodejs.org/) 18+ to run the local dev server (used only to serve files
over HTTP so native ES modules load).

```bash
git clone https://github.com/AlenSarangSatheesh/Arrow-Escape-Game.git
cd Arrow-Escape-Game
npm start
```

Then open the printed URL (default <http://localhost:5173>) in any modern browser.

> There is no build step and no bundler. The `npm start` server exists only because browsers
> require ES modules to be served over HTTP rather than opened from the filesystem.

## How to play

| Action        | Desktop                    | Touch                         |
| ------------- | -------------------------- | ----------------------------- |
| Launch        | Arrow keys / **W A S D**   | Swipe in a direction          |
| Undo          | **U**                      | Undo button                   |
| Restart       | **R**                      | Restart button                |
| Hint          | **H**                      | Hint button                   |
| Pause / back  | **Esc**                    | Pause button                  |

1. Your token sits on the **start** tile.
2. Launch it in a direction. It **slides** until it hits a wall, a stop pad, or the board edge.
3. Any **arrow** it passes over **redirects** it — you must obey every arrow.
4. Reach the **exit** to win. Beat the **par** move count and grab any **gems** for three stars.

## Documentation

| Document | What's inside |
| -------- | ------------- |
| [Game Design](docs/GAME_DESIGN.md) | Gameplay, mechanics catalog, progression, scoring, audio, visuals |
| [Technical Design](docs/TECHNICAL_DESIGN.md) | Architecture, simulation algorithm, rendering, save system, performance |
| [UX Specification](docs/UX_SPECIFICATION.md) | Every screen, wireframes, flows, responsive & accessibility notes |
| [Art Direction](docs/ART_DIRECTION.md) | Design tokens, components, object visuals, motion language |
| [Level Format](docs/LEVEL_FORMAT.md) | Level schema, tile/entity types, share-codes, authoring guide |

## Project structure

```
src/
  core/     math, constants, seeded RNG, event bus   (no DOM)
  engine/   the pure, deterministic slide simulation  (no DOM)
  ai/       solver, difficulty estimator, generator
  game/     play session: controller, history, scoring, hints
  render/   Canvas renderer, camera, particles, tweening
  input/    keyboard, pointer, swipe, on-screen d-pad
  audio/    synthesized sound effects and ambience
  ui/       screen manager, all screens, components, editor
  data/     save, settings, statistics, achievements, level repository
  levels/   level packs and the share-code codec
styles/     design tokens and screen/component styles
tests/      zero-dependency test runner and suites
```

## Development

```bash
npm start        # run the dev server
npm test         # run the engine/solver/codec test suites
npm run check    # syntax-check the whole source tree
```

See [CONTRIBUTING.md](CONTRIBUTING.md) for the full workflow and coding standards.

## Roadmap

Arrow Escape's architecture is intentionally built to grow. Planned directions include online
leaderboards, cloud saves, a community level marketplace, a multiplayer race mode, and seasonal
events — all enabled by the game's deterministic simulation, replay system, and adapter seams.

## License

Released under the [MIT License](LICENSE).
