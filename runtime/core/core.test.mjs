import test from 'node:test';
import assert from 'node:assert/strict';
import { Game, NordScript, Input, Save, MemoryStorage, Rng, Scheduler, Pool, ease, resolveAttributes, applyOverrides, angleDiff, registerComponent } from './index.js';

const files = {};
const mk = (extra = {}) => new Game({ id: 'x', startScene: 's', input: { actions: { jump: ['Space', 'Gamepad0'], left: ['KeyA'], right: ['KeyD'] } } }, {
  fetchJSON: async (p) => structuredClone(files[p]), importScript: async (p) => ({ default: files[`mod:${p.split('?')[0]}`] }), storage: new MemoryStorage(), onError: () => {}, ...extra,
});
const ent = (name, o = {}) => ({ id: name.toLowerCase(), name, ...o });

test('lifecycle order: init all → start all → update', async () => {
  const log = [];
  class A extends NordScript { init() { log.push('A.init'); } start() { log.push('A.start'); } update() { log.push('A.update'); } fixedUpdate() { log.push('A.fixed'); } lateUpdate() { log.push('A.late'); } }
  class B extends NordScript { init() { log.push('B.init'); } start() { log.push('B.start'); } }
  files['mod:a.js'] = A; files['mod:b.js'] = B;
  files.s = { name: 's', entities: [ent('A', { scripts: [{ path: 'a.js' }] }), ent('B', { scripts: [{ path: 'b.js' }] })] };
  const g = mk(); await g.loadScene('s');
  assert.deepEqual(log, ['A.init', 'B.init', 'A.start', 'B.start']);
  log.length = 0; g.tick(1 / 60 + 0.001);
  assert.deepEqual(log, ['A.fixed', 'A.update', 'A.late']);
});

test('attributes: defaults, clamp, type fallback, unknown warn', () => {
  class C extends NordScript { static attributes = { speed: { type: 'number', default: 5, min: 0, max: 10 }, mode: { type: 'enum', options: ['a', 'b'], default: 'a' }, on: { type: 'bool', default: true } }; }
  const w = [];
  assert.deepEqual(resolveAttributes(C, { speed: 99, mode: 'zzz', on: 'no', extra: 1 }, (m) => w.push(m)), { speed: 10, mode: 'a', on: true });
  assert.equal(w.length, 2);
  assert.deepEqual(resolveAttributes(C, {}), { speed: 5, mode: 'a', on: true });
});

test('script errors are isolated and reported', async () => {
  const errs = [];
  class Bad extends NordScript { update() { throw new Error('boom'); } }
  class Good extends NordScript { update() { this.hit = (this.hit ?? 0) + 1; } }
  files['mod:bad.js'] = Bad; files['mod:good.js'] = Good;
  files.s = { name: 's', entities: [ent('X', { scripts: [{ path: 'bad.js' }] }), ent('Y', { scripts: [{ path: 'good.js' }] })] };
  const g = mk({ onError: (e) => errs.push(e.message) }); await g.loadScene('s');
  g.tick(0.016);
  assert.deepEqual(errs, ['boom']);
  assert.equal(g.scene.find('Y').scripts[0].hit, 1);
});

test('destroy runs onDestroy, removes from tree; disabled entities skip update', async () => {
  const log = [];
  class D extends NordScript { update() { log.push('u:' + this.entity.name); } onDestroy() { log.push('d:' + this.entity.name); } }
  files['mod:d.js'] = D;
  files.s = { name: 's', entities: [ent('P', { scripts: [{ path: 'd.js' }], children: [ent('C', { scripts: [{ path: 'd.js' }] })] }), ent('Q', { enabled: false, scripts: [{ path: 'd.js' }] })] };
  const g = mk(); const s = await g.loadScene('s');
  g.tick(0.016); assert.deepEqual(log, ['u:P', 'u:C']);
  log.length = 0; s.find('P').destroy(); g.tick(0.016);
  assert.ok(log.includes('d:P') && log.includes('d:C'));
  assert.equal(s.find('P'), null); assert.equal(s.find('C'), null);
});

test('prefab spawn with overrides and fresh ids', async () => {
  files['prefabs/b.prefab.json'] = { format: 1, root: ent('Bullet', { tags: ['b'], transform: { pos: [1, 2, 0] }, scripts: [{ path: 'a2.js', attributes: { speed: 1 } }] }) };
  class Bul extends NordScript { static attributes = { speed: { type: 'number', default: 0 } }; }
  files['mod:a2.js'] = Bul;
  files.s = { name: 's', entities: [] };
  const g = mk(); const s = await g.loadScene('s');
  const a = await s.spawn('prefabs/b.prefab.json', { pos: [9, 9, 0], overrides: { scripts: { 0: { attributes: { speed: 7 } } } } });
  const b = await s.spawn('prefabs/b.prefab.json');
  assert.deepEqual(a.pos, [9, 9, 0]); assert.deepEqual(b.pos, [1, 2, 0]);
  assert.equal(a.scripts[0].attrs.speed, 7); assert.equal(b.scripts[0].attrs.speed, 1);
  assert.notEqual(a.id, b.id); assert.ok(a.hasTag('b'));
  g.tick(0.016); assert.ok(a.scripts[0]._started);
});

