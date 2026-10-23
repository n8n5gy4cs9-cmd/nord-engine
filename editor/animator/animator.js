// Animator editor: visual state machine for `anim/*.animator.json` (runtime: runtime/core/animator.js, docs/ANIMATOR.md).
// Behaviour cloned from Unity's Animator window: states, Any State, transitions with exit time + conditions, parameters, live test.
import { AnimatorController, validateController, MODES_FOR, ANY, PARAM_TYPES } from '/runtime/core/animator.js';
import { askText, askYes } from '../common/dialog.js';

const $ = (s) => document.querySelector(s);
// `list` is read-only on inputs, so it goes through setAttribute
const el = (tag, props = {}, parent) => {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) { if (k === 'text') e.textContent = v; else if (k.startsWith('on')) e[k] = v; else if (k in e && k !== 'list') e[k] = v; else e.setAttribute(k, v); }
  parent?.append(e); return e;
};
const NODE_W = 150, NODE_H = 40;
const MODE_LABEL = { if: 'is true', ifNot: 'is false', greater: '>', less: '<', equals: '==', notEqual: '!=' };
const blank = () => ({ parameters: [], states: [{ name: 'Idle', anim: 'idle', speed: 1, x: 320, y: 220 }], default: 'Idle', transitions: [], editor: { any: { x: 60, y: 60 } } });

let S = blank(), sel = null, linking = null, tester = null, tick = null, undo = [], redo = [], current = '';
const status = (t) => { $('#status').textContent = t; };
const snapshot = () => JSON.stringify(S);
function checkpoint() { undo.push(snapshot()); if (undo.length > 100) undo.shift(); redo = []; }
const stateOf = (n) => S.states.find((s) => s.name === n);
const posOf = (id) => (id === ANY ? S.editor.any : stateOf(id));
const centre = (id) => { const p = posOf(id); return [p.x + NODE_W / 2, p.y + NODE_H / 2]; };

// ---------- rendering ----------
function render() {
  renderParams(); renderNodes(); renderWires(); renderProps(); renderChecks(); rebuildTester();
}

function renderParams() {
  const box = $('#params'); box.textContent = '';
  S.parameters.forEach((p, i) => {
    const row = el('div', { className: 'prow' }, box);
    el('input', { value: p.name, spellcheck: false, onchange: (e) => renameParam(i, e.target.value) }, row);
    const type = el('select', { onchange: (e) => changeParamType(i, e.target.value) }, row);
    for (const t of PARAM_TYPES) el('option', { value: t, text: t, selected: t === p.type }, type);
    if (p.type === 'bool') el('input', { type: 'checkbox', checked: !!p.default, onchange: (e) => { checkpoint(); p.default = e.target.checked; render(); } }, row);
    else if (p.type === 'trigger') el('span', {}, row);
    else el('input', { type: 'number', value: p.default ?? 0, step: p.type === 'int' ? 1 : 0.1, onchange: (e) => { checkpoint(); p.default = Number(e.target.value) || 0; render(); } }, row);
    el('button', { text: '×', title: 'Delete parameter', onclick: () => { checkpoint(); const n = p.name; S.parameters.splice(i, 1); for (const t of S.transitions) t.conditions = (t.conditions ?? []).filter((c) => c.param !== n); render(); } }, row);
    if (tester) {
      const live = el('div', { className: 'live' }, row);
      if (p.type === 'trigger') el('button', { text: 'Set trigger', onclick: () => tester.setTrigger(p.name) }, live);
      else if (p.type === 'bool') el('label', {}, live).append(el('input', { type: 'checkbox', checked: !!tester.get(p.name), onchange: (e) => tester.set(p.name, e.target.checked) }), ' live value');
      else el('input', { type: 'number', value: tester.get(p.name), step: p.type === 'int' ? 1 : 0.1, title: 'live value', oninput: (e) => tester.set(p.name, e.target.value) }, live);
    }
  });
}

function renderNodes() {
  const box = $('#nodes'); box.textContent = '';
  const make = (id, label, sub) => {
    const p = posOf(id);
    const n = el('div', { className: 'node' + (id === ANY ? ' any' : '') + (id === S.default ? ' entry' : '') + (isSel(id) ? ' sel' : '') + (linking && linking.from === id ? ' link' : '') }, box);
    n.dataset.id = id; n.style.left = p.x + 'px'; n.style.top = p.y + 'px';
    n.append(el('div', { text: label }));
    if (sub) n.firstChild.append(el('small', { text: sub }));
    n.onpointerdown = (e) => nodeDown(e, id, n);
    return n;
  };
  make(ANY, 'Any State');
  for (const s of S.states) make(s.name, s.name, s.anim && s.anim !== s.name ? `▶ ${s.anim}` : (s.speed && s.speed !== 1 ? `×${s.speed}` : ''));
}
const isSel = (id) => sel && (sel.kind === 'state' ? sel.name === id : sel.kind === 'any' && id === ANY);

