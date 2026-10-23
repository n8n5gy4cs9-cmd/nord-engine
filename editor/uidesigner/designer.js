// Nord UI Designer — edits ui/*.ui.json (spec: docs/UI_SCENES.md). The preview is the real runtime (runtime/core/uiscene.js).
import { askYes } from '/editor/common/dialog.js';
import { UIManager, blank, validate, compileSkin, tintSkin, scalerFactor, NODE_TYPES, CONTAINERS } from '/runtime/core/uiscene.js';

addEventListener('error', (e) => { if (/ResizeObserver loop/.test(e.message)) e.stopImmediatePropagation(); });
const $ = (s) => document.querySelector(s);
const el = (tag, props = {}, parent) => { const e = Object.assign(document.createElement(tag), props); parent?.appendChild(e); return e; };
const ANCHORS = ['', 'tl', 't', 'tr', 'l', 'c', 'r', 'bl', 'b', 'br', 'fill'];
const ALIGN = ['', 'start', 'center', 'end', 'stretch', 'left', 'right'];
const JUSTIFY = ['', 'start', 'center', 'end', 'between', 'around'];
const THEMES = {
  'Nord (default)': {},
  Midnight: { bg: '#0f1626', panel: '#18233b', border: '#2c3d63', fg: '#e3edf0', accent: '#f7d89b' },
  Light: { bg: '#f4f1ea', panel: '#ffffff', border: '#cfc8b8', fg: '#2b2b2b', accent: '#3b7dd8' },
  Retro: { bg: '#1b1020', panel: '#2d1b3a', border: '#7a4fa3', fg: '#ffe9a8', accent: '#ff6b9a' },
};
const DEFAULTS = {
  box: { type: 'box', tag: 'section', children: [] }, canvas: { type: 'canvas', w: 320, h: 180 },
  panel: { type: 'panel', layout: 'vbox', gap: 8, children: [] }, vbox: { type: 'vbox', gap: 8, children: [] }, hbox: { type: 'hbox', gap: 8, children: [] },
  grid: { type: 'grid', cols: 3, gap: 8, children: [] }, center: { type: 'center', children: [] }, scroll: { type: 'scroll', h: 200, children: [] },
  label: { type: 'label', text: 'Label', size: 20 }, button: { type: 'button', text: 'Button', on: { pressed: 'action' } }, image: { type: 'image', src: 'assets/sprites/icon.png', w: 64, h: 64 },
  bar: { type: 'bar', value: 0.7, w: 180 }, slider: { type: 'slider', min: 0, max: 1, value: 0.5 }, input: { type: 'input', placeholder: 'Type…' },
  checkbox: { type: 'checkbox', text: 'Option', checked: false }, select: { type: 'select', options: ['One', 'Two'] }, spacer: { type: 'spacer' }, html: { type: 'html', html: '<b>Custom HTML</b>' },
  instance: { type: 'instance', ref: 'ui/other.ui.json' },
};
const common = [['name', 'Name', 'text'], ['anchor', 'Anchor', ANCHORS], ['x', 'X', 'num'], ['y', 'Y', 'num'], ['w', 'Width', 'num'], ['h', 'Height', 'num'], ['grow', 'Grow', 'num'], ['margin', 'Margin', 'text'], ['class', 'CSS class', 'text']];
const FIELDS = {
  box: [['tag', 'HTML tag', 'text'], ['padding', 'Padding', 'text'], ['gap', 'Gap', 'num']], canvas: [],
  panel: [['layout', 'Layout', ['vbox', 'hbox']], ['padding', 'Padding', 'text'], ['gap', 'Gap', 'num'], ['align', 'Align items', ALIGN], ['justify', 'Justify', JUSTIFY]],
  vbox: [['padding', 'Padding', 'text'], ['gap', 'Gap', 'num'], ['align', 'Align items', ALIGN], ['justify', 'Justify', JUSTIFY]],
  hbox: [['padding', 'Padding', 'text'], ['gap', 'Gap', 'num'], ['align', 'Align items', ALIGN], ['justify', 'Justify', JUSTIFY]],
  grid: [['cols', 'Columns', 'num'], ['gap', 'Gap', 'num'], ['padding', 'Padding', 'text']], center: [], scroll: [['gap', 'Gap', 'num']],
  label: [['tag', 'HTML tag', 'text'], ['text', 'Text', 'area'], ['size', 'Size', 'num'], ['color', 'Color', 'text'], ['align', 'Text align', ['', 'left', 'center', 'right']], ['bold', 'Bold', 'bool'], ['italic', 'Italic', 'bool'], ['wrap', 'Wrap', 'bool'], ['outline', 'Outline', 'num']],
  button: [['text', 'Text', 'text'], ['on.pressed', 'Action', 'text'], ['payload', 'Payload', 'text'], ['toggle', 'Toggle', 'bool'], ['size', 'Font size', 'num']],
  image: [['opacity', 'Opacity', 'num']],
  bar: [['value', 'Value 0-1', 'num'], ['color', 'Color', 'text'], ['bind.value', 'Bind value', 'text']],
  slider: [['min', 'Min', 'num'], ['max', 'Max', 'num'], ['step', 'Step', 'num'], ['value', 'Value', 'num'], ['on.changed', 'Action', 'text']],
  input: [['inputType', 'Input type', ['', 'text', 'number', 'color', 'file', 'checkbox', 'password']], ['multiline', 'Multi-line', 'bool'], ['placeholder', 'Placeholder', 'text'], ['value', 'Value', 'text'], ['on.changed', 'Action', 'text']],
  checkbox: [['text', 'Text', 'text'], ['checked', 'Checked', 'bool'], ['on.toggled', 'Action', 'text']],
  select: [['options', 'Options (a,b,c)', 'list'], ['value', 'Value', 'text'], ['on.changed', 'Action', 'text']],
  spacer: [], html: [['html', 'HTML', 'area']], instance: [['ref', 'File', 'text']],
};
const IMG = [['image.src', 'Image', 'img'], ['image.mode', 'Image mode', ['', 'slice', 'stretch', 'tile', 'fit', 'cover', 'center']], ['image.slice', '9-slice L T R B', 'nums'], ['image.scale', 'Slice scale', 'num'], ['image.tint', 'Tint (multiplies sprite)', 'tint'], ['image.pixelated', 'Pixelated', 'bool']];
const IMGNODE = [['src', 'Image', 'img'], ['mode', 'Mode', ['', 'slice', 'stretch', 'tile', 'fit', 'cover', 'center']], ['slice', '9-slice L T R B', 'nums'], ['scale', 'Slice scale', 'num'], ['tint', 'Tint (multiplies sprite)', 'tint']];
// Sprite swap (Unity Button): one picture per state; slice / scale / tint are shared by the states
const SPRITES = [['sprites.normal', 'Sprite: normal', 'img'], ['sprites.hover', 'Sprite: hover', 'img'], ['sprites.pressed', 'Sprite: pressed', 'img'], ['sprites.disabled', 'Sprite: disabled', 'img'], ['sprites.slice', 'Sprites 9-slice', 'nums'], ['sprites.scale', 'Sprites slice scale', 'num'], ['sprites.tint', 'Sprites tint', 'tint'], ['sprites.pixelated', 'Sprites pixelated', 'bool']];
const tail = [['visible', 'Visible', 'bool', true], ['disabled', 'Disabled', 'bool'], ['bind.text', 'Bind text var', 'text'], ['tooltip', 'Tooltip', 'text']];

