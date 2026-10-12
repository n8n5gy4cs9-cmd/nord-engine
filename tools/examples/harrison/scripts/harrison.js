// @nord {"id":"harrison.game","title":"Harrison's Command — game","category":"games","tier":["3d"],"tags":["fps","carrier","split-screen","render-to-texture","strategy"],"description":"Carrier Command-style 3D proof of concept: walk around a moving carrier, use computers (map and unit-camera screens are render-to-texture) to steer the ship and command Walrus/Manta units, defend the deck from drones. 1-2 players, gamepad split-screen."}
// Harrison's Command — a one-level Carrier Command 2 homage. Crowelian 2026 + Sonnet.
// Reused: Kenney Starter Kits (FPS/City/Racing/Platformer, MIT) for blaster/drones/buildings/trees/character; Starter-Kit-FPS player.gd movement constants;
// Warzone 2100 weapon/structure stats (wz-stats.json); nordrep's split-screen layout (hc/split.js). Generated: carrier/Walrus/Manta/tower/islands (tools/gen_harrison_models.mjs).
import { NordScript } from 'nord';
import { Sim, buildLevel, STERN } from './hc/sim.js';
import { layout } from './hc/split.js';
import { ISLANDS, STATIONS, SPAWNS, walkable, groundAt, islandHeight } from './hc/layout.js';

const A = (p) => `assets/${p}`;
const M = A('models/'), K = A('models/kenney/');
const MODELS = { carrier: M + 'carrier.glb', walrus: M + 'walrus.glb', manta: M + 'manta.glb', tower: M + 'tower.glb', mortar: M + 'mortar.glb', alpha: M + 'island_alpha.glb', beta: M + 'island_beta.glb', gamma: M + 'island_gamma.glb',
  blaster: K + 'fps/blaster-repeater.glb', drone: K + 'fps/enemy-flying.glb', hqA: K + 'city/building-small-c.glb', bldB: K + 'city/building-small-a.glb', bldC: K + 'city/building-small-d.glb', garage: K + 'city/building-garage.glb', trees: K + 'city/grass-trees.glb', treesTall: K + 'city/grass-trees-tall.glb',
  truckG: K + 'racing/vehicle-truck-green.glb', truckY: K + 'racing/vehicle-truck-yellow.glb', person: K + 'platformer/character.glb' };
const TEX = { deck: A('textures/deck.png'), hull: A('textures/hull.png'), wall: A('textures/wall.png'), floor: A('textures/floor.png'), water: A('textures/water.png'), icons: A('ui/map-icons.png') };
const SND = (n) => A(`audio/sfx/${n}.wav`), KSND = (n) => A(`audio/kenney/${n}.ogg`);
const SCREEN_BIT = 0x08000000, MAP_BIT = 0x10000000, BODY_BIT = [0x20000000, 0x40000000], ALL = 0x0fffffff;
const MAP = { cx: 0, cz: 300, size: 900 }; // map window (world metres)
const ICON = ['carrier', 'walrus', 'manta', 'tower', 'hq', 'waypoint', 'cursor', 'select', 'drone', 'mortar'];
const PAD_DEAD = 0.18, EYE = 1.65;
const lerp = (a, b, t) => a + (b - a) * t;
const angDiff = (a, b) => { let d = (b - a) % (Math.PI * 2); if (d > Math.PI) d -= Math.PI * 2; if (d < -Math.PI) d += Math.PI * 2; return d; };
const dead = (v) => (Math.abs(v) < PAD_DEAD ? 0 : (v - Math.sign(v) * PAD_DEAD) / (1 - PAD_DEAD));

export default class Harrison extends NordScript {
  static attributes = {
    players: { type: 'int', default: 1, min: 1, max: 2, label: 'Players (a 2nd gamepad player joins automatically; ?players=2 forces split-screen)' },
    splitMode: { type: 'enum', options: ['topBottom', 'leftRight'], default: 'topBottom' },
  };
  start() { this.ready = false; this.boot().catch((e) => this.game.reportError(e, this, 'boot')); }

  // ===== boot ===============================================================================================================
  async boot() {
    const g = this.game, be = g.backend, B = this.B = be.B, scene = this.sc = be.scene, canvas = this.canvas = be.canvas;
    await be.preload(Object.values(MODELS));
    this.wz = await g.loader.json('scripts/hc/wz-stats.json');
    let seed = Number(new URLSearchParams(location.search).get('seed')) || (Math.random() * 1e9) | 0;
    this.rnd = () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
    this.sim = new Sim(this.wz, this.rnd); buildLevel(this.sim);
    this.clearCol = new B.Color4(0.62, 0.78, 0.92, 1); scene.clearColor = this.clearCol;
    scene.fogMode = B.Scene.FOGMODE_EXP2; scene.fogDensity = 0.0009; scene.fogColor = new B.Color3(0.66, 0.8, 0.92);
    const hemi = new B.HemisphericLight('hemi', new B.Vector3(0, 1, 0), scene); hemi.intensity = 0.75; hemi.groundColor = new B.Color3(0.25, 0.3, 0.38);
    const sun = new B.DirectionalLight('sun', new B.Vector3(-0.45, -1, 0.35), scene); sun.intensity = 1.0; sun.specular = new B.Color3(0.2, 0.2, 0.2);
    // crisp pixel textures: one set for standard UVs (sea, icons) and one for glTF meshes (no Y flip)
    const px = (p, flip) => new B.Texture(g.loader.url(p), scene, false, flip, B.Texture.NEAREST_LINEAR_MIPLINEAR); // blocky when close, smooth (mip-mapped) at a distance
    this.tex = {}; this.texG = {}; for (const [k, p] of Object.entries(TEX)) { this.tex[k] = px(p, true); this.texG[k] = px(p, false); }
    this.buildSea(); this.buildIslands(); this.buildShip(); this.buildActors(); this.buildScreens(); this.buildFx(); this.buildPlayers(); this.buildHud();
    this.keys = new Set(); this.mouse = { dx: 0, dy: 0, left: false, right: false }; this.bindInput();
    g.audio.music('assets/audio/music/music_action.mp3', { volume: 0.14 });
    this.toastQ = []; this.t = 0; this.screenT = 0; window.__hc = this; this.ready = true;
    this.toast('CARRIER HARRISON ONLINE - USE THE COMPUTERS IN THE COMMAND CENTRE. DESTROY THE ENEMY HQ ON GAMMA ISLE.', 8);
  }
  onDestroy() { for (const [t, f] of this.listeners ?? []) window.removeEventListener(t, f); this.hudRoot?.remove(); if (document.pointerLockElement === this.canvas) document.exitPointerLock(); delete window.__hc; }

