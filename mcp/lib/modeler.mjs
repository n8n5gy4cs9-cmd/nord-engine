// Headless 3D Modeler tools: the same nord-mesh-1 files as editor/modeler (models/<name>.mesh.json + .glb), editable by an AI without a window.
// A software renderer (modeler_preview) lets the AI *look* at the result. Keep docs/MCP.md in sync (node mcp/nord-mcp.mjs --docs).
import fs from 'node:fs';
import path from 'node:path';
import { encodePng, decodePng } from './png.mjs';
import { readModel, writeGlb, weldExact, faceNormal, hexRgb } from './glb.mjs';

const sessions = new Map(); // name -> {mesh, tex:{w,h,data}|null, file}
const cur = (name) => { const s = sessions.get(name); if (!s) throw new Error(`No open model "${name}". Use modeler_new or modeler_open first (open: ${[...sessions.keys()].join(', ') || 'none'}).`); return s; };
const safeName = (n) => String(n || 'model').replace(/\.(mesh\.json|glb|gltf)$/i, '').replace(/[^\w-]+/g, '_') || 'model';
const hex2 = (c) => (/^#[\da-f]{6}$/i.test(c) ? c : (() => { throw new Error('Colours are "#rrggbb" hex strings, got ' + c); })());
const rgb255 = (c) => hexRgb(hex2(c)).map((v) => Math.round(v * 255));
const sub = (a, b) => a.map((v, i) => v - b[i]);
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const norm = (a) => { const l = Math.hypot(...a) || 1; return a.map((v) => v / l); };

function rotMat([rx, ry, rz]) { // degrees, applied X then Y then Z
  const [a, b, c] = [rx, ry, rz].map((d) => (d * Math.PI) / 180), [sa, ca, sb, cb, sc, cc] = [Math.sin(a), Math.cos(a), Math.sin(b), Math.cos(b), Math.sin(c), Math.cos(c)];
  return (p) => { let [x, y, z] = p; [y, z] = [y * ca - z * sa, y * sa + z * ca]; [x, z] = [x * cb + z * sb, -x * sb + z * cb]; [x, y] = [x * cc - y * sc, x * sc + y * cc]; return [x, y, z]; };
}
const bbox = (m) => { const mn = [Infinity, Infinity, Infinity], mx = [-Infinity, -Infinity, -Infinity]; for (const v of m.vertices) for (let k = 0; k < 3; k++) { mn[k] = Math.min(mn[k], v[k]); mx[k] = Math.max(mx[k], v[k]); } return m.vertices.length ? { min: mn, max: mx, size: mx.map((v, k) => v - mn[k]) } : null; };
const r3 = (a) => a.map((v) => Math.round(v * 1000) / 1000);

function unwrapFaces(m, ids) { // box projection per face along its dominant axis, then pack all faces into a grid (same idea as the editor)
  for (const i of ids) { const f = m.faces[i], n = faceNormal(m.vertices, f).map(Math.abs), drop = n.indexOf(Math.max(...n)); f.uv = f.v.map((v) => m.vertices[v].filter((_, a) => a !== drop)); }
  pack(m);
}
function pack(m) {
  const count = m.faces.length, cols = Math.ceil(Math.sqrt(count));
  m.faces.forEach((f, i) => {
    const mn = [0, 1].map((a) => Math.min(...f.uv.map((p) => p[a]))), mx = [0, 1].map((a) => Math.max(...f.uv.map((p) => p[a]))), size = Math.max(mx[0] - mn[0], mx[1] - mn[1], 1e-8);
    f.uv = f.uv.map((p) => [(((i % cols) + 0.05) + ((p[0] - mn[0]) / size) * 0.9) / cols, (Math.floor(i / cols) + 0.05 + ((p[1] - mn[1]) / size) * 0.9) / cols]);
  });
}
const PRIMS = {
  cube: { v: [[-1, -1, -1], [1, -1, -1], [1, 1, -1], [-1, 1, -1], [-1, -1, 1], [1, -1, 1], [1, 1, 1], [-1, 1, 1]], f: [[0, 3, 2, 1], [4, 5, 6, 7], [0, 1, 5, 4], [3, 7, 6, 2], [0, 4, 7, 3], [1, 2, 6, 5]] },
  plane: { v: [[-1, 0, -1], [-1, 0, 1], [1, 0, 1], [1, 0, -1]], f: [[0, 1, 2, 3]] },
};
function primitive(kind, seg = 12) {
  if (PRIMS[kind]) return PRIMS[kind];
  const v = [], f = [];
  if (kind === 'cylinder') { for (let y = 0; y < 2; y++) for (let i = 0; i < seg; i++) { const t = (i / seg) * Math.PI * 2; v.push([Math.cos(t), y * 2 - 1, Math.sin(t)]); } f.push(Array.from({ length: seg }, (_, i) => i), Array.from({ length: seg }, (_, i) => 2 * seg - 1 - i)); for (let i = 0; i < seg; i++) { const j = (i + 1) % seg; f.push([i, i + seg, j + seg, j]); } return { v, f }; }
  if (kind === 'sphere') { const rings = Math.max(3, Math.round(seg / 2)); v.push([0, 1, 0]); for (let j = 1; j < rings; j++) for (let i = 0; i < seg; i++) { const p = (j / rings) * Math.PI, t = (i / seg) * Math.PI * 2; v.push([Math.sin(p) * Math.cos(t), Math.cos(p), Math.sin(p) * Math.sin(t)]); } v.push([0, -1, 0]); const last = v.length - 1;
    for (let i = 0; i < seg; i++) { const k = (i + 1) % seg; f.push([0, 1 + k, 1 + i], [last, last - seg + i, last - seg + k]); for (let j = 0; j < rings - 2; j++) { const a = 1 + j * seg + i, b = 1 + j * seg + k; f.push([a, b, b + seg, a + seg]); } } return { v, f }; }
  throw new Error('kind must be cube | plane | cylinder | sphere');
}
function faceIds(m, sel) { // "all" | [indices] | {facing:"+y", ...}
  if (sel == null || sel === 'all') return m.faces.map((_, i) => i);
  if (Array.isArray(sel)) { for (const i of sel) if (!Number.isInteger(i) || i < 0 || i >= m.faces.length) throw new Error(`Face index ${i} out of range 0..${m.faces.length - 1}`); return sel; }
  if (typeof sel === 'string' && /^[+-][xyz]$/.test(sel)) { const a = 'xyz'.indexOf(sel[1]), sg = sel[0] === '+' ? 1 : -1; return m.faces.map((f, i) => [i, faceNormal(m.vertices, f)[a] * sg]).filter(([, d]) => d > 0.7).map(([i]) => i); }
  throw new Error('faces must be "all", an index array, or a direction like "+y" / "-x"');
}
function vertIds(m, sel, faces) {
  if (sel == null || sel === 'all') return m.vertices.map((_, i) => i);
  if (Array.isArray(sel)) return sel;
  return [...new Set(faceIds(m, faces ?? sel).flatMap((i) => m.faces[i].v))];
}
const texOf = (s) => { if (!s.tex) throw new Error('This model has no editable texture. Call modeler_texture_new first.'); return s.tex; };
function dataUrl(s) { return s.tex ? 'data:image/png;base64,' + encodePng(s.tex.w, s.tex.h, s.tex.data).toString('base64') : s.mesh.texture; }
function setTexFromUrl(s) {
  s.tex = null; const u = s.mesh.texture;
  if (u?.startsWith('data:image/png')) s.tex = decodePng(Buffer.from(u.split(',')[1], 'base64'));
}
function paintPx(t, x, y, c, a = 255) { if (x < 0 || y < 0 || x >= t.w || y >= t.h) return; const o = (y * t.w + x) * 4, k = a / 255; for (let i = 0; i < 3; i++) t.data[o + i] = Math.round(c[i] * k + t.data[o + i] * (1 - k)); t.data[o + 3] = 255; }
function paintOp(t, op) {
  const c = rgb255(op.color || '#ffffff'), px = (u) => Math.round(u * t.w), py = (v) => Math.round(v * t.h), a = op.alpha == null ? 255 : Math.round(op.alpha * 255);
  if (op.shape === 'fill') { for (let y = 0; y < t.h; y++) for (let x = 0; x < t.w; x++) paintPx(t, x, y, c, a); }
  else if (op.shape === 'rect') { const [x0, y0, x1, y1] = [px(op.x0), py(op.y0), px(op.x1), py(op.y1)]; for (let y = Math.min(y0, y1); y < Math.max(y0, y1); y++) for (let x = Math.min(x0, x1); x < Math.max(x0, x1); x++) paintPx(t, x, y, c, a); }
  else if (op.shape === 'circle') { const cx = op.x * t.w, cy = op.y * t.h, r = op.radius * t.w; for (let y = Math.floor(cy - r); y <= cy + r; y++) for (let x = Math.floor(cx - r); x <= cx + r; x++) if ((x + 0.5 - cx) ** 2 + (y + 0.5 - cy) ** 2 <= r * r) paintPx(t, x, y, c, a); }
  else if (op.shape === 'line') { const [x0, y0, x1, y1] = [op.x0 * t.w, op.y0 * t.h, op.x1 * t.w, op.y1 * t.h], n = Math.ceil(Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0))) + 1, w = Math.max(1, Math.round((op.width || 1 / t.w) * t.w)); for (let i = 0; i <= n; i++) { const x = Math.round(x0 + ((x1 - x0) * i) / n), y = Math.round(y0 + ((y1 - y0) * i) / n); for (let dy = 0; dy < w; dy++) for (let dx = 0; dx < w; dx++) paintPx(t, x + dx, y + dy, c, a); } }
  else if (op.shape === 'polygon') { const pts = op.points.map(([u, v]) => [u * t.w, v * t.h]); for (let y = 0; y < t.h; y++) for (let x = 0; x < t.w; x++) { let inside = false; for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) { const [xi, yi] = pts[i], [xj, yj] = pts[j]; if (yi > y + 0.5 !== yj > y + 0.5 && x + 0.5 < ((xj - xi) * (y + 0.5 - yi)) / (yj - yi) + xi) inside = !inside; } if (inside) paintPx(t, x, y, c, a); } }
  else if (op.shape === 'noise') { const [x0, y0, x1, y1] = [px(op.x0 ?? 0), py(op.y0 ?? 0), px(op.x1 ?? 1), py(op.y1 ?? 1)]; let seed = op.seed ?? 1; const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296); for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) { const j = 1 - (op.amount ?? 0.2) * rnd(); paintPx(t, x, y, c.map((v) => v * j), a); } }
  else throw new Error('shape must be fill | rect | circle | line | polygon | noise');
}

