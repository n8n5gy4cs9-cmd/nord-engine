import test from 'node:test';
import assert from 'node:assert/strict';
import { Game, MemoryStorage, compileExpression } from './index.js';

const files = {};
const mk = () => new Game({ id: 'x', startScene: 's', input: { actions: { jump: ['Space'] } } }, {
  fetchJSON: async (p) => structuredClone(files[p]), importScript: async () => ({}), storage: new MemoryStorage(), onError: (e) => { throw e; }, seed: 1,
});
const C = (object, id, params, inverted) => ({ object, id, params, inverted });
const ev = (conditions, actions, children, extra = {}) => ({ type: 'event', conditions, actions, children, ...extra });
const sys = (id, params) => C('System', id, params);
const setv = (variable, value) => ({ object: 'System', id: 'set-var', params: { variable, value } });
async function run(events, entities = [], ticks = 1) {
  files.sheet = { format: 1, events };
  files.s = { name: 's', settings: { eventSheet: 'sheet' }, entities };
  const g = mk(); await g.loadScene('s');
  for (let i = 0; i < ticks; i++) g.tick(1 / 60);
  return g;
}
const E = (name, x = 0, y = 0, extra = {}) => ({ id: name.toLowerCase(), name, transform: { pos: [x, y, 0] }, ...extra });
const V = (g, n) => g.scene.eventSheet.getVar(n);

test('expressions: precedence, strings, ternary, builtins', () => {
  const env = { name: (n) => ({ a: 3 })[n], random: () => 0.5, call: () => 0, prop: () => 0, method: () => 0 };
  const e = (s) => compileExpression(s)(env);
  assert.equal(e('1 + 2 * 3'), 7); assert.equal(e('2 ^ 3 ^ 2'), 512); assert.equal(e('"a" & a & "b"'), 'a3b');
  assert.equal(e('a > 2 ? 10 : 20'), 10); assert.equal(e('-a + abs(-2)'), -1); assert.equal(e('a = 3 && !0'), 1);
  assert.equal(e('floor(sqrt(17))'), 4); assert.equal(e('clamp(9, 0, 5)'), 5); assert.equal(Math.round(e('sin(90)')), 1);
  assert.throws(() => e('1 +'));
});

test('start of layout + every tick + variables', async () => {
  const g = await run([
    { type: 'variable', name: 'score', valueType: 'number', value: 5 },
    ev([sys('on-start-of-layout')], [setv('score', 'score * 2')]),
    ev([sys('every-tick')], [{ object: 'System', id: 'add-to-var', params: { variable: 'score', value: 1 } }]),
  ], [], 3);
  assert.equal(V(g, 'score'), 13);
});

test('SOL picking: conditions filter, actions hit only the picked, sub-events inherit', async () => {
  const g = await run([
    ev([C('Enemy', 'compare-x', { comparison: '>', value: '100' })], [C('Enemy', 'set-instance-var', { variable: 'hit', value: '1' })].map((a) => ({ ...a })), [
      ev([C('Enemy', 'compare-y', { comparison: '<', value: '50' })], [{ object: 'Enemy', id: 'destroy' }]),
    ]),
  ], [E('Enemy', 50, 10, { vars: { hit: 0 } }), E('Enemy', 150, 10, { vars: { hit: 0 } }), E('Enemy', 200, 90, { vars: { hit: 0 } })], 2);
  const l = g.scene.findByTag ? [...g.scene.all()].filter((e) => e.name === 'Enemy' && !e.destroyed) : [];
  assert.deepEqual(l.map((e) => [e.pos[0], e.vars.hit]), [[50, 0], [200, 1]]);
});

test('inverted condition, Else chain, Or-block', async () => {
  const g = await run([
    { type: 'variable', name: 'r', valueType: 'string', value: '' },
    { type: 'variable', name: 'n', valueType: 'number', value: 2 },
    ev([sys('compare-variable', { variable: 'n', comparison: '=', value: '1' })], [setv('r', '"one"')]),
    ev([sys('else'), sys('compare-variable', { variable: 'n', comparison: '=', value: '2' })], [setv('r', 'r & "two"')]),
    ev([sys('else')], [setv('r', 'r & "other"')]),
    ev([sys('compare-variable', { variable: 'n', comparison: '=', value: '9' }), sys('compare-variable', { variable: 'n', comparison: '=', value: '2' })], [setv('r', 'r & "+or"')], undefined, { block: 'or' }),
    ev([{ ...sys('compare-variable', { variable: 'n', comparison: '=', value: '2' }), inverted: true }], [setv('r', 'r & "BAD"')]),
  ]);
  assert.equal(V(g, 'r'), 'two+or');
});

