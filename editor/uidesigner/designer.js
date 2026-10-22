// Nord UI Designer — edits ui/*.ui.json (spec: docs/UI_SCENES.md). The preview is the real runtime (runtime/core/uiscene.js).
import { UIManager, blank, validate, compileSkin, NODE_TYPES, CONTAINERS } from '/runtime/core/uiscene.js';

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
const IMG = [['image.src', 'Image', 'text'], ['image.mode', 'Image mode', ['', 'slice', 'stretch', 'tile', 'fit', 'cover', 'center']], ['image.slice', '9-slice L T R B', 'nums'], ['image.scale', 'Slice scale', 'num'], ['image.pixelated', 'Pixelated', 'bool']];
const IMGNODE = [['src', 'Image', 'text'], ['mode', 'Mode', ['', 'slice', 'stretch', 'tile', 'fit', 'cover', 'center']], ['slice', '9-slice L T R B', 'nums'], ['scale', 'Slice scale', 'num']];
const tail = [['visible', 'Visible', 'bool', true], ['disabled', 'Disabled', 'bool'], ['bind.text', 'Bind text var', 'text'], ['tooltip', 'Tooltip', 'text']];

const SKINS = { '': null };
const S = { skin: null, skinPath: '',  def: blank('menu'), sel: null, undo: [], redo: [], dirty: false, scale: 1 };
const mgr = new UIManager($('#stage'), { assetBase: '/' }); // project files are served from the site root
let rafPending = false;

const status = (m, bad) => { const s = $('#status'); s.textContent = m; s.className = bad ? 'bad' : ''; };
const clone = (o) => JSON.parse(JSON.stringify(o));
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
    $('#skinFile').value = path; $('#skinJson').value = JSON.stringify(S.skin, null, 2);
  } catch (e) { S.skin = null; mgr.skinCss = ''; if (path !== 'ui/skin.json') status(`Skin ${path}: ${e.message}`, true); }
}
function applySkinText() {
  try { S.skin = JSON.parse($('#skinJson').value); mgr.skinCss = compileSkin(S.skin, '/'); refresh(); status('Skin applied'); } catch (e) { status('Skin error: ' + e.message, true); }
}
function checkpoint() { S.undo.push(JSON.stringify(S.def)); if (S.undo.length > 100) S.undo.shift(); S.redo = []; S.dirty = true; }
function restore(from, to) { if (!from.length) return; to.push(JSON.stringify(S.def)); S.def = JSON.parse(from.pop()); S.sel = S.def.root; refresh(); }
function refresh() { if (rafPending) return; rafPending = true; requestAnimationFrame(() => { rafPending = false; renderAll(); }); }

function renderAll() { renderStage(); renderTree(); renderProps(); $('#json').value = JSON.stringify(S.def, null, 2); const bad = validate(S.def); if (bad.length) status(bad[0], true); }

