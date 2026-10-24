// 3D edit view (Babylon): orbit/fly camera, grid, picking, move/rotate/scale gizmos, snap, IPC sync, offscreen model thumbnails.
import { canvas, state, send, log } from './edit.js';
import { createSpriteMaterial, createLight, applyAmbient, allowManyLights, createLightCuller, qualitySettings } from '/runtime/babylon/lighting.js';

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
  camera.minZ = 0.05; camera.maxZ = 5000; camera.lowerRadiusLimit = 0.05;
  camera.attachControl(canvas, true);
  const p = camera.inputs.attached.pointers;
  p.buttons = [1]; p.panningMouseButton = 1; // MMB pan; Alt+LMB orbit (navButtons); RMB = fly look + zoom, handled below like Unity
  camera.inputs.attached.mousewheel.wheelDeltaPercentage = 0.0005; // Unity: zoom is relative to the distance
  camera.panningSensibility = 400;
  hemi = new B.HemisphericLight('h', new B.Vector3(0.2, 1, 0.1), scene); hemi.intensity = 0.9;
  allowManyLights(B, scene, Math.max(8, qualitySettings(state.project).maxLights));
  sun = new B.DirectionalLight('d', new B.Vector3(-0.4, -1, -0.3), scene); sun.intensity = 0.6;

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
  g.positionGizmo.planarGizmoEnabled = true; // Unity/Godot: little squares between the arrows move on a plane
  g.scaleGizmo.uniformScaleGizmo.isEnabled = true; // centre cube = uniform scale
  g.positionGizmo.updateGizmoRotationToMatchAttachedMesh = false;
  g.rotationGizmo.updateGizmoRotationToMatchAttachedMesh = false;
  for (const k of ['positionGizmo', 'rotationGizmo', 'scaleGizmo']) {
    g[k].onDragStartObservable?.add(() => startGroup());
    g[k].onDragEndObservable.add(() => { emitTransform(true); if (grp) { grp = null; applyGizmos(attachNodeFor()); } });
    g[k].onDragObservable?.add(() => { const n = performance.now(); if (n - lastEmit > 60) { lastEmit = n; emitTransform(false); } });
    g[k].attachedNode = null;
  }

  initMarquee();
  initAxisGizmo();
  scene.onPointerObservable.add((pi) => {
    if (pi.type !== B.PointerEventTypes.POINTERDOWN) return;
    if (pi.event.button !== 0 || gizmoManager.isHovered || pi.event.altKey || state.settings.tool === 'hand') return; // Alt+LMB = camera
    const pick = scene.pick(scene.pointerX, scene.pointerY, (m) => !!m.metadata?.entityId && m.isPickable);
    const id = pick?.hit ? pick.pickedMesh.metadata.entityId : null;
    const e = pi.event;
    if (id && (e.shiftKey || e.ctrlKey || e.metaKey)) {
      const sel = new Set(state.selection);
      sel.has(id) ? sel.delete(id) : sel.add(id);
      selectLocal([...sel]);
    } else selectLocal(id ? [id] : []);
    if (!id) marquee = { x0: scene.pointerX, y0: scene.pointerY, x: scene.pointerX, y: scene.pointerY, add: e.shiftKey || e.ctrlKey || e.metaKey, base: [...state.selection] };
  });
  flyNavigation();
  addEventListener('keydown', (e) => { keys.add(e.code); modKeys(e); });
  addEventListener('keyup', (e) => { keys.delete(e.code); modKeys(e); });
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());

  new ResizeObserver(() => engine.resize()).observe(canvas);
  const culler = createLightCuller(B, scene);
  engine.runRenderLoop(() => { culler.update(engine.getDeltaTime() / 1000); scene.render(); hudUpdate(); });
  setSettings();
}

