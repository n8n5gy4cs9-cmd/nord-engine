// FPS Creator level data model — pure functions, no DOM/Babylon, shared by the editor, the runtime and the node tests.
// Spec: docs/FPS_CREATOR.md. A level is plain JSON (`*.fpsl.json`).
export const FORMAT = 'fpsc-level/1';
export const CELL = 4;      // metres per grid cell
export const STORY = 3.2;   // metres per storey (wall height; layer i floors sit at i*STORY)
export const DIRS = ['N', 'E', 'S', 'W'];

export const key = (x, z) => `${x},${z}`;
export const ekey = (x, z, o) => `${x},${z},${o}`;   // o: 'H' (runs along x, at z*CELL) | 'V' (runs along z, at x*CELL)
export const unkey = (k) => k.split(',').map((v, i) => (i < 2 ? Number(v) : v));

/** Edge of cell (x,z) on side d (N=+z, E=+x, S=-z, W=-x) as canonical [x,z,o]. */
export function sideEdge(x, z, d) {
  if (d === 'N') return [x, z + 1, 'H'];
  if (d === 'S') return [x, z, 'H'];
  if (d === 'E') return [x + 1, z, 'V'];
  return [x, z, 'V'];
}
/** The two cells an edge separates: [back, front] (front = +z for H, +x for V). */
export function edgeCells(x, z, o) { return o === 'H' ? [[x, z - 1], [x, z]] : [[x - 1, z], [x, z]]; }
export const dirVec = { N: [0, 1], E: [1, 0], S: [0, -1], W: [-1, 0] };
export const rotOf = { N: 0, E: 90, S: 180, W: 270 };

export function newLayer(name = 'Ground') { return { name, cells: {}, edges: {} }; }

export function newLevel({ name = 'New level', w = 40, d = 40 } = {}) {
  return {
    format: FORMAT, name, author: '', w, d, cell: CELL, story: STORY,
    settings: {
      sky: 'day', skyColor: '#8fb8e8', ground: 'grass', fog: false, fogColor: '#9bb0c8', fogDensity: 0.012,
      ambient: 0.42, ambientColor: '#a6b2c8', music: '', intro: '', objective: '', timeLimit: 0,
    },
    layers: [newLayer('Ground')],
    entities: [],
  };
}

let _n = 0;
export const uid = (p = 'e') => `${p}${Date.now().toString(36).slice(-4)}${(_n++).toString(36)}${Math.random().toString(36).slice(2, 5)}`;

export const getCell = (lv, L, x, z) => lv.layers[L]?.cells[key(x, z)] ?? null;
export function setCell(lv, L, x, z, patch) {
  const ly = lv.layers[L]; if (!ly || x < 0 || z < 0 || x >= lv.w || z >= lv.d) return null;
  if (patch === null) { delete ly.cells[key(x, z)]; return null; }
  const c = ly.cells[key(x, z)] ?? (ly.cells[key(x, z)] = {});
  for (const [k, v] of Object.entries(patch)) { if (v === null || v === undefined || v === false) delete c[k]; else c[k] = v; }
  if (!Object.keys(c).length) delete ly.cells[key(x, z)];
  return c;
}
export const getEdge = (lv, L, x, z, o) => lv.layers[L]?.edges[ekey(x, z, o)] ?? null;
export function setEdge(lv, L, x, z, o, piece) {
  const ly = lv.layers[L]; if (!ly) return;
  if (x < 0 || z < 0 || x > lv.w || z > lv.d) return;
  if (!piece) delete ly.edges[ekey(x, z, o)]; else ly.edges[ekey(x, z, o)] = piece;
}

/** Rectangle room: floor (+ceiling) on every cell and a wall ring on the border. Returns number of edges written. */
export function paintRoom(lv, L, x0, z0, x1, z1, o = {}) {
  const [a, b] = [Math.min(x0, x1), Math.max(x0, x1)], [c, d] = [Math.min(z0, z1), Math.max(z0, z1)];
  const { floor = 'concrete', ceiling = 'concrete', wall = 'wall', tex = 'brick', walls = true } = o;
  for (let x = a; x <= b; x++) for (let z = c; z <= d; z++) setCell(lv, L, x, z, { f: floor || null, c: ceiling || null });
  let n = 0;
  if (walls) {
    for (let x = a; x <= b; x++) { setEdge(lv, L, x, c, 'H', { k: wall, t: tex }); setEdge(lv, L, x, d + 1, 'H', { k: wall, t: tex }); n += 2; }
    for (let z = c; z <= d; z++) { setEdge(lv, L, a, z, 'V', { k: wall, t: tex }); setEdge(lv, L, b + 1, z, 'V', { k: wall, t: tex }); n += 2; }
  }
  return n;
}