  // ===== helpers ============================================================================================================
  inst(key, name) {
    const c = this.game.backend.models.get(MODELS[key]), r = c.instantiateModelsToScene((n) => `${name}.${n}`, false), root = new this.B.TransformNode(name, this.sc);
    for (const n of r.rootNodes) n.parent = root; for (const m of root.getChildMeshes()) { m.isPickable = false; } return root;
  }
  fit(root, height) { const b = root.getHierarchyBoundingVectors(true), h = b.max.y - b.min.y || 1; root.scaling.scaleInPlace(height / h); root.computeWorldMatrix(true); const b2 = root.getHierarchyBoundingVectors(true); root.position.y -= b2.min.y; }
  part(root, key) { return root.getChildTransformNodes(false, (n) => n.name.toLowerCase().endsWith(key))[0]; }
  setMask(root, mask) { for (const m of root.getChildMeshes()) m.layerMask = mask; }
  emissive(name, hex, alpha = 1) { const m = new this.B.StandardMaterial(name, this.sc); m.disableLighting = true; m.emissiveColor = this.B.Color3.FromHexString(hex); m.alpha = alpha; m.backFaceCulling = false; return m; }

  buildSea() {
    const B = this.B, sea = B.MeshBuilder.CreateGround('sea', { width: 8000, height: 8000 }, this.sc), m = new B.StandardMaterial('sea', this.sc);
    this.tex.water.uScale = this.tex.water.vScale = 8000 / 16; m.diffuseTexture = this.tex.water; m.emissiveTexture = this.tex.water; m.emissiveColor = new B.Color3(0.25, 0.3, 0.35); m.specularColor = new B.Color3(0.15, 0.2, 0.25); sea.material = m; sea.isPickable = false; this.sea = sea;
  }
  buildIslands() {
    const B = this.B; this.islands = [];
    for (const isl of ISLANDS) {
      const root = this.inst(isl.id, `island_${isl.id}`); root.position.set(isl.x, 0, isl.z);
      for (const mesh of root.getChildMeshes()) { const mat = mesh.material; if (mat) { mat.albedoColor = new B.Color3(1, 1, 1); mat.roughness = 1; mat.metallic = 0; } mesh.layerMask = ALL | MAP_BIT; }
      this.islands.push(root);
      // Kenney trees scattered on the slopes (deterministic from the island seed)
      let s = isl.seed * 7919; const r = () => ((s = (s * 16807) % 2147483647) / 2147483647);
      for (let i = 0; i < 46; i++) { const x = isl.x + (r() - 0.5) * isl.r * 2, z = isl.z + (r() - 0.5) * isl.r * 2, h = islandHeight(isl, x, z); if (h < 1.8 || h > isl.peak * 0.6) continue; const t = this.inst(r() < 0.4 ? 'treesTall' : 'trees', `tree_${isl.id}_${i}`); this.fit(t, 5 + r() * 3); t.position.set(x, h - 0.2, z); t.rotation.y = r() * 6.28; t.layerMask = ALL; }
    }
  }
  buildShip() {
    const B = this.B, ship = this.shipRoot = new B.TransformNode('ship', this.sc);
    const carrier = this.inst('carrier', 'carrier'); carrier.parent = ship; this.carrier = carrier;
    const ml = this.game.backend.models.get(MODELS.carrier);
    for (const mat of ml.materials) {
      const t = this.texG[mat.name]; if (t) { mat.albedoTexture = t; mat.albedoColor = new B.Color3(1, 1, 1); }
      mat.metallic = 0; mat.roughness = 0.9; if (mat.name === 'glass') { mat.alpha = 0.35; mat.transparencyMode = 2; }
    }
    for (const m of carrier.getChildMeshes()) m.layerMask = ALL | MAP_BIT;
    // deck dressing from the Racing/Platformer kits: parked trucks
    for (const [k, x, z, yaw] of [['truckG', -6.5, 30, 0.1], ['truckY', 5.5, 36, -0.15]]) { const t = this.inst(k, `deck_${k}`); this.fit(t, 2.4); t.parent = ship; t.position.set(x, 0, z); t.rotation.y = yaw; t.layerMask = ALL; }
  }
  buildActors() {
    const B = this.B, sim = this.sim; this.vis = new Map();
    this.hqComplex = [];
    for (const s of sim.structs) {
      let root;
      if (s.type === 'hq') { root = this.inst('hqA', 'hq'); this.fit(root, 15); root.rotation.y = 0.5; const g = ISLANDS[2]; [['bldB', 24, -12, 8], ['bldC', -26, 4, 9], ['garage', 8, -30, 6], ['bldB', -14, 30, 7]].forEach(([k, dx, dz, h], i) => { const b = this.inst(k, `base_${i}`); this.fit(b, h); b.position.set(s.x + dx, groundAt(s.x + dx, s.z + dz) - 0.1, s.z + dz); b.rotation.y = i * 1.2; this.hqComplex.push(b); }); }
      else { root = this.inst(s.type, `${s.type}_${s.id}`); root.scaling.scaleInPlace(1.1); }
      root.position.set(s.x, s.y - 0.1, s.z); this.setMask(root, ALL); this.vis.set(s.id, { root, head: this.part(root, 'head'), dead: false });
    }
    for (const u of sim.units) { const root = this.inst(u.type, u.label); root.parent = this.shipRoot; this.setMask(root, ALL | MAP_BIT); this.vis.set(u.id, { root, turret: this.part(root, 'turret'), docked: true }); }
    this.droneVis = new Map();
  }

