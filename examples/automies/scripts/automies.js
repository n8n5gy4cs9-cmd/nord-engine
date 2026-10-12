// @nord {"id":"automies.game","title":"Automies — game view","category":"games","tier":["3d"],"tags":["driving","driver2","split-screen","city","police","racing"],"description":"Driver 2-style 3D driving proof of concept: one city (Haven Bay), a checkpoint getaway through traffic with police chasing, Driver 2's handling model ported to JavaScript, 1-2 player split-screen (player 2 on a gamepad)."}
// Automies — a one-level Driver 2 homage. Crowelian 2026 + Sonnet.
// Reused: OpenDriver2/REDRIVER2 (GPL-2.0) for the handling model, gears/revs and chase-camera constants (scripts/am/car.js); Kenney Starter Kits (MIT) for roads, buildings and
// trucks plus engine/skid/impact sounds; nordrep's split-screen layout (am/split.js). Generated: cars, towers, landmarks, props (tools/gen_automies_models.mjs).
// This file is only the view/controller. The world (cars, traffic, police, mission) lives in am/sim.js and runs without a renderer (tools/am-sim.mjs).
import { NordScript } from 'nord';
import { parseCity, TILE, TREES, LEGEND } from './am/city.js';
import { Sim, MISSION } from './am/sim.js';
import { CARS } from './am/cars.js';
import { layout } from './am/split.js';
import { ANG } from './am/car.js';

const A = (p) => `assets/${p}`;
const M = A('models/'), KC = A('models/kenney/city/'), KR = A('models/kenney/racing/');
const OWN = ['muscle', 'coupe', 'cop', 'taxi', 'van', 'tower_a', 'tower_b', 'tower_c', 'tower_d', 'bank', 'warehouse', 'safehouse', 'cone', 'barrier', 'hydrant', 'bin', 'tree'];
const KENNEY_CITY = ['road-straight', 'road-straight-lightposts', 'road-corner', 'road-split', 'road-intersection', 'pavement', 'pavement-fountain', 'grass', 'building-small-a', 'building-small-b', 'building-small-c', 'building-small-d', 'building-garage'];
const MODELS = { ...Object.fromEntries(OWN.map((n) => [n, M + n + '.glb'])), ...Object.fromEntries(KENNEY_CITY.map((n) => [n, KC + n + '.glb'])),
  'kenney:truck-red': KR + 'vehicle-truck-red.glb', 'kenney:truck-green': KR + 'vehicle-truck-green.glb', 'kenney:truck-purple': KR + 'vehicle-truck-purple.glb' };
const TEXTURES = ['facadeA', 'facadeB', 'facadeC', 'facadeD', 'roof', 'metal', 'marble', 'container', 'concrete', 'pavement', 'water'];
const SND = (n) => A(`audio/sfx/${n}.wav`), KSND = (n) => A(`audio/kenney/${n}.ogg`);
const PCOL = ['#ff9a3c', '#4fc3ff'];
const BEACON_BIT = [0x10000000, 0x20000000], ALL = 0x0fffffff;
const lerp = (a, b, t) => a + (b - a) * t, clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const wrap = (a) => { while (a > Math.PI) a -= Math.PI * 2; while (a < -Math.PI) a += Math.PI * 2; return a; };
const dead = (v, d = 0.12) => (Math.abs(v) < d ? 0 : (v - Math.sign(v) * d) / (1 - d));
const GEAR_NAMES = ['1', '2', '3', '4'];

export default class Automies extends NordScript {
  static attributes = {
    players: { type: 'int', default: 1, min: 1, max: 2, label: 'Players (a 2nd gamepad player joins automatically; ?players=2 forces split-screen)' },
    splitMode: { type: 'enum', options: ['topBottom', 'leftRight'], default: 'topBottom' },
    traffic: { type: 'int', default: 16, min: 0, max: 40, label: 'Civilian cars' },
    seed: { type: 'int', default: 0, label: 'Random seed (0 = random, ?seed=N also works)' },
  };
  start() { this.ready = false; this.boot().catch((e) => this.game.reportError(e, this, 'boot')); }

  // ===== boot ===============================================================================================================
  async boot() {
    const g = this.game, be = g.backend, B = this.B = be.B, sc = this.sc = be.scene, canvas = this.canvas = be.canvas, q = new URLSearchParams(location.search);
    await be.preload(Object.values(MODELS));
    this.listeners = []; this.city = parseCity(await g.loader.text(A('maps/haven.map')));
    let seed = Number(q.get('seed')) || this.attrs.seed || (Math.random() * 1e9) | 0;
    this.rnd = () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
    this.want = Math.max(this.attrs.players, q.get('players') === '2' ? 2 : 1); this.bot = q.get('bot') === '1';
    const px = (p, flip) => { const t = new B.Texture(g.loader.url(A(`textures/${p}.png`)), sc, false, flip, B.Texture.NEAREST_LINEAR_MIPLINEAR); t.wrapU = t.wrapV = B.Texture.WRAP_ADDRESSMODE; return t; };
    this.tex = {}; this.texG = {}; for (const n of TEXTURES) { this.tex[n] = px(n, true); this.texG[n] = px(n, false); }
    this.buildEnvironment(); this.buildCity(); this.buildFx(); this.buildHud(); this.bindInput();
    this.newRun({ attract: true });
    g.audio.music('assets/audio/music/music_action.mp3', { volume: 0.12 });
    this.ambience = g.audio.play(KSND('ambience'), { loop: true, volume: 0.12 });
    this.t = 0; window.__am = this; this.ready = true;
  }
  onDestroy() { for (const [t, f] of this.listeners ?? []) window.removeEventListener(t, f); this.hudRoot?.remove(); try { this.siren?.osc.stop(); } catch { /* ignore */ } this.engines?.forEach((e) => e?.stop?.()); this.ambience?.stop?.(); delete window.__am; }

  // ===== helpers ============================================================================================================
  inst(key, name, clone = false) {
    const c = this.game.backend.models.get(MODELS[key] ?? key), r = c.instantiateModelsToScene((n) => `${name}.${n}`, clone), root = new this.B.TransformNode(name, this.sc);
    for (const n of r.rootNodes) n.parent = root; for (const m of root.getChildMeshes()) m.isPickable = false; return root;
  }
  freeze(root) { for (const m of root.getChildMeshes()) { m.freezeWorldMatrix(); m.doNotSyncBoundingInfo = true; } }
  emissive(name, hex, alpha = 1) { const m = new this.B.StandardMaterial(name, this.sc); m.disableLighting = true; m.emissiveColor = this.B.Color3.FromHexString(hex); m.alpha = alpha; m.backFaceCulling = false; return m; }

