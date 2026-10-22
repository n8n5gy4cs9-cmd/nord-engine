// 3D edit view (Babylon): orbit/fly camera, grid, picking, move/rotate/scale gizmos, snap, IPC sync, offscreen model thumbnails.
import { canvas, state, send, log } from './edit.js';

let B, engine, scene, camera, gizmoManager, gridMesh;
const nodes = new Map();       // entity id -> {node, entity}
const containers = new Map();  // model path -> Promise<AssetContainer|null>
const R = Math.PI / 180;
let buildToken = 0;
let rmb = false;
const keys = new Set();
let lastEmit = 0;

function loadScript(src) {
  return new Promise((res, rej) => {
    const s = document.createElement('script');
    s.src = src; s.onload = res; s.onerror = () => rej(new Error('failed to load ' + src));
    document.head.appendChild(s);
  });
}

export async function init() {
  await loadScript('/vendor/babylonjs/babylon.js');
  await loadScript('/vendor/babylonjs-loaders/babylonjs.loaders.min.js');
  await loadScript('/vendor/babylonjs-materials/babylonjs.materials.min.js');
  B = window.BABYLON;
  engine = new B.Engine(canvas, true, { preserveDrawingBuffer: true, stencil: true, antialias: true });
  scene = new B.Scene(engine);
  scene.clearColor = new B.Color4(0.105, 0.12, 0.15, 1);
  camera = new B.ArcRotateCamera('editcam', -Math.PI / 2.4, Math.PI / 3, 14, new B.Vector3(0, 1, 0), scene);
  camera.minZ = 0.05; camera.maxZ = 5000; camera.wheelPrecision = 20; camera.lowerRadiusLimit = 0.2;
  camera.attachControl(canvas, true);
  const p = camera.inputs.attached.pointers;
  p.buttons = [1, 2]; p.panningMouseButton = 1; // RMB orbit, MMB pan, wheel zoom
  camera.panningSensibility = 400;
  const hemi = new B.HemisphericLight('h', new B.Vector3(0.2, 1, 0.1), scene); hemi.intensity = 0.9;
  const sun = new B.DirectionalLight('d', new B.Vector3(-0.4, -1, -0.3), scene); sun.intensity = 0.6;

  gridMesh = B.MeshBuilder.CreateGround('grid', { width: 400, height: 400 }, scene);
  if (B.GridMaterial) {
    const gm = new B.GridMaterial('gridmat', scene);
    gm.majorUnitFrequency = 10; gm.minorUnitVisibility = 0.35; gm.gridRatio = 1; gm.mainColor = new B.Color3(0, 0, 0); gm.lineColor = new B.Color3(0.45, 0.5, 0.6);
    gm.opacity = 0.7; gm.backFaceCulling = false; gridMesh.material = gm;
  }
  gridMesh.isPickable = false;

  const layer = new B.UtilityLayerRenderer(scene);
  gizmoManager = new B.GizmoManager(scene, 3, layer);
  gizmoManager.usePointerToAttachGizmos = false;
  gizmoManager.positionGizmoEnabled = true; gizmoManager.rotationGizmoEnabled = true; gizmoManager.scaleGizmoEnabled = true;
  const g = gizmoManager.gizmos;
  g.positionGizmo.updateGizmoRotationToMatchAttachedMesh = false;
  g.rotationGizmo.updateGizmoRotationToMatchAttachedMesh = false;
  for (const k of ['positionGizmo', 'rotationGizmo', 'scaleGizmo']) {
    g[k].onDragEndObservable.add(() => emitTransform(true));
    g[k].onDragObservable?.add(() => { const n = performance.now(); if (n - lastEmit > 60) { lastEmit = n; emitTransform(false); } });
    g[k].attachedNode = null;
  }

  scene.onPointerObservable.add((pi) => {
    if (pi.type !== B.PointerEventTypes.POINTERDOWN) return;
    if (pi.event.button === 2) rmb = true;
    if (pi.event.button !== 0 || gizmoManager.isHovered || pi.event.altKey || state.settings.tool === 'hand') return; // Alt+LMB = camera
    const pick = scene.pick(scene.pointerX, scene.pointerY, (m) => !!m.metadata?.entityId && m.isPickable);
    const id = pick?.hit ? pick.pickedMesh.metadata.entityId : null;
    const e = pi.event;
    if (id && (e.shiftKey || e.ctrlKey || e.metaKey)) {
      const sel = new Set(state.selection);
      sel.has(id) ? sel.delete(id) : sel.add(id);
      selectLocal([...sel]);
    } else selectLocal(id ? [id] : []);
  });
  addEventListener('pointerup', (e) => { if (e.button === 2) rmb = false; });
  addEventListener('keydown', (e) => { keys.add(e.code); modKeys(e); });
  addEventListener('keyup', (e) => { keys.delete(e.code); modKeys(e); });
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());

  scene.onBeforeRenderObservable.add(() => {
    if (!rmb || !keys.size) return;
    const dt = engine.getDeltaTime() / 1000, sp = Math.max(2, camera.radius) * 0.9 * dt;
    const fwd = camera.getTarget().subtract(camera.position).normalize(), right = B.Vector3.Cross(B.Vector3.Up(), fwd).normalize().scale(-1);
    const mv = B.Vector3.Zero();
    if (keys.has('KeyW')) mv.addInPlace(fwd);
    if (keys.has('KeyS')) mv.subtractInPlace(fwd);
    if (keys.has('KeyD')) mv.addInPlace(right);
    if (keys.has('KeyA')) mv.subtractInPlace(right);
    if (keys.has('KeyE')) mv.y += 1;
    if (keys.has('KeyQ')) mv.y -= 1;
    camera.target.addInPlace(mv.scale(sp));
  });
  new ResizeObserver(() => engine.resize()).observe(canvas);
  engine.runRenderLoop(() => { scene.render(); hudUpdate(); });
  setSettings();
}

