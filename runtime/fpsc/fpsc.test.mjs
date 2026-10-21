// Unit tests for the pure FPS Creator modules (no browser): level model, world collision/rays/paths, geometry+baking, bank, rules.
// Run: node --test runtime/fpsc/fpsc.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { newLevel, newLayer, paintRoom, setEdge, setCell, getCell, validate, normalize, CELL, STORY, sideEdge, bounds } from './level.js';
import { World } from './world.js';
import { buildGeometry, bakeBatches, lightAtPoint } from './geometry.js';
import { createBank, resolveScripts, entityVariant } from './bank.js';
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

// The same footprint must define what is drawn, walkable, and opaque in every orientation.
const { CORNERS, cellPolygon, cellCenter, cellContains } = await import('./corners.js');
for (const kind of ['diagonal', 'round']) for (const corner of CORNERS) test(`corner ${kind} ${corner}: cut surfaces, capsule collision, rays and navigation agree`, () => {
  const lv = newLevel({ w: 5, d: 5 }); lv.settings.ground = 'none';
  const c = { f: 'wood_floor', c: 'ceiling_tiles', shape: { kind, corner, t: 'brick' } };
  setCell(lv, 0, 1, 1, c); const w = world(lv), polygon = cellPolygon(c, 1, 1), center = cellCenter(c, 1, 1);
  assert.ok(cellContains(c, ...center)); assert.equal(w.floorAt(...center)?.y, 0);
  const removed = [corner.includes('E') ? 7.8 : 4.2, corner.includes('N') ? 7.8 : 4.2];
  assert.equal(w.floorAt(...removed), null); assert.equal(w.ceilingAt(...removed, 1), Infinity);
  assert.equal(w.ceilingAt(...center, 1), STORY);
  const ray = w.ray(center[0],1,center[1],removed[0]-center[0],0,removed[1]-center[1],8,'bullet');
  assert.ok(ray); assert.ok(Math.abs(Math.hypot(ray.nx,ray.nz)-1) < 1e-6);
  assert.equal(w.los([center[0],1,center[1]],[removed[0],1,removed[1]]), false);
  let [x,z]=center; const dx=(removed[0]-x)/100,dz=(removed[1]-z)/100;
  for(let i=0;i<150;i++) { const m=w.moveCircle(x,z,0,1.8,0.3,dx,dz); x=m.x;z=m.z; }
  assert.ok(cellContains(c,x,z), `capsule crossed boundary at ${x},${z}`);
  assert.equal(w.path({x:center[0],z:center[1],layer:0},{x:removed[0],z:removed[1],layer:0}),null);
  const g=buildGeometry(w,lv,bank), floor=g.batches.get('wood_floor'); let area=0;
  for(let i=0;i<floor.idx.length;i+=3) { const p=floor.idx.slice(i,i+3).map(j=>[floor.pos[j*3],floor.pos[j*3+2]]); area+=Math.abs((p[1][0]-p[0][0])*(p[2][1]-p[0][1])-(p[1][1]-p[0][1])*(p[2][0]-p[0][0]))/2; }
  const expected=kind==='diagonal'?8:8*8*Math.sin(Math.PI/16);
  assert.ok(Math.abs(area-expected)<1e-6, `floor area ${area} expected ${expected}`);
  for(let i=0;i<floor.pos.length;i+=3) assert.ok(cellContains(c,floor.pos[i],floor.pos[i+2],1,1));
  assert.ok(polygon.length === (kind==='round'?10:3));
});