test('loops: repeat, for, for each; local vars; loopindex', async () => {
  const g = await run([
    { type: 'variable', name: 'sum', valueType: 'number', value: 0 },
    { type: 'variable', name: 'ysum', valueType: 'number', value: 0 },
    ev([sys('repeat', { count: '4' })], [{ object: 'System', id: 'add-to-var', params: { variable: 'sum', value: 'loopindex' } }]),
    ev([sys('for', { name: 'i', start: '1', end: '3' })], [{ object: 'System', id: 'add-to-var', params: { variable: 'sum', value: 'loopindex("i") * 100' } }]),
    ev([sys('for-each', { object: 'Coin' })], [{ object: 'System', id: 'add-to-var', params: { variable: 'ysum', value: 'Coin.Y' } }], [{ type: 'variable', name: 'tmp', valueType: 'number', value: 7 }]),
  ], [E('Coin', 0, 10), E('Coin', 0, 20), E('Coin', 0, 30)]);
  assert.equal(V(g, 'sum'), 0 + 1 + 2 + 3 + 600);
  assert.equal(V(g, 'ysum'), 60);
  assert.throws(() => g.scene.eventSheet.getVar('tmp'));
});

test('object expressions: Count, Name(i).Prop, per-instance parameter evaluation', async () => {
  const g = await run([
    { type: 'variable', name: 'c', valueType: 'number', value: 0 },
    ev([sys('every-tick')], [setv('c', 'Box.Count * 100 + Box(1).Y'), { object: 'Box', id: 'set-y', params: { y: 'Box.X * 2' } }]),
  ], [E('Box', 1, 5), E('Box', 2, 6), E('Box', 3, 7)]);
  assert.equal(V(g, 'c'), 306);
  assert.deepEqual([...g.scene.all()].map((e) => e.pos[1]), [2, 4, 6]);
});

test('functions: params, return value, recursion guard, call from expression', async () => {
  const g = await run([
    { type: 'variable', name: 'out', valueType: 'number', value: 0 },
    { type: 'function-block', name: 'Add', params: [{ name: 'a' }, { name: 'b', initialValue: 10 }], returnType: 'number', actions: [{ object: 'Functions', id: 'set-return-value', params: { value: 'Function.Param(0) + Function.Param(1)' } }] },
    ev([sys('on-start-of-layout')], [setv('out', 'Functions.Add(5, 6) * 2'), { object: 'Functions', id: 'call', params: { name: 'Add', args: ['1'] } }]),
  ]);
  assert.equal(V(g, 'out'), 22);
});

test('triggers: keyboard, input action, on-created / on-destroyed, collision; trigger once', async () => {
  const log = [];
  files.sheet = { format: 1, events: [
    { type: 'variable', name: 'k', valueType: 'number', value: 0 },
    { type: 'variable', name: 'once', valueType: 'number', value: 0 },
    { type: 'variable', name: 'col', valueType: 'number', value: 0 },
    ev([C('Keyboard', 'on-key-pressed', { key: '"Space"' })], [{ object: 'System', id: 'add-to-var', params: { variable: 'k', value: '1' } }]),
    ev([C('Keyboard', 'key-is-down', { key: 'Space' }), sys('trigger-once-while-true')], [{ object: 'System', id: 'add-to-var', params: { variable: 'once', value: '1' } }]),
    ev([C('Hero', 'on-collision', { object: 'Wall' })], [{ object: 'System', id: 'add-to-var', params: { variable: 'col', value: '1' } }, { object: 'Hero', id: 'set-x', params: { x: '99' } }]),
  ] };
  files.s = { name: 's', settings: { eventSheet: 'sheet' }, entities: [E('Hero'), E('Wall')] };
  const g = mk(); await g.loadScene('s');
  g.input.setKey('Space', true);
  for (let i = 0; i < 5; i++) g.tick(1 / 60);
  assert.equal(V(g, 'k'), 1); assert.equal(V(g, 'once'), 1);
  g.input.setKey('Space', false); g.tick(1 / 60);
  g.input.setKey('Space', true); g.tick(1 / 60);
  assert.equal(V(g, 'k'), 2); assert.equal(V(g, 'once'), 2);
  const [h, w] = [g.scene.find('Hero'), g.scene.find('Wall')];
  g.scene.dispatch(h, 'onCollisionEnter', w, {});
  assert.equal(V(g, 'col'), 1); assert.equal(h.pos[0], 99);
});

