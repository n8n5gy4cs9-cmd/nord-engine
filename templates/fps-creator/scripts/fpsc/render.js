// Babylon renderer for an FPS Creator level: textures, baked-light shader, sky, ground, door animation, dynamic lights.
// The geometry itself comes from geometry.js (pure). Babylon is passed in (`B` = globalThis.BABYLON) so nothing here imports a library.
import { CELL, STORY } from './level.js';
import { buildGeometry, bakeBatches, lightAtPoint, Batch } from './geometry.js';
import { paintTexture } from './bank/textures.js';

const hex = (c, d = '#ffffff') => { const ok = (v) => typeof v === 'string' && /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.test(v); let h = (ok(c) ? c : d).replace('#', ''); if (h.length === 3) h = h.replace(/./g, '$&$&'); const n = parseInt(h, 16); return [(n >> 16) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255]; };
export { hex };

const LEVEL_VS = `precision highp float;
attribute vec3 position; attribute vec3 normal; attribute vec2 uv; attribute vec4 color;
uniform mat4 world; uniform mat4 worldViewProjection;
varying vec2 vUV; varying vec4 vColor; varying vec3 vWorld; varying vec3 vN; varying float vDist;
void main(){ vec4 wp = world*vec4(position,1.0); vWorld = wp.xyz; vN = normalize(mat3(world)*normal); vUV = uv; vColor = color; gl_Position = worldViewProjection*vec4(position,1.0); vDist = gl_Position.w; }`;
const LEVEL_FS = `precision highp float;
varying vec2 vUV; varying vec4 vColor; varying vec3 vWorld; varying vec3 vN; varying float vDist;
uniform sampler2D tex; uniform vec3 fogColor; uniform float fogDensity; uniform vec4 dl[8]; uniform vec3 dc[8]; uniform float alphaMul; uniform float cutoff; uniform float glow;
void main(){
  vec4 t = texture2D(tex, vUV); if (t.a < cutoff) discard;
  vec3 lit = vColor.rgb;
  for (int i = 0; i < 8; i++) { vec3 d = dl[i].xyz - vWorld; float dist = length(d); float k = clamp(1.0 - dist/max(dl[i].w,0.01), 0.0, 1.0); k *= k; k *= max(dot(vN, d/max(dist,0.001)), 0.0)*0.7 + 0.3; lit += dc[i]*k; }
  vec3 col = t.rgb * min(lit + vec3(glow), vec3(1.7));
  float f = 1.0 - exp(-fogDensity*fogDensity*vDist*vDist); col = mix(col, fogColor, clamp(f, 0.0, 1.0));
  gl_FragColor = vec4(col, t.a*alphaMul);
}`;
const SKY_VS = `precision highp float; attribute vec3 position; uniform mat4 worldViewProjection; varying vec3 vP; void main(){ vP = position; gl_Position = worldViewProjection*vec4(position,1.0); }`;
const SKY_FS = `precision highp float; varying vec3 vP; uniform vec3 top; uniform vec3 horizon; uniform vec3 bottom; uniform vec3 sunDir; uniform vec3 sunColor; uniform float stars;
float hash(vec3 p){ p = fract(p*0.3183099+0.1); p *= 17.0; return fract(p.x*p.y*p.z*(p.x+p.y+p.z)); }
void main(){ vec3 d = normalize(vP); float h = d.y; vec3 col = h > 0.0 ? mix(horizon, top, pow(h, 0.55)) : mix(horizon, bottom, pow(-h, 0.6));
  if (stars > 0.0 && h > 0.0) { vec3 q = floor(d*220.0); float s = step(0.9965, hash(q)); col += vec3(s)*stars*smoothstep(0.0,0.3,h); }
  float sd = max(dot(d, normalize(sunDir)), 0.0); col += sunColor*(pow(sd, 400.0)*1.5 + pow(sd, 8.0)*0.18);
  gl_FragColor = vec4(col, 1.0); }`;

export const SKIES = {
  day: { top: '#3f78c8', horizon: '#bcd8f0', bottom: '#5a6a58', sun: '#fff2c0', sunDir: [0.4, 0.7, 0.35], stars: 0, ambient: '#a8b6cc', sunPower: 0.75 },
  dusk: { top: '#2b3a7a', horizon: '#f08a50', bottom: '#2a2a3a', sun: '#ff9a50', sunDir: [-0.7, 0.18, 0.5], stars: 0.3, ambient: '#a08aa8', sunPower: 0.55 },
  night: { top: '#04060f', horizon: '#14203a', bottom: '#05070c', sun: '#8aa0d8', sunDir: [0.3, 0.6, -0.5], stars: 1, ambient: '#5568a0', sunPower: 0.22 },
  overcast: { top: '#7d8590', horizon: '#aeb4bb', bottom: '#555a5e', sun: '#000000', sunDir: [0, 1, 0], stars: 0, ambient: '#a0a6ae', sunPower: 0.4 },
  void: { top: '#000000', horizon: '#000000', bottom: '#000000', sun: '#000000', sunDir: [0, 1, 0], stars: 0, ambient: '#808890', sunPower: 0 },
};

