// Phaser 2D backend. `boot(project, opts)` creates the Phaser game, wires core services, loads the start scene.
// Requires the global `Phaser` (vendor/phaser/phaser.min.js loaded before this module).
import { createGame, errorOverlay, registerCoreComponents, registerComponent } from '../core/index.js';
import { toWorld } from './transform.js';
import { createEffect } from './effects.js';
import { registerPhaserComponents } from './components.js';
import { ArcadeAdapter, MatterAdapter } from './physics.js';

const BLEND_MODES = { normal: 0, add: 1, multiply: 2, screen: 3 };
const SCALE = (P) => ({ fit: P.Scale.FIT, fill: P.Scale.ENVELOP, stretch: P.Scale.RESIZE, none: P.Scale.NONE });

/** Collect every asset path (by kind) that an entity's components reference. */
function assetsOf(data) {
  const out = { tex: [], map: [] };
  for (const c of data.components ?? []) {
    if (['sprite', 'animatedSprite', 'particles', 'parallax', 'tiledBackground', 'ninePatch', 'spriteFont'].includes(c.type) && c.texture) out.tex.push(c.texture);
    if (c.type === 'tilemap') { if (c.tileset) out.tex.push(c.tileset); if (c.map) out.map.push(c.map); }
  }
  return out;
}

export async function boot(project, opts = {}) {
  const P = globalThis.Phaser;
  if (!P) throw new Error('[nord] Phaser global not found; load vendor/phaser/phaser.min.js first');
  const d = project.display ?? {};
  const container = opts.container ?? document.body;
  const overlay = errorOverlay(container);
  const game = createGame(project, { ...opts, container, onError: (err, s, m) => { console.error(`[nord] ${s?.constructor?.name ?? 'script'}.${m}:`, err); overlay.show(`${s?.constructor?.name ?? 'script'}.${m}: ${err?.stack ?? err}`); } });
  game.overlay = overlay;
  const wantMatter = project.physics?.engine === 'matter';
  const wantArcade = project.physics?.engine === 'arcade' || project.physics?.engine === undefined;

  const backend = new Backend(game, project);
  game.backend = backend;

  await new Promise((resolve, reject) => {
    const NordScene = class extends P.Scene {
      constructor() { super('nord'); }
      create() {
        backend.scene = this;
        this.cameras.main.setBackgroundColor(d.background ?? '#101418');
        resolve();
      }
      update(_t, delta) { backend.frame(delta / 1000); }
    };
    try {
      backend.phaser = new P.Game({
        type: P.AUTO, parent: container, width: d.width ?? 1280, height: d.height ?? 720, backgroundColor: d.background ?? '#101418',
        pixelArt: !!d.pixelArt, roundPixels: !!d.pixelArt, antialias: !d.pixelArt, audio: { noAudio: true }, input: { keyboard: false, gamepad: false },
        scale: { mode: SCALE(P)[d.scale ?? 'fit'] ?? P.Scale.FIT, autoCenter: P.Scale.CENTER_BOTH },
        physics: {
          default: wantMatter ? 'matter' : wantArcade ? 'arcade' : undefined,
          arcade: { debug: !!opts.debug, gravity: { x: 0, y: 0 } },
          matter: { debug: !!opts.debug, gravity: { x: 0, y: 0 } },
        },
        banner: false, scene: NordScene,
      });
    } catch (e) { reject(e); }
  });

  backend.width = backend.phaser.config.width; backend.height = backend.phaser.config.height;
  const canvas = backend.phaser.canvas;
  game.effects.attach(canvas, container);
  game._detachInput = (await import('../core/input.js')).attachDom(game.input, canvas, window, (x, y) => backend.toWorld(x, y));
  backend.init();

  registerCoreComponents(game);
  registerPhaserComponents(backend);
  const gravity = project.physics?.gravity ?? [0, 0, 0];
  if (wantMatter) game.physics = backend.physics = new MatterAdapter(backend, backend.scene, { gravity });
  else if (wantArcade) game.physics = backend.physics = new ArcadeAdapter(backend, backend.scene, { gravity });
  game.camera = backend.cameraApi();

  window.__nord = game;
  document.addEventListener('visibilitychange', () => { if (document.hidden) { game.audio.suspend(); } else game.audio.resume(); });
  try { await game.loadScene(project.startScene); overlay.clear(); } catch (e) { overlay.show(String(e?.stack ?? e)); throw e; }
  return game;
}

