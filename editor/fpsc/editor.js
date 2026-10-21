// Nord FPS Level Editor — state, tools, undo, file IO, play-test. Views: map2d.js (2D), view3d.js (3D); palettes + inspector: panels.js.
import { newLevel, newLayer, normalize, validate, setCell, getCell, setEdge, CELL, STORY, key, ekey, unkey, uid, bounds, FORMAT } from '/runtime/fpsc/level.js';
import { createBank, entityVariant } from '/runtime/fpsc/bank.js';
import { SOUND_NAMES } from '/runtime/fpsc/audio.js';
import { el, modal, toast, debounce } from './forms.js';
import { Map2D, classify } from './map2d.js';
import { View3D } from './view3d.js';
import { buildPanel, itemsPanel, scriptsPanel, levelPanel, assetsPanel, objectsPanel, inspector } from './panels.js';
import { normalizeShortcuts, matchesShortcut, shortcutLabel } from './shortcuts.js';
import { hiddenCornerEdge } from '/runtime/fpsc/corners.js';
import { HELP } from './help.js';

const $ = (id) => document.getElementById(id);
/** localStorage can throw (blocked / private mode / embedded webviews): never let that break the editor. */
const LS = { get: (k) => { try { return localStorage.getItem(k); } catch { return null; } }, set: (k, v) => { try { localStorage.setItem(k, v); } catch { /* ignore */ } }, del: (k) => { try { localStorage.removeItem(k); } catch { /* ignore */ } } };
const TOOLS = [
  ['select', 'V', '⬚', 'Select / move / box-select'], ['wall', 'W', '▬', 'Wall pieces: click an edge or drag a line (Shift = erase)'], ['room', 'R', '▭', 'Room: drag a rectangle → floor, ceiling and walls'],
  ['floor', 'F', '▦', 'Paint floors (drag; Ctrl = rectangle; Shift = erase)'], ['ceiling', 'C', '▔', 'Paint ceilings (Shift = open sky)'], ['fill', 'G', '◩', 'Fill a region with the floor texture'],
  ['cell', 'S', '≣', 'Stairs / floor height / pillars / corners'], ['entity', 'A', '◉', 'Add: place the chosen item (Items tab)'], ['path', 'P', '⤳', 'Patrol path of the selected entity'],
  ['erase', 'X', '⌫', 'Erase: click or drag a rectangle (Shift = only wall pieces)'], ['eyedrop', 'I', '✎', 'Eyedropper (also Alt+click with any tool)'],
];
const HINTS = {
  select: 'Click to select · drag empty space = box select · drag an item to move · Del removes · Q/E rotate · arrows nudge · Ctrl+C/V/D copy/paste/duplicate',
  wall: 'Click an edge to place/remove a piece · drag between grid points to draw a line · Shift = erase · pick the piece and texture in Build',
  room: 'Drag a rectangle of cells. Build tab → Room options decide floor / ceiling / walls. Shift = erase area.',
  floor: 'Drag to paint floor cells with the Floor texture · Ctrl+drag = rectangle · Shift = remove floor (hole)',
  ceiling: 'Drag to paint ceilings with the Ceiling texture · Shift = remove (open sky)',
  fill: 'Click a cell: fills the connected region (walls stop it) with the Floor texture (and ceiling if the cell had one)',
  cell: 'Build → Cell objects chooses stairs, height, pillars or corners · click a cell · Shift = remove / restore Square',
  entity: 'Click to place · Q/E rotate · Alt = free position · Ctrl = cell centre · drag items from the Items tab onto the map',
  path: 'Select an enemy first · click = add waypoint · Shift+click = remove · Esc = done',
  erase: 'Click to erase the item / wall piece / cell under the cursor · drag a rectangle to erase an area (Shift = only wall pieces)',
  eyedrop: 'Click a floor, wall piece or item to copy its texture / type into the brush',
};

const ed = {
  level: null, bank: null, bankJson: {}, layer: 0, tool: 'select', path: '', dirty: false, view: 'split', ghost: true, showLights: false, snap: true, preview: null,
  sel: { ents: new Set(), edges: new Set(), cells: new Set() }, problems: [], clip: null, show3dCeilings: false, show3dAll: false, tab: 'build', entRot: 0, cursor: [0, 0], cursorCell: [0, 0],
  brush: { slot: 'wall', piece: 'wall', wallTex: 'brick', backTex: '', trimTex: 'metal_panel', doorTex: 'door_metal', floorTex: 'floor_concrete', ceilTex: 'ceiling_tiles', entity: 'enemy_soldier', stair: 'stairs', stairDir: 'N', height: 0.4, pillar: 'pillar', cellMode: 'stairs', room: { floor: true, ceiling: true, walls: true } },
  hist: [], hi: -1, api: { available: false },
};
window.__fpscEditor = ed;

// Updating bindings never reloads the page or touches the level/undo history.
ed.shortcuts = normalizeShortcuts();
ed.configureShortcuts = (value) => {
  const next = normalizeShortcuts(value);
  if (JSON.stringify(next) === JSON.stringify(ed.shortcuts) && ed.shortcutsReady) return;
  ed.shortcuts = next; ed.shortcutsReady = true;
  $('top').querySelector('[data-act="play"]').title = `Play-test from Player Start (${shortcutLabel(next.test)})`;
  $('top').querySelector('[data-act="playhere"]').title = `Play-test from selection / cursor (${shortcutLabel(next.test_here)})`;
  $('play-close').textContent = `✕ Close test (${shortcutLabel(next.stop)})`;
  if (ed.playing) $('play-frame').contentWindow?.postMessage({ type: 'fpsc-shortcuts', shortcuts: next }, location.origin);
};
try { ed.configureShortcuts(JSON.parse(new URLSearchParams(location.search).get('shortcuts') || 'null')); } catch { ed.configureShortcuts(null); }
window.addEventListener('message', (e) => {
  if (e.origin !== location.origin || ![window, window.parent].includes(e.source)) return;
  if (e.data?.type === 'fpsc-shortcuts') ed.configureShortcuts(e.data.shortcuts);
});

// ================================================================================================================================ API
ed.api.save = async (path, data) => {
  if (!ed.api.available) { download(path.split('/').pop(), data); return false; }
  const r = await fetch(`/api/fpsc/save?path=${encodeURIComponent(path)}`, { method: 'POST', headers: { 'x-nord-fpsc': '1' }, body: data });
  if (!r.ok) { const t = await r.text().catch(() => ''); toast(`Save failed: ${r.status} ${t}`.slice(0, 120), 5000); throw new Error(`save ${path}: ${r.status} ${t}`); }
  return true;
};
ed.api.ls = async (dir) => { try { const r = await fetch(`/api/fpsc/ls?dir=${encodeURIComponent(dir)}`); return r.ok ? await r.json() : []; } catch { return []; } };
ed.api.install = async () => { const r = await fetch('/api/fpsc/install', { method: 'POST', headers: { 'x-nord-fpsc': '1' } }); if (!r.ok) throw new Error(await r.text()); return r.json(); };
function download(name, data) { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([data])); a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000); }

async function detectApi() { try { const r = await fetch('/api/fpsc/ls?dir=levels'); ed.api.available = r.ok; } catch { ed.api.available = false; } }
async function loadBankJson() { try { const r = await fetch('/fpsc/bank.json', { cache: 'no-store' }); if (r.ok) return await r.json(); } catch { /* none */ } return {}; }
ed.reloadBank = async () => {
  ed.bankJson = await loadBankJson();
  ed.bank = await createBank(ed.bankJson, { importer: (p) => import(/* @vite-ignore */ `/${p}?t=${Date.now()}`), urlOf: (p) => `/${p}` });
  for (const w of ed.bank.warns) log('warn', w);
  if (!ed.level) return;
  ed.renderLeft(); ed.map?.draw(); ed.v3?.invalidate(); ed.refreshInspector(); validateNow();
};
ed.editBank = async (mut) => { const b = structuredClone(ed.bankJson ?? {}); mut(b); await ed.api.save('fpsc/bank.json', JSON.stringify(b, null, 2)); ed.bankJson = b; await ed.reloadBank(); };
ed.editBankRaw = async () => {
  const ta = el('textarea', { style: { minHeight: '320px', fontFamily: 'ui-monospace,monospace' }, value: JSON.stringify(ed.bankJson ?? {}, null, 2) });
  const r = await modal('fpsc/bank.json', [el('div', { class: 'muted' }, 'Custom textures, pieces, entities, models, weapons, sounds and script paths. See Help → Adding assets.'), ta], [{ label: 'Cancel' }, { label: 'Save', primary: true }]);
  if (r !== 'Save') return; try { const o = JSON.parse(ta.value); await ed.editBank((b) => { for (const k of Object.keys(b)) delete b[k]; Object.assign(b, o); }); toast('bank.json saved'); } catch (e) { toast(`Invalid JSON: ${e.message}`, 5000); }
};
ed.soundNames = () => [...SOUND_NAMES, ...Object.keys(ed.bankJson.sounds ?? {})];

