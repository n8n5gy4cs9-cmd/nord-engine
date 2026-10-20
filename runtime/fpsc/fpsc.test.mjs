// Unit tests for the pure FPS Creator modules (no browser): level model, world collision/rays/paths, geometry+baking, bank, rules.
// Run: node --test runtime/fpsc/fpsc.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { newLevel, newLayer, paintRoom, setEdge, setCell, getCell, validate, normalize, CELL, STORY, sideEdge, bounds } from './level.js';
import { World } from './world.js';
import { buildGeometry, bakeBatches, lightAtPoint } from './geometry.js';
import { createBank, resolveScripts } from './bank.js';
import { TEXTURES } from './bank/textures.js';
import { PIECES } from './bank/segments.js';
import { ACTIONS, RUN, WHENS } from './actions.js';
import { rayCylinder } from './game.js';

const bank = await createBank({});
const mk = () => {
  const lv = newLevel({ w: 20, d: 20 });
  paintRoom(lv, 0, 1, 1, 3, 3, { tex: 'brick' }); paintRoom(lv, 0, 4, 1, 6, 3, { tex: 'plaster' });
  setEdge(lv, 0, 4, 2, 'V', { k: 'door', t: 'metal_panel', td: 'door_metal', name: 'd1' });
  return lv;
};
const world = (lv) => new World(lv, { piece: bank.piece, cellPiece: bank.cellPiece, stair: bank.stair });

test('level: room paints floors, ceilings and a wall ring', () => {
  const lv = newLevel({ w: 10, d: 10 }); const n = paintRoom(lv, 0, 2, 2, 4, 4, {});
  assert.equal(Object.keys(lv.layers[0].cells).length, 9);
  assert.equal(n, 12);
  assert.ok(lv.layers[0].edges['2,2,H'] && lv.layers[0].edges['5,2,V'] && lv.layers[0].edges['3,5,H']);
  assert.deepEqual(bounds(lv).slice(0, 2), [2, 2]);
});

test('level: setCell merges and deletes empty cells; out of range is ignored', () => {
  const lv = newLevel({ w: 4, d: 4 });
  setCell(lv, 0, 1, 1, { f: 'grass' }); setCell(lv, 0, 1, 1, { c: 'ceiling_tiles' }); assert.deepEqual(getCell(lv, 0, 1, 1), { f: 'grass', c: 'ceiling_tiles' });
  setCell(lv, 0, 1, 1, { f: null, c: null }); assert.equal(getCell(lv, 0, 1, 1), null);
  assert.equal(setCell(lv, 0, 9, 9, { f: 'x' }), null);
  assert.deepEqual(sideEdge(2, 3, 'N'), [2, 4, 'H']); assert.deepEqual(sideEdge(2, 3, 'E'), [3, 3, 'V']);
});

test('level: normalize repairs hand-written files and validate flags problems', () => {
  const lv = normalize({ w: 5, d: 5, entities: [{ type: 'enemy_zombie', x: 1, z: 1 }, { type: 'enemy_zombie', x: 2, z: 2, id: 'a', name: 'z' }, { type: 'enemy_zombie', x: 3, z: 3, id: 'a', name: 'z', target: 'nobody' }, { nonsense: 1 }] });
  assert.equal(lv.entities.length, 3); assert.equal(new Set(lv.entities.map((e) => e.id)).size, 3);
  const v = validate(lv, bank).map((x) => x.msg);
  assert.ok(v.some((m) => /No player start/.test(m)) && v.some((m) => /Duplicate name/.test(m)) && v.some((m) => /targets "nobody"/.test(m)) && v.some((m) => /No level exit/.test(m)));
});

test('world: walls stop a walking circle, doors let it through once open', () => {
  const lv = mk(), w = world(lv);
  let x = 2 * CELL, z = 2 * CELL; // middle of room 1, heading west into the wall at x=4
  for (let i = 0; i < 400; i++) { const m = w.moveCircle(x, z, 0, 1.8, 0.35, -0.1, 0); x = m.x; }
  assert.ok(x > 4 + 0.15 + 0.3 && x < 4 + 0.15 + 0.4, `stopped at the wall, x=${x}`);
  // door between rooms at x = 4*CELL = 16, z cell 2 → z 8..12
  x = 14; z = 10; let reached = 0;
  for (let i = 0; i < 200; i++) { const m = w.moveCircle(x, z, 0, 1.8, 0.35, 0.1, 0); x = m.x; } assert.ok(x < 16, `closed door blocks, x=${x}`);
  const d = [...w.doors.values()][0]; d.open = 1;
  for (let i = 0; i < 200; i++) { const m = w.moveCircle(x, z, 0, 1.8, 0.35, 0.1, 0); x = m.x; reached = x; } assert.ok(reached > 16.5, `open door lets through, x=${reached}`);
});