const SKINS = { '': null };
const S = { skin: null, skinPath: '',  def: blank('menu'), sel: null, undo: [], redo: [], dirty: false, scale: 1 };
const mgr = new UIManager($('#stage'), { assetBase: '/' }); // project files are served from the site root
let rafPending = false;

const status = (m, bad) => { const s = $('#status'); s.textContent = m; s.className = bad ? 'bad' : ''; };
const clone = (o) => JSON.parse(JSON.stringify(o));

// ── talk to the editor / project (works in the Nord editor tab; in a plain browser the paths are just shown) ──
const ipc = (m) => fetch('/api/ipc', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(m) }).catch(() => {});
const openInEditor = (file, line) => { ipc({ t: 'open-file', path: file, line }); status(`Opening ${file}${line ? ':' + line : ''} in the code editor…`); };
const usageCache = new Map();
/** Code that mentions `name` as a quoted string or `ui:name` (definition files .ui.json/.skin.json do not count). */
async function usagesOf(name) {
  const hit = usageCache.get(name); if (hit && Date.now() - hit.t < 8000) return hit.list;
  let list = null;
  try {
    const r = await fetch('/api/usages?q=' + encodeURIComponent(name));
    if (r.ok) {
      const q = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), re = new RegExp(`(['"\`])${q}\\1|ui:${q}\\b`);
      list = (await r.json()).filter((h) => !/\.(ui|skin)\.json$/.test(h.file) && re.test(h.text));
    }
  } catch { /* plain static server: no search */ }
  usageCache.set(name, { t: Date.now(), list }); return list;
}
const snippet = (a) => `menu.on('${a}', () => {\n  // TODO: what should "${a}" do?\n});`;
function modal(title, build) {
  const back = el('div', { className: 'modal' }, document.body);
  const box = el('div', { className: 'box' }, back); const h = el('div', { className: 'mh' }, box); el('b', { textContent: title }, h);
  const close = el('button', { textContent: '✕' }, h); const body = el('div', { className: 'mb' }, box);
  const done = () => back.remove(); close.onclick = done; back.onclick = (e) => { if (e.target === back) done(); };
  build(body, done); return done;
}
const get = (o, p) => p.split('.').reduce((a, k) => a?.[k], o);
const put = (o, p, v) => {
  const ks = p.split('.'); const last = ks.pop(); let t = o;
  for (const k of ks) t = t[k] ??= {};
  if (v === undefined || v === '' || v === false && last !== 'visible') { delete t[last]; if (!ks.length) return; if (!Object.keys(t).length) { const parent = ks.length === 1 ? o : get(o, ks.slice(0, -1).join('.')); delete parent[ks.at(-1)]; } } else t[last] = v;
};
const find = (n, t, parent = null) => { if (n === t) return { n, parent }; for (const c of n.children ?? []) { const r = find(c, t, n); if (r) return r; } return null; };
const walk = (n, f, depth = 0) => { f(n, depth); for (const c of n.children ?? []) walk(c, f, depth + 1); };

async function loadSkin(path) {
  if (!path) { S.skin = null; mgr.skinCss = ''; return; }
  try {
    const r = await fetch('/' + path); if (!r.ok) throw Error(r.status);
    S.skin = await r.json(); S.skinPath = path; mgr.skinCss = compileSkin(S.skin, '/');
    tintSkin(S.skin, '/').then((t) => { if (t !== S.skin && S.skinPath === path) { mgr.skinCss = compileSkin(t, '/'); refresh(); } }); // sprites with image.tint
    $('#skinFile').value = path; $('#skinJson').value = JSON.stringify(S.skin, null, 2);
  } catch (e) { S.skin = null; mgr.skinCss = ''; if (path !== 'ui/skin.json') status(`Skin ${path}: ${e.message}`, true); }
}
function applySkinText() {
  try { S.skin = JSON.parse($('#skinJson').value); mgr.skinCss = compileSkin(S.skin, '/'); refresh(); status('Skin applied'); } catch (e) { status('Skin error: ' + e.message, true); }
}
function checkpoint() { S.undo.push(JSON.stringify(S.def)); if (S.undo.length > 100) S.undo.shift(); S.redo = []; S.dirty = true; }
function restore(from, to) { if (!from.length) return; to.push(JSON.stringify(S.def)); S.def = JSON.parse(from.pop()); S.sel = S.def.root; refresh(); }
function refresh() { if (rafPending) return; rafPending = true; requestAnimationFrame(() => { rafPending = false; renderAll(); }); }

function renderAll() { preloadInstances(); renderStage(); renderTree(); renderProps(); $('#json').value = JSON.stringify(S.def, null, 2); const bad = validate(S.def); if (bad.length) status(bad[0], true); }