// ================================================================================================================================ helpers
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const cellOf = (wx, wz) => [clamp(Math.floor(wx / CELL), 0, ed.level.w - 1), clamp(Math.floor(wz / CELL), 0, ed.level.d - 1)];
const snap = (v, step = ed.snapStep ?? 0.5) => Math.round(v / step) * step;
const layerData = () => ed.level.layers[ed.layer];
const entById = (id) => ed.level.entities.find((e) => e.id === id);
ed.isSelEnt = (id) => ed.sel.ents.has(id);
ed.selEntities = () => [...ed.sel.ents].map(entById).filter(Boolean);
ed.selectedEntity = () => { const a = ed.selEntities(); return ed.sel.ents.size === 1 && !ed.sel.edges.size && !ed.sel.cells.size ? a[0] ?? null : null; };
ed.selectedPos = () => { const e = ed.selectedEntity(); return e ? [e.x, e.z, e.layer] : null; };
ed.contentBounds = () => bounds(ed.level);
ed.names = () => { const s = new Set(); for (const e of ed.level.entities) { if (e.name) s.add(e.name); for (const t of (e.tag || '').split(/[\s,]+/).filter(Boolean)) s.add(`#${t}`); } for (const ly of ed.level.layers) for (const p of Object.values(ly.edges)) if (p.name) s.add(p.name); return [...s].sort(); };
ed.eventNames = () => { const s = new Set(['level.start', 'level.won', 'player.died', 'alarm', 'alarm.off', 'boss.died']); for (const e of ed.level.entities) if (e.name) for (const v of ['used', 'died', 'enter', 'exit', 'touched', 'alert', 'on', 'off', 'cleared', 'talked', 'timer']) s.add(`${e.name}.${v}`); for (const ly of ed.level.layers) for (const p of Object.values(ly.edges)) if (p.name) { s.add(`${p.name}.opened`); s.add(`${p.name}.closed`); } return [...s].sort(); };
ed.formCtx = () => ({ targets: () => ed.names(), sounds: () => ed.soundNames() });
ed.uniqueName = (type) => { const base = type.replace(/^(enemy|light|npc|trigger|weapon)_/, '').replace(/_/g, ''), names = new Set(ed.names()); let n = 1; while (names.has(`${base}${n}`)) n++; return `${base}${n}`; };
function log(level, msg, id) { const b = $('con-body'); b.append(el('div', { class: level, 'data-id': id ?? '', onclick: () => id && ed.selectEntity(id, false, true) }, `${level === 'error' ? '✖' : level === 'warn' ? '⚠' : '·'} ${msg}`)); b.scrollTop = b.scrollHeight; if (level !== 'info') $('console').classList.remove('hidden'); }

// ================================================================================================================================ history / dirty
const snapshot = () => JSON.stringify(ed.level);
function pushHistory() { const s = snapshot(); if (ed.hist[ed.hi] === s) return false; ed.hist = ed.hist.slice(0, ed.hi + 1); ed.hist.push(s); if (ed.hist.length > 120) ed.hist.shift(); ed.hi = ed.hist.length - 1; return true; }
ed.commit = (label, o = {}) => {
  const changed = pushHistory(); if (!changed && !o.force) return;
  ed.dirty = true; stashRecovery(); ed.renderTop(); ed.map.draw(); if (o.rebuild3d !== false) ed.v3.invalidate(); validateSoon(); $('st-msg').textContent = label ?? '';
  ed.renderSel(); if (ed.tab === 'objects') ed.renderLeft(); if (!o.keepInspector) ed.refreshInspector();
};
const stashRecovery = debounce(() => { LS.set('fpsc.recovery', JSON.stringify({ path: ed.path, level: ed.level, t: Date.now() })); }, 1200);
ed.undo = () => { if (ed.hi <= 0) return toast('Nothing to undo'); ed.hi--; restore(ed.hist[ed.hi]); toast('Undo'); };
ed.redo = () => { if (ed.hi >= ed.hist.length - 1) return toast('Nothing to redo'); ed.hi++; restore(ed.hist[ed.hi]); toast('Redo'); };
function restore(s) { ed.level = JSON.parse(s); ed.layer = clamp(ed.layer, 0, ed.level.layers.length - 1); for (const id of [...ed.sel.ents]) if (!entById(id)) ed.sel.ents.delete(id); ed.sel.edges.clear(); ed.sel.cells.clear(); ed.dirty = true; afterLevelChange(); }
function afterLevelChange() { ed.renderTop(); ed.renderLeft(); ed.map.draw(); ed.v3.invalidate(); validateNow(); ed.refreshInspector(); ed.renderSel(); }

// ================================================================================================================================ validation
function validateNow() { ed.problems = validate(ed.level, ed.bank); const n = ed.problems.filter((p) => p.level === 'error').length, w = ed.problems.length - n; $('val-n').textContent = n ? `${n}✖ ${w}⚠` : w ? `${w}⚠` : '0'; $('val-btn').style.color = n ? 'var(--err)' : w ? 'var(--warn)' : ''; }
const validateSoon = debounce(() => { validateNow(); if (!ed.sel.ents.size && !ed.sel.edges.size && !ed.sel.cells.size) ed.refreshInspector(); }, 400);
ed.showProblems = () => { validateNow(); const b = $('con-body'); b.innerHTML = ''; if (!ed.problems.length) log('info', 'No problems found.'); for (const p of ed.problems) log(p.level, p.msg, p.id); $('console').classList.remove('hidden'); };

// ================================================================================================================================ selection
ed.selectEntity = (id, additive = false, center = false) => {
  const e = entById(id); if (!e) return; if (e.layer !== ed.layer) ed.setLayer(e.layer, true);
  if (!additive) { ed.sel.ents.clear(); ed.sel.edges.clear(); ed.sel.cells.clear(); }
  if (additive && ed.sel.ents.has(id)) ed.sel.ents.delete(id); else ed.sel.ents.add(id);
  if (center) { ed.map.cx = e.x; ed.map.cz = e.z; ed.map.draw(); }
  ed.refreshInspector(); ed.renderSel(); ed.map.draw(); ed.v3.selectionChanged();
};
ed.clearSel = () => { ed.sel.ents.clear(); ed.sel.edges.clear(); ed.sel.cells.clear(); ed.refreshInspector(); ed.renderSel(); ed.map.draw(); ed.v3.selectionChanged(); };
ed.renderSel = () => { const n = ed.sel.ents.size + ed.sel.edges.size + ed.sel.cells.size; $('st-sel').textContent = n ? `${n} selected` : ''; if (ed.tab === 'objects') for (const row of document.querySelectorAll('[data-object]')) row.classList.toggle('on', ed.sel.ents.has(row.dataset.object)); };
ed.focus3d = () => { const p = ed.selectedPos(); if (p) { ed.v3.focus(p[0], p[1], p[2]); if (ed.view === '2d') ed.setView('split'); } };
ed.applyToSelectedEdges = (fn) => { const ly = layerData(); for (const k of ed.sel.edges) if (ly.edges[k]) fn(ly.edges[k]); ed.commit('edit pieces'); };
ed.applyToSelectedCells = (fn) => { const ly = layerData(); for (const k of ed.sel.cells) if (ly.cells[k]) fn(ly.cells[k]); ed.commit('edit cells'); };

