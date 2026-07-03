/**
 * basic.js — The non-gameplay screens: menu, level select, settings, statistics,
 * achievements, help, and credits. Each is a factory `(app, params) => instance`.
 */
import { el, starsRow, clear } from '../dom.js';
import { showModal } from '../components.js';
import { THEMES } from '../../config/themes.js';
import { DIFFICULTY_ORDER } from '../../core/Constants.js';
import { formatTime } from '../../core/utils.js';

/* ------------------------------------------------------------------ shells */

function iconBtn(glyph, label, onClick, extra = '') {
  return el('button', {
    className: `btn btn--icon btn--ghost ${extra}`.trim(),
    text: glyph,
    attrs: { 'aria-label': label, title: label },
    onClick,
  });
}

function topbar(app, title) {
  return el('div', { className: 'topbar' }, [
    iconBtn('‹', 'Back', () => app.back()),
    el('h1', { className: 'topbar__title', text: title }),
    el('div', { className: 'topbar__spacer' }),
  ]);
}

function shell(...parts) {
  const root = el('div', {}, parts);
  return root;
}

function scroll(container) {
  return el('div', { className: 'screen__scroll' }, [el('div', { className: 'container' }, [container])]);
}

function field(label, control, hint) {
  return el('div', { className: 'field' }, [
    el('div', {}, [
      el('div', { className: 'field__label', text: label }),
      hint && el('div', { className: 'field__hint', text: hint }),
    ]),
    control,
  ]);
}

function switchControl(checked, onChange) {
  const btn = el('button', {
    className: 'switch',
    attrs: { role: 'switch', 'aria-checked': String(!!checked) },
    onClick: () => {
      const next = btn.getAttribute('aria-checked') !== 'true';
      btn.setAttribute('aria-checked', String(next));
      onChange(next);
    },
  });
  return btn;
}

function segmented(options, value, onChange) {
  const wrap = el('div', { className: 'segmented', attrs: { role: 'group' } });
  for (const opt of options) {
    wrap.appendChild(
      el('button', {
        className: opt.value === value ? 'is-on' : '',
        text: opt.label,
        onClick: () => {
          for (const b of wrap.children) b.classList.remove('is-on');
          wrap.querySelector(`[data-v="${opt.value}"]`)?.classList.add('is-on');
          onChange(opt.value);
        },
        dataset: { v: String(opt.value) },
      }),
    );
  }
  return wrap;
}

/* -------------------------------------------------------------------- menu */

export function menuScreen(app) {
  const { repo, stats } = app.services;
  const total = repo.totalStars();
  const max = repo.maxStars();

  const btn = (label, icon, onClick, cls = '') =>
    el('button', { className: `btn ${cls}`.trim(), onClick }, [
      icon && el('span', { text: icon, attrs: { 'aria-hidden': 'true' } }),
      el('span', { text: label }),
    ]);

  const content = el('div', { className: 'stack center', style: { alignItems: 'center' } }, [
    el('div', { className: 'brand' }, [
      el('div', { className: 'brand__logo', text: 'Arrow Escape' }),
      el('div', { className: 'brand__tagline', text: 'Slide. Obey every arrow. Reach the exit.' }),
    ]),
    el('div', { className: 'menu' }, [
      btn('Play', '▶', () => app.navigate('levelSelect'), 'btn--primary btn--lg'),
      el('div', { className: 'menu-grid' }, [
        btn('Daily', '📅', () => app.startDaily()),
        btn('Endless', '♾️', () => app.startEndless()),
        btn('Editor', '🛠️', () => app.navigate('editor')),
        btn('Stats', '📊', () => app.navigate('stats')),
        btn('Achievements', '🏆', () => app.navigate('achievements')),
        btn('Settings', '⚙️', () => app.navigate('settings')),
      ]),
      el('div', { className: 'row', style: { justifyContent: 'center', gap: 'var(--sp-3)' } }, [
        el('button', { className: 'btn btn--ghost', text: 'How to play', onClick: () => app.navigate('help') }),
        el('button', { className: 'btn btn--ghost', text: 'Credits', onClick: () => app.navigate('credits') }),
      ]),
    ]),
    el('div', { className: 'menu-progress' }, [
      el('span', { text: '★', className: 'on', style: { color: 'var(--star)' } }),
      el('span', { text: `${total} / ${max} stars`, className: 'tnum' }),
      el('span', { text: '·' }),
      el('span', { text: `${stats.levelsCompleted} levels cleared` }),
    ]),
  ]);

  const el0 = shell(scroll(content));
  el0.classList.add('menu-screen');
  return { el: el0 };
}