/** Bounding box of everything painted/placed on any layer, in cells: [x0,z0,x1,z1] or null. */
export function bounds(lv) {
  let b = null; const add = (x, z) => { b = b ? [Math.min(b[0], x), Math.min(b[1], z), Math.max(b[2], x), Math.max(b[3], z)] : [x, z, x, z]; };
  for (const ly of lv.layers) { for (const k of Object.keys(ly.cells)) { const [x, z] = unkey(k); add(x, z); } for (const k of Object.keys(ly.edges)) { const [x, z] = unkey(k); add(x, z); } }
  for (const e of lv.entities) add(Math.floor(e.x / CELL), Math.floor(e.z / CELL));
  return b;
}

/** Fix up/complete a loaded level object (older/hand-written files). Never throws; returns the same object. */
export function normalize(lv) {
  const base = newLevel();
  lv.format ??= FORMAT; lv.name ??= 'Level'; lv.w = Math.max(1, Math.min(256, lv.w | 0 || 40)); lv.d = Math.max(1, Math.min(256, lv.d | 0 || 40));
  lv.cell = CELL; lv.story = STORY;
  lv.settings = { ...base.settings, ...(lv.settings ?? {}) };
  if (!Array.isArray(lv.layers) || !lv.layers.length) lv.layers = [newLayer()];
  for (const ly of lv.layers) { ly.name ??= 'Layer'; ly.cells ??= {}; ly.edges ??= {}; }
  lv.entities = (lv.entities ?? []).filter((e) => e && typeof e.type === 'string');
  const seen = new Set();
  for (const e of lv.entities) {
    e.id = e.id && !seen.has(e.id) ? e.id : uid(); seen.add(e.id);
    e.x = +e.x || 0; e.z = +e.z || 0; e.layer = e.layer | 0; e.rot = +e.rot || 0; e.props ??= {}; e.name ??= ''; e.tag ??= '';
    e.scripts ??= []; e.rules ??= [];
  }
  return lv;
}

/** Problems a designer should fix: returns [{level:'error'|'warn', msg, id?}]. `bank` = { entity(type) }, optional. */
export function validate(lv, bank = null) {
  const out = []; const err = (msg, id) => out.push({ level: 'error', msg, id }); const warn = (msg, id) => out.push({ level: 'warn', msg, id });
  const starts = lv.entities.filter((e) => e.type === 'player_start');
  if (!starts.length) err('No player start. Place one from Entities ▸ Markers.');
  if (starts.length > 1) warn('More than one player start — the first one is used.');
  if (!lv.entities.some((e) => e.type === 'level_exit') && !lv.entities.some((e) => e.rules?.some((r) => r.do === 'win') || e.scripts?.some((s) => s.id === 'trigger-win'))) warn('No level exit — the level can not be completed (add a Level exit or a rule "Win").');
  const names = new Map();
  for (const e of lv.entities) {
    if (bank && !bank.entity(e.type)) err(`Unknown entity type "${e.type}" (missing from the bank?)`, e.id);
    if (e.name) { if (names.has(e.name)) warn(`Duplicate name "${e.name}" — links by name hit the first one only`, e.id); names.set(e.name, e); }
    if (e.x < 0 || e.z < 0 || e.x > lv.w * CELL || e.z > lv.d * CELL) warn(`${e.type} "${e.name || e.id}" is outside the level area`, e.id);
    if (!lv.layers[e.layer]) err(`${e.type} "${e.name || e.id}" is on missing layer ${e.layer}`, e.id);
  }
  const doorNames = new Set(); for (const ly of lv.layers) for (const pc of Object.values(ly.edges)) if (pc.name) doorNames.add(pc.name);
  const tags = new Set(); for (const e of lv.entities) for (const t of (e.tag || '').split(/[\s,]+/).filter(Boolean)) tags.add(t);
  const known = (t) => !t || t === 'self' || t === 'player' || (t.startsWith('#') ? tags.has(t.slice(1)) : names.has(t) || doorNames.has(t));
  for (const e of lv.entities) {
    if (e.target && !known(e.target)) warn(`"${e.name || e.type}" targets "${e.target}", which does not exist`, e.id);
    for (const r of e.rules ?? []) if (r.target && !known(r.target)) warn(`rule on "${e.name || e.type}" targets "${r.target}", which does not exist`, e.id);
  }
  return out;
}

/** Player-start entity (first), or a sensible fallback at the middle of the painted area. */
export function startOf(lv) {
  const s = lv.entities.find((e) => e.type === 'player_start');
  if (s) return s;
  const b = bounds(lv) ?? [0, 0, 1, 1];
  return { type: 'player_start', x: (b[0] + 0.5) * CELL, z: (b[1] + 0.5) * CELL, layer: 0, rot: 0, props: {} };
}
