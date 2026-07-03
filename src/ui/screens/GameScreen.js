/**
 * GameScreen.js — The playable board screen.
 *
 * Owns a per-session Renderer, InputManager, and GameController, wires them to a
 * presenter, renders the HUD, and manages the pause / win / soft-fail overlays.
 * All engine mutation goes through the controller; this screen only reacts to
 * events and forwards user intents.
 */
import { el, starsRow, clear } from '../dom.js';
import { showModal } from '../components.js';
import { Renderer } from '../../render/Renderer.js';
import { InputManager } from '../../input/InputManager.js';
import { GameController } from '../../game/GameController.js';
import { Events } from '../../core/EventBus.js';
import { formatTime } from '../../core/utils.js';

export function gameScreen(app, params = {}) {
  const { bus, repo, audio, settings, stats, achievements } = app.services;

  const level = params.level || repo.getLevel(params.levelId);
  const mode = params.mode || 'campaign';

  // --- DOM ---------------------------------------------------------------
  const canvas = el('canvas', { id: 'board-canvas', attrs: { 'aria-label': 'Puzzle board' } });
  const coach = level?.intro || params.intro ? el('div', { className: 'coach', text: level?.intro || params.intro }) : null;
  const dpad = buildDpad((dir) => controller.launch(dir));
  const boardWrap = el('div', { className: 'board-wrap' }, [canvas, coach, dpad]);

  const chipMoves = chip('Moves', '0');
  const chipPar = chip('Par', String(level?.par ?? '—'));
  const chipTime = chip('Time', '0:00');
  const chipGems = level && level.lookup.gemCount ? chip('Gems', `0/${level.lookup.gemCount}`) : null;

  const hudTop = el('div', { className: 'hud-top' }, [
    el('button', { className: 'btn btn--icon btn--ghost', text: '‹', attrs: { 'aria-label': 'Back' }, onClick: () => leave() }),
    el('div', { className: 'hud-chips' }, [chipMoves, chipPar, settings.get('showTimer') ? chipTime : null, chipGems].filter(Boolean)),
    el('button', { className: 'btn btn--icon btn--ghost', text: '⏸', attrs: { 'aria-label': 'Pause' }, onClick: () => openPause() }),
  ]);

  const undoBtn = actionBtn('↶', 'Undo', () => controller.undo());
  const hudActions = el('div', { className: 'hud-actions' }, [
    undoBtn,
    actionBtn('↺', 'Restart', () => restart()),
    actionBtn('💡', 'Hint', () => doHint()),
  ]);

  const liveRegion = el('div', { className: 'sr-only', attrs: { 'aria-live': 'assertive' } });

  const root = el('div', {}, [hudTop, boardWrap, hudActions, liveRegion]);

  // --- Engine wiring -----------------------------------------------------
  const renderer = new Renderer(canvas);
  renderer.setReducedMotion(settings.reducedMotionActive());

  const presenter = {
    setLevel: (lv) => renderer.setLevel(lv),
    setState: (st) => renderer.setState(st),
    animateMove: (path, opts) => renderer.animateMove(path, opts),
    setHint: (dir) => renderer.setHint(dir),
    clearHint: () => renderer.clearHint(),
    playSound: (name) => {
      if (settings.get('sound')) audio.play(name);
    },
    shake: () => {
      boardWrap.classList.remove('is-shaking');
      void boardWrap.offsetWidth;
      boardWrap.classList.add('is-shaking');
      if (settings.get('haptics') && navigator.vibrate) navigator.vibrate(20);
    },
  };

  const controller = new GameController({ bus, presenter });
  const input = new InputManager({ onLaunch: (dir) => controller.launch(dir), onAction: handleAction });

  let timerId = 0;
  let unsub = [];
  let winShown = false;

  // --- HUD updates -------------------------------------------------------
  function updateHud(status) {
    chipMoves.querySelector('.chip__value').textContent = String(status.moves);
    const over = status.moves > (status.par || Infinity);
    chipMoves.classList.toggle('is-warn', over);
    if (chipGems) chipGems.querySelector('.chip__value').textContent = `${status.gems}/${status.gemTotal}`;
    undoBtn.disabled = !status.canUndo;
  }

  function tickTimer() {
    if (settings.get('showTimer')) chipTime.querySelector('.chip__value').textContent = formatTime(controller.timeMs);
  }

  // --- Actions -----------------------------------------------------------
  function handleAction(name) {
    if (name === 'undo') controller.undo();
    else if (name === 'redo') controller.redo();
    else if (name === 'restart') restart();
    else if (name === 'hint') doHint();
    else if (name === 'pause') openPause();
  }

  function doHint() {
    const d = controller.hint();
    if (d == null) app.toast({ icon: '💡', title: 'No hint available', desc: 'This position cannot reach the exit — try undo.' });
  }

  function restart() {
    if (settings.get('confirmReset') && controller.history?.moveCount > 0) {
      showModal({
        title: 'Restart level?',
        body: 'Your current progress on this level will be reset.',
        actions: [
          { label: 'Cancel', variant: 'ghost' },
          { label: 'Restart', variant: 'danger', onClick: () => controller.restart() },
        ],
      });
    } else {
      controller.restart();
    }
  }

  function leave() {
    if (mode === 'editor' && params.onExit) params.onExit();
    else app.back();
  }

  // --- Overlays ----------------------------------------------------------
  function openPause() {
    controller.pause();
    showModal({
      title: 'Paused',
      body: level?.name || 'Level',
      dismissable: true,
      onClose: () => controller.resume(),
      actions: [
        { label: 'Resume', variant: 'primary' },
        { label: 'Restart', onClick: () => controller.restart() },
        { label: 'Levels', onClick: () => { winShown = true; app.navigate('levelSelect', {}, { replace: true }); } },
        { label: 'Menu', onClick: () => { winShown = true; app.navigate('menu', {}, { root: true }); } },
      ],
    });
  }

  function onWin(payload) {
    if (winShown) return;
    winShown = true;
    // Persist results.
    if (mode === 'campaign') repo.recordResult(level.id, payload);
    stats.recordWin({ ...payload, levelId: level.id });
    if (mode === 'daily') stats.recordMode('daily');
    else if (mode === 'endless') stats.recordMode('endless');
    else if (mode === 'editor') stats.recordMode('editor');
    achievements.evaluate({ stats: stats.snapshot(), repo, lastWin: { ...payload, difficulty: level.difficulty } });
    liveRegion.textContent = `Level complete with ${payload.stars} stars.`;
    for (let i = 0; i < payload.stars; i++) setTimeout(() => presenter.playSound('star'), i * 140);
    showWinOverlay(payload);
  }

  function showWinOverlay(payload) {
    const overlay = el('div', { className: 'overlay', attrs: { role: 'dialog', 'aria-modal': 'true' } });
    const starWrap = el('div', { className: 'complete__stars' });
    for (let i = 0; i < 3; i++) starWrap.appendChild(el('div', { className: `star ${i < payload.stars ? 'on' : ''}`.trim(), text: '★' }));

    const nextId = mode === 'campaign' ? repo.nextLevelId(level.id) : null;
    const results = el('div', { style: { margin: 'var(--sp-4) 0' } }, [
      resultLine('Moves', `${payload.moves} (par ${payload.par})`),
      resultLine('Time', formatTime(payload.timeMs)),
      payload.gemTotal ? resultLine('Gems', `${payload.gemsCollected}/${payload.gemTotal}`) : null,
      resultLine('Score', String(payload.score)),
    ].filter(Boolean));

    const actions = el('div', { className: 'modal__actions' }, [
      el('button', { className: 'btn', text: 'Retry', onClick: () => { overlay.remove(); winShown = false; controller.restart(); } }),
      mode === 'endless'
        ? el('button', { className: 'btn btn--primary', text: 'New puzzle', onClick: () => { overlay.remove(); app.startEndless(level.difficulty); } })
        : mode === 'editor'
          ? el('button', { className: 'btn btn--primary', text: 'Back to editor', onClick: () => { overlay.remove(); leave(); } })
          : nextId
            ? el('button', { className: 'btn btn--primary', text: 'Next level', onClick: () => { overlay.remove(); app.navigate('game', { levelId: nextId, mode: 'campaign' }, { replace: true }); } })
            : el('button', { className: 'btn btn--primary', text: 'Level select', onClick: () => { overlay.remove(); app.navigate('levelSelect', {}, { replace: true }); } }),
    ]);

    const modal = el('div', { className: 'modal' }, [
      el('h2', { className: 'modal__title', text: mode === 'campaign' ? 'Level Complete!' : 'Solved!' }),
      starWrap,
      results,
      actions,
    ]);
    overlay.appendChild(modal);
    document.body.appendChild(overlay);
    requestAnimationFrame(() => overlay.classList.add('is-open'));
  }

  function onFail(payload) {
    const msg = payload.reason === 'dead' ? { icon: '⚡', title: 'Zapped!', desc: 'A hazard got you — that move was undone.' } : { icon: '🕳️', title: 'You fell!', desc: 'That move was undone. Try another route.' };
    app.toast({ ...msg, timeout: 2400 });
    liveRegion.textContent = msg.title;
    if (settings.get('haptics') && navigator.vibrate) navigator.vibrate([10, 40, 10]);
  }

  // --- Lifecycle ---------------------------------------------------------
  return {
    el: root,
    onEnter() {
      app.unlockAudio();
      renderer.start();
      input.attach(boardWrap);
      unsub = [
        bus.on(Events.STATUS, updateHud),
        bus.on(Events.LEVEL_WON, onWin),
        bus.on(Events.LEVEL_FAILED, onFail),
        bus.on(Events.MOVE_APPLIED, () => { if (coach) coach.style.display = 'none'; }),
        // React to live setting changes (theme, reduced motion) mid-session.
        // Deferred so the document theme attribute is applied first.
        bus.on(Events.SETTINGS_CHANGED, () => setTimeout(() => {
          renderer.setReducedMotion(settings.reducedMotionActive());
          renderer.refreshPalette();
          renderer.draw();
        }, 0)),
      ];
      controller.load(level);
      renderer.resize();
      timerId = setInterval(tickTimer, 250);
    },
    onExit() {
      controller.pause();
    },
    destroy() {
      clearInterval(timerId);
      for (const off of unsub) off();
      input.detach();
      renderer.stop();
    },
  };

  // --- small builders ----------------------------------------------------
  function chip(label, value) {
    return el('div', { className: 'chip' }, [
      el('span', { className: 'chip__label', text: label }),
      el('span', { className: 'chip__value tnum', text: value }),
    ]);
  }
  function actionBtn(glyph, label, onClick) {
    return el('button', { className: 'btn btn--icon btn--lg', text: glyph, attrs: { 'aria-label': label, title: label }, onClick });
  }
  function resultLine(label, value) {
    return el('div', { className: 'result-line' }, [el('span', { className: 'muted', text: label }), el('span', { className: 'tnum', text: value })]);
  }
}

function buildDpad(onLaunch) {
  const b = (cls, glyph, dir, label) => el('button', { className: cls, text: glyph, attrs: { 'aria-label': label }, onClick: () => onLaunch(dir) });
  return el('div', { className: 'dpad' }, [
    b('up', '▲', 0, 'Launch up'),
    b('left', '◀', 3, 'Launch left'),
    b('right', '▶', 1, 'Launch right'),
    b('down', '▼', 2, 'Launch down'),
  ]);
}
