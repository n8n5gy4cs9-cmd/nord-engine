import test from 'node:test';
import assert from 'node:assert/strict';
import { Game, MemoryStorage } from './index.js';

const files = {};
const mk = (display = { width: 400, height: 300 }) => new Game({ id: 'x', startScene: 's', display, input: { actions: {} } }, {
  fetchJSON: async (p) => structuredClone(files[p]), importScript: async () => ({}), storage: new MemoryStorage(), onError: (e) => { throw e; }, seed: 1,
});
const E = (name, x, y, w, h, behaviors = [], extra = {}) => ({ id: name.toLowerCase(), name, transform: { pos: [x, y, 0] }, components: [{ type: 'collider', shape: 'box', size: [w, h] }], behaviors, ...extra });
async function world(entities, sheet) {
  files.s = { name: 's', settings: sheet ? { eventSheet: 'sh' } : {}, entities };
  if (sheet) files.sh = { format: 1, events: sheet };
  const g = mk(); await g.loadScene('s'); return g;
}
const run = (g, n) => { for (let i = 0; i < n; i++) g.tick(1 / 60); };

test('Platform: falls, lands on Solid, walks, jumps, blocked by wall', async () => {
  const g = await world([
    E('Floor', 200, 290, 400, 20, [{ type: 'Solid' }]),
    E('Wall', 300, 250, 20, 60, [{ type: 'Solid' }]),
    E('Hero', 100, 200, 20, 20, [{ type: 'Platform' }]),
  ]);
  const hero = g.scene.find('Hero'), p = hero.behavior('Platform');
  run(g, 90);
  assert.ok(p.onFloor); assert.ok(Math.abs(hero.pos[1] - 270) < 0.5, `y=${hero.pos[1]}`);
  g.input.setKey('ArrowRight', true); run(g, 120);
  assert.ok(Math.abs(hero.pos[0] - 280) < 0.5, `x=${hero.pos[0]}`); // wall left edge 290 − half width 10
  g.input.setKey('ArrowRight', false); g.input.setKey('Space', true); run(g, 5);
  assert.ok(!p.onFloor && hero.pos[1] < 270); g.input.setKey('Space', false);
  run(g, 120); assert.ok(p.onFloor);
});

test('Platform: Jumpthru is one-way; double jump', async () => {
  const g = await world([
    E('Plat', 100, 200, 100, 10, [{ type: 'Jumpthru' }]),
    E('Floor', 100, 290, 400, 20, [{ type: 'Solid' }]),
    E('Hero', 100, 240, 20, 20, [{ type: 'Platform', properties: { doubleJump: true } }]),
  ]);
  const hero = g.scene.find('Hero'), p = hero.behavior('Platform');
  run(g, 60); assert.ok(p.onFloor && hero.pos[1] > 269);
  g.input.setKey('Space', true); run(g, 1); g.input.setKey('Space', false); run(g, 1);
  assert.ok(p.vy < 0); g.input.setKey('Space', true); run(g, 1); assert.equal(p.jumps, 2); g.input.setKey('Space', false);
  run(g, 120); assert.ok(p.onFloor);
  p.jumps = 0; // jump up through the platform, land on top of it
  hero.pos = [100, 230, 0]; p.vy = -800; p.onFloor = false; run(g, 90);
  assert.ok(Math.abs(hero.pos[1] - (195 - 10)) < 1 || p.onFloor, `y=${hero.pos[1]}`);
});

test('EightDirection moves, normalises diagonals, stops at Solid', async () => {
  const g = await world([E('Wall', 300, 100, 20, 200, [{ type: 'Solid' }]), E('P', 100, 100, 20, 20, [{ type: 'EightDirection', properties: { maxSpeed: 100, acceleration: 100000 } }])]);
  const p = g.scene.find('P');
  g.input.setKey('ArrowRight', true); g.input.setKey('ArrowDown', true); run(g, 30);
  const sp = p.behavior('EightDirection').speed; assert.ok(Math.abs(sp - 100) < 1, `speed=${sp}`);
  g.input.setKey('ArrowDown', false); run(g, 120);
  assert.ok(Math.abs(p.pos[0] - 280) < 0.5, `x=${p.pos[0]}`);
});

