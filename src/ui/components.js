/**
 * components.js — Shared overlay UI: toasts and modal dialogs.
 */
import { el, clear } from './dom.js';

/** A host that stacks transient toast notifications. */
export class ToastHost {
  constructor() {
    this.el = el('div', { className: 'toast-host', attrs: { 'aria-live': 'polite', role: 'status' } });
  }

  show({ icon = '✨', title = '', desc = '', timeout = 3200 } = {}) {
    const node = el('div', { className: 'toast' }, [
      icon && el('div', { className: 'toast__icon', text: icon, attrs: { 'aria-hidden': 'true' } }),
      el('div', {}, [
        el('div', { className: 'toast__title', text: title }),
        desc && el('div', { className: 'toast__desc', text: desc }),
      ]),
    ]);
    this.el.appendChild(node);
    const remove = () => {
      node.style.animation = 'toast-out var(--t-med) var(--ease-in-out) forwards';
      setTimeout(() => node.remove(), 260);
    };
    if (timeout) setTimeout(remove, timeout);
    node.addEventListener('click', remove);
    return remove;
  }
}

/**
 * Show a modal dialog. Returns a `close()` function.
 * @param {Object} opts { title, body, actions:[{label,variant,onClick,keep}], onClose, dismissable }
 */
export function showModal({ title = '', body = '', actions = [], onClose, dismissable = true, className = '' } = {}) {
  const overlay = el('div', { className: 'overlay', attrs: { role: 'dialog', 'aria-modal': 'true' } });
  const modal = el('div', { className: `modal ${className}`.trim() });
  overlay.appendChild(modal);

  if (title) modal.appendChild(el('h2', { className: 'modal__title', text: title }));
  if (body) {
    const bodyNode = typeof body === 'string' ? el('div', { className: 'modal__body', text: body }) : body;
    if (typeof body !== 'string') bodyNode.classList.add('modal__body');
    modal.appendChild(bodyNode);
  }

  const close = () => {
    overlay.classList.remove('is-open');
    setTimeout(() => overlay.remove(), 260);
    document.removeEventListener('keydown', onKey);
    onClose?.();
  };

  const actionsRow = el('div', { className: 'modal__actions' });
  for (const a of actions) {
    actionsRow.appendChild(
      el('button', {
        className: `btn ${a.variant ? `btn--${a.variant}` : ''}`.trim(),
        text: a.label,
        onClick: () => {
          a.onClick?.();
          if (!a.keep) close();
        },
      }),
    );
  }
  if (actions.length) modal.appendChild(actionsRow);

  const onKey = (e) => {
    if (e.key === 'Escape' && dismissable) close();
  };
  document.addEventListener('keydown', onKey);
  if (dismissable) {
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) close();
    });
  }

  document.body.appendChild(overlay);
  requestAnimationFrame(() => overlay.classList.add('is-open'));
  return close;
}

/** Replace the children of `node` with `children`. */
export function render(node, ...children) {
  clear(node);
  for (const c of children) if (c) node.appendChild(c);
  return node;
}
