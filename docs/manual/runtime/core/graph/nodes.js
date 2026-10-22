// Node library for Nord graphs (visual scripting). One spec per node type, shared by the editor (editor/graph/) and the
// runner (runner.js). Pin types: exec (white flow arrows) · number · string · boolean · vec3 · entity · array · object · any.
//
//   def(type, { title, cat, in:[[name,type,default?]…], out:[[name,type]…], props:{…}, fn | run | event })
// * pure node  (no exec pins)  → fn(c, ...inputs) returns a value (or an array = several outputs); evaluated on demand.
// * flow node  (has exec pins) → async run(c); return nothing = continue on the first exec output, a name/index = that
//   output, an array = several in order, STOP = end this flow. c.set(i, v) publishes data on output i.
// * event node (entry point)   → event:'start'|'update'|'key'|'ui'|'event'|'entityEvent'|'dispatch'|'timer'|'destroy'|'custom'
// The context `c` (see runner.js): c.game c.scene c.entity c.vars c.prop(n) c.in(i) c.set(slot,v) c.ent(v) c.wait(s) c.fire(n) c.log(…)
// c.in(i) = i-th DATA input (exec pins are skipped); c.set(slot) = output slot index; returned numbers = n-th EXEC output, strings = output name.
export const STOP = Symbol('stop');
export const NODES = Object.create(null);
export const CATS = ['Events', 'Flow', 'Variables', 'Math', 'Logic', 'Vector', 'Text', 'Array', 'Entity', 'Physics', 'Input', 'UI', 'Audio', 'Game', 'Advanced'];
export const SLOT_COLORS = { exec: '#ffffff', number: '#7fd1b9', string: '#e0af68', boolean: '#e06c75', vec3: '#c3a6ff', entity: '#61afef', array: '#98c379', object: '#d19a66', any: '#9aa5b1', color: '#f7768e' };

export function def(type, spec) {
  const s = { type, ...spec };
  s.props ??= {}; s.in ??= []; s.out ??= [];
  s.pure = !s.event && !s.in.some((p) => p[1] === 'exec') && !s.out.some((p) => p[1] === 'exec');
  NODES[type] = s;
  return s;
}
const EX = ['exec', 'exec'];
const THEN = ['then', 'exec'];
const n = (v, d = 0) => (typeof v === 'number' && Number.isFinite(v) ? v : Number.isFinite(+v) && v !== null && v !== '' ? +v : d);
const vec = (v) => (Array.isArray(v) ? [n(v[0]), n(v[1]), n(v[2])] : [0, 0, 0]);
const path = (o, p) => String(p ?? '').split('.').filter(Boolean).reduce((a, k) => (a == null ? a : a[k]), o);
const setPath = (o, p, v) => { const ks = String(p).split('.').filter(Boolean); const last = ks.pop(); const t = ks.reduce((a, k) => (a[k] ??= {}), o); t[last] = v; };
const pure = (type, title, cat, ins, outs, fn, props) => def(type, { title, cat, in: ins, out: outs, fn, props });
const flow = (type, title, cat, ins, outs, run, props) => def(type, { title, cat, in: [EX, ...ins], out: [THEN, ...outs], run, props });
const event = (type, title, ev, outs = [], props = {}) => def(type, { title, cat: 'Events', event: ev, out: [THEN, ...outs], props });

// ───────── Events ─────────
event('event/start', 'On Start', 'start');
event('event/update', 'On Update', 'update', [['dt', 'number']]);
event('event/key', 'On Input Action', 'key', [], { action: 'jump', mode: ['pressed', 'released', 'down'] });
event('event/ui', 'On UI Action', 'ui', [['payload', 'any']], { action: 'play' });
event('event/game', 'On Game Event', 'event', [['data', 'any']], { name: 'my-event' });
event('event/entity', 'On Entity Event', 'entityEvent', [['data', 'any']], { name: 'click' });
event('event/collision', 'On Collision / Trigger', 'dispatch', [['other', 'entity'], ['info', 'object']], { method: ['onCollisionEnter', 'onCollisionExit', 'onTriggerEnter', 'onTriggerExit', 'onClick'] });
event('event/timer', 'On Timer', 'timer', [['count', 'number']], { seconds: 1, repeat: true });
event('event/destroy', 'On Destroy', 'destroy');
event('event/custom', 'Custom Event', 'custom', [['a', 'any'], ['b', 'any']], { name: 'my-custom' });