test('scene switching destroys old scene', async () => {
  const log = [];
  class D extends NordScript { onDestroy() { log.push('gone'); } }
  files['mod:d.js'] = D; files.s1 = { name: 's1', entities: [ent('A', { scripts: [{ path: 'd.js' }] })] }; files.s2 = { name: 's2', entities: [] };
  const g = mk(); await g.loadScene('s1'); await g.loadScene('s2');
  assert.deepEqual(log, ['gone']); assert.equal(g.scene.name, 's2');
  await g.restart(); assert.equal(g.scene.name, 's2');
});

test('component registry hooks + enabled propagation + worldPos', async () => {
  const calls = [];
  registerComponent('probe', { create: (e, d) => calls.push('create:' + d.v), update: (c, dt) => calls.push('update'), destroy: () => calls.push('destroy') });
  files.s = { name: 's', entities: [ent('P', { transform: { pos: [10, 0, 0], scale: [2, 2, 1] }, components: [{ type: 'probe', v: 3 }], children: [ent('C', { transform: { pos: [5, 1, 0] } })] })] };
  const g = mk(); const s = await g.loadScene('s');
  assert.deepEqual(s.find('C').worldPos, [20, 2, 0]);
  g.tick(0.016); assert.deepEqual(calls, ['create:3', 'update']);
  s.find('P').enabled = false; assert.equal(s.find('C').enabled, false);
});

test('fixed timestep and timeScale', async () => {
  let fixed = 0, total = 0;
  class F extends NordScript { fixedUpdate() { fixed++; } update(dt) { total += dt; } }
  files['mod:f.js'] = F; files.s = { name: 's', entities: [ent('F', { scripts: [{ path: 'f.js' }] })] };
  const g = mk(); await g.loadScene('s');
  g.tick(0.05); assert.equal(fixed, 3); // 0.05 / (1/60) = 3.0
  g.timeScale = 0.5; total = 0; g.tick(0.1); assert.ok(Math.abs(total - 0.05) < 1e-9);
  g.pause(); g.tick(1); assert.ok(Math.abs(total - 0.05) < 1e-9);
});

test('input actions: down/pressed/released/axis/gamepad', () => {
  const i = new Input({ jump: ['Space', 'Gamepad0'], left: ['KeyA'], right: ['KeyD'] });
  i.setKey('Space', true); i.beginFrame();
  assert.ok(i.down('jump') && i.pressed('jump')); i.beginFrame(); assert.ok(i.down('jump') && !i.pressed('jump'));
  i.setKey('Space', false); i.beginFrame(); assert.ok(i.released('jump'));
  i.setKey('KeyD', true); i.beginFrame(); assert.equal(i.axis('left', 'right'), 1);
  i.pollGamepad({ buttons: [{ pressed: true }], axes: [0, 0] }); i.beginFrame(); assert.ok(i.down('jump'));
  i.pollGamepad({ buttons: [], axes: [-0.9, 0] }); i.beginFrame(); assert.deepEqual(i.vec('left', 'right', 'up', 'down'), [-0.9, 0]);
  i.setVirtual('left', true); i.beginFrame(); assert.ok(i.down('left'));
});

test('save: slots, versions, migration', () => {
  const st = new MemoryStorage();
  const s = new Save('g', { storage: st }); s.set('hp', 3); s.slot(2).set('hp', 9);
  assert.equal(s.slot(0).get('hp'), 3); assert.equal(s.slot(2).get('hp'), 9); assert.equal(s.get('nope', 'd'), 'd');
  s.slot(0); const s2 = new Save('g', { storage: st, version: 2, migrate: (d, v) => ({ ...d, hp: d.hp * 10 }) });
  assert.equal(s2.get('hp'), 30);
  st.setItem('nord:g:slot5', '{bad'); assert.equal(s2.slot(5).get('a', 1), 1);
});

test('util: rng determinism, tween/timers, pool, easing, angleDiff', () => {
  const a = new Rng(42), b = new Rng(42); assert.equal(a.next(), b.next()); assert.ok(a.int(1, 3) >= 1);
  const sc = new Scheduler(), o = { x: 0 }, log = [];
  sc.tween(o, { x: 10 }, { duration: 1, ease: 'linear', onComplete: () => log.push('done') });
  const c = sc.every(0.5, () => log.push('tick')); sc.after(0.25, () => log.push('after'));
  for (let i = 0; i < 10; i++) sc.update(0.1);
  assert.ok(Math.abs(o.x - 10) < 1e-9); assert.ok(log.includes('done') && log.includes('after') && log.filter((l) => l === 'tick').length >= 1);
  c(); sc.update(1); assert.equal(sc.size, 0);
  const p = new Pool(() => ({ n: 0 }), (o) => (o.n = 0)); const x = p.get(); x.n = 5; p.release(x); assert.equal(p.get().n, 0);
  assert.equal(ease.quadInOut(0.5), 0.5); assert.equal(ease.bounceOut(1), 1);
  assert.equal(angleDiff(350, 10), 20); assert.equal(angleDiff(10, 350), -20);
});

