// Babylon 3D backend. `boot(project, opts)` creates Engine+Scene, wires core services, Havok physics, loads the start scene.
// Requires globals BABYLON (+ BABYLON.GUI optional, loaders for glTF, HavokPhysics for physics) — see examples/conformance-3d/index.html.
import { createGame, errorOverlay, registerCoreComponents } from '../core/index.js';
import { attachDom } from '../core/input.js';
import { registerBabylonComponents } from './components.js';
import { HavokAdapter } from './physics.js';
import { createGui } from './gui.js';

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
  const engine = new B.Engine(canvas, !d.pixelArt, { preserveDrawingBuffer: !!opts.preserveDrawingBuffer, stencil: true, adaptToDeviceRatio: true });
  const scene = new B.Scene(engine);
  scene.clearColor = B.Color4.FromHexString(`${(d.background ?? '#2e3440').slice(0, 7)}ff`);
  scene.useRightHandedSystem = false;

  const backend = new Backend(game, project, B, engine, scene, canvas);
  game.backend = backend;
  registerCoreComponents(game);
  registerBabylonComponents(backend);

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
    game.tick(engine.getDeltaTime() / 1000);
    if (scene.activeCamera) scene.render();
  });
  window.__nord = game;
  try { await game.loadScene(project.startScene); overlay.clear(); } catch (e) { overlay.show(String(e?.stack ?? e)); throw e; }
  if (!scene.activeCamera) { // no camera component: make a default one so the scene is never black by accident
    const cam = new B.FreeCamera('default', new B.Vector3(0, 2, -8), scene); cam.setTarget(B.Vector3.Zero()); cam.attachControl?.(canvas, false);
    game.warn('[nord] scene has no camera component; using a default camera');
  }
  return game;
}

export class Backend {
  constructor(game, project, B, engine, scene, canvas) {
    this.game = game; this.project = project; this.B = B; this.engine = engine; this.scene = scene; this.canvas = canvas;
    this.physics = null; this.models = new Map(); this.textures = new Map(); this._q = Promise.resolve();
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
    if (!this.textures.has(k)) this.textures.set(k, new this.B.Texture(this.game.loader.url(path), this.scene, false, true, this.B.Texture.TRILINEAR_SAMPLINGMODE, null, null, null, false, null));
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
  setEnabled(e, on) { for (const x of e.all()) { x.native?.setEnabled(x.enabled); this.physics?.enable(x, x.enabled); } }
  destroyNative(e) { this.physics?.forget(e); e.native?.dispose(false, false); e.native = null; }
  step(dt) { this.physics?.step(dt); }
  pick(x, y) {
    const r = this.scene.pick(x, y);
    if (!r?.hit) return null;
    let n = r.pickedMesh;
    while (n && !n.metadata?.entity) n = n.parent;
    return { entity: n?.metadata?.entity ?? null, point: r.pickedPoint?.asArray() ?? null, distance: r.distance };
  }
}
