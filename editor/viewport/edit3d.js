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
  for (const k of ['positionGizmo', 'rotationGizmo', 'scaleGizmo']) {
    g[k].onDragEndObservable.add(() => emitTransform(true));
    g[k].onDragObservable?.add(() => { const n = performance.now(); if (n - lastEmit > 60) { lastEmit = n; emitTransform(false); } });
    g[k].attachedNode = null;
  }

  scene.onPointerObservable.add((pi) => {
    if (pi.type !== B.PointerEventTypes.POINTERDOWN) return;
    if (pi.event.button === 2) rmb = true;
    if (pi.event.button !== 0 || gizmoManager.isHovered) return;
    const pick = scene.pick(scene.pointerX, scene.pointerY, (m) => !!m.metadata?.entityId && m.isPickable);
    const id = pick?.hit ? pick.pickedMesh.metadata.entityId : null;
    selectLocal(id);
  });
  addEventListener('pointerup', (e) => { if (e.button === 2) rmb = false; });
  addEventListener('keydown', (e) => keys.add(e.code));
  addEventListener('keyup', (e) => keys.delete(e.code));
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
  el.textContent = `3D · ${state.settings.tool}${state.settings.snap ? ' · snap' : ''} · RMB orbit (+WASDQE fly) · MMB pan · wheel zoom`;
}

function selectLocal(id) {
  state.selection = id ? [id] : [];
  setSelection();
  send({ t: 'select', id });
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
    const mt = new B.StandardMaterial(e.id + 'lm', scene); mt.emissiveColor = hex(light.color, '#ffe9a8'); mt.disableLighting = true; m.material = mt; m.parent = node; tag(m, e.id);
    visual = true;
  }
  const cam = comp(e, 'camera');
  if (cam) {
    const m = marker(e.id + '.cam', e.id, node, '#ffd166', 0.6); m.scaling.z = 1.5;
    visual = true;
  }
  if (!visual) marker(e.id + '.mk', e.id, node);
  for (const c of e.children ?? []) buildEntity(c, node, token);
}

export function setScene() {
  buildToken++;
  for (const { node } of nodes.values()) { node.getChildMeshes(false).forEach((m) => m.dispose()); }
  for (const { node } of [...nodes.values()].reverse()) node.dispose();
  nodes.clear();
  for (const e of state.scene?.entities ?? []) buildEntity(e, null, buildToken);
  setSelection();
}

export function setSelection() {
  const id = state.selection[0];
  const n = nodes.get(id);
  applyGizmos(n?.node ?? null);
}

function applyGizmos(node) {
  const g = gizmoManager.gizmos, t = state.settings.tool;
  g.positionGizmo.attachedNode = t === 'move' ? node : null;
  g.rotationGizmo.attachedNode = t === 'rotate' ? node : null;
  g.scaleGizmo.attachedNode = t === 'scale' ? node : null;
}

export function setSettings() {
  const s = state.settings;
  gridMesh?.setEnabled(!!s.grid);
  const g = gizmoManager?.gizmos;
  if (g) {
    g.positionGizmo.snapDistance = s.snap ? s.snapMove : 0;
    g.rotationGizmo.snapDistance = s.snap ? s.snapRot * R : 0;
    g.scaleGizmo.snapDistance = s.snap ? s.snapScale : 0;
  }
  setSelection();
}

export function focus() {
  const n = nodes.get(state.selection[0]);
  if (!n) return;
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