function edge(c, d) { // point on the rectangle border of a node centred at c, towards direction d (unit)
  const t = Math.min(NODE_W / 2 / (Math.abs(d[0]) || 1e-9), NODE_H / 2 / (Math.abs(d[1]) || 1e-9));
  return [c[0] + d[0] * t, c[1] + d[1] * t];
}
const SVGNS = 'http://www.w3.org/2000/svg';
function renderWires() {
  const svg = $('#wires');
  svg.innerHTML = '<defs><marker id="arr" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="9" markerHeight="9" orient="auto"><path d="M0 0L10 5L0 10z" fill="#9aa5b8"/></marker></defs>';
  const seen = new Map();
  S.transitions.forEach((t, i) => {
    if (!posOf(t.from) || !posOf(t.to)) return;
    const key = [t.from, t.to].sort().join('\u0000'); const k = seen.get(key) ?? 0; seen.set(key, k + 1);
    const a = centre(t.from), b = centre(t.to); let dx = b[0] - a[0], dy = b[1] - a[1]; const len = Math.hypot(dx, dy) || 1; dx /= len; dy /= len;
    const side = (t.from < t.to ? 1 : -1) * (k + 1) * 9; // parallel arrows for the pairs A→B / B→A
    const nx = -dy * side, ny = dx * side;
    const p0 = edge([a[0] + nx, a[1] + ny], [dx, dy]), p1 = edge([b[0] + nx, b[1] + ny], [-dx, -dy]);
    const d = `M${p0[0]},${p0[1]} L${p1[0]},${p1[1]}`;
    const vis = document.createElementNS(SVGNS, 'path'); vis.setAttribute('d', d); vis.setAttribute('marker-end', 'url(#arr)');
    vis.setAttribute('class', sel?.kind === 'tr' && sel.i === i ? 'sel' : ''); vis.dataset.tr = i; vis.style.pointerEvents = 'none';
    const hit = document.createElementNS(SVGNS, 'path'); hit.setAttribute('d', d); hit.setAttribute('class', 'hit');
    hit.onclick = () => { sel = { kind: 'tr', i }; linking = null; render(); };
    svg.append(vis, hit);
  });
}