for (const kind of ['diagonal', 'round']) for (const corner of CORNERS) test(`corner ${kind} ${corner}: the cut-away corner is outdoor ground, not a hole`, () => {
  const lv = newLevel({ w: 5, d: 5 }); setCell(lv, 0, 1, 1, { f: 'wood_floor', c: 'ceiling_tiles', shape: { kind, corner, t: 'brick' } });
  const w = world(lv), removed = [corner.includes('E') ? 7.8 : 4.2, corner.includes('N') ? 7.8 : 4.2];
  assert.equal(lv.settings.ground !== 'none', true); assert.equal(w.floorAt(...removed, 0.5)?.y, 0);
});
test('corner navigation uses retained-side centroids; restoring square reveals preserved walls', () => {
  const lv=newLevel({w:5,d:5});lv.settings.ground='none';
  setCell(lv,0,1,1,{f:'wood_floor',shape:{kind:'diagonal',corner:'NE',t:'brick'}});
  for(const [x,z] of [[0,1],[1,0]]) setCell(lv,0,x,z,{f:'wood_floor'});
  const w=world(lv), route=w.path({x:2,z:6,layer:0},{x:6,z:2,layer:0});
  assert.ok(route && route.length>=2);
  for(const p of route) assert.ok(w.floorAt(p.x,p.z));
  for(let i=0;i<route.length;i++) { const a=i?route[i-1]:{x:2,z:6},b=route[i]; assert.ok(!w.ray(a.x,1,a.z,b.x-a.x,0,b.z-a.z,Math.hypot(b.x-a.x,b.z-a.z),'move')); }
  setEdge(lv,0,1,2,'H',{k:'wall',t:'brick'}); const before=JSON.stringify(lv.layers[0].edges);
  assert.equal(world(lv).ray(5,1,9,0,0,-1,0.8),null,'cut-away outer wall not rendered/colliding');
  delete lv.layers[0].cells['1,1'].shape;
  assert.equal(JSON.stringify(lv.layers[0].edges),before);
  assert.ok(world(lv).ray(5,1,9,0,0,-1,2));
});


test('reusable variant captures properties, disabled scripts and rules without placement identity', async () => {
  const def=bank.entity('enemy_soldier'), e={id:'one',type:def.id,x:12,z:16,name:'guard1',target:'door1',path:[[12,16]],props:{health:123},scripts:[{id:'ai-shooter',params:{damage:2},off:true}],rules:[{when:'died',do:'message',text:'Done'}]};
  const preset=entityVariant(def,e,'gentle_guard','Gentle guard'), custom=await createBank({entities:[preset]});
  assert.equal(custom.entity('gentle_guard').props.health.default,123);
  assert.equal(resolveScripts(custom.entity('gentle_guard'),{})[0].off,true);
  assert.equal(resolveScripts(custom.entity('gentle_guard'),{scripts:[{id:'ai-shooter',params:{damage:3}}]})[0].off,true);
  assert.equal(resolveScripts(custom.entity('gentle_guard'),{scripts:[{id:'ai-shooter',off:false}]})[0].off,false);
  assert.equal(preset.rules[0].text,'Done');
  for(const key of ['x','z','path','name','target']) assert.equal(preset[key],undefined);
  preset.rules[0].text='Changed';assert.equal(e.rules[0].text,'Done');
  assert.notEqual(bank.entity('enemy_soldier').props.health.default,123);
});


test('upper cut floors keep holes and lower ceilings; raised corners retain finite skirts', () => {
  const lv=newLevel({w:4,d:4});lv.settings.ground='none';lv.layers.push(newLayer('Upper'));
  setCell(lv,0,1,1,{f:'wood_floor',c:'ceiling_tiles'});setCell(lv,1,1,1,{f:'wood_floor',shape:{kind:'diagonal',corner:'NE',t:'brick'},h:0.4});
  const w=world(lv),g=buildGeometry(w,lv,bank);
  assert.equal(w.floorAt(4.5,4.5).y,STORY+0.4);assert.equal(w.floorAt(7.5,7.5).y,0);
  assert.equal(w.ceilingAt(7.5,7.5,1),STORY);
  const ceil=g.batches.get('ceiling_tiles');assert.ok(ceil&&ceil.idx.length>0,'lower ceiling remains visible under the cut-away portion');
  for(const b of g.batches.values()) { assert.ok(b.pos.every(Number.isFinite));assert.ok(b.nor.every(Number.isFinite));assert.ok(b.uv.every(Number.isFinite)); }
});


