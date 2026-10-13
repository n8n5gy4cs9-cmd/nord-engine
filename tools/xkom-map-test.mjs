// Seed sweep: variation, reproducibility, free deployments and reachable objectives/economy.
import assert from 'node:assert/strict';
import { newMission, newSquad, solid } from './examples/xkom/scripts/xk/tactical.js';
import { newRts, blocked, train, step } from './examples/xkom/scripts/xk/rts.js';
const flood = (w, h, x0, y0, block) => {
  const seen = new Set([y0 * w + x0]), queue = [[x0, y0]];
  for (let i = 0; i < queue.length; i++) { const [x, y] = queue[i]; for (const [dx, dy] of [[1,0],[-1,0],[0,1],[0,-1]]) { const nx = x + dx, ny = y + dy, k = ny * w + nx; if (nx >= 0 && ny >= 0 && nx < w && ny < h && !block(nx, ny) && !seen.has(k)) { seen.add(k); queue.push([nx, ny]); } } }
  return seen;
};
const layouts = new Set(), starts = new Set(), structures = new Set(), rtsStarts = { xkom: new Set(), redfront: new Set() };
for (let seed = 1; seed <= 128; seed++) {
  const s = newMission({ seed, squad: newSquad(42), aliens: 20 }); layouts.add(s.layout); starts.add(`${s.units[0].x},${s.units[0].y}`); structures.add(JSON.stringify(s.o));
  assert.equal(s.units.filter(u => u.side === 'a').length, 20);
  for (const a of s.units.filter(u => u.side === 'a')) for (const u of s.units.filter(u => u.side === 'x')) assert.ok(Math.hypot(a.x - u.x, a.y - u.y) >= 15, `initial enemy too close seed ${seed}`);
  assert.equal(s.g.length, 576); assert.equal(s.o.length, 576);
  const connected = flood(s.w, s.h, s.units[0].x, s.units[0].y, (x, y) => solid(s, x, y)), occupied = new Set();
  for (const u of s.units) { assert.ok(!solid(s, u.x, u.y), `tactical blocked spawn seed ${seed}`); assert.ok(connected.has(u.y * s.w + u.x), `tactical unreachable unit seed ${seed}`); const k = `${u.x},${u.y}`; assert.ok(!occupied.has(k)); occupied.add(k); }
  if (seed <= 8) { const again = newMission({ seed, squad: newSquad(42), aliens: 20 }); assert.deepEqual(s.g, again.g); assert.deepEqual(s.o, again.o); assert.deepEqual(s.units.map(u => [u.x,u.y,u.race]), again.units.map(u => [u.x,u.y,u.race])); }
  for (const mode of ['xkom', 'redfront']) {
    const r = newRts({ seed, mode, bonus: 6 });
    assert.equal(r.blds.filter(b => b.team === 'p').length, mode === 'xkom' ? 7 : 6); assert.equal(r.blds.filter(b => b.team === 'e').length, mode === 'xkom' ? 6 : 9);
    assert.equal(r.units.filter(u => u.team === 'p').length, 14); assert.equal(r.units.filter(u => u.team === 'e').length, 6); assert.equal(r.credits.p, 2500);
    const fact = r.blds.find(b => b.team === 'p' && b.type === 'fact'); rtsStarts[mode].add(`${fact.tx},${fact.ty}`);
    const footprints = new Set();
    for (const b of r.blds) for (let y = b.ty; y < b.ty + b.h; y++) for (let x = b.tx; x < b.tx + b.w; x++) {
      assert.ok(x >= 0 && x < r.w && y >= 0 && y < r.h, `building outside map ${mode} seed ${seed}`); const k = y * r.w + x; assert.ok(!footprints.has(k), `overlapping buildings ${mode} seed ${seed}`); footprints.add(k); assert.equal(r.occ[k], b.id);
    }
    for (const u of r.units) assert.ok(!blocked(r, Math.floor(u.x), Math.floor(u.y)), `RTS blocked spawn ${mode} seed ${seed}`);
    const harv = r.units.find(u => u.team === 'p' && u.type === 'harv'), reachable = flood(r.w, r.h, Math.floor(harv.x), Math.floor(harv.y), (x,y) => blocked(r,x,y));
    assert.ok([...reachable].some(k => r.ore[k] > 0), `no reachable player ore ${mode} seed ${seed}`);
    for (const b of r.blds) {
      const exits = []; for (let y = b.ty - 1; y <= b.ty + b.h; y++) for (let x = b.tx - 1; x <= b.tx + b.w; x++) if ((x === b.tx - 1 || x === b.tx + b.w || y === b.ty - 1 || y === b.ty + b.h) && !blocked(r,x,y)) exits.push(y * r.w + x);
      assert.ok(exits.some(k => reachable.has(k)), `unreachable building ${mode} seed ${seed}`);
    }
    if (seed <= 8) { const again = newRts({ seed, mode, bonus: 6 }); assert.deepEqual(r.tiles, again.tiles); assert.deepEqual(r.ore, again.ore); assert.deepEqual(r.blds, again.blds); assert.deepEqual(r.units, again.units); }
    if (seed <= 16) { assert.equal(train(r, 'p', 'rifle'), null); const n = r.units.length; for (let i = 0; i < 45; i++) step(r, 0.1); assert.ok(r.units.length > n, `production works ${mode} seed ${seed}`); }
  }
}
assert.equal(layouts.size, 4); assert.ok(starts.size > 12); assert.ok(structures.size > 64);
for (const mode of ['xkom','redfront']) assert.ok(rtsStarts[mode].size > 20);
console.log('PASS 128 seeds: four tactical structures, varied deployments, reproducible maps, connected units/RTS bases/ore, free nonoverlapping buildings, production');