ed.deleteSelection = () => {
  const ly = layerData(); let n = 0;
  for (const k of ed.sel.edges) { delete ly.edges[k]; n++; } for (const k of ed.sel.cells) { delete ly.cells[k]; n++; }
  if (ed.sel.ents.size) { ed.level.entities = ed.level.entities.filter((e) => !ed.sel.ents.has(e.id)); n += ed.sel.ents.size; }
  ed.sel.ents.clear(); ed.sel.edges.clear(); ed.sel.cells.clear(); if (n) ed.commit(`deleted ${n}`);
};
ed.copySel = () => {
  const ents = ed.selEntities().map((e) => structuredClone(e)), ly = layerData();
  const edges = [...ed.sel.edges].map((k) => [k, structuredClone(ly.edges[k])]), cells = [...ed.sel.cells].map((k) => [k, structuredClone(ly.cells[k])]);
  const pts = [...ents.map((e) => [e.x / CELL, e.z / CELL]), ...edges.map(([k]) => unkey(k).slice(0, 2)), ...cells.map(([k]) => unkey(k).slice(0, 2))];
  if (!pts.length) return; const ox = Math.min(...pts.map((p) => p[0])), oz = Math.min(...pts.map((p) => p[1]));
  ed.clip = { ents, edges, cells, ox: Math.floor(ox), oz: Math.floor(oz) }; toast(`Copied ${pts.length} items`);
};
ed.paste = (atCell = ed.cursorCell) => {
  const c = ed.clip; if (!c) return toast('Clipboard is empty'); const dx = atCell[0] - c.ox, dz = atCell[1] - c.oz, ly = layerData(); ed.clearSelRaw();
  for (const [k, p] of c.edges) { const [x, z, o] = unkey(k); const nk = ekey(x + dx, z + dz, o); ly.edges[nk] = structuredClone(p); ed.sel.edges.add(nk); }
  for (const [k, cell] of c.cells) { const [x, z] = unkey(k); const nk = key(x + dx, z + dz); ly.cells[nk] = structuredClone(cell); ed.sel.cells.add(nk); }
  const used = new Set(ed.names());
  for (const e of c.ents) { const n = structuredClone(e); n.id = uid(); n.x += dx * CELL; n.z += dz * CELL; n.layer = ed.layer; if (n.name && used.has(n.name)) n.name = ed.uniqueName(n.type); if (n.name) used.add(n.name); if (n.path) n.path = n.path.map((p) => [p[0] + dx * CELL, p[1] + dz * CELL, ...(p.slice(2))]); ed.level.entities.push(n); ed.sel.ents.add(n.id); }
  ed.commit('pasted');
};
ed.clearSelRaw = () => { ed.sel.ents.clear(); ed.sel.edges.clear(); ed.sel.cells.clear(); };
ed.duplicateSel = () => { ed.copySel(); const c = ed.clip; if (!c) return; ed.paste([c.ox + 1, c.oz + 1]); };
ed.rotateSel = (deg) => { for (const e of ed.selEntities()) e.rot = (((e.rot || 0) + deg) % 360 + 360) % 360; ed.commit('rotate'); };
ed.copySettingsToSimilar = (src) => { let n = 0; for (const e of ed.level.entities) if (e !== src && e.type === src.type) { e.scripts = structuredClone(src.scripts ?? []); e.rules = structuredClone(src.rules ?? []); e.props = structuredClone(src.props ?? {}); n++; } ed.commit(`copied settings to ${n}`); toast(`Copied settings to ${n} similar entities`); };