class Backend {
  constructor(game, project) { this.game = game; this.project = project; this.lightsOn = false; this.visuals = new Set(); this.maps = new Map(); this.physics = null; this.cameraComp = null; this._q = Promise.resolve(); this.metaCache = new Map(); }
  /** Sidecar metadata of a loaded texture (origin, image points, animations…) or null. */
  metaOf(path) { return this.metaCache.get(path) ?? null; }
  /** Size of one frame (spritesheets) or of the whole image, in pixels. */
  frameSize(path) { const m = this.metaOf(path); if (m?.frameWidth) return [m.frameWidth, m.frameHeight ?? m.frameWidth]; const s = this.scene.textures.exists(path) ? this.scene.textures.get(path).getSourceImage() : null; return s ? [s.width, s.height] : [1, 1]; }
  init() { /* hook for subclasses/tests */ }
  createEffect(target, type, params) { return createEffect(this, target, type, params); }
  texKey(path) { return path; }
  mapKey(path) { return `map:${path}`; }

  // ---- asset prep -------------------------------------------------------
  prepare(data) {
    const a = assetsOf(data);
    return this.preload(a.tex, a.map);
  }
  preload(tex = [], maps = []) {
    const run = async () => {
      const ps = this.scene, L = ps.load, loader = this.game.loader;
      const need = [...new Set(tex)].filter((t) => !ps.textures.exists(t));
      const metas = {};
      for (const t of need) { metas[t] = await loader.meta(t); this.metaCache.set(t, metas[t]); }
      for (const t of need) {
        const m = metas[t];
        if (m?.type === 'spritesheet') L.spritesheet(t, loader.url(t), { frameWidth: m.frameWidth, frameHeight: m.frameHeight });
        else L.image(t, loader.url(t));
      }
      const mapsNeeded = [...new Set(maps)].filter((m) => !this.maps.has(m));
      const mapJson = {};
      for (const m of mapsNeeded) {
        const j = await loader.json(m);
        mapJson[m] = j;
        if (j.tiledversion || j.type === 'map') { L.tilemapTiledJSON(this.mapKey(m), loader.url(m)); this.maps.set(m, { tiled: true, tileWidth: j.tilewidth, tileHeight: j.tileheight, collides: j.collides }); }
        else this.maps.set(m, { tiled: false, tileWidth: j.tileWidth, tileHeight: j.tileHeight, layers: j.layers, collides: j.collides });
      }
      if (L.list.size || L.inflight?.size) {
        await new Promise((res, rej) => {
          const errs = [];
          L.on('loaderror', (f) => errs.push(f.src));
          L.once('complete', () => (errs.length ? rej(new Error(`[nord] failed to load: ${errs.join(', ')}`)) : res()));
          L.start();
        });
      }
      for (const t of need) this.#postTexture(t, metas[t]);
    };
    const p = this._q.then(run);
    this._q = p.catch(() => {});
    return p;
  }
  #postTexture(path, m) {
    const ps = this.scene;
    const tex = ps.textures.get(path);
    if (m?.filter === 'nearest' || this.project.display?.pixelArt) tex.setFilter(globalThis.Phaser.Textures.FilterMode.NEAREST);
    // Animations (sidecar `anims`): { frames, fps, loop, speed, pingPong, repeat, repeatTo, frameDurations, tags }.
    // Per-frame duration multipliers come from `frameDurations[i]` or the sprite editor's `frameProps[<frame>].duration`.
    for (const [name, a] of Object.entries(m?.anims ?? {})) {
      const key = `${path}:${name}`;
      if (ps.anims.exists(key)) continue;
      const fps = (a.fps ?? 10) * (a.speed ?? 1), base = 1000 / fps;
      const frames = (a.frames ?? []).map((f, i) => ({ key: path, frame: f, duration: ((a.frameDurations?.[i] ?? m.frameProps?.[f]?.duration ?? 1) - 1) * base }));
      const loops = a.loop !== false;
      ps.anims.create({ key, frames, frameRate: fps, yoyo: !!a.pingPong, repeat: loops ? (a.repeatTo != null ? 0 : -1) : (a.repeat ?? 0) });
      if (loops && a.repeatTo != null) { // "repeat to": play once, then loop from frame N
        ps.anims.create({ key: `${key}:loop`, frames: frames.slice(a.repeatTo), frameRate: fps, yoyo: !!a.pingPong, repeat: -1 });
      }
    }
    this.metaCache.set(path, m);
  }

  // ---- lights ---------------------------------------------------------
  enableLights() {
    if (this.lightsOn) return;
    this.lightsOn = true;
    this.scene.lights.enable().setAmbientColor(parseInt((this.game.scene?.settings?.ambient ?? '#b8b8c8').slice(1, 7), 16));
    for (const v of this.visuals) if (v.scene) v.setLighting?.(true);
  }

  // ---- entity <-> native -----------------------------------------------
  world(e) { return toWorld(e.t, e.parent ? this.world(e.parent) : null); }
  createNative(e) {
    const c = this.scene.add.container(0, 0);
    e.native = c;
    c.__nordEntity = e;
    this.#apply(e);
    c.setVisible(e.enabled);
  }
  #apply(e) {
    const w = this.world(e), c = e.native;
    c.setPosition(w.x, w.y).setAngle(w.angle).setScale(w.sx, w.sy).setDepth(e.layer * 1000 + w.z);
  }
  syncTransform(e) {
    if (!e.native) return;
    this.#apply(e);
    // an explicit move of a bodied entity teleports the body (arcade reads the container each step; matter needs a nudge)
    const b = this.physics?.bodies.get(e);
    if (b && this.physics.kind === 'matter') this.physics.teleport(e, e.native.x, e.native.y);
    this.syncChildren(e);
  }
  syncChildren(e) { for (const c of e.children) { if (c.native) { this.#apply(c); const b = this.physics?.bodies.get(c); if (b && this.physics.kind === 'matter') this.physics.teleport(c, c.native.x, c.native.y); this.syncChildren(c); } } }
  setEnabled(e, on) {
    for (const x of e.all()) { x.native?.setVisible(x.enabled).setActive(x.enabled); this.physics?.enable(x, x.enabled); }
  }
  destroyNative(e) { this.physics?.forget(e); e.native?.destroy(); e.native = null; }
  step(dt) { this.physics?.step(dt); }
  toWorld(x, y) { const p = this.scene.cameras.main.getWorldPoint(x, y); return [p.x, p.y]; }

  frame(dt) {
    const g = this.game;
    for (const pad of navigator.getGamepads?.() ?? []) if (pad) { g.input.pollGamepad(pad); break; }
    this.physics?.flushDirty();
    g.tick(dt);
    if (g.scene?.settings?.layers) this.#applyLayers(g.scene);
    else if (this._bg?.size) for (const r of this._bg.values()) r.setVisible(false); // previous scene's layer backgrounds
  }

  /**
   * Layer properties (scene.settings.layers[<layer number>]): visible, opacity, parallax [x, y] (Phaser scroll factor: 0 = fixed to the screen,
   * 1 = moves with the world), blend (normal/add/multiply/screen), background (colour fill when transparent === false).
   * Applied each frame so events/scripts that change `scene.settings.layers[...]` take effect immediately.
   */
  #applyLayers(scene) {
    const layers = scene.settings.layers, P = globalThis.Phaser;
    const key = (L) => `${L.parallax?.[0] ?? 1},${L.parallax?.[1] ?? 1},${L.blend ?? 'normal'}`;
    for (const e of scene.all()) {
      const L = layers[e.layer], c = e.native;
      if (!c || !L) continue;
      c.setVisible(e.enabled && L.visible !== false);
      c.setAlpha(L.opacity ?? 1);
      const k = key(L);
      if (e._layerKey !== k) { // only when the layer's parallax/blend changed
        e._layerKey = k;
        c.setScrollFactor(L.parallax?.[0] ?? 1, L.parallax?.[1] ?? 1);
        const mode = BLEND_MODES[L.blend ?? 'normal'] ?? 0;
        for (const comp of e.components) for (const v of comp.visuals ?? []) v.setBlendMode?.(mode);
      }
    }
    this.#layerBackgrounds(scene, layers, P);
  }
  #layerBackgrounds(scene, layers, P) {
    this._bg ??= new Map();
    for (const [id, L] of Object.entries(layers)) {
      const want = L.transparent === false && L.background && L.visible !== false;
      let r = this._bg.get(id);
      if (!want) { r?.setVisible(false); continue; }
      if (!r) { r = this.scene.add.rectangle(0, 0, this.width, this.height, 0).setOrigin(0).setScrollFactor(0); this._bg.set(id, r); }
      r.setVisible(true).setFillStyle(parseInt(String(L.background).replace('#', '').slice(0, 6), 16) || 0, L.opacity ?? 1).setDepth(Number(id) * 1000 - 500);
    }
    for (const [id, r] of this._bg) if (!layers[id]) r.setVisible(false);
  }

  cameraApi() {
    const cam = () => this.scene.cameras.main;
    return {
      get native() { return cam(); },
      shake: (duration = 250, intensity = 0.01) => cam().shake(duration, intensity),
      flash: (duration = 250, color = '#ffffff') => { const c = parseInt(color.slice(1, 7), 16); cam().flash(duration, (c >> 16) & 255, (c >> 8) & 255, c & 255); },
      fade: (duration = 500, color = '#000000') => { const c = parseInt(color.slice(1, 7), 16); cam().fadeOut(duration, (c >> 16) & 255, (c >> 8) & 255, c & 255); },
      fadeIn: (duration = 500) => cam().fadeIn(duration),
      zoom: (z, duration = 0) => (duration ? cam().zoomTo(z, duration) : cam().setZoom(z)),
      follow: (ref, lerp) => this.cameraComp?.follow(ref, lerp),
      center: (x, y) => this.cameraComp ? this.cameraComp.snapTo(x, y) : cam().centerOn(x, y),
    };
  }
}
export { Backend };
export { registerComponent };
