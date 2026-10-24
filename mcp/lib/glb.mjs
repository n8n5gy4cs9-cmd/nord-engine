// GLB/glTF reader (meshes -> one merged nord mesh) and writer (nord mesh -> GLB) for the headless Modeler tools.
import fs from 'node:fs';
import path from 'node:path';

const COMP = { 5120: Int8Array, 5121: Uint8Array, 5122: Int16Array, 5123: Uint16Array, 5125: Uint32Array, 5126: Float32Array };
const NUM = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT4: 16 };
const mul = (a, b) => { const o = new Array(16).fill(0); for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) for (let k = 0; k < 4; k++) o[c * 4 + r] += a[k * 4 + r] * b[c * 4 + k]; return o; };
function trs(t = [0, 0, 0], q = [0, 0, 0, 1], s = [1, 1, 1]) {
  const [x, y, z, w] = q;
  return [(1 - 2 * (y * y + z * z)) * s[0], 2 * (x * y + z * w) * s[0], 2 * (x * z - y * w) * s[0], 0,
    2 * (x * y - z * w) * s[1], (1 - 2 * (x * x + z * z)) * s[1], 2 * (y * z + x * w) * s[1], 0,
    2 * (x * z + y * w) * s[2], 2 * (y * z - x * w) * s[2], (1 - 2 * (x * x + y * y)) * s[2], 0, t[0], t[1], t[2], 1];
}
const apply = (m, p) => [m[0] * p[0] + m[4] * p[1] + m[8] * p[2] + m[12], m[1] * p[0] + m[5] * p[1] + m[9] * p[2] + m[13], m[2] * p[0] + m[6] * p[1] + m[10] * p[2] + m[14]];

export function splitGlb(buf) {
  if (buf.readUInt32LE(0) !== 0x46546c67) throw new Error('Not a GLB file');
  let p = 12, json = null, bin = null;
  while (p + 8 <= buf.length) { const len = buf.readUInt32LE(p), type = buf.readUInt32LE(p + 4), d = buf.subarray(p + 8, p + 8 + len); if (type === 0x4e4f534a) json = JSON.parse(d.toString('utf8')); else if (type === 0x004e4942 && !bin) bin = d; p += 8 + len; }
  return { json, bin };
}