function hudUpdate() {
  const el = document.getElementById('hud');
  el.textContent = `3D · ${state.settings.tool}${state.settings.snap ? ' · snap' : ''}${state.settings.local ? ' · local' : ' · global'}${state.selection.length > 1 ? ` · ${state.selection.length} selected` : ''} · RMB orbit (+WASDQE fly) · Alt+LMB orbit · MMB pan · wheel zoom`;
}

function selectLocal(ids) {
  state.selection = ids;
  setSelection();
  send({ t: 'select', id: ids[0] ?? null, ids });
}

// Unity navigation: Alt+LMB orbit, Alt+Cmd+LMB pan (MMB pans, RMB orbits, wheel zooms); Ctrl/Cmd toggles snapping while held.
let ctrlHeld = false;
function modKeys(e) {
  ctrlHeld = e.ctrlKey || e.metaKey;
  navButtons(e.altKey, e.metaKey);
  setSettings();
}
function navButtons(alt, meta) {
  const ptr = camera?.inputs?.attached?.pointers;
  if (!ptr) return;
  const hand = state.settings.tool === 'hand';
  ptr.buttons = hand || alt ? [0, 1, 2] : [1, 2];
  ptr.panningMouseButton = hand || (alt && meta) ? 0 : 1;
}

function applyTransform(node, t) {
  node.position.set(t.pos[0], t.pos[1], t.pos[2]);
  node.rotationQuaternion = B.Quaternion.RotationYawPitchRoll(t.rot[1] * R, t.rot[0] * R, t.rot[2] * R);
  node.scaling.set(t.scale[0], t.scale[1], t.scale[2]);
}

function emitTransform(final) {
  const id = state.selection[0];
  const n = nodes.get(id);
  if (!n) return;
  const node = n.node;
  const q = node.rotationQuaternion ?? B.Quaternion.FromEulerVector(node.rotation);
  const e = q.toEulerAngles();
  const r = (v) => Math.round(v * 1e4) / 1e4;
  const pos = [r(node.position.x), r(node.position.y), r(node.position.z)];
  const rot = [r(e.x / R), r(e.y / R), r(e.z / R)];
  const scale = [r(node.scaling.x), r(node.scaling.y), r(node.scaling.z)];
  n.entity.transform = { pos, rot, scale };
  send({ t: 'transform', id, pos, rot, scale, final });
}

const comp = (e, t) => e.components?.find((c) => c.type === t);

function tag(mesh, id) { mesh.metadata = { entityId: id }; mesh.isPickable = true; }