  // ===== environment: sky, light, ground, water, textured materials =========================================================
  buildEnvironment() {
    const B = this.B, sc = this.sc, [W, H] = this.city.size;
    sc.clearColor = new B.Color4(0.62, 0.78, 0.92, 1); sc.fogMode = B.Scene.FOGMODE_EXP2; sc.fogDensity = 0.0042; sc.fogColor = new B.Color3(0.7, 0.82, 0.93);
    const hemi = new B.HemisphericLight('hemi', new B.Vector3(0.2, 1, -0.1), sc); hemi.intensity = 0.8; hemi.groundColor = new B.Color3(0.42, 0.44, 0.5);
    const sun = new B.DirectionalLight('sun', new B.Vector3(-0.5, -1, 0.45), sc); sun.intensity = 0.95; sun.specular = new B.Color3(0.15, 0.15, 0.15);
    // skybox from the shared Nord day cube (no CDN, same six PNGs the other 3D examples use)
    const faces = ['px', 'py', 'pz', 'nx', 'ny', 'nz'].map((f) => this.game.loader.url(A(`skybox/day/${f}.png`)));
    const cube = B.CubeTexture.CreateFromImages(faces, sc), sky = B.MeshBuilder.CreateBox('sky', { size: 2400 }, sc), sm = new B.StandardMaterial('sky', sc);
    sm.backFaceCulling = false; sm.reflectionTexture = cube; sm.reflectionTexture.coordinatesMode = B.Texture.SKYBOX_MODE; sm.disableLighting = true; sm.fogEnabled = false; sky.material = sm; sky.infiniteDistance = true; sky.isPickable = false; sky.renderingGroupId = 0;
    // ground under everything (pavement) and the harbour water
    const ground = B.MeshBuilder.CreateGround('ground', { width: W + 400, height: H + 400 }, sc), gm = new B.StandardMaterial('ground', sc);
    this.tex.pavement.uScale = this.tex.pavement.vScale = (W + 400) / 4; gm.diffuseTexture = this.tex.pavement; gm.specularColor = B.Color3.Black(); ground.material = gm; ground.position.set(W / 2, -0.02, H / 2); ground.isPickable = false;
    const water = B.MeshBuilder.CreateGround('water', { width: W + 800, height: H + 800 }, sc), wm = new B.StandardMaterial('water', sc);
    this.tex.water.uScale = this.tex.water.vScale = (W + 800) / 12; wm.diffuseTexture = this.tex.water; wm.emissiveColor = new B.Color3(0.18, 0.22, 0.28); wm.specularColor = new B.Color3(0.3, 0.35, 0.4); water.material = wm; water.position.set(W / 2, -0.6, H / 2); water.isPickable = false;
    // glTF materials that need our textures are matched by name (see assets.md)
    for (const k of OWN) { const c = this.game.backend.models.get(MODELS[k]); for (const mat of c.materials) { const t = this.texG[mat.name]; if (t && mat.name !== 'water') { mat.albedoTexture = t; mat.albedoColor = new B.Color3(1, 1, 1); } mat.metallic = mat.name === 'chrome' ? 0.6 : 0; mat.roughness = mat.name === 'glass' ? 0.1 : 0.85; if (mat.name === 'glass') { mat.alpha = 0.55; mat.transparencyMode = 2; } } }
    this.W = W; this.H = H;
  }

  // ===== city ===============================================================================================================
  buildCity() {
    const B = this.B, c = this.city, T = TILE, root = this.cityRoot = new B.TransformNode('city', this.sc);
    const put = (key, cx, cy, { rot = 0, sx = T, sy = T, sz = T, y = 0 } = {}) => {
      const n = this.inst(key, `${key}_${cx}_${cy}`); n.parent = root; const [x, z] = c.center(cx, cy); n.position.set(x, y, z); n.rotation.y = rot; n.scaling.set(sx, sy, sz); this.freeze(n); return n;
    };
    const h = (x, y, k) => { let v = (x * 374761393 + y * 668265263 + k * 2147483647) | 0; v = (v ^ (v >>> 13)) * 1274126177; return ((v ^ (v >>> 16)) >>> 0) / 4294967296; };
    for (const r of c.roads) put(r.piece, r.cx, r.cy, { rot: r.rot });
    for (let cy = 0; cy < c.h; cy++) for (let cx = 0; cx < c.w; cx++) {
      const ch = c.at(cx, cy), e = LEGEND[ch]; if (!e || e.kind === 'road' || e.kind === 'water') continue;
      if (e.kind === 'pave') put('pavement', cx, cy);
      else if (e.kind === 'park') { put('grass', cx, cy); for (const [dx, dz] of TREES) { const t = this.inst('tree', `tree_${cx}_${cy}_${dx}`); t.parent = root; const [x, z] = c.center(cx, cy); t.position.set(x + dx, 0, z + dz); t.scaling.setAll(0.8 + h(cx, cy, dx * 7) * 0.5); this.freeze(t); } }
      else if (e.kind === 'fountain') put('pavement-fountain', cx, cy, { sx: T * 0.9, sy: T * 0.9, sz: T * 0.9 });
      else if (e.kind === 'kenney') put(e.model, cx, cy, { rot: Math.floor(h(cx, cy, 9) * 4) * Math.PI / 2, sx: 16, sz: 16, sy: 16 });
      else { // my towers + landmarks on a Kenney pavement base
        put('pavement', cx, cy);
        const n = this.inst(e.model, `${e.model}_${cx}_${cy}`); n.parent = root; const [x, z] = c.center(cx, cy); n.position.set(x, 0.05, z);
        n.rotation.y = ch === 'B' ? Math.PI / 2 : ch === 'S' ? -Math.PI / 2 : Math.floor(h(cx, cy, 5) * 4) * Math.PI / 2; this.freeze(n);
      }
    }
    for (const p of c.props) { const n = this.inst(p.kind, `${p.kind}_${p.x | 0}_${p.z | 0}`); n.parent = root; n.position.set(p.x, 0, p.z); n.rotation.y = p.yaw; this.freeze(n); }
    // harbour: quay edge so the water does not meet the pavement in mid air
    const edge = this.B.MeshBuilder.CreateBox('quay', { width: this.W, height: 0.7, depth: 1.2 }, this.sc), em = new B.StandardMaterial('quay', this.sc); em.diffuseTexture = this.tex.concrete; edge.material = em; edge.position.set(this.W / 2, -0.3, 18 * T - 0.4); edge.isPickable = false;
    this.tex.concrete.uScale = this.W / 4; edge.freezeWorldMatrix();
  }