function renderProps() {
  const box = $('#props'); box.textContent = '';
  if (!sel) { el('p', { className: 'hint', text: 'Drag states to arrange them. Click a state or an arrow to edit it. Select a state, press “Make transition” and click the target state. The orange state is the default (entry).' }, box); return; }
  const field = (label, input) => { const r = el('div', { className: 'f' }, box); el('label', { text: label }, r); r.append(input); return input; };
  if (sel.kind === 'any' || sel.kind === 'state') {
    const s = sel.kind === 'state' ? stateOf(sel.name) : null;
    if (sel.kind === 'any') el('h3', { text: 'Any State' }, box); else {
      el('h3', { text: 'State' }, box);
      field('Name', el('input', { value: s.name, spellcheck: false, onchange: (e) => renameState(s, e.target.value) }));
      field('Animation', el('input', { value: s.anim ?? '', list: 'anims', placeholder: 'sprite clip or glTF animation name', onchange: (e) => { checkpoint(); s.anim = e.target.value; render(); } }));
      field('Speed', el('input', { type: 'number', value: s.speed ?? 1, step: 0.1, onchange: (e) => { checkpoint(); s.speed = Number(e.target.value) || 1; render(); } }));
      field('Loop', el('input', { type: 'checkbox', checked: s.loop !== false, title: '3D models: loop the animation group (sprites use the clip\'s own setting)', onchange: (e) => { checkpoint(); s.loop = e.target.checked; render(); } }));
      field('Clip length (s)', el('input', { type: 'number', value: s.length ?? 0, step: 0.1, min: 0, title: 'Used for exit times. 0 = ask the running sprite (Phaser) or 1 second here in the editor', onchange: (e) => { checkpoint(); s.length = Math.max(0, Number(e.target.value) || 0); render(); } }));
    }
    const acts = el('div', { className: 'acts' }, box);
    el('button', { text: linking ? 'Click the target state…' : 'Make transition', className: linking ? 'on' : '', onclick: () => { linking = linking ? null : { from: sel.kind === 'any' ? ANY : sel.name }; status(linking ? 'Click the target state (Esc cancels)' : ''); render(); } }, acts);
    if (s) {
      el('button', { text: 'Set as default', disabled: S.default === s.name, onclick: () => { checkpoint(); S.default = s.name; render(); } }, acts);
      el('button', { text: 'Duplicate', onclick: () => { checkpoint(); const c = { ...s, name: uniqueName(s.name), x: s.x + 30, y: s.y + 60 }; S.states.push(c); sel = { kind: 'state', name: c.name }; render(); } }, acts);
      el('button', { text: 'Delete', onclick: () => deleteSelection() }, acts);
    }
    return;
  }
  const t = S.transitions[sel.i]; if (!t) { sel = null; renderProps(); return; }
  el('h3', { text: `Transition: ${t.from === ANY ? 'Any State' : t.from} → ${t.to}` }, box);
  field('Has exit time', el('input', { type: 'checkbox', checked: !!t.hasExitTime, onchange: (e) => { checkpoint(); t.hasExitTime = e.target.checked; render(); } }));
  if (t.hasExitTime) field('Exit time', el('input', { type: 'number', value: t.exitTime ?? 1, step: 0.05, min: 0, title: 'Normalised time in the state: 1 = after one clip length', onchange: (e) => { checkpoint(); t.exitTime = Math.max(0, Number(e.target.value) || 0); render(); } }));
  if (t.from === ANY) field('To self', el('input', { type: 'checkbox', checked: !!t.canTransitionToSelf, title: 'Can transition to itself (restart the state)', onchange: (e) => { checkpoint(); t.canTransitionToSelf = e.target.checked; render(); } }));
  el('h3', { text: 'Conditions (all must hold)' }, box);
  (t.conditions ??= []).forEach((c, ci) => {
    const row = el('div', { className: 'crow' }, box);
    const ps = el('select', { onchange: (e) => { checkpoint(); c.param = e.target.value; fixCondition(c); render(); } }, row);
    for (const p of S.parameters) el('option', { value: p.name, text: p.name, selected: p.name === c.param }, ps);
    const type = S.parameters.find((p) => p.name === c.param)?.type;
    const ms = el('select', { onchange: (e) => { checkpoint(); c.mode = e.target.value; render(); } }, row);
    for (const m of MODES_FOR[type] ?? []) el('option', { value: m, text: MODE_LABEL[m], selected: m === c.mode }, ms);
    if (type === 'int' || type === 'float') el('input', { type: 'number', value: c.value ?? 0, step: type === 'int' ? 1 : 0.1, onchange: (e) => { checkpoint(); c.value = Number(e.target.value) || 0; render(); } }, row); else el('span', {}, row);
    el('button', { text: '×', onclick: () => { checkpoint(); t.conditions.splice(ci, 1); render(); } }, row);
  });
  const acts = el('div', { className: 'acts' }, box);
  el('button', { text: '+ Condition', disabled: !S.parameters.length, title: S.parameters.length ? '' : 'Add a parameter first', onclick: () => { checkpoint(); const c = { param: S.parameters[0].name }; fixCondition(c); t.conditions.push(c); render(); } }, acts);
  el('button', { text: 'Delete transition', onclick: () => deleteSelection() }, acts);
}
function fixCondition(c) { // keep the mode valid for the parameter's type (Unity does the same when you switch parameters)
  const type = S.parameters.find((p) => p.name === c.param)?.type; const ok = MODES_FOR[type] ?? [];
  if (!ok.includes(c.mode)) c.mode = ok[0]; if ((type === 'int' || type === 'float') && c.value == null) c.value = 0;
}

function renderChecks() {
  const ul = $('#checks'); ul.textContent = '';
  const bad = validateController(S);
  if (!bad.length) el('li', { className: 'good', text: 'No problems' }, ul);
  for (const b of bad) el('li', { className: 'bad', text: b }, ul);
}