/* ------------------------------------------------------------- level select */

export function levelSelectScreen(app) {
  const { repo } = app.services;
  const worlds = repo.campaign();
  const list = el('div', { className: 'stack', style: { width: '100%' } });

  for (const world of worlds) {
    const grid = el('div', { className: 'level-grid' });
    for (const lvl of world.levels) {
      if (!lvl.unlocked) {
        grid.appendChild(el('div', { className: 'level-tile is-locked' }, [el('div', { className: 'level-tile__lock', text: '🔒' })]));
        continue;
      }
      const tile = el('button', {
        className: `level-tile ${lvl.completed ? 'is-completed' : ''}`.trim(),
        onClick: () => app.navigate('game', { levelId: lvl.id, mode: 'campaign' }),
        attrs: { 'aria-label': `Level ${lvl.index + 1}: ${lvl.name}` },
      }, [
        el('div', { className: 'level-tile__num', text: String(lvl.index + 1) }),
        starsRow(lvl.stars),
      ]);
      grid.appendChild(tile);
    }
    const w = el('div', { className: `world ${world.unlocked ? '' : 'is-locked'}`.trim() }, [
      el('div', { className: 'world__head' }, [
        el('div', { className: 'world__name', text: world.name }),
        el('div', { className: 'row' }, [starsRow(0, 0), el('span', { className: 'muted tnum', text: `${world.stars}/${world.maxStars} ★` })]),
      ]),
      world.unlocked ? grid : el('div', { className: 'muted', text: 'Clear more of the previous world to unlock.' }),
    ]);
    list.appendChild(w);
  }

  return { el: shell(topbar(app, 'Select Level'), scroll(list)) };
}

/* ---------------------------------------------------------------- settings */

export function settingsScreen(app) {
  const { settings } = app.services;
  const panel = el('div', { className: 'panel stack' });

  panel.appendChild(field('Theme',
    segmented(THEMES.map((t) => ({ value: t.id, label: t.label })), settings.get('theme'), (v) => { settings.set('theme', v); app.applySettings(); }),
    'Cosmetic only — never changes the puzzle.'));

  panel.appendChild(field('Motion',
    segmented([{ value: 'auto', label: 'Auto' }, { value: 'on', label: 'Full' }, { value: 'off', label: 'Reduced' }], settings.get('reducedMotion'), (v) => { settings.set('reducedMotion', v); app.applySettings(); }),
    'Reduce animation and particles.'));

  panel.appendChild(field('Colorblind palette',
    segmented([{ value: 'none', label: 'Off' }, { value: 'deuter', label: 'High-contrast' }], settings.get('colorblind'), (v) => { settings.set('colorblind', v); app.applySettings(); })));

  panel.appendChild(field('High contrast UI', switchControl(settings.get('highContrast'), (v) => { settings.set('highContrast', v); app.applySettings(); })));
  panel.appendChild(field('Sound effects', switchControl(settings.get('sound'), (v) => { settings.set('sound', v); app.applySettings(); })));
  panel.appendChild(field('Ambient music', switchControl(settings.get('music'), (v) => { settings.set('music', v); app.applySettings(); })));
  panel.appendChild(field('Haptics (mobile)', switchControl(settings.get('haptics'), (v) => settings.set('haptics', v))));
  panel.appendChild(field('Show timer', switchControl(settings.get('showTimer'), (v) => settings.set('showTimer', v))));
  panel.appendChild(field('Confirm before restart', switchControl(settings.get('confirmReset'), (v) => settings.set('confirmReset', v))));

  const data = el('div', { className: 'panel stack', style: { marginTop: 'var(--sp-4)' } }, [
    el('div', { className: 'field__label', text: 'Data' }),
    el('div', { className: 'row wrap', style: { gap: 'var(--sp-3)' } }, [
      el('button', { className: 'btn', text: 'Export profile', onClick: () => app.exportProfile() }),
      el('button', { className: 'btn', text: 'Import profile', onClick: () => app.importProfile() }),
      el('button', { className: 'btn btn--danger', text: 'Reset progress', onClick: () => app.confirmReset() }),
    ]),
  ]);

  return { el: shell(topbar(app, 'Settings'), scroll(el('div', {}, [panel, data]))) };
}

/* -------------------------------------------------------------- statistics */

