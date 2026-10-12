// Noom renderer: builds the level as a few merged Babylon meshes (baked torch light in vertex colours, Doom-style distance fog), Y-billboard sprites
// for monsters/items/projectiles, sliding doors. Reads the Sim every frame; owns no game rules.
import { W, H, MOBS, PICKUPS } from './sim.js';

export const CEIL = 1.5, EYE = 0.6;
const AMBIENT = 0.3;
const wx = (x) => x, wz = (y) => -y;

export class Renderer {
  /** assets: { walls, surfaces, sprites:{skeleton,…,props}, meta:{…} } as loaded image URLs + parsed meta */
  constructor(B, scene, sim, assets) {
    this.B = B; this.scene = scene; this.sim = sim; this.a = assets;
    this.tex = {}; this.mats = {}; this.sprites = new Map(); this.doorMeshes = new Map(); this.fxSprites = []; this.projSprites = new Map();
    scene.clearColor = new B.Color4(0, 0, 0, 1);
    scene.fogMode = B.Scene.FOGMODE_LINEAR; scene.fogColor = new B.Color3(0.02, 0.012, 0.03); scene.fogStart = 3; scene.fogEnd = 15;
    scene.ambientColor = new B.Color3(1, 1, 1);
    this.build();
  }
  texture(url) { return this.tex[url] ??= (() => { const t = new this.B.Texture(url, this.scene, true, false, this.B.Texture.NEAREST_SAMPLINGMODE); t.hasAlpha = true; t.wrapU = t.wrapV = this.B.Texture.CLAMP_ADDRESSMODE; return t; })(); }
  material(url, { alphaTest = false, lit = null } = {}) {
    const B = this.B, m = new B.StandardMaterial(`m:${url}`, this.scene);
    m.diffuseTexture = this.texture(url); m.disableLighting = true; m.emissiveColor = lit ?? new B.Color3(1, 1, 1); m.specularColor = B.Color3.Black(); m.backFaceCulling = false;
    if (alphaTest) { m.useAlphaFromDiffuseTexture = true; m.alphaCutOff = 0.5; m.transparencyMode = B.Material.MATERIAL_ALPHATEST; m.diffuseTexture.hasAlpha = true; }
    else m.diffuseTexture.hasAlpha = false;
    return m;
  }

  // ---- lighting --------------------------------------------------------------------------------------------------------------------------
  light(x, y, occlude = true) {
    let l = AMBIENT;
    for (const [lx, ly] of this.sim.lights) {
      const d2 = (lx - x) ** 2 + (ly - y) ** 2; if (d2 > 36) continue;
      const f = 1 - d2 / 36; if (occlude && !this.sim.los(lx, ly, x, y)) continue;
      l += 0.85 * f * f;
    }
    return Math.min(1, l);
  }