test('world: rays stop on opaque pieces but pass glass; windows block walking', () => {
  const lv = newLevel({ w: 10, d: 10 }); paintRoom(lv, 0, 1, 1, 3, 3, {}); setEdge(lv, 0, 2, 4, 'H', { k: 'window', t: 'brick' });
  const w = world(lv);
  const open = w.ray(10, 1.0, 10, 0, 0, 1, 20, 'bullet'); // through window glass (y 0.9..2.3): shots pass? window glass opaque:false → bullet = opaque default false
  assert.ok(!open || open.z > 16, 'window glass does not stop a shot at 1.0 m');
  assert.ok(w.ray(10, 0.4, 10, 0, 0, 1, 20, 'bullet'), 'the sill under the window does');
  assert.equal(w.los([10, 1.5, 10], [10, 1.5, 18]), true, 'sight passes the window');
  let z = 14; for (let i = 0; i < 100; i++) z = w.moveCircle(10, z, 0, 1.8, 0.35, 0, 0.05).z; assert.ok(z < 16, `cannot walk through window (z=${z})`);
});

test('world: floors, steps and stairs', () => {
  const lv = newLevel({ w: 10, d: 10 }); paintRoom(lv, 0, 1, 1, 4, 4, { walls: false });
  setCell(lv, 0, 2, 2, { f: 'floor_concrete', h: 0.4 }); setCell(lv, 0, 3, 2, { f: 'floor_concrete', s: { id: 'stairs', d: 'N' } });
  lv.layers.push(newLayer('Upper')); setCell(lv, 1, 3, 3, { f: 'floor_concrete' }); // upper floor above the stairs' exit cell
  const w = world(lv);
  assert.equal(w.floorAt(2.5 * CELL, 2.5 * CELL, 5).y, 0.4);
  const a = w.floorAt(3.5 * CELL, 2.05 * CELL, 5).y, b = w.floorAt(3.5 * CELL, 2.95 * CELL, 5).y;
  assert.ok(a < 0.5 && b > STORY - 0.5, `stairs climb ${a}→${b}`);
  assert.equal(w.floorAt(3.5 * CELL, 3.5 * CELL, 10).y, STORY, 'upper layer floor');
  assert.equal(w.floorAt(3.5 * CELL, 3.5 * CELL, 1).y, 0, 'lower surface when capped');
  const p = w.path({ layer: 0, x: 1.5 * CELL, z: 2.5 * CELL }, { layer: 1, x: 3.5 * CELL, z: 3.5 * CELL });
  assert.ok(p && p[p.length - 1].layer === 1, 'path climbs the stairs');
});

test('world: A* routes around walls and through doors only when asked', () => {
  const lv = mk(), w = world(lv);
  const from = { layer: 0, x: 1.5 * CELL, z: 2.5 * CELL }, to = { layer: 0, x: 5.5 * CELL, z: 2.5 * CELL };
  const open = w.path(from, to, { doors: 'open' }), shut = w.path(from, to, { doors: 'none' });
  assert.ok(open && open.length >= 4); assert.equal(shut, null);
  [...w.doors.values()][0].locked = 'red';
  assert.equal(w.path(from, to, { doors: 'open' }), null, 'enemies cannot open locked doors');
});

test('world: edgeGap sees doorway width, closed door and window', () => {
  const lv = newLevel({ w: 6, d: 6 }); setEdge(lv, 0, 1, 1, 'H', { k: 'doorway', t: 'brick' }); setEdge(lv, 0, 2, 1, 'H', { k: 'wall', t: 'brick' }); setEdge(lv, 0, 3, 1, 'H', { k: 'window', t: 'brick' });
  const w = world(lv);
  const g = w.edgeGap(0, 1, 1, 'H'); assert.ok(g && g[1] - g[0] > 0.5);
  assert.equal(w.edgeGap(0, 2, 1, 'H'), null); assert.equal(w.edgeGap(0, 3, 1, 'H'), null);
  assert.deepEqual(w.edgeGap(0, 4, 1, 'H'), [0, 1]);
});

test('geometry: every texture/piece produces valid indexed meshes, door leaves are separate groups', () => {
  const lv = newLevel({ w: 20, d: 20 }); let x = 0;
  for (const pc of PIECES) { setEdge(lv, 0, x % 18, 2 + Math.floor(x / 18) * 2, 'H', { k: pc.id, t: 'brick', td: 'door_metal' }); x++; }
  paintRoom(lv, 0, 0, 0, 3, 1, { floor: 'grass', ceiling: 'ceiling_tiles' });
  setCell(lv, 0, 2, 0, { f: 'floor_concrete', s: { id: 'ramp', d: 'E' } }); setCell(lv, 0, 3, 0, { f: 'carpet', s: { id: 'stairs_half', d: 'W' } }); setCell(lv, 0, 1, 1, { f: 'marble', h: -0.8, p: 'pillar_big' });
  const w = world(lv), g = buildGeometry(w, lv, bank);
  for (const b of g.batches.values()) { assert.ok(b.idx.every((i) => i < b.verts), `indices in range for ${b.tex}`); assert.equal(b.pos.length, b.nor.length); assert.equal(b.uv.length / 2, b.verts); assert.ok(b.pos.every(Number.isFinite)); }
  const leafy = PIECES.filter((p) => p.door).length; assert.equal(g.doors.length, leafy);
  assert.ok(g.doors.every((d) => d.leaves.length >= 1 && d.leaves.every((l) => l.batches.size > 0)));
  assert.equal(g.doors.find((d) => d.style === 'side').leaves.length, 2);
});