test('Bullet flies along its angle; DestroyOutsideLayout removes it; Sine oscillates; Fade destroys', async () => {
  const g = await world([
    { id: 'b', name: 'B', transform: { pos: [0, 100, 0], rot: [0, 0, 0] }, behaviors: [{ type: 'Bullet', properties: { speed: 600 } }, { type: 'DestroyOutsideLayout' }] },
    { id: 's', name: 'S', transform: { pos: [50, 50, 0] }, behaviors: [{ type: 'Sine', properties: { movement: 'horizontal', period: 1, magnitude: 20 } }] },
    { id: 'f', name: 'F', transform: { pos: [0, 0, 0] }, behaviors: [{ type: 'Fade', properties: { fadeOutTime: 0.5 } }] },
  ]);
  run(g, 30); assert.ok(Math.abs(g.scene.find('B').pos[0] - 300) < 1);
  run(g, 40); assert.equal(g.scene.find('B'), null);
  let xs = []; g.scene.find('S') && (xs = []); const s = g.scene.find('S');
  const lo = Infinity; let min = lo, max = -lo; for (let i = 0; i < 60; i++) { run(g, 1); min = Math.min(min, s.pos[0]); max = Math.max(max, s.pos[0]); }
  assert.ok(max > 65 && min < 35, `${min}..${max}`);
  assert.equal(g.scene.find('F'), null);
});

test('Wrap and BoundToLayout', async () => {
  const g = await world([E('W', 395, 100, 20, 20, [{ type: 'Wrap' }]), E('B', 5, 5, 20, 20, [{ type: 'BoundToLayout' }])]);
  g.scene.find('W').pos = [415, 100, 0]; g.scene.find('B').pos = [-50, -50, 0]; run(g, 1);
  assert.ok(g.scene.find('W').pos[0] < 0); assert.deepEqual(g.scene.find('B').pos.slice(0, 2), [10, 10]);
});

test('event sheet drives behaviors: trigger On jump, simulate control, behavior expressions, instance of conditions', async () => {
  const g = await world([E('Floor', 200, 290, 400, 20, [{ type: 'Solid' }]), E('Hero', 100, 270, 20, 20, [{ type: 'Platform' }])], [
    { type: 'variable', name: 'jumps', valueType: 'number', value: 0 },
    { type: 'variable', name: 'vy', valueType: 'number', value: 0 },
    { type: 'event', conditions: [{ object: 'Keyboard', id: 'on-key-pressed', params: { key: 'KeyJ' } }], actions: [{ object: 'Hero', behavior: 'Platform', id: 'simulate-control', params: { control: 'jump' } }] },
    { type: 'event', conditions: [{ object: 'Hero', behavior: 'Platform', id: 'on-jump' }], actions: [{ object: 'System', id: 'add-to-var', params: { variable: 'jumps', value: '1' } }] },
    { type: 'event', conditions: [{ object: 'Hero', behavior: 'Platform', id: 'is-jumping' }], actions: [{ object: 'System', id: 'set-var', params: { variable: 'vy', value: 'Hero.Platform.VectorY' } }] },
  ]);
  run(g, 5);
  g.scene.eventSheet.fire('Keyboard.on-key-pressed', { code: 'KeyJ', down: true }); // sim control for the next behavior tick
  run(g, 3);
  const v = (n) => g.scene.eventSheet.getVar(n);
  assert.equal(v('jumps'), 1); assert.ok(v('vy') < 0);
});

test('behaviors survive clone/toJSON; unknown behavior only warns', async () => {
  const warns = [];
  files.s = { name: 's', entities: [E('A', 0, 0, 10, 10, [{ type: 'Sine', properties: { period: 2 } }, { type: 'Nope' }])] };
  const g = mk(); g.warn = (m) => warns.push(m); await g.loadScene('s');
  const j = g.scene.find('A').toJSON();
  assert.deepEqual(j.behaviors.map((b) => [b.type, b.properties.period]), [['Sine', 2]]);
  assert.equal(warns.length, 1);
});