// ───────── Flow ─────────
flow('flow/branch', 'Branch (If)', 'Flow', [['condition', 'boolean', true]], [], (c) => (c.in(0) ? 'then' : 'else'));
NODES['flow/branch'].out = [['then', 'exec'], ['else', 'exec']];
flow('flow/sequence', 'Sequence', 'Flow', [], [['then 2', 'exec'], ['then 3', 'exec']], () => [0, 1, 2]);
flow('flow/delay', 'Delay', 'Flow', [['seconds', 'number', 1]], [], async (c) => { await c.wait(n(c.in(0), 1)); });
flow('flow/wait-until', 'Wait Until', 'Flow', [['condition', 'boolean', false]], [], async (c) => { while (!c.in(0)) await c.wait(0); });
flow('flow/for', 'For Loop', 'Flow', [['first', 'number', 0], ['last', 'number', 9]], [['index', 'number'], ['done', 'exec']], async (c) => {
  const a = n(c.in(0)), b = n(c.in(1));
  for (let i = a; i <= b; i++) { c.set(1, i); await c.fire(0); if (c.stopped) return STOP; }
  return 'done';
});
NODES['flow/for'].out = [['body', 'exec'], ['index', 'number'], ['done', 'exec']];
flow('flow/foreach', 'For Each', 'Flow', [['array', 'array']], [], async (c) => {
  const list = c.in(0); if (!Array.isArray(list)) return 'done';
  for (let i = 0; i < list.length; i++) { c.set(1, list[i]); c.set(2, i); await c.fire(0); if (c.stopped) return STOP; }
  return 'done';
});
NODES['flow/foreach'].out = [['body', 'exec'], ['item', 'any'], ['index', 'number'], ['done', 'exec']];
flow('flow/while', 'While', 'Flow', [['condition', 'boolean', false]], [], async (c) => {
  for (let i = 0; c.in(0) && i < 100000; i++) { await c.fire(0); if (c.stopped) return STOP; await c.wait(0); }
  return 'done';
});
NODES['flow/while'].out = [['body', 'exec'], ['done', 'exec']];
flow('flow/once', 'Do Once', 'Flow', [], [], (c) => { if (c.node.state.done) return STOP; c.node.state.done = true; });
flow('flow/flipflop', 'Flip Flop', 'Flow', [], [['B', 'exec'], ['isA', 'boolean']], (c) => { const a = !c.node.state.a; c.node.state.a = a; c.set(2, a); return a ? 0 : 1; });
NODES['flow/flipflop'].out = [['A', 'exec'], ['B', 'exec'], ['isA', 'boolean']];
flow('flow/switch', 'Switch', 'Flow', [['value', 'any']], [['case 2', 'exec'], ['case 3', 'exec'], ['default', 'exec']], (c) => {
  const v = String(c.in(0)); const cases = [c.prop('case0'), c.prop('case1'), c.prop('case2')].map(String);
  const i = cases.indexOf(v); return i >= 0 ? i : 3;
}, { case0: 'a', case1: 'b', case2: 'c' });
NODES['flow/switch'].out = [['case 1', 'exec'], ['case 2', 'exec'], ['case 3', 'exec'], ['default', 'exec']];
flow('flow/call-event', 'Call Custom Event', 'Flow', [['name', 'string', 'my-custom'], ['a', 'any'], ['b', 'any']], [], async (c) => { await c.g.callCustom(String(c.in(0)), c.in(1), c.in(2)); });
flow('flow/call-graph', 'Run Graph File', 'Flow', [['file', 'string', 'graphs/other.graph.json'], ['a', 'any'], ['b', 'any']], [], async (c) => { await c.g.runFile(String(c.in(0)), { a: c.in(1), b: c.in(2) }); });
flow('flow/stop', 'Stop Graph', 'Flow', [], [], (c) => { c.g.stop(); return STOP; });

