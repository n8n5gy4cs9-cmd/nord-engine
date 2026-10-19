#!/usr/bin/env node
// Headless playtests for the event-sheet starter templates (templates/es-*). Screenshots → target/es-templates/.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import { withPage, waitReady, ROOT } from './e2e-lib.mjs';

const out = `${ROOT}/target/es-templates`;
fs.mkdirSync(out, { recursive: true });
const only = process.argv[2];
const run = async (id, fn) => {
  if (only && only !== id) return;
  const { errors } = await withPage(`${ROOT}/templates/${id}`, async (page) => {
    await waitReady(page);
    assert.equal(await page.evaluate(() => window.__nord_error), undefined, `${id} boots`);
    const ev = (f, ...a) => page.evaluate(f, ...a);
    const wait = (ms) => page.waitForTimeout(ms);
    const click = async (x, y) => { await ev(([x, y]) => { const p = __nord.input.pointer; p.worldX = x; p.worldY = y; p.down = true; }, [x, y]); await wait(90); await ev(() => { __nord.input.pointer.down = false; }); await wait(90); };
    await fn({ page, ev, wait, click, shot: (n) => page.screenshot({ path: `${out}/${id}-${n}.png` }) });
  });
  assert.deepEqual(errors, [], `${id}: ${errors.join('\n')}`);
  console.log(`${id} OK`);
};
const V = (ev, n) => ev((n) => __nord.scene.eventSheet.getVar(n), n);

await run('es-topdown-shooter', async ({ ev, wait, click, shot }) => {
  await wait(300);
  await click(500, 180);
  assert.ok(await ev(() => __nord.scene.find('Bullet') !== null), 'click spawns a bullet');
  await wait(2500); await shot('play');
  assert.ok(await ev(() => [...__nord.scene.all()].filter((e) => e.name === 'Enemy').length >= 2), 'enemies spawn');
  // an enemy on top of a bullet scores
  await click(500, 180);
  await ev(() => { const b = __nord.scene.find('Bullet'), e = __nord.scene.find('Enemy'); e.pos = [b.pos[0], b.pos[1], e.pos[2]]; });
  await wait(250);
  assert.ok((await V(ev, 'score')) >= 1, 'bullet kills enemy');
  const lives = await V(ev, 'lives');
  await ev(() => { const p = __nord.scene.find('Player'), e = __nord.scene.find('Enemy'); e.pos = [p.pos[0], p.pos[1], e.pos[2]]; });
  await wait(250);
  assert.ok((await V(ev, 'lives')) < lives, 'enemy contact costs a life');
  await ev(() => __nord.scene.eventSheet.globals.set('lives', 0)); await wait(300);
  assert.equal(await V(ev, 'over'), 1); await shot('over');
});

await run('es-endless-runner', async ({ ev, wait, shot }) => {
  await wait(2200);
  const o = await ev(() => { const l = [...__nord.scene.all()].filter((e) => e.name === 'Obstacle'); return l.map((e) => e.pos[0]); });
  assert.ok(o.length >= 1 && o.every((x) => x < 700), `obstacles spawn and move (${o})`);
  const y0 = await ev(() => __nord.scene.find('Runner').pos[1]);
  await ev(() => __nord.input.setKey('Space', true)); await wait(150); await ev(() => __nord.input.setKey('Space', false));
  assert.ok((await ev(() => __nord.scene.find('Runner').pos[1])) < y0 - 5, 'jump lifts the runner');
  await wait(1200); await shot('run');
  await ev(() => { const r = __nord.scene.find('Runner'); const ob = __nord.scene.find('Obstacle') ?? null; if (ob) ob.pos = [r.pos[0], r.pos[1], ob.pos[2]]; }); await wait(300);
  assert.equal(await V(ev, 'over'), 1, 'crash ends the run'); await shot('crash');
  await ev(() => __nord.input.setKey('Space', true)); await wait(120); await ev(() => __nord.input.setKey('Space', false)); await wait(400);
  assert.equal(await V(ev, 'over'), 0, 'jump restarts');
});

await run('es-lights-out', async ({ ev, wait, click, shot }) => {
  await wait(400);
  const tiles = () => ev(() => [...__nord.scene.all()].filter((e) => e.name === 'Tile').map((t) => [t.pos[0], t.pos[1], t.vars.on]));
  const t0 = await tiles(); assert.equal(t0.length, 25);
  assert.ok(t0.some((t) => t[2]), 'shuffled'); await shot('start');
  const [x, y] = t0[12];
  await click(x, y);
  const t1 = await tiles();
  const flipped = t1.filter((t, i) => t[2] !== t0[i][2]).map((t) => `${t[0]},${t[1]}`);
  assert.equal(flipped.length, 5, `centre click flips 5 tiles (${flipped})`);
  assert.equal(await V(ev, 'moves'), 1);
  await ev(() => { for (const t of __nord.scene.all()) if (t.name === 'Tile') t.vars.on = 0; }); await wait(300);
  assert.equal(await V(ev, 'won'), 1, 'all off after a move = solved'); await shot('won');
});

await run('es-menu-starter', async ({ page, ev, wait, shot }) => {
  const btn = (t) => page.locator('.nord-button', { hasText: t });
  await shot('menu');
  assert.ok(await btn('Play').isVisible() && await btn('Options').isVisible());
  await btn('Options').click(); await wait(500);
  await btn('Suomi').click(); await wait(200); await shot('options');
  assert.ok(await btn('Takaisin').isVisible(), 'language switch re-translates buttons');
  await btn('Takaisin').click(); await wait(500);
  assert.ok(await btn('Pelaa').isVisible(), 'menu is Finnish now');
  await btn('Pelaa').click(); await wait(500);
  assert.equal(await ev(() => __nord._scenePath), 'scenes/game.scene.json');
  await ev(() => __nord.input.setKey('Escape', true)); await wait(100); await ev(() => __nord.input.setKey('Escape', false)); await wait(500);
  assert.equal(await ev(() => __nord._scenePath), 'scenes/menu.scene.json');
});

await run('es-platformer', async ({ ev, wait, shot }) => {
  await wait(900);
  const h = await ev(() => { const h = __nord.scene.find('Hero'); return { y: h.pos[1], floor: h.behavior('Platform').onFloor }; });
  assert.ok(h.floor && Math.abs(h.y - 314) < 1.5, JSON.stringify(h));
  await shot('start');
});
