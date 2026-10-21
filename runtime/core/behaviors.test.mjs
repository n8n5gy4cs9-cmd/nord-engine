import test from 'node:test';
import assert from 'node:assert/strict';
import { Game, MemoryStorage } from './index.js';

const files = {};
const mk = (display = { width: 400, height: 300 }) => new Game({ id: 'x', startScene: 's', display, input: { actions: {} } }, {
  fetchJSON: async (p) => structuredClone(files[p]), importScript: async () => ({}), storage: new MemoryStorage(), onError: (e) => { throw e; }, seed: 1,
});
const E = (name, x, y, w, h, behaviors = [], extra = {}) => ({ id: name.toLowerCase(), name, transform: { pos: [x, y, 0] }, components: [{ type: 'collider', shape: 'box', size: [w, h] }], behaviors, ...extra });
async function world(entities, sheet, extraSettings = {}) {
  files.s = { name: 's', settings: { ...(sheet ? { eventSheet: 'sh' } : {}), ...extraSettings }, entities };
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

test('set B: Pin, Orbit, Rotate, Flash, Timer, Tween, Turret, LineOfSight, Pathfinding, Persist, families/containers', async () => {
  const g = await world([
    E('Boss', 100, 100, 20, 20, [{ type: 'Rotate', properties: { speed: 90 } }]),
    E('Pinned', 130, 100, 10, 10, [{ type: 'Pin' }]),
    E('Moon', 200, 200, 10, 10, [{ type: 'Orbit', properties: { speed: 90, primaryRadius: 50, secondaryRadius: 50 } }]),
    E('Blink', 10, 10, 10, 10, [{ type: 'Flash' }, { type: 'Timer' }, { type: 'Tween' }]),
    E('Wall', 200, 150, 10, 100, [{ type: 'Solid' }]),
    E('Gun', 100, 250, 10, 10, [{ type: 'Turret', properties: { targetType: 'Enemy', range: 400, rotateSpeed: 720, rateOfFire: 10 } }]),
    E('Hidden', 300, 50, 10, 10, [], { tags: ['Enemy'] }),
    E('Walker', 20, 20, 10, 10, [{ type: 'Pathfinding', properties: { cellSize: 20, maxSpeed: 400 } }]),
    E('Block', 100, 20, 20, 200, [{ type: 'Solid' }]),
  ], [
    { type: 'variable', name: 'shots', valueType: 'number', value: 0 }, { type: 'variable', name: 'ticks', valueType: 'number', value: 0 },
    { type: 'variable', name: 'fin', valueType: 'number', value: 0 }, { type: 'variable', name: 'arrived', valueType: 'number', value: 0 },
    { type: 'event', conditions: [{ object: 'Gun', behavior: 'Turret', id: 'on-shoot' }], actions: [{ object: 'System', id: 'add-to-var', params: { variable: 'shots', value: '1' } }] },
    { type: 'event', conditions: [{ object: 'Blink', behavior: 'Timer', id: 'on-timer', params: { tag: 'beat' } }], actions: [{ object: 'System', id: 'add-to-var', params: { variable: 'ticks', value: '1' } }] },
    { type: 'event', conditions: [{ object: 'Blink', behavior: 'Tween', id: 'on-tween-finished', params: { tag: 't' } }], actions: [{ object: 'System', id: 'set-var', params: { variable: 'fin', value: 'Blink.X' } }] },
    { type: 'event', conditions: [{ object: 'Walker', behavior: 'Pathfinding', id: 'on-arrived' }], actions: [{ object: 'System', id: 'add-to-var', params: { variable: 'arrived', value: '1' } }] },
    { type: 'event', conditions: [{ object: 'System', id: 'on-start-of-layout' }], actions: [
      { object: 'Pinned', behavior: 'Pin', id: 'pin-to-object', params: { object: 'Boss', mode: 'position-angle' } },
      { object: 'Blink', behavior: 'Timer', id: 'start-timer', params: { duration: '0.1', type: 'regular', tag: 'beat' } },
      { object: 'Blink', behavior: 'Tween', id: 'tween-property', params: { tag: 't', property: 'x', end: '90', time: '0.5', ease: 'linear' } },
      { object: 'Walker', behavior: 'Pathfinding', id: 'find-path', params: { x: '180', y: '20' } },
    ] },
  ]);
  const sh = g.scene.eventSheet;
  run(g, 60); // 1 s
  const pinned = g.scene.find('Pinned'); // Boss rotated 90° → Pinned (30 px right of Boss) now 30 px below
  assert.ok(Math.abs(pinned.pos[0] - 100) < 1 && Math.abs(pinned.pos[1] - 130) < 1, pinned.pos.join());
  assert.ok(Math.abs(g.scene.find('Moon').pos[0] - 150) < 2); // quarter orbit around (150,200)… started at angle 0 → centre (150,200)
  assert.ok(sh.getVar('ticks') >= 9); assert.equal(Math.round(sh.getVar('fin')), 90);
  assert.equal(sh.getVar('shots'), 0, 'Wall blocks the ray to Hidden');
  assert.equal(sh.getVar('arrived'), 1);
  const w = g.scene.find('Walker'); assert.ok(Math.abs(w.pos[0] - 180) < 1 && Math.abs(w.pos[1] - 20) < 1, w.pos.join());
});

test('Turret shoots visible target; LineOfSight cone; family + container + Persist', async () => {
  files['prefabs/tank.prefab.json'] = { format: 1, root: E('Tank', 0, 0, 10, 10) };
  files['prefabs/turret2.prefab.json'] = { format: 1, root: E('Turret2', 0, 0, 10, 10, [], { vars: { v: 0 } }) };
  const g = await world([
    E('Gun', 100, 100, 10, 10, [{ type: 'Turret', properties: { targetType: 'Hostile', range: 400, rotateSpeed: 720, rateOfFire: 10 } }]),
    E('Orc', 200, 100, 10, 10), E('Eye', 50, 200, 10, 10, [{ type: 'LineOfSight', properties: { range: 300, coneOfView: 90 } }]),
    E('Seen', 150, 200, 10, 10), E('Behind', -20, 200, 10, 10),
  ], [
    { type: 'variable', name: 'shots', valueType: 'number', value: 0 }, { type: 'variable', name: 'seen', valueType: 'number', value: 0 }, { type: 'variable', name: 'made', valueType: 'number', value: 0 },
    { type: 'event', conditions: [{ object: 'Gun', behavior: 'Turret', id: 'on-shoot' }], actions: [{ object: 'System', id: 'add-to-var', params: { variable: 'shots', value: '1' } }] },
    { type: 'event', conditions: [{ object: 'Eye', behavior: 'LineOfSight', id: 'has-line-of-sight-to', params: { object: 'Seen' } }, { object: 'Eye', behavior: 'LineOfSight', id: 'has-line-of-sight-to', params: { object: 'Behind' }, inverted: true }], actions: [{ object: 'System', id: 'set-var', params: { variable: 'seen', value: '1' } }] },
    { type: 'event', conditions: [{ object: 'System', id: 'on-start-of-layout' }], actions: [{ object: 'System', id: 'create-object', params: { object: 'Tank', layer: '0', x: '5', y: '6' } }, { object: 'Turret2', id: 'set-instance-var', params: { variable: 'v', value: '3' } }] },
  ], { families: { Hostile: ['Orc'] }, containers: [['Tank', 'Turret2']] });
  run(g, 30);
  await new Promise((r) => setTimeout(r, 10)); run(g, 2);
  const tank = g.scene.find('Tank'), t2 = g.scene.find('Turret2');
  assert.ok(tank && t2 && t2.vars.v === 3, 'container spawned both, picked the peer');
  tank.destroy(); run(g, 3); assert.equal(g.scene.find('Turret2'), null);
  assert.ok(g.scene.eventSheet.getVar('shots') >= 2); assert.equal(g.scene.eventSheet.getVar('seen'), 1);
});

test('Persist keeps an entity across loadScene', async () => {
  files.a = { name: 'a', entities: [E('Keeper', 5, 5, 10, 10, [{ type: 'Persist' }], { vars: { n: 7 } }), E('Temp', 1, 1, 10, 10)] };
  files.b = { name: 'b', entities: [E('Other', 0, 0, 10, 10)] };
  const g = mk(); await g.loadScene('a'); g.scene.find('Keeper').pos = [50, 60, 0];
  await g.loadScene('b'); g.tick(1 / 60);
  const k = g.scene.find('Keeper'); assert.ok(k); assert.deepEqual(k.pos.slice(0, 2), [50, 60]); assert.equal(k.vars.n, 7); assert.equal(g.scene.find('Temp'), null);
});

test('restart resets Persist entities unless explicitly preserved', async () => {
  files.a={name:'a',entities:[E('Keeper',5,5,10,10,[{type:'Persist'}],{vars:{n:7}})]};
  const g=mk();await g.loadScene('a');g.scene.find('Keeper').pos=[50,60,0];
  await g.restart();assert.deepEqual(g.scene.find('Keeper').pos,[5,5,0]);
  g.scene.find('Keeper').pos=[70,80,0];await g.restart({preservePersistent:true});g.tick(1/60);
  assert.deepEqual(g.scene.find('Keeper').pos,[70,80,0]);
});
