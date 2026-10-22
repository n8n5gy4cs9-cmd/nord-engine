#!/usr/bin/env node
// Headless test: 2D Rect tool (T) — dragging a side handle resizes via scale and keeps the opposite edge fixed. Uses the real `nord serve`.
import { spawn } from 'node:child_process';
import assert from 'node:assert/strict';
import { loadPlaywright, ROOT } from './e2e-lib.mjs';

const port = 5800 + Math.floor(Math.random() * 150);
const srv = spawn('cargo', ['run', '-q', '-p', 'nord-cli', '--', 'serve', `${ROOT}/examples/event-sheets`, '--port', String(port)], { env: { ...process.env, NORD_ROOT: ROOT }, stdio: 'ignore' });
const base = `http://127.0.0.1:${port}`;
for (let i = 0; i < 120; i++) { try { if ((await fetch(base + '/api/project')).ok) break; } catch { /* starting */ } await new Promise((r) => setTimeout(r, 500)); }
const { chromium } = loadPlaywright();
const browser = await chromium.launch();
try {
  const page = await (await browser.newContext({ viewport: { width: 900, height: 500 } })).newPage();
  const errors = []; page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(`${base}/__edit?mode=2d`);
  await page.waitForFunction(() => window.__nord_edit_ready === true);
  const e = { id: 'a', name: 'a', enabled: true, tags: [], layer: 0, transform: { pos: [100, 100, 0], rot: [0, 0, 0], scale: [1, 1, 1] }, components: [{ type: 'collider', shape: 'box', size: [60, 40] }], scripts: [], children: [], prefab: null };
  const push = (m) => page.evaluate((m) => window.__nordEdit.onMessage(m), m);
  await push({ t: 'scene', rev: 1, project: { display: { width: 640, height: 360 } }, selection: ['a'], scene: { name: 's', settings: {}, entities: [e] } });
  await push({ t: 'settings', tool: 'rect' });
  const [rx, ry] = await page.evaluate(() => window.__nordEdit.backend.api.toScreen(130, 100)); // right-edge handle
  const [lx, ly] = await page.evaluate(() => window.__nordEdit.backend.api.toScreen(70, 100));
  await page.mouse.move(rx, ry); await page.mouse.down(); await page.mouse.move(rx + 60 * 1, ry, { steps: 4 }); await page.mouse.up();
  const t = await page.evaluate(() => window.__nordEdit.state.scene.entities[0].transform);
  assert.ok(t.scale[0] > 1.3 && t.scale[1] === 1, `scale ${t.scale}`);
  const right = t.pos[0] - 70; // left edge stays at x = 70 (width 60 * scale)
  assert.ok(Math.abs(t.pos[0] - 30 * t.scale[0] - 70) < 0.5, `left edge fixed, pos ${t.pos}`);
  assert.deepEqual(errors, []);
  console.log('ok: rect tool resizes about the opposite edge', t.scale, t.pos, right > 0);
} finally { await browser.close(); srv.kill(); }