// ---------- software preview ----------
function render(s, { yaw = 35, pitch = 25, size = 512, zoom = 1 }) {
  const m = s.mesh, bb = bbox(m); if (!bb) throw new Error('The model is empty.');
  const ctr = bb.min.map((v, k) => (v + bb.max[k]) / 2), rad = Math.max(Math.hypot(...bb.size) / 2, 1e-6), W = size, H = size;
  const [ya, pa] = [(yaw * Math.PI) / 180, (pitch * Math.PI) / 180];
  const cam = [ctr[0] + Math.sin(ya) * Math.cos(pa) * rad * 3.2 / zoom, ctr[1] + Math.sin(pa) * rad * 3.2 / zoom, ctr[2] + Math.cos(ya) * Math.cos(pa) * rad * 3.2 / zoom];
  const fwd = norm(sub(ctr, cam)), right = norm(cross(fwd, [0, 1, 0])), up = cross(right, fwd), f = 1 / Math.tan(0.35);
  const proj = (p) => { const d = sub(p, cam), z = dot(d, fwd); return [W / 2 + ((dot(d, right) * f) / z) * (W / 2), H / 2 - ((dot(d, up) * f) / z) * (H / 2), z]; };
  const img = new Uint8Array(W * H * 4), zb = new Float32Array(W * H).fill(Infinity);
  for (let i = 0; i < W * H; i++) { const y = Math.floor(i / W) / H; img.set([28 + 14 * y, 34 + 14 * y, 40 + 14 * y, 255], i * 4); }
  const base = hexRgb(m.color), L = norm([0.4, 0.8, 0.5]), tx = s.tex;
  const line = (a, b, c) => { const n = Math.ceil(Math.max(Math.abs(b[0] - a[0]), Math.abs(b[1] - a[1]))); for (let i = 0; i <= n; i++) { const x = Math.round(a[0] + ((b[0] - a[0]) * i) / (n || 1)), y = Math.round(a[1] + ((b[1] - a[1]) * i) / (n || 1)); if (x >= 0 && y >= 0 && x < W && y < H) img.set(c, (y * W + x) * 4); } };
  m.faces.forEach((face) => {
    const n = faceNormal(m.vertices, face), shade = 0.4 + 0.6 * Math.abs(dot(n, L));
    for (let k = 1; k < face.v.length - 1; k++) {
      const idx = [0, k, k + 1], P = idx.map((j) => proj(m.vertices[face.v[j]])); if (P.some((p) => p[2] <= 0.01)) continue;
      const mnx = Math.max(0, Math.floor(Math.min(...P.map((p) => p[0])))), mxx = Math.min(W - 1, Math.ceil(Math.max(...P.map((p) => p[0])))), mny = Math.max(0, Math.floor(Math.min(...P.map((p) => p[1])))), mxy = Math.min(H - 1, Math.ceil(Math.max(...P.map((p) => p[1]))));
      const den = (P[1][1] - P[2][1]) * (P[0][0] - P[2][0]) + (P[2][0] - P[1][0]) * (P[0][1] - P[2][1]); if (Math.abs(den) < 1e-9) continue;
      for (let y = mny; y <= mxy; y++) for (let x = mnx; x <= mxx; x++) {
        const px = x + 0.5, py = y + 0.5, w0 = ((P[1][1] - P[2][1]) * (px - P[2][0]) + (P[2][0] - P[1][0]) * (py - P[2][1])) / den, w1 = ((P[2][1] - P[0][1]) * (px - P[2][0]) + (P[0][0] - P[2][0]) * (py - P[2][1])) / den, w2 = 1 - w0 - w1;
        if (w0 < -1e-6 || w1 < -1e-6 || w2 < -1e-6) continue;
        const z = w0 * P[0][2] + w1 * P[1][2] + w2 * P[2][2]; if (z >= zb[y * W + x]) continue; zb[y * W + x] = z;
        let col = [1, 1, 1]; const cs = idx.map((j) => m.colors[face.v[j]] || [1, 1, 1]); col = col.map((_, c) => w0 * cs[0][c] + w1 * cs[1][c] + w2 * cs[2][c]);
        if (tx) { const u = w0 * face.uv[0][0] + w1 * face.uv[k][0] + w2 * face.uv[k + 1][0], v = w0 * face.uv[0][1] + w1 * face.uv[k][1] + w2 * face.uv[k + 1][1], tu = Math.min(tx.w - 1, Math.max(0, Math.floor((((u % 1) + 1) % 1) * tx.w))), tv = Math.min(tx.h - 1, Math.max(0, Math.floor((1 - (((v % 1) + 1) % 1)) * tx.h))), o = (tv * tx.w + tu) * 4; col = col.map((c, i) => c * (tx.data[o + i] / 255)); }
        img.set([0, 1, 2].map((c) => Math.min(255, Math.round(col[c] * base[c] * shade * 255))).concat(255), (y * W + x) * 4);
      }
    }
  });
  // axes at the origin: x red, y green, z blue
  const o = proj([0, 0, 0]); for (const [d, c] of [[[1, 0, 0], [230, 70, 70, 255]], [[0, 1, 0], [90, 210, 90, 255]], [[0, 0, 1], [80, 130, 240, 255]]]) { const e = proj(d.map((v) => v * rad * 0.6)); if (o[2] > 0 && e[2] > 0) line(o, e, c); }
  return encodePng(W, H, img);
}
const VIEWS = { iso: [35, 25], front: [0, 0], back: [180, 0], right: [90, 0], left: [-90, 0], top: [0, 89], bottom: [0, -89] };