// ---------- editing ----------
const uniqueName = (base) => { let n = base, i = 2; while (stateOf(n)) n = `${base} ${i++}`; return n; };
function renameState(s, name) {
  name = name.trim(); if (!name || name === ANY || (name !== s.name && stateOf(name))) { status('That state name is empty or already used'); render(); return; }
  checkpoint(); const old = s.name; s.name = name; if (S.default === old) S.default = name;
  for (const t of S.transitions) { if (t.from === old) t.from = name; if (t.to === old) t.to = name; }
  sel = { kind: 'state', name }; render();
}
function renameParam(i, name) {
  name = name.trim(); const p = S.parameters[i];
  if (!name || (name !== p.name && S.parameters.some((q) => q.name === name))) { status('That parameter name is empty or already used'); render(); return; }
  checkpoint(); const old = p.name; p.name = name; for (const t of S.transitions) for (const c of t.conditions ?? []) if (c.param === old) c.param = name; render();
}
function changeParamType(i, type) {
  checkpoint(); const p = S.parameters[i]; p.type = type; p.default = type === 'bool' ? false : type === 'trigger' ? undefined : 0;
  for (const t of S.transitions) for (const c of t.conditions ?? []) if (c.param === p.name) fixCondition(c); render();
}
function deleteSelection() {
  if (!sel) return;
  if (sel.kind === 'tr') { checkpoint(); S.transitions.splice(sel.i, 1); sel = null; render(); return; }
  if (sel.kind === 'state') {
    if (S.states.length < 2) { status('A controller needs at least one state'); return; }
    checkpoint(); const n = sel.name; S.states = S.states.filter((s) => s.name !== n); S.transitions = S.transitions.filter((t) => t.from !== n && t.to !== n);
    if (S.default === n) S.default = S.states[0].name; sel = null; render();
  }
}

// ---------- node dragging / linking ----------
function nodeDown(e, id, node) {
  if (e.button !== 0) return; e.stopPropagation();
  if (linking) {
    if (id !== ANY) { checkpoint(); S.transitions.push({ from: linking.from, to: id, hasExitTime: true, exitTime: 1, conditions: [] }); sel = { kind: 'tr', i: S.transitions.length - 1 }; status(''); }
    linking = null; render(); return;
  }
  sel = id === ANY ? { kind: 'any' } : { kind: 'state', name: id };
  const p = posOf(id), sx = e.clientX, sy = e.clientY, ox = p.x, oy = p.y; let moved = false;
  node.setPointerCapture(e.pointerId);
  node.onpointermove = (m) => {
    const dx = m.clientX - sx, dy = m.clientY - sy;
    if (!moved) { if (Math.abs(dx) + Math.abs(dy) < 4) return; checkpoint(); moved = true; }
    p.x = Math.max(0, Math.round((ox + dx) / 10) * 10); p.y = Math.max(0, Math.round((oy + dy) / 10) * 10);
    node.style.left = p.x + 'px'; node.style.top = p.y + 'px'; renderWires();
  };
  node.onpointerup = () => { node.onpointermove = null; node.onpointerup = null; render(); };
}
$('#center').addEventListener('pointerdown', (e) => { if (e.target.closest('.node') || e.target.closest('path')) return; sel = null; linking = null; status(''); render(); });
document.addEventListener('keydown', (e) => {
  if (/INPUT|SELECT|TEXTAREA/.test(e.target.tagName)) return;
  if (e.key === 'Escape') { linking = null; status(''); render(); }
  else if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); deleteSelection(); }
  else if ((e.metaKey || e.ctrlKey) && e.key === 'z') { e.preventDefault(); doUndo(e.shiftKey); }
  else if ((e.metaKey || e.ctrlKey) && e.key === 's') { e.preventDefault(); save(); }
});
function doUndo(redoIt) {
  const from = redoIt ? redo : undo, to = redoIt ? undo : redo; if (!from.length) return;
  to.push(snapshot()); S = JSON.parse(from.pop()); sel = null; linking = null; render();
}

// ---------- live test ----------
function rebuildTester() {
  if (!tester) return;
  const prev = tester;
  try {
    tester = new AnimatorController(structuredClone(S));
    for (const p of S.parameters) if (prev.has(p.name) && prev.types[p.name] === p.type) tester.params[p.name] = prev.params[p.name];
    if (S.states.some((s) => s.name === prev.state)) { tester.state = prev.state; tester.speed = prev.speed; tester.time = prev.time; }
  } catch (err) { status('Test paused: ' + err.message); }
}
function markActive() {
  document.querySelectorAll('.node').forEach((n) => n.classList.toggle('active', !!tester && n.dataset.id === tester.state));
  if (tester) status(`Test: ${tester.state}  (t = ${tester.normalized().toFixed(2)})`);
}
$('#test').onclick = () => {
  if (tester) { tester = null; clearInterval(tick); $('#test').classList.remove('on'); $('#test').textContent = '▶ Test'; status(''); render(); return; }
  if (!S.states.length) return;
  tester = new AnimatorController(structuredClone(S)); tester.lengthHint = 1;
  $('#test').classList.add('on'); $('#test').textContent = '■ Stop test'; render();
  tick = setInterval(() => { if (!tester) return; tester.lengthHint = 1; const was = tester.state; tester.update(0.05); markActive(); if (was !== tester.state) renderParams(); }, 50);
};