  // ===== effects: blob shadows, skid marks, smoke, beacons =================================================================
  buildFx() {
    const B = this.B, sc = this.sc;
    this.shadowSrc = B.MeshBuilder.CreateDisc('shadowSrc', { radius: 1, tessellation: 14 }, sc); this.shadowSrc.rotation.x = Math.PI / 2; this.shadowSrc.material = this.emissive('shadow', '#000000', 0.38); this.shadowSrc.isPickable = false; this.shadowSrc.setEnabled(false);
    this.skidSrc = B.MeshBuilder.CreatePlane('skidSrc', { width: 0.34, height: 0.8 }, sc); this.skidSrc.rotation.x = Math.PI / 2; this.skidSrc.bakeCurrentTransformIntoVertices(); this.skidSrc.material = this.emissive('skid', '#050505', 0.55); this.skidSrc.material.zOffset = -2; this.skidSrc.isPickable = false; this.skidSrc.setEnabled(false);
    this.skids = Array.from({ length: 260 }, () => { const m = this.skidSrc.createInstance('skid'); m.isPickable = false; m.setEnabled(false); m.alwaysSelectAsActiveMesh = true; return { m, life: 0 }; }); this.skidI = 0;
    // soft round puff texture (radial gradient drawn once on a canvas) shared by the smoke / fire sprites
    const dt = new B.DynamicTexture('puff', 64, sc, true), g2 = dt.getContext(), grad = g2.createRadialGradient(32, 32, 2, 32, 32, 31);
    grad.addColorStop(0, 'rgba(255,255,255,1)'); grad.addColorStop(0.55, 'rgba(255,255,255,0.55)'); grad.addColorStop(1, 'rgba(255,255,255,0)'); g2.fillStyle = grad; g2.fillRect(0, 0, 64, 64); dt.update(); dt.hasAlpha = true;
    const puff = (name, hex) => { const m = new B.StandardMaterial(name, sc); m.disableLighting = true; m.emissiveColor = B.Color3.FromHexString(hex); m.opacityTexture = dt; m.backFaceCulling = false; m.alphaMode = B.Engine.ALPHA_COMBINE; return m; };
    this.puffMats = { smoke: puff('smoke', '#dcdce2'), dark: puff('dsmoke', '#3a3a42'), fire: puff('fire', '#ff8a2a') };
    this.smokes = Array.from({ length: 90 }, () => { const m = B.MeshBuilder.CreatePlane('smoke', { size: 1 }, sc); m.billboardMode = B.Mesh.BILLBOARDMODE_ALL; m.isPickable = false; m.material = this.puffMats.smoke; m.setEnabled(false); m.alwaysSelectAsActiveMesh = true; return { m, life: 0, max: 1, vy: 0, size: 1, grow: 1 }; }); this.smokeI = 0;
    this.beacons = [0, 1].map((i) => {
      const col = B.Color3.FromHexString(PCOL[i]), mat = new B.StandardMaterial(`beacon${i}`, sc); mat.disableLighting = true; mat.emissiveColor = col; mat.alpha = 0.22; mat.backFaceCulling = false;
      const beam = B.MeshBuilder.CreateCylinder(`beam${i}`, { diameter: 9, height: 70, tessellation: 20, subdivisions: 1, cap: 0 }, sc); beam.material = mat; beam.position.y = 35; beam.layerMask = BEACON_BIT[i]; beam.isPickable = false;
      const ringMat = mat.clone(`ring${i}`); ringMat.alpha = 0.55; const ring = B.MeshBuilder.CreateTorus(`ring${i}`, { diameter: 11, thickness: 0.7, tessellation: 24 }, sc); ring.material = ringMat; ring.position.y = 0.4; ring.layerMask = BEACON_BIT[i]; ring.isPickable = false;
      const node = new B.TransformNode(`bc${i}`, sc); beam.parent = node; ring.parent = node; beam.position.y = 35; node.setEnabled(false); return { node, beam, ring, mat, ringMat };
    });
  }
  addSkid(x, z, yaw, a = 0.5) { const s = this.skids[this.skidI++ % this.skids.length]; s.m.setEnabled(true); s.m.position.set(x, 0.045, z); s.m.rotation.y = yaw; s.life = 9; s.m.visibility = a; }
  addSmoke(x, y, z, { size = 1.2, grow = 3.4, rise = 1.2, life = 1.1, color = null } = {}) { const s = this.smokes[this.smokeI++ % this.smokes.length]; s.m.setEnabled(true); s.m.position.set(x, y, z); s.life = life; s.max = life; s.vy = rise; s.size = size; s.grow = grow; s.m.scaling.setAll(size); s.m.visibility = 0.55; s.m.material = this.puffMats[color ?? 'smoke']; }
  updateFx(dt) {
    for (const s of this.skids) if (s.life > 0) { s.life -= dt; if (s.life <= 0) s.m.setEnabled(false); else if (s.life < 3) s.m.visibility = 0.5 * (s.life / 3); }
    for (const s of this.smokes) if (s.life > 0) { s.life -= dt; if (s.life <= 0) { s.m.setEnabled(false); continue; } const k = 1 - s.life / s.max; s.m.position.y += s.vy * dt; s.m.scaling.setAll(s.size + k * s.grow); s.m.visibility = 0.6 * (1 - k) * (1 - k); }
  }

