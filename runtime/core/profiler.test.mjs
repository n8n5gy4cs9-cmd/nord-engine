import test from 'node:test';
import assert from 'node:assert/strict';
import { Game, NordScript, MemoryStorage, registerComponent } from './index.js';

const busy = (ms) => { const t = performance.now(); while (performance.now() - t < ms); };
const mk = async () => {
  class Slow extends NordScript { update() { busy(6); } }
  class Fast extends NordScript { update() {} }
  registerComponent('wobble', { create() {}, update() { busy(2); } });
  const files = { s: { name: 's', entities: [{ id: 'a', name: 'A', scripts: [{ path: 'slow.js' }, { path: 'fast.js' }], components: [{ type: 'wobble' }] }] } };
  const mods = { 'slow.js': Slow, 'fast.js': Fast };
  const g = new Game({ id: 'x', startScene: 's' }, { fetchJSON: async (p) => structuredClone(files[p]), importScript: async (p) => ({ default: mods[p.split('?')[0]] }), storage: new MemoryStorage(), onError: (e) => { throw e; } });
  await g.loadScene('s'); return g;
};

test('off by default: no debugger, no cost objects', async () => {
  const g = await mk(); g.tick(0.02); assert.equal(g.debug, undefined);
});

test('per-phase, per-script and per-component time; the spike names the culprit', async () => {
  const g = await mk(); const d = g.enableDebug(); d.slowMs = 5;
  for (let i = 0; i < 5; i++) g.tick(1 / 60);
  const s = d.stats();
  assert.ok(s.phases.scripts >= 5, `scripts phase ${s.phases.scripts}`); assert.ok(s.phases.components >= 1.5);
  assert.equal(s.scripts[0].name, 'Slow.update'); assert.ok(s.scripts[0].ms >= 25 && s.scripts[0].calls === 5);
  assert.equal(s.components[0].name, 'wobble');
  assert.ok(s.spikes.length >= 1 && s.spikes.at(-1).top.name === 'Slow.update');
});

test('recorder + export; reset clears the new stats', async () => {
  const g = await mk(); const d = g.enableDebug();
  d.record(true); for (let i = 0; i < 4; i++) g.tick(1 / 60);
  const p = d.exportProfile();
  assert.equal(p.format, 'nord-profile-1'); assert.equal(p.frames.length, 4); assert.ok(p.frames[0].phases.scripts > 0); assert.ok(p.scripts.length >= 2);
  JSON.parse(JSON.stringify(p)); // plain JSON
  d.record(false); d.resetStats(); const s = d.stats(); assert.equal(s.scripts.length, 0); assert.equal(s.spikes.length, 0);
});
