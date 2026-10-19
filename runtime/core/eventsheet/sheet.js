// Event sheet runner — Construct-style semantics. See docs/EVENT_SHEETS.md for the JSON format.
//   • events run top to bottom every tick; an event runs its actions (then sub-events) when ALL conditions pass (or ANY, in an Or-block)
//   • conditions on object types filter the selected-object list (SOL); actions act on the picked instances; sub-events inherit the SOL
//   • trigger conditions (On key pressed, On collision, On created…) only run when fired; Else runs when the previous event did not
//   • loops (for each / repeat / for / while) run the rest of the event once per iteration; local variables are scoped to their event
import { compile } from './expr.js';
import { plugins, objectAces, keyCode } from './aces.js';
import { behaviors } from '../behaviors/index.js';
import { isType } from '../behaviors/util.js';
import { dataTypes, bindDataType } from './objects.js';

const exprCache = new Map();
const compiled = (src) => { let f = exprCache.get(src); if (!f) { f = compile(src); exprCache.set(src, f); } return f; };

export class EventSheet {
  constructor(scene, data, sheets = {}) {
    this.scene = scene; this.game = scene.game;
    this.data = data;
    this.events = data.events ?? [];
    this.globals = new Map();
    this.consts = new Set();
    this.functions = new Map();
    this.groups = new Map();
    this.scopes = [];       // local variable scopes (innermost last)
    this.frames = [];       // function call frames { params, ret }
    this.loops = [];        // loop index stack [{name, i}]
    this.cur = new Map();   // type -> instance being evaluated (per-instance parameter evaluation)
    this.firing = null;
    this.tickCount = 0; this.time = 0; this.dt = 0;
    this.sheets = sheets;   // includes: path -> parsed sheet (preloaded by EventSheet.load)
    this.heldPrev = new Set(); this.actionsPrev = new Set(); this.pointerPrev = false;
    this.env = this.#makeEnv();
    this.dataObjs = new Map(); // name -> bound plugin-shaped definition (Array, Dictionary, JSON, AJAX… see objects.js)
    this.#index(this.events);
    this.#label(this.events, '');
    for (const [name, o] of Object.entries(scene.settings?.dataObjects ?? {})) this.#declare({ ...(typeof o === 'string' ? { plugin: o } : o), name });
  }

  /** Stable path ids ("2.0.1") for the debugger/profiler. */
  #label(list, prefix) { list.forEach((e, i) => { e._path = prefix + i; if (e.children) this.#label(e.children, `${e._path}.`); }); }

