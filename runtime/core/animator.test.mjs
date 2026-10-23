import test from 'node:test';
import assert from 'node:assert/strict';
import { AnimatorController, validateController } from './animator.js';

const def = () => ({
  parameters: [{ name: 'speed', type: 'float' }, { name: 'grounded', type: 'bool', default: true }, { name: 'jump', type: 'trigger' }, { name: 'hp', type: 'int', default: 3 }],
  states: [{ name: 'Idle', anim: 'idle' }, { name: 'Run', anim: 'run', speed: 2 }, { name: 'Jump', anim: 'jump', length: 1 }, { name: 'Dead', anim: 'dead' }],
  default: 'Idle',
  transitions: [
    { from: 'Idle', to: 'Run', conditions: [{ param: 'speed', mode: 'greater', value: 0.1 }] },
    { from: 'Run', to: 'Idle', conditions: [{ param: 'speed', mode: 'less', value: 0.1 }] },
    { from: '*', to: 'Jump', conditions: [{ param: 'jump', mode: 'if' }, { param: 'grounded', mode: 'if' }] },
    { from: 'Jump', to: 'Idle', hasExitTime: true, exitTime: 1 },
    { from: '*', to: 'Dead', conditions: [{ param: 'hp', mode: 'equals', value: 0 }] },
  ],
});

test('starts in default state and reports it', () => {
  const seen = []; const c = new AnimatorController(def(), (n, a, s) => seen.push([n, a, s.speed]));
  assert.equal(c.state, 'Idle'); assert.deepEqual(seen[0].slice(0, 2), ['Idle', 'idle']);
});

test('float conditions switch states', () => {
  const c = new AnimatorController(def());
  assert.equal(c.update(0.016), null);
  c.set('speed', 1); assert.equal(c.update(0.016), 'Run'); assert.equal(c.speed, 2);
  c.set('speed', 0); assert.equal(c.update(0.016), 'Idle');
});

test('trigger is consumed by the transition that fires; Any State has priority', () => {
  const c = new AnimatorController(def());
  c.set('speed', 1); c.update(0.016);
  c.setTrigger('jump'); assert.equal(c.update(0.016), 'Jump'); assert.equal(c.get('jump'), false);
  assert.equal(c.update(0.016), null);
});

test('trigger stays set while its other conditions fail', () => {
  const c = new AnimatorController(def()); c.set('grounded', false); c.setTrigger('jump');
  assert.equal(c.update(0.016), null); assert.equal(c.get('jump'), true);
  c.set('grounded', true); assert.equal(c.update(0.016), 'Jump');
});

test('exit time: fires after one clip length, not before', () => {
  const c = new AnimatorController(def()); c.play('Jump');
  assert.equal(c.update(0.5), null); assert.equal(c.normalized(), 0.5);
  assert.equal(c.update(0.6), 'Idle');
});

test('Any State does not retrigger the state it is already in; int equals', () => {
  const c = new AnimatorController(def()); c.set('hp', 0);
  assert.equal(c.update(0.016), 'Dead'); assert.equal(c.update(0.016), null);
});

test('validation catches wrong modes, unknown names, dead transitions', () => {
  const d = def(); d.transitions.push({ from: 'Idle', to: 'Nope', conditions: [] }, { from: 'Idle', to: 'Run', conditions: [{ param: 'grounded', mode: 'greater', value: 1 }] }, { from: 'Idle', to: 'Run', conditions: [{ param: 'ghost', mode: 'if' }] });
  const bad = validateController(d).join('|');
  assert.match(bad, /unknown to-state/); assert.match(bad, /can never fire/); assert.match(bad, /does not work on bool/); assert.match(bad, /unknown parameter 'ghost'/);
  assert.deepEqual(validateController(def()), []);
});

test('animator component drives the animatedSprite of its entity', async () => {
  const { Game, registerComponent, MemoryStorage } = await import('./index.js');
  const { registerCoreComponents } = await import('./components.js');
  const files = { 'anim/p.animator.json': def(), s: { name: 's', entities: [{ id: 'p', name: 'P', components: [{ type: 'animatedSprite' }, { type: 'animator', controller: 'anim/p.animator.json', params: { speed: 1 } }] }] } };
  const g = new Game({ id: 'x', startScene: 's' }, { fetchJSON: async (p) => structuredClone(files[p]), importScript: async () => ({}), storage: new MemoryStorage(), onError: (e) => { throw e; } });
  const calls = [];
  registerComponent('animatedSprite', { create() {}, set(comp, k, v) { calls.push([k, v]); } });
  registerCoreComponents(g);
  await g.loadScene('s');
  await new Promise((r) => setTimeout(r, 20));
  const p = g.scene.find('P'), a = p.getComponent('animator');
  assert.equal(a.state, 'Idle');
  g.tick(1 / 60 + 0.001);
  assert.equal(a.state, 'Run'); assert.ok(calls.some(([k, v]) => k === 'anim' && v === 'run'));
  a.setTrigger('jump'); g.tick(1 / 60 + 0.001); assert.equal(a.state, 'Jump');
});

test('animator component drives a 3D model (animation name, loop, speed)', async () => {
  const { Game, registerComponent, MemoryStorage } = await import('./index.js');
  const d = def(); d.states[1].loop = false;
  const files = { 'anim/p.animator.json': d, s: { name: 's', entities: [{ id: 'p', name: 'P', components: [{ type: 'model' }, { type: 'animator', controller: 'anim/p.animator.json', params: { speed: 1 } }] }] } };
  const g = new Game({ id: 'x', startScene: 's' }, { fetchJSON: async (p) => structuredClone(files[p]), importScript: async () => ({}), storage: new MemoryStorage(), onError: (e) => { throw e; } });
  const calls = [];
  registerComponent('model', { create(e, dd, comp) { setTimeout(() => { comp.play = (n, o) => calls.push([n, o]); }, 5); } }); // loads late, like a real glTF
  (await import('./components.js')).registerCoreComponents(g); // components close over their game: register for this one
  await g.loadScene('s'); await new Promise((r) => setTimeout(r, 30));
  g.tick(1 / 60 + 0.001);
  assert.deepEqual(calls[0], ['idle', { loop: true, speed: 1 }]); // pending state is applied once the model is ready
  assert.deepEqual(calls.at(-1), ['run', { loop: false, speed: 2 }]);
});
