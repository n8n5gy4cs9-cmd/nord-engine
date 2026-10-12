// Entity tree. Backends (Phaser/Babylon) attach `native` and implement components via the registry.
import { Events } from './events.js';
import { resolveAttributes } from './script.js';

/** type -> { create(entity, data, comp), update?(comp, dt), destroy?(comp), set?(comp, key, value) } — filled by backends. */
export const components = new Map();
export const registerComponent = (type, impl) => components.set(type, impl);

const VEC = ['pos', 'rot', 'scale'];

export class Entity {
  constructor(data, scene, parent = null) {
    this.scene = scene;
    this.parent = parent;
    this.id = data.id;
    this.name = data.name ?? 'Entity';
    this.tags = [...(data.tags ?? [])];
    this.layer = data.layer ?? 0;
    this._enabled = data.enabled !== false;
    this.t = {
      pos: [...(data.transform?.pos ?? [0, 0, 0])],
      rot: [...(data.transform?.rot ?? [0, 0, 0])],
      scale: [...(data.transform?.scale ?? [1, 1, 1])],
    };
    this.children = [];
    this.components = [];
    this.scripts = [];
    this.events = new Events();
    this.native = null;
    this.destroyed = false;
    this._scriptData = data.scripts ?? [];
    this._compData = data.components ?? [];
    this.prefab = data.prefab ?? null;
  }

  // transform — setters notify the backend so native objects stay in sync
  get pos() { return this.t.pos; }
  set pos(v) { this.t.pos = [...v]; this.#sync(); }
  get rot() { return this.t.rot; }
  set rot(v) { this.t.rot = [...v]; this.#sync('rot'); }
  get scale() { return this.t.scale; }
  set scale(v) { this.t.scale = [...v]; this.#sync(); }
  /** Call after mutating pos/rot/scale arrays in place (e.g. `e.pos[0] += 1; e.touch()`). */
  touch() { this.#sync(); }
  #sync(what) { this.scene.backend?.syncTransform?.(this, what); }

  /** World position: parent chain applied with scale + translation only (rotation is applied by the backend natively). */
  get worldPos() {
    if (!this.parent) return [...this.t.pos];
    const p = this.parent.worldPos, s = this.parent.t.scale;
    return this.t.pos.map((v, i) => p[i] + v * s[i]);
  }

  get enabled() { return this._enabled && (!this.parent || this.parent.enabled); }
  set enabled(v) {
    if (v === this._enabled) return;
    this._enabled = v;
    this.scene.backend?.setEnabled?.(this, this.enabled);
    for (const e of this.all()) for (const s of e.scripts) if (s._started) s[v ? 'onEnable' : 'onDisable']?.();
  }

  *all() { yield this; for (const c of this.children) yield* c.all(); }
  find(name) { for (const e of this.all()) if (e !== this && e.name === name) return e; return null; }
  findByTag(tag) { return [...this.all()].filter((e) => e !== this && e.tags.includes(tag)); }
  hasTag(tag) { return this.tags.includes(tag); }

  getComponent(type) { return this.components.find((c) => c.type === type) ?? null; }
  addComponent(type, data = {}) {
    const impl = components.get(type);
    const comp = { type, data: { ...data }, impl, entity: this };
    this.components.push(comp);
    impl?.create?.(this, comp.data, comp);
    return comp;
  }
  /** Change a component field at runtime (`e.set('sprite','tint','#f00')`); components without a `set` just store the value. */
  set(type, key, value) {
    const c = this.getComponent(type);
    if (!c) return;
    if (c.impl?.set) c.impl.set(c, key, value); else c.data[key] = value;
  }
  getScript(Class) { return this.scripts.find((s) => s instanceof Class) ?? null; }
  addScript(Class, attrs = {}) {
    const s = new Class(this, resolveAttributes(Class, attrs));
    this.scripts.push(s);
    s.init?.();
    if (this.scene.running) { s.start?.(); s._started = true; }
    return s;
  }

  on(n, f) { return this.events.on(n, f); }
  off(n, f) { this.events.off(n, f); }
  emit(n, d) { this.events.emit(n, d); }

  /** Run `fn` on every enabled script (errors are caught + reported so one bad script cannot kill the frame). */
  callScripts(method, ...args) {
    if (!this.enabled) return;
    for (const s of this.scripts) {
      if (typeof s[method] !== 'function') continue;
      try { s[method](...args); } catch (err) { this.scene.game.reportError(err, s, method); }
    }
  }

  destroy() { this.scene.destroyEntity(this); }
  clone() { return this.scene.spawnData(this.toJSON(true), this.parent); }

  toJSON(fresh = false) {
    return {
      id: fresh ? undefined : this.id, name: this.name, enabled: this._enabled, tags: [...this.tags], layer: this.layer,
      transform: structuredClone(this.t),
      components: this.components.map((c) => ({ type: c.type, ...structuredClone(c.data) })),
      scripts: this.scripts.map((s, i) => ({ path: this._scriptData[i]?.path, attributes: structuredClone(s.attrs) })),
      children: this.children.map((c) => c.toJSON(fresh)),
      prefab: this.prefab,
    };
  }
}
export { VEC };