function marker(name, id, parent, color = '#9fb3d9', size = 0.4) {
  const m = B.MeshBuilder.CreateBox(name, { size }, scene);
  const mat = new B.StandardMaterial(name + 'm', scene); mat.wireframe = true; mat.emissiveColor = B.Color3.FromHexString(color); mat.disableLighting = true;
  m.material = mat; m.parent = parent; tag(m, id);
  return m;
}

function hex(c, d = '#c8ccd4') { return B.Color3.FromHexString((c || d).slice(0, 7)); }

async function getContainer(path) {
  if (!containers.has(path)) {
    const i = path.lastIndexOf('/');
    containers.set(path, B.SceneLoader.LoadAssetContainerAsync('/' + path.slice(0, i + 1), path.slice(i + 1), scene).catch((err) => { log(`model ${path}: ${err?.message ?? err}`); return null; }));
  }
  return containers.get(path);
}


// ---- things the game shows that are not plain meshes: skybox, FPS level contents, paths (Scene view = Game view) ----
function makeSky(dir, node) {
  const f = (n) => `/${dir}/${n}.png`;
  const tex = new B.CubeTexture('', scene, null, false, [f('px'), f('py'), f('pz'), f('nx'), f('ny'), f('nz')]);
  tex.coordinatesMode = B.Texture.SKYBOX_MODE;
  const box = B.MeshBuilder.CreateBox('sky', { size: 900 }, scene);
  const m = new B.StandardMaterial('sky', scene);
  m.backFaceCulling = false; m.reflectionTexture = tex; m.disableLighting = true; m.diffuseColor = m.specularColor = B.Color3.Black();
  box.material = m; box.infiniteDistance = true; box.isPickable = false; box.parent = node;
}

const isFpsHost = (e) => (e.scripts ?? []).find((s) => /fpsc\/level-script\.js$/.test(s.path));
const levels = new Map();
function getLevel(path) {
  if (!levels.has(path)) { levels.set(path, null); fetch('/' + path).then((r) => r.json()).then((j) => { levels.set(path, j); if (state.scene) setScene(); }).catch(() => {}); }
  return levels.get(path);
}

/** Simple lit preview of an FPS level: floors, walls/doors, ceilings off, items as coloured markers. */
function buildFps(e, node) {
  const sc = isFpsHost(e);
  const lv = getLevel(sc.attributes?.level ?? 'levels/level1.fpsl.json');
  if (!lv) return;
  const C = lv.cell ?? 4, H = lv.story ?? 3.2;
  const parts = new Map(); // colour -> boxes
  const add = (col, w, h, d, x, y, z) => {
    const b = B.MeshBuilder.CreateBox('f', { width: w, height: h, depth: d }, scene);
    b.position.set(x, y, z); b.bakeCurrentTransformIntoVertices();
    (parts.get(col) ?? parts.set(col, []).get(col)).push(b);
  };
  (lv.layers ?? []).forEach((ly, i) => {
    const y0 = i * H;
    for (const [k, c] of Object.entries(ly.cells ?? {})) {
      if (!c.f) continue;
      const [x, z] = k.split(',').map(Number);
      add('#7d8590', C, 0.1, C, (x + 0.5) * C, y0 - 0.05 + (typeof c.h === 'number' ? c.h : 0), (z + 0.5) * C);
    }
    for (const [k, pc] of Object.entries(ly.edges ?? {})) {
      const [xs, zs, o] = k.split(','); const x = +xs, z = +zs;
      const kind = String(pc.k ?? 'wall');
      const col = /door|gate|secret/.test(kind) ? '#c98a3d' : /window|glass|bars|fence|chain|rail/.test(kind) ? '#6fb3d9' : '#d9cfb8';
      const t = 0.2;
      if (o === 'H') add(col, C, H, t, (x + 0.5) * C, y0 + H / 2, z * C); else add(col, t, H, C, x * C, y0 + H / 2, (z + 0.5) * C);
    }
  });
  const markCol = (t) => (/player/.test(t) ? '#3da5ff' : /light/.test(t) ? '#ffe066' : /enemy|soldier|guard|zombie|runner|robot|drone|turret|mech|boss|heavy|sniper/.test(t) ? '#ff5252' : /key|medkit|ammo|armor|pickup|coin|gem|weapon/.test(t) ? '#4ade80' : /exit|checkpoint|teleport|spawn/.test(t) ? '#c792ea' : '#b0b8c4');
  for (const it of lv.entities ?? []) add(markCol(String(it.type)), 0.6, 1.6, 0.6, it.x, (it.layer ?? 0) * H + 0.8, it.z);
  for (const [col, boxes] of parts) {
    const m = B.Mesh.MergeMeshes(boxes, true, true);
    if (!m) continue;
    const mat = new B.StandardMaterial('fm', scene); mat.diffuseColor = B.Color3.FromHexString(col); mat.specularColor = new B.Color3(0.05, 0.05, 0.05);
    m.material = mat; m.parent = node; tag(m, e.id);
  }
}