  // ===== screens: render-to-texture =========================================================================================
  buildScreens() {
    const B = this.B, sc = this.sc;
    // minimap: an orthographic top-down camera → RenderTargetTexture, shown on the NAVIGATION and UNIT COMMAND consoles
    const half = MAP.size / 2, mc = this.mapCam = new B.FreeCamera('mapCam', new B.Vector3(MAP.cx, 800, MAP.cz), sc);
    mc.rotation = new B.Vector3(Math.PI / 2, 0, 0); mc.mode = B.Camera.ORTHOGRAPHIC_CAMERA; mc.orthoLeft = -half; mc.orthoRight = half; mc.orthoTop = half; mc.orthoBottom = -half; mc.minZ = 1; mc.maxZ = 2000; mc.layerMask = ALL | MAP_BIT;
    const rtt = this.mapRtt = new B.RenderTargetTexture('map', 512, sc, { generateMipMaps: false, generateDepthBuffer: true }); rtt.activeCamera = mc; rtt.clearColor = new B.Color4(0.07, 0.2, 0.34, 1); rtt.refreshRate = 2; rtt.renderList = [];
    rtt.onBeforeRenderObservable.add(() => { sc.fogEnabled = false; }); rtt.onAfterRenderObservable.add(() => { sc.fogEnabled = true; });
    sc.customRenderTargets.push(rtt); this.mapIslandsAdded = false;
    // unit camera feed
    const fc = this.feedCam = new B.FreeCamera('feedCam', new B.Vector3(0, 30, -50), sc); fc.minZ = 0.5; fc.maxZ = 1800; fc.fov = 1.0;
    const frt = this.feedRtt = new B.RenderTargetTexture('feed', 384, sc, { generateMipMaps: false, generateDepthBuffer: true }); fc.layerMask = ALL & ~SCREEN_BIT; frt.activeCamera = fc; frt.refreshRate = 2; frt.clearColor = this.clearCol; frt.renderList = sc.meshes; // everything (not just what the players' cameras see), but not the monitors themselves
    frt.onBeforeRenderObservable.add(() => { this.feedBusy = true; }); frt.onAfterRenderObservable.add(() => { this.feedBusy = false; });
    sc.customRenderTargets.push(frt);
    // ship status: a 2D canvas texture
    this.statusTex = new B.DynamicTexture('status', { width: 512, height: 288 }, sc, false);
    const screens = { nav: rtt, command: rtt, feed: frt, status: this.statusTex }; this.screens = {};
    for (const [k, st] of Object.entries(STATIONS)) {
      const s = st.screen, p = B.MeshBuilder.CreatePlane(`screen_${k}`, { width: s.w, height: s.h }, sc), mat = new B.StandardMaterial(`screen_${k}`, sc);
      mat.disableLighting = true; mat.emissiveTexture = screens[k]; mat.backFaceCulling = true; p.material = mat; p.parent = this.shipRoot; p.position.set(s.c[0] + s.n[0] * 0.02, s.c[1], s.c[2] + s.n[2] * 0.02);
      p.rotation.y = Math.atan2(-s.n[0], -s.n[2]); p.isPickable = false; p.layerMask = SCREEN_BIT; this.screens[k] = p;
    }
    // map markers (flat icon planes seen only by the map camera)
    this.iconMats = ICON.map((n, i) => { const m = new B.StandardMaterial(`ico_${n}`, sc), t = this.tex.icons.clone(); t.uScale = 1 / ICON.length; t.uOffset = i / ICON.length; t.hasAlpha = true; m.emissiveTexture = t; m.opacityTexture = t; m.disableLighting = true; m.backFaceCulling = false; m.diffuseColor = B.Color3.Black(); return m; });
    this.markers = new Map(); this.mapCursor = [];
  }
  marker(key, icon, size = 26, tint = null) {
    let m = this.markers.get(key); if (m) return m;
    const B = this.B; m = B.MeshBuilder.CreatePlane(`mk_${key}`, { size }, this.sc); m.rotation.x = Math.PI / 2; m.layerMask = MAP_BIT; m.isPickable = false; m.material = tint ? Object.assign(this.iconMats[ICON.indexOf(icon)].clone(`mk_${key}`), { emissiveColor: B.Color3.FromHexString(tint) }) : this.iconMats[ICON.indexOf(icon)];
    this.mapRtt.renderList.push(m); this.markers.set(key, m); return m;
  }
  updateMarkers() {
    const sim = this.sim, set = (key, icon, x, z, yaw = 0, size = 26, y = 400, tint = null, on = true) => { const m = this.marker(key, icon, size, tint); m.setEnabled(on); m.position.set(x, y, z); m.rotation.y = -yaw; };
    if (!this.mapIslandsAdded) { for (const n of this.islands) for (const m of n.getChildMeshes()) this.mapRtt.renderList.push(m); for (const m of this.carrier.getChildMeshes()) this.mapRtt.renderList.push(m); this.mapIslandsAdded = true; }
    set('ship', 'carrier', sim.ship.x, sim.ship.z, sim.ship.yaw, 46, 420);
    set('wp', 'waypoint', sim.ship.target?.x ?? 0, sim.ship.target?.z ?? 0, 0, 22, 410, null, !!sim.ship.target);
    for (const u of sim.units) set(`u${u.id}`, u.type, u.x, u.z, u.yaw, u.type === 'walrus' ? 20 : 24, 430, null, u.state !== 'docked' && u.state !== 'dead');
    for (const s of sim.structs) set(`s${s.id}`, s.type === 'hq' ? 'hq' : s.type === 'mortar' ? 'mortar' : 'tower', s.x, s.z, 0, s.type === 'hq' ? 36 : 22, 415, null, s.hp > 0);
    const live = new Set(sim.drones.map((d) => `d${d.id}`)); for (let i = 0; i < sim.drones.length; i++) { const d = sim.drones[i]; set(`d${d.id}`, 'drone', d.x, d.z, d.yaw, 16, 440); }
    for (const [k, m] of this.markers) if (k[0] === 'd' && !live.has(k)) m.setEnabled(false);
    this.players.forEach((p, i) => { const sel = p.sel != null ? sim.units.find((u) => u.id === p.sel) : null; set(`sel${i}`, 'select', sel?.x ?? 0, sel?.z ?? 0, 0, 34, 445, i ? '#ff9a3c' : '#58d27a', !!sel && sel.state !== 'docked' && sel.state !== 'dead'); set(`cur${i}`, 'cursor', p.cx, p.cz, 0, 30, 450, i ? '#ff9a3c' : '#ffffff', p.mode === 'console' && (p.station === 'nav' || p.station === 'command')); });
  }
  drawStatus() {
    const sim = this.sim, ctx = this.statusTex.getContext(), S = sim.ship; ctx.fillStyle = '#0a1620'; ctx.fillRect(0, 0, 512, 288);
    ctx.fillStyle = '#7fe3ff'; ctx.font = 'bold 22px monospace'; ctx.fillText('CARRIER HARRISON - STATUS', 16, 30);
    const bar = (x, y, w, f, c) => { ctx.fillStyle = '#1b2d3a'; ctx.fillRect(x, y, w, 12); ctx.fillStyle = c; ctx.fillRect(x, y, w * Math.max(0, Math.min(1, f)), 12); };
    ctx.font = '18px monospace'; ctx.fillStyle = '#d6f2ff'; ctx.fillText(`HULL ${Math.round(S.hp / S.max * 100)}%`, 16, 62); bar(130, 50, 360, S.hp / S.max, S.hp / S.max > 0.4 ? '#58d27a' : '#e0503a');
    const hdg = ((S.yaw * 180 / Math.PI) % 360 + 360) % 360; ctx.fillText(`SPEED ${S.speed.toFixed(1)} M/S   HDG ${hdg.toFixed(0)}`, 16, 90);
    const wp = S.target ? `COURSE ${Math.hypot(S.target.x - S.x, S.target.z - S.z).toFixed(0)} M TO GO` : S.grounded ? 'GROUNDED - NEW COURSE NEEDED' : 'HOLDING POSITION'; ctx.fillStyle = S.grounded ? '#ff9a6a' : '#d6f2ff'; ctx.fillText(wp, 16, 116);
    ctx.fillStyle = '#7fe3ff'; ctx.fillText('UNITS', 16, 148); ctx.font = '15px monospace';
    sim.units.forEach((u, i) => { const x = 16 + (i % 2) * 250, y = 172 + Math.floor(i / 2) * 24; ctx.fillStyle = u.state === 'dead' ? '#e0503a' : '#d6f2ff'; ctx.fillText(`${u.label.padEnd(9)}${u.state.slice(0, 5).toUpperCase().padEnd(6)}${String(Math.round(u.hp)).padStart(3)}`, x, y); });
    const hq = sim.structs.find((s) => s.type === 'hq'); ctx.font = '18px monospace'; ctx.fillStyle = '#ffd24a'; ctx.fillText(`ENEMY HQ ${Math.round(hq.hp / hq.max * 100)}%   HOSTILES ${sim.structs.filter((s) => s.hp > 0).length}`, 16, 262);
    this.statusTex.update();
  }

