// Left palette tabs (Build / Items / Scripts / Level / Assets) and the right-hand inspector. Pure view code: all state lives in `ed` (editor.js).
import { el, buildForm, modal, toast } from './forms.js';
import { texCanvas, KEYCOL, classify } from './map2d.js';
import { resolveScripts } from '/runtime/fpsc/bank.js';
import { WHENS, ACTIONS } from '/runtime/fpsc/actions.js';
import { CELL, STORY } from '/runtime/fpsc/level.js';
import { FLOOR_HEIGHTS } from '/runtime/fpsc/bank/segments.js';
import { SKIES } from '/runtime/fpsc/render.js';
import { SOUND_NAMES } from '/runtime/fpsc/audio.js';
import { CORNERS } from '/runtime/fpsc/corners.js';
import { assetsPanel } from './assets.js';

const SLOTS = [['wall', 'Wall', 'wall'], ['back', 'Back side', 'wall'], ['trim', 'Trim', 'wall'], ['door', 'Door leaf', 'door'], ['floor', 'Floor', 'floor'], ['ceil', 'Ceiling', 'ceiling']];

// ------------------------------------------------------------------------------------------------------------------------------------
// preview of a wall piece (front elevation drawn with the real textures)
export function piecePreview(ed, def, tex, w = 90, h = 46) {
  const cv = Object.assign(document.createElement('canvas'), { width: w * 2, height: h * 2 }), c = cv.getContext('2d'); c.scale(2, 2);
  c.fillStyle = '#2a3140'; c.fillRect(0, 0, w, h);
  const sx = w - 8, k = (h - 6) / STORY, ox = 4, oy = h - 3;
  for (const p of def.parts) {
    if (p.vis === false) continue;
    const m = p.mat ?? 'main', id = m === 'main' ? tex.wall : m === 'trim' ? tex.trim : m === 'door' ? tex.door : m === 'glass' ? 'glass' : 'fence_mesh';
    const y0 = p.y[0] === 'H' ? STORY : p.y[0], y1 = p.y[1] === 'H' ? STORY : p.y[1];
    const x = ox + p.u[0] * sx, y = oy - y1 * k, ww = Math.max(1, (p.u[1] - p.u[0]) * sx), hh = Math.max(1, (y1 - y0) * k);
    if (m === 'glass') { c.fillStyle = 'rgba(150,220,255,.45)'; c.fillRect(x, y, ww, hh); continue; }
    if (m === 'mesh') { c.fillStyle = 'rgba(180,190,200,.35)'; c.fillRect(x, y, ww, hh); c.strokeStyle = '#aab'; c.strokeRect(x, y, ww, hh); continue; }
    c.fillStyle = c.createPattern(texCanvas(ed.bank, id, 32), 'repeat'); c.save(); c.translate(x, y); c.fillStyle = c.createPattern(texCanvas(ed.bank, id, 32), 'repeat'); c.fillRect(0, 0, ww, hh); c.restore();
    c.strokeStyle = 'rgba(0,0,0,.5)'; c.strokeRect(x + 0.5, y + 0.5, ww - 1, hh - 1);
  }
  return cv;
}

function texGrid(ed, slotCat, onPick, cur) {
  const cats = slotCat === 'wall' ? ['wall'] : slotCat === 'floor' ? ['floor', 'wall'] : slotCat === 'ceiling' ? ['ceiling', 'floor', 'wall'] : slotCat === 'door' ? ['door', 'wall'] : [slotCat];
  const list = ed.bank.textures.filter((t) => cats.includes(t.cat));
  const g = el('div', { class: 'grid' });
  const sorted = [...list].sort((a, b) => cats.indexOf(a.cat) - cats.indexOf(b.cat));
  for (const t of sorted) g.append(el('div', { class: `sw${t.id === cur ? ' on' : ''}`, title: `${t.label}  (${t.id})`, onclick: () => onPick(t.id) }, swatch(ed, t.id), el('span', {}, t.label)));
  return g;
}
function swatch(ed, id) { const c = Object.assign(document.createElement('canvas'), { width: 64, height: 50 }); c.getContext('2d').drawImage(texCanvas(ed.bank, id, 64), 0, 0, 64, 50); return c; }

