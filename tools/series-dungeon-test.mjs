#!/usr/bin/env node
// Checks the six Nord Dungeon tutorial projects (examples/series-dungeon/part1..6) in headless Chromium and writes the tutorial screenshots
// to docs/screenshots/series-dungeon-*.png.   usage: node tools/series-dungeon-test.mjs [1 2 …]
import fs from 'node:fs';
import assert from 'node:assert/strict';
import { withPage, waitReady, ROOT } from './e2e-lib.mjs';

const OUT = `${ROOT}/docs/screenshots`;
const want = process.argv.slice(2).map(Number);
const T = 32;
const wait = (p, ms) => p.waitForTimeout(ms);
const pos = (p, name = 'Hero') => p.evaluate((n) => { const e = window.__nord.scene.find(n); return e && [...e.pos]; }, name);
const tp = (p, x, y) => p.evaluate(([x, y]) => { const h = window.__nord.scene.find('Hero'); h.pos = [x, y, h.pos[2]]; }, [x, y]);
const tile = (c, r) => [c * T + T / 2, r * T + T / 2];
const hold = async (p, key, ms) => { await p.keyboard.down(key); await wait(p, ms); await p.keyboard.up(key); };
const shot = (p, name) => p.screenshot({ path: `${OUT}/series-dungeon-${name}.png` });
const count = (p, tag) => p.evaluate((t) => window.__nord.scene.findByTag(t).length, tag);
const levelTiles = async (part) => (await import(`${ROOT}/examples/series-dungeon/part${part}/scripts/map.js`)).MAP;

const parts = {
  1: async (p) => {
    await shot(p, '1-start');
    const a = await pos(p);
    await hold(p, 'KeyD', 1000);
    const b = await pos(p);
    assert.ok(b[0] - a[0] > 120 && b[0] - a[0] < 200, `moved ${b[0] - a[0]} px in 1 s`);
    await p.keyboard.down('KeyD'); await p.keyboard.down('KeyS'); await wait(p, 600);
    const c = await pos(p); await p.keyboard.up('KeyD'); await p.keyboard.up('KeyS');
    const diag = Math.hypot(c[0] - b[0], c[1] - b[1]) / 0.6;
    assert.ok(diag < 190, `diagonal speed ${diag.toFixed(0)} px/s must not exceed ~160`);
    await hold(p, 'KeyD', 2500);
    assert.ok((await pos(p))[0] <= 628.5, 'hero stays on screen');
    await shot(p, '1-moved');
  },
  2: async (p) => {
    await wait(p, 600);
    await shot(p, '2-walls');
    await hold(p, 'KeyD', 3500);
    const x = (await pos(p))[0];
    assert.ok(x < 9 * T - 12 + 1, `wall stops the hero (x=${x})`);
    assert.ok(x > 9 * T - 40, `hero reached the wall (x=${x})`);
    await shot(p, '2-blocked');
  },
  3: async (p) => {
    await wait(p, 600);
    await shot(p, '3-start');
    await tp(p, ...tile(18, 14)); await wait(p, 1200);
    const cam = await pos(p, 'Camera');
    assert.ok(Math.abs(cam[0] - 18 * T) < 80, `camera followed (cam x=${cam[0]})`);
    await shot(p, '3-follow');
    await tp(p, ...tile(2, 2)); await wait(p, 1500);
    const c2 = await pos(p, 'Camera');
    assert.ok(c2[0] >= 320 - 1 && c2[1] >= 180 - 1, `camera clamped to the level (${c2})`);
    const walls = await count(p, 'solid');
    const M = await levelTiles(3);
    const tileWalls = M.join('').split('').filter((c) => c === '#').length;
    assert.ok(walls < tileWalls / 2, `${walls} merged walls instead of ${tileWalls} tiles`);
    console.log(`  walls: ${walls} entities for ${tileWalls} wall tiles`);
  },
  4: async (p) => {
    await wait(p, 600);
    const M = await levelTiles(4);
    const coins = []; M.forEach((r, y) => [...r].forEach((c, x) => c === 'o' && coins.push([x, y])));
    assert.equal(await count(p, 'coin'), coins.length);
    await shot(p, '4-start');
    await tp(p, ...tile(...coins[0])); await wait(p, 400);
    assert.equal(await count(p, 'coin'), coins.length - 1, 'coin collected');
    await shot(p, '4-coin');
    for (const c of coins.slice(1)) { await tp(p, ...tile(...c)); await wait(p, 120); }
    await wait(p, 400);
    assert.equal(await count(p, 'coin'), 0);
    assert.match(await p.locator('body').innerText(), /found all the coins/);
    await shot(p, '4-win');
    await hold(p, 'KeyE', 150); await wait(p, 1500);
    assert.equal(await count(p, 'coin'), coins.length, 'restart rebuilt the coins');
  },
  5: async (p) => {
    await wait(p, 600);
    const M = await levelTiles(5);
    const en = []; M.forEach((r, y) => [...r].forEach((c, x) => c === 'e' && en.push([x, y])));
    assert.equal(await count(p, 'enemy'), en.length);
    await shot(p, '5-start');
    const hearts = () => p.evaluate(() => [...document.querySelectorAll('.nord-label')].map((e) => e.textContent).find((t) => /♥|♡/.test(t)));
    assert.equal(await hearts(), '♥♥♥');
    await tp(p, ...tile(en[0][0] + 2, en[0][1])); await wait(p, 1500);
    const h1 = await hearts();
    assert.ok(h1 !== '♥♥♥', `the enemy hurt the hero (${h1})`);
    await shot(p, '5-chase');
    const t0 = Date.now();
    while (Date.now() - t0 < 25000 && !/Game over/.test(await p.locator('body').innerText())) { await tp(p, ...tile(en[0][0], en[0][1])); await wait(p, 300); }
    assert.match(await p.locator('body').innerText(), /Game over/);
    await shot(p, '5-over');
    await hold(p, 'KeyE', 150); await wait(p, 1500);
    assert.equal(await hearts(), '♥♥♥', 'restart refills the hearts');
  },
  6: async (p) => {
    await wait(p, 1500);
    await shot(p, '6-dark');
    await tp(p, ...tile(16, 5)); await wait(p, 1500);
    await shot(p, '6-room');
    const lit = await p.evaluate(() => { const h = window.__nord.scene.find('Hero').worldPos; return [window.__nord.light2d.lightAt(h[0], h[1]), window.__nord.light2d.lightAt(h[0] + 400, h[1])]; });
    assert.ok(lit[0] > 0.5 && lit[1] < 0.05, `lantern lights the hero (${lit[0].toFixed(2)}) but not a far point (${lit[1].toFixed(2)})`);
  },
};

fs.mkdirSync(OUT, { recursive: true });
let failed = 0;
for (const n of Object.keys(parts).map(Number).filter((n) => !want.length || want.includes(n))) {
  try {
    const { errors } = await withPage(`${ROOT}/examples/series-dungeon/part${n}`, async (p) => { await waitReady(p); await p.click('canvas'); await parts[n](p); }, { viewport: { width: 960, height: 540 } });
    const bad = [...new Set(errors)];
    if (bad.length) throw new Error(bad.slice(0, 4).join('\n'));
    console.log(`ok   part${n}`);
  } catch (e) { failed++; console.log(`FAIL part${n}: ${e.message}`); }
}
process.exit(failed ? 1 : 0);