function renderStage() {
  const [w, h] = $('#size').value.split('x').map(Number);
  const st = $('#stage'); st.style.width = w + 'px'; st.style.height = h + 'px';
  const room = $('#center'); S.scale = Math.min(1, (room.clientWidth - 32) / w, (room.clientHeight - 32) / h);
  st.style.transform = `scale(${S.scale})`; st.parentElement.style.width = w * S.scale + 'px'; st.parentElement.style.height = h * S.scale + 'px';
  const screen = mgr.build(S.def, { name: 'preview' });
  screen.host.style.pointerEvents = 'auto';
  if (S.sel) { const n = [...screen.byName.values()].find((x) => x.def === S.sel) ?? findEl(screen.rootEl, S.sel); if (n) (n.el ?? n).style.outline = '2px dashed #88c0d0'; }
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

function renderProps() {
  const p = $('#props'); p.textContent = '';
  const n = S.sel; if (!n) { p.textContent = 'Select a node.'; return; }
  el('h3', { textContent: `${n.type}${n.name ? ' · ' + n.name : ''}` }, p);
  const rows = [...common, ...(n.type === 'image' ? IMGNODE : []), ...(FIELDS[n.type] ?? []), ...(['image', 'canvas', 'html', 'spacer', 'instance'].includes(n.type) ? [] : IMG), ...tail];
  for (const [key, label, kind, dflt] of rows) {
    if (n === S.def.root && ['x', 'y', 'grow', 'visible'].includes(key)) continue;
    const f = el('div', { className: 'f' }, p); el('label', { textContent: label }, f);
    const cur = get(n, key);
    let inp;
    if (Array.isArray(kind)) { inp = el('select', {}, f); for (const o of kind) el('option', { value: o, textContent: o || '—' }, inp); inp.value = cur ?? ''; } else if (kind === 'bool') { inp = el('input', { type: 'checkbox', checked: cur ?? dflt ?? false }, f); inp.style.width = 'auto'; } else if (kind === 'area') inp = el('textarea', { value: cur ?? '' }, f);
    else if (kind === 'list') inp = el('input', { value: (cur ?? []).join(',') }, f);
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
    inp.onfocus = () => { inp._cp = true; };
    inp.oninput = () => { if (inp.type === 'checkbox' || inp.tagName === 'SELECT') return; if (inp._cp) { checkpoint(); inp._cp = false; } put(n, key, read()); renderStage(); renderTree(); };
    inp.onchange = () => { if (inp._cp !== false && (inp.type === 'checkbox' || inp.tagName === 'SELECT')) checkpoint(); put(n, key, read()); refresh(); };
  }
  const imgSrc = n.type === 'image' ? n.src : n.image?.src ?? (typeof n.image === 'string' ? n.image : '');
  if (imgSrc) sliceEditor(p, n, imgSrc);
  const acts = el('div', { className: 'acts' }, p);
  const btn = (t, f) => { el('button', { textContent: t, onclick: f }, acts); };
  btn('Duplicate', () => { const r = find(S.def.root, n); if (!r.parent) return; checkpoint(); const c = clone(n); if (c.name) c.name += '2'; r.parent.children.splice(r.parent.children.indexOf(n) + 1, 0, c); S.sel = c; refresh(); });
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
      g.strokeStyle = '#ff6b9a'; g.lineWidth = 1; g.beginPath();
      g.moveTo(sl[0] * sc + .5, 0); g.lineTo(sl[0] * sc + .5, H); g.moveTo(W - sl[2] * sc - .5, 0); g.lineTo(W - sl[2] * sc - .5, H);
      g.moveTo(0, sl[1] * sc + .5); g.lineTo(W, sl[1] * sc + .5); g.moveTo(0, H - sl[3] * sc - .5); g.lineTo(W, H - sl[3] * sc - .5); g.stroke();
    };
    draw();
    let drag = -1;
    const pos = (e) => { const r = cv.getBoundingClientRect(); return [(e.clientX - r.left) * W / r.width / sc, (e.clientY - r.top) * H / r.height / sc]; };
    cv.onpointerdown = (e) => { const [x, y] = pos(e); const d = [Math.abs(x - sl[0]), Math.abs(y - sl[1]), Math.abs(img.width - x - sl[2]), Math.abs(img.height - y - sl[3])]; const m = Math.min(...d); if (m < 6) { drag = d.indexOf(m); checkpoint(); cv.setPointerCapture(e.pointerId); } };
    cv.onpointermove = (e) => { if (drag < 0) return; const [x, y] = pos(e); const v = [x, y, img.width - x, img.height - y][drag]; sl[drag] = Math.max(0, Math.min(Math.round(v), (drag % 2 ? img.height : img.width) - 1)); holder.slice = [...sl]; if (!holder.mode && n.type !== 'image') holder.mode = 'slice'; draw(); renderStage(); };
    cv.onpointerup = () => { if (drag >= 0) { drag = -1; refresh(); } };
  };
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
function newFile() {
  if (S.dirty && !confirm('Discard unsaved changes?')) return;
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
for (const b of document.querySelectorAll('.tabs button')) b.onclick = () => { document.querySelectorAll('.tabs button').forEach((x) => x.classList.toggle('on', x === b)); $('#props').hidden = b.dataset.tab !== 'props'; $('#jsonBox').hidden = b.dataset.tab !== 'json'; $('#stylesBox').hidden = b.dataset.tab !== 'styles'; };
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
  const first = l.find((e) => e.name === 'menu.ui.json') ?? l[0];
  if (first) { $('#file').value = 'ui/' + first.name; await open(); } else $('#file').value = 'ui/menu.ui.json';
})();
