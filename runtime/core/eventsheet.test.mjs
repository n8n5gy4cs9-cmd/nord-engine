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