function renderStage() {
  const [w, h] = $('#size').value.split('x').map(Number);
  const st = $('#stage'); st.style.width = w + 'px'; st.style.height = h + 'px';
  const room = $('#center'); S.scale = Math.min(1, (room.clientWidth - 32) / w, (room.clientHeight - 32) / h);
  st.style.transform = `scale(${S.scale})`; st.parentElement.style.width = w * S.scale + 'px'; st.parentElement.style.height = h * S.scale + 'px';
  const screen = mgr.build(S.def, { name: 'preview' });
  screen.host.style.pointerEvents = 'auto';
  // nodes that start hidden in the game stay visible here (ghosted) so they can be edited
  for (const e of screen.rootEl.querySelectorAll('.n')) if (e.__nord?.def.visible === false) { e.hidden = false; e.style.opacity = '.55'; e.style.outline = '1px dashed #ebcb8b'; }
  if (S.sel) { const n = [...screen.byName.values()].find((x) => x.def === S.sel) ?? findEl(screen.rootEl, S.sel); if (n) (n.el ?? n).style.outline = '2px dashed #88c0d0'; }
  drawHandles(screen);
}
// On-canvas rect handles (Unity Rect tool): drag the eight handles of the selected node to set w/h, keeping the opposite edge still.
const ANCH = { tl: [0, 0], t: [0.5, 0], tr: [1, 0], l: [0, 0.5], c: [0.5, 0.5], r: [1, 0.5], bl: [0, 1], b: [0.5, 1], br: [1, 1] };
const HANDLES = [[-1, -1], [0, -1], [1, -1], [1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0]];
function drawHandles(screen) {
  $('#stage').querySelector('.rects')?.remove();
  const n = S.sel; if (!n || n === S.def.root || n.anchor === 'fill') return;
  const e = findEl(screen.rootEl, n); if (!e) return;
  const sr = $('#stage').getBoundingClientRect(), r = e.getBoundingClientRect(), k = S.scale || 1;
  const layer = el('div', { className: 'rects' }, $('#stage'));
  const box = { x: (r.left - sr.left) / k, y: (r.top - sr.top) / k, w: r.width / k, h: r.height / k };
  Object.assign(layer.style, { position: 'absolute', left: box.x + 'px', top: box.y + 'px', width: box.w + 'px', height: box.h + 'px', pointerEvents: 'none', zIndex: 9 });
  const [w0, h0] = $('#size').value.split('x').map(Number), scl = scalerFactor(S.def.scaler, w0, h0) * k; // screen px per logical px
  for (const [hx, hy] of HANDLES) {
    const h = el('div', { className: 'rh' }, layer);
    Object.assign(h.style, { position: 'absolute', width: '9px', height: '9px', background: '#fff', border: '1px solid #4fa3ff', left: `calc(${(hx + 1) * 50}% - 5px)`, top: `calc(${(hy + 1) * 50}% - 5px)`, pointerEvents: 'auto', cursor: `${hx && hy ? (hx * hy > 0 ? 'nwse' : 'nesw') : hx ? 'ew' : 'ns'}-resize`, transform: `scale(${1 / k})` });
    h.onpointerdown = (ev) => {
      ev.preventDefault(); ev.stopPropagation();
      const w = e.offsetWidth, hh = e.offsetHeight, x0 = n.x ?? 0, y0 = n.y ?? 0, sx = ev.clientX, sy = ev.clientY, [fx, fy] = ANCH[n.anchor] ?? [0, 0];
      let moved = false;
      const mv = (m) => {
        const dx = (m.clientX - sx) / scl, dy = (m.clientY - sy) / scl;
        if (!moved && Math.hypot(dx, dy) < 2) return; if (!moved) { checkpoint(); moved = true; }
        const snap = (v) => (m.ctrlKey || m.metaKey ? v : Math.round(v));
        if (hx) { const nw = Math.max(4, snap(w + hx * dx)); n.w = nw; if (n.anchor) n.x = Math.round(x0 + (hx > 0 ? fx : -(1 - fx)) * (nw - w)); }
        if (hy) { const nh = Math.max(4, snap(hh + hy * dy)); n.h = nh; if (n.anchor) n.y = Math.round(y0 + (hy > 0 ? fy : -(1 - fy)) * (nh - hh)); }
        renderStage(); renderProps();
      };
      // window listeners: the handles are rebuilt on every redraw, so the pressed element does not survive the drag
      const up = () => { removeEventListener('pointermove', mv); removeEventListener('pointerup', up); if (moved) refresh(); };
      addEventListener('pointermove', mv); addEventListener('pointerup', up);
    };
  }
}
function findEl(root, def) { for (const e of root.querySelectorAll('.n')) if (e.__nord?.def === def) return e; return null; }

function renderTree() {
  const t = $('#tree'); t.textContent = '';
  walk(S.def.root, (n, d) => {
    const r = el('div', { className: 'row' + (n === S.sel ? ' sel' : ''), draggable: n !== S.def.root }, t);
    r.style.paddingLeft = 4 + d * 14 + 'px';
    el('span', { textContent: n.name || '(unnamed)' }, r); el('small', { textContent: n.type }, r);
    r.onclick = () => { S.sel = n; refresh(); };
    r.ondragstart = (e) => { S.drag = n; e.dataTransfer.setData('text/plain', n.name ?? ''); };
    r.ondragover = (e) => { e.preventDefault(); r.classList.add('over'); };
    r.ondragleave = () => r.classList.remove('over');
    r.ondrop = (e) => { e.preventDefault(); r.classList.remove('over'); if (S.drag && S.drag !== n) moveNode(S.drag, n); S.drag = null; };
  });
}
function moveNode(n, target) {
  if (find(n, target)) return status('Cannot move a node into itself', true);
  checkpoint();
  const from = find(S.def.root, n); from.parent.children.splice(from.parent.children.indexOf(n), 1);
  if (CONTAINERS.has(target.type)) (target.children ??= []).push(n);
  else { const to = find(S.def.root, target); to.parent.children.splice(to.parent.children.indexOf(target) + 1, 0, n); }
  refresh();
}