// ------------------------------------------------------------------------------------------------------------------------------------
export function buildPanel(ed) {
  const b = ed.brush, root = el('div');
  root.append(el('h4', {}, 'Materials — click a slot, then a texture'));
  const slots = el('div', { class: 'slots', style: { flexWrap: 'wrap' } });
  const slotTex = (s) => ({ wall: b.wallTex, back: b.backTex || b.wallTex, trim: b.trimTex, door: b.doorTex, floor: b.floorTex, ceil: b.ceilTex })[s];
  for (const [id, label] of SLOTS) slots.append(el('div', { class: `slot${b.slot === id ? ' on' : ''}`, style: { flex: '1 0 30%' }, title: id === 'back' ? 'Texture of the other side of the wall (default: same as Wall)' : '', onclick: () => { b.slot = id; ed.renderLeft(); } }, swatch(ed, slotTex(id)), el('span', {}, label)));
  root.append(slots);
  const cat = SLOTS.find((s) => s[0] === b.slot)[2];
  const pick = (id) => { const k = { wall: 'wallTex', back: 'backTex', trim: 'trimTex', door: 'doorTex', floor: 'floorTex', ceil: 'ceilTex' }[b.slot]; b[k] = id; if (ed.sel.edges.size && ['wall', 'back', 'trim', 'door'].includes(b.slot)) ed.applyToSelectedEdges((p) => { p[{ wall: 't', back: 'tb', trim: 'tt', door: 'td' }[b.slot]] = id; }); if (ed.sel.cells.size && ['floor', 'ceil'].includes(b.slot)) ed.applyToSelectedCells((c) => { c[b.slot === 'floor' ? 'f' : 'c'] = id; }); ed.renderLeft(); };
  root.append(texGrid(ed, cat, pick, slotTex(b.slot)));
  root.append(el('h4', {}, 'Wall pieces (Wall tool · W)'));
  const cats = [...new Set(ed.bank.pieces.map((p) => p.cat))];
  for (const cname of cats) {
    root.append(el('div', { class: 'muted', style: { margin: '6px 0 2px' } }, cname));
    const g = el('div', { class: 'piece-grid' });
    for (const p of ed.bank.pieces.filter((x) => x.cat === cname)) g.append(el('div', { class: `piece${b.piece === p.id ? ' on' : ''}`, title: p.id, onclick: () => { b.piece = p.id; ed.setTool('wall'); if (ed.sel.edges.size) ed.applyToSelectedEdges((e) => { e.k = p.id; }); ed.renderLeft(); } }, piecePreview(ed, p, { wall: b.wallTex, trim: b.trimTex, door: b.doorTex }), el('div', {}, p.label)));
    root.append(g);
  }
  root.append(el('h4', {}, 'Room tool (R) — drag a rectangle'));
  for (const [k, l] of [['floor', 'Floor'], ['ceiling', 'Ceiling'], ['walls', 'Walls (active piece)']]) root.append(el('div', { class: 'row' }, el('label', {}, l), el('input', { type: 'checkbox', checked: b.room[k], onchange: (e) => { b.room[k] = e.target.checked; } })));
  root.append(el('h4', {}, 'Cell objects (S)'));
  root.append(el('div', { class: 'row' }, el('label', {}, 'Mode'), el('select', { onchange: (e) => { b.cellMode = e.target.value; ed.renderLeft(); ed.setTool('cell'); } }, ...[['stairs', 'Stairs / ramp'], ['height', 'Raise / lower floor'], ['pillar', 'Pillar / block'], ['corner', 'Diagonal / rounded corner']].map(([v, l]) => el('option', { value: v, selected: b.cellMode === v }, l)))));
  if (b.cellMode === 'stairs') {
    root.append(el('div', { class: 'row' }, el('label', {}, 'Type'), el('select', { onchange: (e) => { b.stair = e.target.value; } }, ...ed.bank.stairs.map((s) => el('option', { value: s.id, selected: s.id === b.stair }, s.label)))));
    root.append(el('div', { class: 'row' }, el('label', {}, 'Climbs toward'), el('select', { onchange: (e) => { b.stairDir = e.target.value; } }, ...['N', 'E', 'S', 'W'].map((d) => el('option', { value: d, selected: d === b.stairDir }, { N: 'North ↑', E: 'East →', S: 'South ↓', W: 'West ←' }[d])))));
    root.append(el('div', { class: 'muted' }, 'Click a cell. Drag to aim the direction. Leave the cell above empty (no floor) on the next layer to walk through.'));
  } else if (b.cellMode === 'height') {
    root.append(el('div', { class: 'row' }, el('label', {}, 'Floor height'), el('select', { onchange: (e) => { b.height = +e.target.value; } }, ...FLOOR_HEIGHTS.map((h) => el('option', { value: h, selected: h === b.height }, `${h > 0 ? '+' : ''}${h} m`)))));
    root.append(el('div', { class: 'muted' }, 'Click a cell to set its height (platforms, steps, pits). Shift-click resets to 0.'));
  } else if (b.cellMode === 'corner') {
    root.append(el('div', { class: 'row' }, el('label', {}, 'Shape'), el('select', { 'aria-label': 'Corner brush shape', onchange: ev => { b.cornerKind=ev.target.value; } }, ...[['diagonal','45° diagonal'],['round','Rounded quarter-circle']].map(([v,l])=>el('option',{value:v,selected:(b.cornerKind||'diagonal')===v},l)))));
    root.append(el('div', { class: 'row' }, el('label', {}, 'Cut off corner'), el('select', { 'aria-label': 'Cut off corner', onchange: ev => { b.corner=ev.target.value; } }, ...CORNERS.map(v=>el('option',{value:v,selected:(b.corner||'NE')===v},v)))));
    root.append(el('div', { class: 'tip' }, 'Click a corner cell of a room. Wall and floor/ceiling are cut together. Uses Wall/Back textures. Shift-click restores the square and its original walls. Corners cannot share a cell with stairs or pillars.'));
  } else {
    root.append(el('div', { class: 'row' }, el('label', {}, 'Piece'), el('select', { onchange: (e) => { b.pillar = e.target.value; } }, ...ed.bank.cellPieces.map((s) => el('option', { value: s.id, selected: s.id === b.pillar }, s.label)))));
    root.append(el('div', { class: 'muted' }, 'Uses the Wall texture. Click a cell; Shift-click removes.'));
  }
  return root;
}

// ------------------------------------------------------------------------------------------------------------------------------------
export function itemsPanel(ed) {
  const root = el('div'), st = ed.itemsUi ??= { cat: 'Enemies', q: '' };
  root.append(el('input', { type: 'text', placeholder: 'Search items…', value: st.q, style: { width: '100%' }, oninput: (e) => { st.q = e.target.value; list(); } }));
  const chips = el('div', { class: 'chips' });
  for (const c of ed.bank.categories) chips.append(el('button', { class: st.cat === c ? 'on' : '', onclick: () => { st.cat = c; ed.renderLeft(); } }, c));
  root.append(chips);
  const holder = el('div'); root.append(holder);
  function list() {
    holder.innerHTML = ''; const q = st.q.toLowerCase();
    const items = ed.bank.entities.filter((e) => q ? `${e.label} ${e.id} ${e.cat}`.toLowerCase().includes(q) : e.cat === st.cat);
    const g = el('div', { class: 'cards' });
    for (const d of items) {
      const card = el('div', { class: `card${ed.brush.entity === d.id && ed.tool === 'entity' ? ' on' : ''}`, draggable: 'true', title: d.doc ?? d.label, onclick: () => { ed.brush.entity = d.id; ed.setTool('entity'); ed.renderLeft(); }, ondragstart: (e) => { e.dataTransfer.setData('text/fpsc-entity', d.id); e.dataTransfer.effectAllowed = 'copy'; } },
        el('div', { class: 'ic', style: { background: d.color } }, d.glyph ?? '?'), el('div', { style: { minWidth: 0 } }, el('div', { class: 'nm' }, d.label), el('div', { class: 'ds' }, d.cat)));
      g.append(card);
    }
    holder.append(g); if (!items.length) holder.append(el('div', { class: 'muted' }, 'Nothing here.'));
    const sel = ed.bank.entity(ed.brush.entity);
    if (sel) holder.append(el('div', { class: 'tip' }, el('b', {}, sel.label), sel.doc ? `: ${sel.doc}` : '', el('div', { class: 'muted' }, 'Click to pick, then click the map to place. Or drag a card onto the map. Q / E rotate before placing.')));
  }
  list(); return root;
}