  // ---- static level geometry -------------------------------------------------------------------------------------------------------------
  build() {
    const B = this.B, sim = this.sim, A = this.a;
    const walls = { p: [], uv: [], c: [], i: [] }, surf = { p: [], uv: [], c: [], i: [] };
    const quad = (g, p0, p1, p2, p3, uv, cols) => { // p: [x,y,z]; uv: [u0,v0,u1,v1] (v0 = top); cols: 4 light values
      const n = g.p.length / 3;
      g.p.push(...p0, ...p1, ...p2, ...p3);
      g.uv.push(uv[0], uv[3], uv[2], uv[3], uv[2], uv[1], uv[0], uv[1]);
      for (const c of cols) g.c.push(c, c, c, 1);
      g.i.push(n, n + 1, n + 2, n, n + 2, n + 3);
    };
    const atlasUV = (idx, cols, rows, tile, inset = 0.4) => { const aw = cols * tile, ah = rows * tile, cx = idx % cols, cy = Math.floor(idx / cols); return [(cx * tile + inset) / aw, (cy * tile + inset) / ah, ((cx + 1) * tile - inset) / aw, ((cy + 1) * tile - inset) / ah]; };
    const wallUV = (t) => atlasUV(t, 4, 1, 64), surfUV = (t) => atlasUV(t, 4, 2, 64);
    const solidAt = (x, y) => x < 0 || y < 0 || x >= W || y >= H || sim.solid[y * W + x] === 1 && !sim.doors.has(y * W + x) || (sim.doors.get(y * W + x)?.t === 'X');
    const openAt = (x, y) => !solidAt(x, y);
    const Lw = (x, y, nx, ny) => this.light(x + nx * 0.15, y + ny * 0.15);
    // wall faces: for every solid cell, each side that touches open space. Two quads tall (1 + 0.5 cell) so the 64px texture keeps its scale.
    const face = (cx, cy, side) => {
      const i = cy * W + cx, d = sim.doors.get(i), isExit = d?.t === 'X';
      const t = sim.tex[i];
      let a, b, nx, ny; // endpoints in map coords (a→b left-to-right as seen from the open side)
      if (side === 0) { a = [cx + 1, cy]; b = [cx, cy]; nx = 0; ny = -1; } // north face
      else if (side === 1) { a = [cx + 1, cy + 1]; b = [cx + 1, cy]; nx = 1; ny = 0; } // east
      else if (side === 2) { a = [cx, cy + 1]; b = [cx + 1, cy + 1]; nx = 0; ny = 1; } // south
      else { a = [cx, cy]; b = [cx, cy + 1]; nx = -1; ny = 0; } // west
      const la = Lw(a[0], a[1], nx, ny), lb = Lw(b[0], b[1], nx, ny);
      const P = (p, y) => [wx(p[0]), y, wz(p[1])];
      if (isExit) { quad(surf, P(a, 0), P(b, 0), P(b, CEIL), P(a, CEIL), surfUV(6), [la, lb, lb, la]); return; }
      const uv = wallUV(t), lowEnd = uv[3], mid = (uv[1] + uv[3]) / 2;
      quad(walls, P(a, 0), P(b, 0), P(b, 1), P(a, 1), [uv[0], uv[1], uv[2], uv[3]], [la, lb, lb, la]);
      const ml = (l) => l; quad(walls, P(a, 1), P(b, 1), P(b, CEIL), P(a, CEIL), [uv[0], mid, uv[2], uv[3]], [ml(la), ml(lb), ml(lb), ml(la)]);
      void lowEnd;
    };
    for (let cy = 0; cy < H; cy++) for (let cx = 0; cx < W; cx++) {
      if (!solidAt(cx, cy)) continue;
      if (openAt(cx, cy - 1)) face(cx, cy, 0); if (openAt(cx + 1, cy)) face(cx, cy, 1); if (openAt(cx, cy + 1)) face(cx, cy, 2); if (openAt(cx - 1, cy)) face(cx, cy, 3);
    }
    // floors + ceilings
    for (let cy = 0; cy < H; cy++) for (let cx = 0; cx < W; cx++) {
      if (!openAt(cx, cy)) continue;
      const i = cy * W + cx, fl = surfUV(sim.floor[i]), ce = surfUV(3);
      const corners = [[cx, cy], [cx + 1, cy], [cx + 1, cy + 1], [cx, cy + 1]];
      const lc = corners.map(([x, y]) => this.light(x + (cx + 0.5 - x) * 0.3, y + (cy + 0.5 - y) * 0.3));
      const P = (c, y) => [wx(c[0]), y, wz(c[1])];
      quad(surf, P(corners[0], 0), P(corners[1], 0), P(corners[2], 0), P(corners[3], 0), [fl[0], fl[1], fl[2], fl[3]], lc);
      quad(surf, P(corners[3], CEIL), P(corners[2], CEIL), P(corners[1], CEIL), P(corners[0], CEIL), [ce[0], ce[1], ce[2], ce[3]], lc.map((l) => l * 0.75));
    }
    const mk = (g, name, url) => {
      const m = new B.Mesh(name, this.scene), vd = new B.VertexData();
      vd.positions = g.p; vd.indices = g.i; vd.uvs = g.uv; vd.colors = g.c; vd.applyToMesh(m);
      m.material = this.material(url); m.isPickable = false; m.freezeWorldMatrix(); return m;
    };
    this.wallMesh = mk(walls, 'walls', A.walls); this.surfMesh = mk(surf, 'surfaces', A.surfaces);
    // doors
    for (const d of sim.doors.values()) {
      if (d.t === 'X') continue;
      const horiz = solidAt(d.x - 1, d.y) && solidAt(d.x + 1, d.y); // corridor runs north-south → slab spans x
      const size = d.t === 'S' ? [1, CEIL, 1] : horiz ? [1, CEIL, 0.22] : [0.22, CEIL, 1];
      const url = d.t === 'S' ? A.walls : A.surfaces, uv = d.t === 'S' ? wallUV(1) : surfUV(d.t === 'K' ? 5 : 4), side = surfUV(7);
      const fu = [new B.Vector4(...[uv[0], uv[1], uv[2], uv[3]]), new B.Vector4(...[uv[0], uv[1], uv[2], uv[3]]), new B.Vector4(...side), new B.Vector4(...side), new B.Vector4(...side), new B.Vector4(...side)];
      const m = B.MeshBuilder.CreateBox(`door${d.i}`, { width: size[0], height: size[1], depth: size[2], faceUV: fu, wrap: true }, this.scene);
      m.position.set(wx(d.x + 0.5), CEIL / 2, wz(d.y + 0.5)); m.isPickable = false;
      const l = this.light(d.x + 0.5, d.y + 0.5, false), mat = this.material(url, { lit: new B.Color3(l, l, l) }); m.material = mat; this.doorMeshes.set(d.i, m);
    }
  }