test('Outpost Zero example demonstrates both shapes without cutting away any gameplay placements or patrols', async () => {
  const { outpostZero } = await import('../../tools/gen_fpsc_level.mjs');
  const lv=outpostZero(), shaped=Object.values(lv.layers[0].cells).filter(c=>c.shape);
  assert.equal(shaped.filter(c=>c.shape.kind==='diagonal').length,4);assert.equal(shaped.filter(c=>c.shape.kind==='round').length,4);
  for(const e of lv.entities) {
    const cell=lv.layers[e.layer].cells[`${Math.floor(e.x/CELL)},${Math.floor(e.z/CELL)}`];
    assert.ok(cellContains(cell,e.x,e.z),`cut removed ${e.type} ${e.id}`);
    for(const [x,z] of e.path??[]) assert.ok(cellContains(lv.layers[e.layer].cells[`${Math.floor(x/CELL)},${Math.floor(z/CELL)}`],x,z),`cut removed patrol point for ${e.id}`);
  }
  assert.equal(lv.layers[0].edges['8,19,V'].k,'door');assert.equal(lv.entities.find(e=>e.type==='player_start').x,4.5*CELL);
});

test('aim down sights: default pose centres every built-in weapon, view.aim overrides', async () => {
  const { WEAPONS, aimOf } = await import('./weapons.js');
  for (const w of Object.values(WEAPONS).filter((x) => x.type !== 'melee')) {
    const a = aimOf(w); assert.equal(a.pos[0], 0); assert.ok(a.pos[1] < 0 && a.pos[1] > -0.25, `${w.id} aim y ${a.pos[1]}`);
    assert.ok(a.zoom < 1 && a.spread < 1 && a.sens <= 1);
  }
  assert.equal(aimOf(WEAPONS.rifle).zoom, 0.72);
  assert.deepEqual(aimOf({ view: { pos: [0.3, -0.3, 0.6], parts: [], aim: { pos: [0, -0.1, 0.4], zoom: 0.5 } } }), { pos: [0, -0.1, 0.4], zoom: 0.5, spread: 0.35, sens: 0.75 });
});