// ───────── Variables ─────────
pure('var/get', 'Get Variable', 'Variables', [], [['value', 'any']], (c) => c.vars[c.prop('name')] ?? JSON.parse(JSON.stringify(c.g.defaults[c.prop('name')] ?? null)), { name: 'score' });
flow('var/set', 'Set Variable', 'Variables', [['value', 'any']], [['value', 'any']], (c) => { c.vars[c.prop('name')] = c.in(0); c.set(1, c.in(0)); }, { name: 'score' });
flow('var/add', 'Add To Variable', 'Variables', [['amount', 'number', 1]], [['value', 'number']], (c) => { const k = c.prop('name'); c.vars[k] = n(c.vars[k]) + n(c.in(0)); c.set(1, c.vars[k]); }, { name: 'score' });
pure('var/entity-get', 'Get Entity Variable', 'Variables', [['entity', 'entity']], [['value', 'any']], (c, e) => c.ent(e)?.vars?.[c.prop('name')], { name: 'hp' });
flow('var/entity-set', 'Set Entity Variable', 'Variables', [['entity', 'entity'], ['value', 'any']], [], (c) => { const e = c.ent(c.in(0)); if (e) e.vars[c.prop('name')] = c.in(1); }, { name: 'hp' });
pure('save/get', 'Save: Get', 'Variables', [['key', 'string', 'best'], ['default', 'any']], [['value', 'any']], (c, k, d) => c.game.save.get(String(k), d));
flow('save/set', 'Save: Set', 'Variables', [['key', 'string', 'best'], ['value', 'any']], [], (c) => { c.game.save.set(String(c.in(0)), c.in(1)); });

// ───────── Constants + Math ─────────
pure('const/number', 'Number', 'Math', [], [['value', 'number']], (c) => n(c.prop('value')), { value: 0 });
pure('const/string', 'Text', 'Text', [], [['value', 'string']], (c) => String(c.prop('value')), { value: 'hello' });
pure('const/boolean', 'Boolean', 'Logic', [], [['value', 'boolean']], (c) => !!c.prop('value'), { value: true });
pure('const/vec3', 'Vector3', 'Vector', [['x', 'number', 0], ['y', 'number', 0], ['z', 'number', 0]], [['vec', 'vec3']], (c, x, y, z) => [n(x), n(y), n(z)]);
pure('const/color', 'Color', 'Text', [], [['color', 'color']], (c) => String(c.prop('color')), { color: '#88c0d0' });
const bin = (type, title, f, sym) => pure(type, `${title}`, 'Math', [['a', 'number', 0], ['b', 'number', 0]], [['result', 'number']], (c, a, b) => f(n(a), n(b)));
bin('math/add', 'A + B', (a, b) => a + b); bin('math/sub', 'A − B', (a, b) => a - b); bin('math/mul', 'A × B', (a, b) => a * b);
bin('math/div', 'A ÷ B', (a, b) => (b === 0 ? 0 : a / b)); bin('math/mod', 'A mod B', (a, b) => (b === 0 ? 0 : ((a % b) + b) % b));
bin('math/pow', 'A ^ B', (a, b) => a ** b); bin('math/min', 'Min', Math.min); bin('math/max', 'Max', Math.max); bin('math/atan2', 'Atan2(A, B)', Math.atan2);
const un = (type, title, f) => pure(type, title, 'Math', [['value', 'number', 0]], [['result', 'number']], (c, v) => f(n(v)));
un('math/abs', 'Abs', Math.abs); un('math/floor', 'Floor', Math.floor); un('math/ceil', 'Ceil', Math.ceil); un('math/round', 'Round', Math.round);
un('math/sin', 'Sin', Math.sin); un('math/cos', 'Cos', Math.cos); un('math/sqrt', 'Sqrt', (v) => Math.sqrt(Math.max(0, v))); un('math/sign', 'Sign', Math.sign); un('math/negate', 'Negate', (v) => -v);
pure('math/clamp', 'Clamp', 'Math', [['value', 'number', 0], ['min', 'number', 0], ['max', 'number', 1]], [['result', 'number']], (c, v, a, b) => Math.min(Math.max(n(v), n(a)), n(b)));
pure('math/lerp', 'Lerp', 'Math', [['a', 'number', 0], ['b', 'number', 1], ['t', 'number', 0.5]], [['result', 'number']], (c, a, b, t) => n(a) + (n(b) - n(a)) * n(t));
pure('math/remap', 'Remap', 'Math', [['value', 'number', 0], ['from min', 'number', 0], ['from max', 'number', 1], ['to min', 'number', 0], ['to max', 'number', 100]], [['result', 'number']], (c, v, a, b, x, y) => (b === a ? n(x) : n(x) + ((n(v) - n(a)) / (n(b) - n(a))) * (n(y) - n(x))));
pure('math/random', 'Random Number', 'Math', [['min', 'number', 0], ['max', 'number', 1]], [['value', 'number']], (c, a, b) => c.game.rng.range(n(a), n(b)));
pure('math/random-int', 'Random Integer', 'Math', [['min', 'number', 0], ['max', 'number', 10]], [['value', 'number']], (c, a, b) => c.game.rng.int(n(a), n(b)));
pure('math/time', 'Time', 'Math', [], [['elapsed', 'number'], ['delta', 'number']], (c) => [c.game.time.elapsed, c.game.time.delta]);

