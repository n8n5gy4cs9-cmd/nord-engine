// Game: owns the active scene and shared services. Backends subclass/compose it (see runtime/phaser, runtime/babylon).
import { Events } from './events.js';
import { Input } from './input.js';
import { Save } from './save.js';
import { Rng } from './util.js';
import { Scene } from './scene.js';

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