function buildPath(e, node, p) {
  const pts = (p.points ?? []).map((q) => new B.Vector3(q[0], q[1], q[2] ?? 0));
  if (pts.length < 2) return;
  if (p.loop) pts.push(pts[0]);
  const l = B.MeshBuilder.CreateLines(e.id + '.path', { points: pts }, scene);
  l.color = B.Color3.FromHexString('#ffd166'); l.parent = node; l.isPickable = false; iconMeshes.push(l);
}

function buildEntity(e, parentNode, token) {
  const node = new B.TransformNode(e.name || e.id, scene);
  node.parent = parentNode;
  applyTransform(node, e.transform);
  node.setEnabled(e.enabled !== false);
  nodes.set(e.id, { node, entity: e });
  let visual = false;
  const mesh = comp(e, 'mesh');
  if (mesh) {
    const s = mesh.size ?? [1, 1, 1], n = e.id + '.mesh', MB = B.MeshBuilder;
    const make = {
      box: () => MB.CreateBox(n, { width: s[0], height: s[1], depth: s[2] }, scene),
      sphere: () => MB.CreateSphere(n, { diameter: s[0], segments: 16 }, scene),
      cylinder: () => MB.CreateCylinder(n, { height: s[1], diameter: s[0], tessellation: 24 }, scene),
      capsule: () => MB.CreateCapsule(n, { height: s[1], radius: s[0] / 2 }, scene),
      torus: () => MB.CreateTorus(n, { diameter: s[0], thickness: s[1], tessellation: 24 }, scene),
      plane: () => MB.CreatePlane(n, { width: s[0], height: s[1] }, scene),
      ground: () => MB.CreateGround(n, { width: s[0], height: s[2] ?? s[1] }, scene),
    }[mesh.shape ?? 'box'];
    if (make) {
      const m = make(); m.parent = node; tag(m, e.id);
      const mat = comp(e, 'material');
      const sm = new B.StandardMaterial(n + 'm', scene); sm.diffuseColor = hex(mat?.color); sm.specularColor = new B.Color3(0.1, 0.1, 0.1);
      sm.backFaceCulling = !mat?.doubleSided; m.material = sm;
      visual = true;
    }
  }
  const model = comp(e, 'model');
  if (model?.path) {
    getContainer(model.path).then((c) => {
      if (!c || token !== buildToken || !nodes.has(e.id)) return;
      const inst = c.instantiateModelsToScene((nm) => `${e.id}.${nm}`, false);
      for (const r of inst.rootNodes) { r.parent = node; for (const m of [r, ...r.getChildMeshes()]) if (m.getTotalVertices?.()) tag(m, e.id); }
      for (const g of inst.animationGroups) g.stop();
    });
    visual = true;
  }
  const light = comp(e, 'light');
  if (light) {
    const m = B.MeshBuilder.CreateSphere(e.id + '.light', { diameter: 0.35 }, scene);
    iconMeshes.push(m);
    const mt = new B.StandardMaterial(e.id + 'lm', scene); mt.emissiveColor = hex(light.color, '#ffe9a8'); mt.disableLighting = true; m.material = mt; m.parent = node; tag(m, e.id);
    visual = true;
  }
  const cam = comp(e, 'camera');
  if (cam) {
    const m = marker(e.id + '.cam', e.id, node, '#ffd166', 0.6); m.scaling.z = 1.5;
    iconMeshes.push(m);
    visual = true;
  }
  const col = comp(e, 'collider') ?? comp(e, 'trigger');
  if (col) { // collider outline (toggle: Gizmos ▸ Colliders)
    const s = col.size ?? [1, 1, 1], o = col.offset ?? [0, 0, 0];
    const cm = col.shape === 'sphere' || col.shape === 'circle' ? B.MeshBuilder.CreateSphere(e.id + '.col', { diameter: (col.radius ?? 0.5) * 2, segments: 8 }, scene)
      : B.MeshBuilder.CreateBox(e.id + '.col', { width: s[0], height: s[1], depth: s[2] }, scene);
    const cmat = new B.StandardMaterial(e.id + 'colm', scene); cmat.wireframe = true; cmat.disableLighting = true; cmat.emissiveColor = B.Color3.FromHexString(col.trigger || comp(e, 'trigger') ? '#c792ea' : '#6bff8a');
    cm.material = cmat; cm.parent = node; cm.position.set(o[0], o[1], o[2]); cm.isPickable = false;
    colliderMeshes.push(cm);
  }
  const sky = comp(e, 'skybox');
  if (sky) makeSky(sky.path ?? 'assets/skybox/day', node);
  const path = comp(e, 'path');
  if (path) buildPath(e, node, path);
  if (isFpsHost(e)) { buildFps(e, node); visual = true; }
  if (!visual) marker(e.id + '.mk', e.id, node);
  for (const c of e.children ?? []) buildEntity(c, node, token);
}