// ───────── Logic ─────────
pure('logic/compare', 'Compare', 'Logic', [['a', 'any', 0], ['b', 'any', 0]], [['result', 'boolean']], (c, a, b) => {
  const op = c.prop('op');
  return op === '==' ? a == b : op === '!=' ? a != b : op === '<' ? n(a) < n(b) : op === '<=' ? n(a) <= n(b) : op === '>' ? n(a) > n(b) : n(a) >= n(b);
}, { op: ['==', '!=', '<', '<=', '>', '>='] });
pure('logic/and', 'And', 'Logic', [['a', 'boolean', true], ['b', 'boolean', true]], [['result', 'boolean']], (c, a, b) => !!a && !!b);
pure('logic/or', 'Or', 'Logic', [['a', 'boolean', false], ['b', 'boolean', false]], [['result', 'boolean']], (c, a, b) => !!a || !!b);
pure('logic/not', 'Not', 'Logic', [['value', 'boolean', false]], [['result', 'boolean']], (c, v) => !v);
pure('logic/select', 'Select (A ? B : C)', 'Logic', [['condition', 'boolean', true], ['if true', 'any'], ['if false', 'any']], [['value', 'any']], (c, k, a, b) => (k ? a : b));
pure('logic/is-valid', 'Is Valid', 'Logic', [['value', 'any']], [['valid', 'boolean']], (c, v) => v != null && !(v.destroyed === true));

// ───────── Vector ─────────
pure('vec/split', 'Split Vector3', 'Vector', [['vec', 'vec3']], [['x', 'number'], ['y', 'number'], ['z', 'number']], (c, v) => vec(v));
pure('vec/add', 'Vector A + B', 'Vector', [['a', 'vec3'], ['b', 'vec3']], [['result', 'vec3']], (c, a, b) => vec(a).map((x, i) => x + vec(b)[i]));
pure('vec/sub', 'Vector A − B', 'Vector', [['a', 'vec3'], ['b', 'vec3']], [['result', 'vec3']], (c, a, b) => vec(a).map((x, i) => x - vec(b)[i]));
pure('vec/scale', 'Vector × Number', 'Vector', [['vec', 'vec3'], ['scale', 'number', 1]], [['result', 'vec3']], (c, v, s) => vec(v).map((x) => x * n(s, 1)));
pure('vec/length', 'Vector Length', 'Vector', [['vec', 'vec3']], [['length', 'number']], (c, v) => Math.hypot(...vec(v)));
pure('vec/normalize', 'Normalize', 'Vector', [['vec', 'vec3']], [['result', 'vec3']], (c, v) => { const a = vec(v), l = Math.hypot(...a) || 1; return a.map((x) => x / l); });
pure('vec/distance', 'Distance', 'Vector', [['a', 'vec3'], ['b', 'vec3']], [['distance', 'number']], (c, a, b) => Math.hypot(...vec(a).map((x, i) => x - vec(b)[i])));
pure('vec/lerp', 'Vector Lerp', 'Vector', [['a', 'vec3'], ['b', 'vec3'], ['t', 'number', 0.5]], [['result', 'vec3']], (c, a, b, t) => vec(a).map((x, i) => x + (vec(b)[i] - x) * n(t)));

