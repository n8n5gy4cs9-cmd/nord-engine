// Runtime entity ("Ent"), attached scripts ("ScriptInst") and the event bus. Script contract: docs/FPS_CREATOR.md §Scripts.
import { CELL, STORY } from './level.js';

export class Bus {
  constructor() { this.m = new Map(); }
  on(name, fn) { let s = this.m.get(name); if (!s) this.m.set(name, (s = new Set())); s.add(fn); return () => s.delete(fn); }
  emit(name, data) { for (const k of [name, `*.${name.split('.').pop()}`]) { const s = this.m.get(k); if (s) for (const fn of [...s]) { try { fn(data, name); } catch (e) { console.error('[fpsc] event handler', name, e); } } } }
  clear() { this.m.clear(); }
}

/** A script attached to one entity. `p` = params (defaults from the script, overridden by the level), `s` = free state the script may keep. */
export class ScriptInst {
  constructor(ent, mod, params) {
    this.ent = ent; this.mod = mod; this.id = mod.id; this.enabled = true; this.s = {}; this.offs = [];
    this.p = {};
    for (const [k, d] of Object.entries(mod.params ?? {})) this.p[k] = params && k in params ? params[k] : structuredClone(d.default);
    for (const [k, v] of Object.entries(params ?? {})) if (!(k in this.p)) this.p[k] = v;
  }
  get self() { return this.ent; }
  get game() { return this.ent.game; }
  get world() { return this.ent.game.world; }
  get player() { return this.ent.game.player; }
  emit(evt, data) { this.ent.emit(evt, data); }
  /** Subscribe to a global event name (e.g. "door1.opened", "*.died"); auto-removed when the entity is destroyed. */
  on(name, fn) { const off = this.ent.game.bus.on(name, fn); this.offs.push(off); return off; }
  after(sec, fn) { return this.ent.game.after(sec, () => { if (!this.ent.destroyed) fn(); }); }
  say(text, secs) { this.ent.game.say(text, secs); }
  sound(name, o) { this.ent.game.sound(name, this.ent, o); }
  find(q) { return this.ent.game.find(q); }
  /** Entities named by this entity's "target" field (name, or #tag for a group). */
  targets() { return this.ent.game.find(this.ent.target); }
  dispose() { for (const o of this.offs) o(); this.offs = []; }
}

let SEQ = 0;
export class Ent {
  constructor(game, data, def, x, y, z) {
    this.game = game; this.data = data; this.def = def; this.type = data.type; this.id = data.id ?? `ent${SEQ++}`;
    this.name = data.name || ''; this.tag = data.tag || ''; this.tags = new Set((data.tag || '').split(/[\s,]+/).filter(Boolean)); this.target = data.target || '';
    this.layer = data.layer | 0; this.x = x; this.y = y; this.z = z; this.rot = data.rot || 0;
    this.props = { ...defaultsOf(def.props), ...(data.props ?? {}) };
    this.radius = def.radius ?? 0.4; this.height = def.height ?? 1.8; this.hit = def.hit ?? false;
    this.maxHp = this.props.health ?? 0; this.hp = this.maxHp; this.alive = true; this.enabled = !data.props?.disabled; this.destroyed = false;
    this.scripts = []; this.model = null; this.state = {}; this.vy = 0; this.rules = data.rules ?? [];
    this.visible = true; this.kind = def.cat; this.enemy = !!def.enemy; this.born = game.time;
  }
  get pos() { return [this.x, this.y, this.z]; }
  get eye() { return [this.x, this.y + this.height * 0.8, this.z]; }
  get mid() { return [this.x, this.y + this.height * 0.5, this.z]; }
  get dir() { const r = this.rot * Math.PI / 180; return [Math.sin(r), Math.cos(r)]; }

  call(hook, ...args) {
    if (this.destroyed) return;
    for (const s of this.scripts) {
      if (!s.enabled) continue;
      const f = s.mod[hook]; if (typeof f !== 'function') continue;
      try { f.call(s.mod, s, ...args); } catch (e) { this.game.scriptError(s, hook, e); }
    }
  }
  emit(evt, data) {
    const g = this.game;
    this.call('event', evt, data);
    if (this.name) g.bus.emit(`${this.name}.${evt}`, data);
    for (const t of this.tags) g.bus.emit(`#${t}.${evt}`, data);
    g.bus.emit(`${this.id}.${evt}`, data);
  }
  setModelVisible(v) { this.visible = v; if (this.model) this.model.root.setEnabled(v); }

  /** Apply damage. Returns true when this killed it. */
  hurt(amount, src = null, kind = 'bullet') {
    if (!this.alive || !this.enabled || amount <= 0) return false;
    if (this.props.invulnerable) return false;
    this.call('beforeHurt', amount, src);
    this.hp -= amount; this.model?.flash(0.1);
    this.call('hurt', amount, src, kind); this.emit('hurt', { amount, src });
    if (this.hp <= 0 && this.maxHp > 0) { this.die(src, kind); return true; }
    return false;
  }
  die(src = null, kind = 'bullet') {
    if (!this.alive) return;
    this.alive = false; this.hp = 0;
    this.call('die', src, kind); this.emit('died', { src }); this.game.onKilled(this, src);
  }
  heal(n) { this.hp = Math.min(this.maxHp, this.hp + n); }
  teleport(x, z, layer = this.layer) { this.x = x; this.z = z; this.layer = layer; const f = this.game.world.floorAt(x, z, layer * STORY + STORY - 0.05); this.y = f ? f.y : this.y; this.syncModel(); }
  syncModel() { const m = this.model; if (!m) return; m.root.position.set(this.x, this.y + (this.float ?? 0), this.z); m.root.rotation.y = this.rot * Math.PI / 180; }
  destroy() {
    if (this.destroyed) return; this.destroyed = true; this.alive = false;
    for (const s of this.scripts) s.dispose(); this.model?.dispose(); this.model = null; this.game.removeEnt(this);
  }
}

export function defaultsOf(schema) {
  const o = {}; for (const [k, d] of Object.entries(schema ?? {})) if ('default' in d) o[k] = structuredClone(d.default); return o;
}
export { CELL };
