import test from 'node:test';
import assert from 'node:assert/strict';
import { Audio, UI, MemoryStorage } from './index.js';

const param = () => ({ value: 1, calls: [], setValueAtTime(v, t) { this.calls.push(['set', v, t]); }, linearRampToValueAtTime(v, t) { this.calls.push(['ramp', v, t]); }, cancelScheduledValues() {} });
const node = (extra = {}) => ({ connect() {}, gain: param(), ...extra });
function fakeCtx() {
  const c = { state: 'suspended', currentTime: 10, destination: {}, started: [], resumed: 0,
    createGain: () => node(), createStereoPanner: () => node({ pan: { value: 0 } }),
    createBufferSource: () => { const s = node({ playbackRate: { value: 1 }, start() { c.started.push(s); }, stop() { s.stopped = true; } }); return s; },
    decodeAudioData: async (b) => ({ dur: b.byteLength }),
    resume: async () => { c.state = 'running'; c.resumed++; } };
  return c;
}
const loader = { binary: async () => new ArrayBuffer(8) };

test('audio: calls before unlock are queued, then replayed', async () => {
  const ctx = fakeCtx();
  const a = new Audio(loader, { ctxFactory: () => ctx });
  a.play('s.wav'); await a.music('m.mp3');
  assert.equal(ctx.started.length, 0);
  await a.unlock();
  await new Promise((r) => setTimeout(r, 5));
  assert.equal(ctx.resumed, 1);
  assert.equal(ctx.started.length, 2);
});

test('audio: music crossfade fades old out, same path is no-op, volume/mute/persist', async () => {
  const ctx = fakeCtx(); const st = new MemoryStorage();
  const a = new Audio(loader, { ctxFactory: () => ctx, storage: st, saveKey: 'au' });
  await a.unlock();
  await a.music('a.mp3', { fade: 2 });
  const first = ctx.started[0];
  await a.music('a.mp3');
  assert.equal(ctx.started.length, 1);
  await a.music('b.mp3', { fade: 2 });
  assert.equal(ctx.started.length, 2);
  assert.ok(first.stopped);
  assert.equal(a.musicPath, 'b.mp3');
  a.volume('music', 0.3); a.mute('sfx');
  assert.equal(a.buses.music.gain.value, 0.3);
  assert.equal(a.buses.sfx.gain.value, 0);
  const b = new Audio(loader, { ctxFactory: () => fakeCtx(), storage: st, saveKey: 'au' });
  assert.equal(b.volume('music'), 0.3); assert.equal(b.isMuted('sfx'), true);
});

test('audio: no AudioContext → no throw', async () => {
  const a = new Audio(loader, { ctxFactory: () => { throw new Error('nope'); } });
  assert.doesNotThrow(() => a.play('x.wav'));
  await a.unlock();
});

// minimal DOM
class El {
  constructor(tag) { this.tag = tag; this.children = []; this.style = { setProperty(k, v) { this[k] = v; } }; this.dataset = {}; this.listeners = {};
    const set = new Set(); this.classList = { add: (c) => set.add(c), remove: (c) => set.delete(c), toggle: (c) => (set.has(c) ? set.delete(c) : set.add(c)), contains: (c) => set.has(c) }; }
  appendChild(c) { this.children.push(c); c.parent = this; return c; }
  remove() { if (this.parent) this.parent.children = this.parent.children.filter((c) => c !== this); }
  addEventListener(n, f) { this.listeners[n] = f; }
  set className(v) { v.split(' ').forEach((c) => this.classList.add(c)); }
}
const doc = { createElement: (t) => new El(t) };

test('ui: screens, button click + sound hook, bar, label', () => {
  const sounds = []; const root = new El('div');
  const ui = new UI(root, { doc, onSound: (s) => sounds.push(s) });
  assert.ok(ui.isShown('hud'));
  let clicked = 0;
  const b = ui.button('Play', () => clicked++, { screen: 'menu', x: 10, y: 20 });
  assert.equal(b.el.style.left, '10px');
  assert.ok(!ui.isShown('menu')); ui.show('menu'); assert.ok(ui.isShown('menu'));
  b.el.listeners.click({}); assert.equal(clicked, 1); assert.deepEqual(sounds, ['click']);
  const bar = ui.bar(0.5); assert.equal(bar.el.children[0].style.transform, 'scaleX(0.5)');
  bar.set(5); assert.equal(bar.el.children[0].style.transform, 'scaleX(1)');
  const l = ui.label('hi'); l.set(42); assert.equal(l.el.textContent, '42');
  ui.clear('hud'); assert.equal(ui.screen('hud').children.length, 0);
});
