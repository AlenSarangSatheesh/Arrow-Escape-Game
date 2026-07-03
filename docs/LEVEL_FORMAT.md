# Level Format & Authoring Guide

> **Scope.** This document is the normative reference for the Arrow Escape level data model:
> the `Level` object schema, the `TileType` enumeration, entity definitions, the two tile-grid
> encodings (RLE string and typed array), the portable share-code format, validation rules,
> versioning/migration, and hand-authoring best practices.
>
> It formalizes and expands section 17 ("Level format") of the design brief. Where this document
> and the brief disagree, the brief wins — please open an issue so we can reconcile them.

---

## Table of contents

1. [Concepts & coordinate system](#1-concepts--coordinate-system)
2. [The `Level` object](#2-the-level-object)
3. [`TileType` enumeration](#3-tiletype-enumeration)
4. [Entities](#4-entities)
5. [Tile-grid encoding](#5-tile-grid-encoding)
6. [Share-code format](#6-share-code-format)
7. [Worked example](#7-worked-example)
8. [Validation rules](#8-validation-rules)
9. [Versioning & migration](#9-versioning--migration)
10. [Authoring best practices](#10-authoring-best-practices)
11. [Appendix: enum & field quick reference](#11-appendix-enum--field-quick-reference)

---

## 1. Concepts & coordinate system

A level is a **rectangular grid** of `width × height` **tiles** (cells). Coordinates are
`(x, y)` where `x` is the **column** and `y` is the **row**, with the **origin at the top-left**.

```
        x → 0   1   2   3   4
      y ┌───┬───┬───┬───┬───┐
      ↓ │0,0│1,0│2,0│3,0│4,0│   row 0 (top)
     0  ├───┼───┼───┼───┼───┤
        │0,1│1,1│2,1│3,1│4,1│   row 1
     1  ├───┼───┼───┼───┼───┤
        │0,2│1,2│2,2│3,2│4,2│   row 2
     2  └───┴───┴───┴───┴───┘
```

The **linear index** of a cell is `index = y * width + x`. All encodings below use this
row-major ordering.

### Directions

Directions are integers, ordered clockwise starting from Up. This ordering is load-bearing:
rotations (e.g. the rotating arrow, section 4) advance by `+1 (mod 4)`, and reversal is `+2 (mod 4)`.

| Name  | Value | (dx, dy) | Key       |
|-------|-------|----------|-----------|
| Up    | `0`   | `(0,-1)` | `↑` / `W` |
| Right | `1`   | `(1, 0)` | `→` / `D` |
| Down  | `2`   | `(0, 1)` | `↓` / `S` |
| Left  | `3`   | `(-1,0)` | `←` / `A` |

```js
// core/direction.js — canonical constants (pure, DOM-free)
export const DIR = { UP: 0, RIGHT: 1, DOWN: 2, LEFT: 3 };
export const DELTA = [[0,-1],[1,0],[0,1],[-1,0]]; // indexed by DIR
export const reverse = (d) => (d + 2) & 3;
export const rotateCW = (d) => (d + 1) & 3;
export const rotateCCW = (d) => (d + 3) & 3;
```

### The Flow model (recap)

A **move** is one *launch* from a rest state to the next rest state (or a fail). The token
slides one tile at a time, resolving each tile it enters (`FLOOR` continues, `ARROW`/`MIRROR`
redirect, `WALL`/`STOP` halt, `VOID` fails, `EXIT` wins, `PORTAL` teleports, …). Given a state
and a launch direction the outcome is **deterministic**; this determinism is what makes the
solver, hinting, difficulty scoring and generation tractable. If a slide would cycle forever,
cycle detection on visited `(pos, dir)` pairs makes the move **illegal / ignored**.

The level *format* only describes the static board; the resolution rules live in the pure
engine (`engine/`). This document tells you what each tile/entity **means** so an author can
predict Flow, but the authoritative behavior is the engine's.

---

## 2. The `Level` object

A `Level` is a plain, JSON-serializable object. Human-authored packs are ES6 modules exporting
arrays of these objects, kept readable. The full schema:

```jsonc
{
  // ── Identity ────────────────────────────────────────────────
  "id":        "w1-04",          // string, unique level id (stable, save-key)
  "name":      "Crossroads",     // string, display name
  "world":     1,                // int ≥ 0 (0 = Tutorial, 1..5 = Easy..Master)
  "index":     4,                // int ≥ 0, position within its world
  "author":    "contributors",   // string, credited author/handle
  "version":   1,                // int ≥ 1, level-format schema version (see §9)

  // ── Board geometry ──────────────────────────────────────────
  "width":     5,                // int ≥ 1
  "height":    5,                // int ≥ 1

  // ── Tile grid (exactly ONE of these; see §5) ────────────────
  "tiles":     "F3,W2,...",      // RLE string  form, OR
  "tilesArray":[0,0,0,4,...],    // flat typed-array form (length width*height)

  // ── Entities (see §4) ───────────────────────────────────────
  "entities": [
    { "type": "portal", "x": 1, "y": 0, "pair": "p1", "channel": 0 },
    { "type": "gem",    "x": 3, "y": 2 }
  ],

  // ── Placement of the token, exits ───────────────────────────
  "start":     { "x": 0, "y": 4, "dir": null },   // dir optional (initial facing)
  "exits":     [ { "x": 4, "y": 0, "real": true } ],
  "fakeExits": [ { "x": 4, "y": 4 } ],            // optional decoys

  // ── Objectives / metadata ───────────────────────────────────
  "par":          6,             // int ≥ 1, 2-star move threshold
  "optimalMoves": 5,             // int, solver-filled optimal move count (nullable pre-solve)
  "tags":         ["mirror","decoy"],
  "mechanics":    ["arrow","mirror","fakeExit"],  // TileType/entity kinds present
  "difficulty":   "Easy",        // bucket label (see below)
  "themeHint":    "Aurora",      // optional cosmetic theme suggestion
  "hintsAllowed": 3              // int ≥ 0, hint budget for this level
}
```

### Field reference

| Field          | Type                    | Required | Meaning                                                                                  |
|----------------|-------------------------|----------|------------------------------------------------------------------------------------------|
| `id`           | `string`                | yes      | Globally unique, stable identifier. Used as the save-key for progress/unlocks.           |
| `name`         | `string`                | yes      | Human-facing level title.                                                                |
| `world`        | `int` (0–5)             | yes      | `0`=Tutorial, `1`=Easy, `2`=Medium, `3`=Hard, `4`=Expert, `5`=Master.                    |
| `index`        | `int ≥ 0`               | yes      | Ordering within the world (also drives unlock sequencing).                                |
| `author`       | `string`                | yes      | Credited author. Default `"contributors"`.                                                |
| `version`      | `int ≥ 1`               | yes      | Schema version this level was written against (§9).                                       |
| `width`        | `int ≥ 1`               | yes      | Grid columns.                                                                             |
| `height`       | `int ≥ 1`               | yes      | Grid rows.                                                                                |
| `tiles`        | `string`                | one-of   | RLE-encoded grid (§5.1). Provide this **or** `tilesArray`, not both.                      |
| `tilesArray`   | `int[]`                 | one-of   | Flat row-major array of packed tile words (§5.2).                                         |
| `entities`     | `Entity[]`              | yes      | Overlay entities that need parameters or pairing (§4). May be empty `[]`.                 |
| `start`        | `{x,y,dir?}`            | yes      | The token's initial rest tile. `dir` is an optional initial facing (default `null`).     |
| `exits`        | `Exit[]`                | yes      | One or more real exits. `real` must be `true` for at least one.                          |
| `fakeExits`    | `{x,y}[]`               | no       | Decoy exits that *look* like exits but reject the token.                                  |
| `par`          | `int ≥ 1`               | yes      | Move count for the 2-star threshold. Should be `≥ optimalMoves`.                          |
| `optimalMoves` | `int` or `null`         | no       | Solver-computed optimal move count. `null`/absent until solved.                          |
| `tags`         | `string[]`              | no       | Free-form curation tags (e.g. `"boss"`, `"teaching"`).                                    |
| `mechanics`    | `string[]`              | yes      | The distinct mechanic kinds present; drives DifficultyEstimator & filtering.             |
| `difficulty`   | `string`                | yes      | Bucket: `Tutorial \| Easy \| Medium \| Hard \| Expert \| Master`.                        |
| `themeHint`    | `string`                | no       | Cosmetic theme suggestion; never affects gameplay.                                       |
| `hintsAllowed` | `int ≥ 0`               | yes      | Hint budget. `0` disables hints for the level.                                           |

> **Solver-owned fields.** `optimalMoves` (and, when present, a canonical solution) are written
> by the solver, not by hand. Authors may leave `optimalMoves` absent; the toolchain fills it and
> derives a sane `par` if one was not supplied.

---

## 3. `TileType` enumeration

Every cell has exactly one `TileType`. Tiles that carry a small parameter (a direction, a
mirror axis, a color, a phase) pack that parameter into the encoded word (§5). Entities that
need pairing, targets or richer data are **not** tiles — they live in `entities[]` (§4).

```js
// engine/tiles.js — the tile enumeration (values are stable & wire-visible)
export const TileType = Object.freeze({
  FLOOR:        0,  // slide through, keep direction
  WALL:         1,  // solid; token stops on the tile it came from
  STOP:         2,  // "stop pad": floor that always halts the token (a rest point)
  ARROW:        3,  // redirect to param direction
  MIRROR:       4,  // reflect along param axis ("/" or "\")
  REVERSE:      5,  // 180° flip of current direction
  EXIT:         6,  // real exit (win); paired with an `exits[]` entry
  FAKE_EXIT:    7,  // decoy exit; behaves like WALL but reads as an exit
  VOID:         8,  // hole/open cell; token falls → soft-fail
  ONEWAY:       9,  // one-way gate: passable only along param direction
  ICE:         10,  // like floor, but token cannot voluntarily stop on it
  CONVEYOR:    11,  // after a rest lands here, nudge one tile in param dir
  ROTATOR:     12,  // rotating arrow: redirects to param dir, then rotates +1 CW on exit
  CHARGE:      13,  // numbered arrow: acts as floor until hit `n` times, then redirects
  MAGNET:      14,  // pulls the token one extra tile toward it on adjacency
  FUSE:        15   // must be reached within K moves of activation, else seals (→ WALL)
});
```

### Per-tile parameters & behavior

The `param` column describes the payload packed alongside the tile (see §5 for bit layout).
"Halts?" indicates whether entering the tile produces a rest state.

| Tile        | Value | Param (meaning)                              | Halts? | Flow behavior                                                                 |
|-------------|-------|----------------------------------------------|--------|------------------------------------------------------------------------------|
| `FLOOR`     | 0     | —                                            | no     | Continue in current direction.                                               |
| `WALL`      | 1     | —                                            | yes*   | Impassable. Token stops on the **previous** tile (its last valid rest).       |
| `STOP`      | 2     | —                                            | yes    | Passable floor that forces a halt on entry (deliberate rest point).           |
| `ARROW`     | 3     | `dir` ∈ {0..3}                               | no     | Set current direction to `dir`, continue.                                     |
| `MIRROR`    | 4     | `axis`: `0="/"`, `1="\"`                     | no     | Reflect: for `/` Right↔Up, Left↔Down; for `\` Right↔Down, Left↔Up.            |
| `REVERSE`   | 5     | —                                            | no     | `dir → reverse(dir)`, continue.                                              |
| `EXIT`      | 6     | `group` (0..N, multi-exit id)                | win    | If it is the *real* exit for this level → level complete.                     |
| `FAKE_EXIT` | 7     | —                                            | yes*   | Looks like an exit; behaves as `WALL` (rejects the token).                    |
| `VOID`      | 8     | —                                            | fail   | Token falls → soft-fail (auto-undo prompt) unless a flying mechanic applies.  |
| `ONEWAY`    | 9     | `dir` (permitted travel direction)           | cond.  | Enterable only when moving along `dir`; otherwise behaves as `WALL`.          |
| `ICE`       | 10    | —                                            | no     | Like `FLOOR`; the token may not voluntarily stop on an ice run.               |
| `CONVEYOR`  | 11    | `dir` (nudge direction)                      | yes    | Halts, then on the following resolution nudges one tile toward `dir`.         |
| `ROTATOR`   | 12    | `dir` (current facing)                       | no     | Redirect to `dir`; on the token leaving, `dir → rotateCW(dir)`.               |
| `CHARGE`    | 13    | `dir` (4b) + `n` remaining hits (4b)         | no     | Acts as `FLOOR` while `n>0`, decrementing `n` per hit; at `n==0` redirects.   |
| `MAGNET`    | 14    | `strength` (reserved, use `0`)               | no     | When the token rests adjacent, pull it one extra tile toward the magnet.      |
| `FUSE`      | 15    | `k` (move window)                            | cond.  | Sealable target; if not reached within `k` moves of activation, becomes `WALL`.|

> \* `WALL`, `FAKE_EXIT`, and blocked `ONEWAY` are **not** landed on — they cause the token to
> rest on the tile it entered them *from*. "Halts? = yes\*" means "produces a rest on the previous
> tile," not "the token occupies this tile."

### Mirror reflection table

`MIRROR` axis `0 = "/"`, `1 = "\"`. Reading: *incoming direction → outgoing direction.*

| Incoming | `/` (axis 0) | `\` (axis 1) |
|----------|--------------|--------------|
| Up       | Right        | Left         |
| Right    | Up           | Down         |
| Down     | Left         | Right        |
| Left     | Down         | Up           |

---

## 4. Entities

Entities are overlay objects stored in `entities[]`. Use an entity (rather than a tile param)
whenever the mechanic needs **pairing, a target reference, a color channel, or per-instance
state** that does not fit in the compact tile word. An entity always carries `type`, `x`, `y`.

An entity **coexists** with the tile beneath it. Convention: place entities over `FLOOR`
(or `STOP` where a rest is desired) unless the entity explicitly replaces tile behavior.

### 4.1 Entity catalog

| `type`      | Extra params                                   | Meaning                                                                           |
|-------------|------------------------------------------------|-----------------------------------------------------------------------------------|
| `portal`    | `pair` (string id), `channel` (int)            | Teleporter. Two entities sharing `pair` form a portal; token teleports, keeps dir.|
| `switch`    | `targets` (id[]), `sticky` (bool)              | Pressure switch. Pressing toggles/sets state of referenced targets.               |
| `target`    | `id` (string), `kind`, `startOpen` (bool)      | A switch-controlled element: `wall`, `bridge`, or `door`.                          |
| `key`       | `color` (string)                               | Pickup; grants a key of `color` to the carried inventory.                          |
| `lock`      | `color` (string)                               | Locked tile; passable only if carrying a key of matching `color` (consumes it).   |
| `colorGate` | `color` (string)                               | Passable only while the token *carries* that color (color persists, not consumed).|
| `colorPick` | `color` (string)                               | Grants/sets the carried color.                                                     |
| `gem`       | —                                              | Optional collectible; needed for the 3-star condition.                            |
| `laser`     | `dir` (int), `on` (bool), `phase` (int)        | Emitter. Beam travels `dir` until blocked/mirrored; crossing it is a hazard.      |
| `movingWall`| `path` (cell[]), `period` (int), `phase` (int) | Wall whose position is `f(moveCount)` over `path`.                                 |
| `timedWall` | `period` (int), `phase` (int), `openLen` (int) | Wall/door that opens & closes on move-count period.                                |

Notes:

- **Portal pairs.** Exactly two `portal` entities must share a given `pair` id. `channel` lets
  multiple independent portal pairs coexist and is used only for rendering/tinting.
- **Switch → target wiring.** A `switch`'s `targets` array lists `target` ids. A `sticky`
  switch latches on first press; a non-sticky switch is a momentary toggle. `target.kind`
  chooses whether it manifests as a `wall`, a `bridge` (over `VOID`), or a `door`.
- **Keys/locks vs. color gates.** A `key` is **consumed** opening a matching `lock`. A carried
  **color** (`colorPick`) is **not** consumed by a `colorGate`; it persists until changed.
- **Timed/moving obstacles** are functions of `moveCount` only (deterministic), never wall-clock
  time. `phase` offsets the cycle so multiple obstacles can interleave.

### 4.2 Entity shape (informal schema)

```jsonc
// A portal pair
{ "type": "portal", "x": 1, "y": 0, "pair": "p1", "channel": 0 }
{ "type": "portal", "x": 6, "y": 3, "pair": "p1", "channel": 0 }

// A switch that opens two bridge tiles
{ "type": "switch", "x": 2, "y": 2, "targets": ["br-a","br-b"], "sticky": false }
{ "type": "target", "x": 4, "y": 1, "id": "br-a", "kind": "bridge", "startOpen": false }
{ "type": "target", "x": 5, "y": 1, "id": "br-b", "kind": "bridge", "startOpen": false }

// Key + matching lock
{ "type": "key",  "x": 0, "y": 0, "color": "amber" }
{ "type": "lock", "x": 3, "y": 0, "color": "amber" }

// Color gate + pickup
{ "type": "colorPick", "x": 1, "y": 4, "color": "teal" }
{ "type": "colorGate", "x": 5, "y": 4, "color": "teal" }

// Laser emitter firing Down, initially on
{ "type": "laser", "x": 2, "y": 0, "dir": 2, "on": true, "phase": 0 }

// Moving wall cycling along a 3-cell path every 4 moves
{ "type": "movingWall", "x": 3, "y": 3,
  "path": [[3,3],[4,3],[5,3]], "period": 4, "phase": 0 }
```

---

## 5. Tile-grid encoding

The base tile grid is stored in **exactly one** of two interchangeable encodings. Both describe
the same `width × height` row-major grid of **packed tile words**.

### 5.1 Packed tile word

Each cell is a 16-bit word: the low nibble is the `TileType`, the remaining bits hold that
tile's `param` (see §3). Most tiles use `param = 0`.

```
 bit  15 14 13 12 11 10  9  8  7  6  5  4 │ 3  2  1  0
      └──────────────  param  ───────────┘ └─ TileType ┘

 pack(type, param)   =  ((param & 0x0FFF) << 4) | (type & 0x0F)
 unpackType(word)    =  word & 0x0F
 unpackParam(word)   =  (word >> 4) & 0x0FFF
```

Param conventions per tile:

| Tile      | Param encoding                                                            |
|-----------|--------------------------------------------------------------------------|
| `ARROW`   | `param = dir` (0..3)                                                      |
| `MIRROR`  | `param = axis` (0=`/`, 1=`\`)                                             |
| `ONEWAY`  | `param = dir` (0..3, permitted travel direction)                         |
| `CONVEYOR`| `param = dir` (0..3, nudge direction)                                     |
| `ROTATOR` | `param = dir` (0..3, current facing)                                      |
| `EXIT`    | `param = group` (multi-exit id, 0 for single-exit levels)                |
| `CHARGE`  | `param = (n << 2) | dir` — low 2 bits = `dir`, next 4 bits = hits `n`     |
| `FUSE`    | `param = k` (move window)                                                 |
| others    | `param = 0`                                                              |

### 5.2 Typed-array form (`tilesArray`)

`tilesArray` is a flat JS array (serialized to `Uint16Array` at runtime) of length
`width * height`, in row-major order, of packed words. This is the fast in-memory form and the
canonical body of the share-code (§6).

```js
// Round-trip helpers (pure)
export function gridToArray(cells /* 2D [y][x] of {type,param} */, w, h) {
  const out = new Uint16Array(w * h);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++)
      out[y * w + x] = pack(cells[y][x].type, cells[y][x].param ?? 0);
  return out;
}
```

### 5.3 RLE string form (`tiles`)

The RLE form is the **human-readable, hand-authorable** encoding. It is a comma-separated list
of runs read in row-major order; runs freely cross row boundaries (the decoder re-wraps using
`width`). Each run is:

```
<GLYPH>[:param][×count]

 GLYPH   single-letter tile mnemonic (see table)
 :param  optional param (decimal, or a direction letter U/R/D/L, or mirror / \)
 count   optional repeat count, written after "*"; default 1
```

Tile glyphs:

| Glyph | Tile        | Param syntax                          | Example      |
|-------|-------------|---------------------------------------|--------------|
| `F`   | `FLOOR`     | —                                     | `F*5`        |
| `W`   | `WALL`      | —                                     | `W*2`        |
| `S`   | `STOP`      | —                                     | `S`          |
| `A`   | `ARROW`     | `:U`/`:R`/`:D`/`:L`                    | `A:R`        |
| `M`   | `MIRROR`    | `:/` or `:\`                          | `M:/`        |
| `V`   | `REVERSE`   | —                                     | `V`          |
| `E`   | `EXIT`      | `:group` (optional)                   | `E` / `E:1`  |
| `X`   | `FAKE_EXIT` | —                                     | `X`          |
| `O`   | `VOID`      | —                                     | `O*3`        |
| `G`   | `ONEWAY`    | `:U/R/D/L`                            | `G:D`        |
| `I`   | `ICE`       | —                                     | `I*4`        |
| `C`   | `CONVEYOR`  | `:U/R/D/L`                            | `C:R`        |
| `R`   | `ROTATOR`   | `:U/R/D/L` (start facing)             | `R:U`        |
| `H`   | `CHARGE`    | `:dir/n` (e.g. `:R/2`)                | `H:R/2`      |
| `N`   | `MAGNET`    | —                                     | `N`          |
| `U`   | `FUSE`      | `:k`                                  | `U:3`        |

> The RLE and typed-array forms are **isomorphic**: `RLE ⇄ tilesArray` losslessly. Tools should
> author/read RLE and compile to `tilesArray` for the engine and share-code.

**Example.** A 5×3 board — top row all walls, middle row floor with a right-arrow at center,
bottom row floor then exit:

```
W*5, F*2,A:R,F*2, F*4,E
```

Decoded (5 wide), with the middle arrow at `(2,1)`:

```
W  W  W  W  W
F  F  A→ F  F
F  F  F  F  E
```

---

## 6. Share-code format

`LevelCodec` produces a compact, URL-safe **share-code** for import / export / share. A share
code is a **base64url** string (RFC 4648 §5, alphabet `A–Z a–z 0–9 - _`, **no padding**) wrapping
a versioned, checksummed binary payload.

### 6.1 Byte layout

```
┌────────┬────────────┬──────────────────────────────┬───────────┐
│ ver(1) │ header (H) │ body (variable)              │ crc32 (4) │
└────────┴────────────┴──────────────────────────────┴───────────┘
 all multi-byte integers little-endian; checksum covers ver+header+body
```

| Segment    | Size      | Contents                                                                          |
|------------|-----------|-----------------------------------------------------------------------------------|
| `ver`      | 1 byte    | Share-code format version (currently `1`). Distinct from `Level.version`.          |
| `header`   | H bytes   | `width` (u16), `height` (u16), `startX` (u16), `startY` (u16), flags (u8), counts. |
| `body`     | variable  | Tile stream + entity stream + exit list (see below).                              |
| `crc32`    | 4 bytes   | CRC-32 (IEEE 802.3, poly `0xEDB88320`) over `ver ‖ header ‖ body`.                 |

Body streams (each length-prefixed with a `varint`):

1. **Tiles** — the `tilesArray` words, delta+RLE compressed (long `FLOOR` runs collapse well).
2. **Exits** — count, then each `(x u16, y u16, real u8, group u8)`.
3. **Entities** — count, then each `(kind u8, x u16, y u16, params…)` where the param schema is
   keyed by `kind` (matching §4).

### 6.2 Encode / decode contract

```js
// data/LevelCodec.js  (pure; no DOM)
export function encodeShareCode(level) {
  const bytes = writePayload(level);          // ver ‖ header ‖ body
  const crc   = crc32(bytes);                 // Uint32
  const full  = concat(bytes, u32le(crc));    // append checksum
  return base64urlEncode(full);               // no '=' padding
}

export function decodeShareCode(code) {
  const full = base64urlDecode(code);
  const ver  = full[0];
  if (ver > SUPPORTED_SHARECODE_VERSION) throw new CodecError('unsupported version');
  const body = full.subarray(0, full.length - 4);
  const crc  = readU32le(full, full.length - 4);
  if (crc32(body) !== crc) throw new CodecError('checksum mismatch');
  return migrateShareCode(ver, readPayload(body)); // → Level object
}
```

Guarantees:

- **Self-describing version.** The leading byte lets old clients reject/upgrade newer codes.
- **Integrity.** A mistyped or truncated code fails the CRC and is rejected cleanly (never
  loaded as a corrupt level).
- **URL-safe & compact.** base64url means codes paste into URLs/QRs without escaping; the tile
  RLE keeps typical small levels well under a tweet.

> **Naming.** Share codes are conventionally prefixed for humans, e.g. `AE1-<base64url>`
> (`AE` = Arrow Escape, `1` = share-code version). The prefix is cosmetic; the decoder strips a
> known prefix before base64url decoding.

---

## 7. Worked example

A minimal, fully valid 3×3 level: the token starts bottom-left, launching **Right** slides it
into an arrow that redirects it **Up** into the exit. A wall caps the top-right so the arrow read
is unambiguous.

```
        x → 0    1    2
      y ┌────┬────┬────┐
     0  │ F  │ F  │ E  │   exit at (2,0)
        ├────┼────┼────┤
     1  │ F  │ F  │ W  │   wall at (2,1)
        ├────┼────┼────┤
     2  │ S* │ F  │ A↑ │   start at (0,2), arrow-Up at (2,2)
        └────┴────┴────┘
```

Launch **Right** from `(0,2)`: slide `(0,2)→(1,2)→(2,2)`, the `ARROW(Up)` redirects to Up,
slide `(2,2)→(2,1)`… but `(2,1)` is `WALL` — so the token would rest at `(2,2)`. To actually
reach the exit the intended solution routes through a clear column; this compact board is shown
purely to exercise every required tile (start, arrow, wall, exit). A solvable variant simply
moves the wall to `(0,0)`:

```json
{
  "id": "demo-01",
  "name": "First Slide",
  "world": 0,
  "index": 0,
  "author": "contributors",
  "version": 1,
  "width": 3,
  "height": 3,
  "tiles": "W,F,E, F,F,F, S,F,A:U",
  "entities": [],
  "start":     { "x": 0, "y": 2, "dir": null },
  "exits":     [ { "x": 2, "y": 0, "real": true } ],
  "fakeExits": [],
  "par":          2,
  "optimalMoves": 2,
  "tags":         ["teaching"],
  "mechanics":    ["arrow", "wall", "exit"],
  "difficulty":   "Tutorial",
  "themeHint":    "Aurora",
  "hintsAllowed": 3
}
```

Intended solution (2 moves): **Right** launches `(0,2)→(2,2)`, the `ARROW(Up)` redirects Up and
the token slides `(2,2)→(2,1)→(2,0)` straight into the **exit**. Two launches, matching
`optimalMoves: 2`.

### Share-code concept for this level

The codec would serialize this as:

```
ver = 1
header: width=3, height=3, startX=0, startY=2, flags=0, exitCount=1, entityCount=0
body:
  tiles  (RLE-compressed word stream): W · F · E · F · F · F · S · F · A(dir=Up)
  exits :  (2, 0, real=1, group=0)
  entities: (none)
crc32  = <computed over the above>
```

…then `base64url(ver ‖ header ‖ body ‖ crc32)` with the human prefix, e.g.:

```
AE1-QwFDAwMAAgD...    (illustrative; exact bytes depend on the packed stream)
```

Pasting that code into **Import** reconstructs the identical `Level` object, verified by the
trailing CRC-32 before it is ever handed to the engine.

---

## 8. Validation rules

A level must satisfy **all** of the following to be accepted by the loader, editor, or importer.
The validator lives beside the codec and returns a list of structured errors.

### 8.1 Structural

1. `width ≥ 1`, `height ≥ 1`, both integers.
2. Exactly one of `tiles` / `tilesArray` is present.
3. Decoded grid length equals `width * height`.
4. Every decoded word has a valid `TileType` (`0..15`) and an in-range `param` for that type
   (e.g. `ARROW`/`ONEWAY`/`CONVEYOR`/`ROTATOR` param ∈ `0..3`; `MIRROR` axis ∈ `0..1`).
5. All coordinates (`start`, `exits`, `fakeExits`, every entity `x/y`, every `path` cell) are
   in-bounds: `0 ≤ x < width`, `0 ≤ y < height`.

### 8.2 Semantic

6. Exactly one `start`; the start tile is standable (not `WALL`/`VOID`/`FAKE_EXIT`).
7. `exits` is non-empty and **at least one** exit has `real: true`. Every `exits` coordinate
   overlaps an `EXIT` tile; every `fakeExits` coordinate overlaps a `FAKE_EXIT` tile.
8. `start` does not coincide with any `EXIT` (a level cannot be pre-won).
9. **Portals pair up**: each `pair` id is used by *exactly two* `portal` entities.
10. **Switch/target integrity**: every id in a `switch.targets` resolves to a `target.id`;
    no dangling references; ids are unique among targets.
11. **Keys/locks & colors**: every `lock` color has at least one reachable `key` of that color;
    every `colorGate` color has at least one `colorPick` of that color. (Reachability is checked
    by the solver in strict mode; a lint warning otherwise.)
12. No two entities of a mutually-exclusive kind occupy the same cell (e.g. two `portal` of
    different pairs on one cell). Overlaying a `gem` on `FLOOR`/`STOP` is fine.
13. `par ≥ 1`; if `optimalMoves` is present then `par ≥ optimalMoves`.
14. `hintsAllowed ≥ 0`; `world ∈ 0..5`; `difficulty` is a valid bucket string.
15. `mechanics` lists every tile/entity kind actually present (no missing kinds; extras warn).

### 8.3 Solvability (strict mode — solver-backed)

16. The level is **solvable**: the BFS solver finds at least one path from `start` to a real
    exit. `optimalMoves` is set to that path length.
17. No **unavoidable infinite cycle**: the deterministic sim's cycle detection must never make
    *every* launch from a reachable rest-state illegal (i.e. the player is never soft-locked).
18. All `exits[].real === true` exits used in the intended pack should be reachable; unreachable
    real exits are a warning (they may be intentional multi-exit decoys, but flag for review).
19. If the level declares collectibles (`gem`), a 3-star path (optimal moves **and** all gems)
    should exist for the level to be 3-star-attainable; otherwise warn.

> Strict mode (16–19) runs in CI and in the editor's "Verify" action. Fast mode (1–15) runs on
> every import so hostile/corrupt share codes are rejected without invoking the solver.

---

## 9. Versioning & migration

Two independent version numbers exist; keep them distinct:

| Version           | Where            | Bumps when…                                                              |
|-------------------|------------------|--------------------------------------------------------------------------|
| `Level.version`   | in the object    | The **Level object schema** changes (new field, changed semantics).      |
| share-code `ver`  | first code byte  | The **binary wire format** changes (new segment, re-ordered fields).     |

### 9.1 Compatibility policy

- **Additive changes** (new optional field, new `TileType`/entity kind appended) do **not**
  require a version bump if old readers can safely ignore/skip them. Prefer additive design.
- **Breaking changes** (removing/renaming a field, changing a param's meaning, re-numbering an
  enum value) **require** a version bump and a migration.
- Enum values (`TileType`, `DIR`, entity `kind` codes) are **append-only and never reused**.
  A retired kind's slot is left permanently vacant.

### 9.2 Migration mechanism

A registry of pure migration functions upgrades old data to `current` on load. Migrations are
composed in sequence; never mutate historical data files in place.

```js
// data/migrations.js
export const LEVEL_MIGRATIONS = {
  1: (lvl) => lvl,                         // v1 → v1 (identity, baseline)
  // 2: (lvl) => ({ ...lvl, version: 2, hintsAllowed: lvl.hintsAllowed ?? 3 }),
};

export function migrateLevel(level) {
  let l = level, v = l.version ?? 1;
  while (LEVEL_MIGRATIONS[v + 1]) { l = LEVEL_MIGRATIONS[v + 1](l); v = l.version; }
  return l;
}
```

Share-code migration mirrors this, keyed by the leading `ver` byte, and runs **after** the CRC
check but **before** the payload is turned into a `Level` (see `decodeShareCode`, §6.2).

### 9.3 Rules of thumb

1. Always write `version` on new levels; never omit it.
2. Add, don't rewrite: introduce a v+1 migration rather than editing shipped level data.
3. Save-data (`arrowEscape.v1.*`) follows the same additive/migratable discipline; a level-schema
   bump must not silently invalidate a player's progress keyed by `id`.
4. Keep migrations pure and covered by the test runner (round-trip: `decode(encode(x)) === x`).

---

## 10. Authoring best practices

Guidance for hand-crafted levels. Generated levels obey the same rules but are shaped by the
DifficultyEstimator and generator instead.

### 10.1 Teach one thing at a time

The mechanics roadmap is a **teaching sequence** — introduce each new tile/entity in isolation
before combining it. A world's first levels should let the player discover a mechanic safely
(unmissable, no punishment), then ramp:

```
introduce ──► reinforce ──► vary ──► combine with prior ──► subvert expectation
```

- Tutorial (world 0): Flow, walls, exit, mirrors — guided, unmissable.
- Combine **at most one new** mechanic with already-taught ones per level.

### 10.2 Respect determinism & Flow

- Every launch from every rest state must resolve to a *predictable* rest state or a clean fail.
  Author boards you can trace by eye; if you can't predict the slide, neither can the player.
- Never rely on a slide that cycles forever — the engine will ignore that launch. Use walls,
  stops, arrows and mirrors so intended routes actually terminate.
- Prefer a **unique optimal solution** where possible; multiple trivially-equivalent solutions
  dull the puzzle and lower the difficulty score. The generator explicitly prefers uniqueness.

### 10.3 Fairness & readability

- **No color-only information.** Arrows have shape, gates have icons, colors are also encoded by
  pattern/symbol. A level must be fully solvable on a colorblind-safe palette.
- Keep decoy exits *legible as decoys* on inspection — a fake exit reads as "off" (dashed,
  cracked). Don't hide the real exit behind pure guessing; the puzzle is routing, not luck.
- Give the player breathing room: generous negative space, clear rest points (`STOP` pads),
  and a readable entry direction.

### 10.4 Tune par honestly

- Set `optimalMoves` from the solver, never by guess. Let the toolchain fill it.
- `par = optimalMoves + small slack` (typically `+1` early, `+2..+3` for harder routing). The
  2-star threshold should reward efficient—not perfect—play; 3 stars demand optimal + all gems.
- If a level has collectibles, verify a single path can be optimal **and** collect them all
  (validation rule 19), or intentionally make the 3-star route a distinct, harder line.

### 10.5 Metadata hygiene

- List **every** mechanic actually present in `mechanics[]` (validator rule 15) — this powers
  filtering, difficulty estimation and unlock gating.
- Use `tags[]` for curation intent (`"teaching"`, `"boss"`, `"tricky-mirror"`), not for
  mechanics.
- `themeHint` is cosmetic only; it must never change gameplay. Never encode a puzzle in color.
- Keep `id` stable forever once shipped — it is the save-key. Rename `name`, never `id`.

### 10.6 Author in RLE, verify with the solver

Recommended loop:

1. Sketch the board in the **RLE** form (readable, diff-friendly in level-pack modules).
2. Load it in the editor; hit **Verify** (runs strict validation + solver).
3. Accept the solver's `optimalMoves`; set `par` from it.
4. Export a **share-code** to test import round-trip and to share for playtesting.
5. Commit the readable RLE + metadata to the pack module.

---

## 11. Appendix: enum & field quick reference

### TileType values

```
0 FLOOR   1 WALL     2 STOP     3 ARROW    4 MIRROR   5 REVERSE  6 EXIT     7 FAKE_EXIT
8 VOID    9 ONEWAY  10 ICE     11 CONVEYOR 12 ROTATOR 13 CHARGE  14 MAGNET  15 FUSE
```

### Direction values

```
0 UP   1 RIGHT   2 DOWN   3 LEFT      reverse(d) = (d+2)&3      rotateCW(d) = (d+1)&3
```

### Entity kinds

```
portal · switch · target · key · lock · colorGate · colorPick · gem · laser · movingWall · timedWall
```

### RLE glyph map

```
F floor  W wall   S stop   A arrow    M mirror  V reverse  E exit   X fakeExit
O void   G oneway I ice    C conveyor R rotator H charge   N magnet U fuse
```

### Required `Level` fields

```
id · name · world · index · author · version · width · height ·
(tiles | tilesArray) · entities · start · exits · par · mechanics · difficulty · hintsAllowed
```

---

*Part of the Arrow Escape project. Licensed MIT. Contributions welcome — see `CONTRIBUTING.md`.*