test('Hotel Meridian: three storeys, black-framed glass door, every stair walkable and every stair shaft sealed', async () => {
  const { hotelMeridian } = await import('../../tools/fpsc-hotel-demo.mjs');
  const lv = hotelMeridian(), w = world(lv);
  assert.deepEqual(validate(lv, bank), []); assert.equal(lv.layers.length, 3);
  const door = lv.layers[1].edges['9,8,H']; assert.equal(door.k, 'door_glass_hotel'); assert.equal(bank.piece('door_glass_hotel').tt, 'black_metal'); assert.ok(bank.texture('black_metal'));
  assert.ok(bank.piece('door_glass_hotel').parts.some((p) => p.mat === 'glass' && p.leaf) && bank.piece('door_glass_hotel').parts.some((p) => p.mat === 'trim'));
  for (const d of w.doors.values()) d.open = 1;
  const P = { x: 38, z: 14, y: 0, vy: 0, layer: 0, onGround: true };
  const step = (tx, tz, dt = 1 / 60) => { // same floor/ceiling rules as Player.update
    const dx = tx - P.x, dz = tz - P.z, d = Math.hypot(dx, dz), sp = Math.min(5, d / dt), m = w.moveCircle(P.x, P.z, P.y, 1.8, 0.35, dx / (d || 1) * sp * dt, dz / (d || 1) * sp * dt);
    P.x = m.x; P.z = m.z; P.vy -= 24 * dt; P.y += P.vy * dt;
    const fl = w.floorAt(P.x, P.z, P.y + 0.55);
    if (fl && P.vy <= 0 && P.y <= fl.y + 0.001) { P.y = fl.y; P.vy = 0; P.onGround = true; P.layer = fl.layer; }
    else if (fl && P.onGround && P.vy <= 0 && P.y - fl.y < 0.55) { P.y = fl.y; P.vy = 0; P.layer = fl.layer; } else P.onGround = false;
    const ce = w.ceilingAt(P.x, P.z, P.y + 0.3); if (P.y + 1.8 > ce) { P.y = ce - 1.8; if (P.vy > 0) P.vy = 0; }
    return d;
  };
  const reach = (tx, tz, max = 400) => { let n = 0; while (step(tx, tz) > 0.25 && n++ < max) if (P.y < -3) return 'fell'; return n >= max ? 'stuck' : 'ok'; };
  const walk = (tx, tz, layer, label) => {
    const route = w.path({ x: P.x, z: P.z, layer: P.layer }, { x: tx * CELL, z: tz * CELL, layer }, { doors: 'open' }); assert.ok(route, `no path: ${label}`);
    for (const wp of route) {
      const snap = { ...P }; let r = reach(wp.x, wp.z);
      for (const via of [(p) => ({ x: wp.x, z: p.z }), (p) => ({ x: p.x, z: wp.z })]) { if (r === 'ok' || r === 'fell') break; Object.assign(P, snap); const v = via(snap); r = reach(v.x, v.z) === 'ok' ? reach(wp.x, wp.z) : 'stuck'; }
      assert.equal(r, 'ok', `${label}: ${r} at ${(P.x / CELL).toFixed(1)},${(P.z / CELL).toFixed(1)} y ${P.y.toFixed(2)}`);
    }
    assert.equal(P.layer, layer, label); assert.ok(Math.abs(P.y - layer * STORY) < 0.05, `${label}: y ${P.y}`);
  };
  walk(9.5, 10, 1, 'porch stairs + glass door'); walk(6.5, 13.5, 2, 'lobby stairs up to the guest floor'); walk(9.5, 11.2, 2, 'guest corridor');
  walk(7.5, 11, 1, 'stairs down to the lobby'); walk(12.5, 13.5, 1, 'restaurant landing'); walk(12.5, 9.5, 0, 'stairs down to the basement');
  walk(6.8, 13, 0, 'boiler room'); for (const d of w.doors.values()) d.locked = null; walk(16.2, 10.8, 0, 'service door to the grass');
  const probe = (label, fx, fz, y, layer, tx, tz, floor) => { Object.assign(P, { x: fx * CELL, z: fz * CELL, y, vy: 0, layer, onGround: true }); const r = reach(tx * CELL, tz * CELL, 600); assert.ok(r !== 'fell' && P.y >= floor, `${label} leaks (y ${P.y})`); };
  probe('down-hole from the south', 12.5, 11.5, 3.2, 1, 12.5, 12.5, 3); probe('down-hole from the west', 11.5, 12.5, 3.2, 1, 12.5, 12.5, 3);
  probe('up-hole from the south', 7.5, 11.5, 6.4, 2, 7.5, 12.5, 6); probe('up-hole from the west', 6.5, 12.5, 6.4, 2, 7.5, 12.5, 6);
  probe('basement stair top from below', 12.5, 13.5, 0, 0, 12.5, 12, -0.01);
  probe('empty cell above the stair top (west)', 6.5, 13.5, 3.2, 1, 7.5, 13.5, 3); probe('empty cell above the stair top (east)', 8.5, 13.5, 3.2, 1, 7.5, 13.5, 3);
});

test('floors and ceilings stop bullets and line of sight (no shooting through storeys), holes stay open', () => {
  const lv = newLevel({ w: 6, d: 6 }); lv.layers.push(newLayer('Upper'));
  for (const L of [0, 1]) for (let x = 1; x <= 3; x++) for (let z = 1; z <= 3; z++) setCell(lv, L, x, z, { f: 'floor_concrete', c: 'ceiling_tiles' });
  setCell(lv, 1, 2, 2, { f: null, c: 'ceiling_tiles' }); setCell(lv, 0, 2, 2, { c: null }); // stairwell-style hole (no ceiling below it)
  const w = world(lv), up = 3.2 + 1.5, low = 1.5;
  assert.equal(w.los([6, up, 5], [6, low, 5]), false);                      // floor between
  assert.ok(w.ray(6, up, 5, 0, -1, 0, 10, 'bullet'));
  assert.equal(w.ray(6, up, 5, 0, -1, 0, 1.0, 'bullet'), null);             // short ray stops before the floor
  assert.equal(w.los([10, up, 10], [10, low, 10]), true);                    // hole in the upper floor: lower storey visible
  assert.equal(w.los([6, low, 5], [6, low, 6]), true);                       // same storey unaffected
  assert.equal(w.los([6, 1.5, 5], [6, 5.0, 5]), false);                      // from below, too
});
