// Graph runner: executes graphs saved by the Graph editor (litegraph serialisation) on top of the Nord runtime.
// Use: `await Graph.load(game, 'graphs/enemy.graph.json', { entity })` or add the `graph` component to an entity,
// or list files in `scene.settings.graphs`. Spec: docs/GRAPH.md
import { NODES, STOP, validate } from './nodes.js';

const AsyncFunction = Object.getPrototypeOf(async () => {}).constructor;
const MAX_STEPS = 200000; // per flow: stops runaway loops instead of freezing the page
const MAX_DEPTH = 64;     // pure-node dependency depth (cycle guard)

export class Graph {
  /** @param {object} def graph JSON  @param {{game, entity?, scene?, name?, args?}} o */
  constructor(def, { game, entity = null, scene = game.scene, name = 'graph', args = {} } = {}) {
    this.def = def; this.game = game; this.entity = entity; this.scene = scene; this.name = name;
    this.defaults = def.nord?.vars ? Object.fromEntries(Object.entries(def.nord.vars).map(([k, v]) => [k, v?.default ?? null])) : {};
    this.vars = { ...structuredClone(this.defaults), ...args };
    this.nodes = new Map(def.nodes.map((nd) => [nd.id, { ...nd, spec: NODES[nd.type], state: {}, out: [] }]));
    this.fromLink = new Map();            // `${node}:${slot}` -> { node, slot }
    this.toLinks = new Map();             // `${node}:${slot}` -> [{ node, slot }]
    for (const l of def.links ?? []) {
      if (!l) continue;
      const [, from, fs, to, ts] = l;
      this.fromLink.set(`${to}:${ts}`, { node: from, slot: fs });
      const k = `${from}:${fs}`; (this.toLinks.get(k) ?? this.toLinks.set(k, []).get(k)).push({ node: to, slot: ts });
    }
    this.stopped = false; this.offs = []; this.timers = new Map(); this.started = false; this.jsCache = new Map(); this.waiters = new Set();
  }

  static async load(game, path, opts = {}) {
    return attachGraph(game, opts.scene ?? game.scene, path, opts.entity ?? null);
  }

  eventsOf(kind) { return [...this.nodes.values()].filter((nd) => nd.spec?.event === kind); }
  prop(nd, k) { return nd.properties?.[k] ?? (Array.isArray(nd.spec.props[k]) ? nd.spec.props[k][0] : nd.spec.props[k]); }

  /** Subscribe event nodes. Called once; `update(dt)` must then be called every frame (the graph component / scene system does this). */
  start() {
    const { game } = this;
    for (const nd of this.eventsOf('ui')) { const a = String(this.prop(nd, 'action')); this.offs.push(game.events.on(`ui:${a}`, (payload) => this.trigger(nd, [payload]))); }
    for (const nd of this.eventsOf('event')) this.offs.push(game.events.on(String(this.prop(nd, 'name')), (data) => this.trigger(nd, [data])));
    if (this.entity) for (const nd of this.eventsOf('entityEvent')) this.offs.push(this.entity.on(String(this.prop(nd, 'name')), (data) => this.trigger(nd, [data])));
    for (const nd of this.eventsOf('timer')) this.timers.set(nd.id, { t: 0, n: 0 });
  }
  /** Per-frame: On Start (first frame), On Update, On Input Action, On Timer. */
  update(dt) {
    if (this.stopped) return;
    if (!this.started) { this.started = true; for (const nd of this.eventsOf('start')) this.trigger(nd, []); }
    for (const nd of this.eventsOf('update')) this.trigger(nd, [dt]);
    const inp = this.game.input;
    for (const nd of this.eventsOf('key')) {
      const a = String(this.prop(nd, 'action')), m = this.prop(nd, 'mode');
      if (m === 'down' ? inp.down(a) : m === 'released' ? inp.released(a) : inp.pressed(a)) this.trigger(nd, []);
    }
    for (const nd of this.eventsOf('timer')) {
      const st = this.timers.get(nd.id), every = Math.max(0.001, +this.prop(nd, 'seconds') || 1);
      st.t += dt;
      while (st.t >= every) { st.t -= every; st.n++; this.trigger(nd, [st.n]); if (this.prop(nd, 'repeat') === false) { st.t = -Infinity; break; } }
    }
    for (const w of [...this.waiters]) { w.left -= dt; if (w.left <= 0) { this.waiters.delete(w); w.done(); } }
  }
  /** Scene dispatch (collisions, triggers, clicks) → On Collision nodes. */
  dispatch(entity, method, args) {
    if (entity !== this.entity) return;
    for (const nd of this.eventsOf('dispatch')) if (this.prop(nd, 'method') === method) this.trigger(nd, [args[0] ?? null, args[1] ?? null]);
  }
  async callCustom(name, a, b) { for (const nd of this.eventsOf('custom')) if (String(this.prop(nd, 'name')) === name) await this.trigger(nd, [a, b]); }
  async runFile(path, args) { const g = new Graph(await this.game.loadJSON(path), { game: this.game, entity: this.entity, scene: this.scene, name: path, args }); g.start(); g.started = true; for (const nd of g.eventsOf('start')) await g.trigger(nd, []); g.stop(); }
  stop() { if (this.stopped) return; this.stopped = true; for (const o of this.offs) o(); this.offs = []; for (const w of this.waiters) w.done(); this.waiters.clear(); }
  /** Run On Destroy nodes, then stop. */
  async destroy() { if (this.stopped) return; for (const nd of this.eventsOf('destroy')) { try { await this.trigger(nd, []); } catch { /* ignore */ } } this.stop(); }