/** Read a .glb/.gltf into {mesh, notes}. Node transforms are baked, duplicate points welded, first texture kept, plain material colours become vertex colours. */
export function readModel(file) {
  const raw = fs.readFileSync(file), dir = path.dirname(file);
  let json, bin;
  if (raw.readUInt32LE(0) === 0x46546c67) ({ json, bin } = splitGlb(raw)); else json = JSON.parse(raw.toString('utf8'));
  const buffers = (json.buffers || []).map((b, i) => (b.uri ? (b.uri.startsWith('data:') ? Buffer.from(b.uri.split(',')[1], 'base64') : fs.readFileSync(path.join(dir, decodeURIComponent(b.uri)))) : i === 0 ? bin : null));
  const view = (i) => { const v = json.bufferViews[i]; return { buf: buffers[v.buffer], off: v.byteOffset || 0, len: v.byteLength, stride: v.byteStride }; };
  const read = (ai) => {
    const a = json.accessors[ai], n = NUM[a.type], T = COMP[a.componentType], out = new Float64Array(a.count * n);
    if (a.bufferView == null) return out;
    const v = view(a.bufferView), es = T.BYTES_PER_ELEMENT, stride = v.stride || es * n, dv = new DataView(v.buf.buffer, v.buf.byteOffset + v.off + (a.byteOffset || 0));
    const get = { 5120: 'getInt8', 5121: 'getUint8', 5122: 'getInt16', 5123: 'getUint16', 5125: 'getUint32', 5126: 'getFloat32' }[a.componentType];
    const norm = a.normalized ? { 5120: 127, 5121: 255, 5122: 32767, 5123: 65535 }[a.componentType] : 1;
    for (let i = 0; i < a.count; i++) for (let k = 0; k < n; k++) out[i * n + k] = dv[get](i * stride + k * es, true) / norm;
    return out;
  };
  const mesh = { format: 'nord-mesh-1', vertices: [], faces: [], colors: [], seams: [], color: '#ffffff', texture: null };
  const notes = []; const maps = new Set(); let skinned = false, tex = null;
  const imageData = (ti) => {
    const im = json.images?.[json.textures?.[ti]?.source]; if (!im) return null;
    let b, mime = im.mimeType || 'image/png';
    if (im.bufferView != null) { const v = view(im.bufferView); b = v.buf.subarray(v.off, v.off + v.len); }
    else if (im.uri?.startsWith('data:')) b = Buffer.from(im.uri.split(',')[1], 'base64');
    else if (im.uri) { b = fs.readFileSync(path.join(dir, decodeURIComponent(im.uri))); mime = /\.jpe?g$/i.test(im.uri) ? 'image/jpeg' : 'image/png'; }
    return b ? `data:${mime};base64,${b.toString('base64')}` : null;
  };
  const walk = (ni, parent) => {
    const n = json.nodes[ni], m = mul(parent, n.matrix || trs(n.translation, n.rotation, n.scale));
    if (n.skin != null) skinned = true;
    if (n.mesh != null) for (const prim of json.meshes[n.mesh].primitives) {
      if ((prim.mode ?? 4) !== 4 || prim.attributes.POSITION == null) continue;
      const pos = read(prim.attributes.POSITION), uv = prim.attributes.TEXCOORD_0 != null ? read(prim.attributes.TEXCOORD_0) : null, col = prim.attributes.COLOR_0 != null ? read(prim.attributes.COLOR_0) : null;
      const cn = col ? NUM[json.accessors[prim.attributes.COLOR_0].type] : 0;
      const mat = json.materials?.[prim.material ?? -1]?.pbrMetallicRoughness, ti = mat?.baseColorTexture?.index, f = mat?.baseColorFactor || [1, 1, 1, 1];
      if (ti != null) { maps.add(ti); if (!tex) tex = imageData(ti); }
      const tint = ti == null ? f : [1, 1, 1, 1], base = mesh.vertices.length, count = pos.length / 3;
      for (let i = 0; i < count; i++) { mesh.vertices.push(apply(m, [pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2]])); mesh.colors.push(col ? [col[i * cn] * tint[0], col[i * cn + 1] * tint[1], col[i * cn + 2] * tint[2]] : [tint[0], tint[1], tint[2]]); }
      const idx = prim.indices != null ? read(prim.indices) : Float64Array.from({ length: count }, (_, i) => i);
      for (let t = 0; t + 2 < idx.length; t += 3) {
        const ids = [idx[t], idx[t + 1], idx[t + 2]]; if (new Set(ids).size < 3) continue;
        mesh.faces.push({ v: ids.map((i) => base + i), uv: ids.map((i) => (uv ? [uv[i * 2], 1 - uv[i * 2 + 1]] : [0, 0])) });
      }
    }
    for (const c of n.children || []) walk(c, m);
  };
  const ident = trs();
  for (const r of json.scenes?.[json.scene ?? 0]?.nodes || []) walk(r, ident);
  if (!mesh.faces.length) throw new Error('No triangle meshes in ' + file);
  weldExact(mesh);
  mesh.texture = tex;
  if (maps.size > 1) notes.push(`${maps.size} textures: only the first is kept; plain material colours became vertex colours`);
  if (json.animations?.length || skinned) notes.push('animations / skeleton are not kept when saved');
  return { mesh, notes };
}

export function weldExact(m) {
  const key = (p) => p.map((v) => Math.round(v * 1e6)).join(','), seen = new Map(), map = [], vs = [], cs = [];
  m.vertices.forEach((p, i) => { const k = key(p); if (!seen.has(k)) { seen.set(k, vs.length); vs.push(p); cs.push(m.colors[i] || [1, 1, 1]); } map[i] = seen.get(k); });
  m.faces = m.faces.map((f) => { const v = [], uv = []; f.v.forEach((id, i) => { const n = map[id]; if (!v.includes(n)) { v.push(n); uv.push(f.uv[i]); } }); return { v, uv }; }).filter((f) => f.v.length >= 3);
  m.vertices = vs; m.colors = cs; m.seams = [];
}

