// PlayCanvas 3D backend (optional 4th web tier, target `web-3d-pc`). Same project/scene/scripting model as the Babylon backend, but no physics yet.
// Requires the global `pc` (vendor/playcanvas/playcanvas.min.js). Nord 3D data is left-handed (Babylon convention): the backend mirrors Z when it
// writes transforms, so a scene looks the same here. Not supported: rigidbody/collider/trigger, particles, postProcess, skybox (warned once).
import { createGame, errorOverlay, registerCoreComponents } from '../core/index.js';
import { attachDom } from '../core/input.js';
import { registerPlayCanvasComponents } from './components.js';

export const color = (pc, c, d = '#ffffff') => { const h = (typeof c === 'string' && /^#[0-9a-f]{6}/i.test(c) ? c : d).slice(1, 7); return new pc.Color(parseInt(h.slice(0, 2), 16) / 255, parseInt(h.slice(2, 4), 16) / 255, parseInt(h.slice(4, 6), 16) / 255); };

export async function boot(project, opts = {}) {
  const pc = globalThis.pc;
  if (!pc) throw new Error('[nord] pc global not found; load vendor/playcanvas/playcanvas.min.js first');
  const d = project.display ?? {};
  const container = opts.container ?? document.body;
  const overlay = errorOverlay(container);
  const game = createGame(project, { ...opts, container, onError: (err, s, m) => { console.error(`[nord] ${s?.constructor?.name ?? 'script'}.${m}:`, err); overlay.show(`${s?.constructor?.name ?? 'script'}.${m}: ${err?.stack ?? err}`); } });
  game.overlay = overlay;

  const canvas = document.createElement('canvas');
  canvas.style.cssText = 'width:100%;height:100%;display:block;outline:none;touch-action:none';
  container.insertBefore(canvas, container.firstChild);
  const app = new pc.Application(canvas, { graphicsDeviceOptions: { antialias: true, preserveDrawingBuffer: !!opts.preserveDrawingBuffer }, mouse: null, touch: null, keyboard: null });
  app.setCanvasResolution(pc.RESOLUTION_AUTO);
  app.setCanvasFillMode(pc.FILLMODE_NONE);
  const fit = () => app.resizeCanvas(container.clientWidth || window.innerWidth, container.clientHeight || window.innerHeight);
  fit();
  window.addEventListener('resize', fit);

  const backend = new Backend(game, project, pc, app, canvas);
  game.backend = backend;
  registerCoreComponents(game);
  registerPlayCanvasComponents(backend);
  if (project.physics?.engine && project.physics.engine !== 'none') game.warn(`[nord] the PlayCanvas tier has no physics yet ('${project.physics.engine}' ignored)`);
  backend.clear = color(pc, d.background, '#2e3440');

  game.gui = null;
  game._detachInput = attachDom(game.input, canvas, window, () => [0, 0]);
  game.pick = (x = game.input.pointer.x, y = game.input.pointer.y) => backend.pick(x, y);
  document.addEventListener('visibilitychange', () => (document.hidden ? game.audio.suspend() : game.audio.resume()));

  app.on('update', (dt) => {
    for (const pad of navigator.getGamepads?.() ?? []) if (pad) { game.input.pollGamepad(pad); break; }
    game.tick(Math.min(dt, 0.1));
  });
  app.start();
  window.__nord = game;
  try { await game.loadScene(project.startScene); overlay.clear(); } catch (e) { overlay.show(String(e?.stack ?? e)); throw e; }
  if (!backend.camera) { // no camera component: make a default one so the scene is never black by accident
    const cam = new pc.Entity('default-camera', app);
    cam.addComponent('camera', { clearColor: backend.clear, fov: 60 });
    cam.setPosition(0, 2, 8); cam.lookAt(0, 0, 0);
    app.root.addChild(cam); backend.camera = cam;
    game.warn('[nord] scene has no camera component; using a default camera');
  }
  return game;
}

export class Backend {
  constructor(game, project, pc, app, canvas) {
    this.game = game; this.project = project; this.pc = pc; this.app = app; this.canvas = canvas;
    this.physics = null; this.camera = null; this.models = new Map(); this.textures = new Map(); this._warned = new Set();
  }
  warnOnce(msg) { if (!this._warned.has(msg)) { this._warned.add(msg); this.game.warn(`[nord] ${msg}`); } }
  // ---- assets ----------------------------------------------------------
  prepare(data) { return this.preload((data.components ?? []).filter((c) => c.type === 'model' && c.path).map((c) => c.path)); }
  preload(models = []) {
    return Promise.all([...new Set(models)].filter((p) => !this.models.has(p)).map((p) => {
      const asset = new this.pc.Asset(p, 'container', { url: this.game.loader.url(p), filename: p.split('/').pop() });
      this.models.set(p, asset);
      return new Promise((res, rej) => { asset.once('load', res); asset.once('error', (e) => rej(new Error(`[nord] failed to load model ${p}: ${e}`))); this.app.assets.add(asset); this.app.assets.load(asset); });
    }));
  }
  /** Texture asset by project path (cached). Calls `cb(texture)` when ready. */
  texture(path, cb) {
    let a = this.textures.get(path);
    if (!a) { a = new this.pc.Asset(path, 'texture', { url: this.game.loader.url(path), filename: path.split('/').pop() }); this.textures.set(path, a); this.app.assets.add(a); this.app.assets.load(a); }
    if (a.resource) cb(a.resource); else a.ready((x) => cb(x.resource));
  }

  // ---- entity <-> native ------------------------------------------------
  createNative(e) {
    const n = new this.pc.Entity(e.name, this.app);
    n.nordEntity = e; e.native = n;
    (e.parent?.native ?? this.app.root).addChild(n);
    this.#apply(e);
    n.enabled = e.enabled;
  }
  // Mirror Z (left-handed Nord data → right-handed PlayCanvas): pos z and rot x,y flip sign.
  #apply(e) {
    const n = e.native, t = e.t;
    n.setLocalPosition(t.pos[0], t.pos[1], -t.pos[2]);
    n.setLocalEulerAngles(-t.rot[0], -t.rot[1], t.rot[2]);
    n.setLocalScale(t.scale[0], t.scale[1], t.scale[2]);
  }
  syncTransform(e) { if (e.native) this.#apply(e); }
  setEnabled(e) { for (const x of e.all()) if (x.native) x.native.enabled = x.enabled; }
  destroyNative(e) { e.native?.destroy(); e.native = null; }
  step() {}
  pick(x, y) {
    if (!this.camera) return null;
    const cam = this.camera.camera, ray = new this.pc.Ray(), p = new this.pc.Vec3();
    const near = cam.screenToWorld(x, y, cam.nearClip), far = cam.screenToWorld(x, y, cam.farClip);
    ray.origin.copy(near); ray.direction.sub2(far, near).normalize();
    let best = null, bd = Infinity;
    for (const mi of this.app.scene.layers.getLayerById(this.pc.LAYERID_WORLD)?.meshInstances ?? []) {
      let n = mi.node; while (n && !n.nordEntity) n = n.parent;
      if (!n || !mi.visible || !mi.aabb.intersectsRay(ray, p)) continue;
      const dist = p.distance(ray.origin);
      if (dist < bd) { bd = dist; best = { entity: n.nordEntity, point: [p.x, p.y, -p.z], distance: dist }; }
    }
    return best;
  }
}