// Unity Scene view navigation (SceneViewMotion.cs): hold RMB = look around + WASD fly (Q down, E up), speed 9 u/s that accelerates
// while keys are held, Shift = x3, wheel while flying changes the speed; Alt+RMB drag = zoom.
const FLY_SPEED = 9, FLY_ACCEL = 2.8, FLY_SHIFT = 3;
let flyMul = 1, flyRamp = 1, zoomDrag = false;
function flyNavigation() {
  const look = (dx, dy) => { // rotate about the camera's own position
    const p = camera.position.clone();
    camera.alpha -= dx * 0.0035;
    camera.beta = Math.min(Math.max(camera.beta - dy * 0.0035, 0.02), Math.PI - 0.02);
    camera.target.copyFrom(p.subtract(new B.Vector3(Math.cos(camera.alpha) * Math.sin(camera.beta), Math.cos(camera.beta), Math.sin(camera.alpha) * Math.sin(camera.beta)).scale(camera.radius)), false, false, true);
  };
  canvas.addEventListener('pointerdown', (e) => {
    if (e.button !== 2) return;
    rmb = state.flying = true; zoomDrag = e.altKey; flyRamp = 1;
    canvas.setPointerCapture?.(e.pointerId);
    canvas.style.cursor = zoomDrag ? 'ns-resize' : 'none';
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!rmb) return;
    if (zoomDrag) camera.radius = Math.max(0.05, camera.radius * Math.exp((e.movementX - e.movementY) * 0.01)); // Alt+RMB = zoom
    else look(e.movementX, e.movementY);
  });
  const end = (e) => { if (e.button === 2 && rmb) { rmb = state.flying = false; canvas.style.cursor = ''; canvas.releasePointerCapture?.(e.pointerId); } };
  canvas.addEventListener('pointerup', end);
  canvas.addEventListener('pointercancel', end);
  canvas.addEventListener('wheel', (e) => { // while flying the wheel changes the fly speed instead of zooming
    if (!rmb) return;
    e.preventDefault(); e.stopImmediatePropagation();
    flyMul = Math.min(Math.max(flyMul * Math.exp(-e.deltaY * 0.002), 0.05), 50);
  }, { capture: true, passive: false });
  scene.onBeforeRenderObservable.add(() => {
    if (!rmb || zoomDrag) return;
    const dt = engine.getDeltaTime() / 1000;
    const fwd = camera.getTarget().subtract(camera.position).normalize(), right = B.Vector3.Cross(B.Vector3.Up(), fwd).normalize(); // Babylon is left-handed: Up x forward = camera right
    const mv = B.Vector3.Zero();
    if (keys.has('KeyW')) mv.addInPlace(fwd);
    if (keys.has('KeyS')) mv.subtractInPlace(fwd);
    if (keys.has('KeyD')) mv.addInPlace(right);
    if (keys.has('KeyA')) mv.subtractInPlace(right);
    if (keys.has('KeyE')) mv.y += 1;
    if (keys.has('KeyQ')) mv.y -= 1;
    if (mv.lengthSquared() === 0) { flyRamp = 1; return; }
    flyRamp *= Math.pow(FLY_ACCEL, dt);
    const shift = keys.has('ShiftLeft') || keys.has('ShiftRight');
    camera.target.addInPlace(mv.normalize().scale(FLY_SPEED * flyMul * flyRamp * (shift ? FLY_SHIFT : 1) * dt));
  });
}