  // ===== run / actors =======================================================================================================
  /** (Re)build the world. `attract`: bots drive behind the title screen. */
  newRun({ attract = false, players = null } = {}) {
    for (const v of this.views ?? []) v.root?.dispose(); this.views = new Map(); for (const e of this.engines ?? []) e?.stop?.(); this.engines = [];
    for (const f of this.fxLoops ?? []) f?.stop?.(); this.fxLoops = [];
    this.mode = attract ? 'title' : 'countdown'; this.count = 3.2; this.attract = attract; this.msgs = [];
    const n = players ?? (attract ? 1 : this.want);
    this.sim = new Sim(this.city, this.rnd, { players: attract ? 1 : n, bots: attract || this.bot, civs: this.attrs.traffic });
    this.pads = [null, null]; this.keys = new Set(); this.horn = [false, false];
    this.active = [true, !attract && n === 2, false, false]; this.padPrev = [{}, {}]; this.skidT = [0, 0];
    this.buildPlayers(); this.applyLayout(); this.syncActors(0);
    this.hudRefresh?.();
  }
  buildPlayers() {
    const B = this.B, sc = this.sc; for (const v of this.cams ?? []) v.cam.dispose(); this.cams = [];
    for (let i = 0; i < 2; i++) {
      const cam = new B.FreeCamera(`cam${i}`, B.Vector3.Zero(), sc); cam.fov = 1.15; cam.minZ = 0.3; cam.maxZ = 1600; cam.layerMask = ALL | BEACON_BIT[i];
      this.cams.push({ cam, yaw: 0, dist: 8, shake: 0, back: false, init: false, fov: 1.15 });
    }
    this.engines = [null, null];
  }
  applyLayout() {
    const act = [this.active[0], this.active[1], false, false], L = layout(act, { two: this.attrs.splitMode });
    this.sc.activeCameras = []; this.rects = [];
    this.cams.forEach((v, i) => { const r = L[i]; this.rects[i] = r; if (r) { v.cam.viewport = new this.B.Viewport(r.x, 1 - r.y - r.h, r.w, r.h); this.sc.activeCameras.push(v.cam); } });
    this.sc.activeCamera = this.cams[0].cam; this.hudLayout?.();
  }
  joinPad() {
    if (this.active[1] || this.attract || this.mode === 'over') return;
    this.active[1] = true; this.want = 2;
    let p = this.sim.players.find((q) => q.slot === 2);
    if (!p) { const a = this.sim.players[0]; p = this.sim.addPlayer(2); p.cp = a.cp; p.lastCell = a.lastCell; this.sim.respawn(p); }
    this.applyLayout(); this.toast(1, 'PLAYER 2 JOINED (GAMEPAD)'); this.toast(0, 'PLAYER 2 JOINED');
  }
  makeView(a) {
    const B = this.B, root = new B.TransformNode(`car${a.id}`, this.sc), tilt = new B.TransformNode(`tilt${a.id}`, this.sc); tilt.parent = root;
    const def = CARS[a.type], model = this.inst(def.model, `car${a.id}`, true); model.parent = tilt; model.scaling.setAll(def.scale ?? 1);
    for (const m of model.getChildMeshes()) { const mat = m.material; if (mat && /\.body$/.test(mat.name) && a.tint) { mat.albedoColor = B.Color3.FromHexString(a.tint); } if (mat && mat.name.endsWith('glass')) { mat.alpha = 0.55; mat.transparencyMode = 2; } }
    const wheels = {}; for (const n of model.getChildTransformNodes(false, (x) => /wheel/i.test(x.name))) { const m = n.name.toLowerCase().match(/wheel-(fl|fr|bl|br|front-left|front-right|back-left|back-right)$/); if (m) { const k = { 'front-left': 'fl', 'front-right': 'fr', 'back-left': 'bl', 'back-right': 'br' }[m[1]] ?? m[1]; wheels[k] = n; n.rotationQuaternion ??= B.Quaternion.Identity(); } }
    const lights = { red: [], blue: [] }; for (const m of model.getChildMeshes()) { const nm = m.material?.name ?? ''; if (nm.endsWith('redLight')) lights.red.push(m.material); if (nm.endsWith('blueLight')) lights.blue.push(m.material); }
    const sh = this.shadowSrc.createInstance(`sh${a.id}`); sh.scaling.set(def.width * 0.62, 1, def.length * 0.55); sh.isPickable = false;
    const v = { a, root, tilt, wheels, lights, sh, spin: 0, steer: 0, pitch: 0, roll: 0, skid: false, burn: 0, fx: 0, flash: 0, dark: false }; this.views.set(a.id, v); return v;
  }
  syncActors(dt) {
    const t = this.t ?? 0;
    for (const a of this.sim.actors) {
      const v = this.views.get(a.id) ?? this.makeView(a), c = a.car, def = CARS[a.type];
      v.root.position.set(c.x, 0, c.z); v.root.rotation.y = c.yaw; v.sh.position.set(c.x, 0.04, c.z); v.sh.rotation.y = c.yaw;
      // body pitch / roll from the tyre forces (nose lifts on throttle, dives on the brakes, leans out in corners)
      const kp = 1 - Math.exp(-dt * 8); v.pitch = lerp(v.pitch, clamp(-(c.accLong ?? 0) * 0.0042, -0.07, 0.07), kp); v.roll = lerp(v.roll, clamp((c.accLat ?? 0) * 0.0042, -0.08, 0.08), kp);
      v.tilt.rotation.x = v.pitch; v.tilt.rotation.z = v.roll; if (a.wreck) { v.tilt.rotation.z = lerp(v.tilt.rotation.z, 0.22, 0.05); }
      const r = def.model.startsWith('kenney') ? 0.45 : 0.35; v.spin += (c.forward / r) * dt; v.steer = ANG(c.wheelAngle);
      for (const [k, n] of Object.entries(v.wheels)) n.rotationQuaternion = this.B.Quaternion.RotationYawPitchRoll(k[0] === 'f' ? v.steer : 0, v.spin, 0);
      if (a.type === 'cop' && !a.wreck) { v.flash += dt; const on = ((v.flash * 5) | 0) % 2; for (const m of v.lights.red) m.emissiveColor.set(on ? 1 : 0.05, 0.1 * on, 0.05); for (const m of v.lights.blue) m.emissiveColor.set(0.05, 0.1 + 0.2 * (1 - on), on ? 0.05 : 1); }
      // skid marks + smoke
      const slip = c.rearVel > 1500 || c.locked[1] || (c.wheelspin && c.speed < 14), sp = c.speed;
      if (dt > 0 && slip && sp > 2.5) { v.fx -= dt; if (v.fx <= 0) { v.fx = 0.035; const s = Math.sin(c.yaw), co = Math.cos(c.yaw), w = def.track / 2, z0 = -def.wheelbase / 2; for (const sg of [-1, 1]) { const px = c.x + sg * w * co + z0 * s, pz = c.z - sg * w * s + z0 * co; this.addSkid(px, pz, Math.atan2(c.vx, c.vz) * 0.5 + c.yaw * 0.5, 0.5); if (this.rnd() < 0.35) this.addSmoke(px, 0.3, pz, { size: 0.45, grow: 1.7, life: 0.8 }); } } }
      if (dt > 0 && c.damage > 55 && !a.wreck) { v.burn -= dt; if (v.burn <= 0) { v.burn = c.damage > 85 ? 0.07 : 0.16; const s = Math.sin(c.yaw), co = Math.cos(c.yaw); this.addSmoke(c.x + s * def.length * 0.3, 1.1, c.z + co * def.length * 0.3, { size: 0.7, grow: 2.2, rise: 2.2, life: 1.2, color: 'dark' }); if (c.damage > 85) this.addSmoke(c.x + s * def.length * 0.3, 1.0, c.z + co * def.length * 0.3, { size: 0.4, grow: 1.1, rise: 2.6, life: 0.5, color: 'fire' }); } }
      if (a.wreck && dt > 0) { v.burn -= dt; if (v.burn <= 0) { v.burn = 0.09; this.addSmoke(c.x, 1.0, c.z, { size: 0.9, grow: 3, rise: 2.4, life: 1.4, color: this.rnd() < 0.35 ? 'fire' : 'dark' }); } if (!v.dark) { v.dark = true; for (const m of v.root.getChildMeshes()) if (m.material && /body$/.test(m.material.name)) m.material.albedoColor = new this.B.Color3(0.12, 0.12, 0.13); } } else if (v.dark && !a.wreck) { v.dark = false; for (const m of v.root.getChildMeshes()) if (m.material && /body$/.test(m.material.name) && a.tint) m.material.albedoColor = this.B.Color3.FromHexString(a.tint); }
    }
    // drop views of actors that no longer exist
    const live = new Set(this.sim.actors.map((a) => a.id)); for (const [id, v] of this.views) if (!live.has(id)) { v.root.dispose(); this.views.delete(id); }
  }

