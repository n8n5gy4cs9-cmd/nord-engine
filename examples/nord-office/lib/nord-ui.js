// nord-ui — declarative UI scenes. A `.ui.json` file describes a tree of nodes (Godot-style Controls);
// this module turns it into scoped DOM (shadow root, flexbox/grid layout) and gives scripts a tiny API:
//   const ui = createUI(root);  const menu = await ui.load('ui/menu.ui.json');
//   menu.on('start', () => …);  menu.get('score').text = '12';  menu.set('score', 12);
// No dependencies. Standalone (plain HTML projects) or via `game.ui.load(...)`. Spec: docs/UI_SCENES.md
export const UI_VERSION = 1;
export const NODE_TYPES = ['box', 'panel', 'vbox', 'hbox', 'grid', 'center', 'scroll', 'label', 'button', 'image', 'canvas', 'bar', 'slider', 'input', 'checkbox', 'select', 'spacer', 'html', 'instance'];
export const CONTAINERS = new Set(['box', 'panel', 'vbox', 'hbox', 'grid', 'center', 'scroll']);
const ANCHOR = { tl: [0, 0], t: [0.5, 0], tr: [1, 0], l: [0, 0.5], c: [0.5, 0.5], r: [1, 0.5], bl: [0, 1], b: [0.5, 1], br: [1, 1] };

export const UI_CSS = `
:host{all:initial;position:absolute;inset:0;display:block;pointer-events:none;font-family:var(--nord-font-ui,Inter,system-ui,sans-serif);color:var(--nord-fg,#eceff4);font-size:16px;line-height:1.25}
:host(.page){position:relative;inset:auto;pointer-events:auto;font:inherit;color:inherit;line-height:normal}
*{box-sizing:border-box}
.n{pointer-events:auto;position:relative;min-width:0}
.n[hidden]{display:none!important}
.root{position:absolute;inset:0;pointer-events:none}.root>.n{pointer-events:auto}
.root.page{position:static;pointer-events:auto}
.a{position:absolute}.a.fill{inset:0}
.vbox,.hbox,.center{display:flex}.vbox{flex-direction:column}.hbox{flex-direction:row}.center{align-items:center;justify-content:center}
.grid{display:grid}.scroll{overflow:auto}
.image,.canvas{display:block}
.bar>i{display:block;height:100%;transform-origin:left;transform:scaleX(1);transition:transform .08s linear}
.checkbox{display:inline-flex;gap:8px;align-items:center;cursor:pointer}
/* Cosmetic defaults sit at zero specificity (:where), so a project stylesheet always wins. */
:where(.panel){background:var(--nord-panel,#3b4252);border:1px solid var(--nord-border,#4c566a);border-radius:8px;padding:12px;box-shadow:0 4px 16px #0006}
:where(.label){white-space:pre-wrap;text-shadow:0 1px 3px #000a;pointer-events:none}
:where(.page .label){text-shadow:none;pointer-events:auto}
:where(.button){background:var(--nord-accent,#88c0d0);color:var(--nord-bg,#2e3440);border:0;border-radius:6px;padding:8px 16px;font:600 1em var(--nord-font-ui,Inter,system-ui,sans-serif);cursor:pointer}
:where(.button:hover){filter:brightness(1.1)}:where(.button:active){transform:translateY(1px)}
:where(.button:disabled){opacity:.45;cursor:default;filter:none}
:where(.button.on){outline:2px solid var(--nord-fg,#eceff4)}
:where(.bar){background:var(--nord-bg,#2e3440);border:1px solid var(--nord-border,#4c566a);border-radius:4px;overflow:hidden;height:16px;min-width:40px}
:where(.bar>i){background:var(--nord-good,#a3be8c)}
:where(.input,.select){background:var(--nord-bg,#2e3440);color:inherit;border:1px solid var(--nord-border,#4c566a);border-radius:6px;padding:6px 10px;font:inherit}
:where(.slider,.checkbox input){accent-color:var(--nord-accent,#88c0d0)}
`;

const num = (v, u = 'px') => (typeof v === 'number' ? v + u : v);
const box = (m) => (Array.isArray(m) ? m.map((v) => num(v)).join(' ') : num(m));
const FLEX = { start: 'flex-start', end: 'flex-end', center: 'center', stretch: 'stretch', between: 'space-between', around: 'space-around' };