  // ===== effects ============================================================================================================
  buildFx() {
    const B = this.B; this.fx = []; this.mats = { mg: this.emissive('fxMg', '#ffe27a'), cannon: this.emissive('fxCannon', '#ff9a3c'), rocket: this.emissive('fxRocket', '#ffffff'), drone: this.emissive('fxDrone', '#ff5a4a'), mortar: this.emissive('fxMortar', '#ffb060'), me: this.emissive('fxMe', '#8fe8ff'), boom: this.emissive('fxBoom', '#ff8a3a', 0.85), splash: this.emissive('fxSplash', '#e8f6ff', 0.6) };
    this.boomMesh = B.MeshBuilder.CreateSphere('boomProto', { diameter: 1, segments: 6 }, this.sc); this.boomMesh.setEnabled(false);
  }
  tracer(from, to, mat, w = 0.12, life = 0.12) {
    const B = this.B, d = to.subtract(from), len = Math.max(0.1, d.length()), m = B.MeshBuilder.CreateBox('tr', { width: w, height: w, depth: len }, this.sc);
    m.position = from.add(to).scale(0.5); m.lookAt(to); m.material = mat; m.isPickable = false; m.layerMask = ALL; this.fx.push({ m, t: life, life }); return m;
  }
  boom(x, y, z, size = 6, mat = this.mats.boom) { const m = this.boomMesh.clone('boom'); m.setEnabled(true); m.position.set(x, y, z); m.material = mat.clone('b'); m.isPickable = false; m.layerMask = ALL; this.fx.push({ m, t: 0.7, life: 0.7, grow: size }); }
  sfxAt(name, x, z, vol = 0.5, rate = 1, ogg = false) { const p = this.players?.[0], cam = this.players?.[0]?.cam; const c = cam?.globalPosition ?? { x: 0, z: 0 }; const d = Math.hypot((x ?? c.x) - c.x, (z ?? c.z) - c.z); const v = vol / (1 + d / 60); if (v > 0.02) this.game.audio.play(ogg ? KSND(name) : SND(name), { volume: v, rate }); }
  handleEvents() {
    const B = this.B;
    for (const e of this.sim.drain()) {
      if (e.type === 'shot') { const f = new B.Vector3(e.from.x, e.from.y, e.from.z), t = new B.Vector3(e.to.x, e.to.y, e.to.z);
        if (e.kind === 'mortar') { this.lobs ??= []; this.lobs.push({ f, t, k: 0, dur: 2.2, mesh: this.tracer(f, f.add(new B.Vector3(0, 0.3, 0)), this.mats.mortar, 0.7, 4) }); this.sfxAt('missile', e.from.x, e.from.z, 0.5, 0.6); }
        else if (e.kind === 'cannon') { this.tracer(f, t, this.mats.cannon, 0.35, 0.18); this.sfxAt('explosion_small', e.from.x, e.from.z, 0.5, 1.2); this.boom(t.x, t.y, t.z, 3); }
        else if (e.kind === 'rocket') { this.tracer(f, t, this.mats.rocket, 0.25, 0.3); this.sfxAt('missile', e.from.x, e.from.z, 0.4); this.boom(t.x, t.y, t.z, 2); }
        else { this.tracer(f, t, e.kind === 'drone' ? this.mats.drone : this.mats.mg, 0.14, 0.12); this.sfxAt(e.kind === 'drone' ? 'enemy_attack' : 'shoot', e.from.x, e.from.z, 0.25, 1, e.kind === 'drone'); } }
      else if (e.type === 'boom') { this.boom(e.x, (e.y ?? 0) + 3, e.z, e.big ? 14 : 8); this.sfxAt('explosion', e.x, e.z, 0.7); if (e.kind === 'struct') this.toast('ENEMY INSTALLATION DESTROYED', 4); if (e.kind === 'drone') this.sfxAt('enemy_destroy', e.x, e.z, 0.5, 1, true); const v = this.vis.get(e.id); if (v && e.kind === 'struct') { v.dead = true; for (const m of v.root.getChildMeshes()) m.visibility = 0.4; v.root.scaling.y *= 0.4; } if (e.kind === 'unit') this.toast('UNIT LOST', 4); }
      else if (e.type === 'shipHit') { this.sfxAt('hit', null, null, 0.5, 0.7); this.players.forEach((p) => { p.shake = 0.35; }); }
      else if (e.type === 'wave') this.toast(`WARNING: ENEMY DRONES INBOUND (WAVE ${e.n}) - SHOOT THEM FROM THE DECK`, 6);
      else if (e.type === 'splash') { this.boom(e.x, 1, e.z, 5, this.mats.splash); this.sfxAt('splash', e.x, e.z, 0.5); }
      else if (e.type === 'launch') this.sfxAt('whoosh', null, null, 0.5);
      else if (e.type === 'docked') { this.toast('UNIT RECOVERED - REPAIRING', 3); }
      else if (e.type === 'win') { this.endMsg('ENEMY HQ DESTROYED - CARRIER HARRISON VICTORIOUS', '#7dff8f'); this.game.audio.play(A('audio/music/jingle_victory.mp3'), { volume: 0.5 }); }
      else if (e.type === 'lose') { this.endMsg('CARRIER HARRISON LOST', '#ff7a6a'); this.sfxAt('lose', null, null, 0.6); }
    }
  }

