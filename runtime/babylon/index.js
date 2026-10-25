// Babylon 3D backend. `boot(project, opts)` creates Engine+Scene, wires core services, Havok physics, loads the start scene.
// Requires globals BABYLON (+ BABYLON.GUI optional, loaders for glTF, HavokPhysics for physics) — see examples/conformance-3d/index.html.
import { createGame, devSceneOverride, errorOverlay, registerCoreComponents } from '../core/index.js';
import { attachDom } from '../core/input.js';
import { registerBabylonComponents } from './components.js';
import { HavokAdapter } from './physics.js';
import { createGui } from './gui.js';
import { applyAmbient, allowManyLights, createLightCuller, qualitySettings } from './lighting.js';

export const rgb = (B, c, d = '#ffffff') => B.Color3.FromHexString((typeof c === 'string' && /^#[0-9a-f]{6}/i.test(c) ? c : d).slice(0, 7));
const D2R = Math.PI / 180;

export async function boot(project, opts = {}) {
  const B = globalThis.BABYLON;
  if (!B) throw new Error('[nord] BABYLON global not found; load vendor/babylonjs/babylon.js first');
  const d = project.display ?? {};
  const container = opts.container ?? document.body;
  const libBase = opts.libBase ?? '/vendor';
  const overlay = errorOverlay(container);
  const game = createGame(project, { ...opts, container, onError: (err, s, m) => { console.error(`[nord] ${s?.constructor?.name ?? 'script'}.${m}:`, err); overlay.show(`${s?.constructor?.name ?? 'script'}.${m}: ${err?.stack ?? err}`); } });
  game.overlay = overlay;

  const canvas = document.createElement('canvas');
  canvas.style.cssText = 'width:100%;height:100%;display:block;outline:none;touch-action:none';
  container.insertBefore(canvas, container.firstChild);
  const quality = qualitySettings(project);
  const engine = new B.Engine(canvas, quality.antialiasing && !d.pixelArt, { preserveDrawingBuffer: !!opts.preserveDrawingBuffer, stencil: true, adaptToDeviceRatio: true });
  if (quality.renderScale < 1) engine.setHardwareScalingLevel(1 / quality.renderScale);
  const scene = new B.Scene(engine);
  scene.clearColor = B.Color4.FromHexString(`${(d.background ?? '#2e3440').slice(0, 7)}ff`);
  scene.useRightHandedSystem = false;

  const backend = new Backend(game, project, B, engine, scene, canvas);
  game.backend = backend; backend.quality = quality;
  registerCoreComponents(game);
  registerBabylonComponents(backend);
  allowManyLights(B, scene, quality.maxLights);
  const culler = createLightCuller(B, scene);
  game.events.on('sceneLoad', () => applyAmbient(B, scene, game.scene?.settings)); // scene ambient light

  const eng = project.physics?.engine;
  if (eng === 'havok' || eng === undefined) {
    try {
      if (globalThis.HavokPhysics) {
        const hk = await globalThis.HavokPhysics({ locateFile: (f) => opts.locateLib?.(f) ?? `${libBase}/havok/${f}` });
        game.physics = backend.physics = new HavokAdapter(backend, hk, project.physics?.gravity ?? [0, -9.81, 0]);
      } else if (eng === 'havok') game.warn('[nord] HavokPhysics global not found; physics disabled');
    } catch (e) { game.warn(`[nord] Havok init failed: ${e.message}`); }
  }
  game.gui = createGui(game, backend);
  game._detachInput = attachDom(game.input, canvas, window, () => [0, 0]);
  game.pick = (x = game.input.pointer.x, y = game.input.pointer.y) => backend.pick(x, y);
  window.addEventListener('resize', () => engine.resize());
  document.addEventListener('visibilitychange', () => (document.hidden ? game.audio.suspend() : game.audio.resume()));

  engine.runRenderLoop(() => {
    for (const pad of navigator.getGamepads?.() ?? []) if (pad) { game.input.pollGamepad(pad); break; }
    backend.physics?.flushDirty();
    culler.update(engine.getDeltaTime() / 1000);
    game.tick(engine.getDeltaTime() / 1000);
    if (scene.activeCamera) scene.render();
  });
  window.__nord = game;
  try { await game.loadScene(devSceneOverride(project)); overlay.clear(); } catch (e) { overlay.show(String(e?.stack ?? e)); throw e; }
  if (!scene.activeCamera) { // no camera component: make a default one so the scene is never black by accident
    const cam = new B.FreeCamera('default', new B.Vector3(0, 2, -8), scene); cam.setTarget(B.Vector3.Zero()); cam.attachControl?.(canvas, false);
    game.warn('[nord] scene has no camera component; using a default camera');
  }
  return game;
}

export class Backend {
  constructor(game, project, B, engine, scene, canvas) {
    this.game = game; this.project = project; this.B = B; this.engine = engine; this.scene = scene; this.canvas = canvas;
    this.physics = null; this.shadows = new Set(); this.models = new Map(); this.textures = new Map(); this._q = Promise.resolve();
  }
  // ---- assets ----------------------------------------------------------
  prepare(data) {
    const models = (data.components ?? []).filter((c) => c.type === 'model' && c.path).map((c) => c.path);
    return this.preload(models);
  }
  preload(models = []) {
    const run = async () => {
      for (const p of new Set(models)) {
        if (this.models.has(p)) continue;
        const url = this.game.loader.url(p);
        if (!this.B.LoadAssetContainerAsync) throw new Error('[nord] BABYLON loaders not loaded (babylonjs.loaders.min.js) — needed for glTF models');
        this.models.set(p, await this.B.LoadAssetContainerAsync(url, this.scene, { pluginExtension: p.slice(p.lastIndexOf('.')) }));
      }
    };
    const p = this._q.then(run);
    this._q = p.catch(() => {});
    return p;
  }
  /** Texture by project path (cached; honours inlined file:// bundles through the loader). */
  texture(path, { srgb = true } = {}) {
    const k = `${path}:${srgb}`;
    if (!this.textures.has(k)) {
      const t = new this.B.Texture(this.game.loader.url(path), this.scene, false, true, this.B.Texture.TRILINEAR_SAMPLINGMODE, null, null, null, false, null);
      this.textures.set(k, t);
      // import settings from the sidecar <asset>.meta.json: filter 'nearest', wrap 'clamp'
      this.game.loader.meta?.(path).then((m) => {
        if (m?.filter === 'nearest') t.updateSamplingMode(this.B.Texture.NEAREST_SAMPLINGMODE);
        if (m?.wrap === 'clamp') { t.wrapU = t.wrapV = this.B.Texture.CLAMP_ADDRESSMODE; }
      }).catch(() => {});
    }
    return this.textures.get(k);
  }

  // ---- entity <-> native ------------------------------------------------
  createNative(e) {
    const n = new this.B.TransformNode(e.name, this.scene);
    n.metadata = { entity: e };
    e.native = n;
    if (e.parent?.native) n.parent = e.parent.native;
    this.#apply(e);
    n.setEnabled(e.enabled);
  }
  #apply(e) {
    const n = e.native, t = e.t, B = this.B;
    n.position.set(t.pos[0], t.pos[1], t.pos[2]);
    n.rotationQuaternion = B.Quaternion.RotationYawPitchRoll(t.rot[1] * D2R, t.rot[0] * D2R, t.rot[2] * D2R);
    n.scaling.set(t.scale[0], t.scale[1], t.scale[2]);
  }
  syncTransform(e, what) { if (e.native) { this.#apply(e); e.native.computeWorldMatrix(true); this.physics?.teleported(e, what === 'rot'); } } // rotating a body from a script keeps its linear velocity (FPS yaw, vehicle steering); moving it zeroes velocity (teleport)
  /** Re-parenting (Scene.reparent): Babylon's setParent keeps the world transform, then the local numbers are read back into the entity. */
  beforeReparent() { return null; }
  afterReparent(e, _token, keepWorld) {
    const n = e.native; if (!n) return;
    const pn = e.parent?.native ?? null;
    if (!keepWorld) { n.parent = pn; this.#apply(e); n.computeWorldMatrix(true); return; }
    n.computeWorldMatrix(true); n.setParent(pn); n.computeWorldMatrix(true);
    const r = (n.rotationQuaternion ?? this.B.Quaternion.Identity()).toEulerAngles();
    e.t.pos = [n.position.x, n.position.y, n.position.z];
    e.t.rot = [r.x / D2R, r.y / D2R, r.z / D2R];
    e.t.scale = [n.scaling.x, n.scaling.y, n.scaling.z];
    this.physics?.teleported(e, true);
  }
  setEnabled(e, on) { for (const x of e.all()) { x.native?.setEnabled(x.enabled); this.physics?.enable(x, x.enabled); } }
  destroyNative(e) { this.physics?.forget(e); e.native?.dispose(false, false); e.native = null; }
  step(dt) { this.physics?.step(dt); }
  /** Does the active camera see any mesh of this entity? (OnBecameVisible / OnBecameInvisible) */
  isVisible(e) {
    const planes = this.scene.frustumPlanes; if (!planes) return false;
    const meshes = e.__meshes ?? [];
    if (!meshes.length) return true; // nothing to see: treated as visible
    return meshes.some((m) => m.isEnabled() && m.isVisible && m.isInFrustum(planes));
  }
  // ---- camera maths for Unity's Camera.WorldToScreenPoint / ScreenToWorldPoint / ScreenPointToRay (screen = canvas pixels, origin top-left, like Input.mousePosition) ----
  /** World point → `{ x, y, z }`: canvas pixels and the distance in front of the camera (negative = behind it). */
  projectToScreen(p) {
    const B = this.B, cam = this.scene.activeCamera; if (!cam) return null;
    const w = this.engine.getRenderWidth(), h = this.engine.getRenderHeight(), world = new B.Vector3(p[0], p[1], p[2]);
    const s = B.Vector3.Project(world, B.Matrix.IdentityReadOnly, this.scene.getTransformMatrix(), cam.viewport.toGlobal(w, h));
    return { x: s.x, y: s.y, z: B.Vector3.TransformCoordinates(world, cam.getViewMatrix()).z };
  }
  /** The ray through a screen pixel: `{ origin, direction }` (arrays). */
  screenRay(x, y) {
    const B = this.B, cam = this.scene.activeCamera; if (!cam) return null;
    const r = this.scene.createPickingRay(x, y, B.Matrix.IdentityReadOnly, cam);
    return { origin: r.origin.asArray(), direction: r.direction.asArray() };
  }
  /** Screen pixel + depth in front of the camera → world point. */
  screenToWorld(x, y, depth) {
    const r = this.screenRay(x, y); if (!r) return null;
    const cam = this.scene.activeCamera, fwd = cam.getForwardRay(1).direction, eye = cam.globalPosition;
    // the picking ray starts on the near plane: measure the depth from the eye, along the camera's forward axis
    const dot = (a) => a[0] * fwd.x + a[1] * fwd.y + a[2] * fwd.z, ahead = dot([r.origin[0] - eye.x, r.origin[1] - eye.y, r.origin[2] - eye.z]), k = (depth - ahead) / (dot(r.direction) || 1);
    return [r.origin[0] + r.direction[0] * k, r.origin[1] + r.direction[1] * k, r.origin[2] + r.direction[2] * k];
  }
  /** View and projection matrices as 16-number arrays. */
  cameraMatrices() { const cam = this.scene.activeCamera; return cam ? { view: Array.from(cam.getViewMatrix().m), projection: Array.from(cam.getProjectionMatrix().m) } : null; }
  pick(x, y) {
    const r = this.scene.pick(x, y);
    if (!r?.hit) return null;
    let n = r.pickedMesh;
    while (n && !n.metadata?.entity) n = n.parent;
    return { entity: n?.metadata?.entity ?? null, point: r.pickedPoint?.asArray() ?? null, distance: r.distance };
  }
}
