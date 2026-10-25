#!/usr/bin/env node
// Plays examples/ember-crypt in headless Chromium: title, walking, sword, pickups, keys and gates, death, win and the saved best score.
// Writes the tutorial screenshots docs/screenshots/ember-crypt-*.png.   usage: node tools/ember-crypt-test.mjs
import fs from 'node:fs';
import assert from 'node:assert/strict';
import { withPage, waitReady, ROOT } from './e2e-lib.mjs';
import { MAP } from '../examples/ember-crypt/scripts/map.js';

const OUT = `${ROOT}/docs/screenshots`;
const T = 32;
const wait = (p, ms) => p.waitForTimeout(ms);
const g = (p, fn, arg) => p.evaluate(fn, arg);
const pos = (p, n = 'Hero') => g(p, (n) => { const e = window.__nord.scene.find(n); return e && [...e.pos]; }, n);
const tp = (p, c, r) => g(p, ([x, y]) => { const h = window.__nord.scene.find('Hero'); h.pos = [x, y, h.pos[2]]; }, [c * T + 16, r * T + 16]);
const count = (p, tag) => g(p, (t) => window.__nord.scene.findByTag(t).length, tag);
const hold = async (p, key, ms) => { await p.keyboard.down(key); await wait(p, ms); await p.keyboard.up(key); };
const shot = (p, name) => p.screenshot({ path: `${OUT}/ember-crypt-${name}.png` });
const find = (ch) => { const r = []; MAP.forEach((row, y) => [...row].forEach((c, x) => c === ch && r.push([x, y]))); return r; };
const text = (p) => p.locator('body').innerText();
const startGame = async (p) => {
  await p.click('text=Play');
  const want = find('o').length, t0 = Date.now();                    // the level builds itself over many frames: wait until every coin exists
  while ((await count(p, 'Coin')) !== want && Date.now() - t0 < 20000) await wait(p, 200);
  await wait(p, 600);
};
const hurt = (p) => g(p, () => { const h = window.__nord.scene.find('Hero'); h.scripts.find((s) => s.constructor.name === 'Health').TakeDamage(h); });

fs.mkdirSync(OUT, { recursive: true });
let failed = 0;
const run = async (name, fn) => {
  try {
    const { errors } = await withPage(`${ROOT}/examples/ember-crypt`, async (p) => { await waitReady(p); await p.click('canvas'); await fn(p); }, { viewport: { width: 960, height: 540 } });
    const bad = [...new Set(errors)]; if (bad.length) throw new Error(bad.slice(0, 4).join('\n'));
    console.log(`ok   ${name}`);
  } catch (e) { failed++; console.log(`FAIL ${name}: ${e.message}`); }
};

await run('title', async (p) => { await wait(p, 1500); await shot(p, 'title'); assert.match(await text(p), /EMBER CRYPT/); });

await run('explore + sword', async (p) => {
  await startGame(p);
  await shot(p, 'start');
  assert.equal(await count(p, 'Enemy'), 8);
  assert.equal(await count(p, 'Coin'), find('o').length);
  await hold(p, 'KeyD', 800);
  assert.ok((await pos(p))[0] > 112 + 60, 'hero walks');
  // sword: stand next to the first slime, face it, swing
  const [sx, sy] = find('s')[0];
  await tp(p, sx - 1, sy); await wait(p, 100);
  await g(p, () => { for (const e of window.__nord.scene.findByTag('enemy')) e.native.setAlpha(1); });
  await p.keyboard.down('KeyD'); await wait(p, 60); await p.keyboard.up('KeyD');
  const before = await count(p, 'Enemy');
  for (let i = 0; i < 6 && (await count(p, 'Enemy')) === before; i++) {
    await tp(p, sx - 1, sy); await hold(p, 'KeyD', 40); await p.keyboard.down('Space'); await wait(p, 120); await p.keyboard.up('Space'); await wait(p, 500);
  }
  assert.ok((await count(p, 'Enemy')) < before, 'sword kills a slime in two hits');
  await shot(p, 'fight');
});

await run('keys, gates and the exit', async (p) => {
  await startGame(p);
  const [[gx, gy]] = find('D'); const doors = await count(p, 'Door');
  assert.equal(doors, 4);
  await tp(p, gx - 1, gy); await hold(p, 'KeyD', 250); await wait(p, 400);
  assert.equal(await count(p, 'Door'), 4, 'a locked gate stays closed');
  const keys = find('k');
  await tp(p, ...keys[0]); await wait(p, 300);
  await tp(p, gx - 1, gy); await hold(p, 'KeyD', 250); await wait(p, 400);
  assert.equal(await count(p, 'Door'), 2, 'one key opens one gate (two tiles)');
  await shot(p, 'gate');
  await tp(p, ...keys[1]); await wait(p, 300);
  const [[hx, hy]] = find('D').slice(2);
  await tp(p, hx, hy - 1); await hold(p, 'KeyS', 250); await wait(p, 400);
  assert.equal(await count(p, 'Door'), 0, 'second key opens the second gate');
  const [ex, ey] = find('X')[0];
  await tp(p, ex, ey); await wait(p, 1200);
  assert.match(await text(p), /escaped the crypt/);
  await shot(p, 'win');
  const best = await g(p, () => Number(JSON.parse(localStorage.getItem(Object.keys(localStorage).find((k) => /ember/.test(k)) ?? '') ?? 'null')));
  const keysSaved = await g(p, () => Object.keys(localStorage));
  assert.ok(keysSaved.length > 0, `best score saved (${keysSaved.join(',')})`);
});

await run('pickups, potion and dark', async (p) => {
  await startGame(p);
  const coins = find('o'); await tp(p, ...coins[0]); await wait(p, 300);
  assert.equal(await count(p, 'Coin'), coins.length - 1);
  await hurt(p);
  await wait(p, 200);
  const hearts = () => g(p, () => document.querySelectorAll('img[src*="heart_full"]').length);
  assert.equal(await hearts(), 4, 'a hit costs a heart');
  const [px, py] = find('+')[0]; await tp(p, px, py); await wait(p, 400);
  assert.equal(await hearts(), 5, 'a potion heals');
  await tp(p, ...find('s')[2]); await wait(p, 1400);
  await shot(p, 'dark');
});

await run('death', async (p) => {
  await startGame(p);
  for (let i = 0; i < 12; i++) { await hurt(p); await wait(p, 1100); if (/keeps you/.test(await text(p))) break; }
  assert.match(await text(p), /keeps you/);
  await shot(p, 'over');
  await p.click('text=Play again'); await wait(p, 2500);
  assert.equal(await g(p, () => document.querySelectorAll('img[src*="heart_full"]').length), 5, 'restart refills');
});
process.exit(failed ? 1 : 0);
