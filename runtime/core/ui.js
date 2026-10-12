// DOM UI layer: absolutely-positioned overlay over the canvas with HUD/menu primitives, themed by CSS variables.
// `doc` is injectable for tests.
export const UI_CSS = `
.nord-ui{position:absolute;inset:0;pointer-events:none;font-family:var(--nord-font,system-ui,sans-serif);color:var(--nord-fg,#e8ecf4);user-select:none}
.nord-ui>*{pointer-events:auto}
.nord-ui .nord-screen{position:absolute;inset:0;pointer-events:none}.nord-ui .nord-screen>*{pointer-events:auto}
.nord-ui .nord-panel{position:absolute;background:var(--nord-panel,#1b2233e6);border:1px solid var(--nord-border,#3a4560);border-radius:var(--nord-radius,8px);padding:12px}
.nord-ui .nord-label{position:absolute;white-space:pre}
.nord-ui .nord-button{position:absolute;background:var(--nord-accent,#4c8dff);color:#fff;border:0;border-radius:var(--nord-radius,8px);padding:8px 16px;font:inherit;cursor:pointer}
.nord-ui .nord-button:hover{filter:brightness(1.15)}.nord-ui .nord-button:active{transform:translateY(1px)}
.nord-ui .nord-bar{position:absolute;background:var(--nord-bar-bg,#0008);border-radius:4px;overflow:hidden;height:14px;width:160px}
.nord-ui .nord-bar>i{display:block;height:100%;width:100%;background:var(--nord-bar-fg,#46d36b);transform-origin:left;transition:transform .1s}
.nord-ui .nord-image{position:absolute}
`;

export class UI {
  constructor(game, { doc = globalThis.document, parent } = {}) {
    this.game = game; this.doc = doc; this.screens = new Map(); this.root = null;
    if (!doc) return;
    if (!doc.getElementById?.('nord-ui-style')) {
      const s = doc.createElement('style'); s.id = 'nord-ui-style'; s.textContent = UI_CSS; doc.head?.appendChild(s);
    }
    this.root = doc.createElement('div'); this.root.className = 'nord-ui';
    (parent ?? doc.body).appendChild(this.root);
  }
  /** Create (or fetch) a named screen, e.g. 'hud', 'pause'. Hidden until show(). */
  screen(name) {
    let s = this.screens.get(name);
    if (!s) {
      const el = this.doc.createElement('div'); el.className = 'nord-screen'; el.dataset.screen = name; el.style.display = 'none';
      this.root.appendChild(el); s = { name, el }; this.screens.set(name, s);
    }
    return s;
  }
  show(name) { this.screen(name).el.style.display = ''; this.game.events.emit('uiShow', name); }
  hide(name) { const s = this.screens.get(name); if (s) { s.el.style.display = 'none'; this.game.events.emit('uiHide', name); } }
  toggle(name) { const s = this.screen(name); s.el.style.display === 'none' ? this.show(name) : this.hide(name); }
  clear(name) { const s = this.screens.get(name); if (s) s.el.replaceChildren?.() ?? (s.el.innerHTML = ''); }
  _add(screen, tag, cls, { x, y, w, h, style } = {}) {
    const el = this.doc.createElement(tag); el.className = cls;
    if (x !== undefined) el.style.left = typeof x === 'number' ? `${x}px` : x;
    if (y !== undefined) el.style.top = typeof y === 'number' ? `${y}px` : y;
    if (w !== undefined) el.style.width = typeof w === 'number' ? `${w}px` : w;
    if (h !== undefined) el.style.height = typeof h === 'number' ? `${h}px` : h;
    if (style) Object.assign(el.style, style);
    this.screen(screen).el.appendChild(el);
    return el;
  }
  panel(screen, o = {}) { return this._add(screen, 'div', 'nord-panel', o); }
  label(screen, text, o = {}) { const el = this._add(screen, 'div', 'nord-label', o); el.textContent = text; return Object.assign(el, { set: (t) => { el.textContent = t; } }); }
  button(screen, text, onClick, o = {}) {
    const el = this._add(screen, 'button', 'nord-button', o); el.textContent = text;
    el.addEventListener('click', (e) => { try { onClick?.(e); } catch (err) { this.game.reportError(err, null, 'ui.button'); } });
    return el;
  }
  image(screen, src, o = {}) { const el = this._add(screen, 'img', 'nord-image', o); el.src = src; return el; }
  /** Progress bar; returned element has set(fraction 0..1). */
  bar(screen, value = 1, o = {}) {
    const el = this._add(screen, 'div', 'nord-bar', o); const fill = this.doc.createElement('i'); el.appendChild(fill);
    el.set = (v) => { fill.style.transform = `scaleX(${Math.min(1, Math.max(0, v))})`; };
    el.set(value); return el;
  }
  destroy() { this.root?.remove?.(); this.screens.clear(); }
}