// Canvas scaler (Unity CanvasScaler): the file's `scaler` makes anchors/sizes work in a reference resolution and scales to the screen.
function scalerPanel(p) {
  const box = el('div', { className: 'slicebox' }, p); el('label', { textContent: 'Canvas scaler' }, box);
  const sc = S.def.scaler ?? {};
  const row = (label, child) => { const f = el('div', { className: 'f' }, box); el('label', { textContent: label }, f); return child(f); };
  const set = (patch) => { checkpoint(); const next = { ...(S.def.scaler ?? {}), ...patch }; if (!next.mode || next.mode === 'none') delete S.def.scaler; else S.def.scaler = next; refresh(); };
  row('Mode', (f) => { const sel = el('select', {}, f); for (const [v, t] of [['none', 'Off (pixels)'], ['constant', 'Constant factor'], ['scale', 'Scale with screen'], ['fit', 'Fit (letterbox)']]) el('option', { value: v, textContent: t }, sel); sel.value = sc.mode ?? 'none'; sel.onchange = () => set({ mode: sel.value, ref: sc.ref ?? [1280, 720] }); });
  if (!sc.mode) return;
  if (sc.mode === 'constant') row('Factor', (f) => { const i = el('input', { type: 'number', step: 'any', value: sc.factor ?? 1 }, f); i.onchange = () => set({ factor: Number(i.value) || 1 }); });
  else {
    row('Reference W×H', (f) => { const [w, h] = sc.ref ?? [1280, 720]; const a = el('input', { type: 'number', value: w }, f), b = el('input', { type: 'number', value: h }, f); a.style.width = b.style.width = '70px'; const go = () => set({ ref: [Number(a.value) || 1280, Number(b.value) || 720] }); a.onchange = go; b.onchange = go; });
    if (sc.mode === 'scale') row('Match W ↔ H', (f) => { const i = el('input', { type: 'range', min: 0, max: 1, step: 0.05, value: sc.match ?? 0.5 }, f); i.onchange = () => set({ match: Number(i.value) }); });
  }
  const [w, h] = $('#size').value.split('x').map(Number);
  el('small', { textContent: `Preview ${w}×${h} → scale ${scalerFactor(sc, w, h).toFixed(2)}×` }, box);
}

// Anchor preset grid (3×3 + fill), like the rect-transform anchor picker: click a cell to anchor the node there.
function anchorGrid(f, select, n) {
  const g = el('div', { className: 'anchors' }, f);
  const cells = [['tl', '↖'], ['t', '↑'], ['tr', '↗'], ['l', '←'], ['c', '●'], ['r', '→'], ['bl', '↙'], ['b', '↓'], ['br', '↘']];
  for (const [a, glyph] of cells) {
    const b = el('button', { textContent: glyph, title: a, className: n.anchor === a ? 'on' : '' }, g);
    b.onclick = () => { checkpoint(); put(n, 'anchor', a); select.value = a; refresh(); };
  }
  const fill = el('button', { textContent: 'fill', title: 'Fill the parent', className: n.anchor === 'fill' ? 'on wide' : 'wide' }, g);
  fill.onclick = () => { checkpoint(); put(n, 'anchor', 'fill'); select.value = 'fill'; refresh(); };
}

// Copy / paste nodes (Ctrl/Cmd+C, Ctrl/Cmd+V while not typing). Paste goes into the selected container, else next to the selection.
function copyNode(n) { if (n === S.def.root) return status('The root cannot be copied', true); S.clip = JSON.stringify(n); status('Copied ' + (n.name || n.type)); }
function pasteNode(into) {
  if (!S.clip) return status('Nothing copied yet', true);
  const c = JSON.parse(S.clip); if (c.name) c.name += '2';
  checkpoint();
  if (CONTAINERS.has(into.type)) (into.children ??= []).push(c);
  else { const r = find(S.def.root, into); (r.parent ?? S.def.root).children.splice(((r.parent ?? S.def.root).children.indexOf(into)) + 1, 0, c); }
  S.sel = c; refresh();
}
addEventListener('keydown', (e) => {
  if (!(e.metaKey || e.ctrlKey) || /INPUT|TEXTAREA|SELECT/.test(e.target.tagName) || !S.sel) return;
  if (e.key === 'c') { copyNode(S.sel); } else if (e.key === 'v') { e.preventDefault(); pasteNode(S.sel); }
});

