/**
 * EditorScreen.js — The level editor.
 *
 * Paint tiles and entities onto a grid, set the start and exit, then validate
 * (via the solver), play instantly, and share as a compact code. Reuses the game
 * Renderer for the board and keeps its own undo/redo history of level snapshots.
 */
import { el } from '../dom.js';
import { showModal } from '../components.js';
import { Renderer } from '../../render/Renderer.js';
import { GameState } from '../../engine/GameState.js';
import { createLevel } from '../../engine/LevelModel.js';
import { solve } from '../../ai/Solver.js';
import { generate } from '../../ai/Generator.js';
import { encodeLevel, decodeLevel } from '../../levels/LevelCodec.js';
import { Tile, Dir, MirrorOrient, EntityType, GameColor, COLOR_GLYPHS } from '../../core/Constants.js';
import { cellIndex } from '../../core/Grid.js';

// Palette: what you can paint. `variant: true` means the tool uses the shared
// direction/orientation/color cycle (the Rotate button).
const TOOLS = [
  { key: 'erase', label: 'Erase', icon: '·' },
  { key: 'start', label: 'Start', icon: 'S' },
  { key: 'exit', label: 'Exit', icon: '◉', tile: Tile.EXIT },
  { key: 'wall', label: 'Wall', icon: '⬛', tile: Tile.WALL },
  { key: 'stop', label: 'Stop', icon: '◎', tile: Tile.STOP },
  { key: 'fake', label: 'Fake', icon: '⊘', tile: Tile.FAKE_EXIT },
  { key: 'void', label: 'Void', icon: '⬤', tile: Tile.VOID },
  { key: 'arrow', label: 'Arrow', icon: '→', tile: Tile.ARROW, variant: 'dir' },
  { key: 'mirror', label: 'Mirror', icon: '◹', tile: Tile.MIRROR, variant: 'orient' },
  { key: 'reverse', label: 'Reverse', icon: '⇄', tile: Tile.REVERSE },
  { key: 'rotate', label: 'Spinner', icon: '↻', tile: Tile.ROTATE, variant: 'dir' },
  { key: 'ice', label: 'Ice', icon: '❄', tile: Tile.ICE },
  { key: 'oneway', label: '1-Way', icon: '⇥', tile: Tile.ONEWAY, variant: 'dir' },
  { key: 'conveyor', label: 'Belt', icon: '⇉', tile: Tile.CONVEYOR, variant: 'dir' },
  { key: 'gate', label: 'Gate', icon: '▤', tile: Tile.COLOR_GATE, variant: 'color' },
  { key: 'lock', label: 'Lock', icon: '⚿', tile: Tile.LOCK, variant: 'color' },
  { key: 'gem', label: 'Gem', icon: '◆', entity: EntityType.GEM },
  { key: 'key', label: 'Key', icon: '🔑', entity: EntityType.KEY, variant: 'color' },
  { key: 'portal', label: 'Portal', icon: '◍', entity: EntityType.PORTAL },
];