// ---- marquee (LMB drag on empty space) selects every object whose centre falls inside the rectangle ----
let marquee = null, marqueeEl = null;
function initMarquee() {
  marqueeEl = document.createElement('div');
  marqueeEl.style.cssText = 'position:fixed;display:none;border:1px solid #4fa3ff;background:rgba(79,163,255,.15);pointer-events:none;z-index:5';
  document.body.appendChild(marqueeEl);
  canvas.addEventListener('pointermove', (e) => {
    if (!marquee) return;
    const r = canvas.getBoundingClientRect();
    marquee.x = e.clientX - r.left; marquee.y = e.clientY - r.top;
    if (Math.hypot(marquee.x - marquee.x0, marquee.y - marquee.y0) < 4) { marqueeEl.style.display = 'none'; return; }
    Object.assign(marqueeEl.style, { display: 'block', left: r.left + Math.min(marquee.x0, marquee.x) + 'px', top: r.top + Math.min(marquee.y0, marquee.y) + 'px', width: Math.abs(marquee.x - marquee.x0) + 'px', height: Math.abs(marquee.y - marquee.y0) + 'px' });
  });
  const up = () => {
    if (!marquee) return;
    const m = marquee; marquee = null; marqueeEl.style.display = 'none';
    if (Math.hypot(m.x - m.x0, m.y - m.y0) < 4) return;
    selectLocal([...new Set([...m.base, ...entitiesInRect(m)])]);
  };
  canvas.addEventListener('pointerup', up); canvas.addEventListener('pointercancel', () => { marquee = null; marqueeEl.style.display = 'none'; });
}
/** Entity ids whose world position projects inside the dragged rectangle (canvas CSS pixels). */
function entitiesInRect(m) {
  const kx = engine.getRenderWidth() / canvas.clientWidth, ky = engine.getRenderHeight() / canvas.clientHeight;
  const vp = camera.viewport.toGlobal(engine.getRenderWidth(), engine.getRenderHeight()), tm = scene.getTransformMatrix();
  const [x0, x1] = [Math.min(m.x0, m.x) * kx, Math.max(m.x0, m.x) * kx], [y0, y1] = [Math.min(m.y0, m.y) * ky, Math.max(m.y0, m.y) * ky];
  const out = [];
  for (const [id, n] of nodes) {
    if (lockedIds.has(id) || !n.node.isEnabled()) continue;
    const p = B.Vector3.Project(n.node.getAbsolutePosition(), B.Matrix.Identity(), tm, vp);
    if (p.z < 0 || p.z > 1) continue;
    if (p.x >= x0 && p.x <= x1 && p.y >= y0 && p.y <= y1) out.push(id);
  }
  return out;
}

// ---- axis gizmo (top right): shows the view orientation; click an axis cone to look along it (Unity's Scene gizmo) ----
let axisCv = null;
const AXES = [['X', [1, 0, 0], '#ff5f5f'], ['Y', [0, 1, 0], '#5fff7f'], ['Z', [0, 0, 1], '#5f8fff']];
let axisHits = [];
function initAxisGizmo() {
  axisCv = document.createElement('canvas');
  axisCv.width = axisCv.height = 180;
  axisCv.style.cssText = 'position:fixed;top:8px;right:8px;width:90px;height:90px;z-index:6;cursor:pointer';
  document.body.appendChild(axisCv);
  axisCv.addEventListener('pointerdown', (e) => {
    e.stopPropagation();
    const r = axisCv.getBoundingClientRect(), x = (e.clientX - r.left) * 2, y = (e.clientY - r.top) * 2;
    const hit = axisHits.filter((h) => Math.hypot(h.x - x, h.y - y) < 18).sort((a, b) => b.z - a.z)[0];
    if (!hit) return;
    const [dx, dy, dz] = hit.dir; // camera goes to this side of the target and looks at it
    if (Math.abs(dy) < 0.5) camera.alpha = Math.atan2(dz, dx);
    camera.beta = dy > 0.5 ? 0.02 : dy < -0.5 ? Math.PI - 0.02 : Math.PI / 2;
  });
}
function drawAxisGizmo() {
  if (!axisCv) return;
  const c = axisCv.getContext('2d'), v = scene.getViewMatrix(), cx = 90, cy = 90, L = 56;
  c.clearRect(0, 0, 180, 180);
  c.fillStyle = 'rgba(20,24,30,.55)'; c.beginPath(); c.arc(cx, cy, 84, 0, 7); c.fill();
  const items = [];
  for (const [name, d, col] of AXES) for (const sign of [1, -1]) {
    const w = new B.Vector3(d[0] * sign, d[1] * sign, d[2] * sign), t = B.Vector3.TransformNormal(w, v);
    items.push({ name, sign, col, dir: [w.x, w.y, w.z], x: cx + t.x * L, y: cy - t.y * L, z: -t.z });
  }
  items.sort((a, b) => a.z - b.z); // far first
  axisHits = items;
  for (const it of items) {
    if (it.sign > 0) { c.strokeStyle = it.col; c.lineWidth = 3; c.beginPath(); c.moveTo(cx, cy); c.lineTo(it.x, it.y); c.stroke(); }
    c.fillStyle = it.sign > 0 ? it.col : 'rgba(150,160,175,.55)';
    c.beginPath(); c.arc(it.x, it.y, it.sign > 0 ? 14 : 10, 0, 7); c.fill();
    if (it.sign > 0) { c.fillStyle = '#10151c'; c.font = 'bold 16px sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(it.name, it.x, it.y + 1); }
  }
}

function hudUpdate() {
  drawAxisGizmo();
  const el = document.getElementById('hud');
  el.textContent = `3D · ${state.settings.tool}${state.settings.snap ? ' · snap' : ''}${state.settings.local ? ' · local' : ' · global'}${state.selection.length > 1 ? ` · ${state.selection.length} selected` : ''} · hold RMB: look + WASD fly (Q/E down/up, Shift faster, wheel = speed) · Alt+LMB orbit · Alt+RMB zoom · MMB pan · wheel zoom`;
}

function selectLocal(ids) {
  state.selection = ids;
  setSelection();
  send({ t: 'select', id: ids[0] ?? null, ids });
}

// Unity navigation: Alt+LMB orbit, Alt+Cmd+LMB pan (MMB pans, RMB = fly look, wheel zooms); Ctrl/Cmd toggles snapping while held.
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
  ptr.buttons = hand || alt ? [0, 1] : [1]; // RMB is Unity-style fly look / zoom (flyNavigation), never the camera's own orbit
  ptr.panningMouseButton = hand || (alt && meta) ? 0 : 1;
}