const obj = (properties = {}, required = []) => ({ type: 'object', properties, required, additionalProperties: false });
const NAME = { type: 'string', description: 'Model session name (file name without extension, e.g. "crate")' };
const VEC3 = { type: 'array', items: { type: 'number' }, minItems: 3, maxItems: 3 };
const FACES = { description: 'Faces to use: "all", an array of face indices, or a direction ("+y" = faces looking up, also -y, ±x, ±z)', oneOf: [{ type: 'string' }, { type: 'array', items: { type: 'integer' } }] };

export function modelerTools(ctx) {
  const modelsDir = () => path.join(ctx.projectRoot(), 'models');
  const resolveFile = (f) => { const root = ctx.projectRoot(), p = path.resolve(root, f); if (!p.startsWith(root + path.sep)) throw new Error('Path leaves the project'); return p; };
  const summary = (name, s) => { const bb = bbox(s.mesh); return `"${name}": ${s.mesh.vertices.length} vertices, ${s.mesh.faces.length} faces, ${s.tex ? `texture ${s.tex.w}x${s.tex.h}` : s.mesh.texture ? 'texture (not editable: not an 8-bit PNG)' : 'no texture'}, colour ${s.mesh.color}${bb ? `, bounds min ${r3(bb.min)} max ${r3(bb.max)} (size ${r3(bb.size)})` : ''}`; };
  const T = [];
  const tool = (name, description, inputSchema, handler) => T.push({ name, description, inputSchema, handler, group: 'modeler' });

  tool('modeler_list', 'List models in the project\'s models/ folder and the open modeler sessions.', obj(), () => {
    const files = fs.existsSync(modelsDir()) ? fs.readdirSync(modelsDir()).filter((f) => /\.(mesh\.json|glb|gltf|obj|png)$/.test(f)) : [];
    return `models/: ${files.join(', ') || '(empty)'}\nOpen sessions: ${[...sessions.entries()].map(([n, s]) => summary(n, s)).join('\n') || 'none'}`;
  });
  tool('modeler_new', 'Start an empty model session. Build it with modeler_primitive / modeler_add_mesh, then modeler_save.', obj({ name: NAME, color: { type: 'string', description: 'Base colour "#rrggbb" (default #ffffff)' } }, ['name']), ({ name, color }) => {
    const n = safeName(name); sessions.set(n, { mesh: { format: 'nord-mesh-1', vertices: [], faces: [], colors: [], seams: [], color: color ? hex2(color) : '#ffffff', texture: null }, tex: null, file: null }); return `Created ${n}. Next: modeler_primitive.`;
  });
  tool('modeler_open', 'Open an existing model for editing: models/x.mesh.json (editable mesh) or any .glb/.gltf of the project (e.g. a model used in a scene). GLB import merges all meshes, bakes node transforms, keeps the first texture; skeleton/animation are dropped.', obj({ file: { type: 'string', description: 'Project-relative path, e.g. "models/crate.mesh.json" or "assets/models/bank.glb"' }, name: { type: 'string', description: 'Session name (default: file name)' } }, ['file']), ({ file, name }) => {
    const p = resolveFile(file), n = safeName(name || path.basename(file)); let mesh, notes = [];
    if (/\.mesh\.json$|\.json$/i.test(p)) { mesh = JSON.parse(fs.readFileSync(p, 'utf8')); if (!['nord-mesh-1', 'blocksmith-mesh-1'].includes(mesh.format)) throw new Error('Not a nord mesh file'); mesh.colors ||= []; mesh.seams ||= []; mesh.texture ??= null; } else ({ mesh, notes } = readModel(p));
    const s = { mesh, tex: null, file }; setTexFromUrl(s); sessions.set(n, s);
    return `Opened ${summary(n, s)}.${notes.length ? ' Note: ' + notes.join('; ') + '.' : ''}`;
  });
  tool('modeler_describe', 'Describe a model: counts, bounds, and a face table (index, direction, centre, vertex count) so you can address faces by index or direction. limit caps the face list.', obj({ name: NAME, limit: { type: 'integer', description: 'Max faces listed (default 60)' } }, ['name']), ({ name, limit = 60 }) => {
    const s = cur(name), m = s.mesh, dir = (n) => { const a = n.map(Math.abs), k = a.indexOf(Math.max(...a)); return (n[k] >= 0 ? '+' : '-') + 'xyz'[k] + (Math.max(...a) < 0.95 ? '~' : ''); };
    const rows = m.faces.slice(0, limit).map((f, i) => { const c = f.v.reduce((acc, v) => acc.map((x, k) => x + m.vertices[v][k] / f.v.length), [0, 0, 0]); return `#${i} ${dir(faceNormal(m.vertices, f))} centre ${r3(c)} (${f.v.length} verts)`; });
    return summary(name, s) + `\nFaces:\n${rows.join('\n')}${m.faces.length > limit ? `\n… ${m.faces.length - limit} more` : ''}`;
  });
  tool('modeler_primitive', 'Add a primitive (cube, plane, cylinder, sphere) with UVs. size = full extent per axis (a cube of size [1,1,1] spans -0.5..0.5). Returns the index range of the new faces.', obj({ name: NAME, kind: { type: 'string', enum: ['cube', 'plane', 'cylinder', 'sphere'] }, size: { ...VEC3, description: 'Width, height, depth (default [1,1,1])' }, position: { ...VEC3, description: 'Centre (default [0,0,0])' }, rotation: { ...VEC3, description: 'Degrees around x,y,z (default 0)' }, segments: { type: 'integer', description: 'Sides of cylinder/sphere (default 12)' } }, ['name', 'kind']), ({ name, kind, size = [1, 1, 1], position = [0, 0, 0], rotation = [0, 0, 0], segments = 12 }) => {
    const m = cur(name).mesh, pr = primitive(kind, segments), rot = rotMat(rotation), off = m.vertices.length, start = m.faces.length;
    pr.v.forEach((p) => { const q = rot(p.map((v, k) => (v * size[k]) / 2)); m.vertices.push(q.map((v, k) => v + position[k])); m.colors.push([1, 1, 1]); });
    pr.f.forEach((f) => m.faces.push({ v: f.map((i) => i + off), uv: f.map(() => [0, 0]) }));
    unwrapFaces(m, m.faces.map((_, i) => i)); return `Added ${kind}: faces #${start}..#${m.faces.length - 1}. ${summary(name, cur(name))}`;
  });
  tool('modeler_add_mesh', 'Add raw geometry: vertices [[x,y,z]…] and faces as arrays of vertex indices (3+ per face, counter-clockwise seen from outside, planar). UVs are auto-unwrapped unless given.', obj({ name: NAME, vertices: { type: 'array', items: VEC3 }, faces: { type: 'array', items: { type: 'array', items: { type: 'integer' } } }, uvs: { type: 'array', description: 'Optional: per face an array of [u,v] (0..1, v up)', items: { type: 'array', items: { type: 'array', items: { type: 'number' } } } } }, ['name', 'vertices', 'faces']), ({ name, vertices, faces, uvs }) => {
    const m = cur(name).mesh, off = m.vertices.length, start = m.faces.length;
    for (const f of faces) { if (f.length < 3 || new Set(f).size !== f.length || f.some((i) => !Number.isInteger(i) || i < 0 || i >= vertices.length)) throw new Error('Each face needs 3+ distinct valid vertex indices: ' + JSON.stringify(f)); }
    vertices.forEach((v) => { m.vertices.push(v); m.colors.push([1, 1, 1]); });
    faces.forEach((f, i) => m.faces.push({ v: f.map((x) => x + off), uv: uvs?.[i] || f.map(() => [0, 0]) }));
    const auto = m.faces.map((_, i) => i).filter((i) => i >= start && !uvs?.[i - start]); if (auto.length) unwrapFaces(m, m.faces.map((_, i) => i)); return `Added ${faces.length} faces (#${start}..#${m.faces.length - 1}).`;
  });
  tool('modeler_transform', 'Move / rotate / scale vertices of the selected faces (or all). Rotation/scale pivot is the centre of the selected vertices unless pivot is given.', obj({ name: NAME, op: { type: 'string', enum: ['translate', 'rotate', 'scale'] }, value: { ...VEC3, description: 'translate: offset; rotate: degrees x,y,z; scale: factors x,y,z' }, faces: FACES, vertices: { type: 'array', items: { type: 'integer' }, description: 'Alternative to faces: explicit vertex indices' }, pivot: VEC3 }, ['name', 'op', 'value']), ({ name, op, value, faces, vertices, pivot }) => {
    const m = cur(name).mesh, ids = vertices || vertIds(m, 'faces', faces), c = pivot || ids.reduce((a, i) => a.map((x, k) => x + m.vertices[i][k] / ids.length), [0, 0, 0]), rot = rotMat(value);
    for (const i of ids) { const p = m.vertices[i]; m.vertices[i] = op === 'translate' ? p.map((v, k) => v + value[k]) : op === 'scale' ? p.map((v, k) => c[k] + (v - c[k]) * value[k]) : rot(p.map((v, k) => v - c[k])).map((v, k) => v + c[k]); }
    return `${op} applied to ${ids.length} vertices.`;
  });
  tool('modeler_extrude', 'Extrude faces along their normals by distance (negative = inward), adding side walls. Each face is extruded on its own (use for windows, bumps, legs).', obj({ name: NAME, faces: FACES, distance: { type: 'number' }, inset: { type: 'number', description: 'Optional: shrink the extruded cap towards its centre first (0..1, default 0)' } }, ['name', 'faces', 'distance']), ({ name, faces, distance, inset = 0 }) => {
    const s = cur(name), m = s.mesh, ids = faceIds(m, faces), start = m.faces.length;
    for (const fi of ids) {
      const f = m.faces[fi], n = faceNormal(m.vertices, f), c = f.v.reduce((a, v) => a.map((x, k) => x + m.vertices[v][k] / f.v.length), [0, 0, 0]);
      const nv = f.v.map((v) => { const p = m.vertices[v], q = p.map((x, k) => c[k] + (x - c[k]) * (1 - inset) + n[k] * distance); m.vertices.push(q); m.colors.push(m.colors[v] || [1, 1, 1]); return m.vertices.length - 1; });
      for (let i = 0; i < f.v.length; i++) { const j = (i + 1) % f.v.length; m.faces.push({ v: [f.v[i], f.v[j], nv[j], nv[i]], uv: [[0, 0], [0, 0], [0, 0], [0, 0]] }); }
      f.v = nv;
    }
    unwrapFaces(m, m.faces.map((_, i) => i)); return `Extruded ${ids.length} faces by ${distance}; new side faces #${start}..#${m.faces.length - 1}.`;
  });
  tool('modeler_delete_faces', 'Delete faces (unused vertices are removed). Indices of later faces shift: call modeler_describe again.', obj({ name: NAME, faces: FACES }, ['name', 'faces']), ({ name, faces }) => {
    const m = cur(name).mesh, kill = new Set(faceIds(m, faces)); m.faces = m.faces.filter((_, i) => !kill.has(i));
    const used = [...new Set(m.faces.flatMap((f) => f.v))].sort((a, b) => a - b), map = new Map(used.map((v, i) => [v, i])); m.vertices = used.map((v) => m.vertices[v]); m.colors = used.map((v) => m.colors[v] || [1, 1, 1]); m.faces.forEach((f) => (f.v = f.v.map((v) => map.get(v)))); m.seams = [];
    return `Deleted ${kill.size} faces; ${m.faces.length} left.`;
  });
  tool('modeler_mirror', 'Duplicate the model mirrored across the origin plane (x, y or z) and weld the seam. Move the half away from the plane first or the copy overlaps.', obj({ name: NAME, axis: { type: 'string', enum: ['x', 'y', 'z'] } }, ['name', 'axis']), ({ name, axis }) => {
    const m = cur(name).mesh, a = 'xyz'.indexOf(axis), off = m.vertices.length, n0 = m.faces.length;
    m.vertices.forEach((p, i) => { const q = [...p]; q[a] = -q[a]; m.vertices.push(q); m.colors.push(m.colors[i] || [1, 1, 1]); });
    for (let i = 0; i < n0; i++) { const f = m.faces[i]; m.faces.push({ v: f.v.map((v) => v + off).reverse(), uv: [...f.uv].reverse().map((u) => [...u]) }); }
    weldExact(m); return `Mirrored on ${axis}: ${m.faces.length} faces.`;
  });
  tool('modeler_center_ground', 'Centre the model on x/z and put its lowest point on y = 0.', obj({ name: NAME }, ['name']), ({ name }) => {
    const m = cur(name).mesh, b = bbox(m); if (!b) throw new Error('Empty model'); const d = [-(b.min[0] + b.max[0]) / 2, -b.min[1], -(b.min[2] + b.max[2]) / 2]; m.vertices = m.vertices.map((p) => p.map((v, k) => v + d[k])); return 'Centred on the ground.';
  });
  tool('modeler_unwrap', 'Recompute UVs: every face is projected along its dominant axis and all faces are packed into a grid on the texture. Run after changing geometry, before painting.', obj({ name: NAME }, ['name']), ({ name }) => { const m = cur(name).mesh; unwrapFaces(m, m.faces.map((_, i) => i)); return `Unwrapped ${m.faces.length} faces.`; });
  tool('modeler_set_color', 'Colours: base colour of the whole model, or vertex colours of selected faces (multiplies with base colour and texture).', obj({ name: NAME, color: { type: 'string', description: '"#rrggbb"' }, faces: { ...FACES, description: 'Omit to set the base colour; otherwise paint these faces\' vertices' } }, ['name', 'color']), ({ name, color, faces }) => {
    const m = cur(name).mesh; hex2(color); if (faces == null) { m.color = color; return `Base colour ${color}.`; }
    const c = hexRgb(color); for (const v of vertIds(m, 'faces', faces)) m.colors[v] = c; return 'Vertex colours set.';
  });
  tool('modeler_texture_new', 'Create (or reset) the texture: size×size pixels filled with a colour. Faces show the part of the image given by their UVs (see modeler_texture_uv for where each face is).', obj({ name: NAME, size: { type: 'integer', enum: [16, 32, 64, 128, 256, 512] }, color: { type: 'string' } }, ['name']), ({ name, size = 64, color = '#ffffff' }) => {
    const s = cur(name), c = rgb255(color), data = new Uint8Array(size * size * 4); for (let i = 0; i < size * size; i++) data.set([...c, 255], i * 4); s.tex = { w: size, h: size, data }; return `Texture ${size}x${size} created.`;
  });
  tool('modeler_texture_uv', 'Where faces sit on the texture, in the same normalised coordinates modeler_texture_paint uses (x right, y DOWN, 0..1). Use it to paint a specific face.', obj({ name: NAME, faces: FACES }, ['name']), ({ name, faces }) => {
    const m = cur(name).mesh; return faceIds(m, faces).slice(0, 80).map((i) => { const u = m.faces[i].uv, x = u.map((p) => p[0]), y = u.map((p) => 1 - p[1]); return `#${i}: x ${r3([Math.min(...x), Math.max(...x)])} y ${r3([Math.min(...y), Math.max(...y)])}`; }).join('\n');
  });
  tool('modeler_texture_paint', 'Paint on the texture. ops are applied in order; coordinates are normalised 0..1 with y DOWN (top-left origin). shapes: fill{color} · rect{x0,y0,x1,y1,color} · circle{x,y,radius,color} · line{x0,y0,x1,y1,width,color} · polygon{points,color} · noise{x0,y0,x1,y1,color,amount,seed}. alpha (0..1) blends.', obj({ name: NAME, ops: { type: 'array', items: { type: 'object', properties: { shape: { type: 'string', enum: ['fill', 'rect', 'circle', 'line', 'polygon', 'noise'] }, color: { type: 'string' }, alpha: { type: 'number' } }, required: ['shape', 'color'], additionalProperties: true } } }, ['name', 'ops']), ({ name, ops }) => {
    const s = cur(name), t = texOf(s); for (const op of ops) paintOp(t, op); return `Applied ${ops.length} paint ops to the ${t.w}x${t.h} texture.`;
  });
  tool('modeler_preview', 'Render the model with a built-in software renderer and return PNG image(s). ALWAYS look at the result after modelling or painting. views: iso, front, back, left, right, top, bottom (or give yaw/pitch degrees).', obj({ name: NAME, views: { type: 'array', items: { type: 'string', enum: Object.keys(VIEWS) }, description: 'Default ["iso"]' }, yaw: { type: 'number' }, pitch: { type: 'number' }, size: { type: 'integer', description: 'Pixels per image, 128..768 (default 448)' }, zoom: { type: 'number' } }, ['name']), ({ name, views, yaw, pitch, size = 448, zoom = 1 }) => {
    const s = cur(name), list = yaw != null || pitch != null ? [['custom', [yaw ?? 35, pitch ?? 25]]] : (views?.length ? views : ['iso']).map((v) => [v, VIEWS[v]]);
    return { text: `Preview of ${summary(name, s)}\nViews: ${list.map(([n]) => n).join(', ')} (axes: x red, y green, z blue)`, images: list.map(([, [y, p]]) => render(s, { yaw: y, pitch: p, size: Math.min(768, Math.max(128, size)), zoom }).toString('base64')) };
  });
  tool('modeler_save', 'Write models/<name>.mesh.json (editable) and, by default, models/<name>.glb (use it in a scene: model component path "models/<name>.glb"). Also writes <name>.png when there is an editable texture.', obj({ name: NAME, as: { type: 'string', description: 'File base name if different from the session name' }, glb: { type: 'boolean', description: 'Also write the GLB (default true)' } }, ['name']), ({ name, as, glb = true }) => {
    const s = cur(name), m = s.mesh; if (!m.faces.length) throw new Error('Nothing to save: no faces.'); const base = safeName(as || name); fs.mkdirSync(modelsDir(), { recursive: true });
    m.texture = s.tex ? dataUrl(s) : m.texture; const out = [];
    fs.writeFileSync(path.join(modelsDir(), base + '.mesh.json'), JSON.stringify(m, null, 2) + '\n'); out.push(`models/${base}.mesh.json`);
    if (glb) { const png = s.tex ? encodePng(s.tex.w, s.tex.h, s.tex.data) : null; fs.writeFileSync(path.join(modelsDir(), base + '.glb'), writeGlb(m, png)); out.push(`models/${base}.glb`); }
    if (s.tex) { fs.writeFileSync(path.join(modelsDir(), base + '.png'), encodePng(s.tex.w, s.tex.h, s.tex.data)); out.push(`models/${base}.png`); }
    s.file = `models/${base}.mesh.json`; return `Saved ${out.join(', ')}. In a scene use a model component with path "models/${base}.glb" (scene_add_entity components: [{"type":"model","path":"models/${base}.glb"}]).`;
  });
  return T;
}
export const _test = { render, readModel };