/** Safe rich text: [b] [i] [u] [color=#f00] [size=24] [br] — builds nodes, never innerHTML. */
export function richText(doc, el, src) {
  el.textContent = '';
  if (!src.includes('[')) { el.textContent = src; return; }
  const stack = [el];
  const re = /\[(\/?)(b|i|u|color|size|br)(?:=([^\]]+))?\]/g;
  let last = 0, m;
  const put = (t) => { if (t) stack.at(-1).appendChild(doc.createTextNode(t)); };
  while ((m = re.exec(src))) {
    put(src.slice(last, m.index)); last = re.lastIndex;
    const [, close, tag, arg] = m;
    if (tag === 'br') { stack.at(-1).appendChild(doc.createElement('br')); continue; }
    if (close) { if (stack.length > 1) stack.pop(); continue; }
    const s = doc.createElement('span');
    if (tag === 'b') s.style.fontWeight = '700'; else if (tag === 'i') s.style.fontStyle = 'italic'; else if (tag === 'u') s.style.textDecoration = 'underline';
    else if (tag === 'color' && /^[#\w(),. %-]+$/.test(arg ?? '')) s.style.color = arg;
    else if (tag === 'size') s.style.fontSize = num(Number(arg) || 16);
    stack.at(-1).appendChild(s); stack.push(s);
  }
  put(src.slice(last));
}

/**
 * Canvas scaler (Unity's CanvasScaler): the factor a UI file's `scaler` gives on a w×h host.
 *   constant → `factor` (default 1); scale → log-blend between width and height ratios of `ref` by `match` (0 = width, 1 = height,
 *   default .5); fit → the largest uniform scale that shows all of `ref` (letterboxed).
 */
export function scalerFactor(sc, w, h) {
  if (!sc || !(w > 0) || !(h > 0)) return 1;
  const [rw, rh] = Array.isArray(sc.ref) && sc.ref[0] > 0 && sc.ref[1] > 0 ? sc.ref : [1280, 720];
  if (sc.mode === 'fit') return Math.min(w / rw, h / rh);
  if (sc.mode === 'scale') { const m = Math.min(1, Math.max(0, sc.match ?? 0.5)); return Math.exp((1 - m) * Math.log(w / rw) + m * Math.log(h / rh)); }
  return sc.factor > 0 ? sc.factor : 1;
}

/** Validate a UI file; returns a list of problems (empty = fine). Used by the designer and `nord check`. */
export function validate(def) {
  const out = [], names = new Set();
  const walk = (n, path) => {
    if (!n || typeof n !== 'object') return out.push(`${path}: not an object`);
    if (!NODE_TYPES.includes(n.type)) out.push(`${path}: unknown type "${n.type}"`);
    if (n.name) { if (names.has(n.name)) out.push(`${path}: duplicate name "${n.name}"`); names.add(n.name); }
    if (n.children && !CONTAINERS.has(n.type)) out.push(`${path}: ${n.type} cannot have children`);
    (n.children ?? []).forEach((c, i) => walk(c, `${path}/${c?.name ?? c?.type ?? i}`));
  };
  if (!def || typeof def !== 'object' || !def.root) return ['missing "root"'];
  walk(def.root, def.root.name ?? 'root');
  return out;
}

/** An empty UI file. */
export const blank = (name = 'screen') => ({ version: UI_VERSION, name, theme: {}, root: { type: 'panel', name: 'root', anchor: 'fill', style: { background: 'none', border: 'none', boxShadow: 'none', padding: 0 }, children: [] } });


// ---- Styles: one named rule set for every node (CSS-like, but JSON, with tokens, inheritance, states and images) ----
const UNITLESS = /^(opacity|zIndex|flex|flexGrow|flexShrink|order|fontWeight|lineHeight|scale)$/;
const ALIAS = { bg: 'background', fg: 'color', radius: 'borderRadius', pad: 'padding', size: 'fontSize', shadow: 'boxShadow' };
const STATES = { hover: ':hover', pressed: ':active', active: ':active', disabled: ':disabled', focus: ':focus-visible', on: '.on' };
const kebab = (k) => k.replace(/[A-Z]/g, (c) => '-' + c.toLowerCase());
const px = (v) => (typeof v === 'number' ? v + 'px' : v);
const tok = (v) => (typeof v === 'string' ? v.replace(/\$([a-zA-Z][\w-]*)/g, 'var(--nord-$1)') : v);

/**
 * Image → CSS declarations. `image` = a path, or { src, mode, slice:[left,top,right,bottom], scale, repeat, pixelated }.
 * mode: slice (9-slice; default when slice is set) | stretch | tile | fit | cover | center.
 * 9-slice uses the browser's native border-image: the four corners keep their size, edges stretch or tile, the middle fills.
 */
export function imageDecl(img, base = '') {
  if (!img) return [];
  if (typeof img === 'string') img = { src: img };
  const { src, scale = 1 } = img;
  const sl = Array.isArray(img.slice) ? img.slice : typeof img.slice === 'number' ? [img.slice, img.slice, img.slice, img.slice] : null;
  const mode = img.mode ?? (sl ? 'slice' : 'stretch');
  const u = `url("${(/^(\/|[a-z]+:)/i.test(src) ? '' : base) + String(src).replace(/"/g, '%22')}")`;
  const out = [];
  if (mode === 'slice' && sl) {
    const [l, t, r, b] = sl;
    out.push(['border-style', 'solid'], ['border-color', 'transparent'], ['background', 'none'],
      ['border-width', `${t * scale}px ${r * scale}px ${b * scale}px ${l * scale}px`],
      ['border-image-source', u], ['border-image-slice', `${t} ${r} ${b} ${l}${img.fill === false ? '' : ' fill'}`],
      ['border-image-width', `${t * scale}px ${r * scale}px ${b * scale}px ${l * scale}px`],
      ['border-image-repeat', img.repeat === 'tile' ? 'round' : img.repeat === 'repeat' ? 'repeat' : 'stretch']);
  } else if (mode === 'tile') out.push(['background', `${u} 0 0 / ${scale === 1 ? 'auto' : `${scale * 100}%`} repeat`]);
  else if (mode === 'fit') out.push(['background', `${u} center / contain no-repeat`]);
  else if (mode === 'cover') out.push(['background', `${u} center / cover no-repeat`]);
  else if (mode === 'center') out.push(['background', `${u} center / auto no-repeat`]);
  else out.push(['background', `${u} 0 0 / 100% 100% no-repeat`]);
  if (img.pixelated) out.push(['image-rendering', 'pixelated']);
  return out;
}
const tintCache = new Map();
/**
 * Unity-style `Image.color`: multiply a sprite's pixels by a colour (white sprite -> any colour, alpha kept).
 * Resolves to a PNG data URL (cached per url+colour), or the original url if canvas is unavailable or the image fails.
 */
export function tintImage(url, color) {
  const doc = globalThis.document;
  if (!doc || !color) return Promise.resolve(url);
  const key = `${color}|${url}`;
  if (!tintCache.has(key)) tintCache.set(key, new Promise((res) => {
    const im = new globalThis.Image();
    im.onload = () => {
      try {
        const c = doc.createElement('canvas'); c.width = im.naturalWidth; c.height = im.naturalHeight;
        const g = c.getContext('2d'); g.drawImage(im, 0, 0);
        g.globalCompositeOperation = 'multiply'; g.fillStyle = color; g.fillRect(0, 0, c.width, c.height);
        g.globalCompositeOperation = 'destination-in'; g.drawImage(im, 0, 0); // multiply also painted transparent pixels: restore the sprite's alpha
        res(c.toDataURL());
      } catch { res(url); }
    };
    im.onerror = () => res(url);
    im.src = url;
  }));
  return tintCache.get(key);
}

/** Declaration object → [css-property, value] pairs (aliases, camelCase, tokens, images, px). */
export function declPairs(decl, base = '') {
  const out = [];
  for (const [k0, v] of Object.entries(decl)) {
    if (k0 === 'extends' || STATES[k0] || v && typeof v === 'object' && k0 !== 'image') continue;
    if (k0 === 'image') { out.push(...imageDecl(v, base)); continue; }
    const k = ALIAS[k0] ?? k0;
    out.push([k.startsWith('--') ? k : kebab(k), UNITLESS.test(k) ? tok(String(v)) : tok(px(v))]);
  }
  return out;
}
const selector = (key) => key.split(/\s+/).map((part) => part.replace(/^([a-z]+)/, (w) => (NODE_TYPES.includes(w) ? '.' + w : w))).join(' ');
/** Compile { tokens, styles } into CSS text. Rule keys: "button", ".primary", "button.primary", "#play", "panel label". */
export function compileSkin(skin = {}, base = '') {
  const rules = skin.styles ?? {};
  const flat = (key, seen = []) => {
    const r = rules[key]; if (!r) return {};
    if (seen.includes(key)) throw new Error(`nord-ui: styles "${key}" extends itself`);
    const base = {};
    for (const e of [].concat(r.extends ?? [])) mergeDecl(base, flat(e, [...seen, key]));
    return mergeDecl(base, r);
  };
  const mergeDecl = (a, b) => { for (const [k, v] of Object.entries(b)) if (k !== 'extends') a[k] = STATES[k] && typeof v === 'object' ? { ...(a[k] ?? {}), ...v } : v; return a; };
  let css = '';
  const tokens = Object.entries(skin.tokens ?? {}).map(([k, v]) => `--nord-${k}:${v}`).join(';');
  if (tokens) css += `:host{${tokens}}\n`;
  for (const key of Object.keys(rules)) {
    const d = flat(key), sel = selector(key);
    const own = declPairs(d, base).map(([k, v]) => `${k}:${v}`).join(';');
    if (own) css += `${sel}{${own}}\n`;
    for (const [state, suffix] of Object.entries(STATES)) {
      if (d[state] && typeof d[state] === 'object') css += `${sel}${suffix}{${declPairs(d[state], base).map(([k, v]) => `${k}:${v}`).join(';')}}\n`;
    }
  }
  return css;
}

/**
 * Skin tint: a skin rule (or one of its states) may carry `image.tint`; this returns a copy of the skin whose sprites are
 * pre-multiplied by their tint (data URLs), ready for [[compileSkin]]. Without a canvas the skin comes back unchanged.
 */
export async function tintSkin(skin, base = '') {
  if (!skin?.styles || !globalThis.document) return skin;
  const out = structuredClone(skin), jobs = [];
  const full = (p) => (/^(\/|[a-z]+:|data:)/i.test(p) ? '' : base) + p;
  const visit = (decl) => {
    if (!decl || typeof decl !== 'object') return;
    const img = decl.image;
    if (img && typeof img === 'object' && img.tint && img.src) jobs.push(tintImage(full(img.src), img.tint).then((u) => { img.src = u; delete img.tint; }));
    for (const st of Object.keys(STATES)) visit(decl[st]);
  };
  for (const r of Object.values(out.styles)) visit(r);
  await Promise.all(jobs);
  return out;
}

let sharedSheet;
const mgrCss = (m) => m.skinCss ?? '';
function styleInto(doc, shadow) {
  try {
    if (!sharedSheet) { sharedSheet = new CSSStyleSheet(); sharedSheet.replaceSync(UI_CSS); }
    shadow.adoptedStyleSheets = [sharedSheet];
  } catch {
    const s = doc.createElement('style'); s.textContent = UI_CSS; shadow.appendChild(s);
  }
}

class Node {
  constructor(screen, def, el, parent) { this.screen = screen; this.def = def; this.el = el; this.parent = parent; this.handlers = null; el.__nord = this; }
  get name() { return this.def.name; }
  get text() { return this.el.dataset.raw ?? this.el.textContent; }
  set text(v) { this.screen._setText(this, String(v)); }
  get value() { const e = this.el; return e.type === 'checkbox' ? e.checked : e.dataset.bar !== undefined ? Number(e.dataset.bar) : e.type === 'range' ? Number(e.value) : e.value; }
  set value(v) {
    const e = this.el;
    if (this.def.type === 'bar') { const n = Math.min(1, Math.max(0, +v || 0)); if (e.dataset.bar !== String(n)) { e.dataset.bar = n; e.firstChild.style.transform = `scaleX(${n})`; } } else if (e.type !== undefined) e.value = v;
  }
  /** Selected option index of a select. */
  get index() { return this.el.selectedIndex ?? -1; }
  set index(v) { this.el.selectedIndex = v; }
  get checked() { return this.el.querySelector('input')?.checked ?? this.el.classList.contains('on'); }
  set checked(v) { const i = this.el.querySelector('input'); if (i) i.checked = !!v; else this.el.classList.toggle('on', !!v); }
  get visible() { return !this.el.hidden; }
  set visible(v) { this.el.hidden = !v; }
  get disabled() { return !!this.el.disabled; }
  set disabled(v) { const t = this.el.querySelector('input') ?? this.el; t.disabled = !!v; }
  set color(v) { (this.def.type === 'bar' ? this.el.firstChild : this.el).style[this.def.type === 'bar' ? 'background' : 'color'] = v; }
  set src(v) { this.el.src = this.screen.mgr.url(v); }
  /** Set several properties at once: node.set({ text: 'Go', visible: true, style: { opacity: .5 } }). */
  set(props) { for (const [k, v] of Object.entries(props)) { if (k === 'style') Object.assign(this.el.style, v); else this[k] = v; } return this; }
  css(style) { Object.assign(this.el.style, style); return this; }
  addClass(c) { this.el.classList.add(c); return this; }
  removeClass(c) { this.el.classList.remove(c); return this; }
  /** Listen: pressed | changed | input | toggled. Returns an unsubscribe function. */
  on(evt, fn) { ((this.handlers ??= {})[evt] ??= new Set()).add(fn); return () => this.handlers[evt].delete(fn); }
  off(evt, fn) { this.handlers?.[evt]?.delete(fn); return this; }
  find(name) { return this.screen.get(name); }
  /** Build a child from JSON and append it (list rows, inventory slots …). */
  add(def) { return this.screen._append(this, def); }
  clear() { for (const c of [...this.el.children]) this.screen._drop(c); return this; }
  remove() { this.screen._drop(this.el); }
  focus() { (this.el.querySelector('input,select,button') ?? this.el).focus?.(); return this; }
}

class Screen {
  constructor(mgr, def, { name, t, host } = {}) {
    this.mgr = mgr; this.def = def; this.name = name ?? def.name ?? 'screen'; this.t = t ?? mgr.t;
    this.doc = mgr.doc; this.byName = new Map(); this.vars = Object.create(null); this.tpl = new Map(); this.bound = new Map(); this.actions = new Map();
    this.host = host ?? this.doc.createElement('div');
    this.host.dataset.nordUi = this.name;
    this.shadow = this.host.shadowRoot ?? this.host.attachShadow({ mode: 'open' });
    styleInto(this.doc, this.shadow);
    this.rootEl = this.doc.createElement('div'); this.rootEl.className = 'root';
    if (def.page) { this.host.classList.add('page'); this.rootEl.classList.add('page'); }
    if (def.body && this.doc.body) Object.assign(this.doc.body.style, def.body);
    // Project stylesheets (e.g. style.css) are linked inside the shadow root; `ready` resolves when they loaded.
    const links = (Array.isArray(def.styles) ? def.styles : []).map((href) => new Promise((res) => { const l = this.doc.createElement('link'); l.rel = 'stylesheet'; l.href = href; l.onload = l.onerror = res; this.shadow.appendChild(l); }));
    this.ready = Promise.all(links);
    this.skinEl = this.doc.createElement('style'); this.skinEl.textContent = mgrCss(this.mgr);
    this.shadow.insertBefore(this.skinEl, this.shadow.firstChild);
    if (def.styles && !Array.isArray(def.styles)) { const own = this.doc.createElement('style'); own.textContent = compileSkin({ styles: def.styles }); this.shadow.appendChild(own); }
    this.shadow.appendChild(this.rootEl);
    this.spriteEl = this.doc.createElement('style'); this.shadow.appendChild(this.spriteEl); this._sprites = { styles: {} };
    if (def.theme) for (const [k, v] of Object.entries(def.theme)) this.host.style.setProperty(k.startsWith('--') ? k : `--nord-${k}`, v);
    const frag = this.doc.createDocumentFragment();
    this.root = this._make(def.root, null, frag);
    this.rootEl.appendChild(frag);
    this._flushSprites();
    for (const k of ['click', 'input', 'change']) this.rootEl.addEventListener(k, (e) => this._dom(k, e));
    this.visible = def.visible !== false;
    this.host.style.display = this.visible ? '' : 'none';
    if (def.scaler && !def.page && typeof ResizeObserver !== 'undefined') { this._ro = new ResizeObserver(() => this._applyScaler()); this._ro.observe(this.host); }
    this._applyScaler();
  }
  /**
   * `sprites: { normal, hover, pressed, disabled, on, focus, slice, scale, pixelated, mode, tint }` on any node (usually a button):
   * one picture per state, sharing the slice/scale/tint settings (Unity's Button "Sprite Swap").
   */
  _spriteStates(el, sp) {
    const id = `sp${(this._spN = (this._spN ?? 0) + 1)}`;
    el.classList.add(id);
    const shared = {};
    for (const k of ['slice', 'scale', 'pixelated', 'mode', 'repeat', 'fill', 'tint']) if (sp[k] !== undefined) shared[k] = sp[k];
    const img = (src) => ({ src, ...shared });
    const rule = {};
    if (sp.normal) rule.image = img(sp.normal);
    for (const st of ['hover', 'pressed', 'disabled', 'on', 'focus']) if (sp[st]) rule[st] = { image: img(sp[st]) };
    this._sprites.styles[`.${id}`] = rule;
  }
  /** Sprite-state nodes (`sprites`) were collected while building: compile them (and their tints) into one stylesheet. */
  _flushSprites() {
    if (!Object.keys(this._sprites.styles).length) return;
    const skin = this._sprites, base = this.mgr.assetBase;
    this.spriteEl.textContent = compileSkin(skin, base);
    tintSkin(skin, base).then((t) => { if (t !== skin && this.spriteEl.isConnected) this.spriteEl.textContent = compileSkin(t, base); });
  }
  /** Size the root to the scaler's logical resolution and scale it to the host (anchors then work in logical pixels). */
  _applyScaler() {
    const sc = this.def.scaler, h = this.host;
    if (!sc || this.def.page || !h.offsetWidth) return;
    const k = scalerFactor(sc, h.offsetWidth, h.offsetHeight), st = this.rootEl.style;
    const fit = sc.mode === 'fit', [rw, rh] = fit ? (sc.ref ?? [1280, 720]) : [h.offsetWidth / k, h.offsetHeight / k];
    Object.assign(st, { inset: 'auto', left: fit ? `${(h.offsetWidth - rw * k) / 2}px` : '0', top: fit ? `${(h.offsetHeight - rh * k) / 2}px` : '0', width: `${rw}px`, height: `${rh}px`, transformOrigin: '0 0', transform: `scale(${k})` });
  }
  /** True while a text field inside this screen has focus (use it to ignore game keys). */
  get typing() { return /^(INPUT|TEXTAREA|SELECT)$/.test(this.shadow.activeElement?.tagName ?? ''); }
  /** Node handle by name (or null). */
  get(name) { return this.byName.get(name) ?? null; }
  $(name) { const n = this.byName.get(name); if (!n) throw new Error(`UI "${this.name}": no node named "${name}"`); return n; }
  /** Subscribe to an action name ('start'), or '*' for all. fn(payload, node, action). */
  on(action, fn) { (this.actions.get(action) ?? this.actions.set(action, new Set()).get(action)).add(fn); return () => this.actions.get(action)?.delete(fn); }
  off(action, fn) { this.actions.get(action)?.delete(fn); return this; }
  emit(action, payload, node) {
    this.actions.get(action)?.forEach((f) => f(payload, node, action));
    this.actions.get('*')?.forEach((f) => f(payload, node, action));
    this.mgr.events?.emit?.(`ui:${action}`, payload);
    return this;
  }
  /** Bind data: screen.set('score', 12) or screen.set({ score: 12, hp: .5 }). Only changed values touch the DOM. */
  set(k, v) {
    if (typeof k === 'object') { for (const [a, b] of Object.entries(k)) this.set(a, b); return this; }
    if (this.vars[k] === v) return this;
    this.vars[k] = v;
    const labels = this.tpl.get(k);
    if (labels) for (const n of labels) this._renderTpl(n);
    const props = this.bound.get(k);
    if (props) for (const [n, prop] of props) n[prop] = prop === 'visible' ? !!v : v;
    return this;
  }
  show() { this.visible = true; this.host.style.display = ''; this.emit('shown'); return this; }
  hide() { this.visible = false; this.host.style.display = 'none'; this.emit('hidden'); return this; }
  toggle() { return this.visible ? this.hide() : this.show(); }
  /** Re-run translations (@keys) after a language change. */
  retranslate() { for (const n of this.byName.values()) if (n.el.dataset.raw !== undefined) this._renderTpl(n); return this; }
  destroy() { this._ro?.disconnect(); this.host.remove(); this.mgr.screens.delete(this.name); this.byName.clear(); this.actions.clear(); }

  _dom(kind, e) {
    let el = e.target;
    while (el && el !== this.rootEl && !el.__nord) el = el.parentNode ?? el.host;
    const n = el?.__nord; if (!n) return;
    const t = n.def.type;
    let evt, payload;
    if (kind === 'click' && (t === 'button')) {
      if (n.def.toggle) { n.checked = !n.checked; this._fire(n, 'toggled', n.checked); }
      evt = 'pressed'; payload = n.def.payload;
      this.mgr.onSound?.('click');
    } else if (kind === 'input' && (t === 'input' || t === 'slider')) { evt = 'input'; payload = n.value; } else if (kind === 'change' && (t === 'input' || t === 'slider' || t === 'select' || t === 'checkbox')) { evt = t === 'checkbox' ? 'toggled' : 'changed'; payload = n.value; if (t === 'checkbox') payload = n.checked; } else return;
    this._fire(n, evt, payload);
  }
  _fire(n, evt, payload) {
    n.handlers?.[evt]?.forEach((f) => f(payload, n));
    const a = n.def.on?.[evt]; if (a) this.emit(a, payload ?? n.def.payload, n);
  }
  _setText(n, v) {
    n.el.dataset.raw = v;
    this._renderTpl(n);
  }
  _renderTpl(n) {
    let s = n.el.dataset.raw ?? '';
    if (s.startsWith('@') && this.t) s = this.t(s.slice(1)) ?? s;
    if (s.includes('{')) s = s.replace(/\{(\w+)\}/g, (_, k) => this.vars[k] ?? '');
    if (n.def.type === 'label') { if (n.def.rich === false) { if (n.el.textContent !== s) n.el.textContent = s; } else if (n.el.__last !== s) { n.el.__last = s; richText(this.doc, n.el, s); } } else if (n.el.__last !== s) { n.el.__last = s; if (n.def.type === 'button' || n.def.type === 'checkbox') { const tgt = n.def.type === 'checkbox' ? n.el.lastChild : n.el; if (s.includes('[')) richText(this.doc, tgt, s); else tgt.textContent = s; } else n.el.textContent = s; }
  }
  _watch(n, def) {
    const raw = def.text;
    if (typeof raw === 'string') {
      for (const m of raw.matchAll(/\{(\w+)\}/g)) { const set = this.tpl.get(m[1]) ?? this.tpl.set(m[1], new Set()).get(m[1]); set.add(n); }
    }
    if (def.bind) for (const [prop, key] of Object.entries(def.bind)) { const l = this.bound.get(key) ?? this.bound.set(key, []).get(key); l.push([n, prop]); }
  }
  _append(parent, def) {
    const frag = this.doc.createDocumentFragment();
    const n = this._make(def, parent, frag);
    parent.el.appendChild(frag);
    return n;
  }
  _drop(el) {
    const walk = (e) => { const n = e.__nord; if (n) { if (n.name && this.byName.get(n.name) === n) this.byName.delete(n.name); for (const s of this.tpl.values()) s.delete(n); } for (const c of e.children) walk(c); };
    walk(el); el.remove();
  }
  _make(def, parent, into) {
    const d = this.doc, t = def.type;
    let el;
    switch (t) {
      case 'button': el = d.createElement('button'); el.type = 'button'; break;
      case 'image':
        if (def.slice || ['tile', 'stretch', 'slice', 'center'].includes(def.mode)) el = d.createElement('div'); // sliced/tiled images are CSS backgrounds
        else { el = d.createElement('img'); el.src = this.mgr.url(def.src ?? ''); el.alt = def.alt ?? ''; el.draggable = false; if (def.fit || def.mode) el.style.objectFit = def.fit ?? (def.mode === 'fit' ? 'contain' : def.mode); }
        break;
      case 'bar': el = d.createElement('div'); el.appendChild(d.createElement('i')); break;
      case 'slider': el = d.createElement('input'); el.type = 'range'; el.min = def.min ?? 0; el.max = def.max ?? 1; el.step = def.step ?? 0.01; el.value = def.value ?? 0; break;
      case 'input':
        el = d.createElement(def.multiline ? 'textarea' : 'input');
        if (!def.multiline) el.type = def.password ? 'password' : def.inputType ?? 'text';
        if (def.placeholder) el.placeholder = def.placeholder;
        if (def.accept) el.accept = def.accept;
        if (def.maxlength) el.maxLength = def.maxlength;
        if (def.checked) el.checked = true;
        if (def.value !== undefined) el.value = def.value;
        break;
      case 'select': el = d.createElement('select'); for (const o of def.options ?? []) { const op = d.createElement('option'); const [v, l] = Array.isArray(o) ? o : [o, o]; op.value = v; op.textContent = l; el.appendChild(op); } if (def.value !== undefined) el.value = def.value; break;
      case 'checkbox': { el = d.createElement('label'); const i = d.createElement('input'); i.type = 'checkbox'; i.checked = !!def.checked; el.appendChild(i); el.appendChild(d.createElement('span')); break; }
      case 'html': el = d.createElement('div'); el.innerHTML = def.html ?? ''; break; // escape hatch: your own markup, still inside the shadow root
      case 'canvas': el = d.createElement('canvas'); if (def.w) el.width = def.w; if (def.h) el.height = def.h; break;
      default: el = d.createElement(def.tag ?? 'div');
    }
    el.classList.add('n', t);
    if (def.name) el.id = def.name; // shadow-scoped id: project CSS (#status) and browser tests can use it
    if (def.attrs) for (const [k, v] of Object.entries(def.attrs)) el.setAttribute(k, v); if (def.class) for (const c of String(def.class).split(/\s+/)) if (c) el.classList.add(c);
    if (t === 'panel' && def.layout) el.classList.add(def.layout === 'hbox' ? 'hbox' : 'vbox');
    const n = new Node(this, def, el, parent);
    if (def.name) { if (!this.byName.has(def.name)) this.byName.set(def.name, n); }
    this._style(el, def, parent);
    if (def.sprites && typeof def.sprites === 'object') this._spriteStates(el, def.sprites);
    { const base = this.mgr.assetBase; const img = t === 'image' ? (def.slice || ['tile', 'stretch', 'slice', 'center'].includes(def.mode) ? def : null) : def.image; for (const [k, v] of imageDecl(img, base)) el.style.setProperty(k, v); }
    { // tint (Unity Image.color): re-skin the sprite once the multiplied copy is ready
      const imgDef = t === 'image' ? def : typeof def.image === 'string' ? { src: def.image } : def.image;
      if (imgDef?.tint && imgDef.src) {
        const base = this.mgr.assetBase;
        tintImage(this.mgr.url(imgDef.src), imgDef.tint).then((u) => {
          if (el.tagName === 'IMG') el.src = u;
          else for (const [k, v] of imageDecl({ ...imgDef, src: u }, base)) el.style.setProperty(k, v);
        });
      }
    }
    if (def.text !== undefined) { this._setText(n, def.text); this._watch(n, def); } else if (def.bind) this._watch(n, def);
    if (t === 'bar') n.value = def.value ?? 1;
    if (def.color) n.color = def.color;
    if (def.visible === false) el.hidden = true;
    if (def.disabled) n.disabled = true;
    if (def.toggle && def.checked) n.checked = true;
    if (def.tooltip) el.title = def.tooltip;
    if (def.children) {
      for (const c of def.children) {
        const sub = c.type === 'instance' ? this.mgr._resolved.get(c.ref) : null;
        this._make(sub ? { ...sub.root, ...pick(c, ['name', 'anchor', 'x', 'y', 'w', 'h', 'grow', 'margin', 'visible', 'style']) } : c, n, el);
      }
    }
    into.appendChild(el);
    return n;
  }
  _style(el, def, parent) {
    const s = el.style, t = def.type, a = def.anchor;
    if (a) {
      el.classList.add('a');
      if (a === 'fill') el.classList.add('fill'); else {
        const [fx, fy] = ANCHOR[a] ?? ANCHOR.tl;
        s.left = `calc(${fx * 100}% + ${num(def.x ?? 0)})`; s.top = `calc(${fy * 100}% + ${num(def.y ?? 0)})`;
        if (fx || fy) s.transform = `translate(${-fx * 100}%,${-fy * 100}%)`;
      }
      if (def.margin !== undefined && a === 'fill') s.inset = box(def.margin);
    } else if (def.margin !== undefined) s.margin = box(def.margin);
    if (t !== 'canvas') { if (def.w !== undefined) s.width = num(def.w); if (def.h !== undefined) s.height = num(def.h); } else if (def.w || def.h) s.maxWidth = '100%';
    if (def.minW !== undefined) s.minWidth = num(def.minW); if (def.maxW !== undefined) s.maxWidth = num(def.maxW);
    if (def.grow !== undefined) s.flexGrow = def.grow;
    if (def.padding !== undefined) s.padding = box(def.padding);
    if (def.gap !== undefined) s.gap = num(def.gap);
    if (def.align) { if (t === 'label' || t === 'button') s.textAlign = def.align; else s.alignItems = FLEX[def.align] ?? def.align; }
    if (def.justify) s.justifyContent = FLEX[def.justify] ?? def.justify;
    if (def.self) s.alignSelf = FLEX[def.self] ?? def.self;
    if (t === 'grid') s.gridTemplateColumns = `repeat(${def.cols ?? 2},1fr)`;
    if (t === 'label') { if (def.size) s.fontSize = num(def.size); if (def.bold) s.fontWeight = '700'; if (def.italic) s.fontStyle = 'italic'; if (def.font) s.fontFamily = def.font; if (def.wrap === false) s.whiteSpace = 'pre'; if (def.outline) s.webkitTextStroke = `${def.outline}px #000`; if (def.shadow === false) s.textShadow = 'none'; }
    if (t === 'button' && def.size) s.fontSize = num(def.size);
    if (t === 'image' && def.opacity !== undefined) s.opacity = def.opacity;
    if (t === 'spacer') { s.flexGrow = def.grow ?? 1; s.pointerEvents = 'none'; }
    if (def.style) for (const [k, v] of Object.entries(def.style)) s[k] = typeof v === 'number' && !/opacity|zIndex|flex|order|fontWeight|lineHeight/.test(k) ? `${v}px` : v;
  }
}
const pick = (o, ks) => { const r = {}; for (const k of ks) if (o[k] !== undefined) r[k] = o[k]; return r; };

/** UI manager for one container (page root or the game overlay). */
export class UIManager {
  constructor(container, { doc = globalThis.document, t, events, onSound, fetch: f = globalThis.fetch?.bind(globalThis), base = '', assetBase = '', skin } = {}) {
    this.container = container; this.doc = doc; this.t = t; this.events = events; this.onSound = onSound; this._fetch = f; this.base = base; this.assetBase = assetBase;
    this.screens = new Map(); this._resolved = new Map(); this._defs = new Map();
    if (skin && typeof skin === 'object') {
      this.skinCss = compileSkin(skin, assetBase);
      tintSkin(skin, assetBase).then((t) => { if (t !== skin) { this.skinCss = compileSkin(t, assetBase); for (const sc of this.screens.values()) sc.skinEl.textContent = this.skinCss; } });
    }
    this._skinReady = typeof skin === 'string' ? this.useSkin(skin) : null;
  }
  /** Apply a skin ({ tokens, styles } object or .json url) to every screen, now and later. Switch skins at runtime by calling it again. */
  async useSkin(src) {
    const key = typeof src === 'string' ? src : null;
    const skin = typeof src === 'string' ? await this._def(src, true) : src;
    if (key && key === this.skinKey) return this;
    this.skinKey = key; this.skinCss = compileSkin(skin, this.assetBase);
    for (const sc of this.screens.values()) sc.skinEl.textContent = this.skinCss;
    const tinted = await tintSkin(skin, this.assetBase); // sprites with `image.tint` appear once multiplied
    if (tinted !== skin && this.skinKey === key) { this.skinCss = compileSkin(tinted, this.assetBase); for (const sc of this.screens.values()) sc.skinEl.textContent = this.skinCss; }
    return this;
  }
  /** Project-relative asset path → URL (applies `assetBase` unless the path is absolute). */
  url(p) { return (/^(\/|[a-z]+:|data:)/i.test(p) ? '' : this.assetBase) + p; }
  /** Register a UI definition under a name so `instance` nodes and `load('name')` can find it. */
  define(name, def) { this._defs.set(name, def); return this; }
  async _def(src, fresh = false) {
    if (typeof src === 'object') return src;
    if (!fresh && this._defs.has(src)) return this._defs.get(src);
    if (!this._fetch) throw new Error('nord-ui: no fetch available');
    const r = await this._fetch(this.base + src);
    if (!r.ok) throw new Error(`nord-ui: cannot load ${src} (${r.status})`);
    const def = await r.json(); this._defs.set(src, def); return def;
  }
  async _preload(node) {
    for (const c of node.children ?? []) { if (c.type === 'instance' && !this._resolved.has(c.ref)) { const d = await this._def(c.ref); await this._preload(d.root); this._resolved.set(c.ref, d); } else await this._preload(c); }
  }
  /** Load a .ui.json (url, registered name or object) and show it. Resolves instance nodes first. */
  async load(src, opts = {}) {
    const def = await this._def(src);
    await this._skinReady;
    await this._preload(def.root);
    if (def.skin) await this.useSkin(def.skin);
    const s = this.build(def, { name: typeof src === 'string' && !opts.name ? def.name ?? src : undefined, ...opts });
    await s.ready;
    return s;
  }
  /** Synchronous build from an object (instances must already be defined/loaded). */
  build(def, opts = {}) {
    const bad = validate(def); if (bad.length) console.warn(`nord-ui "${def.name ?? ''}":`, bad.join('; '));
    const name = opts.name ?? def.name ?? `screen${this.screens.size}`;
    this.screens.get(name)?.destroy();
    const s = new Screen(this, def, { ...opts, name });
    this.container.appendChild(s.host);
    this.screens.set(name, s);
    return s;
  }
  get(name) { return this.screens.get(name) ?? null; }
  show(name) { this.screens.get(name)?.show(); return this; }
  hide(name) { this.screens.get(name)?.hide(); return this; }
  /** Show one screen and hide the others (menu ↔ hud ↔ pause). */
  only(name) { for (const [k, s] of this.screens) s[k === name ? 'show' : 'hide'](); return this; }
  destroy() { for (const s of [...this.screens.values()]) s.destroy(); }
}

export const createUI = (container, opts) => new UIManager(container, opts);
