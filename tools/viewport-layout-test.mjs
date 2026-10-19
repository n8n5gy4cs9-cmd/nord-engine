#!/usr/bin/env node
// Headless test of the 2D scene viewport additions (M10-12/13): layer lock/hide, guides, rulers, guide dragging. Uses the real `nord serve`.
import { spawn } from 'node:child_process';
import assert from 'node:assert/strict';
import { loadPlaywright, ROOT } from './e2e-lib.mjs';

const port = 4700 + Math.floor(Math.random() * 200);
const srv = spawn('cargo', ['run', '-q', '-p', 'nord-cli', '--', 'serve', `${ROOT}/examples/event-sheets`, '--port', String(port)], { env: { ...process.env, NORD_ROOT: ROOT }, stdio: 'ignore' });
const base = `http://127.0.0.1:${port}`;
for (let i = 0; i < 120; i++) { try { if ((await fetch(base + '/api/project')).ok) break; } catch { /* starting */ } await new Promise((r) => setTimeout(r, 500)); }
const { chromium } = loadPlaywright();
const browser = await chromium.launch();
try {
  const page = await (await browser.newContext({ viewport: { width: 900, height: 500 } })).newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(`${base}/__edit?mode=2d`);
  await page.waitForFunction(() => window.__nord_edit_ready === true);
  const ent = (id, x, y, layer) => ({ id, name: id, enabled: true, tags: [], layer, transform: { pos: [x, y, 0], rot: [0, 0, 0], scale: [1, 1, 1] }, components: [{ type: 'collider', shape: 'box', size: [60, 60] }], scripts: [], children: [], prefab: null });
  const scene = (settings) => ({ t: 'scene', rev: Math.random(), project: { display: { width: 640, height: 360, background: '#223' } }, selection: [], scene: { name: 's', settings, entities: [ent('a', 100, 100, 0), ent('b', 300, 100, 1), ent('c', 500, 100, 2)] } });
  const push = (m) => page.evaluate((m) => window.__nordEdit.onMessage(m), m);
  const pick = (id) => page.evaluate((id) => { const api = window.__nordEdit.backend.api; const [sx, sy] = api.screenOf(id); return api.pickAt(sx, sy); }, id);
  await push(scene({}));
  assert.equal(await pick('a'), 'a'); assert.equal(await pick('b'), 'b');
  await push(scene({ layers: { 1: { locked: true }, 2: { visible: false } } }));
  assert.equal(await pick('a'), 'a'); assert.equal(await pick('b'), null, 'locked layer cannot be picked'); assert.equal(await pick('c'), null, 'hidden layer cannot be picked');
  // guides are drawn: a cyan-ish vertical line at world x = 200
  await push(scene({ guides: { x: [200], y: [] } }));
  const px = await page.evaluate(() => { const api = window.__nordEdit.backend.api, [sx, sy] = api.toScreen(200, 300); const c = document.getElementById('c'), r = c.getContext('2d').getImageData(Math.round(sx) * (devicePixelRatio || 1), Math.round(sy) * (devicePixelRatio || 1), 1, 1).data; return [...r]; });
  assert.ok(px[2] > 150 && px[1] > 100, `guide pixel ${px}`);
  await page.screenshot({ path: `${ROOT}/target/viewport-layout.png` });
  // drag from the top ruler to create a horizontal guide; the editor receives {t:'guide'}
  const before = (await (await fetch(`${base}/api/ipc`)).json()).length;
  await page.mouse.move(400, 6); await page.mouse.down(); await page.mouse.move(400, 200, { steps: 4 }); await page.mouse.up();
  await page.waitForTimeout(400);
  const msgs = (await (await fetch(`${base}/api/ipc`)).json()).slice(before).filter((m) => m.t === 'guide');
  assert.equal(msgs.length, 1); assert.equal(msgs[0].axis, 'y'); assert.equal(typeof msgs[0].to, 'number'); assert.equal(msgs[0].from, null);
  assert.deepEqual(errors, []);
  console.log('viewport layout OK');
} finally { await browser.close(); srv.kill(); }