export function setScene() {
  buildToken++;
  iconMeshes = []; colliderMeshes = [];
  for (const { node } of nodes.values()) { node.getChildMeshes(false).forEach((m) => m.dispose()); }
  for (const { node } of [...nodes.values()].reverse()) node.dispose();
  nodes.clear();
  for (const e of state.scene?.entities ?? []) buildEntity(e, null, buildToken);
  setSelection();
  setSettings();
}

let outlined = [];
let iconMeshes = [], colliderMeshes = [], ghostMesh = null;
export function setSelection() {
  const id = state.selection[0];
  const n = nodes.get(id);
  applyGizmos(n?.node ?? null);
  for (const m of outlined) { if (!m.isDisposed()) m.renderOutline = false; }
  outlined = [];
  for (const sid of state.selection) {
    const sn = nodes.get(sid)?.node;
    if (!sn) continue;
    for (const m of sn.getChildMeshes(false)) {
      if (!m.getTotalVertices?.() || m.material?.wireframe) continue;
      m.renderOutline = true; m.outlineWidth = 0.04; m.outlineColor = sid === id ? B.Color3.FromHexString('#4fa3ff') : B.Color3.FromHexString('#9fd0ff');
      outlined.push(m);
    }
  }
}

function applyGizmos(node) {
  const g = gizmoManager.gizmos, t = state.settings.tool;
  g.positionGizmo.attachedNode = t === 'move' ? node : null;
  g.rotationGizmo.attachedNode = t === 'rotate' ? node : null;
  g.scaleGizmo.attachedNode = t === 'scale' || t === 'rect' ? node : null;
  navButtons(false, false); // Q hand: LMB drag pans
}

export function setSettings() {
  const s = state.settings;
  gridMesh?.setEnabled(!!s.grid);
  for (const m of iconMeshes) if (!m.isDisposed()) m.setEnabled(s.icons !== false);
  for (const m of colliderMeshes) if (!m.isDisposed()) m.setEnabled(s.colliders !== false);
  const g = gizmoManager?.gizmos;
  if (g) {
    const snap = !!s.snap !== ctrlHeld;
    g.positionGizmo.snapDistance = snap ? s.snapMove : 0;
    g.rotationGizmo.snapDistance = snap ? s.snapRot * R : 0;
    g.scaleGizmo.snapDistance = snap ? s.snapScale : 0;
    g.positionGizmo.updateGizmoRotationToMatchAttachedMesh = !!s.local; // Local / Global
    g.rotationGizmo.updateGizmoRotationToMatchAttachedMesh = !!s.local;
  }
  setSelection();
}