test('wait action resumes remaining actions; groups; includes; every-x-seconds', async () => {
  files.inc = { format: 1, events: [{ type: 'variable', name: 'inc', valueType: 'number', value: 3 }] };
  files.sheet = { format: 1, events: [
    { type: 'include', path: 'inc' },
    { type: 'variable', name: 'w', valueType: 'string', value: '' },
    { type: 'variable', name: 't', valueType: 'number', value: 0 },
    ev([sys('on-start-of-layout')], [setv('w', '"a"'), { object: 'System', id: 'wait', params: { seconds: '0.5' } }, setv('w', 'w & "b"')]),
    { type: 'group', title: 'G', active: false, children: [ev([sys('every-tick')], [setv('w', '"never"')])] },
    ev([sys('every-x-seconds', { seconds: '0.25' })], [{ object: 'System', id: 'add-to-var', params: { variable: 't', value: '1' } }]),
  ] };
  files.s = { name: 's', settings: { eventSheet: 'sheet' }, entities: [] };
  const g = mk(); await g.loadScene('s');
  for (let i = 0; i < 20; i++) g.tick(1 / 60);
  assert.equal(V(g, 'w'), 'a'); assert.equal(V(g, 'inc'), 3);
  for (let i = 0; i < 20; i++) g.tick(1 / 60);
  assert.equal(V(g, 'w'), 'ab');
  assert.ok(V(g, 't') >= 2 && V(g, 't') <= 3, `t=${V(g, 't')}`);
});

test('create-object spawns a prefab and picks it for following actions', async () => {
  files['prefabs/bullet.prefab.json'] = { format: 1, root: E('Bullet', 0, 0, { vars: { dmg: 0 } }) };
  files.sheet = { format: 1, events: [ev([sys('on-start-of-layout')], [
    { object: 'System', id: 'create-object', params: { object: 'Bullet', layer: '0', x: '7', y: '8' } },
    { object: 'Bullet', id: 'set-instance-var', params: { variable: 'dmg', value: '42' } },
  ])] };
  files.s = { name: 's', settings: { eventSheet: 'sheet' }, entities: [] };
  const g = mk(); await g.loadScene('s');
  await new Promise((r) => setTimeout(r, 10)); g.tick(1 / 60);
  const b = g.scene.find('Bullet');
  assert.ok(b); assert.deepEqual([b.pos[0], b.pos[1], b.vars.dmg], [7, 8, 42]);
});

test('errors are reported once and do not stop other events', async () => {
  files.sheet = { format: 1, events: [
    { type: 'variable', name: 'ok', valueType: 'number', value: 0 },
    ev([sys('every-tick')], [setv('nope', '1')]),
    ev([sys('every-tick')], [{ object: 'System', id: 'add-to-var', params: { variable: 'ok', value: '1' } }]),
  ] };
  files.s = { name: 's', settings: { eventSheet: 'sheet' }, entities: [] };
  const errs = [];
  const g = new Game({ id: 'x', startScene: 's' }, { fetchJSON: async (p) => structuredClone(files[p]), importScript: async () => ({}), storage: new MemoryStorage(), onError: (e) => errs.push(e.message) });
  await g.loadScene('s'); for (let i = 0; i < 3; i++) g.tick(1 / 60);
  assert.equal(errs.length, 1); assert.equal(V(g, 'ok'), 3);
});

