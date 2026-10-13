// Game: owns the active scene and shared services. Backends subclass/compose it (see runtime/phaser, runtime/babylon).
import { Events } from './events.js';
import { Input } from './input.js';
import { Save } from './save.js';
import { Rng } from './util.js';
import { Scene } from './scene.js';
import { resolveAttributes } from './script.js';

export class Game {
  /**
   * @param {object} project parsed nord.project.json
   * @param {object} opts { backend, fetchJSON(path), importScript(path)->module, storage, onError }
   */
  constructor(project, opts = {}) {
    this.project = project;
    this.backend = opts.backend ?? null;
    this.fetchJSON = opts.fetchJSON ?? (async (p) => (await fetch(p)).json());
    this.importScript = opts.importScript ?? ((p) => import(/* @vite-ignore */ new URL(p, document.baseURI).href));
    this.onError = opts.onError ?? ((err, s, m) => console.error(`[nord] ${s?.constructor?.name ?? 'script'}.${m}:`, err));
    this.events = new Events();
    this.input = new Input(project.input?.actions ?? {});
    this.save = new Save(project.id, { storage: opts.storage });
    this.rng = new Rng(opts.seed);
    this.time = { delta: 0, elapsed: 0 };
    this.timeScale = 1;
    this.paused = false;
    this.audio = null; this.ui = null; this.physics = null;
    this.scene = null;
    this.errors = [];
    this._scripts = new Map();
    this._scenePath = null;
  }
  warn(m) { console.warn(m); }
  reportError(err, script, method) { this.errors.push({ err, script, method }); this.onError(err, script, method); this.events.emit('error', { err, script, method }); }
  loadJSON(path) { return this.fetchJSON(path); }
  async loadScript(path, { fresh = false } = {}) {
    if (fresh || !this._scripts.has(path)) {
      const mod = await this.importScript(fresh ? `${path}?v=${Date.now()}` : path);
      this._scripts.set(path, mod.default ?? null);
    }
    return this._scripts.get(path);
  }
  /**
   * Re-import a script module (cache-busted) and swap the prototype of every live instance, keeping its fields.
   * Each instance gets `onHotReload(oldState)` if defined (oldState = shallow copy of its own fields). Attributes are re-resolved
   * against the new class so added/removed attributes take effect. Relative imports *of* the script are not re-fetched.
   * Returns the number of instances patched; on a syntax/runtime error nothing changes and the error is shown/returned.
   */
  async hotReloadScript(path) {
    let Class;
    try { Class = await this.loadScript(path, { fresh: true }); } catch (err) { this.reportError(err, { constructor: { name: path } }, 'hotReload'); return -1; }
    if (!Class) return 0;
    let n = 0;
    for (const e of this.scene?.all() ?? []) {
      for (const s of e.scripts) {
        if (s._path !== path) continue;
        const old = { ...s };
        Object.setPrototypeOf(s, Class.prototype);
        s.attrs = resolveAttributes(Class, s.attrs, (m) => this.warn(m));
        try { s.onHotReload?.(old); } catch (err) { this.reportError(err, s, 'onHotReload'); }
        n++;
      }
    }
    this.overlay?.clear?.();
    this.events.emit('hotReload', { path, count: n });
    return n;
  }
  /** Dev-server hook (see serve.rs): returns true if every changed file was a script we hot-swapped; false → caller reloads the page. */
  hotReload(paths) {
    if (!paths?.length || !paths.every((p) => p.endsWith('.js') && this._scripts.has(p))) return false;
    for (const p of paths) this.hotReloadScript(p);
    return true;
  }
  async loadScene(path = this.project.startScene) {
    this.scene?.destroy();
    this.events.emit('sceneUnload', this.scene?.name);
    this._scenePath = path;
    const scene = new Scene(this, await this.loadJSON(path));
    this.scene = scene;
    await scene.build();
    scene.start();
    this.events.emit('sceneLoad', scene.name);
    return scene;
  }
  restart() { return this.loadScene(this._scenePath); }
  pause() { this.paused = true; this.events.emit('pause'); }
  resume() { this.paused = false; this.events.emit('resume'); }
  /** Backends call this from their render loop with real delta seconds. */
  tick(dt) { if (!this.paused) this.scene?.tick(dt); }
}