// ───────── Text + Array ─────────
pure('text/concat', 'Join Text', 'Text', [['a', 'any', ''], ['b', 'any', '']], [['text', 'string']], (c, a, b) => `${c.prop('separator') ?? ''}`.length ? `${a}${c.prop('separator')}${b}` : `${a}${b}`, { separator: '' });
pure('text/format', 'Format Text', 'Text', [['a', 'any'], ['b', 'any'], ['c', 'any']], [['text', 'string']], (c, a, b, d) => String(c.prop('template')).replace(/\{(a|b|c)\}/g, (_, k) => ({ a, b, c: d }[k] ?? '')), { template: 'Score: {a}' });
pure('text/to-string', 'To Text', 'Text', [['value', 'any']], [['text', 'string']], (c, v) => (typeof v === 'object' ? JSON.stringify(v) : String(v ?? '')));
pure('text/to-number', 'To Number', 'Text', [['text', 'any']], [['number', 'number']], (c, v) => n(v));
pure('text/length', 'Text Length', 'Text', [['text', 'string', '']], [['length', 'number']], (c, s) => String(s).length);
pure('array/make', 'Make Array', 'Array', [['a', 'any'], ['b', 'any'], ['c', 'any'], ['d', 'any']], [['array', 'array']], (c, ...v) => v.filter((x) => x !== undefined));
pure('array/get', 'Array Get', 'Array', [['array', 'array'], ['index', 'number', 0]], [['item', 'any']], (c, a, i) => (Array.isArray(a) ? a[n(i)] : undefined));
pure('array/length', 'Array Length', 'Array', [['array', 'array']], [['length', 'number']], (c, a) => (Array.isArray(a) ? a.length : 0));
pure('array/random', 'Random Item', 'Array', [['array', 'array']], [['item', 'any']], (c, a) => (Array.isArray(a) && a.length ? c.game.rng.pick(a) : undefined));
flow('array/push', 'Array Push', 'Array', [['array', 'array'], ['item', 'any']], [], (c) => { const a = c.in(0); if (Array.isArray(a)) a.push(c.in(1)); });

// ───────── Entity ─────────
pure('entity/self', 'This Entity', 'Entity', [], [['entity', 'entity']], (c) => c.entity);
pure('entity/find', 'Find Entity By Name', 'Entity', [['name', 'string', 'Player']], [['entity', 'entity']], (c, name) => c.scene.find(String(name)));
pure('entity/find-tag', 'Find Entities By Tag', 'Entity', [['tag', 'string', 'enemy']], [['entities', 'array']], (c, t) => c.scene.findByTag(String(t)));
pure('entity/get-pos', 'Get Position', 'Entity', [['entity', 'entity']], [['pos', 'vec3'], ['x', 'number'], ['y', 'number'], ['z', 'number']], (c, e) => { const p = c.ent(e)?.worldPos ?? [0, 0, 0]; return [p, ...p]; });
flow('entity/set-pos', 'Set Position', 'Entity', [['entity', 'entity'], ['pos', 'vec3']], [], (c) => { const e = c.ent(c.in(0)); if (e) e.pos = vec(c.in(1)); });
flow('entity/translate', 'Move By', 'Entity', [['entity', 'entity'], ['delta', 'vec3']], [], (c) => { const e = c.ent(c.in(0)); if (e) { const d = vec(c.in(1)); e.pos = e.pos.map((x, i) => x + d[i]); } });
pure('entity/get-rot', 'Get Rotation', 'Entity', [['entity', 'entity']], [['rot', 'vec3']], (c, e) => [...(c.ent(e)?.rot ?? [0, 0, 0])]);
flow('entity/set-rot', 'Set Rotation', 'Entity', [['entity', 'entity'], ['rot', 'vec3']], [], (c) => { const e = c.ent(c.in(0)); if (e) e.rot = vec(c.in(1)); });
flow('entity/set-scale', 'Set Scale', 'Entity', [['entity', 'entity'], ['scale', 'vec3']], [], (c) => { const e = c.ent(c.in(0)); if (e) e.scale = vec(c.in(1)); });
flow('entity/set-enabled', 'Set Enabled', 'Entity', [['entity', 'entity'], ['enabled', 'boolean', true]], [], (c) => { const e = c.ent(c.in(0)); if (e) e.enabled = !!c.in(1); });
flow('entity/destroy', 'Destroy Entity', 'Entity', [['entity', 'entity']], [], (c) => { c.ent(c.in(0))?.destroy(); });
flow('entity/spawn', 'Spawn Prefab', 'Entity', [['prefab', 'string', 'prefabs/bullet.prefab.json'], ['pos', 'vec3']], [['entity', 'entity']], async (c) => { c.set(1, await c.scene.spawn(String(c.in(0)), { pos: vec(c.in(1)) })); });
flow('entity/clone', 'Clone Entity', 'Entity', [['entity', 'entity']], [['entity', 'entity']], async (c) => { const e = c.ent(c.in(0)); if (e) c.set(1, await e.clone()); });
pure('entity/has-tag', 'Has Tag', 'Entity', [['entity', 'entity'], ['tag', 'string', 'enemy']], [['result', 'boolean']], (c, e, t) => !!c.ent(e)?.hasTag(String(t)));
pure('entity/name', 'Get Name', 'Entity', [['entity', 'entity']], [['name', 'string']], (c, e) => c.ent(e)?.name ?? '');
flow('entity/set-component', 'Set Component Value', 'Entity', [['entity', 'entity'], ['value', 'any']], [], (c) => { c.ent(c.in(0))?.set(c.prop('component'), c.prop('key'), c.in(1)); }, { component: 'sprite', key: 'tint' });
flow('entity/tween', 'Tween Position', 'Entity', [['entity', 'entity'], ['to', 'vec3'], ['seconds', 'number', 1]], [], async (c) => {
  const e = c.ent(c.in(0)); if (!e) return; const to = vec(c.in(1));
  await new Promise((res) => { c.scene.scheduler.tween(e.pos, { 0: to[0], 1: to[1], 2: to[2] }, { duration: n(c.in(2), 1), ease: c.prop('ease'), onUpdate: () => e.touch(), onComplete: res }); });
}, { ease: ['quadOut', 'linear', 'quadIn', 'quadInOut', 'cubicOut', 'bounceOut'] });