// ---------- files ----------
const normPath = (p) => { p = p.trim().replace(/^\/+/, ''); if (!p) return ''; if (!p.includes('/')) p = 'anim/' + p; if (!p.endsWith('.animator.json')) p = p.replace(/\.json$/, '') + '.animator.json'; return p; };
async function listFiles() { try { const r = await fetch('/api/fpsc/ls?dir=anim'); const l = r.ok ? (await r.json()).filter((e) => e.name.endsWith('.animator.json')) : []; const dl = $('#files'); dl.textContent = ''; for (const e of l) el('option', { value: 'anim/' + e.name }, dl); return l; } catch { return []; } }
async function loadAnimNames() {
  try {
    const all = await (await fetch('/api/assets')).json(); const names = new Set();
    for (const a of all) for (const k of Object.keys(a.meta?.anims ?? {})) names.add(k);
    const dl = $('#anims'); dl.textContent = ''; for (const n of [...names].sort()) el('option', { value: n }, dl);
  } catch { /* outside the editor: free text only */ }
}
async function save() {
  const path = normPath($('#file').value) || 'anim/controller.animator.json'; $('#file').value = path;
  try {
    const r = await fetch('/api/fpsc/save?path=' + encodeURIComponent(path), { method: 'POST', headers: { 'x-nord-fpsc': '1' }, body: JSON.stringify(S, null, 2) + '\n' });
    if (!r.ok) throw new Error(await r.text() || r.status);
    current = path; status('Saved ' + path); listFiles();
  } catch (e) { status('Save failed: ' + e.message); }
}
async function open(path) {
  path = normPath(path); if (!path) return;
  try {
    const r = await fetch('/' + path, { cache: 'no-store' }); if (!r.ok) throw new Error('HTTP ' + r.status);
    const def = await r.json(); if (!Array.isArray(def.states) || !def.states.length) throw new Error('not an animator controller');
    checkpoint(); S = { parameters: [], transitions: [], ...def, editor: { any: { x: 60, y: 60 }, ...(def.editor ?? {}) } };
    S.states.forEach((s, i) => { s.x ??= 320 + (i % 3) * 200; s.y ??= 160 + Math.floor(i / 3) * 120; });
    sel = null; linking = null; current = path; $('#file').value = path; status('Opened ' + path); render();
  } catch (e) { status('Open failed: ' + e.message); }
}
$('#save').onclick = save; $('#open').onclick = () => open($('#file').value);
$('#undo').onclick = () => doUndo(false); $('#redo').onclick = () => doUndo(true);
$('#new').onclick = async () => {
  if (undo.length && !await askYes('Start a new controller? Unsaved changes are lost.', 'New')) return;
  S = blank(); sel = null; linking = null; undo = []; redo = []; current = ''; $('#file').value = ''; render();
};
$('#addState').onclick = async () => {
  const name = (await askText('State name', uniqueName('State')))?.trim(); if (!name || stateOf(name) || name === ANY) return;
  checkpoint();
  const right = Math.max(...S.states.map((s) => s.x)) + 190; // next free slot to the right (wraps to a new row)
  S.states.push({ name, anim: name.toLowerCase(), speed: 1, x: right < 1800 ? right : 320, y: right < 1800 ? 220 : 220 + 100 * Math.ceil(S.states.length / 6) });
  sel = { kind: 'state', name }; render();
};
$('#addParam').onclick = async () => {
  const name = (await askText('Parameter name', 'speed'))?.trim(); if (!name || S.parameters.some((p) => p.name === name)) return;
  checkpoint(); S.parameters.push({ name, type: 'float', default: 0 }); render();
};

// ---------- start ----------
await listFiles(); await loadAnimNames();
const q = new URLSearchParams(location.search).get('file');
render();
if (q) await open(q);