  #declare(e) {
    const def = dataTypes.get(e.plugin);
    if (!def) throw new Error(`unknown object plugin '${e.plugin}' for '${e.name}'`);
    const store = e.global ? (this.game.dataObjects ??= new Map()) : null;
    let inst = store?.get(e.name);
    if (!inst) { inst = def.create(e, this.game); inst.name = e.name; store?.set(e.name, inst); }
    this.dataObjs.set(e.name, bindDataType(this, e.name, e.plugin, inst));
  }
  /** plugin definition by name: built-in plugins first, then declared data objects */
  #pl(name) { return plugins.get(name) ?? this.dataObjs.get(name); }

  /** Load a sheet (and everything it includes) via game.loadJSON. */
  static async load(scene, path) {
    const sheets = {};
    const walk = async (p) => {
      if (sheets[p]) return;
      sheets[p] = await scene.game.loadJSON(p);
      for (const e of sheets[p].events ?? []) await visit(e);
    };
    const visit = async (e) => { if (e.type === 'include') await walk(e.path); for (const c of e.children ?? []) await visit(c); };
    await walk(path);
    const flat = (list) => list.flatMap((e) => (e.type === 'include' ? flat(sheets[e.path].events ?? []) : [{ ...e, children: e.children && flat(e.children) }]));
    const data = { ...sheets[path], events: flat(sheets[path].events ?? []) };
    for (const e of data.events) if (e.children === undefined) delete e.children;
    return new EventSheet(scene, data, sheets);
  }

  #index(list) {
    for (const e of list) {
      if (e.type === 'variable') { this.globals.set(e.name, structuredClone(e.value ?? (e.valueType === 'string' ? '' : e.valueType === 'boolean' ? false : 0))); if (e.isConstant) this.consts.add(e.name); }
      else if (e.type === 'object') this.#declare(e);
      else if (e.type === 'function-block') this.functions.set(e.name.toLowerCase(), e);
      else if (e.type === 'group') { this.groups.set(e.title, e); e.active ??= true; this.#index(e.children ?? []); }
    }
  }

  // ---------- lifecycle (called by the scene) ----------
  /** Subscribe to the game's event bus (Events → On game event). */
  listen() {
    const NET = { 'net:connected': 'on-connected', 'net:join': 'on-peer-joined', 'net:leave': 'on-peer-left', 'net:message': 'on-message' };
    this._off = this.game.events.on('*', ({ name, data }) => {
      if (NET[name]) this.fire(`Multiplayer.${NET[name]}`, data ?? {});
      else if (name !== 'debugBreak' && name !== 'language') this.fire('Events.on-event', { name, data });
    });
  }
  start() { this.listen(); this.fire('System.on-start-of-layout'); }
  end() { this.fire('System.on-end-of-layout'); this._off?.(); }
  update(dt) {
    this.dt = dt; this.time += dt; this.tickCount++;
    this.#pollInput();
    this.#walk(this.events, null);
  }
  #pollInput() {
    const inp = this.game.input;
    for (const c of inp.held) if (!this.heldPrev.has(c)) this.fire('Keyboard.on-key-pressed', { code: c, down: true });
    for (const c of this.heldPrev) if (!inp.held.has(c)) this.fire('Keyboard.on-key-released', { code: c, down: false });
    this.heldPrev = new Set(inp.held);
    const cur = inp.cur;
    for (const a of cur) if (!this.actionsPrev.has(a)) this.fire('Input.on-action-pressed', { action: a });
    this.actionsPrev = new Set(cur);
    const d = inp.pointer.down;
    if (d !== this.pointerPrev) { this.fire(d ? 'Mouse.on-click' : 'Mouse.on-release', { down: d }); this.fire(d ? 'Touch.on-tap' : 'Touch.on-touch-end', { down: d }); }
    this.pointerPrev = d;
  }
  /** Scene hook: collisions / triggers from the backend. */
  onDispatch(entity, method, args) {
    if (method === 'onCollisionEnter' || method === 'onTriggerEnter') this.fire('Object.on-collision', { a: entity, b: args[0] });
  }
  onCreated(entity) { this.fire('Object.on-created', { entity }); }
  onDestroyed(entity) {
    this.fire('Object.on-destroyed', { entity });
    for (const p of entity._peers ?? []) if (!p.destroyed) p.destroy();
  }

  /** Run every top-level (or grouped) event whose FIRST condition is the trigger `key` ("Plugin.id"). */
  fire(key, data = {}) {
    const prev = this.firing;
    this.firing = { key, data };
    try { this.#walk(this.events, key); } finally { this.firing = prev; }
  }

  // ---------- event tree ----------
  #walk(list, trigger) {
    let chain = false; // has an event in the current if/else chain already run?
    for (const ev of list) {
      if (ev.type === 'group') { if (ev.active !== false) this.#walk(ev.children ?? [], trigger); continue; }
      if (ev.type !== 'event' || ev.disabled) continue;
      const first = ev.conditions?.[0];
      const isTrig = first && this.#def('conditions', first)?.trigger;
      if (trigger ? !(isTrig && this.#key(first) === trigger) : isTrig) continue;
      const dbg = this.game.debug, t0 = dbg && !trigger ? performance.now() : 0;
      try { chain = this.#runEvent(ev, new Map(), chain); } catch (err) { this.#fail(ev, err); }
      if (t0) dbg.addCost(ev._path, performance.now() - t0);
    }
  }
  // triggers on object types ("Player" → On collision) are registered under the generic "Object" plugin
  #key(c) { if (c.behavior) return `Behavior.${c.behavior}.${c.id}`; return this.#pl(c.object) ? `${c.object}.${c.id}` : `Object.${c.id}`; }
  #fail(ev, err) {
    if (ev._err) return;
    ev._err = true;
    this.game.reportError(err, { constructor: { name: 'EventSheet' } }, `event ${ev.id ?? ''}`.trim());
  }

  /** Returns whether this event ran (feeds Else chains). */
  #runEvent(ev, parentSol, chain) {
    const conds = ev.conditions ?? [];
    const isElse = conds[0]?.id === 'else' && conds[0].object === 'System';
    if (isElse && chain) return true; // chain already satisfied → skip
    const hasLocals = ev.children?.some((c) => c.type === 'variable');
    if (hasLocals) this.#pushLocals(ev);
    let ran = false;
    try {
      const rest = isElse ? conds.slice(1) : conds;
      const run = (sol) => { ran = true; this.game.debug?.onRun(ev, this.tickCount); this.#body(ev, sol); };
      if (ev.block === 'or') this.#or(rest, parentSol, run, ev);
      else this.#and(rest, 0, parentSol, ev, run);
    } finally { if (hasLocals) this.scopes.pop(); }
    // an event not starting with Else begins a new chain; "ran" tells later Else events to stand down
    return isElse ? chain || ran : ran;
  }

  #pushLocals(ev) {
    const m = new Map();
    for (const c of ev.children) {
      if (c.type !== 'variable') continue;
      if (c.isStatic) { ev._static ??= new Map(); if (!ev._static.has(c.name)) ev._static.set(c.name, c.value ?? 0); m.set(c.name, { static: ev._static }); }
      else m.set(c.name, c.value ?? (c.valueType === 'string' ? '' : c.valueType === 'boolean' ? false : 0));
    }
    this.scopes.push(m);
  }

  #and(conds, i, sol, ev, run) {
    for (; i < conds.length; i++) {
      const c = conds[i];
      const def = this.#def('conditions', c);
      if (!def) throw new Error(`unknown condition ${c.object}.${c.id}`);
      if (def.loop) return this.#loop(def, c, conds, i, sol, ev, run);
      sol = new Map(sol); // filters make a fresh SOL for the rest of the event
      if (!this.#test(def, c, sol, ev)) return false;
    }
    run(sol);
    return true;
  }

  #or(conds, sol, run, ev) {
    const out = new Map(); let any = false;
    for (const c of conds) {
      const s = new Map(sol);
      if (this.#test(this.#def('conditions', c), c, s, ev)) {
        any = true;
        for (const [t, l] of s) out.set(t, [...new Set([...(out.get(t) ?? []), ...l])]);
      }
    }
    if (any) run(out);
  }

  /** Evaluate one condition against `sol` (mutating it for picks). */
  #test(def, c, sol, ev) {
    this.solView = sol;
    if (def.instance) {
      const type = c.object;
      const list = this.picked(type, sol);
      const keep = list.filter((e) => {
        const p = this.#params(def, c, type, e);
        return !!def.test(this, e, p) !== !!c.inverted;
      });
      this.pick(sol, type, keep);
      return keep.length > 0;
    }
    const p = this.#params(def, c);
    return !!def.test(this, p, { sol, cond: c, ev }) !== !!c.inverted;
  }

  #loop(def, c, conds, i, sol, ev, run) {
    this.solView = sol;
    const p = this.#params(def, c);
    const next = (s) => this.#and(conds, i + 1, s, ev, run);
    if (def.whileExpr) { // while: repeat the rest as long as the expression holds
      this.loops.push({ i: 0 });
      let guard = 0;
      while (this.#params(def, c).condition && guard++ < 100000) { next(new Map(sol)); this.loops.at(-1).i++; }
      this.loops.pop();
      return true;
    }
    const its = def.items(this, p, sol);
    this.loops.push({ i: 0, name: c.params?.name });
    for (let k = 0; k < its.length; k++) {
      const s = new Map(sol);
      this.loops.at(-1).value = undefined;
      for (const [type, val] of its[k]) { if (type) s.set(type, val); else this.loops.at(-1).value = val; }
      this.loops.at(-1).i = k;
      this.loops.at(-1).value ??= k;
      next(s);
    }
    this.loops.pop();
    return its.length > 0;
  }
  loopIndex(name) {
    const l = name ? [...this.loops].reverse().find((x) => x.name === name) : this.loops.at(-1);
    return l ? l.value ?? l.i : 0;
  }

  #body(ev, sol, from = 0) {
    const acts = ev.actions ?? [];
    for (let i = from; i < acts.length; i++) {
      const a = acts[i];
      const def = this.#def('actions', a);
      if (!def) throw new Error(`unknown action ${a.object}.${a.id}`);
      const res = this.#act(def, a, sol);
      if (res && (res.wait !== undefined || res.until)) { this.#defer(ev, sol, i + 1, res); return; }
    }
    this.#walkChildren(ev, sol);
  }
  #walkChildren(ev, sol) {
    const kids = (ev.children ?? []).filter((c) => c.type !== 'variable');
    if (!kids.length) return;
    let chain = false;
    for (const k of kids) {
      if (k.type === 'group') { if (k.active !== false) for (const g of k.children ?? []) if (g.type === 'event') { try { chain = this.#runEvent(g, sol, chain); } catch (e) { this.#fail(g, e); } } continue; }
      if (k.type !== 'event' || k.disabled) continue;
      try { chain = this.#runEvent(k, sol, chain); } catch (err) { this.#fail(k, err); }
    }
  }

  /** Wait / async create-object: remember SOL, locals and loop state, resume the remaining actions later. */
  #defer(ev, sol, from, res) {
    const keep = new Map([...sol].map(([t, l]) => [t, [...l]]));
    const scopes = [...this.scopes], loops = this.loops.map((l) => ({ ...l })), frames = [...this.frames];
    const resume = (extra) => {
      const s = new Map([...keep].map(([t, l]) => [t, l.filter((e) => !e.destroyed)]));
      for (const [t, l] of extra ?? []) s.set(t, l);
      const sv = [this.scopes, this.loops, this.frames];
      [this.scopes, this.loops, this.frames] = [scopes, loops, frames];
      try { this.#body(ev, s, from); } catch (err) { this.#fail(ev, err); } finally { [this.scopes, this.loops, this.frames] = sv; }
    };
    if (res.until) res.until.then((v) => resume(res.pick?.(v)), (err) => this.#fail(ev, err));
    else this.scene.scheduler.after(res.wait, () => resume());
  }

  #act(def, a, sol) {
    this.solView = sol;
    if (def.instance) {
      for (const e of [...this.picked(a.object, sol)]) def.run(this, e, this.#params(def, a, a.object, e));
      return;
    }
    return def.run(this, this.#params(def, a));
  }

  // ---------- params & expressions ----------
  #params(def, node, type = null, inst = null) {
    const out = {}, raw = node.params ?? {}, names = def.params ?? [];
    const prev = type ? this.cur.get(type) : undefined;
    if (type) this.cur.set(type, inst);
    try {
      for (const n of names) {
        const v = raw[n];
        if (def.raw?.includes(n) || def.lazy?.includes(n)) out[n] = v;
        else out[n] = this.evalExpr(v);
      }
      if (def.rest) out.args = (raw.args ?? []).map((x) => this.evalExpr(x));
    } finally { if (type) { if (prev === undefined) this.cur.delete(type); else this.cur.set(type, prev); } }
    return out;
  }
  evalExpr(v) {
    if (v === undefined || v === null) return 0;
    if (typeof v !== 'string') return v;
    return compiled(v)(this.env);
  }
  withCur(type, inst, fn) {
    const prev = this.cur.get(type);
    this.cur.set(type, inst);
    try { return fn(); } finally { if (prev === undefined) this.cur.delete(type); else this.cur.set(type, prev); }
  }
  #def(kind, node) {
    if (node.behavior) return behaviors.get(node.behavior)?.[kind][node.id];
    const p = this.#pl(node.object);
    return p ? p[kind][node.id] : objectAces[kind][node.id];
  }
  #makeEnv() {
    const r = this;
    return {
      random: (a, b) => (b === undefined ? (a === undefined ? r.game.rng.next() : r.game.rng.next() * a) : a + r.game.rng.next() * (b - a)),
      name: (n) => r.getVar(n, true),
      call: (n, a) => { const f = plugins.get('System').expressions[n.toLowerCase()]; if (!f) throw new Error(`unknown function '${n}'`); return f(r, a); },
      prop: (type, idx, name) => r.#prop(type, idx, name),
      method: (type, name, a) => r.#method(type, name, a),
      bprop: (type, idx, beh, name) => r.#bprop(type, idx, beh, name),
      bmethod: (type, beh, name, a) => r.#bprop(type, null, beh, name, a),
    };
  }
  #prop(type, idx, name) {
    const pl = this.#pl(type);
    if (pl) { const f = pl.expressions[name]; if (!f) throw new Error(`unknown expression ${type}.${name}`); return f(this, []); }
    if (type === 'Function' && name === 'ReturnValue') return this.frames.at(-1)?.ret ?? 0;
    const list = this.cur.get(type) ? [this.cur.get(type)] : this.picked(type, this.solView ?? new Map());
    if (name === 'Count' || name === 'PickedCount') return list.length;
    const e = idx === null || idx === undefined ? list[0] : list[Math.floor(idx)];
    if (!e) return name in objectAces.expressions ? 0 : 0;
    const f = objectAces.expressions[name];
    if (f) return f(e);
    if (name in e.vars) return e.vars[name];
    throw new Error(`'${type}' has no property '${name}'`);
  }
  #bprop(type, idx, beh, name, args = []) {
    const list = this.cur.get(type) ? [this.cur.get(type)] : this.picked(type, this.solView ?? new Map());
    const e = idx === null || idx === undefined ? list[0] : list[Math.floor(idx)];
    const f = behaviors.get(beh)?.expressions[name];
    if (!f) throw new Error(`unknown expression ${type}.${beh}.${name}`);
    const b = e?.behavior(beh);
    return b ? f(b, args, this) : 0;
  }
  #method(type, name, a) {
    if (type === 'Functions') return this.callFunction(name, a);
    if (type === 'Function' && name === 'Param') { const f = this.frames.at(-1); const v = typeof a[0] === 'number' ? f?.params[a[0]] : f?.named[a[0]]; return v ?? 0; }
    const pl = this.#pl(type);
    const f = pl?.expressions[name];
    if (f) return f(this, a);
    throw new Error(`unknown expression ${type}.${name}()`);
  }

  // ---------- variables ----------
  getVar(name, soft = false) {
    for (let i = this.scopes.length - 1; i >= 0; i--) {
      const s = this.scopes[i];
      if (s.has(name)) { const v = s.get(name); return v && typeof v === 'object' && v.static ? v.static.get(name) : v; }
    }
    if (this.globals.has(name)) return this.globals.get(name);
    const l = this.loops.find((x) => x.name === name);
    if (l) return l.value ?? l.i;
    if (soft) { const low = name.toLowerCase(); const f = plugins.get('System').expressions[low]; if (f) return f(this, []); }
    throw new Error(`unknown variable '${name}'`);
  }
  setVar(name, value) {
    if (this.consts.has(name)) throw new Error(`'${name}' is a constant`);
    for (let i = this.scopes.length - 1; i >= 0; i--) {
      const s = this.scopes[i];
      if (s.has(name)) { const v = s.get(name); if (v && typeof v === 'object' && v.static) v.static.set(name, value); else s.set(name, value); return; }
    }
    if (!this.globals.has(name)) throw new Error(`unknown variable '${name}'`);
    this.globals.set(name, value);
  }

  // ---------- functions ----------
  callFunction(name, args = []) {
    const fn = this.functions.get(String(name).toLowerCase());
    if (!fn) throw new Error(`unknown function '${name}'`);
    if (this.frames.length > 64) throw new Error(`function '${name}': recursion too deep`);
    const named = {}; (fn.params ?? []).forEach((p, i) => { named[p.name] = args[i] ?? p.initialValue ?? 0; });
    const frame = { params: (fn.params ?? []).map((p, i) => args[i] ?? p.initialValue ?? 0), named, ret: fn.returnType === 'string' ? '' : 0 };
    this.frames.push(frame);
    const scopes = this.scopes; this.scopes = [];
    try {
      if (fn.conditions?.length || fn.actions?.length) this.#runEvent({ ...fn, type: 'event' }, new Map(), false);
      else this.#walkChildren(fn, new Map());
    } finally { this.scopes = scopes; this.frames.pop(); }
    return frame.ret;
  }

  // ---------- object instances ----------
  matches(e, type) { return isType(this.scene, e, type); }
  /** Other object types created/destroyed together with `type` (scene.settings.containers: [["Tank","Turret"]]). */
  containerPeers(type) { const c = this.scene.settings?.containers?.find((l) => l.includes(type)); return c ? c.filter((n) => n !== type) : []; }
  all(type) { return [...this.scene.all()].filter((e) => this.matches(e, type)); }
  picked(type, sol) { const l = sol.get(type); return l ? l.filter((e) => !e.destroyed) : this.all(type); }
  pick(sol, type, list) { sol.set(type, list); }
  radius(e) { return 16 * Math.max(Math.abs(e.scale[0]), Math.abs(e.scale[1])); }
  prefabFor(type) { return this.scene.data.settings?.objectTypes?.[type]?.prefab ?? `prefabs/${type.toLowerCase()}.prefab.json`; }
}
export { keyCode };