// ───────── Physics ─────────
flow('physics/velocity', 'Set Velocity', 'Physics', [['entity', 'entity'], ['velocity', 'vec3']], [], (c) => { const e = c.ent(c.in(0)), v = vec(c.in(1)); if (e) c.game.physics?.setVelocity?.(e, v[0], v[1], v[2]); });
flow('physics/impulse', 'Apply Impulse', 'Physics', [['entity', 'entity'], ['impulse', 'vec3']], [], (c) => { const e = c.ent(c.in(0)), v = vec(c.in(1)); if (e) c.game.physics?.applyImpulse?.(e, v[0], v[1], v[2]); });
pure('physics/get-velocity', 'Get Velocity', 'Physics', [['entity', 'entity']], [['velocity', 'vec3']], (c, e) => { const v = c.ent(e) && c.game.physics?.velocity?.(c.ent(e)); return v ? [v[0] ?? 0, v[1] ?? 0, v[2] ?? 0] : [0, 0, 0]; });
pure('physics/grounded', 'Is Grounded', 'Physics', [['entity', 'entity']], [['grounded', 'boolean']], (c, e) => !!(c.ent(e) && c.game.physics?.isGrounded?.(c.ent(e))));

// ───────── Input ─────────
pure('input/down', 'Action Held', 'Input', [], [['down', 'boolean']], (c) => c.game.input.down(c.prop('action')), { action: 'jump' });
pure('input/pressed', 'Action Pressed', 'Input', [], [['pressed', 'boolean']], (c) => c.game.input.pressed(c.prop('action')), { action: 'jump' });
pure('input/axis', 'Axis', 'Input', [], [['value', 'number']], (c) => c.game.input.axis(c.prop('negative'), c.prop('positive')), { negative: 'left', positive: 'right' });
pure('input/vec', 'Direction Vector', 'Input', [], [['vec', 'vec3'], ['x', 'number'], ['y', 'number']], (c) => { const v = c.game.input.vec(c.prop('left'), c.prop('right'), c.prop('up'), c.prop('down')); return [[v[0], v[1], 0], v[0], v[1]]; }, { left: 'left', right: 'right', up: 'up', down: 'down' });
pure('input/pointer', 'Pointer', 'Input', [], [['x', 'number'], ['y', 'number'], ['down', 'boolean']], (c) => { const p = c.game.input.pointer; return [p.worldX ?? p.x, p.worldY ?? p.y, !!p.down]; });