// Drag an asset over the Scene view: ghost marker on the ground plane (y = 0), drop = new entity there.
function groundPoint(x, y) {
  const ray = scene.createPickingRay(x, y, B.Matrix.Identity(), camera);
  if (Math.abs(ray.direction.y) < 1e-6) return camera.getTarget().clone();
  const t = -ray.origin.y / ray.direction.y;
  return t > 0 ? ray.origin.add(ray.direction.scale(t)) : camera.getTarget().clone();
}
const snap3 = (v) => (state.settings.snap !== ctrlHeld && state.settings.snapMove > 0 ? Math.round(v / state.settings.snapMove) * state.settings.snapMove : v);
export function dropPreview(m) {
  if (m.off) { ghostMesh?.setEnabled(false); return; }
  if (!ghostMesh) {
    ghostMesh = B.MeshBuilder.CreateBox('dropghost', { size: 0.8 }, scene);
    const mat = new B.StandardMaterial('dropghostm', scene); mat.emissiveColor = B.Color3.FromHexString('#4fa3ff'); mat.alpha = 0.45; mat.disableLighting = true;
    ghostMesh.material = mat; ghostMesh.isPickable = false;
  }
  const p = groundPoint(m.x, m.y);
  ghostMesh.position.set(snap3(p.x), 0.4, snap3(p.z)); ghostMesh.setEnabled(true);
}
export function dropAsset(m) {
  ghostMesh?.setEnabled(false);
  const p = groundPoint(m.x, m.y);
  send({ t: 'addAsset', path: m.path, pos: [snap3(p.x), 0, snap3(p.z)] });
}

export function focus(all) {
  if (all || !nodes.get(state.selection[0])) {
    const roots = [...nodes.values()].map((n) => n.node).filter((n) => n.getChildMeshes().length);
    if (!roots.length) return;
    let min = new B.Vector3(Infinity, Infinity, Infinity), max = new B.Vector3(-Infinity, -Infinity, -Infinity);
    for (const r of roots) { const b = r.getHierarchyBoundingVectors(true); min = B.Vector3.Minimize(min, b.min); max = B.Vector3.Maximize(max, b.max); }
    camera.setTarget(min.add(max).scale(0.5));
    camera.radius = Math.max(2, max.subtract(min).length() * 1.2);
    return;
  }
  const n = nodes.get(state.selection[0]);
  const meshes = n.node.getChildMeshes();
  let radius = 4;
  if (meshes.length) {
    const { min, max } = n.node.getHierarchyBoundingVectors(true);
    radius = Math.max(2, max.subtract(min).length() * 1.8);
  }
  camera.setTarget(n.node.getAbsolutePosition().clone());
  camera.radius = radius;
}

// ---------- offscreen model thumbnails ----------
async function renderThumb(path, sha) {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const eng = new B.Engine(c, true, { preserveDrawingBuffer: true });
  try {
    const sc = new B.Scene(eng); sc.clearColor = new B.Color4(0.16, 0.18, 0.22, 1);
    const cam = new B.ArcRotateCamera('t', -Math.PI / 3, Math.PI / 3, 5, B.Vector3.Zero(), sc);
    new B.HemisphericLight('h', new B.Vector3(0.3, 1, 0.2), sc);
    const i = path.lastIndexOf('/');
    await B.SceneLoader.AppendAsync('/' + path.slice(0, i + 1), path.slice(i + 1), sc);
    const meshes = sc.meshes.filter((m) => m.getTotalVertices?.());
    if (meshes.length) {
      const { min, max } = sc.getWorldExtends((m) => !!m.getTotalVertices?.());
      cam.setTarget(min.add(max).scale(0.5));
      cam.radius = Math.max(0.5, max.subtract(min).length() * 1.3);
    }
    await sc.whenReadyAsync();
    sc.render(); sc.render();
    const url = c.toDataURL('image/png');
    await fetch(`/api/thumb-upload/${sha}`, { method: 'POST', headers: { 'x-nord': '1' }, body: url });
    send({ t: 'thumb', path });
  } finally {
    eng.dispose();
  }
}

export async function thumbs(items) {
  for (const it of items) {
    try { await renderThumb(it.path, it.sha); } catch (err) { log(`thumbnail ${it.path}: ${err?.message ?? err}`); }
  }
}

// ---------- test hooks ----------
export const api = {
  get B() { return B; }, get scene() { return scene; }, get camera() { return camera; }, nodes, gizmos: () => gizmoManager.gizmos,
  screenOf(id) {
    const n = nodes.get(id)?.node; if (!n) return null;
    const v = B.Vector3.Project(n.getAbsolutePosition(), B.Matrix.Identity(), scene.getTransformMatrix(), camera.viewport.toGlobal(engine.getRenderWidth(), engine.getRenderHeight()));
    return [v.x / (devicePixelRatio || 1), v.y / (devicePixelRatio || 1)];
  },
};