export function statsScreen(app) {
  const { stats, repo, achievements } = app.services;
  const s = stats.snapshot();
  const items = [
    ['Levels cleared', s.levelsCompleted],
    ['Total stars', `${repo.totalStars()} / ${repo.maxStars()}`],
    ['Three-star wins', s.threeStars],
    ['Total moves', s.totalMoves],
    ['Time played', formatTime(s.totalTimeMs)],
    ['Hints used', s.hintsUsed],
    ['Gems collected', s.gems],
    ['Best streak', s.bestStreak],
    ['Achievements', `${achievements.count} / ${achievements.total}`],
  ];
  const grid = el('div', { className: 'stat-grid' });
  for (const [label, value] of items) {
    grid.appendChild(el('div', { className: 'card stat' }, [
      el('div', { className: 'stat__value tnum', text: String(value) }),
      el('div', { className: 'stat__label', text: label }),
    ]));
  }
  return { el: shell(topbar(app, 'Statistics'), scroll(grid)) };
}

/* ------------------------------------------------------------ achievements */

export function achievementsScreen(app) {
  const list = el('div', { className: 'stack' });
  for (const a of app.services.achievements.list()) {
    list.appendChild(el('div', { className: `card achv ${a.unlocked ? '' : 'is-locked'}`.trim() }, [
      el('div', { className: 'achv__icon', text: a.icon }),
      el('div', { className: 'grow' }, [
        el('div', { className: 'achv__name', text: a.name }),
        el('div', { className: 'achv__desc', text: a.description }),
      ]),
      el('div', { text: a.unlocked ? '✅' : '🔒' }),
    ]));
  }
  return { el: shell(topbar(app, 'Achievements'), scroll(list)) };
}

/* --------------------------------------------------------------- help/info */

export function helpScreen(app) {
  const prose = el('div', { className: 'prose' }, [
    el('h2', { text: 'How to play' }),
    el('p', { text: 'Launch your token in a direction. It slides until it hits a wall, a stop pad, or the board edge. Every arrow it crosses redirects it — you must obey them all. Reach the glowing exit to win.' }),
    el('p', { text: 'Beat the par move count and grab any gems to earn all three stars. Undo, restart, and hint are always available.' }),
    el('h2', { text: 'Controls' }),
    el('ul', {}, [
      el('li', { text: 'Desktop: arrow keys or WASD to launch; U undo, R restart, H hint, Esc pause.' }),
      el('li', { text: 'Touch: swipe to launch; use the on-screen buttons for undo, restart, and hint.' }),
    ]),
    el('h2', { text: 'Tile legend' }),
    el('div', { className: 'legend' }, [
      ['→', 'Arrow — redirects you'],
      ['◹', 'Mirror — reflects you'],
      ['◎', 'Stop pad — halts your slide'],
      ['◉', 'Exit — the real goal'],
      ['⊘', 'Fake exit — only stops you'],
      ['⬛', 'Wall — blocks and stops'],
      ['❄', 'Ice — skid past the next arrow'],
      ['◆', 'Gem — optional, for 3 stars'],
    ].map(([k, v]) => el('div', { className: 'legend__item' }, [el('div', { className: 'legend__key', text: k }), el('div', { text: v })]))),
  ]);
  return { el: shell(topbar(app, 'How to Play'), scroll(prose)) };
}

export function creditsScreen(app) {
  const prose = el('div', { className: 'prose center' }, [
    el('h2', { text: 'Arrow Escape' }),
    el('p', { text: 'An open-source puzzle game built with vanilla HTML, CSS, and JavaScript — no frameworks, no dependencies.' }),
    el('p', { text: 'Design, engineering, level design, and art direction by the Arrow Escape contributors.' }),
    el('p', { text: 'Released under the MIT License. Contributions welcome.' }),
    el('p', { className: 'muted', text: `${DIFFICULTY_ORDER.length} difficulty tiers · solver-verified levels · offline ready` }),
  ]);
  return { el: shell(topbar(app, 'Credits'), scroll(prose)) };
}

// Re-export a difficulty picker used by Endless mode.
export function pickDifficulty(onPick) {
  const body = el('div', { className: 'stack' });
  for (const d of ['easy', 'medium', 'hard', 'expert', 'master']) {
    body.appendChild(el('button', {
      className: 'btn btn--block',
      text: d[0].toUpperCase() + d.slice(1),
      onClick: () => { close(); onPick(d); },
    }));
  }
  const close = showModal({ title: 'Endless — pick a difficulty', body, actions: [{ label: 'Cancel', variant: 'ghost' }] });
}

export { clear };