  // ===== input ==============================================================================================================
  bindInput() {
    this.listeners ??= []; const on = (t, f) => { window.addEventListener(t, f); this.listeners.push([t, f]); };
    on('keydown', (e) => { if (!this.ready) return; if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab'].includes(e.code)) e.preventDefault(); if (!e.repeat) { this.keys.add(e.code); this.keyEdge(e.code); } });
    on('keyup', (e) => this.keys.delete(e.code));
    on('gamepadconnected', () => { if (this.mode !== 'title') this.joinPad(); });
    on('pointerdown', () => { if (this.mode === 'title') this.begin(); else if (this.mode === 'over') location.reload(); });
  }
  keyEdge(code) {
    if (this.mode === 'title') { if (code === 'Enter' || code === 'Space' || code === 'KeyW' || code === 'ArrowUp') this.begin(); return; }
    if (this.mode === 'over') { if (code === 'KeyR' || code === 'Enter') location.reload(); return; }
    if (code === 'KeyR' && this.mode === 'play') this.manualRespawn(1);
    if (code === 'KeyP') this.paused = !this.paused;
  }
  begin() { if (this.mode !== 'title') return; this.newRun({ attract: false }); this.sfx('confirm', 0.5); this.titleEl.style.display = 'none'; }
  manualRespawn(slot) { const p = this.sim.players.find((q) => q.slot === slot); if (!p || p.actor.wreck || p.done) return; p.actor.car.damage = 100; } // wreck yourself (penalty) → respawn at the last checkpoint
  gamepads() { return [...(navigator.getGamepads?.() ?? [])].filter(Boolean); }
  /** One pad object per slot: { accel, brake, left, right, handbrake, fast, wheelspin, steer?, horn } */
  readInput() {
    const k = this.keys, pads = this.gamepads(), ax = (p, n) => dead(p.axes[n] ?? 0), B = (p, n) => !!p.buttons[n]?.pressed, V = (p, n) => p.buttons[n]?.value ?? 0;
    const out = [{}, {}];
    out[0] = { accel: k.has('KeyW') || k.has('ArrowUp'), brake: k.has('KeyS') || k.has('ArrowDown'), left: k.has('KeyA') || k.has('ArrowLeft'), right: k.has('KeyD') || k.has('ArrowRight'), handbrake: k.has('Space'), fast: k.has('ShiftLeft') || k.has('ShiftRight'), horn: k.has('KeyH'), back: k.has('KeyL') };
    const padFor = [pads.length >= 2 ? pads[0] : null, pads.length >= 2 ? pads[1] : pads[0] ?? null]; // one pad → player 2; two pads → P1 + P2
    padFor.forEach((p, i) => {
      if (!p) return;
      if (i === 1 && !this.active[1] && p.buttons.some((b) => b.pressed) && this.mode !== 'title') this.joinPad();
      const x = ax(p, 0), dl = B(p, 14), dr = B(p, 15), pad = { accel: V(p, 7) > 0.15 || B(p, 7), brake: V(p, 6) > 0.15 || B(p, 6), handbrake: B(p, 0) || B(p, 1), fast: B(p, 4) || B(p, 5), horn: B(p, 2), back: B(p, 3), left: dl, right: dr };
      if (Math.abs(x) > 0) pad.steer = x * 127; if (V(p, 7) > 0.15) pad.accelAnalog = V(p, 7);
      this.padBack ??= []; this.padBack[i] = pad.back;
      if (i === 0) out[0] = { ...out[0], ...Object.fromEntries(Object.entries(pad).filter(([, v]) => v)) }; else out[1] = pad;
      const prev = this.padPrev[i]; if (B(p, 9) && !prev.start && i === 1 && this.mode === 'play') this.manualRespawn(2); prev.start = B(p, 9);
      if (this.mode === 'title' && p.buttons.some((b) => b.pressed)) this.begin();
      if (this.mode === 'over' && p.buttons.some((b) => b.pressed) && (this.overT ?? 0) > 2) location.reload();
    });
    return out;
  }

  // ===== per-frame ==========================================================================================================
  update(dt) {
    if (!this.ready) return; dt = Math.min(dt, 0.1); this.t += dt;
    const inp = this.readInput(); this.horn = [!!inp[0].horn, !!inp[1].horn];
    if (this.mode === 'countdown') { this.count -= dt; if (this.count <= 0) { this.mode = 'play'; this.flash(0, 'GO!'); this.flash(1, 'GO!'); this.sfx('checkpoint', 0.5); } else if (Math.ceil(this.count) !== Math.ceil(this.count + dt) && this.count < 3) { this.sfx('tick', 0.5); this.flash(0, String(Math.ceil(this.count))); this.flash(1, String(Math.ceil(this.count))); } }
    if (this.mode === 'play' || this.mode === 'title') {
      if (this.mode === 'play') { this.sim.input[1] = inp[0]; if (this.active[1]) this.sim.input[2] = inp[1]; }
      if (!this.paused) this.sim.update(dt);
    }
    if (this.mode === 'over') this.overT = (this.overT ?? 0) + dt; else this.overT = 0;
    this.handleEvents(); this.syncActors(dt); this.updateFx(dt); this.updateCameras(dt); this.updateBeacons(dt); this.updateAudio(dt); this.updateHud(dt);
    this.tex.water.uOffset = (this.tex.water.uOffset + dt * 0.012) % 1; this.tex.water.vOffset = (this.tex.water.vOffset + dt * 0.006) % 1;
  }
  handleEvents() {
    const sim = this.sim; for (const e of sim.events) {
      if (e.type === 'crash') {
        const pl = this.sim.players.find((p) => p.actor === e.actor || p.actor === e.other);
        if (pl && e.speed > 2) { const i = pl.slot - 1, v = this.cams[i]; v.shake = Math.max(v.shake, clamp(e.speed / 14, 0.15, 1)); this.sfxK('impact', clamp(e.speed / 16, 0.12, 0.8), 0.9 + this.rnd() * 0.3, i === 0 ? -0.4 : 0.4); this.addSmoke(e.x, 0.8, e.z, { size: 0.5, grow: 1.6, life: 0.5 }); }
        else if (e.speed > 6 && this.nearPlayer(e.x, e.z, 70)) this.sfxK('impact', clamp(e.speed / 22, 0.08, 0.45), 1.0, 0);
      } else if (e.type === 'checkpoint') { const i = e.slot - 1; this.sfx('checkpoint', 0.6, 1, i === 0 ? -0.3 : 0.3); this.flash(i, e.last ? 'SAFEHOUSE!' : `CHECKPOINT ${e.index + 1}/${this.city.cps.length}  +${MISSION.cpBonus}s`); }
      else if (e.type === 'wreck') { if (e.actor.kind === 'player') { this.flash(e.slot - 1, 'WRECKED!'); this.sfx('explosion', 0.6); } else if (this.nearPlayer(e.actor.car.x, e.actor.car.z, 60)) this.sfx('explosion_small', 0.5); }
      else if (e.type === 'respawn') { this.flash(e.slot - 1, `BACK ON THE ROAD  -${MISSION.respawnPenalty}s`); this.sfx('spawn', 0.5); }
      else if (e.type === 'over') this.onOver(e);
    }
    sim.events.length = 0;
  }
  nearPlayer(x, z, d) { return this.sim.players.some((p) => Math.hypot(p.actor.car.x - x, p.actor.car.z - z) < d); }
  onOver(e) {
    this.mode = 'over'; const names = ['PLAYER 1', 'PLAYER 2'];
    const two = this.sim.players.length > 1; let head, sub;
    if (e.reason === 'finish') { head = two ? `${names[e.winner - 1]} WINS` : 'GETAWAY COMPLETE'; sub = `SAFEHOUSE REACHED  -  TIME LEFT ${Math.ceil(this.sim.time)}s`; this.sfx('win', 0.6); }
    else { head = e.winner ? `TIME UP  -  ${names[e.winner - 1]} LEADS` : 'TIME UP'; sub = 'THE COPS GOT YOU'; this.sfx('lose', 0.6); }
    this.endEl.innerHTML = `<div style="font-size:34px;color:${e.reason === 'finish' ? '#8be28b' : '#ff8a7a'}">${head}</div><div style="margin-top:8px;font-size:15px;color:#cde">${sub}</div><div style="margin-top:14px;font-size:13px;color:#9ab">PRESS R / ENTER / ANY GAMEPAD BUTTON TO PLAY AGAIN</div>`; this.endEl.style.display = 'block';
  }
  sfx(n, v = 0.5, r = 1, pan = 0) { this.game.audio.play(SND(n), { volume: v, rate: r, pan }); }
  sfxK(n, v = 0.5, r = 1, pan = 0) { this.game.audio.play(KSND(n), { volume: v, rate: r, pan }); }

  // ===== camera (Driver 2's follow camera: PlaceCameraFollowCar in camera.c) ===============================================
  updateCameras(dt) {
    const B = this.B, city = this.city;
    this.sim.players.forEach((p) => {
      const i = p.slot - 1, v = this.cams[i]; if (!v || !this.active[i]) return; const c = p.actor.car, def = CARS[p.actor.type];
      // angle chases the car's heading by 1/8 per 30 Hz frame; look-back snaps behind
      const target = c.yaw + (v.back ? Math.PI : 0); if (!v.init) { v.yaw = target; v.init = true; }
      v.yaw += wrap(target - v.yaw) * (1 - Math.pow(7 / 8, dt * 30));
      const maxDist = def.length * 1.55 + 1.6, expand = Math.abs(c.forward) > 4 ? 14 : 5; v.dist = Math.min(maxDist, v.dist + expand * dt); if (v.dist < 4) v.dist = 4;
      const speedK = clamp(c.speed / 40, 0, 1), height = 2.5 + speedK * 0.5 + (v.back ? -0.4 : 0), baseX = c.x, baseZ = c.z;
      let d = v.dist + speedK * 1.2, cx = baseX - Math.sin(v.yaw) * d, cz = baseZ - Math.cos(v.yaw) * d;
      // keep the camera out of buildings: walk the ray from the car towards the wanted position and stop at the first solid point
      for (let s = 1; s >= 0.15; s -= 0.1) { const x = baseX + (cx - baseX) * s, z = baseZ + (cz - baseZ) * s; if (!city.solidAt(x, z) && !city.solidAt(x + Math.sin(v.yaw + 1.57) * 0.6, z + Math.cos(v.yaw + 1.57) * 0.6) && !city.solidAt(x - Math.sin(v.yaw + 1.57) * 0.6, z - Math.cos(v.yaw + 1.57) * 0.6)) { cx = x; cz = z; if (s < 1) v.dist = Math.max(4, v.dist - (1 - s) * d * dt * 6); break; } }
      v.shake = Math.max(0, v.shake - dt * 2.2); const sh = v.shake * 0.35;
      v.cam.position.set(cx + (this.rnd() - 0.5) * sh, height + (this.rnd() - 0.5) * sh * 0.6, cz + (this.rnd() - 0.5) * sh);
      v.cam.setTarget(new B.Vector3(baseX + Math.sin(c.yaw) * 4 * (v.back ? -1 : 1), 1.15, baseZ + Math.cos(c.yaw) * 4 * (v.back ? -1 : 1)));
      v.fov = lerp(v.fov, 1.08 + speedK * 0.22, 1 - Math.exp(-dt * 3)); v.cam.fov = v.fov;
      v.back = !!(i === 0 ? this.keys.has('KeyL') : this.padBack?.[i]);
    });
  }
  updateBeacons(dt) {
    this.beacons.forEach((b, i) => {
      const p = this.sim.players.find((q) => q.slot === i + 1), on = !!p && this.active[i] && p.cp < this.city.cps.length && this.mode !== 'title';
      b.node.setEnabled(on); if (!on) return; const w = this.city.center(this.city.cps[p.cp].cx, this.city.cps[p.cp].cy), last = p.cp === this.city.cps.length - 1;
      b.node.position.set(w[0], 0, w[1]); b.ring.rotation.y += dt * 1.6; b.ring.position.y = 0.5 + Math.sin(this.t * 3) * 0.15;
      const col = last ? this.B.Color3.FromHexString('#7dff7d') : this.B.Color3.FromHexString(PCOL[i]); b.mat.emissiveColor = col; b.ringMat.emissiveColor = col;
    });
  }

  // ===== audio ==============================================================================================================
  ensureSiren() {
    const a = this.game.audio, ctx = a.ctx; if (this.siren || !ctx || !a.buses?.sfx) return;
    const osc = ctx.createOscillator(); osc.type = 'sawtooth'; const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1700; const gain = ctx.createGain(); gain.gain.value = 0;
    osc.connect(lp); lp.connect(gain); gain.connect(a.buses.sfx); osc.start(); this.siren = { osc, gain };
    const h1 = ctx.createOscillator(), h2 = ctx.createOscillator(), hg = ctx.createGain(); h1.type = h2.type = 'square'; h1.frequency.value = 392; h2.frequency.value = 494; hg.gain.value = 0; const hl = ctx.createBiquadFilter(); hl.type = 'lowpass'; hl.frequency.value = 1500;
    h1.connect(hl); h2.connect(hl); hl.connect(hg); hg.connect(a.buses.sfx); h1.start(); h2.start(); this.hornNode = { gain: hg };
  }
  updateAudio(dt) {
    const a = this.game.audio; if (!a.unlocked) return; this.ensureSiren();
    this.sim.players.forEach((p) => {
      const i = p.slot - 1; if (!this.active[i]) return; const c = p.actor.car, pan = this.active[1] ? (i === 0 ? -0.55 : 0.55) : 0;
      if (!this.engines[i]) this.engines[i] = a.play(KSND('engine'), { loop: true, volume: 0, pan });
      const e = this.engines[i]; if (e?.source) { const throttle = c.thrust > 0 ? 1 : 0.35; e.source.playbackRate.value = 0.45 + (c.revs / 30719) * 1.55; e.gain.gain.value = this.mode === 'title' ? 0.05 : p.actor.wreck ? 0.0 : 0.16 + 0.22 * throttle; }
      if (!this.fxLoops[i]) this.fxLoops[i] = a.play(KSND('skid'), { loop: true, volume: 0, pan });
      const s = this.fxLoops[i]; if (s?.gain) { const skid = (c.rearVel > 1500 || c.locked[1]) && c.speed > 4 ? clamp(c.speed / 20, 0.2, 0.55) : 0; s.gain.gain.value = lerp(s.gain.gain.value, skid, 0.35); if (s.source) s.source.playbackRate.value = 0.9 + clamp(c.speed / 60, 0, 0.4); }
    });
    // police siren: wails louder the closer the nearest cop is to any player
    let near = 999; for (const c of this.sim.actors) if (c.kind === 'cop' && !c.wreck) for (const p of this.sim.players) near = Math.min(near, Math.hypot(c.car.x - p.actor.car.x, c.car.z - p.actor.car.z));
    if (this.siren) { const f = 640 + 320 * (0.5 + 0.5 * Math.sin(this.t * 6.2)); this.siren.osc.frequency.value = f; this.siren.gain.gain.value = this.mode === 'title' ? 0 : clamp(26 / (near + 18), 0, 1) * 0.06; }
    if (this.hornNode) this.hornNode.gain.gain.value = this.horn[0] || this.horn[1] ? 0.07 : 0;
  }

  // ===== HUD (DOM overlays, one per viewport) ===============================================================================
  buildHud() {
    const stage = this.canvas.parentElement, root = this.hudRoot = document.createElement('div');
    root.style.cssText = 'position:absolute;inset:0;pointer-events:none;font:700 14px/1.3 ui-monospace,Menlo,Consolas,monospace;color:#f0f6ff;text-shadow:0 1px 2px #000,0 0 6px #000;overflow:hidden;user-select:none';
    stage.style.position = 'relative'; stage.appendChild(root); const iconUrl = this.game.loader.url(A('ui/icons.png'));
    this.icon = (n, s = 2) => `<span style="display:inline-block;width:${16 * s}px;height:${16 * s}px;vertical-align:middle;image-rendering:pixelated;background:url(${iconUrl}) -${n * 16 * s}px 0/${128 * s}px ${16 * s}px"></span>`;
    this.panels = [0, 1].map((i) => {
      const d = document.createElement('div'); d.style.cssText = 'position:absolute;overflow:hidden';
      d.innerHTML = `<div class="spd" style="position:absolute;left:14px;bottom:62px;font-size:40px;line-height:1">0<span style="font-size:14px"> KM/H</span></div><div class="gear" style="position:absolute;left:16px;bottom:46px;font-size:12px;color:#ffd25c"></div>
        <div class="cp" style="position:absolute;right:14px;top:8px;text-align:right;white-space:pre"></div><div class="who" style="position:absolute;left:14px;top:8px;color:${PCOL[i]}"></div>
        <div class="bars" style="position:absolute;left:14px;bottom:8px;white-space:pre"></div><div class="dir" style="position:absolute;left:50%;top:6px;margin-left:-24px;width:48px;height:48px;text-align:center"></div>
        <canvas class="map" width="150" height="126" style="position:absolute;right:10px;bottom:10px;border:2px solid rgba(255,255,255,.55);background:#10161e;image-rendering:pixelated;opacity:.92"></canvas><div class="msg" style="position:absolute;left:0;right:0;top:34%;text-align:center;font-size:30px;white-space:pre;display:none"></div>`;
      root.appendChild(d); return d;
    });
    this.endEl = document.createElement('div'); this.endEl.style.cssText = 'position:absolute;left:0;right:0;top:32%;text-align:center;background:rgba(8,12,20,.72);padding:22px;display:none'; root.appendChild(this.endEl);
    this.titleEl = document.createElement('div'); this.titleEl.style.cssText = 'position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;background:linear-gradient(rgba(8,12,22,.55),rgba(8,12,22,.8));text-align:center;pointer-events:auto';
    this.titleEl.innerHTML = `<div style="font-size:64px;letter-spacing:6px;color:#ffd25c;text-shadow:0 4px 0 #8a5a10,0 0 24px #000">AUTOMIES</div><div style="margin-top:6px;font-size:17px;color:#cfe4ff">THE GETAWAY - HAVEN BAY</div>
      <div style="margin-top:26px;font-size:15px;color:#fff;line-height:1.7">REACH ALL ${this.city.cps.length} CHECKPOINTS AND THE SAFEHOUSE BEFORE THE CLOCK RUNS OUT. THE COPS ARE ALREADY ON YOU.</div>
      <div style="margin-top:18px;font-size:13px;color:#aac;line-height:1.7">PLAYER 1  W/S THROTTLE-BRAKE/REVERSE  A/D STEER  SPACE HANDBRAKE  SHIFT FAST STEER  H HORN  L LOOK BACK  R RESET<br>PLAYER 2  GAMEPAD: LEFT STICK STEER  RT/LT THROTTLE/BRAKE  A HANDBRAKE  LB FAST STEER  X HORN  START RESET (PRESS ANY BUTTON TO JOIN)</div>
      <div style="margin-top:28px;font-size:20px;color:#8be28b;animation:b 1s infinite alternate">PRESS ENTER / CLICK / ANY GAMEPAD BUTTON</div><div style="margin-top:20px;font-size:11px;color:#789">CROWELIAN 2026 + SONNET  -  HANDLING PORTED FROM DRIVER 2 (REDRIVER2)</div><style>@keyframes b{from{opacity:.35}to{opacity:1}}</style>`;
    root.appendChild(this.titleEl);
    this.hudLayout = () => { this.panels.forEach((d, i) => { const r = this.rects?.[i]; d.style.display = r ? 'block' : 'none'; if (r) Object.assign(d.style, { left: `${r.x * 100}%`, top: `${r.y * 100}%`, width: `${r.w * 100}%`, height: `${r.h * 100}%` }); }); };
    this.mini = (() => { const [W] = this.city.size, c = document.createElement('canvas'); c.width = 150; c.height = 126; const g = c.getContext('2d'); g.fillStyle = '#1a222c'; g.fillRect(0, 0, 150, 126); this.mmS = 150 / W;
      for (let cy = 0; cy < this.city.h; cy++) for (let cx = 0; cx < this.city.w; cx++) { const ch = this.city.at(cx, cy); g.fillStyle = ch === '+' ? '#9aa4b4' : ch === '~' ? '#1d4a7a' : ch === 'g' || ch === 'f' ? '#2e5a34' : ch === '.' ? '#4a525e' : '#2c3440'; g.fillRect(cx * TILE * this.mmS, cy * TILE * this.mmS, TILE * this.mmS + 0.5, TILE * this.mmS + 0.5); }
      return c; })();
    this.hudLayout(); window.addEventListener('resize', this.hudLayout); this.listeners.push(['resize', this.hudLayout]);
    this.hudRefresh = () => { this.hudLayout(); this.endEl.style.display = 'none'; this.titleEl.style.display = this.mode === 'title' ? 'flex' : 'none'; };
  }
  flash(i, text, sec = 1.8) { const d = this.panels[i]?.querySelector('.msg'); if (!d) return; d.textContent = text; d.style.display = 'block'; (this.msgT ??= [0, 0])[i] = sec; }
  toast(i, text) { this.flash(i, text, 2.5); }
  updateHud(dt) {
    this.msgT ??= [0, 0]; const sim = this.sim, two = this.active[1], fmt = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
    this.panels.forEach((d, i) => {
      if (!this.active[i]) return; if (this.msgT[i] > 0) { this.msgT[i] -= dt; if (this.msgT[i] <= 0) d.querySelector('.msg').style.display = 'none'; }
      const p = sim.players.find((q) => q.slot === i + 1); if (!p) return; const c = p.actor.car, set = (sel, h) => { const el = d.querySelector(sel); if (el.dataset.h !== h) { el.dataset.h = h; el.innerHTML = h; } };
      set('.spd', `${Math.round(c.speed * 3.6)}<span style="font-size:14px"> KM/H</span>`); set('.gear', c.forward < -0.5 ? 'GEAR R' : `GEAR ${GEAR_NAMES[Math.min(3, c.gear)]}`);
      set('.who', two ? `PLAYER ${i + 1}` : '');
      const left = Math.max(0, sim.time), warn = left < 15 ? '#ff6a5a' : '#ffffff';
      set('.cp', `${this.icon(2, 1)} ${Math.min(p.cp + (p.done ? 0 : 0), this.city.cps.length)}/${this.city.cps.length}\n<span style="font-size:26px;color:${warn}">${fmt(left)}</span>`);
      const dmg = Math.round(c.damage), fel = Math.round(p.felony), cops = sim.actors.filter((a) => a.kind === 'cop' && !a.wreck).length;
      const bar = (v, col) => `<span style="display:inline-block;width:110px;height:10px;background:rgba(0,0,0,.55);border:1px solid #fff8;vertical-align:middle"><span style="display:block;width:${v}%;height:100%;background:${col}"></span></span>`;
      set('.bars', `${this.icon(0, 1)} ${bar(dmg, dmg > 70 ? '#ff4a3a' : dmg > 40 ? '#ffb23a' : '#7be07b')} DAMAGE ${dmg}%\n${this.icon(1, 1)} ${bar(fel, '#ffd23a')} FELONY   ${this.icon(4, 1)} x${cops}`);
      // arrow to the next checkpoint (relative to the car's heading)
      if (p.cp < this.city.cps.length) { const w = this.city.center(this.city.cps[p.cp].cx, this.city.cps[p.cp].cy), ang = Math.atan2(w[0] - c.x, w[1] - c.z) - c.yaw, dist = Math.hypot(w[0] - c.x, w[1] - c.z); set('.dir', `<div style="transform:rotate(${(ang * 180 / Math.PI).toFixed(0)}deg);width:32px;height:32px;margin:0 auto">${this.icon(5, 2)}</div><div style="font-size:11px">${Math.round(dist)} M</div>`); } else set('.dir', '');
      this.drawMini(d.querySelector('.map'), p);
    });
  }
  drawMini(cv, p) {
    const g = cv.getContext('2d'), s = this.mmS; g.drawImage(this.mini, 0, 0);
    const dot = (x, z, col, r = 2) => { g.fillStyle = col; g.fillRect(x * s - r, z * s - r, r * 2, r * 2); };
    for (const a of this.sim.actors) { if (a.kind === 'civ') dot(a.car.x, a.car.z, '#6a7484', 1); else if (a.kind === 'cop' && !a.wreck) dot(a.car.x, a.car.z, ((this.t * 4) | 0) % 2 ? '#ff4a4a' : '#4a8aff', 2.5); }
    if (p.cp < this.city.cps.length) { const w = this.city.center(this.city.cps[p.cp].cx, this.city.cps[p.cp].cy); g.strokeStyle = '#ffd23a'; g.lineWidth = 2; g.strokeRect(w[0] * s - 4, w[1] * s - 4, 8, 8); }
    for (const q of this.sim.players) { const c = q.actor.car, col = PCOL[q.slot - 1]; dot(c.x, c.z, col, 3); if (q === p) { g.strokeStyle = '#fff'; g.lineWidth = 1; g.strokeRect(c.x * s - 4.5, c.z * s - 4.5, 9, 9); } }
  }
}
