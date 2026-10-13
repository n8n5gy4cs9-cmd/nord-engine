// Scene: entity tree, lifecycle (init → start → update/fixedUpdate/lateUpdate), loading, prefabs.
import { Entity } from './entity.js';
import { Scheduler } from './util.js';
import { resolveAttributes } from './script.js';

export const FIXED_DT = 1 / 60;
const MAX_STEPS = 5;

const rid = () => Math.random().toString(36).slice(2, 10).padEnd(8, '0');

/** Deep-merge prefab overrides onto entity data. Plain objects merge; objects with numeric keys patch arrays by index. */
export function applyOverrides(target, ov) {
  if (ov == null || typeof ov !== 'object') return ov;
  if (Array.isArray(target) && !Array.isArray(ov) && Object.keys(ov).every((k) => /^\d+$/.test(k))) {
    for (const [i, v] of Object.entries(ov)) target[i] = typeof v === 'object' && v !== null && !Array.isArray(v) ? applyOverrides(target[i] ?? {}, v) : v;
    return target;
  }
  if (Array.isArray(ov)) return structuredClone(ov);
  for (const [k, v] of Object.entries(ov)) {
    target[k] = v !== null && typeof v === 'object' && !Array.isArray(v) && typeof target[k] === 'object' && target[k] !== null ? applyOverrides(target[k], v) : structuredClone(v);
  }
  return target;
}

export class Scene {
  constructor(game, data = { name: 'scene', entities: [] }) {
    this.game = game;
    this.data = data;
    this.name = data.name;
    this.settings = data.settings ?? {};
    this.backend = game.backend ?? null;
    this.roots = [];
    this.scheduler = new Scheduler();
    this.running = false;
    this.#pending = [];
    this.#dead = new Set();
    this.#acc = 0;
  }
  #pending; #dead; #acc;

  *all() { for (const r of this.roots) yield* r.all(); }
  find(name) { for (const e of this.all()) if (e.name === name) return e; return null; }
  findById(id) { for (const e of this.all()) if (e.id === id) return e; return null; }
  findByTag(tag) { return [...this.all()].filter((e) => e.tags.includes(tag)); }

  /** Build entities (and their components/scripts) from scene data. Scripts are resolved via game.loadScript(path). */
  async build() {
    const made = [];
    for (const d of this.data.entities ?? []) made.push(await this.#make(d, null));
    this.roots.push(...made);
  }

  async #make(data, parent, { regenIds = false } = {}) {
    if (data.prefab?.path) data = await this.#expandPrefab(data);
    await this.backend?.prepare?.(data); // backend preloads textures/models referenced by this entity's components
    const e = new Entity({ ...data, id: regenIds || !data.id ? rid() : data.id }, this, parent);
    this.backend?.createNative?.(e);
    for (const c of e._compData) {
      const { type, ...rest } = c;
      e.addComponent(type, rest);
    }
    for (const sd of e._scriptData) {
      const Class = await this.game.loadScript(sd.path);
      if (!Class) continue;
      const s = new Class(e, resolveAttributes(Class, sd.attributes, (m) => this.game.warn(m)));
      s._path = sd.path;
      e.scripts.push(s);
    }
    for (const cd of data.children ?? []) e.children.push(await this.#make(cd, e, { regenIds }));
    return e;
  }

  async #expandPrefab(data) {
    const pf = await this.game.loadJSON(data.prefab.path);
    const root = structuredClone(pf.root);
    applyOverrides(root, data.prefab.overrides ?? {});
    // instance-level fields on the scene entity win over prefab root
    const merged = { ...root, id: data.id, transform: { ...root.transform, ...data.transform }, prefab: null };
    if (data.name) merged.name = data.name;
    if (data.enabled === false) merged.enabled = false;
    if (data.tags?.length) merged.tags = data.tags;
    return merged;
  }

  /** Spawn at runtime from entity JSON (ids regenerated). Lifecycle runs on the next frame boundary. */
  async spawnData(data, parent = null) {
    const e = await this.#make(data, parent, { regenIds: true });
    (parent ? parent.children : this.roots).push(e);
    this.#pending.push(e);
    return e;
  }
  /** Spawn a prefab file: `scene.spawn('prefabs/bullet.prefab.json', { pos: [x,y,0], overrides: {...} })`. */
  async spawn(path, { pos, rot, scale, overrides, parent = null, name } = {}) {
    const transform = {};
    if (pos) transform.pos = pos;
    if (rot) transform.rot = rot;
    if (scale) transform.scale = scale;
    return this.spawnData({ name, transform, prefab: { path, overrides } }, parent);
  }

  /** init() all, then start() all, once the whole tree exists. */
  start() {
    const ents = [...this.all()];
    for (const e of ents) for (const s of e.scripts) { try { s.init?.(); } catch (err) { this.game.reportError(err, s, 'init'); } }
    this.running = true;
    for (const e of ents) this.#startEntity(e);
    this.#pending = [];
  }
  #startEntity(e) {
    for (const s of e.scripts) {
      if (s._started) continue;
      s._started = true;
      if (e.enabled) { try { s.start?.(); s.onEnable?.(); } catch (err) { this.game.reportError(err, s, 'start'); } }
    }
  }

  /** Advance one frame. `dt` is real seconds; game.timeScale applied here. */
  tick(dt) {
    if (!this.running) return;
    dt = Math.min(dt, 0.25) * this.game.timeScale;
    this.game.time.delta = dt;
    this.game.time.elapsed += dt;
    this.game.input.beginFrame();
    this.#flushSpawns();
    this.#acc += dt;
    for (let n = 0; this.#acc >= FIXED_DT && n < MAX_STEPS; n++, this.#acc -= FIXED_DT) {
      this.#each('fixedUpdate', FIXED_DT);
      this.backend?.step?.(FIXED_DT, this);
    }
    if (this.#acc > FIXED_DT * MAX_STEPS) this.#acc = 0;
    this.scheduler.update(dt);
    this.#each('update', dt);
    for (const e of this.all()) for (const c of e.components) c.impl?.update?.(c, dt);
    this.#each('lateUpdate', dt);
    this.#flushDeaths();
  }
  #each(method, dt) { for (const e of [...this.all()]) e.callScripts(method, dt); }
  #flushSpawns() {
    const p = this.#pending; this.#pending = [];
    for (const root of p) for (const e of root.all()) { for (const s of e.scripts) { try { s.init?.(); } catch (err) { this.game.reportError(err, s, 'init'); } } }
    for (const root of p) for (const e of root.all()) this.#startEntity(e);
  }

  destroyEntity(e) { if (!e.destroyed) { e.destroyed = true; this.#dead.add(e); } }
  #flushDeaths() {
    for (const e of this.#dead) {
      for (const d of [...e.all()].reverse()) {
        d.destroyed = true;
        for (const s of d.scripts) { try { s.onDestroy?.(); } catch (err) { this.game.reportError(err, s, 'onDestroy'); } }
        for (const c of d.components) c.impl?.destroy?.(c);
        this.backend?.destroyNative?.(d);
        d.events.clear();
      }
      const list = e.parent ? e.parent.children : this.roots;
      const i = list.indexOf(e);
      if (i >= 0) list.splice(i, 1);
    }
    this.#dead.clear();
  }

  /** Physics/backends call this: `scene.dispatch(a, 'onCollisionEnter', b, contact)`. */
  dispatch(entity, method, ...args) { entity.callScripts(method, ...args); }

  destroy() {
    for (const r of [...this.roots]) this.destroyEntity(r);
    this.#flushDeaths();
    this.scheduler.clear();
    this.running = false;
  }
}
