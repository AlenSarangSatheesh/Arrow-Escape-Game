# Contributing to Arrow Escape

Thanks for your interest in improving Arrow Escape! This project is built with plain
HTML, CSS, and modern JavaScript (ES modules) — **no framework and no build step**, so you
can run it with nothing but a browser and Node.js.

## Getting started

```bash
git clone https://github.com/AlenSarangSatheesh/Arrow-Escape-Game.git
cd Arrow-Escape-Game
npm start          # serves the game at http://localhost:5173
```

Open the printed URL in any modern browser. Because the game uses native ES modules,
you must serve it over HTTP (opening `index.html` from the filesystem will not work).

## Project layout

See [`docs/TECHNICAL_DESIGN.md`](docs/TECHNICAL_DESIGN.md) for the full architecture. In short:

- `src/core` — math, constants, event bus (no DOM).
- `src/engine` — the pure, deterministic game simulation (no DOM).
- `src/ai` — solver, difficulty estimator, procedural generator.
- `src/game` — a play session: controller, history, scoring, hints.
- `src/render`, `src/input`, `src/audio`, `src/ui`, `src/data` — adapters around the core.
- `src/levels` — level packs and the share-code codec.
- `tests` — a tiny zero-dependency test runner.

## Development workflow

1. Create a feature branch: `git checkout -b feat/your-change`.
2. Make focused changes; keep modules single-responsibility.
3. Run the checks:
   ```bash
   npm test        # unit tests for the engine, solver, and codecs
   npm run check   # syntax check across the source tree
   ```
4. Commit with a clear, conventional message (see below).
5. Open a pull request against `main` and fill in the template.

## Coding standards

- **ES modules only.** No global mutable state; pass dependencies in.
- **Keep the engine pure.** Anything in `src/engine` and `src/ai` must not touch the DOM,
  `window`, timers, or randomness that isn't seeded. This keeps the game deterministic,
  testable, and reusable (solver, generator, replays, future multiplayer).
- **Single responsibility per module.** Avoid duplicating logic; extract shared helpers.
- **Accessibility is not optional.** Never rely on color alone; keep keyboard support and
  focus states working; respect reduced-motion.
- **Performance.** Avoid per-frame allocations in the render loop; pool short-lived objects.
- Match the style of the surrounding code (2-space indent, semicolons, `const`/`let`).

## Commit messages

Use [Conventional Commits](https://www.conventionalcommits.org/):

```
feat: add rotating-arrow mechanic
fix: correct mirror reflection for downward slides
docs: expand level authoring guide
refactor: extract slide resolver from the controller
perf: pool particle instances
test: cover portal chaining in the simulation
```

## Adding a level

Levels live in `src/levels/packs/`. Author them as plain data (see
[`docs/LEVEL_FORMAT.md`](docs/LEVEL_FORMAT.md)), then validate with the built-in editor's
**Validate** button or the solver. A level is only accepted if the solver confirms it is
solvable.

## Reporting bugs and requesting features

Open an issue using the appropriate template. Include steps to reproduce, your browser and
OS, and a level share-code if the bug is level-specific.

By contributing, you agree that your contributions are licensed under the project's
[MIT License](LICENSE).
