// Nord Graph Editor — litegraph.js canvas (MIT, vendor/litegraph) + Nord's node library (runtime/core/graph/nodes.js).
// Saves graphs/<name>.graph.json; the runtime (runtime/core/graph/runner.js) executes them. Spec: docs/GRAPH.md
import { NODES, SLOT_COLORS, validate } from '/runtime/core/graph/nodes.js';

// Chrome reports this harmless layout notification as an error; do not let it reach the editor console.
addEventListener('error', (e) => { if (/ResizeObserver loop/.test(e.message)) e.stopImmediatePropagation(); });
const ipc = (m) => fetch('/api/ipc', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(m) }).catch(() => {});
const LG = window.LiteGraph;
LG.low_quality_scale = 0.2; // keep titles and pin names visible when zoomed out (patched vendor/litegraph)
const $ = (s) => document.querySelector(s);
const el = (tag, props = {}, parent) => { const e = Object.assign(document.createElement(tag), props); parent?.appendChild(e); return e; };
const status = (m, bad) => { const s = $('#status'); s.textContent = m; s.className = bad ? 'bad' : ''; };

// ── slot compatibility: any fits everything; numbers/booleans/strings convert; entity~object; array~object ──
const SOFT = [['number', 'boolean'], ['number', 'string'], ['entity', 'object'], ['array', 'object'], ['vec3', 'array']];
LG.isValidConnection = (a, b) => {
  a = String(a ?? 'any'); b = String(b ?? 'any');
  if (a === 'exec' || b === 'exec') return a === b;
  return a === b || a === 'any' || b === 'any' || a === '*' || b === '*' || SOFT.some(([x, y]) => (a === x && b === y) || (a === y && b === x));
};

// ── category look ──
const CAT_COLOR = { Events: ['#7a2e3a', '#4a1d25'], Flow: ['#3d5a80', '#25374f'], Variables: ['#6b5b2e', '#42381c'], Math: ['#2f6b5f', '#1d423a'], Logic: ['#2f6b5f', '#1d423a'], Vector: ['#5a3f80', '#38264f'], Text: ['#7a5a2e', '#4a371c'], Array: ['#3f6b2f', '#264a1d'], Entity: ['#2e5a7a', '#1d384a'], Physics: ['#6b3f2e', '#42261c'], Input: ['#2e6b4a', '#1c4230'], UI: ['#6b2e5a', '#421c38'], Audio: ['#7a2e6b', '#4a1c42'], Game: ['#4a4a6b', '#2e2e42'], Advanced: ['#555', '#333'] };

function widgetFor(node, key, dflt, label) {
  const t = typeof dflt;
  const cb = (v) => { node.properties[key] = v; };
  if (Array.isArray(dflt)) return node.addWidget('combo', label ?? key, node.properties[key], cb, { values: dflt });
  if (t === 'number') return node.addWidget('number', label ?? key, node.properties[key], cb, { step: 0.1 * 10, precision: 3 });
  if (t === 'boolean') return node.addWidget('toggle', label ?? key, node.properties[key], cb);
  return node.addWidget('text', label ?? key, node.properties[key], cb);
}

function register(spec) {
  function N() {
    this.properties = {};
    for (const [name, type] of spec.in) this.addInput(name, type, type === 'exec' ? { shape: LG.ARROW_SHAPE } : undefined);
    for (const [name, type] of spec.out) this.addOutput(name, type, type === 'exec' ? { shape: LG.ARROW_SHAPE } : undefined);
    for (const [k, v] of Object.entries(spec.props)) { this.properties[k] = Array.isArray(v) ? v[0] : v; widgetFor(this, k, v); }
    for (const [name, type, d] of spec.in) {
      if (type === 'exec' || d === undefined || (this.properties[name] !== undefined)) continue;
      this.properties[name] = d; widgetFor(this, name, d, name);
    }
    const [c, bg] = CAT_COLOR[spec.cat] ?? CAT_COLOR.Advanced; this.color = c; this.bgcolor = bg;
    this.size = this.computeSize();
    if (spec.type === 'util/comment') { this.size = [220, 70]; this.color = '#996'; this.bgcolor = '#443'; }
  }
  N.title = spec.title;
  N.desc = `${spec.cat}`;
  LG.registerNodeType(spec.type, N);
}
for (const spec of Object.values(NODES)) register(spec);