// ───────── UI (nord-ui scenes) ─────────
const screen = (c, name) => c.game.ui?.scenes?.get(String(name)) ?? null;
flow('ui/load', 'Load UI Screen', 'UI', [['file', 'string', 'ui/menu.ui.json']], [], async (c) => { await c.game.ui?.load(String(c.in(0))); });
flow('ui/show', 'Show / Hide Screen', 'UI', [['screen', 'string', 'menu'], ['visible', 'boolean', true]], [], (c) => { const s = screen(c, c.in(0)); if (s) s[c.in(1) ? 'show' : 'hide'](); });
flow('ui/set-text', 'Set UI Text', 'UI', [['screen', 'string', 'menu'], ['node', 'string', 'score'], ['text', 'any']], [], (c) => { const nd = screen(c, c.in(0))?.get(String(c.in(1))); if (nd) nd.text = String(c.in(2) ?? ''); });
flow('ui/set-var', 'Set UI Variable', 'UI', [['screen', 'string', 'menu'], ['name', 'string', 'score'], ['value', 'any']], [], (c) => { screen(c, c.in(0))?.set(String(c.in(1)), c.in(2)); });
flow('ui/set-prop', 'Set UI Node Property', 'UI', [['screen', 'string', 'menu'], ['node', 'string', 'play'], ['value', 'any']], [], (c) => { const nd = screen(c, c.in(0))?.get(String(c.in(1))); if (nd) nd[c.prop('property')] = c.in(2); }, { property: ['text', 'value', 'visible', 'disabled', 'color', 'src', 'checked'] });
pure('ui/get-value', 'Get UI Value', 'UI', [['screen', 'string', 'menu'], ['node', 'string', 'name']], [['value', 'any']], (c, s, nd) => screen(c, s)?.get(String(nd))?.value);
flow('ui/skin', 'Use UI Skin', 'UI', [['file', 'string', 'ui/skin.json']], [], async (c) => { await c.game.ui?.useSkin(String(c.in(0))); });

// ───────── Audio ─────────
flow('audio/play', 'Play Sound', 'Audio', [['clip', 'string', 'assets/audio/sfx/click.wav'], ['volume', 'number', 1]], [], (c) => { c.game.audio?.play(String(c.in(0)), { volume: n(c.in(1), 1), bus: c.prop('bus') }); }, { bus: ['sfx', 'ui', 'music'] });
flow('audio/music', 'Play Music', 'Audio', [['clip', 'string', 'assets/audio/music.mp3']], [], (c) => { c.game.audio?.music?.(String(c.in(0))); });
flow('audio/stop-music', 'Stop Music', 'Audio', [], [], (c) => { c.game.audio?.stopMusic(); });
flow('audio/volume', 'Set Volume', 'Audio', [['volume', 'number', 1]], [], (c) => { c.game.audio?.volume(c.prop('bus'), n(c.in(0), 1)); }, { bus: ['master', 'music', 'sfx', 'ui'] });