  // ---- sprites -----------------------------------------------------------------------------------------------------------------------------
  /** returns { mesh, set(rect, heightCells), light(l) } for a given sheet url */
  makeSprite(url) {
    const B = this.B, m = new B.Mesh('spr', this.scene), vd = new B.VertexData();
    vd.positions = [-0.5, 0, 0, 0.5, 0, 0, 0.5, 1, 0, -0.5, 1, 0]; vd.indices = [0, 1, 2, 0, 2, 3]; vd.uvs = [0, 1, 1, 1, 1, 0, 0, 0];
    vd.applyToMesh(m, true);
    m.billboardMode = B.Mesh.BILLBOARDMODE_Y; m.isPickable = false; m.alwaysSelectAsActiveMesh = true;
    const mat = this.material(url, { alphaTest: true, lit: new B.Color3(1, 1, 1) }); m.material = mat;
    const tex = mat.diffuseTexture; let sz = null;
    const s = { mesh: m, rect: null, mat, setFrame: (r, h) => {
      sz ??= tex.getSize();
      if (!r) { m.setEnabled(false); return; }
      if (s.rect !== r) { const [x, y, w, hh] = r, e = 0.3; m.updateVerticesData(B.VertexBuffer.UVKind, [(x + e) / sz.width, (y + hh - e) / sz.height, (x + w - e) / sz.width, (y + hh - e) / sz.height, (x + w - e) / sz.width, (y + e) / sz.height, (x + e) / sz.width, (y + e) / sz.height]); s.rect = r; }
      m.scaling.set(h * r[2] / r[3], h, 1);
    } };
    return s;
  }
  rectOf(sheet, frame) { // frame name → [x,y,w,h]
    const meta = this.a.meta[sheet];
    if (meta.rects) return meta.rects[frame];
    const i = meta.frames.indexOf(frame); if (i < 0) return null;
    const fw = meta.frameWidth, fh = meta.frameHeight, cols = Math.floor(this.a.size[sheet][0] / fw);
    return [(i % cols) * fw, Math.floor(i / cols) * fh, fw, fh];
  }
  spriteFor(o) {
    let s = this.sprites.get(o);
    if (s) return s;
    const url = o.kind === 'mob' ? this.a.sprites[o.def.sheet] : this.a.sprites.props;
    s = { ...this.makeSprite(url), o }; this.sprites.set(o, s); return s;
  }