  async trigger(nd, values) {
    nd.out = [undefined, ...values];
    try { await this.#follow(nd, 0, { steps: 0 }); } catch (err) { this.game.reportError(err, { constructor: { name: `graph ${this.name}` } }, nd.spec?.title ?? nd.type); }
  }
  /** Run the n-th exec output chain of `nd`. */
  async #follow(nd, ordinal, run) {
    const slots = nd.spec.out.map((p, i) => [p, i]).filter(([p]) => p[1] === 'exec');
    const slot = slots[ordinal]?.[1]; if (slot === undefined) return;
    for (const t of this.toLinks.get(`${nd.id}:${slot}`) ?? []) { if (this.stopped) return; await this.#exec(this.nodes.get(t.node), run); }
  }
  async #exec(nd, run) {
    if (!nd?.spec || this.stopped) return;
    if (++run.steps > MAX_STEPS) throw new Error('graph stopped: more than 200000 steps in one flow (infinite loop?)');
    const c = this.#ctx(nd, run);
    const r = await nd.spec.run?.(c);
    if (r === STOP || this.stopped) return;
    const execs = nd.spec.out.filter((p) => p[1] === 'exec');
    const list = r === undefined ? [0] : Array.isArray(r) ? r : [r];
    for (const x of list) await this.#follow(nd, typeof x === 'number' ? x : execs.findIndex((p) => p[0] === x), run);
  }

  /** Data value of input `slot` of `nd`: linked source (pure node evaluated now, or a flow node's stored output) or the widget value. */
  value(nd, slot, depth = 0) {
    const src = this.fromLink.get(`${nd.id}:${slot}`);
    if (src) {
      const s = this.nodes.get(src.node);
      if (!s?.spec) return undefined;
      if (s.spec.pure) {
        if (depth > MAX_DEPTH) throw new Error('graph: pure nodes depend on themselves');
        const ins = this.#dataInputs(s).map((i) => this.value(s, i, depth + 1));
        const r = s.spec.fn(this.#ctx(s, { steps: 0 }), ...ins);
        return s.spec.out.length > 1 ? r?.[src.slot] : r;
      }
      return s.out[src.slot];
    }
    const p = nd.spec.in[slot], k = p?.[0];
    return nd.properties && k in nd.properties ? nd.properties[k] : p?.[2];
  }
  #dataInputs(nd) { return nd.spec.in.map((p, i) => [p, i]).filter(([p]) => p[1] !== 'exec').map(([, i]) => i); }

  #ctx(nd, run) {
    const g = this, data = this.#dataInputs(nd);
    return {
      g, node: nd, game: this.game, scene: this.scene ?? this.game.scene, entity: this.entity, vars: this.vars,
      get stopped() { return g.stopped; },
      prop: (k) => g.prop(nd, k),
      in: (i) => g.value(nd, data[i]),
      set: (slot, v) => { nd.out[slot] = v; },
      fire: (ordinal) => g.#follow(nd, ordinal, run),
      ent: (v) => (v == null || v === '' ? g.entity : typeof v === 'string' ? (g.scene ?? g.game.scene).find(v) ?? (g.scene ?? g.game.scene).findById(v) : v),
      wait: (sec) => new Promise((res) => { if (g.stopped) return res(); g.waiters.add({ left: sec, done: res }); }),
      log: (v, level = 'log') => { console[level === 'warn' || level === 'error' ? level : 'log'](`[graph ${g.name}]`, v); g.game.events.emit('graph:log', { graph: g.name, value: v, level }); },
      js: (code, scope, expr) => {
        const key = (expr ? 'e:' : 's:') + code;
        let f = g.jsCache.get(key);
        if (!f) { const body = expr ? `return (${code});` : code; f = new (expr ? Function : AsyncFunction)('game', 'scene', 'entity', 'vars', 'a', 'b', 'c', 'd', 'ctx', body); g.jsCache.set(key, f); }
        return f(g.game, g.scene, g.entity, g.vars, scope.a, scope.b, scope.c, scope.d, scope.ctx);
      },
    };
  }
}

/** Scene system that drives every live Graph (created on demand; components + scene.settings.graphs register here). */
export function graphSystem(scene) {
  if (scene.graphSystem) return scene.graphSystem;
  const sys = scene.graphSystem = {
    graphs: new Set(),
    update(dt) { for (const g of [...sys.graphs]) { if (g.stopped) sys.graphs.delete(g); else g.update(dt); } },
    onDispatch(entity, method, args) { for (const g of sys.graphs) g.dispatch(entity, method, args); },
    end() { for (const g of sys.graphs) g.stop(); sys.graphs.clear(); },
  };
  scene.systems.push(sys);
  return sys;
}

/** Load a graph file and let the scene drive it. */
export async function attachGraph(game, scene, path, entity = null) {
  const def = await game.loadJSON(path);
  const bad = validate(def).filter((m) => !m.startsWith('no event'));
  if (bad.length) game.warn(`[nord] graph ${path}: ${bad.join('; ')}`);
  const g = new Graph(def, { game, scene, entity, name: path });
  g.start();
  graphSystem(scene).graphs.add(g);
  return g;
}