// ------------------------------------------------------------------------------------------------------------------------------------
// Placed objects, separate from the bank of objects available to place.
export function objectsPanel(ed) {
  const root = el('div'), st = ed.objectsUi ??= { q: '', layer: 'all' };
  root.append(el('input', { type: 'search', placeholder: 'Find placed objects…', value: st.q, style: { width: '100%' }, oninput: (ev) => { st.q = ev.target.value; list(); } }));
  root.append(el('div', { class: 'row' }, el('label', {}, 'Storey'), el('select', { 'aria-label': 'Object storey', onchange: (ev) => { st.layer = ev.target.value; list(); } },
    el('option', { value: 'all', selected: st.layer === 'all' }, 'All storeys'), el('option', { value: 'current', selected: st.layer === 'current' }, 'Current storey'))));
  root.append(el('div', { class: 'muted' }, 'Click to select and centre the map. Shift-click toggles selection; double-click focuses the 3D view. Search names, tags, types or scripts.'));
  const holder = el('div'); root.append(holder);
  function list() {
    holder.replaceChildren();
    const q = st.q.trim().toLowerCase();
    const items = ed.level.entities.filter((e) => (st.layer === 'all' || e.layer === ed.layer) &&
      (!q || [e.name, e.tag, e.type, e.id, ed.bank.entity(e.type)?.label, ...resolveScripts(ed.bank.entity(e.type), e).map((s) => s.id)].join(' ').toLowerCase().includes(q)));
    holder.append(el('h4', {}, `${items.length} / ${ed.level.entities.length} objects`));
    for (const e of items) {
      const def = ed.bank.entity(e.type);
      holder.append(el('button', { class: `object-row${ed.sel.ents.has(e.id) ? ' on' : ''}`, 'data-object': e.id,
        onclick: (ev) => ed.selectEntity(e.id, ev.shiftKey, true), ondblclick: () => { ed.selectEntity(e.id, false, true); ed.focus3d(); } },
        el('b', {}, e.name || def?.label || e.type), el('small', {}, `${def?.label || e.type} · ${ed.level.layers[e.layer]?.name ?? e.layer}${e.tag ? ` · #${e.tag}` : ''}`)));
    }
    if (!items.length) holder.append(el('div', { class: 'muted' }, 'No matching objects.'));
  }
  list(); return root;
}

export function scriptsPanel(ed) {
  const root = el('div'), st = ed.scriptUi ??= { cat: 'All', q: '', open: null };
  root.append(el('div', { class: 'tip' }, 'Scripts give entities behaviour. ', el('b', {}, 'Drag a script onto an entity on the map'), ' (or select the entity and press Attach). Edit its parameters in the Inspector.'));
  root.append(el('input', { type: 'text', placeholder: 'Search scripts…', value: st.q, style: { width: '100%' }, oninput: (e) => { st.q = e.target.value; list(); } }));
  const cats = ['All', ...new Set(ed.bank.scripts.map((s) => s.cat ?? 'Other'))];
  const chips = el('div', { class: 'chips' }); for (const c of cats) chips.append(el('button', { class: st.cat === c ? 'on' : '', onclick: () => { st.cat = c; ed.renderLeft(); } }, c));
  root.append(chips);
  const holder = el('div'); root.append(holder);
  function list() {
    holder.innerHTML = ''; const q = st.q.toLowerCase();
    for (const s of ed.bank.scripts.filter((x) => (st.cat === 'All' || (x.cat ?? 'Other') === st.cat) && (!q || `${x.title} ${x.id} ${x.desc}`.toLowerCase().includes(q)))) {
      const open = st.open === s.id, sel = ed.selectedEntity();
      holder.append(el('div', { class: `box${open ? ' open' : ''}`, draggable: 'true', ondragstart: (e) => { e.dataTransfer.setData('text/fpsc-script', s.id); e.dataTransfer.effectAllowed = 'copy'; } },
        el('div', { style: { display: 'flex', gap: '6px', alignItems: 'center', cursor: 'pointer' }, onclick: () => { st.open = open ? null : s.id; list(); } }, el('b', { style: { flex: 1 } }, s.title ?? s.id), s.custom ? el('span', { class: 'badge' }, 'yours') : null, el('span', { class: 'badge' }, s.cat ?? 'Other')),
        el('div', { class: 'muted' }, s.desc ?? ''),
        open ? el('div', {}, el('div', { style: { margin: '6px 0 2px', color: 'var(--mut)' } }, `id: ${s.id}${s.file ? ` · ${s.file}` : ' · built-in'}`),
          ...Object.entries(s.params ?? {}).map(([k, p]) => el('div', { class: 'muted' }, `• ${p.label ?? k} = ${JSON.stringify(p.default)}`)),
          el('div', { class: 'row', style: { marginTop: '6px' } }, el('button', { class: 'primary', disabled: !sel, title: sel ? '' : 'Select an entity on the map first', onclick: () => ed.attachScript(s.id) }, sel ? `Attach to ${sel.name || ed.bank.entity(sel.type)?.label}` : 'Attach to selected'), s.file ? el('button', { onclick: () => ed.openScriptSource(s) }, 'View source') : null)) : null));
    }
  }
  list();
  root.append(el('h4', {}, 'Your own scripts'), el('div', { class: 'muted' }, 'Write a new one in the Assets tab ("New script"). See Help (F1) for the script contract.'));
  return root;
}

// ------------------------------------------------------------------------------------------------------------------------------------
export function levelPanel(ed) {
  const lv = ed.level, root = el('div'), set = lv.settings;
  const sch = (o) => o;
  const on = (key) => (k, v) => { if (v === undefined) delete lv[key][k]; else lv[key][k] = v; ed.commit('level settings', { rebuild3d: true }); };
  root.append(el('h4', {}, 'Level'));
  root.append(el('div', { class: 'row' }, el('label', {}, 'Name'), el('input', { type: 'text', value: lv.name, onchange: (e) => { lv.name = e.target.value || 'Level'; ed.commit('rename'); ed.renderTop(); } })));
  root.append(el('div', { class: 'row' }, el('label', {}, 'Author'), el('input', { type: 'text', value: lv.author ?? '', onchange: (e) => { lv.author = e.target.value; ed.commit('author'); } })));
  root.append(el('div', { class: 'row' }, el('label', {}, 'Size (cells)'), el('input', { type: 'number', value: lv.w, min: 4, max: 256, onchange: (e) => ed.resize(+e.target.value, lv.d) }), el('input', { type: 'number', value: lv.d, min: 4, max: 256, onchange: (e) => ed.resize(lv.w, +e.target.value) })));
  root.append(el('div', { class: 'muted' }, `1 cell = ${CELL} m · 1 storey = ${STORY} m`));
  root.append(el('h4', {}, 'Atmosphere'));
  root.append(buildForm(sch({
    sky: { type: 'enum', label: 'Sky', default: 'day', options: [...Object.keys(SKIES), 'custom'] }, skyColor: { type: 'color', label: 'Custom sky colour', default: '#8fb8e8' },
    ground: { type: 'enum', label: 'Outside ground', default: 'grass', options: ['none', ...ed.bank.textures.filter((t) => t.cat === 'floor').map((t) => t.id)] },
    ambient: { type: 'number', label: 'Ambient light', default: 0.35, min: 0, max: 1.5, step: 0.05 }, ambientColor: { type: 'color', label: 'Ambient colour', default: '#9aa8c0' },
    fog: { type: 'bool', label: 'Fog', default: false }, fogColor: { type: 'color', label: 'Fog colour', default: '#9bb0c8' }, fogDensity: { type: 'number', label: 'Fog density', default: 0.012, min: 0, max: 0.2, step: 0.002 },
  }), set, on('settings'), ed.formCtx()));
  root.append(el('h4', {}, 'Game'));
  root.append(buildForm(sch({
    intro: { type: 'text', label: 'Intro text', default: '' }, objective: { type: 'string', label: 'Objective', default: '' }, timeLimit: { type: 'number', label: 'Time limit (s)', default: 0, min: 0, max: 7200, hint: '0 = none' },
    music: { type: 'string', label: 'Music file', default: '', hint: 'e.g. assets/audio/music.mp3 (project path)' }, next: { type: 'string', label: 'Next level', default: '', hint: 'e.g. levels/level2.fpsl.json (also settable on the Level exit)' },
  }), set, on('settings'), ed.formCtx()));
  root.append(el('h4', {}, 'Layers (storeys)'));
  lv.layers.forEach((ly, i) => root.append(el('div', { class: 'row' }, el('button', { class: ed.layer === i ? 'on' : '', style: { flex: 'none' }, onclick: () => ed.setLayer(i) }, String(i)), el('input', { type: 'text', value: ly.name, onchange: (e) => { ly.name = e.target.value; ed.commit('rename layer'); ed.renderTop(); } }), el('button', { title: 'Delete layer', disabled: lv.layers.length < 2, onclick: () => ed.deleteLayer(i), style: { flex: 'none' } }, '🗑'), el('button', { title: 'Duplicate layer', onclick: () => ed.duplicateLayer(i), style: { flex: 'none' } }, '⧉'))));
  root.append(el('div', { class: 'row' }, el('button', { onclick: () => ed.addLayer() }, '+ Add layer (storey)')));
  root.append(el('h4', {}, '3D preview'));
  root.append(el('div', { class: 'row' }, el('label', {}, 'Ceilings'), el('input', { type: 'checkbox', checked: ed.show3dCeilings, onchange: (e) => { ed.show3dCeilings = e.target.checked; ed.v3.invalidate(); } })));
  root.append(el('div', { class: 'row' }, el('label', {}, 'Upper layers'), el('input', { type: 'checkbox', checked: ed.show3dAll, onchange: (e) => { ed.show3dAll = e.target.checked; ed.v3.invalidate(); } }), el('span', { class: 'hint' }, 'show all')));
  return root;
}

export { assetsPanel };

// ------------------------------------------------------------------------------------------------------------------------------------
export function inspector(ed) {
  const root = el('div'), sel = ed.sel;
  const ents = ed.selEntities(), nE = sel.ents.size, nEd = sel.edges.size, nC = sel.cells.size, total = nE + nEd + nC;
  if (!total) return emptyInspector(ed);
  if (total > 1) {
    root.append(el('div', { class: 'insp-head' }, el('div', {}, el('b', {}, `${total} things selected`), el('small', {}, `${nE} entities · ${nEd} wall pieces · ${nC} cells`))));
    root.append(el('div', { class: 'insp-pad' }, el('div', { class: 'row' }, el('button', { onclick: () => ed.copySel() }, 'Copy (Ctrl+C)'), el('button', { onclick: () => ed.duplicateSel() }, 'Duplicate (Ctrl+D)'), el('button', { class: 'danger', onclick: () => ed.deleteSelection() }, 'Delete')),
      nE ? el('div', { class: 'row' }, el('button', { onclick: () => ed.rotateSel(90) }, 'Rotate ⟳ 90°'), el('button', { onclick: () => ed.rotateSel(-90) }, '⟲ 90°')) : null,
      ents.length > 1 && ents.every((e) => e.type === ents[0].type) ? el('div', { class: 'tip' }, 'Tip: edit one of them, then use "Copy settings to similar" to apply scripts/rules to all selected of the same type.') : null));
    return root;
  }
  if (nE) return entityInspector(ed, ents[0]);
  if (nEd) return edgeInspector(ed, [...sel.edges][0]);
  return cellInspector(ed, [...sel.cells][0]);
}

function emptyInspector(ed) {
  const root = el('div', { class: 'insp-pad' });
  root.append(el('h4', {}, 'Nothing selected'), el('div', { class: 'muted' }, 'Click an entity, a wall piece or a floor cell with the Select tool (V).'));
  root.append(el('div', { class: 'tip' }, el('b', {}, 'Quick start'), el('ol', { style: { margin: '4px 0 0 16px', padding: 0 } },
    el('li', {}, 'Room tool (R): drag a rectangle → floor, ceiling and walls.'), el('li', {}, 'Wall tool (W): pick Door or Window in Build, click an edge in the room wall.'),
    el('li', {}, 'Items tab: click an enemy / pickup / light, then click the map.'), el('li', {}, 'Place a Player start and a Level exit.'), el('li', {}, 'F5 = play-test, Ctrl+S = save.'))));
  const issues = ed.problems;
  root.append(el('h4', {}, `Problems (${issues.length})`));
  if (!issues.length) root.append(el('div', { class: 'muted' }, 'None found. 🎉')); else for (const i of issues.slice(0, 8)) root.append(el('div', { class: i.level === 'error' ? '' : 'muted', style: { color: i.level === 'error' ? 'var(--err)' : undefined, cursor: i.id ? 'pointer' : 'default' }, onclick: () => i.id && ed.selectEntity(i.id, false, true) }, `${i.level === 'error' ? '✖' : '⚠'} ${i.msg}`));
  root.append(el('h4', {}, 'Stats'));
  const lv = ed.level, cnt = (f) => lv.entities.filter(f).length;
  root.append(el('div', { class: 'muted' }, `${lv.layers.reduce((a, l) => a + Object.keys(l.cells).length, 0)} cells · ${lv.layers.reduce((a, l) => a + Object.keys(l.edges).length, 0)} wall pieces · ${lv.entities.length} entities (${cnt((e) => ed.bank.entity(e.type)?.enemy)} enemies, ${cnt((e) => ed.bank.entity(e.type)?.light)} lights)`));
  return root;
}

function head(ed, ent, def) {
  return el('div', { class: 'insp-head' }, el('div', { class: 'ic', style: { background: def?.color ?? '#999' } }, def?.glyph ?? '?'), el('div', { style: { flex: 1, minWidth: 0 } }, el('b', {}, def?.label ?? ent.type), el('small', {}, def?.doc ?? '')), el('button', { title: 'Focus in 3D (F)', onclick: () => ed.focus3d() }, '◎'));
}

function entityInspector(ed, e) {
  const def = ed.bank.entity(e.type), root = el('div');
  root.append(head(ed, e, def));
  const g = el('details', { class: 'sec', open: true }, el('summary', {}, 'General'));
  const upd = (k, v) => { e[k] = v; ed.commit(`edit ${k}`); };
  g.append(el('div', { class: 'row' }, el('label', { title: 'Used by Target fields and Rules to find this entity' }, 'Name'), el('input', { type: 'text', value: e.name || '', placeholder: 'e.g. guard1', onchange: (ev) => upd('name', ev.target.value.trim()) }), el('button', { class: 'hint', title: 'Generate a unique name', onclick: () => { e.name = ed.uniqueName(e.type); ed.commit('name'); } }, '✎')));
  g.append(el('div', { class: 'row' }, el('label', { title: 'Group label: a rule target "#tag" addresses all entities with it' }, 'Tag'), el('input', { type: 'text', value: e.tag || '', placeholder: 'e.g. wave1', onchange: (ev) => upd('tag', ev.target.value.trim()) })));
  g.append(el('div', { class: 'row' }, el('label', { title: 'Name (or #tag) of an entity/door this one controls' }, 'Target'), el('input', { type: 'text', value: e.target || '', list: 'dl-names', placeholder: 'door / light / entity name', onchange: (ev) => upd('target', ev.target.value.trim()) })));
  g.append(el('datalist', { id: 'dl-names' }, ...ed.names().map((n) => el('option', { value: n }))));
  g.append(el('div', { class: 'row' }, el('label', {}, 'Rotation'), el('input', { type: 'number', value: Math.round(e.rot || 0), step: 15, onchange: (ev) => upd('rot', ((+ev.target.value % 360) + 360) % 360) }), el('button', { onclick: () => { e.rot = ((e.rot || 0) + 45) % 360; ed.commit('rotate'); } }, '+45°')));
  g.append(el('div', { class: 'row' }, el('label', { title: 'Metres above the floor' }, 'Height offset'), el('input', { type: 'number', step: 0.1, value: e.y || 0, onchange: (ev) => upd('y', +ev.target.value || 0) })));
  g.append(el('div', { class: 'row' }, el('label', {}, 'Position'), el('input', { type: 'number', step: 0.5, value: +e.x.toFixed(2), onchange: (ev) => upd('x', +ev.target.value) }), el('input', { type: 'number', step: 0.5, value: +e.z.toFixed(2), onchange: (ev) => upd('z', +ev.target.value) })));
  g.append(el('div', { class: 'row' }, el('label', {}, 'Layer'), el('select', { onchange: (ev) => { e.layer = +ev.target.value; ed.commit('layer'); } }, ...ed.level.layers.map((l, i) => el('option', { value: i, selected: i === e.layer }, `${i} ${l.name}`)))));
  root.append(g);
  if (def?.props && Object.keys(def.props).length) {
    const p = el('details', { class: 'sec', open: true }, el('summary', {}, 'Properties'));
    p.append(buildForm(def.props, e.props, (k, v) => { if (v === undefined) delete e.props[k]; else e.props[k] = v; ed.commit(`prop ${k}`, { keepInspector: true }); }, ed.formCtx()));
    root.append(p);
  }
  // path
  if (def?.enemy || def?.cat === 'Allies' || e.scripts?.some((s) => s.id === 'ai-patrol')) {
    const p = el('details', { class: 'sec' , open: !!e.path?.length }, el('summary', {}, `Patrol path (${e.path?.length ?? 0})`));
    p.append(el('div', { class: 'row' }, el('button', { class: ed.tool === 'path' ? 'on' : '', onclick: () => ed.setTool(ed.tool === 'path' ? 'select' : 'path') }, ed.tool === 'path' ? 'Done drawing' : 'Draw path (P)'), el('button', { onclick: () => { e.path = []; ed.commit('clear path'); } }, 'Clear')));
    p.append(el('div', { class: 'muted' }, 'Click the map to add waypoints; Shift-click one to remove. The entity walks them in order and loops.'));
    for (const [i, pt] of (e.path ?? []).entries()) {
      const row = el('div', { class: 'waypoint-row', 'data-waypoint': i });
      row.append(el('b', {}, String(i + 1)));
      for (const [j, label] of [[0, 'X'], [1, 'Z'], [2, 'Wait (s)']]) row.append(el('label', {}, label, el('input', {
        type: 'number', 'aria-label': `Waypoint ${i + 1} ${label}`, value: pt[j] ?? 0.8, step: j === 2 ? 0.1 : 0.25, min: j === 2 ? 0 : undefined,
        onchange: (ev) => { const v = Number(ev.target.value); if (!Number.isFinite(v) || ev.target.value === '') { ev.target.value = pt[j] ?? 0.8; return; } pt[j] = j === 2 ? Math.max(0, v) : v; ed.commit('edit waypoint'); },
      })));
      const move = (d) => { const path = e.path; [path[i], path[i + d]] = [path[i + d], path[i]]; ed.commit('reorder waypoint'); };
      row.append(el('button', { title: 'Move waypoint earlier', disabled: i === 0, onclick: () => move(-1) }, '↑'),
        el('button', { title: 'Move waypoint later', disabled: i === e.path.length - 1, onclick: () => move(1) }, '↓'),
        el('button', { title: 'Insert waypoint after', onclick: () => { const next = e.path[(i + 1) % e.path.length]; e.path.splice(i + 1, 0, [(pt[0] + next[0]) / 2, (pt[1] + next[1]) / 2, pt[2] ?? 0.8]); ed.commit('insert waypoint'); } }, '+'),
        el('button', { title: 'Remove waypoint', onclick: () => { e.path.splice(i, 1); ed.commit('remove waypoint'); } }, '×'));
      p.append(row);
    }
    if (e.path?.length > 1) p.append(el('button', { onclick: () => { e.path.reverse(); ed.commit('reverse patrol'); } }, 'Reverse route'));
    root.append(p);
  }
  root.append(el('div',{class:'insp-pad'},el('h4',{},'Reusable item'),el('div',{class:'row'},
    el('button',{disabled:!ed.api.available,onclick:()=>ed.saveVariant(e)},'Save as variant…'),
    def?.custom?el('button',{disabled:!ed.api.available,onclick:()=>ed.saveVariant(e,true)},'Update variant defaults…'):null),
    el('div',{class:'muted'},'Edit this instance above, then save a reusable variant. Built-ins are kept.')));
  root.append(scriptsSection(ed, e, def));
  root.append(rulesSection(ed, e));
  const foot = el('div', { class: 'insp-pad' }, el('div', { class: 'row' }, el('button', { onclick: () => ed.duplicateSel() }, 'Duplicate'), el('button', { class: 'danger', onclick: () => ed.deleteSelection() }, 'Delete'), el('button', { title: 'Copy scripts, rules and properties to every other entity of this type', onclick: () => ed.copySettingsToSimilar(e) }, 'Copy settings to similar')));
  root.append(foot);
  return root;
}

function scriptsSection(ed, e, def) {
  const sec = el('details', { class: 'sec', open: true }, el('summary', {}, 'Scripts'));
  const list = resolveScripts(def, e);
  const defaults = new Set((def?.scripts ?? []).map((s) => s.id));
  if (!list.length) sec.append(el('div', { class: 'muted' }, 'No scripts. Attach one below — or drag from the Scripts tab onto this entity.'));
  for (const s of list) {
    const mod = ed.bank.script(s.id); const entry = (e.scripts ??= []).find((x) => x.id === s.id);
    const body = el('div', { class: 'body' });
    if (!mod) body.append(el('div', { style: { color: 'var(--err)' } }, 'Script not found in the bank.'));
    else { body.append(el('div', { class: 'muted' }, mod.desc ?? '')); body.append(buildForm(mod.params ?? {}, mergeParams(def, e, s.id), (k, v) => { const ent = ed.scriptEntry(e, s.id); if (v === undefined) delete ent.params[k]; else ent.params[k] = v; ed.tidyScripts(e, def); ed.commit(`script ${s.id}.${k}`, { keepInspector: true }); }, ed.formCtx())); }
    sec.append(el('div', { class: `script${s.off ? ' off' : ''}` }, el('header', {}, el('b', {}, mod?.title ?? s.id), defaults.has(s.id) ? el('span', { class: 'badge' }, 'default') : null,
      el('label', { class: 'chk', title: 'Enable / disable this script' }, el('input', { type: 'checkbox', checked: !s.off, onchange: (ev) => { const ent = ed.scriptEntry(e, s.id); if (ev.target.checked) { if(def?.scripts?.find(x=>x.id===s.id)?.off) ent.off=false;else delete ent.off; } else ent.off = true; ed.tidyScripts(e, def); ed.commit('toggle script'); } })),
      el('button', { title: 'Remove this script', onclick: () => { ed.removeScript(e, s.id, def); } }, '✕')), body));
    void entry;
  }
  const sel = el('select', { onchange: (ev) => { if (ev.target.value) ed.attachScript(ev.target.value); } }, el('option', { value: '' }, '+ Attach script…'), ...groupScripts(ed));
  sec.append(el('div', { class: 'row' }, sel), el('div', { class: 'row' }, el('button', { onclick: () => ed.setTab('assets', 'script') }, 'New script…')));
  return sec;
}
const groupScripts = (ed) => { const out = []; for (const c of [...new Set(ed.bank.scripts.map((s) => s.cat ?? 'Other'))]) out.push(el('optgroup', { label: c }, ...ed.bank.scripts.filter((s) => (s.cat ?? 'Other') === c).map((s) => el('option', { value: s.id }, s.title ?? s.id)))); return out; };
function mergeParams(def, e, id) { const base = (def?.scripts ?? []).find((s) => s.id === id)?.params ?? {}; const own = (e.scripts ?? []).find((s) => s.id === id)?.params ?? {}; return { ...base, ...own }; }

function rulesSection(ed, e) {
  const sec = el('details', { class: 'sec', open: true }, el('summary', {}, `Rules — no-code logic (${e.rules?.length ?? 0})`));
  sec.append(el('div', { class: 'muted' }, 'WHEN something happens → DO an action. Example: switch "used" → open door "door1".'));
  (e.rules ??= []).forEach((r, i) => {
    const w = WHENS.find((x) => x.id === r.when), a = ACTIONS.find((x) => x.id === r.do);
    const f = (k, v) => { if (v === '' || v === undefined) delete r[k]; else r[k] = v; ed.commit('rule', { keepInspector: true }); };
    const r1 = el('div', { class: 'r1' }, el('span', {}, 'When'), el('select', { onchange: (ev) => { r.when = ev.target.value; ed.commit('rule'); } }, ...WHENS.map((x) => el('option', { value: x.id, selected: x.id === r.when }, x.label))));
    if (r.when === 'timer') r1.append(el('input', { type: 'number', value: r.every ?? 5, min: 0.1, step: 0.5, title: 'seconds', style: { width: '64px', flex: 'none' }, onchange: (ev) => f('every', +ev.target.value) }));
    if (r.when === 'event') r1.append(el('input', { type: 'text', value: r.event ?? '', list: 'dl-events', placeholder: 'door1.opened', onchange: (ev) => f('event', ev.target.value.trim()) }));
    r1.append(el('span', {}, 'do'), el('select', { onchange: (ev) => { r.do = ev.target.value; ed.commit('rule'); } }, ...ACTIONS.map((x) => el('option', { value: x.id, selected: x.id === r.do }, x.label))), el('button', { title: 'Delete rule', onclick: () => { e.rules.splice(i, 1); ed.commit('delete rule'); } }, '✕'));
    const r2 = el('div', { class: 'r1', style: { marginTop: '4px' } });
    const fields = a?.fields ?? [];
    if (fields.includes('target')) r2.append(el('input', { type: 'text', value: r.target ?? '', list: 'dl-names', placeholder: 'target (name / #tag / door)', onchange: (ev) => f('target', ev.target.value.trim()) }));
    if (fields.includes('text')) r2.append(el('input', { type: 'text', value: r.text ?? '', placeholder: a?.hint?.split('=')[0]?.trim().slice(0, 28) || 'text', title: a?.hint ?? '', onchange: (ev) => f('text', ev.target.value) }));
    if (fields.includes('value')) r2.append(el('input', { type: 'number', value: r.value ?? '', placeholder: 'value', style: { width: '70px', flex: 'none' }, onchange: (ev) => f('value', ev.target.value === '' ? undefined : +ev.target.value) }));
    r2.append(el('input', { type: 'number', value: r.delay ?? '', placeholder: 'delay s', title: 'Delay in seconds', style: { width: '66px', flex: 'none' }, onchange: (ev) => f('delay', ev.target.value === '' ? undefined : +ev.target.value) }), el('label', { class: 'chk' }, el('input', { type: 'checkbox', checked: !!r.once, onchange: (ev) => f('once', ev.target.checked || undefined) }), 'once'));
    sec.append(el('div', { class: 'rule' }, r1, r2, a?.hint ? el('div', { class: 'muted', style: { marginTop: '3px' } }, a.hint) : null));
    void w;
  });
  sec.append(el('datalist', { id: 'dl-events' }, ...ed.eventNames().map((n) => el('option', { value: n }))));
  sec.append(el('div', { class: 'row' }, el('button', { onclick: () => { const def = ed.bank.entity(e.type); e.rules.push({ when: def?.usable ? 'used' : def?.zone ? 'enter' : def?.enemy ? 'died' : 'start', do: 'message', text: 'Hello!' }); ed.commit('add rule'); } }, '+ Add rule')));
  return sec;
}

function edgeInspector(ed, key) {
  const [x, z, o] = key.split(','); const piece = ed.level.layers[ed.layer].edges[key]; if (!piece) return emptyInspector(ed);
  const def = ed.bank.piece(piece.k), root = el('div'), kind = classify(def);
  const pv = piecePreview(ed, def, { wall: piece.t, trim: piece.tt || def.tt || 'metal_panel', door: piece.td || 'door_metal' }, 64, 36); pv.style.cssText = 'width:64px;height:36px;border-radius:4px';
  root.append(el('div', { class: 'insp-head' }, pv, el('div', {}, el('b', {}, def?.label ?? piece.k), el('small', {}, `edge ${x},${z} ${o === 'H' ? '(east–west)' : '(north–south)'} · layer ${ed.layer}`))));
  const p = el('div', { class: 'insp-pad' });
  const upd = (patch) => { Object.assign(piece, patch); for (const k of Object.keys(patch)) if (patch[k] === '' || patch[k] === undefined || patch[k] === false) delete piece[k]; ed.commit('edit piece', { keepInspector: true }); };
  p.append(el('div', { class: 'row' }, el('label', {}, 'Piece'), el('select', { onchange: (ev) => { piece.k = ev.target.value; ed.commit('piece type'); } }, ...ed.bank.pieces.map((s) => el('option', { value: s.id, selected: s.id === piece.k }, `${s.cat}: ${s.label}`)))));
  const texSel = (label, key, cat, dflt) => el('div', { class: 'row' }, el('label', {}, label), el('select', { onchange: (ev) => upd({ [key]: ev.target.value }) }, key === 'tb' ? el('option', { value: '' }, '(same)') : null, ...ed.bank.textures.filter((t) => cat.includes(t.cat)).map((t) => el('option', { value: t.id, selected: (piece[key] || dflt) === t.id }, t.label))));
  p.append(texSel('Front texture', 't', ['wall', 'floor'], 'concrete'), texSel('Back texture', 'tb', ['wall', 'floor'], ''), texSel('Trim texture', 'tt', ['wall'], 'metal_panel'));
  if (def?.parts.some((q) => q.mat === 'door')) p.append(texSel('Door texture', 'td', ['door', 'wall'], 'door_metal'));
  p.append(el('div', { class: 'row' }, el('label', {}, 'Flip sides'), el('input', { type: 'checkbox', checked: !!piece.flip, onchange: (ev) => upd({ flip: ev.target.checked }) })));
  if (def?.door) {
    p.append(el('h4', {}, 'Door'));
    p.append(el('div', { class: 'row' }, el('label', { title: 'Rules / scripts can open it by this name' }, 'Name'), el('input', { type: 'text', value: piece.name ?? '', list: 'dl-names', placeholder: 'door1', onchange: (ev) => upd({ name: ev.target.value.trim() }) }), el('button', { class: 'hint', onclick: () => upd({ name: ed.uniqueName('door') }) }, '✎')));
    p.append(el('div', { class: 'row' }, el('label', {}, 'Locked with key'), el('select', { onchange: (ev) => upd({ lock: ev.target.value }) }, ...['', 'red', 'blue', 'yellow', 'green'].map((k) => el('option', { value: k, selected: (piece.lock ?? '') === k }, k || '(unlocked)')))));
    p.append(el('div', { class: 'row' }, el('label', {}, 'Opens by itself'), el('input', { type: 'checkbox', checked: piece.auto !== false && !def.door.secret, disabled: !!def.door.secret, onchange: (ev) => upd({ auto: ev.target.checked ? undefined : false }) }), el('span', { class: 'hint' }, 'otherwise [E] / switch')));
    p.append(el('div', { class: 'row' }, el('label', {}, 'Stays open (s)'), el('input', { type: 'number', min: 0, max: 600, step: 0.5, value: piece.close ?? 4, onchange: (ev) => upd({ close: +ev.target.value }) })));
    p.append(el('div', { class: 'muted' }, 'Door events: <name>.opened / <name>.closed. Actions: Open / Close / Toggle / Lock / Unlock with the door name as target.'));
  }
  p.append(el('div', { class: 'row', style: { marginTop: '8px' } }, el('button', { class: 'danger', onclick: () => ed.deleteSelection() }, 'Delete piece'), el('button', { onclick: () => ed.copySel() }, 'Copy')));
  root.append(p); void kind; return root;
}

function cellInspector(ed, key) {
  const cell = ed.level.layers[ed.layer].cells[key]; const [cx, cz] = key.split(',').map(Number);
  if (!cell) return emptyInspector(ed);
  const root = el('div'), p = el('div', { class: 'insp-pad' });
  root.append(el('div', { class: 'insp-head' }, swatchCanvas(ed, cell.f), el('div', {}, el('b', {}, `Cell ${cx}, ${cz}`), el('small', {}, `layer ${ed.layer} · ${cx * CELL}–${(cx + 1) * CELL} m`))));
  const upd = (patch) => { ed.applyToSelectedCells((c) => { for (const [k, v] of Object.entries(patch)) { if (v === '' || v === null || v === undefined) delete c[k]; else c[k] = v; } }); };
  const tex = (label, k, cats) => p.append(el('div', { class: 'row' }, el('label', {}, label), el('select', { onchange: (ev) => upd({ [k]: ev.target.value }) }, el('option', { value: '' }, k === 'f' ? '(hole)' : '(open sky)'), ...ed.bank.textures.filter((t) => cats.includes(t.cat)).map((t) => el('option', { value: t.id, selected: cell[k] === t.id }, t.label)))));
  tex('Floor', 'f', ['floor', 'wall']); tex('Ceiling', 'c', ['ceiling', 'floor', 'wall']);
  const shapeEdit = (patch) => {
    if ([...ed.sel.cells].some(k => { const c=ed.level.layers[ed.layer].cells[k]; return c?.s || c?.p; })) return toast('Remove stairs/pillars before shaping these cells.');
    ed.applyToSelectedCells(c => { if (patch.kind === '') delete c.shape; else c.shape = { kind:'diagonal',corner:'NE',t:ed.brush.wallTex,...c.shape,...patch }; });
  };
  p.append(el('div',{class:'row'},el('label',{},'Corner shape'),el('select',{'aria-label':'Cell corner shape',onchange:ev=>shapeEdit({kind:ev.target.value})},...[['','Square'],['diagonal','45° diagonal'],['round','Rounded']].map(([v,l])=>el('option',{value:v,selected:(cell.shape?.kind||'')===v},l)))));
  if (cell.shape) {
    p.append(el('div',{class:'row'},el('label',{},'Cut off corner'),el('select',{'aria-label':'Cell cut corner',onchange:ev=>shapeEdit({corner:ev.target.value})},...CORNERS.map(v=>el('option',{value:v,selected:cell.shape.corner===v},v)))));
    for(const [field,label] of [['t','Corner wall'],['tb','Corner back']]) p.append(el('div',{class:'row'},el('label',{},label),el('select',{onchange:ev=>shapeEdit({[field]:ev.target.value})},...ed.bank.textures.filter(t=>t.cat==='wall').map(t=>el('option',{value:t.id,selected:(cell.shape[field]||cell.shape.t)===t.id},t.label)))));
  }
  p.append(el('div', { class: 'row' }, el('label', {}, 'Floor height'), el('select', { onchange: (ev) => upd({ h: +ev.target.value || '' }) }, ...FLOOR_HEIGHTS.map((h) => el('option', { value: h, selected: (cell.h || 0) === h }, `${h > 0 ? '+' : ''}${h} m`)))));
  p.append(el('div', { class: 'row' }, el('label', {}, 'Stairs'), el('select', { onchange: (ev) => { const v = ev.target.value; if (v && cell.shape) return toast('Restore Square before adding stairs.'); ed.applyToSelectedCells((c) => { if (!v) delete c.s; else c.s = { id: v, d: c.s?.d || 'N' }; }); } }, el('option', { value: '' }, '(none)'), ...ed.bank.stairs.map((s) => el('option', { value: s.id, selected: cell.s?.id === s.id }, s.label))), cell.s ? el('select', { style: { flex: 'none', width: '60px' }, onchange: (ev) => ed.applyToSelectedCells((c) => { c.s.d = ev.target.value; }) }, ...['N', 'E', 'S', 'W'].map((d) => el('option', { value: d, selected: cell.s.d === d }, d))) : null));
  p.append(el('div', { class: 'row' }, el('label', {}, 'Pillar / block'), el('select', { onchange: (ev) => { if(ev.target.value && cell.shape) return toast('Restore Square before adding a pillar.'); upd({ p: ev.target.value }); } }, el('option', { value: '' }, '(none)'), ...ed.bank.cellPieces.map((s) => el('option', { value: s.id, selected: cell.p === s.id }, s.label)))));
  p.append(el('div', { class: 'row', style: { marginTop: '8px' } }, el('button', { class: 'danger', onclick: () => ed.deleteSelection() }, 'Clear cell'), el('button', { onclick: () => ed.copySel() }, 'Copy')));
  root.append(p); return root;
}
const swatchCanvas = (ed, id) => { const c = swatch(ed, id || 'concrete'); c.style.cssText = 'width:34px;height:34px;border-radius:5px'; return c; };