// ── graph + canvas ──
const graph = new LG.LGraph();
const canvas = new LG.LGraphCanvas('#cv', graph);
canvas.background_image = null; canvas.render_shadows = false; canvas.render_canvas_border = false; canvas.allow_searchbox = true;
canvas.default_connection_color_byType = { ...SLOT_COLORS }; canvas.default_connection_color_byTypeOff = { ...SLOT_COLORS };
LG.LGraphCanvas.link_type_colors = { ...SLOT_COLORS };
graph.start?.();
// The canvas is absolutely positioned inside #stage, so resizing it can never change #stage's own size (no ResizeObserver loop).
let resizeQueued = false;
const resize = () => {
  if (resizeQueued) return;
  resizeQueued = true;
  requestAnimationFrame(() => {
    resizeQueued = false;
    const r = $('#stage').getBoundingClientRect();
    if (r.width < 10 || r.height < 10) return; // layout not ready: keep the last good size instead of blanking the canvas
    canvas.resize(Math.floor(r.width), Math.floor(r.height));
    canvas.setDirty(true, true);
  });
};
new ResizeObserver(resize).observe($('#stage')); resize();

const S = { vars: {}, dirty: false };
window.__graph = { graph, canvas, state: S }; // for debugging in the browser console
graph.onAfterChange = () => { S.dirty = true; };

// ── palette ──
function addNode(type, pos) {
  const nd = LG.createNode(type); if (!nd) return null;
  const p = pos ?? canvas.convertOffsetToCanvas([$('#stage').clientWidth / 2, $('#stage').clientHeight / 2]);
  nd.pos = [Math.round(p[0] / 10) * 10, Math.round(p[1] / 10) * 10]; graph.add(nd); canvas.selectNode?.(nd); S.dirty = true; return nd;
}
function drawPalette(filter = '') {
  const box = $('#palette'); box.textContent = '';
  const f = filter.toLowerCase();
  const byCat = new Map();
  for (const s of Object.values(NODES)) if (!f || s.title.toLowerCase().includes(f) || s.type.includes(f) || s.cat.toLowerCase().includes(f)) (byCat.get(s.cat) ?? byCat.set(s.cat, []).get(s.cat)).push(s);
  for (const [cat, list] of byCat) {
    el('div', { className: 'cat', textContent: cat }, box);
    for (const s of list) {
      const it = el('div', { className: 'item', textContent: s.title, draggable: true, title: s.type }, box);
      it.ondblclick = () => addNode(s.type);
      it.ondragstart = (e) => e.dataTransfer.setData('text/nord-node', s.type);
    }
  }
}
$('#search').oninput = (e) => drawPalette(e.target.value);
const cvEl = $('#cv');
cvEl.addEventListener('dragover', (e) => e.preventDefault());
cvEl.addEventListener('drop', (e) => { const t = e.dataTransfer.getData('text/nord-node'); if (!t) return; e.preventDefault(); const r = cvEl.getBoundingClientRect(); addNode(t, canvas.convertOffsetToCanvas([e.clientX - r.left, e.clientY - r.top])); });
drawPalette();

// ── variables ──
function drawVars() {
  const box = $('#vars'); box.textContent = '';
  for (const [name, v] of Object.entries(S.vars)) {
    const row = el('div', { className: 'v' }, box);
    const n = el('input', { value: name, title: 'name' }, row);
    const d = el('input', { value: JSON.stringify(v.default ?? null), title: 'default (JSON)' }, row);
    const x = el('button', { textContent: '×', title: 'remove' }, row);
    n.onchange = () => { const nn = n.value.trim(); if (nn && nn !== name && !(nn in S.vars)) { S.vars = Object.fromEntries(Object.entries(S.vars).map(([k, val]) => [k === name ? nn : k, val])); S.dirty = true; } drawVars(); };
    d.onchange = () => { try { S.vars[name].default = JSON.parse(d.value); S.dirty = true; } catch { status('Default must be JSON, e.g. 0, "text", [1,2,3]', true); } };
    x.onclick = () => { delete S.vars[name]; S.dirty = true; drawVars(); };
  }
}
$('#addvar').onclick = () => { let i = 1; while (`var${i}` in S.vars) i++; S.vars[`var${i}`] = { default: 0 }; S.dirty = true; drawVars(); };

