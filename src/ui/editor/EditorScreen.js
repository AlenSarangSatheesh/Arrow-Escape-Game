/**
 * EditorScreen.js — Placeholder mounted while the full level editor is wired up.
 * The complete editor (draw/erase, entities, validate, play, share) replaces this
 * factory in the editor milestone.
 */
import { el } from '../dom.js';

export function editorScreen(app) {
  const back = el('button', { className: 'btn btn--icon btn--ghost', text: '‹', attrs: { 'aria-label': 'Back' }, onClick: () => app.back() });
  const body = el('div', { className: 'screen__scroll' }, [
    el('div', { className: 'container center stack' }, [
      el('h2', { text: 'Level Editor' }),
      el('p', { className: 'muted', text: 'The editor is being assembled.' }),
    ]),
  ]);
  return { el: el('div', {}, [el('div', { className: 'topbar' }, [back, el('h1', { className: 'topbar__title', text: 'Editor' }), el('div', { className: 'topbar__spacer' })]), body]) };
}