// ───────── Game ─────────
flow('game/load-scene', 'Load Scene', 'Game', [['scene', 'string', 'scenes/main.scene.json']], [], async (c) => { c.g.stop(); await c.game.loadScene(String(c.in(0))); return STOP; });
flow('game/restart', 'Restart Scene', 'Game', [], [], async (c) => { c.g.stop(); await c.game.restart(); return STOP; });
flow('game/pause', 'Pause / Resume', 'Game', [['paused', 'boolean', true]], [], (c) => { c.game[c.in(0) ? 'pause' : 'resume'](); });
flow('game/timescale', 'Set Time Scale', 'Game', [['scale', 'number', 1]], [], (c) => { c.game.timeScale = n(c.in(0), 1); });
flow('game/emit', 'Emit Game Event', 'Game', [['name', 'string', 'my-event'], ['data', 'any']], [], (c) => { c.game.events.emit(String(c.in(0)), c.in(1)); });
flow('game/emit-entity', 'Emit Entity Event', 'Game', [['entity', 'entity'], ['name', 'string', 'click'], ['data', 'any']], [], (c) => { c.ent(c.in(0))?.emit(String(c.in(1)), c.in(2)); });
flow('game/log', 'Log', 'Game', [['message', 'any']], [], (c) => { c.log(c.in(0)); });
flow('game/quit-browser', 'Open URL', 'Game', [['url', 'string', 'https://']], [], (c) => { const u = String(c.in(0)); if (/^https?:\/\//.test(u)) globalThis.open?.(u, '_blank', 'noopener'); });

// ───────── Advanced (escape hatches: reach any property, method or JS) ─────────
pure('adv/get-prop', 'Get Property', 'Advanced', [['object', 'any'], ['path', 'string', 'pos.0']], [['value', 'any']], (c, o, p) => path(o ?? c.entity, p));
flow('adv/set-prop', 'Set Property', 'Advanced', [['object', 'any'], ['path', 'string', 'name'], ['value', 'any']], [], (c) => { const o = c.in(0) ?? c.entity; if (o) setPath(o, c.in(1), c.in(2)); o?.touch?.(); });
flow('adv/call', 'Call Method', 'Advanced', [['object', 'any'], ['method', 'string', 'emit'], ['a', 'any'], ['b', 'any'], ['c', 'any']], [['result', 'any']], async (c) => {
  const o = c.in(0) ?? c.entity, f = o?.[String(c.in(1))];
  if (typeof f === 'function') c.set(1, await f.call(o, ...[c.in(2), c.in(3), c.in(4)].filter((x) => x !== undefined)));
});
pure('adv/game', 'Game / Scene Service', 'Advanced', [], [['object', 'any']], (c) => ({ game: c.game, scene: c.scene, input: c.game.input, audio: c.game.audio, ui: c.game.ui, physics: c.game.physics, events: c.game.events, save: c.game.save }[c.prop('service')]), { service: ['game', 'scene', 'input', 'audio', 'ui', 'physics', 'events', 'save'] });
pure('adv/script', 'Entity Script', 'Advanced', [['entity', 'entity']], [['script', 'object']], (c, e) => c.ent(e)?.scripts.find((s) => s.constructor.name === c.prop('class') || s._path === c.prop('class')) ?? c.ent(e)?.scripts[0], { class: '' });
pure('adv/component', 'Entity Component', 'Advanced', [['entity', 'entity']], [['component', 'object']], (c, e) => c.ent(e)?.getComponent(c.prop('type')), { type: 'sprite' });
pure('adv/js-expr', 'JavaScript Expression', 'Advanced', [['a', 'any'], ['b', 'any'], ['c', 'any'], ['d', 'any']], [['result', 'any']], (c, a, b, x, d) => c.js(c.prop('code'), { a, b, c: x, d, ctx: c }, true), { code: 'a + b' });
flow('adv/js', 'Run JavaScript', 'Advanced', [['a', 'any'], ['b', 'any'], ['c', 'any'], ['d', 'any']], [['result', 'any']], async (c) => { c.set(1, await c.js(c.prop('code'), { a: c.in(0), b: c.in(1), c: c.in(2), d: c.in(3), ctx: c }, false)); }, { code: 'console.log(game.time.elapsed)' });
pure('util/reroute', 'Reroute', 'Advanced', [['in', 'any']], [['out', 'any']], (c, v) => v);
pure('util/comment', 'Comment', 'Advanced', [], [], () => undefined, { text: 'Note' });

/** Check a serialized graph for problems (unknown nodes, missing event entry, broken links). Returns strings. */
export function validate(def) {
  const out = [];
  if (!def || !Array.isArray(def.nodes)) return ['not a graph file (missing nodes)'];
  const ids = new Map(def.nodes.map((nd) => [nd.id, nd]));
  for (const nd of def.nodes) if (!NODES[nd.type]) out.push(`node ${nd.id}: unknown type "${nd.type}"`);
  for (const l of def.links ?? []) if (l && (!ids.has(l[1]) || !ids.has(l[3]))) out.push(`link ${l[0]}: points at a missing node`);
  if (!def.nodes.some((nd) => NODES[nd.type]?.event)) out.push('no event node (add On Start or On Update so something runs)');
  return out;
}