export class LevelRenderer {
  constructor(B, scene, world, level, bank, opts = {}) {
    this.B = B; this.scene = scene; this.world = world; this.level = level; this.bank = bank; this.opts = opts;
    this.textures = new Map(); this.materials = new Map(); this.meshes = []; this.doorVis = new Map(); this.dynLights = [];
    this.fog = { color: [0.6, 0.65, 0.75], density: 0 };
    this.stats = { verts: 0, tris: 0, lights: 0, bakeMs: 0 };
    const set = level.settings; this.sky = SKIES[set.sky] ?? SKIES.day;
    const a = hex(set.ambientColor, '#9aa8c0'), k = set.ambient ?? 0.35;
    this.ambient = a.map((v) => v * k);
  }

  // ---- textures & materials ------------------------------------------------------------------------------------------------
  texture(id) {
    if (this.textures.has(id)) return this.textures.get(id);
    const B = this.B, def = this.bank.texture(id) ?? this.bank.texture('concrete');
    let t;
    if (def.url) t = new B.Texture(def.url, this.scene, false, true, B.Texture.TRILINEAR_SAMPLINGMODE);
    else {
      const cv = paintTexture(def, def.px ?? 256);
      t = new B.DynamicTexture(`fpsc-${id}`, { width: cv.width, height: cv.height }, this.scene, true, B.Texture.TRILINEAR_SAMPLINGMODE);
      t.getContext().drawImage(cv, 0, 0); t.update(true);
      if (def.alpha || def.alphaTest) t.hasAlpha = true;
    }
    t.wrapU = t.wrapV = B.Texture.WRAP_ADDRESSMODE; t.anisotropicFilteringLevel = 4;
    this.textures.set(id, t); return t;
  }

  material(texId) {
    if (this.materials.has(texId)) return this.materials.get(texId);
    const B = this.B, def = this.bank.texture(texId) ?? this.bank.texture('concrete');
    if (!B.Effect.ShadersStore.fpscLevelVertexShader) { B.Effect.ShadersStore.fpscLevelVertexShader = LEVEL_VS; B.Effect.ShadersStore.fpscLevelFragmentShader = LEVEL_FS; }
    const m = new B.ShaderMaterial(`fpsc-${texId}`, this.scene, 'fpscLevel', { attributes: ['position', 'normal', 'uv', 'color'], uniforms: ['world', 'worldViewProjection', 'fogColor', 'fogDensity', 'dl', 'dc', 'alphaMul', 'cutoff', 'glow'], samplers: ['tex'] });
    m.setTexture('tex', this.texture(def.id ?? texId));
    m.setFloat('alphaMul', def.alpha ?? 1); m.setFloat('cutoff', def.alphaTest ? 0.5 : 0); m.setFloat('glow', def.glow ?? 0);
    m.backFaceCulling = false;
    if (def.alpha) { m.needAlphaBlending = () => true; m.alphaMode = B.Engine.ALPHA_COMBINE; }
    this.materials.set(texId, m); this.#applyFog(m); this.#applyDyn(m);
    return m;
  }
  #applyFog(m) { m.setColor3('fogColor', new this.B.Color3(...this.fog.color)); m.setFloat('fogDensity', this.fog.density); }
  #applyDyn(m) { m.setArray4('dl', this.dlArr ??= new Float32Array(32)); m.setArray3('dc', this.dcArr ??= new Float32Array(24)); }

  /** Make a mesh from a Batch (adds it to this.meshes unless `parent` handles disposal). */
  meshFrom(batch, name, parent = null) {
    const B = this.B, mesh = new B.Mesh(name, this.scene), vd = new B.VertexData();
    vd.positions = batch.pos; vd.normals = batch.nor; vd.uvs = batch.uv; vd.indices = batch.idx; vd.colors = batch.col ?? undefined;
    vd.applyToMesh(mesh);
    mesh.material = this.material(batch.tex); mesh.isPickable = false; mesh.alwaysSelectAsActiveMesh = true; mesh.doNotSyncBoundingInfo = true;
    if (parent) mesh.parent = parent;
    this.stats.verts += batch.verts; this.stats.tris += batch.idx.length / 3;
    return mesh;
  }