// ================================================================================================================================ entities / scripts
ed.addEntity = (type, x, z, rot = ed.entRot, extra = {}) => {
  const def = ed.bank.entity(type); if (!def) return null;
  if (def.single) { const old = ed.level.entities.find((e) => e.type === type); if (old) { old.x = x; old.z = z; old.layer = ed.layer; old.rot = rot; ed.commit(`moved ${def.label}`); ed.selectEntity(old.id); return old; } }
  const e = { id: uid(), type, x, z, layer: ed.layer, rot, name: '', tag: '', target: '', props: {}, scripts: [], rules: structuredClone(def.rules ?? []), ...extra }; ed.level.entities.push(e);
  ed.sel.ents.clear(); ed.sel.edges.clear(); ed.sel.cells.clear(); ed.sel.ents.add(e.id); ed.commit(`placed ${def.label}`); ed.v3.selectionChanged(); return e;
};
// Custom bank definitions are shared defaults; built-ins remain intact.
ed.saveVariant = async (entity, update = false) => {
  if (!ed.api.available) return toast('Open a project server to save reusable variants.');
  const def = ed.bank.entity(entity.type); if (!def) return;
  const existing = ed.bankJson.entities?.find(v => v.id === entity.type);
  if (update && !existing) return;
  const label = el('input',{type:'text',value:update?def.label:`${def.label} variant`,'aria-label':'Variant name'});
  const id = el('input',{type:'text',value:update?def.id:`${def.id}_custom`,'aria-label':'Variant id',disabled:update});
  const result = await modal(update?'Update variant defaults':'Save reusable variant',[
    el('div',{class:'tip'},'Captures current properties, enabled/disabled scripts, script parameters and rules. Position, name, tags, target and patrol route stay instance-specific. Rules may still refer to named targets in this level.'),
    el('div',{class:'row'},el('label',{},'Name'),label),el('div',{class:'row'},el('label',{},'Id'),id),
    el('div',{class:'muted'},update?'Updates defaults for this variant. Other placed objects keep their per-instance overrides; new placements use these defaults.':'Creates a new Items entry in fpsc/bank.json. The original item remains available.')
  ],[{label:'Cancel'},{label:update?'Update variant':'Save variant',primary:true}]);
  if(result !== (update?'Update variant':'Save variant')) return;
  const key=id.value.trim(), title=label.value.trim();
  if(!/^[a-z][a-z0-9_]*$/.test(key)||!title) return toast('Use a name and a lowercase id (letters, numbers, underscore).');
  if(!update && ed.bank.entity(key)) return toast('That id already exists. Choose another id.');
  const captured=entityVariant(def,entity,key,title);
  if(update) Object.assign(captured,{...existing,...captured,extends:existing.extends});
  try {
    await ed.editBank(b=>{ b.entities??=[]; const i=b.entities.findIndex(v=>v.id===key); if(i<0)b.entities.push(captured);else b.entities[i]=captured; });
    entity.type=key; entity.props={}; entity.scripts=[];
    ed.brush.entity=key; ed.commit(update?'updated variant':'saved variant'); ed.setTab('items');
    toast(`Saved ${title}; place it from Items. Save the level to keep this instance.`);
  } catch(err) { log('error',`Variant save failed: ${err.message}`); }
};
ed.scriptEntry = (e, id) => { e.scripts ??= []; let s = e.scripts.find((x) => x.id === id); if (!s) { s = { id, params: {} }; e.scripts.push(s); } s.params ??= {}; return s; };
ed.tidyScripts = (e, def) => { const base = new Set((def?.scripts ?? []).map((s) => s.id)); e.scripts = (e.scripts ?? []).filter((s) => s.remove || Object.hasOwn(s,'off') || Object.keys(s.params ?? {}).length || !base.has(s.id)); for (const s of e.scripts) if (s.params && !Object.keys(s.params).length) delete s.params; };
ed.attachScript = (id, ent = ed.selectedEntity()) => {
  if (!ent) return toast('Select an entity first'); const def = ed.bank.entity(ent.type); ent.scripts ??= [];
  const has = ent.scripts.find((s) => s.id === id);
  if (has?.remove) { ent.scripts = ent.scripts.filter((s) => s !== has); } else if (!has && !(def.scripts ?? []).some((s) => s.id === id)) ent.scripts.push({ id });
  else if (has || (def.scripts ?? []).some((s) => s.id === id)) { toast('That script is already attached'); return; }
  ed.commit(`attached ${id}`); toast(`Attached "${ed.bank.script(id)?.title ?? id}"`);
};
ed.removeScript = (e, id, def) => { e.scripts = (e.scripts ?? []).filter((s) => s.id !== id); if ((def?.scripts ?? []).some((s) => s.id === id)) e.scripts.push({ id, remove: true }); ed.commit(`removed ${id}`); };
ed.openScriptSource = async (s) => {
  const url = s.file ? `/${s.file}` : `/runtime/fpsc/behaviours/${s.id}.js`; let src = ''; try { src = await (await fetch(url)).text(); } catch (e) { src = String(e); }
  const pre = el('textarea', { readonly: true, value: src, style: { minHeight: '380px', fontFamily: 'ui-monospace,monospace', whiteSpace: 'pre' } });
  const r = await modal(`Script: ${s.title ?? s.id}`, [el('div', { class: 'muted' }, s.file ?? 'built-in (runtime/fpsc/behaviours)'), pre], [{ label: 'Close' }, ...(s.custom ? [] : [{ label: 'Make an editable copy', primary: true }])]);
  if (r === 'Make an editable copy') await ed.forkScript(s, src);
};
ed.forkScript = async (s, src) => {
  if (!ed.api.available) return toast('Needs the project server');
  const id = `${s.id}-copy`; let out = src.replace(/id:\s*'[^']+'/, `id: '${id}'`).replace(/title:\s*'([^']+)'/, `title: '$1 (copy)'`).replace(/cat:\s*'[^']+'/, "cat: 'Custom'");
  out = out.replace(/from '\.\.\/ai\.js'/g, "from '../../scripts/fpsc/ai.js'").replace(/from '\.\/_(\w+)\.js'/g, "from '../../scripts/fpsc/behaviours/_$1.js'");
  const path = `fpsc/scripts/${id}.js`; await ed.api.save(path, out); await ed.editBank((b) => { b.scripts = (b.scripts ?? []).filter((p) => p !== path); b.scripts.push(path); }); toast(`Copy saved as ${path} — edit it, then attach it instead`);
};

// ================================================================================================================================ layers / level
ed.setLayer = (i, silent = false) => { ed.layer = clamp(i, 0, ed.level.layers.length - 1); if (!silent) { ed.sel.edges.clear(); ed.sel.cells.clear(); } ed.renderTop(); ed.map.draw(); ed.v3.invalidate(); ed.refreshInspector(); if (ed.tab === 'level' || ed.tab === 'objects' && ed.objectsUi?.layer === 'current') ed.renderLeft(); };
ed.addLayer = () => { ed.level.layers.push(newLayer(`Floor ${ed.level.layers.length}`)); ed.commit('layer added'); ed.setLayer(ed.level.layers.length - 1); };
ed.deleteLayer = (i) => { if (ed.level.layers.length < 2) return; ed.level.layers.splice(i, 1); ed.level.entities = ed.level.entities.filter((e) => e.layer !== i); for (const e of ed.level.entities) if (e.layer > i) e.layer--; ed.layer = clamp(ed.layer, 0, ed.level.layers.length - 1); ed.clearSelRaw(); ed.commit('layer deleted'); afterLevelChange(); };
ed.duplicateLayer = (i) => { const l = structuredClone(ed.level.layers[i]); l.name += ' copy'; ed.level.layers.splice(i + 1, 0, l); for (const e of ed.level.entities) if (e.layer > i) e.layer++; for (const e of ed.level.entities.filter((x) => x.layer === i).map((x) => structuredClone(x))) { e.id = uid(); e.layer = i + 1; if (e.name) e.name = ed.uniqueName(e.type); ed.level.entities.push(e); } ed.commit('layer duplicated'); ed.setLayer(i + 1); };
ed.resize = (w, d) => { ed.level.w = clamp(w | 0 || ed.level.w, 4, 256); ed.level.d = clamp(d | 0 || ed.level.d, 4, 256); ed.commit('resized'); ed.map.draw(); ed.renderLeft(); };

// ================================================================================================================================ files
ed.setLevel = (lv, path, fit = true) => { ed.level = normalize(lv); ed.path = path ?? ''; ed.layer = 0; ed.clearSelRaw(); ed.hist = []; ed.hi = -1; pushHistory(); ed.dirty = false; if (fit) { ed.map.fit(ed.level); ed.v3.centerOn(ed.map.cx, ed.map.cz); } afterLevelChange(); };
function starterLevel(name = 'New level') {
  const lv = newLevel({ name, w: 32, d: 32 });
  const room = (x0, z0, x1, z1, floor, ceil, tex) => { for (let x = x0; x <= x1; x++) for (let z = z0; z <= z1; z++) setCell(lv, 0, x, z, { f: floor, c: ceil }); for (let x = x0; x <= x1; x++) { setEdge(lv, 0, x, z0, 'H', { k: 'wall', t: tex }); setEdge(lv, 0, x, z1 + 1, 'H', { k: 'wall', t: tex }); } for (let z = z0; z <= z1; z++) { setEdge(lv, 0, x0, z, 'V', { k: 'wall', t: tex }); setEdge(lv, 0, x1 + 1, z, 'V', { k: 'wall', t: tex }); } };
  room(10, 10, 15, 14, 'floor_concrete', 'ceiling_tiles', 'brick');
  room(16, 10, 19, 14, 'wood_floor', 'ceiling_tiles', 'plaster');
  setEdge(lv, 0, 16, 12, 'V', { k: 'door', t: 'metal_panel', td: 'door_metal' });
  setEdge(lv, 0, 12, 15, 'H', { k: 'window', t: 'brick' });
  // Show both shape tools immediately, while keeping the original doors, window and gameplay.
  for (const [x,z,corner] of [[10,10,'SW'],[15,10,'SE'],[10,14,'NW'],[15,14,'NE']]) setCell(lv,0,x,z,{shape:{kind:'diagonal',corner,t:'brick'}});
  for (const [x,z,corner] of [[16,10,'SW'],[19,10,'SE'],[16,14,'NW'],[19,14,'NE']]) setCell(lv,0,x,z,{shape:{kind:'round',corner,t:'plaster'}});
  const add = (type, x, z, rot = 0, props = {}) => lv.entities.push({ id: uid(), type, x, z, layer: 0, rot, name: '', tag: '', target: '', props, scripts: [], rules: [] });
  add('player_start', 12 * CELL, 12 * CELL, 90); add('light_ceiling', 12.5 * CELL, 12 * CELL); add('light_ceiling', 18 * CELL, 12 * CELL); add('enemy_guard', 17.5 * CELL, 12.5 * CELL, 270); add('health_small', 11 * CELL, 10.8 * CELL); add('level_exit', 19 * CELL - 4, 12.5 * CELL);
  return lv;
}
ed.newLevel = async (kind = 'starter') => { if (ed.dirty && (await modal('Discard changes?', [el('div', {}, 'You have unsaved changes in this level.')], [{ label: 'Cancel' }, { label: 'Discard', danger: true }])) !== 'Discard') return; const lv = kind === 'empty' ? newLevel({ name: 'New level', w: 32, d: 32 }) : starterLevel(); ed.setLevel(lv, ''); toast('New level'); };
ed.saveLevel = async (as = false) => {
  let path = ed.path;
  if (as || !path) { const inp = el('input', { type: 'text', value: path || `levels/${(ed.level.name || 'level').toLowerCase().replace(/[^a-z0-9]+/g, '_')}.fpsl.json`, style: { width: '100%' } }); const r = await modal('Save level as', [el('div', { class: 'muted' }, 'Path inside your project (levels/ folder recommended).'), inp], [{ label: 'Cancel' }, { label: 'Save', primary: true }]); if (r !== 'Save') return; path = inp.value.trim(); if (!/\.fpsl\.json$/.test(path)) path += path.endsWith('.json') ? '' : '.fpsl.json'; if (!/^[\w./-]+$/.test(path) || path.includes('..')) return toast('Invalid path'); }
  ed.level.format = FORMAT; const text = JSON.stringify(ed.level);
  try { const ok = await ed.api.save(path, text); ed.path = path; ed.dirty = false; ed.renderTop(); LS.del('fpsc.recovery'); LS.set('fpsc.last', path); toast(ok ? `Saved ${path}` : `Downloaded ${path.split('/').pop()}`); } catch (e) { log('error', String(e.message ?? e)); }
};
ed.openLevel = async () => {
  const files = await ed.api.ls('levels'), box = el('div');
  if (!files.length) box.append(el('div', { class: 'muted' }, ed.api.available ? 'No levels in levels/ yet — save one first.' : 'No project server connected: use Import (⭱) to load a file.'));
  for (const f of files.filter((f) => f.name.endsWith('.fpsl.json'))) box.append(el('div', { class: 'lv-item', onclick: () => { document.getElementById('modal').classList.add('hidden'); ed.loadPath(`levels/${f.name}`); } }, el('b', { style: { flex: 1 } }, f.name), el('span', { class: 'muted' }, `${(f.size / 1024).toFixed(1)} KB`)));
  await modal('Open level', [box], [{ label: 'Close' }]);
};
ed.loadPath = async (path) => {
  if (ed.dirty && (await modal('Discard changes?', [el('div', {}, 'You have unsaved changes in this level.')], [{ label: 'Cancel' }, { label: 'Discard', danger: true }])) !== 'Discard') return;
  try { const r = await fetch(`/${path}`, { cache: 'no-store' }); if (!r.ok) throw new Error(`HTTP ${r.status}`); ed.setLevel(await r.json(), path); LS.set('fpsc.last', path); toast(`Opened ${path}`); } catch (e) { log('error', `Could not open ${path}: ${e.message}`); }
};

// ================================================================================================================================ play-test
ed.play = (here = false) => {
  validateNow(); const hasStart = ed.level.entities.some((e) => e.type === 'player_start');
  let start = null;
  if (here || !hasStart) { const p = ed.selectedPos(); start = p ? { x: p[0], z: p[1], layer: p[2], rot: 0 } : { x: (ed.cursorCell[0] + 0.5) * CELL, z: (ed.cursorCell[1] + 0.5) * CELL, layer: ed.layer, rot: 0 }; if (!hasStart && !here) toast('No player start — testing from the cursor'); }
  const frame = $('play-frame'), box = $('play'); box.classList.remove('hidden'); ed.playing = true;
  const send = () => frame.contentWindow.postMessage({ type: 'fpsc-level', level: ed.level, playtest: start ? { ...start, autostart: false } : null, shortcuts: ed.shortcuts }, '*');
  ed.onReady = send; frame.src = `/editor/fpsc/play.html?base=/&t=${Date.now()}`;
  log('info', `Play-test started${start ? ' at cursor' : ''}.`);
};
ed.stopPlay = () => { $('play').classList.add('hidden'); $('play-frame').src = 'about:blank'; ed.playing = false; ed.map.cv.focus({ preventScroll: true }); };
window.addEventListener('message', (e) => { const m = e.data; if (!m || typeof m !== 'object') return; if (e.source !== $('play-frame').contentWindow || e.origin !== location.origin) return; if (m.type === 'fpsc-ready') ed.onReady?.(); else if (m.type === 'fpsc-quit') ed.stopPlay(); else if (m.type === 'fpsc-log') log(m.level === 'error' ? 'error' : m.level === 'warn' ? 'warn' : 'info', `[play] ${m.msg}`); });

// ================================================================================================================================ UI render
ed.setTool = (id) => { ed.tool = id; ed.preview = null; for (const b of $('tools').children) b.classList.toggle('on', b.dataset.tool === id); $('tool-hint').textContent = HINTS[id] ?? ''; $('st-tool').textContent = TOOLS.find((t) => t[0] === id)?.[3] ?? ''; ed.map?.draw(); if (ed.tab === 'items' || ed.tab === 'build') ed.renderLeft(); ed.refreshInspector(); };
ed.setTab = (t, focus) => { ed.tab = t; ed.assetFocus = focus; for (const b of $('left-tabs').children) b.classList.toggle('on', b.dataset.tab === t); ed.renderLeft(); };
ed.renderTop = () => { const sel = $('layer-sel'); sel.innerHTML = ''; ed.level.layers.forEach((l, i) => sel.append(el('option', { value: i, selected: i === ed.layer }, `${i}: ${l.name}`))); $('file-name').textContent = `${ed.path || 'unsaved'}${ed.dirty ? ' ●' : ''}  ·  ${ed.level.name}`; document.title = `${ed.dirty ? '● ' : ''}${ed.level.name} — Nord FPS Level Editor`; };
ed.renderLeft = () => { const b = $('left-body'), top = b.scrollTop; b.innerHTML = ''; b.append({ build: buildPanel, items: itemsPanel, scripts: scriptsPanel, level: levelPanel, assets: assetsPanel, objects: objectsPanel }[ed.tab](ed)); b.scrollTop = top; };
ed.refreshInspector = () => { const i = $('inspector'); i.innerHTML = ''; try { i.append(inspector(ed)); } catch (e) { console.error(e); i.append(el('div', { class: 'insp-pad' }, `Inspector error: ${e.message}`)); } };
ed.setView = (v) => { ed.view = v; const vs = $('views'); vs.className = v === '2d' ? 'only2d' : v === '3d' ? 'only3d' : ''; $('view-btn').textContent = v === '2d' ? '2D' : v === '3d' ? '3D' : '2D | 3D'; ed.map.resize(); ed.v3.setVisible(v !== '2d'); if (v !== '3d') ed.map.draw(); LS.set('fpsc.view', v); };

// ================================================================================================================================ tools (mouse)
let drag = null, spaceDown = false;
const rectOf = (a, b) => [Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.max(a[0], b[0]), Math.max(a[1], b[1])];
function worldFromEvent(e) { const r = ed.map.cv.getBoundingClientRect(); return ed.map.toWorld(e.clientX - r.left, e.clientY - r.top); }
function node(wx, wz) { return [Math.round(wx / CELL), Math.round(wz / CELL)]; }
function edgePiece() {
  const b = ed.brush, def = ed.bank.piece(b.piece) ?? ed.bank.piece('wall'), p = { k: def.id, t: b.wallTex };
  if (b.backTex && b.backTex !== b.wallTex) p.tb = b.backTex; if (def.parts.some((q) => q.mat === 'door')) p.td = b.doorTex; if (def.parts.some((q) => q.mat === 'trim') && b.trimTex !== 'metal_panel') p.tt = b.trimTex;
  return p;
}
function lineEdges(a, b) { const out = []; const dx = b[0] - a[0], dz = b[1] - a[1]; if (Math.abs(dx) >= Math.abs(dz)) { for (let x = Math.min(a[0], b[0] + (dx === 0 ? 0 : 0)); x < Math.max(a[0], b[0]); x++) out.push([x, a[1], 'H']); } else for (let z = Math.min(a[1], b[1]); z < Math.max(a[1], b[1]); z++) out.push([a[0], z, 'V']); return out.filter(([x, z, o]) => x >= 0 && z >= 0 && x <= ed.level.w && z <= ed.level.d && (o === 'H' ? x < ed.level.w : z < ed.level.d)); }
function cellsInRect(r) { const out = []; for (let x = r[0]; x <= r[2]; x++) for (let z = r[1]; z <= r[3]; z++) out.push([x, z]); return out; }
const inLevel = (x, z) => x >= 0 && z >= 0 && x < ed.level.w && z < ed.level.d;
function entSnap(wx, wz, e) { if (e.ctrlKey) return [(Math.floor(wx / CELL) + 0.5) * CELL, (Math.floor(wz / CELL) + 0.5) * CELL]; if (e.altKey || !ed.snap) return [wx, wz]; return [snap(wx), snap(wz)]; }
function floodFill(cx, cz, tex) {
  const ly = layerData(), start = getCell(ed.level, ed.layer, cx, cz), target = start?.f ?? null, q = [[cx, cz]], seen = new Set([key(cx, cz)]); let n = 0;
  const blocked = (x, z, o) => !!ly.edges[ekey(x, z, o)];
  while (q.length && n < 4000) { const [x, z] = q.shift(); const c = getCell(ed.level, ed.layer, x, z); if ((c?.f ?? null) !== target && !(c === null && target === null)) continue; setCell(ed.level, ed.layer, x, z, { f: tex }); n++;
    for (const [dx, dz, bx, bz, o] of [[1, 0, x + 1, z, 'V'], [-1, 0, x, z, 'V'], [0, 1, x, z + 1, 'H'], [0, -1, x, z, 'H']]) { const nx = x + dx, nz = z + dz; if (!inLevel(nx, nz) || seen.has(key(nx, nz)) || blocked(bx, bz, o)) continue; seen.add(key(nx, nz)); q.push([nx, nz]); } }
  return n;
}

function onDown(e) {
  ed.map.cv.focus({ preventScroll: true });
  const [wx, wz] = worldFromEvent(e), m = ed.map;
  if (e.button === 1 || e.button === 2 || spaceDown) { drag = { type: 'pan', x: e.clientX, y: e.clientY }; m.cv.style.cursor = 'grabbing'; e.preventDefault(); return; }
  if (e.button !== 0) return;
  const tool = e.altKey ? 'eyedrop' : ed.tool, [cx, cz] = cellOf(wx, wz);
  if (tool === 'select' || (tool === 'entity' && m.pickEntity(wx, wz, ed.layer))) {
    const ent = m.pickEntity(wx, wz, ed.layer);
    if (ent) { if (!ed.sel.ents.has(ent.id)) { if (!e.shiftKey) ed.clearSelRaw(); ed.sel.ents.add(ent.id); } else if (e.shiftKey) { ed.sel.ents.delete(ent.id); } ed.renderSel(); ed.refreshInspector(); ed.v3.selectionChanged(); drag = { type: 'move', start: [wx, wz], orig: ed.selEntities().map((q) => [q, q.x, q.z, q.path?.map((p) => [...p])]), moved: false }; m.draw(); return; }
    drag = { type: 'box', start: [wx, wz], shift: e.shiftKey }; return;
  }
  if (tool === 'wall') { const nd = node(wx, wz); drag = { type: 'wall', node: nd, edge: m.pickEdge(wx, wz, 0.4), erase: e.shiftKey, wasLine: false }; updateWallPreview(wx, wz); return; }
  if (tool === 'room') { drag = { type: 'room', a: [cx, cz], erase: e.shiftKey }; ed.preview = { rect: [cx, cz, cx, cz], erase: e.shiftKey }; m.draw(); return; }
  if (tool === 'floor' || tool === 'ceiling') { drag = { type: 'paint', tool, set: new Map([[key(cx, cz), [cx, cz]]]), a: [cx, cz], rect: e.ctrlKey, erase: e.shiftKey }; paintPreview(); return; }
  if (tool === 'fill') { if (!inLevel(cx, cz)) return; const n = floodFill(cx, cz, ed.brush.floorTex); ed.commit(`filled ${n} cells`); return; }
  if (tool === 'cell') { drag = { type: 'cell', a: [cx, cz], cur: [wx, wz], erase: e.shiftKey, painted: new Set() }; if (ed.brush.cellMode === 'height') applyCellTool(drag, cx, cz); updateCellPreview(); return; }
  if (tool === 'entity') { const [x, z] = entSnap(wx, wz, e); ed.addEntity(ed.brush.entity, x, z); return; }
  if (tool === 'path') { const ent = ed.selectedEntity(); if (!ent) return toast('Select an enemy first, then draw its path'); const [x, z] = entSnap(wx, wz, e); ent.path ??= []; if (e.shiftKey) { let bi = -1, bd = 1.5; ent.path.forEach((p, i) => { const d = Math.hypot(p[0] - wx, p[1] - wz); if (d < bd) { bd = d; bi = i; } }); if (bi >= 0) ent.path.splice(bi, 1); } else ent.path.push([x, z]); ed.commit('path'); return; }
  if (tool === 'erase') { drag = { type: 'erase', a: [wx, wz], shift: e.shiftKey }; return; }
  if (tool === 'eyedrop') { eyedrop(wx, wz); return; }
}
function updateWallPreview(wx, wz) {
  const d = drag, b = ed.brush, m = ed.map; let keys = [];
  if (!d) { const ed1 = m.pickEdge(wx, wz, 0.4); keys = ed1 ? [ed1.key] : []; ed.preview = { edges: keys, piece: edgePiece() }; m.draw(); return; }
  const nd = node(wx, wz); d.wasLine = d.wasLine || nd[0] !== d.node[0] || nd[1] !== d.node[1];
  if (d.wasLine) keys = lineEdges(d.node, nd).map(([x, z, o]) => ekey(x, z, o)); else if (d.edge) keys = [d.edge.key];
  d.keys = keys; ed.preview = { edges: keys, piece: edgePiece(), erase: d.erase }; m.draw(); void b;
}
function paintPreview() { const d = drag; let cells = [...d.set.values()]; if (d.rect) cells = cellsInRect(rectOf(d.a, d.cur ?? d.a)); d.cells = cells; ed.preview = { cells, erase: d.erase }; ed.map.draw(); }
function updateCellPreview() { const d = drag; ed.preview = { cells: [d.a], erase: d.erase }; ed.map.draw(); }
function applyCellTool(d, cx, cz) {
  if (!inLevel(cx, cz)) return; const b = ed.brush, cell = getCell(ed.level, ed.layer, cx, cz) ?? null;
  if (b.cellMode === 'corner') {
    if (cell?.s || cell?.p) { toast('Remove stairs/pillars before shaping this cell.'); return; }
    if (!cell && !d.erase) setCell(ed.level,ed.layer,cx,cz,{f:b.floorTex,c:b.ceilTex});
    setCell(ed.level,ed.layer,cx,cz,{shape:d.erase?null:{kind:b.cornerKind||'diagonal',corner:b.corner||'NE',t:b.wallTex,tb:b.backTex||undefined}});
    return;
  }
  if (cell?.shape && b.cellMode !== 'height' && !d.erase) { toast('Restore Square before adding stairs/pillars.'); return; }
  if (b.cellMode === 'height') { if (!cell) setCell(ed.level, ed.layer, cx, cz, { f: b.floorTex, c: b.ceilTex }); setCell(ed.level, ed.layer, cx, cz, { h: d.erase ? 0 : b.height }); }
  else if (b.cellMode === 'pillar') { if (!cell) setCell(ed.level, ed.layer, cx, cz, { f: b.floorTex }); setCell(ed.level, ed.layer, cx, cz, d.erase ? { p: null, pt: null } : { p: b.pillar, pt: b.wallTex }); }
  else { if (d.erase) setCell(ed.level, ed.layer, cx, cz, { s: null }); else { if (!cell?.f) setCell(ed.level, ed.layer, cx, cz, { f: b.floorTex }); setCell(ed.level, ed.layer, cx, cz, { s: { id: b.stair, d: d.dir ?? b.stairDir } }); } }
}
function eyedrop(wx, wz) {
  const b = ed.brush, m = ed.map, ent = m.pickEntity(wx, wz, ed.layer);
  if (ent) { b.entity = ent.type; ed.setTool('entity'); ed.setTab('items'); toast(`Picked ${ed.bank.entity(ent.type)?.label}`); return; }
  const edge = m.pickEdge(wx, wz, 0.4), ly = layerData();
  if (edge && ly.edges[edge.key]) { const p = ly.edges[edge.key]; b.piece = p.k; b.wallTex = p.t; b.backTex = p.tb ?? ''; if (p.td) b.doorTex = p.td; if (p.tt) b.trimTex = p.tt; ed.setTool('wall'); ed.setTab('build'); toast(`Picked ${ed.bank.piece(p.k)?.label}`); return; }
  const [cx, cz] = cellOf(wx, wz), c = getCell(ed.level, ed.layer, cx, cz); if (c) { if (c.f) b.floorTex = c.f; if (c.c) b.ceilTex = c.c; ed.setTab('build'); ed.setTool('floor'); toast('Picked floor/ceiling texture'); }
}

function onMove(e) {
  const [wx, wz] = worldFromEvent(e), m = ed.map; ed.cursor = [wx, wz]; ed.cursorCell = cellOf(wx, wz);
  $('st-cursor').textContent = `x ${wx.toFixed(1)}  z ${wz.toFixed(1)}  ·  cell ${ed.cursorCell[0]},${ed.cursorCell[1]}  ·  layer ${ed.layer}`;
  if (!drag) { hoverPreview(e, wx, wz); return; }
  const d = drag;
  if (d.type === 'pan') { m.pan(e.clientX - d.x, e.clientY - d.y); d.x = e.clientX; d.y = e.clientY; m.draw(); return; }
  if (d.type === 'move') { const [sx, sz] = d.start; let dx = wx - sx, dz = wz - sz; if (e.ctrlKey) { dx = Math.round(dx / CELL) * CELL; dz = Math.round(dz / CELL) * CELL; } else if (ed.snap && !e.altKey) { dx = snap(dx); dz = snap(dz); } if (!d.moved && Math.hypot(dx, dz) < 0.01) return; d.moved = true; for (const [q, ox, oz, op] of d.orig) { q.x = ox + dx; q.z = oz + dz; if (op) q.path = op.map((p) => [p[0] + dx, p[1] + dz, ...p.slice(2)]); } m.draw(); return; }
  if (d.type === 'box') { ed.preview = { box: [d.start[0], d.start[1], wx, wz] }; m.draw(); return; }
  if (d.type === 'wall') { updateWallPreview(wx, wz); return; }
  if (d.type === 'room') { const c = cellOf(wx, wz); ed.preview = { rect: rectOf(d.a, c), erase: d.erase }; m.draw(); return; }
  if (d.type === 'paint') { const c = cellOf(wx, wz); d.cur = c; if (!d.rect) d.set.set(key(c[0], c[1]), c); paintPreview(); return; }
  if (d.type === 'cell') { d.cur = [wx, wz]; const c = cellOf(wx, wz), [ax, az] = d.a; if (ed.brush.cellMode === 'height') { if (!inLevel(c[0], c[1])) return; applyCellTool(d, c[0], c[1]); m.draw(); return; } const dx = wx - (ax + 0.5) * CELL, dz = wz - (az + 0.5) * CELL; if (ed.brush.cellMode === 'stairs' && Math.hypot(dx, dz) > CELL * 0.45) d.dir = Math.abs(dx) > Math.abs(dz) ? (dx > 0 ? 'E' : 'W') : (dz > 0 ? 'N' : 'S'); updateCellPreview(); return; }
  if (d.type === 'erase') { ed.preview = { box: [d.a[0], d.a[1], wx, wz] }; m.draw(); }
}
function hoverPreview(e, wx, wz) {
  const m = ed.map, t = e.altKey ? 'eyedrop' : ed.tool;
  if (t === 'wall') updateWallPreview(wx, wz);
  else if (t === 'entity') { const [x, z] = entSnap(wx, wz, e); ed.preview = { ent: { type: ed.brush.entity, x, z } }; m.draw(); }
  else if (t === 'floor' || t === 'ceiling' || t === 'fill' || t === 'cell' || t === 'room') { const c = cellOf(wx, wz); ed.preview = t === 'room' ? { rect: [c[0], c[1], c[0], c[1]] } : { cells: [c] }; m.draw(); }
  else if (ed.preview) { ed.preview = null; m.draw(); }
}
function onUp(e) {
  if (!drag) return; const d = drag; drag = null; const m = ed.map; m.cv.style.cursor = ''; const [wx, wz] = worldFromEvent(e);
  if (d.type === 'pan') return;
  if (d.type === 'move') { if (d.moved) { for (const [q] of d.orig) { if (ed.snap && !e.altKey) { q.x = snap(q.x); q.z = snap(q.z); } } ed.commit('moved'); } else ed.refreshInspector(); return; }
  if (d.type === 'box') {
    ed.preview = null; const r = [Math.min(d.start[0], wx), Math.min(d.start[1], wz), Math.max(d.start[0], wx), Math.max(d.start[1], wz)];
    if (Math.hypot(wx - d.start[0], wz - d.start[1]) < 0.3) { clickSelect(d.start[0], d.start[1], d.shift); return; }
    if (!d.shift) ed.clearSelRaw(); const ly = layerData();
    for (const en of ed.level.entities) if (en.layer === ed.layer && en.x >= r[0] && en.x <= r[2] && en.z >= r[1] && en.z <= r[3]) ed.sel.ents.add(en.id);
    for (const k of Object.keys(ly.edges)) { const [x, z, o] = unkey(k), mx = o === 'H' ? (x + 0.5) * CELL : x * CELL, mz = o === 'H' ? z * CELL : (z + 0.5) * CELL; if (mx >= r[0] && mx <= r[2] && mz >= r[1] && mz <= r[3]) ed.sel.edges.add(k); }
    for (const k of Object.keys(ly.cells)) { const [x, z] = unkey(k), mx = (x + 0.5) * CELL, mz = (z + 0.5) * CELL; if (mx >= r[0] && mx <= r[2] && mz >= r[1] && mz <= r[3]) ed.sel.cells.add(k); }
    ed.renderSel(); ed.refreshInspector(); m.draw(); ed.v3.selectionChanged(); return;
  }
  ed.preview = null;
  if (d.type === 'wall') {
    const keys = d.keys ?? (d.edge ? [d.edge.key] : []); if (!keys.length) { m.draw(); return; }
    const ly = layerData(), piece = edgePiece();
    if (!d.wasLine && !d.erase && keys.length === 1 && ly.edges[keys[0]] && ly.edges[keys[0]].k === piece.k && ly.edges[keys[0]].t === piece.t) { delete ly.edges[keys[0]]; ed.commit('removed piece'); return; }
    for (const k of keys) { if (d.erase) delete ly.edges[k]; else ly.edges[k] = { ...piece }; }
    ed.commit(d.erase ? 'erased walls' : `${ed.bank.piece(piece.k)?.label} ×${keys.length}`); return;
  }
  if (d.type === 'room') {
    const c = cellOf(wx, wz), r = rectOf(d.a, c), b = ed.brush, ly = layerData(), piece = edgePiece();
    if (d.erase) { for (const [x, z] of cellsInRect(r)) delete ly.cells[key(x, z)]; for (const k of Object.keys(ly.edges)) { const [x, z, o] = unkey(k); if (x >= r[0] && x <= r[2] + (o === 'V' ? 1 : 0) && z >= r[1] && z <= r[3] + (o === 'H' ? 1 : 0)) delete ly.edges[k]; } ed.commit('erased room'); return; }
    for (const [x, z] of cellsInRect(r)) { if (b.room.floor) setCell(ed.level, ed.layer, x, z, { f: b.floorTex }); if (b.room.ceiling) setCell(ed.level, ed.layer, x, z, { c: b.ceilTex }); }
    if (b.room.walls) { for (let x = r[0]; x <= r[2]; x++) { setEdge(ed.level, ed.layer, x, r[1], 'H', { ...piece }); setEdge(ed.level, ed.layer, x, r[3] + 1, 'H', { ...piece }); } for (let z = r[1]; z <= r[3]; z++) { setEdge(ed.level, ed.layer, r[0], z, 'V', { ...piece }); setEdge(ed.level, ed.layer, r[2] + 1, z, 'V', { ...piece }); } }
    ed.commit(`room ${r[2] - r[0] + 1}×${r[3] - r[1] + 1}`); return;
  }
  if (d.type === 'paint') {
    const cells = d.rect ? cellsInRect(rectOf(d.a, d.cur ?? d.a)) : [...d.set.values()], b = ed.brush;
    for (const [x, z] of cells) { if (!inLevel(x, z)) continue; if (d.tool === 'floor') { if (d.erase) setCell(ed.level, ed.layer, x, z, { f: null }); else setCell(ed.level, ed.layer, x, z, { f: b.floorTex }); } else { if (d.erase) setCell(ed.level, ed.layer, x, z, { c: null }); else setCell(ed.level, ed.layer, x, z, { c: b.ceilTex }); } }
    ed.commit(`${d.tool} ×${cells.length}`); return;
  }
  if (d.type === 'cell') { if (ed.brush.cellMode !== 'height') applyCellTool(d, d.a[0], d.a[1]); ed.commit(ed.brush.cellMode); return; }
  if (d.type === 'erase') {
    const r = [Math.min(d.a[0], wx), Math.min(d.a[1], wz), Math.max(d.a[0], wx), Math.max(d.a[1], wz)], small = Math.hypot(wx - d.a[0], wz - d.a[1]) < 0.4, ly = layerData(); let n = 0;
    if (small) { const en = m.pickEntity(wx, wz, ed.layer), edge = m.pickEdge(wx, wz, 0.4); if (en && !d.shift) { ed.level.entities = ed.level.entities.filter((q) => q !== en); ed.sel.ents.delete(en.id); n = 1; } else if (edge && ly.edges[edge.key]) { delete ly.edges[edge.key]; n = 1; } else if (!d.shift) { const [cx, cz] = cellOf(wx, wz); if (ly.cells[key(cx, cz)]) { delete ly.cells[key(cx, cz)]; n = 1; } } }
    else {
      if (!d.shift) { const before = ed.level.entities.length; ed.level.entities = ed.level.entities.filter((q) => !(q.layer === ed.layer && q.x >= r[0] && q.x <= r[2] && q.z >= r[1] && q.z <= r[3])); n += before - ed.level.entities.length; for (const k of Object.keys(ly.cells)) { const [x, z] = unkey(k), mx = (x + 0.5) * CELL, mz = (z + 0.5) * CELL; if (mx >= r[0] && mx <= r[2] && mz >= r[1] && mz <= r[3]) { delete ly.cells[k]; n++; } } }
      for (const k of Object.keys(ly.edges)) { const [x, z, o] = unkey(k), mx = o === 'H' ? (x + 0.5) * CELL : x * CELL, mz = o === 'H' ? z * CELL : (z + 0.5) * CELL; if (mx >= r[0] - 1 && mx <= r[2] + 1 && mz >= r[1] - 1 && mz <= r[3] + 1) { delete ly.edges[k]; n++; } }
    }
    if (n) ed.commit(`erased ${n}`); else m.draw();
  }
}
function clickSelect(wx, wz, additive) {
  const m = ed.map, ly = layerData(), edge = m.pickEdge(wx, wz, 0.22), [cx, cz] = cellOf(wx, wz);
  if (!additive) ed.clearSelRaw();
  if (edge && ly.edges[edge.key] && !hiddenCornerEdge(ly,edge.key)) { if (additive && ed.sel.edges.has(edge.key)) ed.sel.edges.delete(edge.key); else ed.sel.edges.add(edge.key); }
  else if (ly.cells[key(cx, cz)]) { const k = key(cx, cz); if (additive && ed.sel.cells.has(k)) ed.sel.cells.delete(k); else ed.sel.cells.add(k); }
  ed.renderSel(); ed.refreshInspector(); m.draw(); ed.v3.selectionChanged();
}

// ================================================================================================================================ init
async function init() {
  await detectApi();
  ed.map = new Map2D($('c2d'), ed); ed.v3 = new View3D($('c3d'), ed);
  const tb = $('tools'); for (const [id, k, g, tip] of TOOLS) tb.append(el('button', { 'data-tool': id, title: `${tip} (${k})`, onclick: () => ed.setTool(id) }, g));
  await ed.reloadBank();
  const q = new URLSearchParams(location.search); const last = q.get('level') || LS.get('fpsc.last');
  let loaded = false;
  if (last && ed.api.available) { try { const r = await fetch(`/${last}`, { cache: 'no-store' }); if (r.ok) { ed.setLevel(await r.json(), last); loaded = true; } } catch { /* ignore */ } }
  if (!loaded) ed.setLevel(starterLevel(), '');
  try { const rec = JSON.parse(LS.get('fpsc.recovery') || 'null'); if (rec && rec.level && rec.path === ed.path && JSON.stringify(rec.level) !== snapshot() && Date.now() - rec.t < 7 * 864e5) { const r = await modal('Restore unsaved work?', [el('div', {}, `An unsaved copy of "${rec.level.name}" from ${new Date(rec.t).toLocaleString()} was found (browser backup).`)], [{ label: 'Ignore' }, { label: 'Restore', primary: true }]); if (r === 'Restore') { ed.setLevel(rec.level, rec.path, false); ed.dirty = true; ed.renderTop(); } } } catch { /* ignore */ }
  ed.setTool('select'); ed.setTab('build'); ed.setView(LS.get('fpsc.view') || 'split'); ed.renderTop(); ed.refreshInspector();
  ed.map.fit(ed.level); ed.map.draw(); ed.v3.centerOn(ed.map.cx, ed.map.cz); wire(); validateNow();
  window.__fpsc_editor_ready = true;
}

function wire() {
  const c = ed.map.cv;
  c.addEventListener('mousedown', onDown); window.addEventListener('mousemove', (e) => { if (e.target === c || drag) onMove(e); }); window.addEventListener('mouseup', onUp);
  c.addEventListener('wheel', (e) => { e.preventDefault(); const r = c.getBoundingClientRect(); ed.map.zoomAt(e.clientX - r.left, e.clientY - r.top, e.deltaY < 0 ? 1.15 : 0.87); ed.map.draw(); }, { passive: false });
  c.addEventListener('contextmenu', (e) => e.preventDefault()); c.addEventListener('mouseleave', () => { if (!drag) { ed.preview = null; ed.map.draw(); } });
  c.addEventListener('dblclick', (e) => { const [wx, wz] = worldFromEvent(e); const en = ed.map.pickEntity(wx, wz, ed.layer); if (en) { ed.focus3dEntity?.(en); ed.v3.focus(en.x, en.z, en.layer); } });
  c.addEventListener('dragover', (e) => { if ([...e.dataTransfer.types].some((t) => t.startsWith('text/fpsc'))) { e.preventDefault(); c.parentElement.classList.add('dropping'); } });
  c.addEventListener('dragleave', () => c.parentElement.classList.remove('dropping'));
  c.addEventListener('drop', (e) => { e.preventDefault(); c.parentElement.classList.remove('dropping'); const [wx, wz] = worldFromEvent(e); const type = e.dataTransfer.getData('text/fpsc-entity'), script = e.dataTransfer.getData('text/fpsc-script');
    if (type) { const [x, z] = entSnap(wx, wz, e); ed.brush.entity = type; ed.addEntity(type, x, z); } else if (script) { const en = ed.map.pickEntity(wx, wz, ed.layer) ?? ed.selectedEntity(); if (!en) return toast('Drop the script onto an entity'); ed.selectEntity(en.id); ed.attachScript(script, en); } });
  $('layer-sel').addEventListener('change', (e) => ed.setLayer(+e.target.value));
  $('ghost').addEventListener('change', (e) => { ed.ghost = e.target.checked; ed.map.draw(); }); $('showlights').addEventListener('change', (e) => { ed.showLights = e.target.checked; ed.map.draw(); }); $('snap').addEventListener('change', (e) => { ed.snap = e.target.checked; }); $('snap-step').addEventListener('change', (e) => { ed.snapStep = +e.target.value; });
  $('left-tabs').addEventListener('click', (e) => { const t = e.target.dataset?.tab; if (t) ed.setTab(t); });
  $('play-close').addEventListener('click', () => ed.stopPlay());
  $('file-in').addEventListener('change', async (e) => { const f = e.target.files[0]; e.target.value = ''; if (!f) return; try { const lv = JSON.parse(await f.text()); ed.setLevel(lv, ''); ed.dirty = true; ed.renderTop(); toast(`Imported ${f.name}`); } catch (err) { log('error', `Import failed: ${err.message}`); } });
  const acts = { new: () => ed.newLevel(), open: () => ed.openLevel(), save: () => ed.saveLevel(), saveas: () => ed.saveLevel(true), download: () => download(`${(ed.level.name || 'level').toLowerCase().replace(/[^a-z0-9]+/g, '_')}.fpsl.json`, JSON.stringify(ed.level, null, 1)), import: () => $('file-in').click(), undo: () => ed.undo(), redo: () => ed.redo(), 'layer-up': () => ed.setLayer(ed.layer + 1), 'layer-down': () => ed.setLayer(ed.layer - 1), 'layer-add': () => ed.addLayer(), view: () => ed.setView({ split: '2d', '2d': '3d', '3d': 'split' }[ed.view]), play: () => ed.play(false), playhere: () => ed.play(true), validate: () => ed.showProblems(), help: () => showHelp(), 'console-clear': () => { $('con-body').innerHTML = ''; }, 'console-close': () => $('console').classList.add('hidden') };
  document.body.addEventListener('click', (e) => { const a = e.target.closest?.('[data-act]')?.dataset.act; if (a && acts[a]) acts[a](); });
  window.addEventListener('keydown', (e) => keydown(e, acts)); window.addEventListener('keyup', (e) => { if (e.code === 'Space') spaceDown = false; });
  window.addEventListener('beforeunload', (e) => { if (ed.dirty) { e.preventDefault(); e.returnValue = ''; } });
  document.getElementById('modal').addEventListener('mousedown', (e) => { if (e.target.id === 'modal') e.currentTarget.classList.add('hidden'); });
}

async function showHelp() { await modal('FPS Level Editor — help & rules', [el('div', { html: HELP })], [{ label: 'Close', primary: true }]); }

function keydown(e, acts) {
  const t = e.target, typing = t.matches?.('input,textarea,select') && !(t.type === 'checkbox'); const ctrl = e.ctrlKey || e.metaKey;
  if (ed.playing && matchesShortcut(e, ed.shortcuts.stop)) { e.preventDefault(); return ed.stopPlay(); }
  if (!ed.playing && $('modal').classList.contains('hidden') && !typing) {
    if (matchesShortcut(e, ed.shortcuts.test_here)) { e.preventDefault(); return ed.play(true); }
    if (matchesShortcut(e, ed.shortcuts.test)) { e.preventDefault(); return ed.play(false); }
  }
  if (e.code === 'Escape') { if (ed.playing) return; if (!$('modal').classList.contains('hidden')) return $('modal').classList.add('hidden'); if (ed.tool === 'path') return ed.setTool('select'); if (drag) { drag = null; ed.preview = null; ed.map.draw(); return; } ed.clearSel(); return; }
  if (ed.playing || !$('modal').classList.contains('hidden')) return;
  if (t.id === 'c3d' && !ctrl && !['F5', 'F1', 'Tab'].includes(e.code)) return; // WASD/QE/F fly the 3D camera — they must not switch tools
  if (ctrl) { const k = e.key.toLowerCase(); if (k === 's') { e.preventDefault(); return ed.saveLevel(e.shiftKey); } if (typing) return; if (k === 'z') { e.preventDefault(); return e.shiftKey ? ed.redo() : ed.undo(); } if (k === 'y') { e.preventDefault(); return ed.redo(); } if (k === 'c') { e.preventDefault(); return ed.copySel(); } if (k === 'x') { e.preventDefault(); ed.copySel(); return ed.deleteSelection(); } if (k === 'v') { e.preventDefault(); return ed.paste(); } if (k === 'd') { e.preventDefault(); return ed.duplicateSel(); } if (k === 'a') { e.preventDefault(); const ly = layerData(); ed.clearSelRaw(); for (const en of ed.level.entities) if (en.layer === ed.layer) ed.sel.ents.add(en.id); for (const kk of Object.keys(ly.edges)) ed.sel.edges.add(kk); for (const kk of Object.keys(ly.cells)) ed.sel.cells.add(kk); ed.renderSel(); ed.refreshInspector(); ed.map.draw(); return; } if (k === 'n') { e.preventDefault(); return ed.newLevel(); } if (k === 'o') { e.preventDefault(); return ed.openLevel(); } return; }
  if (e.code === 'F1') { e.preventDefault(); return showHelp(); }
  if (typing) return;
  if (e.code === 'Space') { spaceDown = true; e.preventDefault(); return; }
  if (e.code === 'Tab') { e.preventDefault(); return acts.view(); }
  if (e.code === 'PageUp') return ed.setLayer(ed.layer + 1); if (e.code === 'PageDown') return ed.setLayer(ed.layer - 1);
  if (e.code === 'Delete' || e.code === 'Backspace') { e.preventDefault(); return ed.deleteSelection(); }
  if (e.code === 'Home') { ed.map.fit(ed.level); ed.map.draw(); return; }
  if (e.code === 'KeyQ' || e.code === 'KeyE') { const d = e.code === 'KeyE' ? 45 : -45; if (ed.tool === 'select' && ed.sel.ents.size) return ed.rotateSel(d); ed.entRot = (ed.entRot + d + 360) % 360; toast(`Placement rotation ${ed.entRot}°`); return; }
  if (e.code.startsWith('Arrow') && ed.sel.ents.size) { e.preventDefault(); const s = e.shiftKey ? CELL : 0.5, dx = e.code === 'ArrowRight' ? s : e.code === 'ArrowLeft' ? -s : 0, dz = e.code === 'ArrowUp' ? s : e.code === 'ArrowDown' ? -s : 0; for (const en of ed.selEntities()) { en.x += dx; en.z += dz; } return ed.commit('nudged'); }
  const map = { KeyV: 'select', KeyW: 'wall', KeyR: 'room', KeyF: 'floor', KeyC: 'ceiling', KeyG: 'fill', KeyS: 'cell', KeyA: 'entity', KeyP: 'path', KeyX: 'erase', KeyI: 'eyedrop' };
  if (map[e.code]) { ed.setTool(map[e.code]); if (map[e.code] === 'entity') ed.setTab('items'); }
}

init().catch((e) => { console.error(e); document.body.prepend(el('div', { style: { background: '#600', padding: '8px', position: 'fixed', zIndex: 999, top: 0, left: 0, right: 0 } }, `Editor failed to start: ${e.message}`)); });