export function editorScreen(app, params = {}) {
  const { repo } = app.services;

  const def = params.def || blankDef(7, 7);
  let tool = 'wall';
  let variant = Dir.RIGHT; // shared cycle for directional/orientation/color tools
  const history = [];
  const future = [];

  // --- DOM ---------------------------------------------------------------
  const canvas = el('canvas', { id: 'board-canvas' });
  const board = el('div', { className: 'editor__board' }, [canvas]);
  const palette = buildPalette();
  const variantBtn = el('button', { className: 'btn', title: 'Rotate / cycle variant (R)', onClick: cycleVariant }, [el('span', { text: 'Variant: ' }), el('span', { id: 'variant-glyph', text: '→' })]);

  const toolbar = el('div', { className: 'editor__toolbar' }, [
    el('button', { className: 'btn btn--icon btn--ghost', text: '‹', attrs: { 'aria-label': 'Back' }, onClick: () => app.back() }),
    el('button', { className: 'btn', text: 'New', onClick: newLevel }),
    el('button', { className: 'btn', text: 'Undo', onClick: undo }),
    el('button', { className: 'btn', text: 'Redo', onClick: redo }),
    variantBtn,
    el('button', { className: 'btn', text: 'Validate', onClick: validate }),
    el('button', { className: 'btn btn--primary', text: 'Play', onClick: play }),
    el('button', { className: 'btn', text: 'Random', onClick: randomFill }),
    el('button', { className: 'btn', text: 'Share', onClick: share }),
    el('button', { className: 'btn', text: 'Import', onClick: importCode }),
    el('button', { className: 'btn', text: 'Save', onClick: save }),
  ]);

  const root = el('div', { className: 'editor' }, [
    toolbar,
    el('div', { className: 'editor__body' }, [board, palette]),
  ]);

  // --- Renderer ----------------------------------------------------------
  const renderer = new Renderer(canvas);
  renderer.setReducedMotion(true); // editor is static; no idle animation needed

  function rebuild() {
    const runtime = createLevel(toBuildDef());
    renderer.setLevel(runtime);
    renderer.setState(GameState.fromLevel(runtime));
  }

  function toBuildDef() {
    return {
      id: def.id, name: def.name, difficulty: 'custom', world: -1,
      width: def.width, height: def.height, openEdges: def.openEdges,
      types: def.types, params: def.params, start: { ...def.start }, entities: def.entities.map((e) => ({ ...e })),
    };
  }

  // --- History -----------------------------------------------------------
  function snapshot() {
    return { width: def.width, height: def.height, openEdges: def.openEdges, start: { ...def.start }, types: Array.from(def.types), params: Array.from(def.params), entities: def.entities.map((e) => ({ ...e })) };
  }
  function restore(s) {
    def.width = s.width; def.height = s.height; def.openEdges = s.openEdges;
    def.start = { ...s.start };
    def.types = Uint8Array.from(s.types);
    def.params = Uint8Array.from(s.params);
    def.entities = s.entities.map((e) => ({ ...e }));
    rebuild();
  }
  function pushHistory() {
    history.push(snapshot());
    if (history.length > 100) history.shift();
    future.length = 0;
  }
  function undo() { if (history.length) { future.push(snapshot()); restore(history.pop()); } }
  function redo() { if (future.length) { history.push(snapshot()); restore(future.pop()); } }

  // --- Painting ----------------------------------------------------------
  let painting = false;

  function applyAt(x, y) {
    if (x < 0 || y < 0 || x >= def.width || y >= def.height) return;
    const i = cellIndex(x, y, def.width);
    const t = TOOLS.find((tt) => tt.key === tool);
    // Remove any entity currently on the cell for a clean placement/erase.
    const clearEntities = () => { def.entities = def.entities.filter((e) => !(e.x === x && e.y === y)); };

    if (tool === 'erase') {
      def.types[i] = Tile.FLOOR; def.params[i] = 0; clearEntities();
    } else if (tool === 'start') {
      def.start = { x, y };
    } else if (t.entity) {
      clearEntities();
      def.types[i] = Tile.FLOOR; def.params[i] = 0;
      addEntity(t.entity, x, y);
    } else {
      clearEntities();
      // Clicking the same directional tile cycles its parameter.
      if (def.types[i] === t.tile && t.variant) def.params[i] = nextVariant(t.variant, def.params[i]);
      else { def.types[i] = t.tile; def.params[i] = variantValue(t.variant); }
    }
    rebuild();
  }

  function addEntity(type, x, y) {
    if (type === EntityType.PORTAL) {
      const channel = Math.floor(def.entities.filter((e) => e.type === EntityType.PORTAL).length / 2);
      def.entities.push({ type, channel, x, y });
    } else if (type === EntityType.KEY) {
      def.entities.push({ type, color: variant % 6, x, y });
    } else if (type === EntityType.GEM) {
      def.entities.push({ type, id: `g${Date.now() % 100000}-${x}-${y}`, x, y });
    }
  }

  function variantValue(kind) {
    if (kind === 'dir') return variant % 4;
    if (kind === 'orient') return variant % 2;
    if (kind === 'color') return variant % 6;
    return 0;
  }
  function nextVariant(kind, cur) {
    if (kind === 'dir') return (cur + 1) % 4;
    if (kind === 'orient') return cur ? 0 : 1;
    if (kind === 'color') return (cur + 1) % 6;
    return cur;
  }

  function cycleVariant() {
    variant = (variant + 1) % 6;
    updateVariantGlyph();
  }
  function updateVariantGlyph() {
    const g = ['↑', '→', '↓', '←'];
    const t = TOOLS.find((tt) => tt.key === tool);
    let glyph = g[variant % 4];
    if (t?.variant === 'color') glyph = COLOR_GLYPHS[variant % 6];
    else if (t?.variant === 'orient') glyph = variant % 2 ? '◺' : '◹';
    document.getElementById('variant-glyph').textContent = glyph;
  }

  // --- Toolbar actions ---------------------------------------------------
  function validate() {
    const runtime = createLevel(toBuildDef());
    const hasExit = def.types.includes(Tile.EXIT);
    if (!hasExit) { app.toast({ icon: '⚠️', title: 'No exit', desc: 'Place an exit tile first.' }); return; }
    const r = solve(runtime);
    if (r.solvable) app.toast({ icon: '✅', title: 'Solvable!', desc: `Optimal solution: ${r.optimalMoves} move${r.optimalMoves === 1 ? '' : 's'}.` });
    else app.toast({ icon: '❌', title: 'Not solvable', desc: 'No path from start to exit. Keep editing.' });
  }

  function play() {
    const runtime = createLevel(toBuildDef());
    if (!def.types.includes(Tile.EXIT) || !solve(runtime).solvable) {
      app.toast({ icon: '⚠️', title: 'Fix the level first', desc: 'It must be solvable to play.' });
      return;
    }
    app.navigate('game', { level: runtime, mode: 'editor', onExit: () => app.navigate('editor', { def }) });
  }

  function newLevel() {
    const body = el('div', { className: 'stack' });
    const sizes = [[5, 5], [7, 7], [9, 9], [10, 10], [12, 12]];
    for (const [w, h] of sizes) {
      body.appendChild(el('button', { className: 'btn btn--block', text: `${w} × ${h}`, onClick: () => { close(); pushHistory(); Object.assign(def, blankDef(w, h)); rebuild(); } }));
    }
    const close = showModal({ title: 'New level size', body, actions: [{ label: 'Cancel', variant: 'ghost' }] });
  }

  function randomFill() {
    const res = generate({ seed: Date.now() % 1e9, difficulty: 'medium' });
    if (!res) { app.toast({ icon: '⚠️', title: 'Generation failed' }); return; }
    pushHistory();
    const lv = res.level;
    def.width = lv.width; def.height = lv.height; def.openEdges = false;
    def.types = Uint8Array.from(lv.types); def.params = Uint8Array.from(lv.params);
    def.start = { ...lv.start }; def.entities = [];
    rebuild();
    app.toast({ icon: '🎲', title: 'Random level loaded', desc: 'Tweak it and make it yours.' });
  }

  function share() {
    const code = encodeLevel(toBuildDef());
    const ta = el('textarea', { className: 'card', value: code, readOnly: true, style: { width: '100%', minHeight: '90px', resize: 'none', color: 'var(--text)', background: 'var(--surface-2)' } });
    const body = el('div', { className: 'stack' }, [el('p', { className: 'muted', text: 'Copy this code to share your level.' }), ta]);
    showModal({ title: 'Share level', body, actions: [
      { label: 'Copy', variant: 'primary', keep: true, onClick: () => { ta.select(); navigator.clipboard?.writeText(code); app.toast({ icon: '📋', title: 'Copied' }); } },
      { label: 'Close', variant: 'ghost' },
    ] });
  }

  function importCode() {
    const ta = el('textarea', { className: 'card', placeholder: 'Paste an AE1 level code…', style: { width: '100%', minHeight: '90px', resize: 'none', color: 'var(--text)', background: 'var(--surface-2)' } });
    const body = el('div', { className: 'stack' }, [ta]);
    showModal({ title: 'Import level', body, actions: [
      { label: 'Import', variant: 'primary', onClick: () => {
        try {
          const imported = decodeLevel(ta.value.trim());
          pushHistory();
          def.width = imported.width; def.height = imported.height; def.openEdges = imported.openEdges;
          def.types = imported.types; def.params = imported.params; def.start = imported.start;
          def.entities = imported.entities; def.name = imported.name;
          rebuild();
          app.toast({ icon: '✅', title: 'Level imported' });
        } catch (err) {
          app.toast({ icon: '❌', title: 'Invalid code', desc: String(err.message || err) });
        }
      } },
      { label: 'Cancel', variant: 'ghost' },
    ] });
  }

  function save() {
    if (!solve(createLevel(toBuildDef())).solvable) { app.toast({ icon: '⚠️', title: 'Make it solvable before saving' }); return; }
    const saved = { ...toBuildDef(), id: def.id, types: Array.from(def.types), params: Array.from(def.params), name: def.name || 'My Level' };
    repo.registerCustom(saved);
    app.toast({ icon: '💾', title: 'Saved to My Levels' });
  }

  // --- Palette -----------------------------------------------------------
  function buildPalette() {
    const grid = el('div', { className: 'palette-grid' });
    for (const t of TOOLS) {
      const item = el('button', {
        className: `palette-item ${t.key === tool ? 'is-on' : ''}`.trim(),
        title: t.label,
        dataset: { tool: t.key },
        onClick: () => { tool = t.key; for (const c of grid.children) c.classList.toggle('is-on', c.dataset.tool === tool); updateVariantGlyph(); },
      }, [el('span', { text: t.icon }), el('small', { text: t.label })]);
      grid.appendChild(item);
    }
    return el('div', { className: 'editor__palette' }, [
      el('div', { className: 'field__label', text: 'Tiles' }),
      grid,
      el('p', { className: 'field__hint', text: 'Tap a tool, then paint on the board. Tap a placed arrow again to rotate it.' }),
    ]);
  }

  // --- Pointer -----------------------------------------------------------
  function onPointerDown(e) {
    const { x, y } = renderer.pickCell(e.clientX, e.clientY);
    pushHistory();
    painting = true;
    applyAt(x, y);
  }
  function onPointerMove(e) {
    if (!painting) return;
    const { x, y } = renderer.pickCell(e.clientX, e.clientY);
    applyAt(x, y);
  }
  function onPointerUp() { painting = false; }
  function onKey(e) { if (e.code === 'KeyR' && !e.ctrlKey && !e.metaKey) cycleVariant(); }

  return {
    el: root,
    onEnter() {
      renderer.start();
      renderer.setReducedMotion(true);
      rebuild();
      renderer.resize();
      canvas.addEventListener('pointerdown', onPointerDown);
      window.addEventListener('pointermove', onPointerMove);
      window.addEventListener('pointerup', onPointerUp);
      document.addEventListener('keydown', onKey);
      updateVariantGlyph();
    },
    destroy() {
      renderer.stop();
      canvas.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      document.removeEventListener('keydown', onKey);
    },
  };
}

function blankDef(w, h) {
  const size = w * h;
  const types = new Uint8Array(size);
  return {
    id: `custom-${Math.random().toString(36).slice(2, 8)}`,
    name: 'My Level',
    width: w,
    height: h,
    openEdges: false,
    types,
    params: new Uint8Array(size),
    start: { x: 0, y: 0 },
    entities: [],
  };
}
