// Data / plugin objects for event sheets (M10-26): Array, Dictionary, JSON, AJAX — named instances, like Construct's non-world objects.
// Declare in a sheet:  { "type": "object", "name": "Inventory", "plugin": "Array", "width": 10, "global": true }
// (or in scene.settings.dataObjects: { "Inventory": { "plugin": "Array" } }), then use  Inventory.At(2)  /  Inventory → Push back.
// Addons: registerDataType('Name', { create(opts, game) → inst, conditions:{id:{params,raw,trigger,test(inst,p,r)}}, actions:{id:{params,raw,run(inst,p,r)}}, expressions:{Name:(inst,args,r)} })
// Triggers are fired with  r.fire(`${objectName}.${id}`, data).
export const dataTypes = new Map();
export function registerDataType(name, def) { dataTypes.set(name, def); }

/** Plugin-shaped definition for the instance `name` (so the runner treats it like any plugin). */
export function bindDataType(sheet, name, type, inst) {
  const def = dataTypes.get(type);
  const out = { conditions: {}, actions: {}, expressions: {}, inst, type };
  for (const [id, c] of Object.entries(def.conditions ?? {})) out.conditions[id] = { ...c, test: (r, p, ctx) => c.test(inst, p, r, ctx) };
  for (const [id, a] of Object.entries(def.actions ?? {})) out.actions[id] = { ...a, run: (r, p) => a.run(inst, p, r) };
  for (const [id, f] of Object.entries(def.expressions ?? {})) out.expressions[id] = (r, args) => f(inst, args, r);
  return out;
}

const num = (v) => (typeof v === 'number' ? v : Number(v) || 0);
const cmp = (a, op, b) => {
  switch (op) {
    case '=': case '==': return a == b; // eslint-disable-line eqeqeq
    case '!=': return a != b; // eslint-disable-line eqeqeq
    case '<': return a < b; case '<=': return a <= b; case '>': return a > b; case '>=': return a >= b;
  }
  throw new Error(`unknown comparison '${op}'`);
};
const tryJSON = (s) => { try { return JSON.parse(s); } catch { return undefined; } };