  // ===== players ===========================================================================================================
  buildPlayers() {
    const B = this.B, sc = this.sc; this.players = []; this.listeners = [];
    const want = Math.max(this.attrs.players, new URLSearchParams(location.search).get('players') === '2' ? 2 : 1);
    for (let i = 0; i < 2; i++) {
      const cam = new B.FreeCamera(`cam${i}`, B.Vector3.Zero(), sc), pivot = new B.TransformNode(`eye${i}`, sc); pivot.parent = this.shipRoot; cam.parent = pivot; cam.fov = 1.15; cam.minZ = 0.05; cam.maxZ = 2600; cam.layerMask = ALL | BODY_BIT[1 - i];
      const body = this.inst('person', `person${i}`); this.fit(body, 1.75); body.parent = this.shipRoot; this.setMask(body, BODY_BIT[i]); for (const m of body.getChildMeshes()) { if (!m.material) continue; m.material = m.material.clone(`pm${i}`); m.material.albedoColor = i ? new B.Color3(1, 0.62, 0.3) : new B.Color3(0.5, 0.75, 1); }
      const gun = this.inst('blaster', `gun${i}`); this.fit(gun, 0.075); gun.parent = cam; gun.position.set(0.17, -0.17, 0.4); this.setMask(gun, ALL);
      const [sx, sz] = SPAWNS[i];
      this.players.push({ i, cam, pivot, body, gun, x: sx, z: sz, y: 0, vy: 0, yaw: i ? 0.2 : -0.2, pitch: 0, eyeX: sx, eyeY: EYE, eyeZ: sz, eyeYaw: 0, mode: 'walk', station: null, cx: 0, cz: 300, sel: null, cd: 0, active: i === 0 || want === 2, joined: i === 0 || want === 2, shake: 0, flash: 0, near: null, pad: null, edge: {}, kills: 0 });
    }
    this.layoutOpts = { two: this.attrs.splitMode };
    this.applyLayout();
  }
  applyLayout() {
    const act = [this.players[0].active, this.players[1].active, false, false], L = layout(act, this.layoutOpts);
    this.sc.activeCameras = []; this.players.forEach((p, i) => { const r = L[i]; p.rect = r; p.body.setEnabled(p.active); p.gun.setEnabled(p.active); if (r) { p.cam.viewport = new this.B.Viewport(r.x, 1 - r.y - r.h, r.w, r.h); this.sc.activeCameras.push(p.cam); } });
    this.sc.activeCamera = this.players[0].cam; this.hudLayout?.();
  }

  // ===== input ==============================================================================================================
  bindInput() {
    const on = (t, f, o) => { window.addEventListener(t, f, o); this.listeners.push([t, f]); };
    on('keydown', (e) => { if (!this.ready) return; if (['Space', 'Tab', 'ArrowUp', 'ArrowDown'].includes(e.code)) e.preventDefault(); if (!e.repeat) this.keys.add(e.code), this.keyPressed(e.code); });
    on('keyup', (e) => this.keys.delete(e.code));
    on('mousemove', (e) => { if (document.pointerLockElement === this.canvas) { this.mouse.dx += e.movementX; this.mouse.dy += e.movementY; } });
    on('mousedown', (e) => { if (document.pointerLockElement !== this.canvas) { this.canvas.requestPointerLock?.(); return; } if (e.button === 0) { this.mouse.left = true; this.mouse.leftEdge = true; } if (e.button === 2) this.mouse.rightEdge = true; });
    on('mouseup', (e) => { if (e.button === 0) this.mouse.left = false; });
    on('contextmenu', (e) => e.preventDefault());
    on('gamepadconnected', () => this.joinPad());
  }
  keyPressed(code) { const p = this.players[0]; if (code === 'KeyE') p.edge.use = true; else if (code === 'Escape') p.edge.back = true; else if (code === 'Tab') p.edge.next = true; else if (code === 'KeyR') p.edge.recall = true; else if (code === 'KeyX') p.edge.stop = true; else if (code === 'Space') p.edge.jump = true; else if (code === 'KeyF') this.players[0].edge.restart = true; }
  joinPad() { const p = this.players[1]; if (!p.active) { p.active = true; p.joined = true; this.applyLayout(); this.toast('PLAYER 2 JOINED (GAMEPAD)', 4); } }
  /** One frame of intent per player: { mx, mz (move), lx, ly (look), fire, edge:{use,back,next,recall,stop,jump,confirm} } */
  readInput(p, dt) {
    const k = this.keys, i = { mx: 0, mz: 0, lx: 0, ly: 0, fire: false, edge: p.edge };
    if (p.i === 0) {
      i.mx = (k.has('KeyD') ? 1 : 0) - (k.has('KeyA') ? 1 : 0); i.mz = (k.has('KeyW') ? 1 : 0) - (k.has('KeyS') ? 1 : 0); i.lx = this.mouse.dx / 700; i.ly = this.mouse.dy / 700; this.mouse.dx = this.mouse.dy = 0; // Starter-Kit-FPS mouse_sensitivity = 700
      i.lx += ((k.has('ArrowRight') ? 1 : 0) - (k.has('ArrowLeft') ? 1 : 0)) * 1.6 * dt; i.ly += ((k.has('ArrowDown') ? 1 : 0) - (k.has('ArrowUp') ? 1 : 0)) * 1.2 * dt;
      i.fire = this.mouse.left || k.has('KeyG'); if (this.mouse.leftEdge) { i.edge.confirm = true; this.mouse.leftEdge = false; } if (this.mouse.rightEdge) { i.edge.back = true; this.mouse.rightEdge = false; }
      if (document.pointerLockElement !== this.canvas && !this.noLockHint) { /* hint shown in HUD */ }
    } else {
      const pad = [...(navigator.getGamepads?.() ?? [])].filter(Boolean)[0]; if (!pad) return i;
      if (!p.active && pad.buttons.some((b) => b.pressed)) this.joinPad();
      const B = (n) => !!pad.buttons[n]?.pressed, ax = (n) => dead(pad.axes[n] ?? 0), prev = p.padPrev ?? [];
      i.mx = ax(0); i.mz = -ax(1); i.lx = ax(2) * 2.6 * dt * 1.0; i.ly = ax(3) * 2.0 * dt; i.fire = B(7) || B(5) || (pad.buttons[7]?.value ?? 0) > 0.4; // gamepad_sensitivity in Starter-Kit-FPS ≈ 0.075 rad/frame at 60 Hz
      const edge = (n, name) => { if (B(n) && !prev[n]) i.edge[name] = true; }; edge(0, 'use'); edge(0, 'confirm'); edge(1, 'back'); edge(2, 'recall'); edge(3, 'next'); edge(4, 'jump'); edge(9, 'stop'); p.padPrev = pad.buttons.map((b) => b.pressed);
    }
    return i;
  }