const faceNormal = (vs, f) => { const a = vs[f.v[0]], n = [0, 0, 0]; for (let i = 0; i < f.v.length; i++) { const p = vs[f.v[i]], q = vs[f.v[(i + 1) % f.v.length]]; n[0] += (p[1] - q[1]) * (p[2] + q[2]); n[1] += (p[2] - q[2]) * (p[0] + q[0]); n[2] += (p[0] - q[0]) * (p[1] + q[1]); } const l = Math.hypot(...n) || 1; return n.map((x) => x / l); };
export { faceNormal };

/** nord mesh (+ optional PNG buffer) -> GLB Buffer. Flat shaded, fan-triangulated faces, vertex colours, embedded texture. */
export function writeGlb(mesh, png) {
  const P = [], N = [], U = [], C = [];
  for (const f of mesh.faces) {
    const n = faceNormal(mesh.vertices, f);
    for (let i = 1; i < f.v.length - 1; i++) for (const k of [0, i, i + 1]) {
      P.push(...mesh.vertices[f.v[k]]); N.push(...n); U.push(f.uv[k][0], 1 - f.uv[k][1]);
      const c = mesh.colors[f.v[k]] || [1, 1, 1]; C.push(c[0], c[1], c[2]);
    }
  }
  const pad4 = (b) => Buffer.concat([b, Buffer.alloc((4 - (b.length % 4)) % 4)]);
  const parts = [], views = [], accessors = [];
  const add = (arr, type, count, target, min, max) => {
    const b = pad4(Buffer.from(new Float32Array(arr).buffer)), off = parts.reduce((s, x) => s + x.length, 0);
    parts.push(b); views.push({ buffer: 0, byteOffset: off, byteLength: arr.length * 4, target });
    accessors.push({ bufferView: views.length - 1, componentType: 5126, count, type, ...(min ? { min, max } : {}) });
    return accessors.length - 1;
  };
  const cnt = P.length / 3, min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < cnt; i++) for (let k = 0; k < 3; k++) { min[k] = Math.min(min[k], P[i * 3 + k]); max[k] = Math.max(max[k], P[i * 3 + k]); }
  const attributes = { POSITION: add(P, 'VEC3', cnt, 34962, min, max), NORMAL: add(N, 'VEC3', cnt, 34962), TEXCOORD_0: add(U, 'VEC2', cnt, 34962), COLOR_0: add(C, 'VEC3', cnt, 34962) };
  const json = { asset: { version: '2.0', generator: 'Nord Modeler MCP' }, scene: 0, scenes: [{ nodes: [0] }], nodes: [{ mesh: 0, name: 'mesh' }], meshes: [{ primitives: [{ attributes, material: 0 }] }], materials: [{ doubleSided: true, pbrMetallicRoughness: { baseColorFactor: [...hexRgb(mesh.color), 1], metallicFactor: 0, roughnessFactor: 1 } }], accessors, bufferViews: views, buffers: [{ byteLength: 0 }] };
  if (png) {
    const off = parts.reduce((s, x) => s + x.length, 0); parts.push(pad4(png));
    views.push({ buffer: 0, byteOffset: off, byteLength: png.length });
    json.images = [{ bufferView: views.length - 1, mimeType: 'image/png' }]; json.textures = [{ source: 0, sampler: 0 }]; json.samplers = [{ magFilter: 9728, minFilter: 9728, wrapS: 10497, wrapT: 10497 }];
    json.materials[0].pbrMetallicRoughness.baseColorTexture = { index: 0 };
  }
  const binary = Buffer.concat(parts); json.buffers[0].byteLength = binary.length;
  let jt = JSON.stringify(json); while (Buffer.byteLength(jt) % 4) jt += ' ';
  const js = Buffer.from(jt, 'utf8'), total = 12 + 8 + js.length + 8 + binary.length;
  const head = Buffer.alloc(12); head.writeUInt32LE(0x46546c67, 0); head.writeUInt32LE(2, 4); head.writeUInt32LE(total, 8);
  const h1 = Buffer.alloc(8); h1.writeUInt32LE(js.length, 0); h1.writeUInt32LE(0x4e4f534a, 4);
  const h2 = Buffer.alloc(8); h2.writeUInt32LE(binary.length, 0); h2.writeUInt32LE(0x004e4942, 4);
  return Buffer.concat([head, h1, js, h2, binary]);
}
export const hexRgb = (h) => [1, 3, 5].map((i) => parseInt((h || '#ffffff').slice(i, i + 2), 16) / 255);