function renderProps() {
  const p = $('#props'); p.textContent = '';
  const n = S.sel; if (!n) { p.textContent = 'Select a node.'; return; }
  el('h3', { textContent: `${n.type}${n.name ? ' · ' + n.name : ''}` }, p);
  if (n === S.def.root) scalerPanel(p);
  const rows = [...common, ...(n.type === 'image' ? IMGNODE : []), ...(FIELDS[n.type] ?? []), ...(n.type === 'button' ? SPRITES : []), ...(['image', 'canvas', 'html', 'spacer', 'instance'].includes(n.type) ? [] : IMG), ...tail];
  for (const [key, label, kind, dflt] of rows) {
    if (n === S.def.root && ['x', 'y', 'grow', 'visible'].includes(key)) continue;
    const f = el('div', { className: 'f' }, p); el('label', { textContent: label }, f);
    const cur = get(n, key);
    let inp;
    if (Array.isArray(kind)) { inp = el('select', {}, f); for (const o of kind) el('option', { value: o, textContent: o || '—' }, inp); inp.value = cur ?? ''; } else if (kind === 'bool') { inp = el('input', { type: 'checkbox', checked: cur ?? dflt ?? false }, f); inp.style.width = 'auto'; } else if (kind === 'area') inp = el('textarea', { value: cur ?? '' }, f);
    else if (kind === 'list') inp = el('input', { value: (cur ?? []).join(',') }, f);
    else if (kind === 'img') { inp = el('input', { value: cur ?? '', placeholder: 'assets/ui/panel.png' }, f); }
    else if (kind === 'tint') {
      inp = el('input', { value: cur ?? '', placeholder: '#ff5050 (white sprite -> red)' }, f);
      const pick = el('input', { type: 'color', value: /^#[0-9a-f]{6}$/i.test(cur ?? '') ? cur : '#ffffff', title: 'Pick tint' }, f); pick.style.width = '36px';
      pick.oninput = () => { inp.value = pick.value; inp.dispatchEvent(new Event('input')); };
    }
    else if (kind === 'nums') inp = el('input', { value: Array.isArray(cur) ? cur.join(' ') : cur ?? '', placeholder: '8 8 8 8' }, f);
    else inp = el('input', { type: kind === 'num' ? 'number' : 'text', step: 'any', value: Array.isArray(cur) ? cur.join(' ') : cur ?? '' }, f);
    const read = () => {
      const v = inp.type === 'checkbox' ? inp.checked : inp.value;
      if (kind === 'num') return v === '' ? undefined : Number(v);
      if (kind === 'list') return v ? v.split(',').map((s) => s.trim()) : undefined;
      if (kind === 'nums') { const a = String(v).split(/[\s,]+/).filter(Boolean).map(Number); return a.length === 1 ? a[0] : a.length === 4 ? a : undefined; }
      if ((key === 'margin' || key === 'padding') && /\s/.test(String(v).trim())) return String(v).trim().split(/\s+/).map(Number);
      if ((key === 'margin' || key === 'padding') && v !== '' && !isNaN(v)) return Number(v);
      return v;
    };
    if (kind === 'img') imageExtras(p, f, inp, key, n);
    if (key === 'anchor') anchorGrid(f, inp, n);
    if (key.startsWith('on.') && cur) actionUsage(p, String(cur), n);
    inp.onfocus = () => { inp._cp = true; };
    inp.oninput = () => { if (inp.type === 'checkbox' || inp.tagName === 'SELECT') return; if (inp._cp) { checkpoint(); inp._cp = false; } put(n, key, read()); renderStage(); renderTree(); };
    inp.onchange = () => { if (inp._cp !== false && (inp.type === 'checkbox' || inp.tagName === 'SELECT')) checkpoint(); put(n, key, read()); refresh(); };
  }
  const imgSrc = n.type === 'image' ? n.src : n.image?.src ?? (typeof n.image === 'string' ? n.image : '');
  if (imgSrc) sliceEditor(p, n, imgSrc);
  const acts = el('div', { className: 'acts' }, p);
  const btn = (t, f) => { el('button', { textContent: t, onclick: f }, acts); };
  btn('Duplicate', () => { const r = find(S.def.root, n); if (!r.parent) return; checkpoint(); const c = clone(n); if (c.name) c.name += '2'; r.parent.children.splice(r.parent.children.indexOf(n) + 1, 0, c); S.sel = c; refresh(); });
  btn('Copy', () => copyNode(n)); btn('Paste', () => pasteNode(n));
  if (n !== S.def.root && n.type !== 'instance') btn('Make UI prefab…', () => makePrefab(n));
  if (n.type === 'instance') { btn('Open prefab', () => { $('#file').value = n.ref; open(); }); btn('Unpack', () => unpackInstance(n)); }
  btn('Up', () => shift(n, -1)); btn('Down', () => shift(n, 1));
  btn('Delete', () => { const r = find(S.def.root, n); if (!r.parent) return; checkpoint(); r.parent.children.splice(r.parent.children.indexOf(n), 1); S.sel = r.parent; refresh(); });
}
// Visual 9-slice editor: drag the four guides over the image (like Unity's Sprite Editor).
function sliceEditor(parent, n, src) {
  const holder = n.type === 'image' ? n : (typeof n.image === 'string' ? (n.image = { src: n.image }) : n.image);
  const box = el('div', { className: 'slicebox' }, parent); el('label', { textContent: '9-slice editor (drag the guides)' }, box);
  const cv = el('canvas', {}, box); const img = new Image(); img.src = '/' + src.replace(/^\//, '');
  img.onload = () => {
    const sc = Math.max(1, Math.floor(260 / img.width)), W = img.width * sc, H = img.height * sc;
    cv.width = W; cv.height = H; cv.style.imageRendering = 'pixelated';
    let sl = Array.isArray(holder.slice) ? [...holder.slice] : [0, 0, 0, 0];
    const g = cv.getContext('2d');
    const draw = () => {
      g.clearRect(0, 0, W, H); g.fillStyle = '#3b4252'; g.fillRect(0, 0, W, H); g.imageSmoothingEnabled = false; g.drawImage(img, 0, 0, W, H);
      g.strokeStyle = '#ff6b9a'; g.lineWidth = 2;
      const line = (x0, y0, x1, y1) => { g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke(); };
      line(sl[0] * sc, 0, sl[0] * sc, H); line(W - sl[2] * sc, 0, W - sl[2] * sc, H); line(0, sl[1] * sc, W, sl[1] * sc); line(0, H - sl[3] * sc, W, H - sl[3] * sc);
    };
    draw();
    let drag = -1;
    const pos = (e) => { const r = cv.getBoundingClientRect(); return [(e.clientX - r.left) * W / r.width / sc, (e.clientY - r.top) * H / r.height / sc]; };
    cv.onpointerdown = (e) => { const [x, y] = pos(e); const d = [Math.abs(x - sl[0]), Math.abs(y - sl[1]), Math.abs(img.width - x - sl[2]), Math.abs(img.height - y - sl[3])]; const m = Math.min(...d); if (m < 6) { drag = d.indexOf(m); checkpoint(); cv.setPointerCapture(e.pointerId); } };
    cv.onpointermove = (e) => { if (drag < 0) return; const [x, y] = pos(e); const v = [x, y, img.width - x, img.height - y][drag]; sl[drag] = Math.max(0, Math.min(Math.round(v), (drag % 2 ? img.height : img.width) - 1)); holder.slice = [...sl]; if (!holder.mode && n.type !== 'image') holder.mode = 'slice'; draw(); renderStage(); };
    cv.onpointerup = () => { if (drag >= 0) { drag = -1; refresh(); } };
  };
}
// ── where is this action handled? ──
async function actionUsage(parent, action, n) {
  const box = el('div', { className: 'usage' }, parent); box.textContent = 'Searching code…';
  const list = await usagesOf(action);
  box.textContent = '';
  if (list === null) { el('small', { textContent: `Search is available in the Nord editor. Look for  menu.on('${action}', …)  in your script.` }, box); return; }
  if (!list.length) {
    el('small', { className: 'bad', textContent: `⚠ No code listens to "${action}" yet.` }, box);
    const b = el('button', { textContent: 'Copy code snippet' }, box); b.onclick = () => { navigator.clipboard?.writeText(snippet(action)); status('Snippet copied — paste it in the script that loads this UI file'); };
    return;
  }
  el('small', { textContent: `✓ Handled in ${list.length} place${list.length > 1 ? 's' : ''}:` }, box);
  for (const h of list.slice(0, 4)) {
    const row = el('div', { className: 'hit' }, box);
    el('code', { textContent: `${h.file}:${h.line}` }, row); el('span', { textContent: ' ' + h.text }, row);
    const o = el('button', { textContent: 'Open' }, row); o.onclick = () => openInEditor(h.file, h.line);
  }
}
async function fillActions() {
  const box = $('#actionsList'); box.textContent = 'Searching code…';
  const rows = []; walk(S.def.root, (nd) => { for (const [ev, a] of Object.entries(nd.on ?? {})) rows.push({ nd, ev, a }); });
  const found = await Promise.all(rows.map((r) => usagesOf(r.a)));
  box.textContent = '';
  if (!rows.length) { box.textContent = 'No actions yet. Select a button and type an Action name in Properties.'; }
  rows.forEach((r, i) => {
    const row = el('div', { className: 'arow' }, box); const list = found[i];
    el('b', { textContent: r.a }, row); el('small', { textContent: `${r.nd.name ?? r.nd.type} · ${r.ev}` }, row);
    if (list === null) el('small', { textContent: 'search needs the Nord editor' }, row);
    else if (!list.length) { el('small', { className: 'bad', textContent: '⚠ nothing listens' }, row); const b = el('button', { textContent: 'Copy snippet' }, row); b.onclick = () => navigator.clipboard?.writeText(snippet(r.a)); }
    else { const h = list[0]; const o = el('button', { textContent: `Open ${h.file}:${h.line}` }, row); o.onclick = () => openInEditor(h.file, h.line); if (list.length > 1) el('small', { textContent: `+${list.length - 1} more` }, row); }
    const sel = el('button', { textContent: 'Select node', title: 'Show this node in the Properties panel' }, row); sel.onclick = () => { S.sel = r.nd; refresh(); };
  });
  // checks: missing images, buttons with no action
  const bad = []; const imgs = [];
  walk(S.def.root, (nd) => { const src = nd.type === 'image' ? nd.src : typeof nd.image === 'string' ? nd.image : nd.image?.src; if (src) imgs.push([nd, src]); if (nd.type === 'button' && !nd.on?.pressed) bad.push(`Button "${nd.name ?? nd.text}" has no Action, so pressing it does nothing in code.`); });
  await Promise.all(imgs.map(([nd, src]) => new Promise((res) => { const im = new Image(); im.onload = res; im.onerror = () => { bad.push(`Image not found: ${src} (node "${nd.name ?? nd.type}")`); res(); }; im.src = '/' + src.replace(/^\//, ''); })));
  const ck = $('#checkList'); ck.textContent = '';
  for (const m of bad) el('li', { className: 'bad', textContent: m }, ck);
  if (!bad.length) el('li', { textContent: '✓ All images exist and every button has an action.' }, ck);
}
$('#actionsRefresh').onclick = () => { usageCache.clear(); fillActions(); };
$('#openScript').onclick = async () => {
  const base = ($('#file').value || 'menu').split('/').pop();
  const list = await usagesOf(base);
  if (list === null) return status('Needs the Nord editor (project search)', true);
  if (!list.length) return status(`No script loads ${base} yet — in code: await createUI(root).load('${$('#file').value}')`, true);
  if (list.length === 1) return openInEditor(list[0].file, list[0].line);
  modal('Scripts that load this UI file', (body, done) => { for (const h of list) { const r = el('div', { className: 'hit' }, body); el('code', { textContent: `${h.file}:${h.line}` }, r); el('span', { textContent: ' ' + h.text }, r); const o = el('button', { textContent: 'Open' }, r); o.onclick = () => { openInEditor(h.file, h.line); done(); }; } });
};

// ── images: browse, upload, preview, verify ──
function imageExtras(parent, row, inp, key, n) {
  const prev = el('div', { className: 'imgprev' }, parent);
  const btn = el('button', { textContent: 'Browse project images…', className: 'wide' }, row);
  const info = el('small', {}, prev); const th = el('img', {}, prev);
  const set = (v) => { checkpoint(); put(n, key, v); if (key === 'image.src' && !n.image.mode && !n.image.slice) { /* plain stretched image */ } refresh(); };
  const verify = () => {
    const v = inp.value.trim(); if (!v) { info.textContent = 'No image. Pick one with Browse, or type a path like assets/ui/panel.png'; th.removeAttribute('src'); th.style.display = 'none'; return; }
    th.style.display = ''; th.onload = () => { info.className = ''; info.textContent = `✓ found · ${th.naturalWidth}×${th.naturalHeight}px`; };
    th.onerror = () => { info.className = 'bad'; info.textContent = `✗ not found: ${v}. Check the path (relative to the project root).`; th.style.display = 'none'; };
    th.src = '/' + v.replace(/^\//, '') + '?t=' + Date.now();
  };
  verify(); inp.addEventListener('input', verify);
  btn.onclick = () => pickImage((v) => set(v));
  inp.addEventListener('dragover', (e) => e.preventDefault());
  inp.addEventListener('drop', async (e) => { const f = e.dataTransfer?.files?.[0]; if (!f) return; e.preventDefault(); const v = await uploadImage(f); if (v) set(v); });
}
async function uploadImage(file) {
  const name = file.name.replace(/[^a-zA-Z0-9_.-]/g, '-');
  if (!/\.(png|jpe?g|webp|gif)$/i.test(name)) { status('Use a PNG, JPG, WebP or GIF image', true); return null; }
  const path = 'assets/ui/' + name;
  const r = await fetch('/api/fpsc/save?path=' + encodeURIComponent(path), { method: 'POST', headers: { 'x-nord-fpsc': '1' }, body: await file.arrayBuffer() });
  if (!r.ok) { status('Upload failed: ' + await r.text(), true); return null; }
  status(`Copied into the project as ${path}`); return path;
}
function pickImage(onPick) {
  modal('Choose an image', async (body, done) => {
    const bar = el('div', { className: 'pbar' }, body);
    const q = el('input', { placeholder: 'Filter…' }, bar);
    const up = el('button', { textContent: 'Add from computer…', className: 'pri' }, bar);
    const file = el('input', { type: 'file', accept: 'image/png,image/jpeg,image/webp,image/gif', hidden: true }, bar);
    up.onclick = () => file.click(); file.onchange = async () => { const v = await uploadImage(file.files[0]); if (v) { onPick(v); done(); } };
    const grid = el('div', { className: 'pgrid' }, body); grid.textContent = 'Loading…';
    let all = [];
    try { all = (await (await fetch('/api/assets')).json()).filter((a) => a.type === 'image' || a.type === 'spritesheet'); } catch { grid.textContent = 'The project image list needs the Nord editor. Type the path instead, or use "Add from computer".'; return; }
    const draw = () => { grid.textContent = ''; const f = q.value.toLowerCase(); const list = all.filter((a) => a.path.toLowerCase().includes(f)).slice(0, 300); if (!list.length) grid.textContent = 'No images yet — use "Add from computer…".'; for (const a of list) { const c = el('button', { className: 'pimg', title: a.path }, grid); el('img', { src: '/' + a.path, loading: 'lazy' }, c); el('small', { textContent: a.path.split('/').pop() }, c); c.onclick = () => { onPick(a.path); done(); }; } };
    q.oninput = draw; draw();
  });
}

// ── UI prefabs: a node saved as its own ui/<name>.ui.json and used through `instance` nodes (edit once, changes everywhere) ──
const SLOT = ['name', 'anchor', 'x', 'y', 'w', 'h', 'grow', 'margin', 'visible'];
async function makePrefab(n) {
  const base = (n.name || n.type).replace(/[^a-zA-Z0-9_-]/g, '-');
  // no prompt(): the native web view does not show it. Name = node name, first free number.
  const taken = new Set(Array.from($('#files').options).map((o) => o.value));
  let k = 1, path = normName(base); while (taken.has(path)) path = normName(`${base}-${++k}`);
  const r = find(S.def.root, n); if (!r?.parent) return;
  const root = clone(n); for (const k of ['anchor', 'x', 'y', 'name']) delete root[k]; root.name = 'root';
  const def = { version: S.def.version ?? 1, name: path.replace(/^ui\//, '').replace('.ui.json', ''), theme: {}, root };
  const resp = await fetch('/api/fpsc/save?path=' + encodeURIComponent(path), { method: 'POST', headers: { 'x-nord-fpsc': '1' }, body: JSON.stringify(def, null, 2) + '\n' });
  if (!resp.ok) return status('Save failed: ' + await resp.text(), true);
  checkpoint();
  const inst = { type: 'instance', ref: path };
  for (const k of SLOT) if (n[k] !== undefined) inst[k] = n[k];
  r.parent.children[r.parent.children.indexOf(n)] = inst;
  mgr.define(path, def); mgr._resolved.set(path, def);
  S.sel = inst; list(); refresh(); status(`Saved ${path}; the node is now an instance of it`);
}
async function unpackInstance(n) {
  const r = find(S.def.root, n); if (!r?.parent) return;
  try { await mgr._preload({ children: [n] }); } catch (e) { return status(e.message, true); }
  const def = mgr._resolved.get(n.ref); if (!def) return status('Prefab file not found', true);
  checkpoint();
  const c = clone(def.root); for (const k of SLOT) if (n[k] !== undefined) c[k] = n[k]; if (!c.name || c.name === 'root') delete c.name;
  r.parent.children[r.parent.children.indexOf(n)] = c; S.sel = c; refresh();
}
/** Instances whose prefab file is not loaded yet are fetched once, then the preview redraws. */
const failedRefs = new Set();
async function preloadInstances() {
  let need = false; walk(S.def.root, (x) => { if (x.type === 'instance' && x.ref && !mgr._resolved.has(x.ref) && !failedRefs.has(x.ref)) need = true; });
  if (!need) return;
  try { await mgr._preload(S.def.root); } catch (e) { walk(S.def.root, (x) => { if (x.type === 'instance') failedRefs.add(x.ref); }); status(e.message, true); }
  refresh();
}

function shift(n, d) { const r = find(S.def.root, n); if (!r.parent) return; const a = r.parent.children, i = a.indexOf(n), j = i + d; if (j < 0 || j >= a.length) return; checkpoint(); [a[i], a[j]] = [a[j], a[i]]; refresh(); }

function addNode(type) {
  checkpoint();
  const base = S.sel && CONTAINERS.has(S.sel.type) ? S.sel : find(S.def.root, S.sel ?? S.def.root)?.parent ?? S.def.root;
  const d = clone(DEFAULTS[type]); const names = new Set(); walk(S.def.root, (x) => x.name && names.add(x.name));
  let i = 1; while (names.has(`${type}${i}`)) i++; d.name = `${type}${i}`;
  (base.children ??= []).push(d); S.sel = d; refresh();
}

// Preview: click selects, drag moves anchored nodes.
$('#stage').addEventListener('pointerdown', (e) => {
  const path = e.composedPath(); const hit = path.find((x) => x.__nord && x.__nord.screen.name === 'preview');
  if (!hit) return; e.preventDefault();
  const n = hit.__nord.def; if (S.sel !== n) { S.sel = n; renderTree(); renderProps(); renderStage(); }
  if (!n.anchor || n.anchor === 'fill' || n === S.def.root) return;
  const x0 = e.clientX, y0 = e.clientY, ox = n.x ?? 0, oy = n.y ?? 0; let moved = false;
  const mv = (m) => { const dx = (m.clientX - x0) / S.scale, dy = (m.clientY - y0) / S.scale; if (!moved && Math.hypot(dx, dy) < 3) return; if (!moved) { checkpoint(); moved = true; } n.x = Math.round(ox + dx); n.y = Math.round(oy + dy); renderStage(); };
  const up = () => { removeEventListener('pointermove', mv); removeEventListener('pointerup', up); if (moved) refresh(); };
  addEventListener('pointermove', mv); addEventListener('pointerup', up);
});

// Files
const normName = (v) => { let n = v.trim().replace(/^\/+/, ''); if (!n.startsWith('ui/')) n = 'ui/' + n; if (!n.endsWith('.ui.json')) n = n.replace(/(\.json)?$/, '.ui.json'); return n; };
async function list() { try { const r = await fetch('/api/fpsc/ls?dir=ui'); const l = r.ok ? (await r.json()).filter((e) => e.name.endsWith('.ui.json')) : []; const dl = $('#files'); dl.textContent = ''; for (const e of l) el('option', { value: 'ui/' + e.name }, dl); return l; } catch { return []; } }
async function open() {
  const name = normName($('#file').value || 'menu');
  const r = await fetch('/' + name); if (!r.ok) return status(`Cannot open ${name}`, true);
  try { S.def = await r.json(); } catch { return status('Not valid JSON', true); }
  $('#file').value = name; S.sel = S.def.root; S.undo = []; S.redo = []; S.dirty = false;
  await loadSkin(S.def.skin ?? ''); $('#skin').value = [...$('#skin').options].some((o) => o.value === (S.def.skin ?? '')) ? S.def.skin ?? '' : '';
  status(`Opened ${name}`); renderAll();
}
async function save() {
  const name = normName($('#file').value || 'menu');
  const r = await fetch('/api/fpsc/save?path=' + encodeURIComponent(name), { method: 'POST', headers: { 'x-nord-fpsc': '1' }, body: JSON.stringify(S.def, null, 2) + '\n' });
  if (!r.ok) return status('Save failed: ' + await r.text(), true);
  $('#file').value = name; S.dirty = false; status(`Saved ${name} — load it with game.ui.load('${name}')`); list();
}
async function newFile() {
  if (S.dirty && !(await askYes('Discard unsaved changes?', 'Discard'))) return;
  S.def = blank('menu');
  S.def.root.children = [
    { type: 'label', name: 'title', text: '[b]MY GAME[/b]', size: 44, anchor: 't', y: 60, align: 'center' },
    { type: 'vbox', name: 'buttons', anchor: 'c', gap: 12, w: 240, children: [
      { type: 'button', name: 'play', text: 'Play', on: { pressed: 'play' } },
      { type: 'button', name: 'quit', text: 'Quit', on: { pressed: 'quit' } },
    ] },
    { type: 'label', name: 'score', text: 'Score: {score}', anchor: 'tl', x: 16, y: 16 },
  ];
  S.sel = S.def.root; S.undo = []; S.redo = []; renderAll();
}

for (const t of NODE_TYPES) el('button', { textContent: t, onclick: () => addNode(t) }, $('#palette'));
for (const k of Object.keys(THEMES)) el('option', { value: k, textContent: k }, $('#theme'));
$('#tabActions').addEventListener('click', fillActions);
$('#skin').onchange = async () => { checkpoint(); const v = $('#skin').value; if (v) S.def.skin = v; else delete S.def.skin; await loadSkin(v); refresh(); };
$('#skinLoad').onclick = async () => { await loadSkin($('#skinFile').value.trim()); refresh(); };
$('#skinApply').onclick = applySkinText;
$('#skinSave').onclick = async () => {
  const path = $('#skinFile').value.trim() || 'ui/skin.json'; if (!/^ui\/[\w.-]+\.json$/.test(path)) return status('Skin path must be ui/<name>.json', true);
  const r = await fetch('/api/fpsc/save?path=' + encodeURIComponent(path), { method: 'POST', headers: { 'x-nord-fpsc': '1' }, body: $('#skinJson').value + '\n' });
  status(r.ok ? `Saved ${path}` : 'Save failed: ' + await r.text(), !r.ok);
};
$('#theme').onchange = () => { S.def.theme = { ...THEMES[$('#theme').value] }; checkpoint(); refresh(); };
$('#size').onchange = refresh;
$('#new').onclick = newFile; $('#open').onclick = open; $('#save').onclick = save;
$('#undo').onclick = () => restore(S.undo, S.redo); $('#redo').onclick = () => restore(S.redo, S.undo);
for (const b of document.querySelectorAll('.tabs button')) b.onclick = () => { document.querySelectorAll('.tabs button').forEach((x) => x.classList.toggle('on', x === b)); $('#props').hidden = b.dataset.tab !== 'props'; $('#jsonBox').hidden = b.dataset.tab !== 'json'; $('#stylesBox').hidden = b.dataset.tab !== 'styles'; $('#actionsBox').hidden = b.dataset.tab !== 'actions'; };
$('#applyJson').onclick = () => { try { const d = JSON.parse($('#json').value); const bad = validate(d); if (bad.length) return status(bad[0], true); checkpoint(); S.def = d; S.sel = d.root; refresh(); status('JSON applied'); } catch (e) { status('JSON error: ' + e.message, true); } };
addEventListener('keydown', (e) => {
  const mod = e.metaKey || e.ctrlKey; if (!mod || /INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) return;
  if (e.key === 's') { e.preventDefault(); save(); } else if (e.key === 'z') { e.preventDefault(); e.shiftKey ? restore(S.redo, S.undo) : restore(S.undo, S.redo); }
});
addEventListener('beforeunload', (e) => { if (S.dirty) e.preventDefault(); });
addEventListener('resize', refresh);

(async () => {
  const l = await list();
  newFile();
  const want = new URLSearchParams(location.search).get('file');
  const first = want ? { name: want.replace(/^ui\//, '') } : l.find((e) => e.name === 'menu.ui.json') ?? l[0];
  if (first) { $('#file').value = 'ui/' + first.name; await open(); } else $('#file').value = 'ui/menu.ui.json';
})();