// ── selection + problems ──
canvas.onNodeSelected = (nd) => {
  const spec = NODES[nd.type]; const sel = $('#sel'); sel.textContent = '';
  el('b', { textContent: spec?.title ?? nd.type }, sel); el('small', { textContent: `${nd.type} · ${spec?.cat ?? ''}${spec?.pure ? ' · pure (no flow pins)' : spec?.event ? ' · entry point' : ' · flow node'}` }, sel);
  for (const [n, t, d] of spec?.in ?? []) el('small', { textContent: `in  ${n}: ${t}${d !== undefined ? ` = ${JSON.stringify(d)}` : ''}` }, sel);
  for (const [n, t] of spec?.out ?? []) el('small', { textContent: `out ${n}: ${t}` }, sel);
};
canvas.onNodeDeselected = () => { $('#sel').textContent = 'Nothing selected.'; };
function check() {
  const probs = validate(graph.serialize());
  const ul = $('#problems'); ul.textContent = '';
  // unconnected exec chains: flow nodes that cannot be reached from any event
  const ids = new Map(graph._nodes.map((n) => [n.id, n])); const reach = new Set();
  const walk = (n) => { if (reach.has(n.id)) return; reach.add(n.id); for (const o of n.outputs ?? []) for (const l of o.links ?? []) { const t = graph.links[l]; if (t) walk(ids.get(t.target_id)); } };
  for (const n of graph._nodes) if (NODES[n.type]?.event) walk(n);
  for (const n of graph._nodes) { const s = NODES[n.type]; if (s && !s.pure && !s.event && !reach.has(n.id)) probs.push(`"${s.title}" (#${n.id}) is not connected to any event, so it never runs`); }
  for (const p of probs) el('li', { textContent: p }, ul);
  if (!probs.length) el('li', { textContent: 'No problems found.' }, ul);
  status(probs.length ? `${probs.length} problem(s)` : 'Graph looks good', !!probs.length);
  attachedCheck(ul);
}
/** A graph only runs when a scene (settings.graphs) or an entity (graph component) uses it. Say so, and offer a one-click fix. */
async function attachedCheck(ul) {
  const file = norm($('#file').value || 'main');
  let hits = null;
  try { const r = await fetch('/api/usages?q=' + encodeURIComponent(file)); if (r.ok) hits = (await r.json()).filter((h) => !/^graphs\//.test(h.file)); } catch { /* plain static server */ }
  if (hits === null) return;
  const li = el('li', {}, ul);
  if (hits.length) { li.textContent = `✓ Used by ${hits.map((h) => h.file).filter((f, i, a) => a.indexOf(f) === i).join(', ')}`; return; }
  li.className = 'bad'; li.textContent = '⚠ Nothing runs this graph yet. Add it to the current scene (or add a "graph" component to an entity), then Play. ';
  const b = el('button', { textContent: 'Add to current scene' }, li);
  b.onclick = () => { ipc({ t: 'attach-graph', file }); status(`Added ${file} to the scene settings. Save the scene and press Play; Log output appears in the editor Console.`); b.disabled = true; };
}
$('#check').onclick = check;

// ── layout helpers ──
function fit() {
  const ns = graph._nodes; if (!ns.length) return;
  const x0 = Math.min(...ns.map((n) => n.pos[0])), y0 = Math.min(...ns.map((n) => n.pos[1])), x1 = Math.max(...ns.map((n) => n.pos[0] + n.size[0])), y1 = Math.max(...ns.map((n) => n.pos[1] + n.size[1] + 30));
  const w = $('#stage').clientWidth, h = $('#stage').clientHeight, sc = Math.min(1.2, (w - 80) / Math.max(1, x1 - x0), (h - 80) / Math.max(1, y1 - y0));
  canvas.ds.scale = sc; canvas.ds.offset = [-x0 + 40 / sc, -y0 + 40 / sc]; canvas.setDirty(true, true);
}
function arrange() {
  const ns = graph._nodes; const depth = new Map(); const ids = new Map(ns.map((n) => [n.id, n]));
  const q = ns.filter((n) => NODES[n.type]?.event || !(n.inputs ?? []).some((i) => i.link != null)); q.forEach((n) => depth.set(n.id, 0));
  while (q.length) { const n = q.shift(); for (const o of n.outputs ?? []) for (const l of o.links ?? []) { const t = graph.links[l]; if (!t) continue; const d = depth.get(n.id) + 1; if (d > (depth.get(t.target_id) ?? -1) && d < 40) { depth.set(t.target_id, d); q.push(ids.get(t.target_id)); } } }
  const cols = new Map(); for (const n of ns) { const d = depth.get(n.id) ?? 0; (cols.get(d) ?? cols.set(d, []).get(d)).push(n); }
  for (const [d, list] of cols) { let y = 40; for (const n of list) { n.pos = [40 + d * 300, y]; y += n.size[1] + 50; } }
  canvas.setDirty(true, true); fit(); S.dirty = true;
}
$('#fit').onclick = fit; $('#arrange').onclick = arrange;

// ── subgraphs: selected nodes -> their own graph file + one "Run Graph File" node ──
// The new file starts at On Start, reads the values flowing in as variables a / b, and hands back a / b with a Return node.
// Rules: exactly one flow link enters the selection, at most one leaves it, at most two data values go in and two come out.
async function makeSubgraph() {
  const sel = Object.values(canvas.selected_nodes ?? {});
  if (sel.length < 1) return status('Select the nodes to move into a subgraph', true);
  const ids = new Set(sel.map((n) => n.id)), nodeOf = (id) => graph.getNodeById(id);
  const links = Object.values(graph.links ?? {}).filter(Boolean);
  const inn = links.filter((l) => !ids.has(l.origin_id) && ids.has(l.target_id)), out = links.filter((l) => ids.has(l.origin_id) && !ids.has(l.target_id));
  const execIn = inn.filter((l) => l.type === 'exec'), execOut = out.filter((l) => l.type === 'exec');
  const dataIn = inn.filter((l) => l.type !== 'exec'), dataOut = out.filter((l) => l.type !== 'exec');
  const distinct = (ls, key) => [...new Map(ls.map((l) => [key(l), l])).values()];
  const entries = distinct(execIn, (l) => `${l.target_id}:${l.target_slot}`), exits = distinct(execOut, (l) => `${l.target_id}:${l.target_slot}`);
  const srcIn = distinct(dataIn, (l) => `${l.origin_id}:${l.origin_slot}`), srcOut = distinct(dataOut, (l) => `${l.origin_id}:${l.origin_slot}`);
  if (entries.length !== 1) return status(`Exactly one flow link must enter the selection (found ${entries.length})`, true);
  if (exits.length > 1) return status('At most one flow link may leave the selection', true);
  if (srcIn.length > 2) return status(`Too many values flow in (${srcIn.length}); a subgraph takes at most two (a, b)`, true);
  if (srcOut.length > 2) return status(`Too many values flow out (${srcOut.length}); a subgraph returns at most two (a, b)`, true);
  if (srcOut.length && !exits.length) return status('To return values the selection must continue with a flow link', true);
  const name = norm(prompt('Subgraph file name', 'graphs/sub1.graph.json') ?? '');
  if (!name || name === 'graphs/.graph.json') return;
  // 1. build the new graph in a scratch LGraph
  const g2 = new LG.LGraph(), copy = new Map();
  g2.last_node_id = Math.max(0, ...sel.map((n) => n.id));
  for (const n of sel) {
    const c = LG.createNode(n.type); c.id = n.id; c.pos = [...n.pos]; c.properties = { ...n.properties }; c.title = n.title;
    c.widgets?.forEach((w, i) => { w.value = n.widgets?.[i]?.value ?? w.value; });
    g2.add(c); copy.set(n.id, c);
  }
  for (const l of links) if (ids.has(l.origin_id) && ids.has(l.target_id)) copy.get(l.origin_id).connect(l.origin_slot, copy.get(l.target_id), l.target_slot);
  const minX = Math.min(...sel.map((n) => n.pos[0])), minY = Math.min(...sel.map((n) => n.pos[1]));
  const start = LG.createNode('event/start'); start.pos = [minX - 260, minY]; g2.add(start);
  start.connect(0, copy.get(entries[0].target_id), entries[0].target_slot);
  srcIn.forEach((l, k) => { const v = LG.createNode('var/get'); v.properties.name = 'ab'[k]; v.widgets?.forEach((w) => { if (w.name === 'name') w.value = 'ab'[k]; }); v.pos = [minX - 260, minY + 120 + k * 70]; g2.add(v);
    for (const t of dataIn.filter((x) => x.origin_id === l.origin_id && x.origin_slot === l.origin_slot)) v.connect(0, copy.get(t.target_id), t.target_slot); });
  if (exits.length) {
    const ret = LG.createNode('flow/return'); ret.pos = [Math.max(...sel.map((n) => n.pos[0] + n.size[0])) + 60, minY]; g2.add(ret);
    copy.get(execOut[0].origin_id).connect(execOut[0].origin_slot, ret, 0);
    srcOut.forEach((l, k) => copy.get(l.origin_id).connect(l.origin_slot, ret, 1 + k));
  }
  const body = { ...g2.serialize(), nord: { version: 1, vars: {} } };
  const bad = validate(body).filter((m) => !m.startsWith('no event'));
  if (bad.length) return status('Subgraph would be invalid: ' + bad[0], true);
  const resp = await fetch('/api/fpsc/save?path=' + encodeURIComponent(name), { method: 'POST', headers: { 'x-nord-fpsc': '1' }, body: JSON.stringify(body, null, 1) + '\n' });
  if (!resp.ok) return status('Save failed: ' + await resp.text(), true);
  // 2. replace the selection by a call node wired to the same neighbours
  const call = LG.createNode('flow/call-graph'); call.properties.file = name; call.widgets?.forEach((w) => { if (w.name === 'file') w.value = name; });
  call.pos = [minX, minY]; graph.add(call);
  const entryOrigin = nodeOf(entries[0].origin_id), ext = (l) => ({ from: nodeOf(l.origin_id), fs: l.origin_slot, to: nodeOf(l.target_id), ts: l.target_slot });
  const e0 = ext(execIn[0]), x0 = exits[0] && ext(execOut[0]), inputs = srcIn.map((l) => ext(l)), outTargets = srcOut.map((l) => dataOut.filter((x) => x.origin_id === l.origin_id && x.origin_slot === l.origin_slot).map(ext));
  const aSlot = call.inputs.findIndex((i) => i.name === 'a');
  for (const n of sel) graph.remove(n);
  e0.from.connect(e0.fs, call, 0);
  inputs.forEach((c, k) => c.from.connect(c.fs, call, aSlot + k));
  if (x0) call.connect(0, x0.to, x0.ts);
  outTargets.forEach((ts, k) => { for (const t of ts) call.connect(1 + k, t.to, t.ts); });
  void entryOrigin;
  canvas.setDirty(true, true); S.dirty = true; list(); check();
  status(`Moved ${sel.length} node(s) into ${name}; open it from the file box to edit them`);
}
$('#subgraph').onclick = () => makeSubgraph().catch((e) => status('Subgraph failed: ' + e.message, true));
window.__graph.makeSubgraph = makeSubgraph;

// ── live flow highlight: while the game runs, nodes that execute flash green (the game only sends traces while this page is open) ──
const flashing = new Map();
function flash(node) {
  if (!flashing.has(node.id)) flashing.set(node.id, { c: node.color, b: node.bgcolor, bc: node.boxcolor });
  node.color = '#39d98a'; node.bgcolor = '#1f5c40'; node.boxcolor = '#7dffb8'; canvas.setDirty(true, true);
  clearTimeout(node.__flash);
  node.__flash = setTimeout(() => { const o = flashing.get(node.id); if (o) { node.color = o.c; node.bgcolor = o.b; node.boxcolor = o.bc; flashing.delete(node.id); canvas.setDirty(true, true); } }, 450);
}
function onTrace(nodes) {
  const file = norm($('#file').value || 'main');
  const ids = nodes[file] ?? nodes[Object.keys(nodes).find((k) => k.endsWith(file)) ?? ''];
  if (!ids) return;
  S.traced = Date.now();
  for (const id of ids) { const n = graph.getNodeById(id); if (n) flash(n); }
}
if (typeof EventSource !== 'undefined') {
  try { const es = new EventSource('/__edit/events'); es.onmessage = (ev) => { let m; try { m = JSON.parse(ev.data); } catch { return; } if (m.t === 'graph-trace') onTrace(m.nodes ?? {}); }; } catch { /* plain static server */ }
  const beat = () => fetch('/api/graph-trace', { method: 'POST', headers: { 'x-nord': '1' } }).catch(() => {});
  beat(); setInterval(beat, 2000);
}
window.__graph.onTrace = onTrace;

// ── groups, docs (F1), minimap ──
$('#group').onclick = () => {
  const sel = Object.values(canvas.selected_nodes ?? {});
  if (!sel.length) return status('Select some nodes first', true);
  const x0 = Math.min(...sel.map((n) => n.pos[0])), y0 = Math.min(...sel.map((n) => n.pos[1])), x1 = Math.max(...sel.map((n) => n.pos[0] + n.size[0])), y1 = Math.max(...sel.map((n) => n.pos[1] + n.size[1]));
  const g = new LiteGraph.LGraphGroup(prompt('Group title', 'Group') ?? 'Group');
  g.pos = [x0 - 20, y0 - 50]; g.size = [x1 - x0 + 40, y1 - y0 + 70];
  graph.add(g); canvas.setDirty(true, true); S.dirty = true;
};
function openDocs() {
  const sel = Object.values(canvas.selected_nodes ?? {})[0];
  const spec = sel && NODES[sel.type];
  window.open('/__docs/nord/guides/graph-reference.html', '_blank');
}
$('#docs').onclick = openDocs;
addEventListener('keydown', (e) => { if (e.key === 'F1') { e.preventDefault(); openDocs(); } });
const mini = $('#mini'), mctx = mini.getContext('2d');
function drawMini() {
  mctx.clearRect(0, 0, mini.width, mini.height);
  const ns = graph._nodes; if (!ns.length) return;
  const x0 = Math.min(...ns.map((n) => n.pos[0])), y0 = Math.min(...ns.map((n) => n.pos[1])), x1 = Math.max(...ns.map((n) => n.pos[0] + n.size[0])), y1 = Math.max(...ns.map((n) => n.pos[1] + n.size[1]));
  const k = Math.min((mini.width - 10) / Math.max(1, x1 - x0), (mini.height - 10) / Math.max(1, y1 - y0));
  mini._m = { x0, y0, k };
  mctx.fillStyle = '#88c0d0aa';
  for (const n of ns) mctx.fillRect(5 + (n.pos[0] - x0) * k, 5 + (n.pos[1] - y0) * k, Math.max(2, n.size[0] * k), Math.max(2, n.size[1] * k));
  const sc = canvas.ds.scale, w = $('#stage').clientWidth / sc, h = $('#stage').clientHeight / sc, vx = -canvas.ds.offset[0], vy = -canvas.ds.offset[1];
  mctx.strokeStyle = '#ebcb8b'; mctx.strokeRect(5 + (vx - x0) * k, 5 + (vy - y0) * k, w * k, h * k);
}
mini.onclick = (e) => {
  const m = mini._m; if (!m) return;
  const r = mini.getBoundingClientRect(), gx = (e.clientX - r.left - 5) / m.k + m.x0, gy = (e.clientY - r.top - 5) / m.k + m.y0;
  const sc = canvas.ds.scale; canvas.ds.offset = [-(gx - $('#stage').clientWidth / sc / 2), -(gy - $('#stage').clientHeight / sc / 2)]; canvas.setDirty(true, true);
};
setInterval(drawMini, 400);

// ── templates ──
const link = (a, out, b, inp) => { const o = a.outputs.findIndex((x) => x.name === out), i = b.inputs.findIndex((x) => x.name === inp); if (o >= 0 && i >= 0) a.connect(o, b, i); };
const put = (type, x, y, props = {}) => { const n = LG.createNode(type); n.pos = [x, y]; graph.add(n); for (const [k, v] of Object.entries(props)) { n.properties[k] = v; const w = n.widgets?.find((w) => w.name === k); if (w) w.value = v; } return n; };
const TEMPLATES = {
  'Hello (On Start → Log)': () => { const a = put('event/start', 40, 60), b = put('game/log', 330, 60, { message: 'Hello Nord!' }); link(a, 'then', b, 'exec'); },
  'Score counter (event → variable → UI)': () => {
    S.vars = { score: { default: 0 } };
    const a = put('event/game', 40, 60, { name: 'coin' }), b = put('var/add', 330, 60, { name: 'score', amount: 1 }), c = put('ui/set-var', 620, 60, { screen: 'hud', name: 'score' }), g = put('var/get', 330, 220, { name: 'score' });
    link(a, 'then', b, 'exec'); link(b, 'then', c, 'exec'); link(g, 'value', c, 'value'); drawVars();
  },
  'Play button (UI action → load scene)': () => { const a = put('event/ui', 40, 60, { action: 'play' }), b = put('audio/play', 330, 60), c = put('game/load-scene', 620, 60, { scene: 'scenes/main.scene.json' }); link(a, 'then', b, 'exec'); link(b, 'then', c, 'exec'); },
  'Move with arrow keys (On Update)': () => {
    const a = put('event/update', 40, 60), v = put('input/vec', 40, 240), m = put('math/mul', 330, 300, { a: 0, b: 0 }), s = put('vec/scale', 600, 240), mv = put('entity/translate', 880, 60);
    link(a, 'then', mv, 'exec'); link(a, 'dt', m, 'a'); m.properties.b = 200; m.widgets.find((w) => w.name === 'b').value = 200; link(v, 'vec', s, 'vec'); link(m, 'result', s, 'scale'); link(s, 'result', mv, 'delta');
  },
  'Spawner (timer → spawn prefab)': () => { const a = put('event/timer', 40, 60, { seconds: 2 }), b = put('entity/spawn', 330, 60, { prefab: 'prefabs/enemy.prefab.json' }); link(a, 'then', b, 'exec'); },
};
for (const k of Object.keys(TEMPLATES)) el('option', { value: k, textContent: k }, $('#tpl'));
$('#tpl').onchange = () => { const k = $('#tpl').value; if (!k) return; if (S.dirty && !confirm('Replace the current graph?')) { $('#tpl').value = ''; return; } graph.clear(); S.vars = {}; TEMPLATES[k](); drawVars(); S.dirty = true; fit(); check(); $('#tpl').value = ''; };

// ── files ──
const norm = (v) => { let n = v.trim().replace(/^\/+/, ''); if (!n.startsWith('graphs/')) n = 'graphs/' + n; if (!n.endsWith('.graph.json')) n = n.replace(/(\.json)?$/, '.graph.json'); return n; };
async function list() { try { const r = await fetch('/api/fpsc/ls?dir=graphs'); const l = r.ok ? (await r.json()).filter((e) => e.name.endsWith('.graph.json')) : []; const dl = $('#files'); dl.textContent = ''; for (const e of l) el('option', { value: 'graphs/' + e.name }, dl); return l; } catch { return []; } }
function serialize() { const d = graph.serialize(); d.nord = { version: 1, vars: S.vars }; return d; }
async function openFile(name) {
  const r = await fetch('/' + name); if (!r.ok) return status(`Cannot open ${name}`, true);
  try { const d = await r.json(); graph.configure(d); S.vars = d.nord?.vars ?? {}; } catch (e) { return status('Not a graph file: ' + e.message, true); }
  $('#file').value = name; S.dirty = false; drawVars(); fit(); check(); status(`Opened ${name}`);
}
async function save() {
  const name = norm($('#file').value || 'main');
  const r = await fetch('/api/fpsc/save?path=' + encodeURIComponent(name), { method: 'POST', headers: { 'x-nord-fpsc': '1' }, body: JSON.stringify(serialize(), null, 1) + '\n' });
  if (!r.ok) return status('Save failed: ' + await r.text(), true);
  $('#file').value = name; S.dirty = false; status(`Saved ${name}`); list(); check();
}
$('#new').onclick = () => { if (S.dirty && !confirm('Discard unsaved changes?')) return; graph.clear(); S.vars = {}; put('event/start', 60, 80); drawVars(); S.dirty = false; fit(); };
$('#open').onclick = () => { if (S.dirty && !confirm('Discard unsaved changes?')) return; openFile(norm($('#file').value || 'main')); };
$('#save').onclick = save;
addEventListener('keydown', (e) => { const mod = e.metaKey || e.ctrlKey; if (mod && e.key === 's') { e.preventDefault(); save(); } else if (e.key === 'f' && !/INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) fit(); });
addEventListener('beforeunload', (e) => { if (S.dirty) e.preventDefault(); });

(async () => {
  const l = await list();
  const want = new URLSearchParams(location.search).get('file');
  const first = want ?? (l[0] ? 'graphs/' + l[0].name : null);
  if (first) { $('#file').value = first; await openFile(first); } else { $('#file').value = 'graphs/main.graph.json'; put('event/start', 60, 80); fit(); }
  S.dirty = false;
})();
