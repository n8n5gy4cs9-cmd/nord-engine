// Tiny low-poly modelling kit: build flat-shaded meshes from boxes / lofts / cylinders and write a binary glTF (.glb).
// Used by tools/gen_harrison_models.mjs. Meshes are grouped by material name so a game can swap a material's texture by name.
import fs from 'node:fs';

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const norm = (a) => { const l = Math.hypot(...a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };

export class Mesh {
  constructor(material, uvScale = 4) { this.material = material; this.uvScale = uvScale; this.p = []; this.n = []; this.uv = []; this.c = []; this.i = []; this.hasColor = false; }
  /** Add a triangle. `inside` (optional) is a point inside the solid: the winding is flipped so the face looks outward. */
  tri(a, b, c, inside, color) {
    let n = cross(sub(b, a), sub(c, a)); if (Math.hypot(...n) < 1e-9) return;
    if (inside) { const mid = [(a[0] + b[0] + c[0]) / 3, (a[1] + b[1] + c[1]) / 3, (a[2] + b[2] + c[2]) / 3]; if (dot(n, sub(mid, inside)) < 0) { [b, c] = [c, b]; n = cross(sub(b, a), sub(c, a)); } }
    n = norm(n); const ax = n.map(Math.abs), s = this.uvScale, base = this.p.length;
    for (const v of [a, b, c]) {
      this.p.push(v); this.n.push(n);
      this.uv.push(ax[1] >= ax[0] && ax[1] >= ax[2] ? [v[0] / s, v[2] / s] : ax[0] >= ax[2] ? [v[2] / s, -v[1] / s] : [v[0] / s, -v[1] / s]);
      this.c.push(color ?? [1, 1, 1, 1]); if (color) this.hasColor = true;
    }
    this.i.push(base, base + 1, base + 2);
  }
  quad(a, b, c, d, inside, color) { this.tri(a, b, c, inside, color); this.tri(a, c, d, inside, color); }
  /** Axis-aligned box centred at (cx,cy,cz), rotated by `yaw` radians around Y (about its own centre). */
  box(cx, cy, cz, sx, sy, sz, yaw = 0) {
    const hx = sx / 2, hy = sy / 2, hz = sz / 2, cs = Math.cos(yaw), sn = Math.sin(yaw);
    const P = (x, y, z) => [cx + x * cs + z * sn, cy + y, cz - x * sn + z * cs], mid = [cx, cy, cz];
    const v = [P(-hx, -hy, -hz), P(hx, -hy, -hz), P(hx, hy, -hz), P(-hx, hy, -hz), P(-hx, -hy, hz), P(hx, -hy, hz), P(hx, hy, hz), P(-hx, hy, hz)];
    for (const f of [[0, 1, 2, 3], [5, 4, 7, 6], [4, 0, 3, 7], [1, 5, 6, 2], [3, 2, 6, 7], [4, 5, 1, 0]]) this.quad(v[f[0]], v[f[1]], v[f[2]], v[f[3]], mid);
    return this;
  }
  /** Vertical n-gon prism / frustum from y0 (radius r0) to y1 (radius r1), centred on (cx,cz). */
  cyl(cx, y0, y1, cz, r0, r1 = r0, n = 8, rotX = 0) {
    const ring = (y, r) => Array.from({ length: n }, (_, k) => [cx + Math.cos((k / n) * Math.PI * 2) * r, y, cz + Math.sin((k / n) * Math.PI * 2) * r]);
    const a = ring(y0, r0), b = ring(y1, r1), mid = [cx, (y0 + y1) / 2, cz];
    for (let k = 0; k < n; k++) { const j = (k + 1) % n; this.quad(a[k], a[j], b[j], b[k], mid); }
    for (let k = 1; k < n - 1; k++) { this.tri(a[0], a[k], a[k + 1], mid); if (r1 > 0) this.tri(b[0], b[k], b[k + 1], mid); }
  }
  /** Cylinder lying along Z (a gun barrel / pipe): from z0 to z1, radius r, centred at (cx,cy). */
  pipe(cx, cy, z0, z1, r, n = 6) {
    const ring = (z) => Array.from({ length: n }, (_, k) => [cx + Math.cos((k / n) * Math.PI * 2) * r, cy + Math.sin((k / n) * Math.PI * 2) * r, z]);
    const a = ring(z0), b = ring(z1), mid = [cx, cy, (z0 + z1) / 2];
    for (let k = 0; k < n; k++) { const j = (k + 1) % n; this.quad(a[k], a[j], b[j], b[k], mid); }
    for (let k = 1; k < n - 1; k++) { this.tri(a[0], a[k], a[k + 1], mid); this.tri(b[0], b[k], b[k + 1], mid); }
  }
  get empty() { return this.i.length === 0; }
}

/**
 * Write a .glb. `materials`: { name: { color:[r,g,b,a], emissive?:[r,g,b], rough?, metal? } }.
 * `nodes`: [{ name, meshes?: Mesh[], t?:[x,y,z], children?: node[] }] — meshes with different materials become one primitive each.
 */
export function writeGlb(file, materials, nodes) {
  const matNames = Object.keys(materials), json = { asset: { version: '2.0', generator: 'nord tools/gen/glb.mjs' }, scene: 0, scenes: [{ nodes: [] }], nodes: [], meshes: [], materials: [], accessors: [], bufferViews: [], buffers: [] };
  for (const m of matNames) { const d = materials[m]; json.materials.push({ name: m, pbrMetallicRoughness: { baseColorFactor: d.color, metallicFactor: d.metal ?? 0, roughnessFactor: d.rough ?? 0.85 }, ...(d.emissive ? { emissiveFactor: d.emissive } : {}), ...(d.color[3] < 1 ? { alphaMode: 'BLEND' } : {}), doubleSided: !!d.double }); }
  const chunks = []; let off = 0;
  const view = (typed, target) => { const buf = Buffer.from(typed.buffer, typed.byteOffset, typed.byteLength); const pad = (4 - (buf.length % 4)) % 4; chunks.push(buf, Buffer.alloc(pad)); json.bufferViews.push({ buffer: 0, byteOffset: off, byteLength: buf.length, ...(target ? { target } : {}) }); off += buf.length + pad; return json.bufferViews.length - 1; };
  const acc = (bv, count, type, ct, minmax) => { json.accessors.push({ bufferView: bv, componentType: ct, count, type, ...(minmax ?? {}) }); return json.accessors.length - 1; };
  const addNode = (n) => {
    const idx = json.nodes.length, node = { name: n.name }; json.nodes.push(node); if (n.t) node.translation = n.t;
    const prims = [];
    for (const m of n.meshes ?? []) {
      if (m.empty) continue; const mi = matNames.indexOf(m.material); if (mi < 0) throw new Error(`unknown material ${m.material}`);
      const pos = new Float32Array(m.p.flat()), nor = new Float32Array(m.n.flat()), uv = new Float32Array(m.uv.flat()), ind = new Uint32Array(m.i);
      const mn = [Infinity, Infinity, Infinity], mx = [-Infinity, -Infinity, -Infinity]; for (const p of m.p) for (let k = 0; k < 3; k++) { mn[k] = Math.min(mn[k], p[k]); mx[k] = Math.max(mx[k], p[k]); }
      const attrs = { POSITION: acc(view(pos, 34962), m.p.length, 'VEC3', 5126, { min: mn, max: mx }), NORMAL: acc(view(nor, 34962), m.n.length, 'VEC3', 5126), TEXCOORD_0: acc(view(uv, 34962), m.uv.length, 'VEC2', 5126) };
      if (m.hasColor) attrs.COLOR_0 = acc(view(new Float32Array(m.c.flat()), 34962), m.c.length, 'VEC4', 5126);
      prims.push({ attributes: attrs, indices: acc(view(ind, 34963), ind.length, 'SCALAR', 5125), material: mi });
    }
    if (prims.length) { json.meshes.push({ name: n.name, primitives: prims }); node.mesh = json.meshes.length - 1; }
    if (n.children?.length) node.children = n.children.map(addNode);
    return idx;
  };
  json.scenes[0].nodes = nodes.map(addNode);
  const bin = Buffer.concat(chunks); json.buffers.push({ byteLength: bin.length });
  let js = Buffer.from(JSON.stringify(json)); js = Buffer.concat([js, Buffer.alloc((4 - (js.length % 4)) % 4, 0x20)]);
  const head = Buffer.alloc(12); head.write('glTF', 0, 'ascii'); head.writeUInt32LE(2, 4); head.writeUInt32LE(12 + 8 + js.length + 8 + bin.length, 8);
  const jh = Buffer.alloc(8); jh.writeUInt32LE(js.length, 0); jh.write('JSON', 4, 'ascii'); const bh = Buffer.alloc(8); bh.writeUInt32LE(bin.length, 0); bh.write('BIN\0', 4, 'latin1');
  fs.mkdirSync(file.slice(0, file.lastIndexOf('/')), { recursive: true });
  fs.writeFileSync(file, Buffer.concat([head, jh, js, bh, bin]));
  return { triangles: json.meshes.reduce((a, m) => a + m.primitives.reduce((b, p) => b + json.accessors[p.indices].count / 3, 0), 0), bytes: 12 + 8 + js.length + 8 + bin.length };
}
