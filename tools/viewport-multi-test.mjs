#!/usr/bin/env node
// Headless test: 2D multi-select — the Move gizmo drags every selected object, Center pivot puts the gizmo between them,
// the Rotate ring turns the group about the pivot, and locked/hidden objects cannot be picked. Uses the real `nord serve`.
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
  const ent = (id, x, y, extra = {}) => ({ id, name: id, enabled: true, tags: [], layer: 0, transform: { pos: [x, y, 0], rot: [0, 0, 0], scale: [1, 1, 1] }, components: [{ type: 'collider', shape: 'box', size: [40, 40] }], scripts: [], children: [], prefab: null, ...extra });
  const push = (m) => page.evaluate((m) => window.__nordEdit.onMessage(m), m);
  const ents = [ent('a', 100, 100), ent('b', 200, 100), ent('c', 300, 100, { locked: true })];
  await push({ t: 'scene', rev: 1, project: { display: { width: 640, height: 360 } }, selection: ['a', 'b'], scene: { name: 's', settings: {}, entities: ents } });
  await push({ t: 'settings', tool: 'move', center: true });
  // locked objects are not pickable
  const [cx, cy] = await page.evaluate(() => window.__nordEdit.backend.api.toScreen(300, 100));
  assert.equal(await page.evaluate(([x, y]) => window.__nordEdit.backend.pickAt(x, y), [cx, cy]), null, 'locked entity is not pickable');
  // Center pivot: gizmo free-move handle sits at x = 150
  const [gx, gy] = await page.evaluate(() => window.__nordEdit.backend.api.toScreen(150, 100));
  await page.mouse.move(gx, gy); await page.mouse.down(); await page.mouse.move(gx + 30, gy + 20, { steps: 5 }); await page.mouse.up();
  const pos = await page.evaluate(() => window.__nordEdit.state.scene.entities.map((e) => e.transform.pos));
  assert.ok(pos[0][0] > 120 && pos[1][0] > 220, `both moved right: ${JSON.stringify(pos)}`);
  assert.ok(Math.abs((pos[1][0] - pos[0][0]) - 100) < 0.01, 'distance between them is kept');
  assert.equal(pos[2][0], 300, 'unselected stays');
  // rotate 90° about the centre
  await push({ t: 'scene', rev: 2, project: { display: { width: 640, height: 360 } }, selection: ['a', 'b'], scene: { name: 's', settings: {}, entities: [ent('a', 100, 100), ent('b', 200, 100)] } });
  await push({ t: 'settings', tool: 'rotate', center: true });
  const [ox, oy] = await page.evaluate(() => window.__nordEdit.backend.api.toScreen(150, 100));
  await page.mouse.move(ox + 64, oy); await page.mouse.down(); await page.mouse.move(ox, oy + 64, { steps: 8 }); await page.mouse.up();
  const t = await page.evaluate(() => window.__nordEdit.state.scene.entities.map((e) => e.transform));
  assert.ok(Math.abs(t[0].pos[0] - 150) < 2 && Math.abs(t[1].pos[0] - 150) < 2, `both on x=150 after 90°: ${JSON.stringify(t.map((x) => x.pos))}`);
  assert.ok(Math.abs(t[0].rot[2] - 90) < 3, `rot ${t[0].rot}`);
  // dropping an asset on an object targets that object; on empty ground it creates a new one at the drop point
  const ipc = async () => (await (await fetch(`${base}/api/ipc`)).json());
  const n0 = (await ipc()).length;
  await push({ t: 'scene', rev: 3, project: { display: { width: 640, height: 360 } }, selection: [], scene: { name: 's', settings: {}, entities: [ent('a', 100, 100)] } });
  const [ax, ay] = await page.evaluate(() => window.__nordEdit.backend.api.toScreen(100, 100));
  await push({ t: 'dropAsset', path: 'assets/hero.png', x: ax, y: ay });
  await push({ t: 'dropAsset', path: 'assets/hero.png', x: ax + 200, y: ay + 100 });
  await page.waitForTimeout(400);
  const drops = (await ipc()).slice(n0).filter((m) => m.t === 'addAsset');
  assert.equal(drops.length, 2, JSON.stringify(drops));
  assert.equal(drops[0].onto, 'a', 'drop on an object');
  assert.ok(Array.isArray(drops[1].pos) && !drops[1].onto, 'drop on empty ground');
  assert.deepEqual(errors, []);
  console.log('ok: multi-select move/rotate about the Center pivot, locked entities not pickable');
} finally { await browser.close(); srv.kill(); }
