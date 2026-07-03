/**
 * dom.js — Minimal element-creation helpers.
 *
 * `el(tag, props, children)` keeps screen code declarative without a framework.
 * Text content is always set via textContent (never innerHTML) so user-provided
 * strings — level names, imported data — cannot inject markup.
 */

/**
 * @param {string} tag
 * @param {Object} [props]  className, text, attrs, dataset, style, aria, on*
 * @param {Array|Node|string} [children]
 * @returns {HTMLElement}
 */
export function el(tag, props = {}, children = []) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(props)) {
    if (value == null) continue;
    if (key === 'className') node.className = value;
    else if (key === 'text') node.textContent = value;
    else if (key === 'html') node.innerHTML = value; // callers pass only trusted static markup
    else if (key === 'dataset') Object.assign(node.dataset, value);
    else if (key === 'style') Object.assign(node.style, value);
    else if (key === 'attrs') for (const [a, v] of Object.entries(value)) node.setAttribute(a, v);
    else if (key.startsWith('on') && typeof value === 'function') {
      node.addEventListener(key.slice(2).toLowerCase(), value);
    } else if (key in node) {
      node[key] = value;
    } else {
      node.setAttribute(key, value);
    }
  }
  appendChildren(node, children);
  return node;
}

export function appendChildren(node, children) {
  const list = Array.isArray(children) ? children : [children];
  for (const child of list) {
    if (child == null || child === false) continue;
    node.appendChild(typeof child === 'string' || typeof child === 'number' ? document.createTextNode(String(child)) : child);
  }
}

export function clear(node) {
  while (node.firstChild) node.removeChild(node.firstChild);
}

/** A star row element, `filled` of `max` lit. */
export function starsRow(filled, max = 3, extraClass = '') {
  const row = el('div', { className: `stars ${extraClass}`.trim(), attrs: { 'aria-label': `${filled} of ${max} stars` } });
  for (let i = 0; i < max; i++) {
    row.appendChild(el('span', { className: i < filled ? 'on' : '', text: '★', attrs: { 'aria-hidden': 'true' } }));
  }
  return row;
}