function applyTransform(node, t) {
  node.position.set(t.pos[0], t.pos[1], t.pos[2]);
  node.rotationQuaternion = B.Quaternion.RotationYawPitchRoll(t.rot[1] * R, t.rot[0] * R, t.rot[2] * R);
  node.scaling.set(t.scale[0], t.scale[1], t.scale[2]);
}

// ---- multi-select: one proxy "pivot" node carries the gizmo; its world-matrix change is applied to every selected object ----
let pivotNode = null, grp = null;
const members = () => state.selection.map((id) => nodes.get(id)).filter(Boolean);
/** Node the gizmos attach to: the primary object, or for several objects a pivot at the primary (Pivot) / the bounds centre (Center). */
function attachNodeFor() {
  if (grp && pivotNode) return pivotNode; // mid-drag (a Ctrl press re-applies settings): do not reset the pivot under the gizmo
  const ms = members();
  if (ms.length < 2) return ms[0]?.node ?? null;
  pivotNode ??= new B.TransformNode('pivot', scene);
  let pos = ms[0].node.getAbsolutePosition().clone();
  if (state.settings.center) {
    const lo = new B.Vector3(Infinity, Infinity, Infinity), hi = new B.Vector3(-Infinity, -Infinity, -Infinity);
    for (const m of ms) { const p = m.node.getAbsolutePosition(); lo.minimizeInPlace(p); hi.maximizeInPlace(p); }
    pos = lo.add(hi).scale(0.5);
  }
  pivotNode.position.copyFrom(pos);
  pivotNode.rotationQuaternion = state.settings.local ? ms[0].node.absoluteRotationQuaternion.clone() : B.Quaternion.Identity();
  pivotNode.scaling.setAll(1);
  pivotNode.computeWorldMatrix(true);
  return pivotNode;
}
function startGroup() {
  if (gizmoManager.gizmos.positionGizmo.attachedNode !== pivotNode && gizmoManager.gizmos.rotationGizmo.attachedNode !== pivotNode && gizmoManager.gizmos.scaleGizmo.attachedNode !== pivotNode) return;
  if (!pivotNode) return;
  const inv = new B.Matrix(); pivotNode.computeWorldMatrix(true).invertToRef(inv);
  grp = { p0inv: inv, items: members().map((m) => ({ id: m.entity.id, m, w0: m.node.computeWorldMatrix(true).clone() })) };
}
function applyGroup() {
  const d = grp.p0inv.multiply(pivotNode.computeWorldMatrix(true));
  const scl = new B.Vector3(), q = new B.Quaternion(), pos = new B.Vector3(), pinv = new B.Matrix();
  for (const it of grp.items) {
    const par = it.m.node.parent;
    const w1 = it.w0.multiply(d);
    const local = par ? w1.multiply((par.computeWorldMatrix(true).invertToRef(pinv), pinv)) : w1;
    local.decompose(scl, q, pos);
    it.m.node.position.copyFrom(pos); it.m.node.rotationQuaternion = q.clone(); it.m.node.scaling.copyFrom(scl);
  }
}
const r4 = (v) => Math.round(v * 1e4) / 1e4;
function transformOf(node) {
  const e = (node.rotationQuaternion ?? B.Quaternion.FromEulerVector(node.rotation)).toEulerAngles();
  return { pos: [r4(node.position.x), r4(node.position.y), r4(node.position.z)], rot: [r4(e.x / R), r4(e.y / R), r4(e.z / R)], scale: [r4(node.scaling.x), r4(node.scaling.y), r4(node.scaling.z)] };
}