test('applyOverrides patches arrays by index', () => {
  const t = { name: 'a', scripts: [{ attributes: { s: 1, t: 2 } }] };
  applyOverrides(t, { name: 'b', scripts: { 0: { attributes: { s: 5 } } } });
  assert.deepEqual(t, { name: 'b', scripts: [{ attributes: { s: 5, t: 2 } }] });
});

import { Loader, safePath } from './loader.js';
test('loader: progress, cache, inline files, external rejected', async () => {
  let n = 0;
  const fetchFn = async (u) => { n++; return u.includes('bad') ? { ok: false, status: 404 } : { ok: true, json: async () => ({ u }), arrayBuffer: async () => new ArrayBuffer(1) }; };
  const l = new Loader({ files: { 'assets/in.json': 'data:x' }, fetchFn });
  const prog = [];
  await l.loadAll([{ path: 'a.json', kind: 'json' }, { path: 'assets/in.json', kind: 'json' }], (d, t) => prog.push([d, t]));
  assert.deepEqual(prog, [[1, 2], [2, 2]]);
  assert.equal((await l.json('assets/in.json')).u, 'data:x'); await l.json('a.json'); assert.equal(n, 2);
  await assert.rejects(l.loadAll([{ path: 'bad.png' }]), /404/);
  for (const p of ['https://cdn.x/a.js', '//cdn/a', '/abs', '../up']) assert.throws(() => safePath(p));
});

// ---- audio + ui ----
import { Audio, UI } from './index.js';
const fakeParam = () => ({ value: 1, calls: [], setValueAtTime(v, t) { this.calls.push(['set', v, t]); }, linearRampToValueAtTime(v, t) { this.calls.push(['ramp', v, t]); } });
const fakeCtx = () => {
  const started = [];
  const node = () => ({ gain: fakeParam(), connect() {}, });
  return { started, currentTime: 10, destination: {}, resumed: 0, resume() { this.resumed++; }, createGain: node,
    createBufferSource() { const s = { playbackRate: { value: 1 }, connect() {}, start() { started.push(s); }, stop() { s.stopped = true; } }; return s; },
    decodeAudioData: async (ab) => ({ ab }) };
};
const mkAudio = () => { const g = mk(); const ctx = fakeCtx(); const a = new Audio(g, { ctxFactory: () => ctx, fetchBuffer: async (p) => p }); return { a, ctx }; };

test('audio: locked until unlock; buses volume/mute', async () => {
  const { a, ctx } = mkAudio();
  assert.equal(await a.play('x.wav'), null);
  assert.ok(a.unlock()); assert.equal(ctx.resumed, 1);
  assert.ok(await a.play('x.wav')); assert.equal(ctx.started.length, 1);
  a.volume('sfx', 0.5); assert.equal(a.buses.sfx.gain.value, 0.5);
  a.mute('sfx'); assert.equal(a.buses.sfx.gain.value, 0);
  a.mute('sfx', false); assert.equal(a.buses.sfx.gain.value, 0.5);
});

test('audio: music crossfades and ignores same-track restart', async () => {
  const { a, ctx } = mkAudio(); a.unlock();
  await a.music('a.ogg', { fade: 2 }); await a.music('a.ogg');
  assert.equal(ctx.started.length, 1);
  const first = ctx.started[0];
  await a.music('b.ogg', { fade: 2 });
  assert.equal(ctx.started.length, 2); assert.equal(a.currentMusic, 'b.ogg');
  assert.ok(first.stopped);
  a.stopMusic(); assert.equal(a.currentMusic, null);
});

test('ui: screens, widgets, button errors reported', () => {
  const mkEl = (tag) => ({ tag, style: {}, dataset: {}, children: [], listeners: {}, appendChild(c) { this.children.push(c); }, addEventListener(e, f) { this.listeners[e] = f; }, remove() {} });
  const doc = { head: mkEl('head'), body: mkEl('body'), getElementById: () => null, createElement: mkEl };
  const g = mk(); const errs = []; g.onError = (e) => errs.push(e.message);
  const ui = new UI(g, { doc });
  const shown = []; g.events.on('uiShow', (n) => shown.push(n));
  ui.label('hud', 'hi', { x: 4 }).set('yo'); const bar = ui.bar('hud', 0.5);
  assert.equal(bar.children[0].style.transform, 'scaleX(0.5)'); bar.set(2); assert.equal(bar.children[0].style.transform, 'scaleX(1)');
  assert.equal(ui.screen('hud').el.style.display, 'none'); ui.show('hud'); assert.equal(ui.screen('hud').el.style.display, ''); assert.deepEqual(shown, ['hud']);
  const b = ui.button('hud', 'Go', () => { throw new Error('click'); }); b.listeners.click({});
  assert.deepEqual(errs, ['click']);
});