// ---- data objects (M10-26)
const obj = (name, plugin, extra = {}) => ({ type: 'object', name, plugin, ...extra });
const act = (object, id, params) => ({ object, id, params });
test('Array object: push, set/get, sort, sum, json', async () => {
  const g = await run([
    obj('Inv', 'Array'), { type: 'variable', name: 'r', valueType: 'string', value: '' },
    { type: 'variable', name: 'n', valueType: 'number', value: 0 },
    ev([sys('on-start-of-layout')], [act('Inv', 'push-back', { value: '5' }), act('Inv', 'push-back', { value: '2' }), act('Inv', 'push-front', { value: '9' }), act('Inv', 'sort'), setv('r', 'Inv.AsJSON'), setv('n', 'Inv.Sum + Inv.At(2) * 100 + Inv.Width * 10000')]),
  ]);
  assert.equal(V(g, 'n'), 16 + 900 + 30000);
  assert.equal(V(g, 'r'), '{"size":[3,1,1],"data":[2,5,9]}');
});
test('2D Array resize keeps values; condition compare-at-xyz', async () => {
  const g = await run([
    obj('Grid', 'Array', { width: 2, height: 2 }), { type: 'variable', name: 'ok', valueType: 'number', value: 0 },
    ev([sys('on-start-of-layout')], [act('Grid', 'set-at-xyz', { x: '1', y: '1', z: '0', value: '7' }), act('Grid', 'set-size', { width: '3', height: '3', depth: '1' })]),
    ev([C('Grid', 'compare-at-xyz', { x: '1', y: '1', z: '0', comparison: '=', value: '7' })], [setv('ok', '1')]),
  ], [], 2);
  assert.equal(V(g, 'ok'), 1);
});
test('Dictionary + JSON objects', async () => {
  const g = await run([
    obj('D', 'Dictionary'), obj('J', 'JSON'),
    { type: 'variable', name: 'a', valueType: 'number', value: 0 }, { type: 'variable', name: 'b', valueType: 'string', value: '' },
    ev([sys('on-start-of-layout')], [act('D', 'set-key', { key: '"hp"', value: '10' }), act('D', 'add-to-key', { key: '"hp"', value: '5' }),
      act('J', 'parse', { text: '"{\\"p\\":{\\"items\\":[{\\"n\\":\\"sword\\"}]}}"' }), setv('a', 'D.Get("hp") + D.Count'), setv('b', 'J.Get("p.items.0.n")')]),
  ]);
  assert.equal(V(g, 'a'), 16); assert.equal(V(g, 'b'), 'sword');
});
test('AJAX object: request fires On completed with the tag', async () => {
  const g = mk(); g.fetch = async () => ({ ok: true, status: 200, text: async () => 'hello' });
  files.sheet = { format: 1, events: [obj('Net', 'AJAX'), { type: 'variable', name: 'got', valueType: 'string', value: '' },
    ev([sys('on-start-of-layout')], [act('Net', 'request', { tag: '"t1"', url: '"/x"' })]),
    ev([C('Net', 'on-completed', { tag: '"t1"' })], [setv('got', 'Net.LastData')])] };
  files.s = { name: 's', settings: { eventSheet: 'sheet' }, entities: [] };
  await g.loadScene('s'); g.tick(1 / 60);
  await new Promise((r) => setTimeout(r, 10)); g.tick(1 / 60);
  assert.equal(V(g, 'got'), 'hello');
});
test('scene.settings.dataObjects declares objects; global objects persist across scenes', async () => {
  files.sheet = { format: 1, events: [ev([sys('on-start-of-layout')], [act('Score', 'add-to-key', { key: '"n"', value: '1' })])] };
  files.a = { name: 'a', settings: { eventSheet: 'sheet', dataObjects: { Score: { plugin: 'Dictionary', global: true } } }, entities: [] };
  files.b = { name: 'b', settings: { eventSheet: 'sheet', dataObjects: { Score: { plugin: 'Dictionary', global: true } } }, entities: [] };
  const g = mk(); await g.loadScene('a'); await g.loadScene('b');
  assert.equal(g.scene.eventSheet.evalExpr('Score.Get("n")'), 2);
});

