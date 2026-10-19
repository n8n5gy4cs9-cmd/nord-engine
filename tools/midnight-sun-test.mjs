#!/usr/bin/env node
// Headless test for the Midnight Sun Tour example: loads scripts/game/*.js through the real CommonJS loader with stubbed
// Draw2D/Input/Audio, checks the tycoon rules, then fuzzes the whole game (random key presses) for N frames looking for exceptions.
// usage: node tools/midnight-sun-test.mjs [frames=40000] [seed=1]
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { loadModules } from './examples/midnight-sun-tour/scripts/nordscrap/compat.js';
import { ROOT } from './examples/lib.mjs';

const dir = path.join(ROOT, 'tools/examples/midnight-sun-tour/scripts/game');
const frames = Number(process.argv[2] ?? 40000);
let seed = Number(process.argv[3] ?? 1);
const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 2 ** 32; };
globalThis.fetch = async (url) => { const f = path.join(ROOT, 'tools/examples/midnight-sun-tour', url); return fs.existsSync(f) ? { ok: true, status: 200, text: async () => fs.readFileSync(f, 'utf8') } : { ok: false, status: 404 }; };

const down = new Set(), held = new Set();
const norm = (n) => String(n).toLowerCase();
const noop = () => {};
const store = new Map();
const music = new Set();
const globals = {
  Draw2D: { fillRect: noop, drawRect: noop, drawCircle: noop, drawLine: noop, drawImage: noop, drawText: noop, drawTextAligned: noop, measureText: (t) => String(t).length * 5 },
  Input: { getKey: (n) => held.has(norm(n)), getKeyDown: (n) => down.has(norm(n)), getKeyUp: () => false },
  Audio: { play: noop, playMusic: (p) => music.add(p), stopMusic: noop },
  Scene: { getSceneName: () => 'Title Screen', load: noop }, Screen: { getWidth: () => 640, getHeight: () => 360, getPlatform: () => 'web' },
  Time: { getTime: () => performance.now() / 1000 }, Camera: { getPrimary: () => 1, getClearColor: () => ({ r: 0, g: 0, b: 0, a: 1 }), setClearColor: noop },
  Style: { addEffect: noop, configure: noop }, GameObject: { findByTag: () => 1, destroy: noop },
  Model3D: { createPrimitive: () => 1, setColor: noop, render: noop }, Transform: { setPosition: noop, setRotation: noop, setScale: noop },
  SaveLoad: { save: (k, v) => store.set(k, JSON.stringify(v)), load: (k) => (store.has(k) ? JSON.parse(store.get(k)) : null), exists: (k) => store.has(k), delete: (k) => store.delete(k) },
};
const modules = fs.readdirSync(dir).filter((f) => f.endsWith('.js')).map((f) => f.replace(/\.js$/, ''));
const host = fs.readFileSync(path.join(ROOT, 'tools/examples/midnight-sun-tour/scripts/midnight_sun_tour.js'), 'utf8');
const listed = [...host.match(/const MODULES = \[([^\]]+)\]/)[1].matchAll(/'([^']+)'/g)].map((m) => m[1]);
assert.deepEqual([...listed].sort(), [...modules].sort(), 'MODULES list in midnight_sun_tour.js must match scripts/game/*.js');
const require = await loadModules('scripts/game', modules, globals);
const Tycoon = require('mg_tycoon');
const Game = require('midnight_sun');

// ---- tycoon rules ----
const mk = () => ({ resources: { cash: 1000, food: 5, morale: 70, hype: 20 }, bus: { gas: 50, max_gas: 80, condition: 100 }, band: [{ present: true }, { present: true }, { present: false }], inventory: [{ id: 'merch_box' }], journey: { day: 1 } });
{
  const gs = mk(); Tycoon.ensure(gs);
  assert.equal(Tycoon.stockCapacity(gs), 80);
  gs.inventory = []; assert.equal(Tycoon.stockCapacity(gs), 24);
  Tycoon.open(gs, { id: 'x', name: 'X', services: ['mechanic'], gig_available: true, gig_fee_max: 600 });
  Tycoon.buyUpgrade(Tycoon.UPGRADES[0]); assert.equal(Tycoon.level(gs, 'engine'), 1); assert.equal(gs.resources.cash, 700);
  assert.ok(Math.abs(Tycoon.gasMul(gs) - 0.88) < 1e-9);
  Tycoon.buyUpgrade(Tycoon.UPGRADES[2]); assert.equal(gs.bus.max_gas, 100);
  Tycoon.buyStock(Tycoon.MERCH[0]); assert.equal(gs.tycoon.merch.shirts, 10);
  const before = gs.resources.cash;
  const r = Tycoon.afterGig(gs, { gig_fee_max: 600 }, 0.9, 400);
  assert.ok(r.revenue > 0 && gs.resources.cash === before + r.revenue, 'merch sells after a good gig');
  assert.ok(gs.tycoon.fame > 0 && gs.tycoon.income.gigs === 400);
  gs.resources.cash = 5; Tycoon.onLeg(gs); assert.equal(gs.resources.cash, 0); assert.ok(gs.resources.morale < 70, 'unpaid wages hurt morale');
  gs.tycoon.merch.records = 5; const f = Tycoon.festivalMerch(gs); assert.ok(f.revenue >= 5 * 55);
  assert.equal(Tycoon.ensure({ resources: { cash: 1 } }).fame, 0, 'old saves get tycoon state');
}

// ---- fuzz the full game ----
const game = new Game();
game.onStart();
const keys = ['return', 'return', 'space', 'escape', 'up', 'down', 'left', 'right', 'w', 'a', 's', 'd', 'tab', 'r', 'q', 'e', 'x', 'z', '1', '2', '3', '4', '5', '6', 'o'];
const seen = new Set();
const log = console.log; console.log = noop;
try {
  for (let i = 0; i < frames; i++) {
    down.clear();
    if (rnd() < 0.35) { const k = keys[Math.floor(rnd() * keys.length)]; down.add(k); held.add(k); }
    if (rnd() < 0.2) held.clear();
    game.onUpdate(1 / 30);
    if (i % 500 === 0) seen.add(globalThis.__scene);
  }
} catch (e) { console.log = log; console.error(`FUZZ FAILED:`, e); process.exit(1); }
console.log = log;
console.log(`ok: tycoon rules + ${frames} fuzzed frames, ${modules.length} modules, ${music.size} distinct music tracks reached: ${[...music].map((m) => m.split('/').pop().replace('.mp3', '')).join(' ')}`);