  // ===== per-frame ==========================================================================================================
  update(dt) {
    if (!this.ready) return; dt = Math.min(dt, 0.25); this.t += dt;
    const sim = this.sim; for (let rem = dt; rem > 1e-6;) { const h = Math.min(rem, 0.05); sim.update(h); rem -= h; } this.handleEvents(); // fixed 50 ms sim steps even when the frame rate dips
    for (const p of this.players) { if (p.i === 1 && !p.active) { this.readInput(p, dt); continue; } if (!p.active) continue; const inp = this.readInput(p, dt); this.updatePlayer(p, inp, dt); p.edge = {}; }
    this.syncShip(dt); this.syncActors(dt); this.updateFx(dt); this.updateMarkers();
    this.screenT -= dt; if (this.screenT <= 0) { this.screenT = 0.25; this.drawStatus(); }
    this.tex.water.uOffset = (this.tex.water.uOffset + dt * 0.004) % 1; this.tex.water.vOffset = (this.tex.water.vOffset + dt * 0.002) % 1;
    this.updateFeedCam(); this.updateHud(dt);
  }
  syncShip(dt) {
    const s = this.sim.ship, r = this.shipRoot; r.position.set(s.x, 3, s.z); r.rotation.y = s.yaw; r.rotation.z = Math.sin(this.t * 0.5) * 0.004 + (s.speed ? 0.002 * s.speed : 0); r.rotation.x = Math.sin(this.t * 0.37 + 1) * 0.003;
  }
  updatePlayer(p, inp, dt) {
    const B = this.B, e = inp.edge;
    if (this.sim.won || this.sim.lost) { if (e.restart || e.use || e.confirm) location.reload(); }
    // --- look
    if (p.mode === 'walk') { p.yaw += inp.lx; p.pitch = Math.max(-1.45, Math.min(1.45, p.pitch + inp.ly)); }
    // --- console cursor / actions
    if (p.mode === 'console') this.updateConsole(p, inp, dt);
    else {
      // --- walking: Starter-Kit-FPS constants (speed 5, gravity 20, jump)
      const sp = 5, f = [Math.sin(p.yaw), Math.cos(p.yaw)], r = [Math.cos(p.yaw), -Math.sin(p.yaw)], len = Math.hypot(inp.mx, inp.mz) || 1, mx = (inp.mx / Math.max(1, len)) * sp, mz = (inp.mz / Math.max(1, len)) * sp;
      const vx = (r[0] * mx + f[0] * mz) * dt, vz = (r[1] * mx + f[1] * mz) * dt;
      if (walkable(p.x + vx, p.z)) p.x += vx; if (walkable(p.x, p.z + vz)) p.z += vz;
      p.vy -= 20 * dt; p.y += p.vy * dt; if (p.y <= 0) { p.y = 0; p.vy = 0; if (e.jump) p.vy = 6.5; }
      // nearest console
      p.near = null; let bd = 1e9; for (const [k, s] of Object.entries(STATIONS)) { const d = Math.hypot(p.x - s.stand[0], p.z - s.stand[1]); if (d < s.radius && d < bd) { bd = d; p.near = k; } }
      if (e.use && p.near) this.enterConsole(p, p.near);
      // weapon
      p.cd -= dt; if (inp.fire && p.cd <= 0) this.fireGun(p);
    }
    if (p.mode === 'console' && (e.back || (e.use && !p.consoleJustEntered))) this.exitConsole(p); p.consoleJustEntered = false;
    // --- apply transforms (body follows the player, eye follows body or console view)
    p.body.position.set(p.x, p.y, p.z); p.body.rotation.y = p.yaw + Math.PI * 0; p.body.setEnabled(p.active && p.mode === 'walk' || p.active);
    let tx = p.x, ty = p.y + EYE, tz = p.z, tyaw = p.yaw, tpitch = p.pitch;
    if (p.mode === 'console') { const st = STATIONS[p.station], v = st.view, c = st.screen.c, dx = c[0] - v[0], dz = c[2] - v[2]; tx = v[0]; ty = v[1]; tz = v[2]; tyaw = Math.atan2(dx, dz); tpitch = Math.atan2(v[1] - c[1], Math.hypot(dx, dz)); }
    const k = Math.min(1, dt * (p.mode === 'console' ? 6 : 40));
    p.eyeX = lerp(p.eyeX, tx, k); p.eyeY = lerp(p.eyeY, ty, k); p.eyeZ = lerp(p.eyeZ, tz, k); p.eyeYaw = p.eyeYaw + angDiff(p.eyeYaw, tyaw) * k; p.shake = Math.max(0, p.shake - dt);
    p.pivot.position.set(p.eyeX + (p.shake ? (Math.random() - 0.5) * p.shake * 0.2 : 0), p.eyeY + (p.shake ? (Math.random() - 0.5) * p.shake * 0.2 : 0), p.eyeZ); p.pivot.rotation.y = p.eyeYaw; p.cam.rotation.x = lerp(p.cam.rotation.x, tpitch, k);
    p.gun.setEnabled(p.mode === 'walk'); p.flash = Math.max(0, p.flash - dt); p.gun.position.z = 0.42 - p.flash * 0.6;
  }
  fireGun(p) {
    const B = this.B, cam = p.cam; p.cd = 0.16; p.flash = 0.08; this.game.audio.play(KSND('blaster_repeater'), { volume: 0.35, rate: 1 + Math.random() * 0.1 });
    const origin = cam.globalPosition.clone(), dir = cam.getForwardRay(1).direction.normalize(), ray = new B.Ray(origin, dir, 400);
    const hit = this.sc.pickWithRay(ray, (m) => m.metadata?.drone != null), end = hit?.hit ? hit.pickedPoint : origin.add(dir.scale(120));
    this.tracer(origin.add(dir.scale(0.7)).add(cam.getDirection(new B.Vector3(0.18, -0.15, 0))), end, this.mats.me, 0.05, 0.08);
    if (hit?.hit) { const d = this.sim.drones.find((q) => q.id === hit.pickedMesh.metadata.drone); if (d && d.hp > 0) { d.hp -= 10; this.boom(end.x, end.y, end.z, 1.2); this.sfxAt('hit', end.x, end.z, 0.3, 1.5); if (d.hp <= 0) { this.sim.kills++; p.kills++; this.sim.emit({ type: 'boom', x: d.x, y: d.y, z: d.z, big: false, kind: 'drone', id: d.id }); } } }
  }