// ---- debugger / profiler (M10-22/23)
test('debugger: breakpoint pauses when the event runs, step advances one frame, edit vars, console eval, profiler costs', async () => {
  files.sheet = { format: 1, events: [
    { type: 'variable', name: 'n', valueType: 'number', value: 0 },
    ev([sys('every-tick')], [{ object: 'System', id: 'add-to-var', params: { variable: 'n', value: '1' } }]),
    ev([C('Hero', 'compare-x', { comparison: '>', value: '5' })], [setv('n', 'n + 100')]),
  ] };
  files.s = { name: 's', settings: { eventSheet: 'sheet' }, entities: [E('Hero', 0, 0, { vars: { hp: 3 } })] };
  const g = mk(); const d = g.enableDebug(); await g.loadScene('s');
  assert.equal(d.describe('2'), 'Hero.compare-x → set-var');
  d.toggleBreakpoint('1');
  g.tick(1 / 60);
  assert.equal(d.paused, true, 'breakpoint on event 1 paused the game after its frame');
  assert.equal(V(g, 'n'), 1);
  g.tick(1 / 60); g.tick(1 / 60);
  assert.equal(V(g, 'n'), 1, 'paused: nothing runs');
  d.toggleBreakpoint('1'); d.step();
  g.tick(1 / 60);
  assert.equal(V(g, 'n'), 2); assert.equal(d.paused, true);
  g.tick(1 / 60); assert.equal(V(g, 'n'), 2);
  const hero = d.instances().find((i) => i.name === 'Hero');
  assert.deepEqual(hero.vars, { hp: 3 });
  d.setValue(hero.id, 'hp', '9'); d.setValue(hero.id, 'x', '10');
  assert.equal(d.find(hero.id).vars.hp, 9);
  d.resume(); g.tick(1 / 60);
  assert.equal(V(g, 'n'), 103, 'x=10 now passes the Hero condition');
  assert.deepEqual(d.evaluate('n + Hero.hp'), { ok: true, value: 112 });
  assert.equal(d.evaluate('nope +').ok, false);
  const s = d.stats();
  assert.ok(s.objects === 1 && s.costs.length >= 2 && s.frameMs >= 0);
  assert.ok(d.ran.has('1'));
});

// ---- timelines (M10-21)
test('timeline: keyframes ease, events fire once, finish trigger, loop, pause/seek; bezier + sample', async () => {
  const { sample, bezier } = await import('./timeline.js');
  assert.equal(sample([{ t: 0, v: 0 }, { t: 2, v: 10 }], 1), 5);
  assert.equal(sample([{ t: 0, v: 0 }, { t: 2, v: 10, ease: 'quadIn' }], 1), 2.5);
  assert.equal(sample([{ t: 1, v: 3 }], 0), 3);
  const b = bezier(0.25, 0.1, 0.25, 1); assert.ok(b(0.5) > 0.5 && b(0) === 0 && b(1) === 1);
  files.sheet = { format: 1, events: [{ type: 'variable', name: 'ev', valueType: 'number', value: 0 }, { type: 'variable', name: 'fin', valueType: 'number', value: 0 },
    ev([C('Timeline', 'on-event', { timeline: 'intro', name: 'ping' })], [{ object: 'System', id: 'add-to-var', params: { variable: 'ev', value: '1' } }]),
    ev([C('Timeline', 'on-finished', { timeline: 'intro' })], [setv('fin', '1')]),
    ev([sys('on-start-of-layout')], [{ object: 'Timeline', id: 'play', params: { timeline: 'intro' } }])] };
  files.s = { name: 's', settings: { eventSheet: 'sheet', timelines: { intro: { duration: 1, tracks: [{ target: 'Box', property: 'x', keys: [{ t: 0, v: 0 }, { t: 1, v: 100 }] }, { target: 'Box', property: 'var:hp', keys: [{ t: 0, v: 10 }, { t: 1, v: 0 }] }], events: [{ t: 0.5, name: 'ping' }] } } }, entities: [E('Box', 0, 0, { vars: { hp: 10 } })] };
  const g = mk(); await g.loadScene('s');
  for (let i = 0; i < 30; i++) g.tick(1 / 60); // 0.5s
  const box = g.scene.find('Box');
  assert.ok(Math.abs(box.pos[0] - 50) < 3, `x≈50 (${box.pos[0]})`); assert.ok(Math.abs(box.vars.hp - 5) < 0.5);
  g.scene.timelines.pause('intro'); const x = box.pos[0]; for (let i = 0; i < 10; i++) g.tick(1 / 60); assert.equal(box.pos[0], x);
  g.scene.timelines.resume('intro');
  for (let i = 0; i < 40; i++) g.tick(1 / 60);
  assert.equal(box.pos[0], 100); assert.equal(V(g, 'ev'), 1); assert.equal(V(g, 'fin'), 1); assert.equal(g.scene.timelines.isPlaying('intro'), false);
});