test('geometry: baked light is brighter near a light, dark behind a wall', () => {
  const lv = newLevel({ w: 10, d: 10 }); paintRoom(lv, 0, 1, 1, 2, 2, {}); paintRoom(lv, 0, 3, 1, 4, 2, {});
  const w = world(lv), lights = [{ x: 6, y: 2.5, z: 6, color: [1, 1, 1], intensity: 1.2, range: 14 }];
  const near = lightAtPoint(w, lights, [0.1, 0.1, 0.1], [6, 0, 7], [0, 1, 0]), wall = lightAtPoint(w, lights, [0.1, 0.1, 0.1], [14, 0, 6], [0, 1, 0]);
  assert.ok(near[0] > 0.5, `lit floor ${near}`); assert.ok(wall[0] < 0.11, `shadowed behind the wall ${wall}`);
  const g = buildGeometry(w, lv, bank), rays = bakeBatches(w, [...g.batches.values()], lights, [0.1, 0.1, 0.1]);
  assert.ok(rays > 0 && [...g.batches.values()].every((b) => b.col.length === b.verts * 4));
});

test('bank: every built-in entity resolves its model, scripts and props; ids are unique', () => {
  const ids = new Set();
  for (const e of bank.entities) {
    assert.ok(!ids.has(e.id), `duplicate entity ${e.id}`); ids.add(e.id);
    if (typeof e.model === 'string') assert.ok(bank.model(e.model), `${e.id}: model ${e.model}`);
    for (const s of resolveScripts(e, {})) assert.ok(bank.script(s.id), `${e.id}: script ${s.id}`);
    for (const [k, p] of Object.entries(e.props ?? {})) assert.ok(p.type, `${e.id}.${k} has a type`);
  }
  for (const s of bank.scripts) for (const [k, p] of Object.entries(s.params ?? {})) assert.ok(p.type && 'default' in p, `${s.id}.${k}`);
  assert.equal(new Set(TEXTURES.map((t) => t.id)).size, TEXTURES.length);
  for (const p of PIECES) assert.ok(p.parts.length && p.parts.every((q) => q.u[0] >= 0 && q.u[1] <= 1 && q.u[0] <= q.u[1]), p.id);
});

test('bank: custom entities may extend built-ins; custom textures/pieces register; bad scripts only warn', async () => {
  const b = await createBank({
    entities: [{ id: 'my_zombie', label: 'My zombie', extends: 'enemy_zombie', props: { health: { type: 'number', default: 999 } } }, { id: 'broken', extends: 'nope' }],
    textures: [{ id: 'lava', label: 'Lava', cat: 'floor', url: 'fpsc/lava.png' }], pieces: [{ id: 'slab', label: 'Slab', parts: [{ u: [0, 1], y: [0, 1] }] }], scripts: ['fpsc/missing.js'],
  }, { importer: async () => { throw new Error('nope'); } });
  const z = b.entity('my_zombie'); assert.equal(z.model, 'zombie'); assert.equal(z.props.health.default, 999); assert.deepEqual(z.scripts, bank.entity('enemy_zombie').scripts);
  assert.ok(b.texture('lava').custom && b.piece('slab').custom && b.warns.length === 2);
});

test('scripts: level entries override, add and remove default scripts', () => {
  const def = bank.entity('enemy_guard');
  assert.equal(resolveScripts(def, {}).length, 1);
  const o = resolveScripts(def, { scripts: [{ id: 'ai-shooter', params: { damage: 99 } }, { id: 'light-flicker' }] });
  assert.equal(o[0].params.damage, 99); assert.equal(o[0].params.accuracy, 0.5); assert.equal(o.length, 2);
  assert.equal(resolveScripts(def, { scripts: [{ id: 'ai-shooter', remove: true }] }).length, 0);
});

test('rules: every action id has an implementation and every WHEN a label', () => {
  for (const a of ACTIONS) assert.equal(typeof RUN[a.id], 'function', a.id);
  assert.ok(WHENS.length >= 8);
});

test('math: ray vs vertical cylinder', () => {
  assert.ok(Math.abs(rayCylinder([0, 1, 0], [0, 0, 1], 0, 5, 1, 0, 2, 20) - 4) < 1e-6);
  assert.equal(rayCylinder([0, 5, 0], [0, 0, 1], 0, 5, 1, 0, 2, 20), null, 'passes above');
  assert.ok(Math.abs(rayCylinder([0, 5, 5], [0, -1, 0], 0, 5, 1, 0, 2, 20) - 3) < 1e-6, 'hits the top cap');
});