  update(alpha, time) {
    const sim = this.sim, B = this.B;
    const lerp = (a, b) => a + (b - a) * alpha;
    // doors
    for (const [i, m] of this.doorMeshes) { const d = sim.doors.get(i); m.position.y = CEIL / 2 + d.open * (CEIL - 0.05); }
    const live = new Set();
    for (const o of sim.mobjs) {
      live.add(o);
      const s = this.spriteFor(o);
      let rect, h;
      if (o.kind === 'mob') { rect = this.rectOf(o.def.sheet, o.frame); h = o.def.height; }
      else if (o.kind === 'barrel') { const f = o.frame; rect = this.rectOf('props', f); h = f === 'barrel' ? 0.62 : 0.9; }
      else if (o.kind === 'item') { rect = this.rectOf('props', PICKUPS[o.type].sprite); h = PICKUPS[o.type].h; }
      else { rect = this.rectOf('props', o.type === 'torch' ? (Math.floor(time * 8 + o.x * 3) % 2 ? 'torch1' : 'torch2') : 'bones'); h = o.type === 'torch' ? 1.0 : 0.16; }
      s.setFrame(rect, h);
      const x = lerp(o.px, o.x), y = lerp(o.py, o.y), bob = o.kind === 'item' ? 0.03 + Math.sin(time * 3 + o.x) * 0.02 : 0;
      s.mesh.position.set(wx(x), bob, wz(y)); s.mesh.setEnabled(true);
      if (o.kind === 'item') { s.mat.emissiveColor.set(1, 1, 1); } else { const l = this.light(x, y, false); s.mat.emissiveColor.set(l, l, l); }
    }
    for (const [o, s] of this.sprites) if (!live.has(o)) { s.mesh.dispose(); s.mat.dispose(); this.sprites.delete(o); }
    // torches that are only light sources (no mobj): render once as decor
    if (!this.torchSprites) {
      this.torchSprites = sim.lights.map(([x, y]) => { const s = this.makeSprite(this.a.sprites.props); s.mesh.position.set(wx(x), 0, wz(y)); s.x = x; return s; });
    }
    for (const t of this.torchSprites) t.setFrame(this.rectOf('props', Math.floor(time * 8 + t.x * 3) % 2 ? 'torch1' : 'torch2'), 1.0), t.mat.emissiveColor.set(1, 1, 1);
    // projectiles
    const pl = new Set();
    for (const p of sim.projs) {
      pl.add(p);
      let s = this.projSprites.get(p); if (!s) { s = this.makeSprite(this.a.sprites.props); this.projSprites.set(p, s); }
      const name = p.type === 'arrow' ? 'arrow' : p.def.sprite + (Math.floor(time * 12) % 2 ? '2' : '');
      s.setFrame(this.rectOf('props', name), p.type === 'arrow' ? 0.18 : p.type === 'baronball' ? 0.4 : 0.3);
      s.mesh.position.set(wx(lerp(p.px, p.x)), 0.5, wz(lerp(p.py, p.y))); s.mat.emissiveColor.set(1, 1, 1);
      if (p.type === 'arrow') s.mesh.billboardMode = 0, s.mesh.rotation.y = Math.atan2(p.dx, -p.dy) - Math.PI / 2 + Math.PI; // flat along its flight direction
    }
    for (const [p, s] of this.projSprites) if (!pl.has(p)) { s.mesh.dispose(); s.mat.dispose(); this.projSprites.delete(p); }
    // fx (explosions, puffs, blood)
    for (const s of this.fxSprites) { s.mesh.dispose(); s.mat.dispose(); } this.fxSprites = [];
    for (const f of sim.fx) {
      const s = this.makeSprite(this.a.sprites.props); this.fxSprites.push(s);
      const k = Math.min(2, Math.floor(f.t / 5));
      let name, h, y0 = 0.4;
      if (f.kind === 'puff') { name = f.t < 6 ? 'puff1' : 'puff2'; h = 0.16; }
      else if (f.kind === 'blood') { name = ['blood1', 'blood2', 'blood3'][Math.min(2, Math.floor(f.t / 3))]; h = 0.18; }
      else { name = ['boom1', 'boom2', 'boom3'][k]; h = f.kind === 'boomGreen' ? 0.5 : 0.55; }
      s.setFrame(this.rectOf('props', name), h); s.mesh.position.set(wx(f.x), y0, wz(f.y)); s.mat.emissiveColor.set(1, 1, 1);
    }
  }
  dispose() { this.scene.meshes.slice().forEach((m) => m.dispose()); }
}