  // ===== computers ==========================================================================================================
  enterConsole(p, name) { p.mode = 'console'; p.station = name; p.consoleJustEntered = true; if (name === 'nav' || name === 'command') { p.cx = this.sim.ship.x; p.cz = this.sim.ship.z + 120; } this.game.audio.play(SND('open'), { volume: 0.4 }); if (document.pointerLockElement !== this.canvas) this.canvas.requestPointerLock?.(); }
  exitConsole(p) { p.mode = 'walk'; p.station = null; this.game.audio.play(SND('close'), { volume: 0.4 }); }
  updateConsole(p, inp, dt) {
    const sim = this.sim, st = p.station, e = inp.edge, half = MAP.size / 2;
    if (st === 'nav' || st === 'command') {
      p.cx = Math.max(MAP.cx - half, Math.min(MAP.cx + half, p.cx + inp.lx * 520 + inp.mx * 380 * dt)); p.cz = Math.max(MAP.cz - half, Math.min(MAP.cz + half, p.cz - inp.ly * 520 + inp.mz * 380 * dt));
      if (st === 'nav') {
        if (e.confirm) { sim.setCourse(p.cx, p.cz); this.sfxAt('click', null, null, 0.5); this.toast(`COURSE SET`, 2); }
        if (e.stop) { sim.ship.target = null; this.toast('ALL STOP', 2); }
      } else {
        if (e.next || e.recall && false) { const live = sim.units.filter((u) => u.state !== 'dead'); const i = live.findIndex((u) => u.id === p.sel); p.sel = live[(i + 1) % live.length]?.id ?? null; this.sfxAt('click', null, null, 0.4); }
        const u = sim.units.find((q) => q.id === p.sel);
        if (e.recall && u) { sim.recall(u); this.toast(`${u.label} RETURNING`, 2); }
        if (e.confirm && u && u.state !== 'dead') {
          const tgt = sim.structs.filter((s) => s.hp > 0).map((s) => ({ s, d: Math.hypot(s.x - p.cx, s.z - p.cz) })).sort((a, b) => a.d - b.d)[0];
          if (tgt && tgt.d < 28 && (u.type === 'walrus' || u.type === 'manta')) { sim.orderAttack(u, tgt.s); this.toast(`${u.label} ATTACKING ${tgt.s.name}`, 3); } else { sim.orderMove(u, p.cx, p.cz); this.toast(`${u.label} MOVING`, 2); }
          this.sfxAt('click', null, null, 0.5);
        }
        if (e.stop && u) { u.order = null; this.toast(`${u.label} HOLD`, 2); }
      }
    } else if (st === 'feed') { if (e.next) { const live = sim.units.filter((u) => u.state !== 'dead' && u.state !== 'docked'); const i = live.findIndex((u) => u.id === this.feedUnit); this.feedUnit = live[(i + 1) % Math.max(1, live.length)]?.id ?? null; } }
  }
  updateFeedCam() {
    const sim = this.sim, fc = this.feedCam; let u = sim.units.find((q) => q.id === this.feedUnit && q.state === 'active');
    if (!u) { const p = this.players.find((q) => q.sel != null); u = sim.units.find((q) => q.id === p?.sel && q.state === 'active') ?? sim.units.find((q) => q.state === 'active'); }
    this.feedActive = !!u;
    if (u) { const bx = -Math.sin(u.yaw) * 14, bz = -Math.cos(u.yaw) * 14; fc.position.set(u.x + bx, (u.y ?? 0) + 8, u.z + bz); fc.setTarget(new this.B.Vector3(u.x, (u.y ?? 0) + 1, u.z)); }
    else { const s = sim.ship; fc.position.set(s.x + Math.sin(s.yaw) * 90, 40, s.z + Math.cos(s.yaw) * 90); fc.setTarget(new this.B.Vector3(s.x, 8, s.z)); }
  }

  // ===== actors / fx sync ===================================================================================================
  syncActors(dt) {
    const sim = this.sim, B = this.B;
    for (const u of sim.units) {
      const v = this.vis.get(u.id), root = v.root;
      if (u.state === 'docked') { if (root.parent !== this.shipRoot) { root.parent = this.shipRoot; } root.position.set(u.bay[0], u.type === 'manta' ? 1.4 : 0.1, u.bay[1]); root.rotation.set(0, 0, 0); root.setEnabled(true); }
      else if (u.state === 'dead') root.setEnabled(false);
      else { if (root.parent) root.parent = null; const gy = u.type === 'manta' ? u.y : Math.max(0.5, groundAt(u.x, u.z) + 0.3) + u.y; root.position.set(u.x, gy + (u.type === 'walrus' ? Math.sin(this.t * 2 + u.id) * 0.08 : 0), u.z); root.rotation.y = u.yaw; root.rotation.z = u.type === 'manta' ? Math.sin(this.t + u.id) * 0.1 : 0; root.setEnabled(true); }
      if (v.turret) v.turret.rotation.y = lerp(v.turret.rotation.y, angDiff(u.yaw, u.turretYaw ?? u.yaw), Math.min(1, dt * 6));
    }
    for (const s of sim.structs) { const v = this.vis.get(s.id); if (v.head && s.hp > 0) v.head.rotation.y = lerp(v.head.rotation.y, s.yaw, Math.min(1, dt * 4)); }
    // drones (Kenney enemy-flying)
    const live = new Set();
    for (const d of sim.drones) {
      live.add(d.id); let v = this.droneVis.get(d.id);
      if (!v) { const root = this.inst('drone', `drone${d.id}`); this.fit(root, 2.6); root.scaling.scaleInPlace(1.5); this.setMask(root, ALL); for (const m of root.getChildMeshes()) { m.isPickable = true; m.metadata = { drone: d.id }; } v = { root }; this.droneVis.set(d.id, v); }
      v.root.position.set(d.x, d.y + Math.sin(this.t * 3 + d.id) * 0.4, d.z); v.root.rotation.y = d.yaw;
    }
    for (const [id, v] of this.droneVis) if (!live.has(id)) { v.root.dispose(); this.droneVis.delete(id); }
  }
  updateFx(dt) {
    const B = this.B;
    for (let i = this.fx.length - 1; i >= 0; i--) { const f = this.fx[i]; f.t -= dt; const k = 1 - Math.max(0, f.t) / f.life; if (f.grow) { f.m.scaling.setAll(1 + k * f.grow); f.m.material.alpha = 0.85 * (1 - k); } if (f.t <= 0) { f.m.material?.name === 'b' && f.m.material.dispose(); f.m.dispose(); this.fx.splice(i, 1); } }
    for (let i = (this.lobs?.length ?? 0) - 1; i >= 0; i--) { const l = this.lobs[i]; l.k += dt / l.dur; const k = Math.min(1, l.k), p = B.Vector3.Lerp(l.f, l.t, k); p.y += Math.sin(k * Math.PI) * 45; l.mesh.position.copyFrom(p); l.mesh.scaling.setAll(1); if (k >= 1) { this.boom(l.t.x, l.t.y, l.t.z, 9); this.sfxAt('explosion', l.t.x, l.t.z, 0.6, 0.8); l.mesh.dispose(); this.lobs.splice(i, 1); } }
  }