// ---- addons (M10-27)
test('addon: plugin + behavior + effect register from project.addons; a broken addon is skipped', async () => {
  const mods = {
    'addons/ok/main.js': { register: (nord) => {
      nord.registerPlugin('Dice2', { expressions: { Six: () => 6 }, actions: { 'set-x': { params: ['v'], run: (r, p) => { r.setVar('got', p.v); } } } });
      class Hop extends nord.Behavior { tick() { this.entity.vars.hops = (this.entity.vars.hops ?? 0) + 1; } }
      nord.registerBehavior('Hop', Hop, {});
      nord.registerEffect('warm2', { defaults: { value: 1 }, css: (p) => `sepia(${p.value})` });
    } },
    'addons/bad/addon.js': { register: () => { throw new Error('boom'); } },
  };
  files['addons/ok/addon.json'] = { id: 'ok', main: 'main.js' }; files['addons/bad/addon.json'] = { id: 'bad' };
  files.sheet = { format: 1, events: [{ type: 'variable', name: 'got', valueType: 'number', value: 0 }, ev([sys('on-start-of-layout')], [setv('got', 'Dice2.Six + 1')])] };
  files.s = { name: 's', settings: { eventSheet: 'sheet' }, entities: [E('A', 0, 0, { behaviors: [{ type: 'Hop' }] })] };
  const errs = [];
  const g = new Game({ id: 'x', startScene: 's', addons: ['addons/bad', 'addons/ok'] }, { fetchJSON: async (p) => structuredClone(files[p]), importScript: async (p) => mods[p], storage: new MemoryStorage(), onError: (e) => errs.push(e.message) });
  await g.loadScene('s'); g.tick(1 / 60);
  assert.equal(V(g, 'got'), 7); assert.equal([...g.scene.all()][0].vars.hops, 1);
  assert.deepEqual(errs, ['boom']); assert.deepEqual(g.addons.map((a) => a.id), ['ok']);
  const { EFFECT_TYPES } = await import('./index.js'); assert.equal(EFFECT_TYPES.warm2.value, 1);
});

test('hot reload of an edited event sheet keeps variables and group state', async () => {
  files.sheet = { format: 1, events: [{ type: 'variable', name: 'n', valueType: 'number', value: 0 }, { type: 'group', title: 'G', active: true, children: [ev([sys('every-tick')], [{ object: 'System', id: 'add-to-var', params: { variable: 'n', value: '1' } }])] }] };
  files.s = { name: 's', settings: { eventSheet: 'sheet' }, entities: [] };
  const g = mk(); await g.loadScene('s'); for (let i = 0; i < 5; i++) g.tick(1 / 60);
  assert.equal(V(g, 'n'), 5);
  g.scene.eventSheet.groups.get('G').active = false;
  files.sheet = { format: 1, events: [{ type: 'variable', name: 'n', valueType: 'number', value: 100 }, { type: 'variable', name: 'fresh', valueType: 'number', value: 7 }, { type: 'group', title: 'G', active: true, children: [ev([sys('every-tick')], [{ object: 'System', id: 'add-to-var', params: { variable: 'n', value: '10' } }])] }] };
  assert.equal(g.hotReload(['sheet']), false, 'only *.events.json paths are hot-swapped');
  files['events/x.events.json'] = files.sheet; // the path form the dev server reports
  assert.equal(g.hotReload(['events/x.events.json']), true);
  await new Promise((r) => setTimeout(r, 10));
  assert.equal(V(g, 'n'), 5, 'running value kept, not reset to the new initial value'); assert.equal(V(g, 'fresh'), 7);
  g.tick(1 / 60); assert.equal(V(g, 'n'), 5, 'group stayed disabled');
  g.scene.eventSheet.groups.get('G').active = true; g.tick(1 / 60); assert.equal(V(g, 'n'), 15, 'new logic is live');
});
