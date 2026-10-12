import { applyTheme } from './themes.js';
// DOM UI layer: an overlay div over the canvas with small HUD/menu primitives. Themed via CSS variables (Nord palette).
// Every create function returns a handle { el, remove(), ...setters }. Works without a DOM only for tests that inject `doc`.
export const THEME_CSS = `
.nord-ui{position:absolute;inset:0;pointer-events:none;font-family:var(--nord-font-ui,Inter,system-ui,sans-serif);color:var(--nord-fg,#eceff4);user-select:none;-webkit-user-select:none}
.nord-ui *{box-sizing:border-box}
.nord-ui .nord-screen{position:absolute;inset:0;display:none;pointer-events:none}
.nord-ui .nord-screen.show{display:block}
.nord-ui .nord-el{position:absolute;pointer-events:auto}
.nord-ui .nord-panel{background:var(--nord-panel,#3b4252);border:1px solid var(--nord-border,#4c566a);border-radius:8px;padding:12px;box-shadow:0 4px 16px #0006}
.nord-ui .nord-label{pointer-events:none;text-shadow:0 1px 3px #000a;white-space:pre}
.nord-ui .nord-button{background:var(--nord-accent,#88c0d0);color:var(--nord-bg,#2e3440);border:0;border-radius:6px;padding:8px 16px;font:600 16px var(--nord-font-ui,Inter,system-ui,sans-serif);cursor:pointer}
.nord-ui .nord-button:hover{filter:brightness(1.1)}.nord-ui .nord-button:active{transform:translateY(1px)}
.nord-ui .nord-bar{background:var(--nord-bg,#2e3440);border:1px solid var(--nord-border,#4c566a);border-radius:4px;overflow:hidden;height:16px;width:160px}
.nord-ui .nord-bar>i{display:block;height:100%;width:100%;background:var(--nord-good,#a3be8c);transform-origin:left;transition:transform .08s linear}
.nord-ui .nord-image{pointer-events:none;image-rendering:auto}
`;

const POS = { tl: ['left', 'top'], tr: ['right', 'top'], bl: ['left', 'bottom'], br: ['right', 'bottom'] };

export class UI {
  constructor(container, { doc = globalThis.document, onSound = null, skin, theme, fontBase = '/vendor/fonts' } = {}) {
    this.doc = doc;
    this.onSound = onSound;
    this.screens = new Map();
    this.root = doc.createElement('div');
    this.root.className = 'nord-ui';
    const style = doc.createElement('style');
    style.textContent = THEME_CSS;
    this.root.appendChild(style);
    container.appendChild(this.root);
    if (doc.head && doc.documentElement) applyTheme(this.root, { skin, theme, base: fontBase, storage: null }); // fonts + --nord-* vars from the project's ui.skin/ui.theme
    this.hud = this.screen('hud');
    this.hud.classList.add('show');
  }
  screen(name) {
    if (!this.screens.has(name)) {
      const s = this.doc.createElement('div');
      s.className = 'nord-screen'; s.dataset.screen = name;
      this.root.appendChild(s); this.screens.set(name, s);
    }
    return this.screens.get(name);
  }
  show(name) { this.screen(name).classList.add('show'); }
  hide(name) { this.screens.get(name)?.classList.remove('show'); }
  toggle(name) { this.screen(name).classList.toggle('show'); }
  isShown(name) { return !!this.screens.get(name)?.classList.contains('show'); }
  /** Replace theme variables, e.g. ui.theme({ accent: '#ebcb8b' }). */
  /** Switch skin/theme at runtime: ui.setTheme({ theme: 'dracula', skin: 'cyber' }). */
  setTheme(o) { return applyTheme(this.root, { ...o, storage: null }); }
  /** Override individual variables, e.g. ui.theme({ accent: '#ebcb8b' }). */
  theme(vars) { for (const [k, v] of Object.entries(vars)) this.root.style.setProperty(`--nord-${k}`, v); }

  #place(el, { x, y, anchor = 'tl', w, h, style } = {}) {
    el.classList.add('nord-el');
    const [hx, vy] = POS[anchor] ?? POS.tl;
    if (x !== undefined || y !== undefined) { el.style[hx] = `${x ?? 0}px`; el.style[vy] = `${y ?? 0}px`; }
    if (w) el.style.width = `${w}px`;
    if (h) el.style.height = `${h}px`;
    if (style) Object.assign(el.style, style);
  }
  #add(screen, el, o) {
    this.#place(el, o);
    this.screen(screen ?? o?.screen ?? 'hud').appendChild(el);
    return { el, remove: () => el.remove() };
  }
  panel(o = {}) { const el = this.doc.createElement('div'); el.className = 'nord-panel'; return this.#add(o.screen, el, o); }
  label(text = '', o = {}) {
    const el = this.doc.createElement('div'); el.className = 'nord-label';
    el.style.fontSize = `${o.size ?? 20}px`; if (o.color) el.style.color = o.color;
    el.textContent = text;
    const h = this.#add(o.screen, el, o);
    h.set = (t) => { el.textContent = String(t); return h; };
    return h;
  }
  button(text, onClick, o = {}) {
    const el = this.doc.createElement('button'); el.className = 'nord-button'; el.textContent = text;
    el.addEventListener('click', (ev) => { this.onSound?.('click'); onClick?.(ev); });
    el.addEventListener('mouseenter', () => this.onSound?.('hover'));
    return this.#add(o.screen, el, o);
  }
  image(src, o = {}) { const el = this.doc.createElement('img'); el.className = 'nord-image'; el.src = src; return this.#add(o.screen, el, o); }
  /** Progress bar; bar.set(0..1). */
  bar(value = 1, o = {}) {
    const el = this.doc.createElement('div'); el.className = 'nord-bar';
    const fill = this.doc.createElement('i'); el.appendChild(fill);
    if (o.color) fill.style.background = o.color;
    const h = this.#add(o.screen, el, o);
    h.set = (v) => { fill.style.transform = `scaleX(${Math.min(1, Math.max(0, v))})`; h.value = v; return h; };
    return h.set(value);
  }
  /** Convenience: vertical menu of buttons. items: [{text, onClick}] */
  menu(screen, items, { x = 0, y = 0, gap = 12 } = {}) {
    const box = this.doc.createElement('div');
    box.style.cssText = 'display:flex;flex-direction:column;gap:' + gap + 'px';
    const h = this.#add(screen, box, { x, y });
    for (const it of items) {
      const b = this.button(it.text, it.onClick, { screen });
      box.appendChild(b.el); b.el.classList.remove('nord-el');
    }
    return h;
  }
  clear(screen) { const s = this.screens.get(screen); if (s) for (const c of [...s.children]) c.remove(); }
  destroy() { this.root.remove(); this.screens.clear(); }
}