  // ===== HUD (DOM overlays, one per viewport) =============================================================================
  buildHud() {
    const stage = this.canvas.parentElement, root = this.hudRoot = document.createElement('div'); root.style.cssText = 'position:absolute;inset:0;pointer-events:none;font:600 14px/1.35 ui-monospace,Menlo,Consolas,monospace;color:#e6f4ff;text-shadow:0 1px 2px #000,0 0 6px #000;overflow:hidden';
    stage.style.position = 'relative'; stage.appendChild(root); this.panels = [];
    for (let i = 0; i < 2; i++) {
      const d = document.createElement('div'); d.style.cssText = 'position:absolute;overflow:hidden'; d.innerHTML = '<div class="top" style="position:absolute;left:12px;top:8px;white-space:pre"></div><div class="cross" style="position:absolute;left:50%;top:50%;width:14px;height:14px;margin:-7px 0 0 -7px;border:2px solid rgba(255,255,255,.8);border-radius:50%;box-sizing:border-box"></div><div class="msg" style="position:absolute;left:0;right:0;top:16%;text-align:center;font-size:15px;white-space:pre-wrap;padding:0 12px"></div><div class="bot" style="position:absolute;left:12px;right:12px;bottom:10px;white-space:pre-wrap"></div>';
      root.appendChild(d); this.panels.push(d);
    }
    this.banner = document.createElement('div'); this.banner.style.cssText = 'position:absolute;left:0;right:0;top:36%;text-align:center;font-size:30px;display:none;background:rgba(0,0,0,.55);padding:18px'; root.appendChild(this.banner);
    this.hudLayout = () => { const W = this.canvas.clientWidth, H = this.canvas.clientHeight; this.players.forEach((p, i) => { const d = this.panels[i]; d.style.display = p.rect ? 'block' : 'none'; if (p.rect) Object.assign(d.style, { left: `${p.rect.x * 100}%`, top: `${p.rect.y * 100}%`, width: `${p.rect.w * 100}%`, height: `${p.rect.h * 100}%`, borderTop: p.i && this.layoutOpts.two === 'topBottom' ? '2px solid #0b1722' : '', borderLeft: p.i && this.layoutOpts.two === 'leftRight' ? '2px solid #0b1722' : '' }); }); void W; void H; };
    this.hudLayout(); window.addEventListener('resize', this.hudLayout); this.listeners.push(['resize', this.hudLayout]);
  }
  toast(text, sec = 4) { this.toasts ??= []; this.toasts.push({ text, t: sec }); }
  endMsg(text, color) { this.banner.style.display = 'block'; this.banner.style.color = color; this.banner.innerHTML = `${text}<div style="font-size:15px;margin-top:10px;color:#cde">PRESS E / A / CLICK TO PLAY AGAIN</div>`; this.players.forEach((p) => { p.mode = 'walk'; }); }
  updateHud(dt) {
    const sim = this.sim, S = sim.ship; if (this.toasts) for (const t of this.toasts) t.t -= dt; this.toasts = (this.toasts ?? []).filter((t) => t.t > 0);
    const msg = this.toasts.slice(-3).map((t) => t.text).join('\n'), hdg = Math.round((((S.yaw * 180) / Math.PI) % 360 + 360) % 360);
    const top = `HULL ${Math.round(S.hp / S.max * 100)}%  SPD ${S.speed.toFixed(1)}  HDG ${hdg}\nUNITS ${sim.units.filter((u) => u.state !== 'docked' && u.state !== 'dead').length}/${sim.units.length} DEPLOYED  ENEMY HQ ${Math.round(sim.structs.find((s) => s.type === 'hq').hp / 10)}%`;
    this.players.forEach((p, i) => {
      if (!p.active) return; const d = this.panels[i], q = (s) => d.querySelector(s), setHtml = (el, h) => { if (el.dataset.h !== h) { el.dataset.h = h; el.textContent = h; } };
      setHtml(q('.top'), `P${i + 1}  ${top}`); setHtml(q('.msg'), msg); q('.cross').style.display = p.mode === 'walk' ? 'block' : 'none';
      let bot = '';
      if (p.mode === 'walk') {
        const lock = i === 0 && document.pointerLockElement !== this.canvas ? 'CLICK THE GAME TO CAPTURE THE MOUSE  -  ' : '';
        bot = p.near ? `${i ? '[A]' : '[E]'} USE ${STATIONS[p.near].label}` : (i === 0 ? `${lock}WASD MOVE  MOUSE LOOK  CLICK/G FIRE  SPACE JUMP  E USE COMPUTER` : (this.hasPad() ? 'LEFT STICK MOVE  RIGHT STICK LOOK  RT FIRE  A USE COMPUTER' : 'PLAYER 2: CONNECT A GAMEPAD AND PRESS ANY BUTTON'));
      } else {
        const st = p.station, u = sim.units.find((q) => q.id === p.sel), k1 = i ? ['A', 'B', 'X', 'Y', 'START'] : ['CLICK', 'ESC', 'R', 'TAB', 'X'];
        if (st === 'nav') bot = `NAVIGATION  -  MOVE THE CURSOR ON THE MAP  ${k1[0]}: SET COURSE  ${k1[4]}: ALL STOP  ${k1[1]}/E: LEAVE`;
        else if (st === 'command') bot = `UNIT COMMAND  -  ${u ? `${u.label} ${u.state.toUpperCase()} HP ${Math.round(u.hp)}` : 'NO UNIT SELECTED'}\n${k1[3]}: NEXT UNIT  ${k1[0]}: MOVE (ON ENEMY = ATTACK)  ${k1[2]}: RECALL  ${k1[4]}: HOLD  ${k1[1]}/E: LEAVE`;
        else if (st === 'feed') bot = `UNIT CAMERA  -  ${this.feedActive ? 'LIVE' : 'NO UNIT DEPLOYED (SHOWING CARRIER)'}   ${k1[3]}: NEXT UNIT   ${k1[1]}/E: LEAVE`;
        else bot = `SHIP STATUS   ${k1[1]}/E: LEAVE`;
      }
      setHtml(q('.bot'), bot);
    });
  }
  hasPad() { return [...(navigator.getGamepads?.() ?? [])].some(Boolean); }
}