// ---- Array: 1–3 dimensional, like Construct's Array object
registerDataType('Array', {
  create: (o) => ({ w: o.width ?? 0, h: o.height ?? 1, d: o.depth ?? 1, data: [] }),
  conditions: {
    'compare-at-xyz': { params: ['x', 'y', 'z', 'comparison', 'value'], raw: ['comparison'], test: (a, p) => cmp(at(a, p.x, p.y, p.z), p.comparison, p.value) },
    'is-empty': { test: (a) => a.data.every((v) => v === 0 || v === undefined) },
    'contains-value': { params: ['value'], test: (a, p) => a.data.some((v) => v == p.value) }, // eslint-disable-line eqeqeq
  },
  actions: {
    'set-size': { params: ['width', 'height', 'depth'], run: (a, p) => resize(a, p.width, p.height ?? 1, p.depth ?? 1) },
    'set-at-xyz': { params: ['x', 'y', 'z', 'value'], run: (a, p) => { grow(a, p.x, p.y ?? 0, p.z ?? 0); a.data[idx(a, p.x, p.y ?? 0, p.z ?? 0)] = p.value; } },
    'push-back': { params: ['value'], run: (a, p) => { a.data.length = a.w; a.data.push(p.value); a.w++; a.h = 1; a.d = 1; } },
    'push-front': { params: ['value'], run: (a, p) => { a.data.length = a.w; a.data.unshift(p.value); a.w++; a.h = 1; a.d = 1; } },
    'pop-back': { run: (a) => { if (a.w > 0) { a.data.length = a.w; a.last = a.data.pop(); a.w--; } } },
    'pop-front': { run: (a) => { if (a.w > 0) { a.data.length = a.w; a.last = a.data.shift(); a.w--; } } },
    insert: { params: ['value', 'index'], run: (a, p) => { a.data.length = a.w; a.data.splice(Math.floor(p.index), 0, p.value); a.w++; } },
    delete: { params: ['index'], run: (a, p) => { a.data.length = a.w; if (p.index >= 0 && p.index < a.w) { a.data.splice(Math.floor(p.index), 1); a.w--; } } },
    clear: { run: (a) => { a.data.fill(0); } },
    reverse: { run: (a) => { a.data.length = a.w; a.data.reverse(); } },
    sort: { run: (a) => { a.data.length = a.w; a.data.sort((x, y) => (typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y)))); } },
    shuffle: { run: (a, p, r) => { a.data.length = a.w; for (let i = a.w - 1; i > 0; i--) { const j = Math.floor(r.game.rng.next() * (i + 1)); [a.data[i], a.data[j]] = [a.data[j], a.data[i]]; } } },
    'load-json': { params: ['json'], run: (a, p) => { const j = tryJSON(p.json); const v = Array.isArray(j) ? j : j?.data; if (!Array.isArray(v)) throw new Error('Array: JSON must be a list'); a.data = v.flat(2); a.w = j.size?.[0] ?? v.length; a.h = j.size?.[1] ?? 1; a.d = j.size?.[2] ?? 1; } },
  },
  expressions: {
    At: (a, [x, y = 0, z = 0]) => a.data[idx(a, x, y, z)] ?? 0,
    Width: (a) => a.w, Height: (a) => a.h, Depth: (a) => a.d,
    Front: (a) => a.data[0] ?? 0, Back: (a) => a.data[a.w - 1] ?? 0,
    Sum: (a) => a.data.reduce((s, v) => s + num(v), 0),
    IndexOf: (a, [v]) => a.data.findIndex((x) => x == v), // eslint-disable-line eqeqeq
    LastPopped: (a) => a.last ?? 0,
    AsJSON: (a) => JSON.stringify({ size: [a.w, a.h, a.d], data: a.data.slice(0, a.w * a.h * a.d) }),
  },
});
const idx = (a, x, y, z) => Math.floor(x) + Math.floor(y) * a.w + Math.floor(z) * a.w * a.h;
const at = (a, x, y = 0, z = 0) => a.data[idx(a, x, y, z)] ?? 0;
function resize(a, w, h, d) {
  const old = a.data, ow = a.w, oh = a.h, od = a.d; a.w = Math.max(0, w | 0); a.h = Math.max(1, h | 0); a.d = Math.max(1, d | 0);
  a.data = new Array(a.w * a.h * a.d).fill(0);
  for (let z = 0; z < Math.min(d, od); z++) for (let y = 0; y < Math.min(h, oh); y++) for (let x = 0; x < Math.min(w, ow); x++) a.data[idx(a, x, y, z)] = old[x + y * ow + z * ow * oh] ?? 0;
}
function grow(a, x, y, z) { if (x >= a.w || y >= a.h || z >= a.d) resize(a, Math.max(a.w, x + 1), Math.max(a.h, y + 1), Math.max(a.d, z + 1)); }

// ---- Dictionary
registerDataType('Dictionary', {
  create: () => ({ map: new Map() }),
  conditions: {
    'has-key': { params: ['key'], test: (d, p) => d.map.has(String(p.key)) },
    'compare-value': { params: ['key', 'comparison', 'value'], raw: ['comparison'], test: (d, p) => cmp(d.map.get(String(p.key)) ?? 0, p.comparison, p.value) },
    'is-empty': { test: (d) => d.map.size === 0 },
  },
  actions: {
    'set-key': { params: ['key', 'value'], run: (d, p) => { d.map.set(String(p.key), p.value); } },
    'add-to-key': { params: ['key', 'value'], run: (d, p) => { d.map.set(String(p.key), num(d.map.get(String(p.key))) + num(p.value)); } },
    'delete-key': { params: ['key'], run: (d, p) => { d.map.delete(String(p.key)); } },
    clear: { run: (d) => { d.map.clear(); } },
    'load-json': { params: ['json'], run: (d, p) => { const j = tryJSON(p.json); if (!j || typeof j !== 'object') throw new Error('Dictionary: invalid JSON'); d.map = new Map(Object.entries(j.data ?? j)); } },
  },
  expressions: {
    Get: (d, [k]) => d.map.get(String(k)) ?? 0,
    GetDefault: (d, [k, v]) => d.map.get(String(k)) ?? v,
    Count: (d) => d.map.size,
    KeyAt: (d, [i]) => [...d.map.keys()][Math.floor(i)] ?? '',
    ValueAt: (d, [i]) => [...d.map.values()][Math.floor(i)] ?? 0,
    AsJSON: (d) => JSON.stringify(Object.fromEntries(d.map)),
  },
});