  // ---- lights ----------------------------------------------------------------------------------------------------------------
  /** Static lights are baked into vertex colours; call again after a switchable light changed. */
  build(lights) {
    const B = this.B, t0 = performance.now();
    this.dispose(true); this.stats.verts = 0; this.stats.tris = 0;
    const g = buildGeometry(this.world, this.level, this.bank, { ceilings: this.opts.ceilings, maxLayer: this.opts.maxLayer });
    this.geometry = g;
    this.#addGround(g.batches);
    const all = [...g.batches.values()];
    for (const d of g.doors) for (const lf of d.leaves) all.push(...lf.batches.values());
    const sun = this.sky.sunPower > 0 && this.level.settings.sky !== 'void' ? { dir: this.#sunDir(), color: hex(this.sky.sun).map((v) => v * this.sky.sunPower), world: this.world } : null;
    this.sun = sun; this.staticLights = lights;
    this.#bake(all, lights, sun);
    for (const b of g.batches.values()) this.meshes.push(this.meshFrom(b, `fpsc-${b.tex}`));
    for (const d of g.doors) {
      const vis = { door: d.door, style: d.style, leaves: [] };
      for (const lf of d.leaves) {
        const node = new B.TransformNode(`door-${d.door.id}`, this.scene); node.position.set(...lf.pivot);
        for (const b of lf.batches.values()) this.meshFrom(b, `leaf-${d.door.id}`, node);
        vis.leaves.push({ node, half: lf.half, base: [...lf.pivot] });
      }
      this.doorVis.set(d.door.id, vis); this.updateDoor(d.door);
    }
    this.#environment();
    this.stats.lights = lights.length; this.stats.bakeMs = performance.now() - t0;
    return this.stats;
  }

  #sunDir() { const d = this.sky.sunDir, l = Math.hypot(...d) || 1; return d.map((v) => v / l); }
  #bake(batches, lights, sun) {
    const world = this.world, amb = this.ambient;
    const extra = sun ? (p, n) => {
      const ndl = n[0] * sun.dir[0] + n[1] * sun.dir[1] + n[2] * sun.dir[2]; if (ndl <= 0) return null;
      const q = [p[0] + n[0] * 0.1, p[1] + n[1] * 0.1, p[2] + n[2] * 0.1];
      if (world.ceilingAt(q[0], q[2], q[1]) !== Infinity) return null;
      if (world.ray(q[0], q[1], q[2], sun.dir[0], sun.dir[1], sun.dir[2], 30, 'sight')) return null;
      return [sun.color[0] * ndl, sun.color[1] * ndl, sun.color[2] * ndl];
    } : null;
    const verts = batches.reduce((a, b) => a + b.verts, 0);
    let occlude = this.opts.occlude !== false && this.level.settings.bake !== 'fast';
    if (occlude && verts * lights.length > 12e6) { occlude = false; this.stats.note = `light occlusion skipped (${verts} vertices × ${lights.length} lights is too much); set fewer lights or smaller areas`; console.warn(`[fpsc] ${this.stats.note}`); }
    bakeBatches(world, batches, lights, amb, { occlude, extra });
  }

  /** Light colour at a world point (for models/pickups). Cached on a 1 m grid. */
  lightAt(x, y, z) {
    const ck = `${Math.round(x)},${Math.round(y)},${Math.round(z)}`;
    this.lightCache ??= new Map();
    let c = this.lightCache.get(ck);
    if (!c) {
      c = lightAtPoint(this.world, this.staticLights ?? [], this.ambient, [x, y + 0.2, z], null, true);
      if (this.sun && this.world.ceilingAt(x, z, y + 1) === Infinity) { c[0] += this.sun.color[0] * 0.6; c[1] += this.sun.color[1] * 0.6; c[2] += this.sun.color[2] * 0.6; }
      this.lightCache.set(ck, c);
    }
    return c;
  }