function emitTransform(final) {
  if (grp) {
    applyGroup();
    const list = grp.items.map((it) => { const t = transformOf(it.m.node); it.m.entity.transform = t; return { id: it.id, ...t }; });
    send({ t: 'transforms', items: list, final });
    return;
  }
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

const comp = (e, t) => e.components?.find((c) => c.type === t && c.componentEnabled !== false);

const lockedIds = new Set();
function tag(mesh, id) { mesh.metadata = { entityId: id }; mesh.isPickable = !lockedIds.has(id); }

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
  if (!levels.has(path)) { levels.set(path, null); fetch('/' + path).then((r) => r.json()).then((j) => { levels.set(path, j); if (state.scene) { setScene(); focus(true); } }).catch(() => {}); }
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
      add('#7d8590', C, 0.1, C, (x + 0.5) * C, y0 - 0.02 + (typeof c.h === 'number' ? c.h : 0), (z + 0.5) * C);
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

// Material component / `.mat.json` asset -> Standard material (colour, texture, emissive map, normal map, UV scale, alpha), like the game.
const matCache = new Map();
function matAsset(path) {
  if (!matCache.has(path)) matCache.set(path, fetch('/' + path).then((r) => (r.ok ? r.json() : null)).catch(() => null));
  return matCache.get(path);
}
function fillMaterial(sm, d) {
  sm.diffuseColor = hex(d?.color); sm.specularColor = new B.Color3(0.1, 0.1, 0.1);
  sm.backFaceCulling = !d?.doubleSided;
  const tex = (p, bump) => {
    const t = new B.Texture('/' + p, scene);
    if (d.uvScale) { t.uScale = d.uvScale[0]; t.vScale = d.uvScale[1]; }
    if (d.uvOffset) { t.uOffset = d.uvOffset[0]; t.vOffset = d.uvOffset[1]; }
    return t;
  };
  if (d?.texture) { sm.diffuseTexture = tex(d.texture); sm.diffuseColor = B.Color3.White(); }
  if (d?.normalMap) sm.bumpTexture = tex(d.normalMap);
  if (d?.emissiveMap) { sm.emissiveTexture = tex(d.emissiveMap); sm.emissiveColor = d.emissive ? hex(d.emissive) : B.Color3.White(); }
  else if (d?.emissive) sm.emissiveColor = hex(d.emissive);
  if ((d?.alpha ?? 1) < 1) sm.alpha = d.alpha;
}

// Unity-style light gizmo, shown while the light is selected: wire sphere of `range` (point), cone (spot), arrow (directional).
function lightGizmo(id, d, node) {
  const V = (x, y, z) => new B.Vector3(x, y, z), kind = d.kind ?? 'point', r = d.range ?? 10, N = 48;
  const circle = (f) => Array.from({ length: N + 1 }, (_, i) => { const a = (i / N) * Math.PI * 2; return f(Math.cos(a), Math.sin(a)); });
  let lines;
  if (kind === 'point') lines = [circle((c, s) => V(c * r, s * r, 0)), circle((c, s) => V(c * r, 0, s * r)), circle((c, s) => V(0, c * r, s * r))];
  else if (kind === 'spot') {
    const a = ((d.angle ?? 30) / 2) * Math.PI / 180, rad = Math.tan(a) * r, rim = (c, s) => V(c * rad, s * rad, r);
    lines = [circle(rim), ...[0, 1, 2, 3].map((i) => [V(0, 0, 0), rim(Math.cos(i * Math.PI / 2), Math.sin(i * Math.PI / 2))])];
  } else if (kind === 'directional') lines = [[V(0, 0, 0), V(0, 0, 3)], [V(-.3, 0, 2.6), V(0, 0, 3), V(.3, 0, 2.6)], [V(0, -.3, 2.6), V(0, 0, 3), V(0, .3, 2.6)], circle((c, s) => V(c * .5, s * .5, 0))];
  else return null; // hemispheric: no shape
  const m = B.MeshBuilder.CreateLineSystem(id + '.lightgizmo', { lines }, scene);
  m.color = hex(d.color, '#ffe9a8'); m.parent = node; m.isPickable = false; m.setEnabled(false);
  return m;
}

function buildEntity(e, parentNode, token) {
  const node = new B.TransformNode(e.name || e.id, scene);
  node.parent = parentNode;
  applyTransform(node, e.transform);
  node.setEnabled(e.enabled !== false && !e.hidden);
  if (e.locked || lockedIds.has(parentNode?.metadata?.nordId)) lockedIds.add(e.id);
  node.metadata = { nordId: e.id };
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
      const sm = new B.StandardMaterial(n + 'm', scene); m.material = sm;
      fillMaterial(sm, mat);
      if (mat?.asset) matAsset(mat.asset).then((a) => { if (a && !m.isDisposed()) fillMaterial(sm, { ...mat, ...a }); });
      visual = true;
    }
  }
  const spr = comp(e, 'sprite') ?? comp(e, 'animatedSprite');
  if (spr) {
    // flat textured plane, image size / ppu (3D default 64: the 64 px default sprite is 1 unit); see runtime/babylon/components.js
    const m = B.MeshBuilder.CreatePlane(e.id + '.sprite', { size: 1 }, scene); m.parent = node; tag(m, e.id);
    const sm = createSpriteMaterial(B, scene, e.id + 'spm'); m.material = sm;
    sm.setSprite({ tint: hex(spr.tint, '#ffffff'), alpha: spr.alpha ?? 1, lit: spr.lit !== false });
    if (spr.texture) {
      const t = new B.Texture('/' + spr.texture, scene); sm.setSprite({ texture: t }); t.wrapU = t.wrapV = B.Texture.CLAMP_ADDRESSMODE;
      matAsset(spr.texture + '.meta.json').then((meta) => {
        if (m.isDisposed()) return;
        if (meta?.filter === 'nearest') t.updateSamplingMode(B.Texture.NEAREST_SAMPLINGMODE);
        const fit = () => {
          const sz = t.getSize(), k = 1 / (meta?.ppu && meta.ppu !== 1 ? meta.ppu : 64);
          m.scaling.x = (meta?.frameWidth || sz.width) * k * (spr.flipX ? -1 : 1); m.scaling.y = (meta?.frameHeight || sz.height) * k * (spr.flipY ? -1 : 1);
        };
        if (t.isReady()) fit(); else t.onLoadObservable.addOnce(fit);
      });
    }
    visual = true;
  }
  const model = comp(e, 'model');
  if (model?.path) {
    getContainer(model.path).then((c) => {
      if (!c || token !== buildToken || !nodes.has(e.id)) return;
      const inst = c.instantiateModelsToScene((nm) => `${e.id}.${nm}`, false, { doNotInstantiate: true }); // real meshes: lights stay correct (instances keep stale light lists)
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
    const l = createLight(B, scene, e.id + '.lt', light, node); l.metadata = { on: e.enabled !== false }; sceneLights.push(l);
    const g = lightGizmo(e.id, light, node); if (g) lightGizmos.set(e.id, g);
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
  lightGizmos.clear();
  for (const l of sceneLights) if (!l.isDisposed()) l.dispose(); // hemispheric lights have no parent node, so they would pile up on every rebuild
  sceneLights = [];
  for (const { node } of nodes.values()) { node.getChildMeshes(false).forEach((m) => m.dispose()); }
  for (const { node } of [...nodes.values()].reverse()) node.dispose();
  nodes.clear(); lockedIds.clear(); matCache.clear();
  for (const e of state.scene?.entities ?? []) buildEntity(e, null, buildToken);
  ambientLight = applyAmbient(B, scene, state.scene?.settings);
  setSelection();
  setSettings();
}

let hemi, sun, ambientLight = null, sceneLights = [], lightGizmos = new Map(); // default editor lights vs the scene's own lights
let outlined = [];
let iconMeshes = [], colliderMeshes = [], ghostMesh = null;
export function setSelection() {
  const id = state.selection[0];
  for (const [gid, g] of lightGizmos) if (!g.isDisposed()) g.setEnabled(state.selection.includes(gid) && state.settings.icons !== false);
  applyGizmos(attachNodeFor());
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
  // Scene lighting (Gizmos menu): the scene's own lights, ambient included; otherwise the editor's default light rig
  const useScene = s.sceneLighting !== false && (sceneLights.some((l) => l.metadata?.on) || !!ambientLight);
  hemi?.setEnabled(!useScene); sun?.setEnabled(!useScene); ambientLight?.setEnabled(useScene);
  for (const l of sceneLights) if (!l.isDisposed()) l.setEnabled(useScene && l.metadata?.on);
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
  const hit = scene.pick(m.x, m.y, (mm) => !!mm.metadata?.entityId && mm.isPickable);
  if (hit?.hit && !/\.(prefab|scene)\.json$/i.test(m.path)) { send({ t: 'addAsset', path: m.path, onto: hit.pickedMesh.metadata.entityId }); return; }
  const p = groundPoint(m.x, m.y);
  send({ t: 'addAsset', path: m.path, pos: [snap3(p.x), 0, snap3(p.z)] });
}

/** Scene view camera as a game camera transform (entity rot = [pitch, yaw, roll] degrees, Babylon yaw/pitch/roll order). */
export function viewPose() {
  const p = camera.position, f = camera.getTarget().subtract(p).normalize();
  const D = 180 / Math.PI, r = (v) => Math.round(v * 1000) / 1000;
  return { pos: [r(p.x), r(p.y), r(p.z)], rot: [r(Math.asin(Math.max(-1, Math.min(1, -f.y))) * D), r(Math.atan2(f.x, f.z) * D), 0] };
}

export function focus(all) {
  if (all || !nodes.get(state.selection[0])) {
    const roots = [...nodes.values()].map((n) => n.node).filter((n) => n.getChildMeshes().length);
    if (!roots.length) return;
    let min = new B.Vector3(Infinity, Infinity, Infinity), max = new B.Vector3(-Infinity, -Infinity, -Infinity);
    for (const r of roots) { const b = r.getHierarchyBoundingVectors(true); min = B.Vector3.Minimize(min, b.min); max = B.Vector3.Maximize(max, b.max); }
    camera.setTarget(min.add(max).scale(0.5));
    camera.radius = Math.max(2, max.subtract(min).length() * 1.2);
    camera.beta = Math.min(camera.beta, 1.0); // look down at ~55° like Unity's default Scene view, not along the ground
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
  const c = document.createElement('canvas'); c.width = c.height = 256;
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
  pivot: () => pivotNode, axisHits: () => axisHits, entitiesInRect,
  drag: (fn) => { startGroup(); fn(pivotNode); emitTransform(true); grp = null; },
  screenOf(id) {
    const n = nodes.get(id)?.node; if (!n) return null;
    const v = B.Vector3.Project(n.getAbsolutePosition(), B.Matrix.Identity(), scene.getTransformMatrix(), camera.viewport.toGlobal(engine.getRenderWidth(), engine.getRenderHeight()));
    return [v.x / (devicePixelRatio || 1), v.y / (devicePixelRatio || 1)];
  },
};

