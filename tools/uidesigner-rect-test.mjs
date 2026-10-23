#!/usr/bin/env node
// Headless test: UI Designer on-canvas rect handles + canvas scaler. Dragging a handle resizes the node while the opposite
// edge stays where it is on screen, for every anchor. Uses the real `nord serve`.
import { spawn } from 'node:child_process';
import assert from 'node:assert/strict';
import { loadPlaywright, ROOT } from './e2e-lib.mjs';

const port = 5900 + Math.floor(Math.random() * 90);
const srv = spawn('cargo', ['run', '-q', '-p', 'nord-cli', '--', 'serve', `${ROOT}/examples/event-sheets`, '--port', String(port)], { env: { ...process.env, NORD_ROOT: ROOT }, stdio: 'ignore' });
const base = `http://127.0.0.1:${port}`;
for (let i = 0; i < 120; i++) { try { if ((await fetch(base + '/api/project')).ok) break; } catch { /* starting */ } await new Promise((r) => setTimeout(r, 500)); }
const { chromium } = loadPlaywright();
const browser = await chromium.launch();
try {
  const page = await (await browser.newContext({ viewport: { width: 1500, height: 900 } })).newPage();
  const errors = []; page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(`${base}/editor/uidesigner/index.html`);
  await page.click('.tabs button[data-tab="json"]');
  const load = async (def) => {
    await page.fill('#json', JSON.stringify(def));
    await page.click('#applyJson');
    await page.waitForTimeout(150);
  };
  const rectOf = (name) => page.evaluate((nm) => {
    const host = document.querySelector('[data-nord-ui="preview"]'); const e = [...host.shadowRoot.querySelectorAll('.n')].find((x) => x.__nord?.def.name === nm);
    const r = e.getBoundingClientRect(); return { l: r.left, t: r.top, r: r.right, b: r.bottom };
  }, name);
  const selectByName = async (name) => { await page.click(`#tree .row:has(span:text-is("${name}"))`); await page.waitForTimeout(100); };
  for (const anchor of ['tl', 'c', 'br', 'tr']) {
    await load({ version: 1, name: 't', theme: {}, root: { type: 'panel', name: 'root', anchor: 'fill', children: [{ type: 'panel', name: 'box', anchor, x: anchor === 'br' || anchor === 'tr' ? -80 : 40, y: anchor === 'br' ? -30 : 30, w: 200, h: 100 }] } });
    await selectByName('box');
    const before = await rectOf('box');
    // right-middle handle (index 3): drag 60 css px right
    const hs = await page.$$('#stage .rects .rh');
    assert.equal(hs.length, 8, 'eight handles');
    const hb = await hs[3].boundingBox();
    await page.mouse.move(hb.x + hb.width / 2, hb.y + hb.height / 2); await page.mouse.down(); await page.mouse.move(hb.x + hb.width / 2 + 60, hb.y + hb.height / 2, { steps: 5 }); await page.mouse.up(); await page.waitForTimeout(200);
    const after = await rectOf('box');
    assert.ok(Math.abs(after.l - before.l) < 1.5, `${anchor}: left edge fixed ${before.l} -> ${after.l}`);
    assert.ok(after.r > before.r + 20, `${anchor}: right edge moved ${before.r} -> ${after.r}`);
    // left-middle handle (index 7): drag 30 px left; the right edge must stay
    const hs2 = await page.$$('#stage .rects .rh');
    const lb = await hs2[7].boundingBox();
    const mid = await rectOf('box');
    await page.mouse.move(lb.x + lb.width / 2, lb.y + lb.height / 2); await page.mouse.down(); await page.mouse.move(lb.x + lb.width / 2 - 30, lb.y + lb.height / 2, { steps: 5 }); await page.mouse.up(); await page.waitForTimeout(200);
    const fin = await rectOf('box');
    assert.ok(Math.abs(fin.r - mid.r) < 1.5, `${anchor}: right edge fixed ${mid.r} -> ${fin.r}`);
    assert.ok(fin.l < mid.l - 10, `${anchor}: left edge moved ${JSON.stringify([mid, fin, lb])}`);
  }
  // canvas scaler: 'scale' at 2x the reference doubles the on-screen size of a fixed-size node
  await load({ version: 1, name: 't', theme: {}, scaler: { mode: 'scale', ref: [480, 270] }, root: { type: 'panel', name: 'root', anchor: 'fill', children: [{ type: 'panel', name: 'box', anchor: 'tl', x: 0, y: 0, w: 100, h: 50 }] } });
  const sz = await rectOf('box');
  const scale = await page.evaluate(() => document.querySelector('#stage').getBoundingClientRect().width / 960);
  assert.ok(Math.abs((sz.r - sz.l) / scale - 200) < 2, `100px node at scale 2: ${(sz.r - sz.l) / scale}`);
  assert.deepEqual(errors, []);
  console.log('ok: UI Designer rect handles keep the opposite edge; canvas scaler scales');
} finally { await browser.close(); srv.kill(); }