  // ---- ground, sky, fog -------------------------------------------------------------------------------------------------------
  #addGround(batches) {
    const lv = this.level, set = lv.settings;
    if (set.ground === 'none') return;
    const tex = this.bank.texture(set.ground) ? set.ground : 'grass', tile = this.bank.texture(tex).size ?? 4;
    const b = new Batch(tex), R = 600, y = -0.04;
    const base = 0; const uv = (x, z) => [x / tile, z / tile];
    for (const [x, z] of [[-R, -R], [lv.w * CELL + R, -R], [lv.w * CELL + R, lv.d * CELL + R], [-R, lv.d * CELL + R]]) { b.pos.push(x, y, z); b.nor.push(0, 1, 0); b.uv.push(...uv(x, z)); }
    b.idx.push(base, 3, 2, base, 2, 1);
    batches.set(`ground:${tex}`, Object.assign(b, { tex }));
  }

  #environment() {
    const B = this.B, scene = this.scene, set = this.level.settings;
    this.sky = SKIES[set.sky] ?? SKIES.day;
    const top = set.sky === 'custom' ? hex(set.skyColor) : hex(this.sky.top), horizon = set.sky === 'custom' ? hex(set.skyColor).map((v) => Math.min(1, v * 1.25)) : hex(this.sky.horizon);
    if (!B.Effect.ShadersStore.fpscSkyVertexShader) { B.Effect.ShadersStore.fpscSkyVertexShader = SKY_VS; B.Effect.ShadersStore.fpscSkyFragmentShader = SKY_FS; }
    this.skyMesh?.dispose(); this.skyMat?.dispose();
    const m = this.skyMat = new B.ShaderMaterial('fpsc-sky', scene, 'fpscSky', { attributes: ['position'], uniforms: ['worldViewProjection', 'top', 'horizon', 'bottom', 'sunDir', 'sunColor', 'stars'] });
    m.setColor3('top', new B.Color3(...top)); m.setColor3('horizon', new B.Color3(...horizon)); m.setColor3('bottom', new B.Color3(...hex(this.sky.bottom)));
    m.setVector3('sunDir', new B.Vector3(...this.#sunDir())); m.setColor3('sunColor', new B.Color3(...hex(this.sky.sun))); m.setFloat('stars', this.sky.stars);
    m.backFaceCulling = false; m.disableDepthWrite = true;
    const sky = this.skyMesh = B.MeshBuilder.CreateSphere('fpsc-sky', { diameter: 900, segments: 12 }, scene);
    sky.material = m; sky.infiniteDistance = true; sky.isPickable = false; sky.renderingGroupId = 0; sky.alwaysSelectAsActiveMesh = true;
    scene.clearColor = new B.Color4(...horizon, 1);
    const fogOn = !!set.fog; const fc = hex(set.fogColor, '#9bb0c8');
    this.fog = { color: fogOn ? fc : horizon, density: fogOn ? set.fogDensity : 0 };
    scene.fogMode = fogOn ? B.Scene.FOGMODE_EXP2 : B.Scene.FOGMODE_NONE; scene.fogColor = new B.Color3(...this.fog.color); scene.fogDensity = this.fog.density;
    for (const m2 of this.materials.values()) this.#applyFog(m2);
    this.lightCache = null;
  }

  /** Up to 8 transient lights per frame (muzzle flash, explosions, flickering/dynamic level lights): [{x,y,z,color:[r,g,b],range,intensity}] */
  setDynamicLights(list) {
    const a = this.dlArr ??= new Float32Array(32), c = this.dcArr ??= new Float32Array(24);
    a.fill(0); c.fill(0);
    for (let i = 0; i < 8 && i < list.length; i++) { const l = list[i]; a.set([l.x, l.y, l.z, l.range], i * 4); c.set([l.color[0] * l.intensity, l.color[1] * l.intensity, l.color[2] * l.intensity], i * 3); }
    for (const m of this.materials.values()) { m.setArray4('dl', a); m.setArray3('dc', c); }
  }

  // ---- doors -----------------------------------------------------------------------------------------------------------------
  updateDoor(door) {
    const v = this.doorVis.get(door.id); if (!v) return;
    const o = door.open, slide = door.def.door.slide ?? 0.68;
    for (const lf of v.leaves) {
      const n = lf.node, [bx, by, bz] = lf.base;
      if (v.style === 'up') n.position.y = by + o * 2.45;
      else if (v.style === 'side') { const d = lf.half * o * slide; n.position.x = bx + (door.o === 'H' ? d : 0); n.position.z = bz + (door.o === 'V' ? d : 0); }
      else n.rotation.y = -o * 1.75 * (door.flip ? -1 : 1);
    }
  }

  dispose(keepEnv = false) {
    for (const m of this.meshes) m.dispose();
    for (const v of this.doorVis.values()) for (const l of v.leaves) l.node.dispose(false, true);
    this.meshes = []; this.doorVis.clear();
    if (!keepEnv) { this.skyMesh?.dispose(); for (const m of this.materials.values()) m.dispose(); for (const t of this.textures.values()) t.dispose(); this.materials.clear(); this.textures.clear(); }
  }
}
