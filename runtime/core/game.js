// Game: owns the active scene and shared services. Backends subclass/compose it (see runtime/phaser, runtime/babylon).
import { Events } from './events.js';
import { Input } from './input.js';
import { Save } from './save.js';
import { Rng } from './util.js';
import { Scene } from './scene.js';
import { resolveAttributes } from './script.js';
import { EventSheet } from './eventsheet/sheet.js';
import { attachGraph } from './graph/runner.js';
import { I18n, Accessibility } from './i18n.js';
import { Debugger } from './debug.js';
import { Effects } from './effects.js';
import { Timelines } from './timeline.js';
import { loadAddons } from './addons.js';
import { Multiplayer } from './multiplayer.js';

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
    this.net = new Multiplayer(this);
    this.effects = new Effects(this);
    this.i18n = new I18n(this); this.a11y = new Accessibility(this);
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
    const sheet = (p) => p.endsWith('.events.json') && !!this.scene?.eventSheet;
    if (!paths?.length || !paths.every((p) => (p.endsWith('.js') && this._scripts.has(p)) || sheet(p))) return false;
    for (const p of paths) if (!sheet(p)) this.hotReloadScript(p);
    if (paths.some(sheet)) this.hotReloadSheet();
    return true;
  }
  /** Swap in the edited event sheet while the game keeps running: global variables (same name + type), group on/off and the sheet clock survive. */
  async hotReloadSheet() {
    const scene = this.scene, old = scene?.eventSheet;
    if (!old) return false;
    try {
      for (const p of Object.keys(old.sheets)) this.loader?.forget(p);
      const fresh = await EventSheet.load(scene, scene.settings.eventSheet ?? scene.data.eventSheet);
      for (const [k, v] of old.globals) if (fresh.globals.has(k) && typeof fresh.globals.get(k) === typeof v && !fresh.consts.has(k)) fresh.globals.set(k, v);
      for (const [t, g] of old.groups) if (fresh.groups.has(t)) fresh.groups.get(t).active = g.active;
      fresh.time = old.time; fresh.tickCount = old.tickCount;
      old._off?.(); fresh.listen();
      const i = scene.systems.indexOf(old);
      if (i >= 0) scene.systems[i] = fresh; else scene.systems.push(fresh);
      scene.eventSheet = fresh;
      this.overlay?.clear?.(); this.events.emit('hotReload', { path: 'event sheet', count: 1 });
      return true;
    } catch (err) { this.reportError(err, { constructor: { name: 'EventSheet' } }, 'hotReload'); return false; }
  }
  async loadScene(path = this.project.startScene, { preservePersistent = true, reset = false } = {}) {
    if (!this._i18nReady) { this._i18nReady = true; await this.i18n.init(); await loadAddons(this); }
    const kept = (preservePersistent ? (this.scene?.roots ?? []) : []).flatMap((r) => [...r.all()]).filter((e) => e.behavior('Persist') && !e.parent).map((e) => e.toJSON());
    this.effects.clear('scene'); this.effects.prune();
    this.scene?.destroy();
    this.events.emit('sceneUnload', this.scene?.name);
    if (reset) {
      this.paused = false; this.timeScale = 1;
      this.time.delta = 0; this.time.elapsed = 0;
      this.input.reset();
    }
    this._scenePath = path;
    const scene = new Scene(this, structuredClone(await this.loadJSON(path)));
    this.scene = scene;
    await scene.build();
    for (const d of kept) { // Persist behavior: the surviving instance replaces the layout's own copy of the same name
      const dup = scene.roots.find((r) => r.name === d.name && r.behavior('Persist'));
      if (dup) dup.destroy();
      await scene.spawnData(d);
    }
    this.effects.addAll('scene', scene.settings.effects);
    for (const e of scene.all()) if (e._effectData?.length) this.effects.addAll(e, e._effectData);
    if (scene.settings.timelines) scene.systems.push(scene.timelines = new Timelines(scene, scene.settings.timelines));
    const sheet = scene.settings.eventSheet ?? scene.data.eventSheet;
    if (sheet) scene.systems.push(scene.eventSheet = await EventSheet.load(scene, sheet));
    for (const p of scene.settings.graphs ?? []) await attachGraph(this, scene, p); // scene-level graphs (no entity)
    scene.start();
    this.events.emit('sceneLoad', scene.name);
    return scene;
  }
  /** Reload the current scene from its saved data. Resumes, resets time/input and drops Persist state by default.
   * Save storage, asset/module caches and game services survive. Concurrent restart calls share one Promise.
   * @param {object} options { preservePersistent?: boolean } opt in to migrating Persist entities
   * @returns {Promise<Scene>} fresh scene, after init/start
   */
  restart({ preservePersistent = false } = {}) {
    if (this._restartPromise) return this._restartPromise;
    this._restartPromise = this.loadScene(this._scenePath ?? this.project.startScene, { preservePersistent, reset: true })
      .finally(() => { this._restartPromise = null; });
    return this._restartPromise;
  }
  pause() { this.paused = true; this.events.emit('pause'); }
  resume() { this.paused = false; this.events.emit('resume'); }
  /** Backends call this from their render loop with real delta seconds. */
  tick(dt) {
    const d = this.debug;
    if (d) { dt = d.begin(dt); if (dt === null) return; }
    if (!this.paused) this.scene?.tick(dt);
    d?.end();
  }
  /** Debugger + profiler (see debug.js). Returns the Debugger. */
  enableDebug() { return this.debug ??= new Debugger(this); }
}