// ---- JSON: parse text, then read/write with dotted paths ("player.items.0.name")
const walkPath = (root, path) => String(path).split('.').filter((s) => s !== '').reduce((o, k) => (o == null ? undefined : o[k]), root);
registerDataType('JSON', {
  create: () => ({ root: {}, error: '' }),
  conditions: {
    'has-path': { params: ['path'], test: (j, p) => walkPath(j.root, p.path) !== undefined },
    'compare-value': { params: ['path', 'comparison', 'value'], raw: ['comparison'], test: (j, p) => cmp(walkPath(j.root, p.path) ?? 0, p.comparison, p.value) },
  },
  actions: {
    parse: { params: ['text'], run: (j, p) => { const v = tryJSON(p.text); j.error = v === undefined ? 'invalid JSON' : ''; if (v !== undefined) j.root = v; } },
    'set-path': { params: ['path', 'value'], run: (j, p) => {
      const keys = String(p.path).split('.').filter(Boolean); if (!keys.length) { j.root = p.value; return; }
      let o = j.root; if (typeof o !== 'object' || o === null) o = j.root = {};
      for (const k of keys.slice(0, -1)) { if (typeof o[k] !== 'object' || o[k] === null) o[k] = /^\d+$/.test(keys[keys.indexOf(k) + 1] ?? '') ? [] : {}; o = o[k]; }
      o[keys.at(-1)] = p.value;
    } },
    clear: { run: (j) => { j.root = {}; } },
  },
  expressions: {
    Get: (j, [path]) => { const v = walkPath(j.root, path); return v === undefined ? 0 : typeof v === 'object' ? JSON.stringify(v) : v; },
    Count: (j, [path = '']) => { const v = walkPath(j.root, path); return Array.isArray(v) ? v.length : v && typeof v === 'object' ? Object.keys(v).length : 0; },
    KeyAt: (j, [path, i]) => { const v = walkPath(j.root, path); return v && typeof v === 'object' ? Object.keys(v)[Math.floor(i)] ?? '' : ''; },
    AsString: (j) => JSON.stringify(j.root),
    Error: (j) => j.error,
  },
});

// ---- AJAX: fetch with tags;  triggers "On completed (tag)" / "On error (tag)"
registerDataType('AJAX', {
  create: () => ({ last: '', error: '', status: 0, busy: 0 }),
  conditions: {
    'on-completed': { params: ['tag'], trigger: true, test: (a, p, r) => r.firing.data.tag === p.tag },
    'on-any-completed': { trigger: true, test: () => true },
    'on-error': { params: ['tag'], trigger: true, test: (a, p, r) => r.firing.data.tag === p.tag },
    'is-loading': { test: (a) => a.busy > 0 },
  },
  actions: {
    request: { params: ['tag', 'url'], run: (a, p, r) => request(a, r, p.tag, p.url, {}) },
    'post-data': { params: ['tag', 'url', 'data'], run: (a, p, r) => request(a, r, p.tag, p.url, { method: 'POST', body: String(p.data), headers: { 'Content-Type': 'application/json' } }) },
  },
  expressions: { LastData: (a) => a.last, LastError: (a) => a.error, StatusCode: (a) => a.status, Busy: (a) => a.busy },
});
function request(a, r, tag, url, init) {
  const name = a.name;
  a.busy++;
  const done = (ok, text, status) => {
    a.busy--; a.status = status; a.error = ok ? '' : text; if (ok) a.last = text;
    r.fire(`${name}.${ok ? 'on-completed' : 'on-error'}`, { tag });
    if (ok) r.fire(`${name}.on-any-completed`, { tag });
  };
  // the sheet keeps going: results arrive as triggers on a later tick
  (r.game.fetch ?? globalThis.fetch)(url, init)
    .then(async (res) => { const t = await res.text(); done(res.ok, res.ok ? t : `HTTP ${res.status}`, res.status); })
    .catch((e) => done(false, String(e?.message ?? e), 0));
}
