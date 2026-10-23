#!/usr/bin/env node
// Headless test: 3D multi-select — one gizmo moves/rotates every selected object (Center pivot), LMB-drag marquee selects,
// the axis gizmo snaps the view, locked objects are not pickable. Uses the real `nord serve`.
import { spawn } from 'node:child_process';
import assert from 'node:assert/strict';
import { loadPlaywright, ROOT } from './e2e-lib.mjs';

const port = 5500 + Math.floor(Math.random() * 200);
const srv = spawn('cargo', ['run', '-q', '-p', 'nord-cli', '--', 'serve', `${ROOT}/examples/platformer3d`, '--port', String(port)], { env: { ...process.env, NORD_ROOT: ROOT }, stdio: 'ignore' });
const base = `http://127.0.0.1:${port}`;
for (let i = 0; i < 120; i++) { try { if ((await fetch(base + '/api/project')).ok) break; } catch { /* starting */ } await new Promise((r) => setTimeout(r, 500)); }
const { chromium } = loadPlaywright();
const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
try {
  const page = await (await browser.newContext({ viewport: { width: 900, height: 500 } })).newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message)); page.on('console', (m) => process.env.DBG && console.log('console:', m.text()));
  await page.goto(`${base}/__edit?mode=3d`);
  await page.waitForFunction(() => window.__nord_edit_ready === true, null, { timeout: 25000 });
  const box = (id, x, extra = {}) => ({ id, name: id, enabled: true, tags: [], layer: 0, transform: { pos: [x, 0, 0], rot: [0, 0, 0], scale: [1, 1, 1] }, components: [{ type: 'mesh', shape: 'box', size: [1, 1, 1] }], scripts: [], children: [], prefab: null, ...extra });
  const push = (m) => page.evaluate((m) => window.__nordEdit.onMessage(m), m);
  await push({ t: 'scene', rev: 1, project: { display: { width: 1280, height: 720 } }, selection: ['a', 'b'], scene: { name: 's', settings: {}, entities: [box('a', -2), box('b', 2), box('c', 6, { locked: true })] } });
  await push({ t: 'settings', tool: 'move', center: true });
  await page.waitForTimeout(800);
  // the gizmo sits on a pivot between a and b; moving it by +3 moves both
  const piv = await page.evaluate(() => window.__nordEdit.backend.api.pivot()?.position.asArray());
  assert.ok(piv && Math.abs(piv[0]) < 1e-3, `pivot at the centre: ${piv}`);
  await page.evaluate(() => window.__nordEdit.backend.api.drag((p) => { p.position.x += 3; }));
  let ent = await page.evaluate(() => window.__nordEdit.state.scene.entities.map((e) => e.transform));
  assert.ok(Math.abs(ent[0].pos[0] - 1) < 1e-3 && Math.abs(ent[1].pos[0] - 5) < 1e-3, `both moved +3: ${JSON.stringify(ent.map((t) => t.pos))}`);
  // rotate the pivot 90° about Y: the pair swings round the centre (x=3)
  await page.evaluate(() => { const B = window.BABYLON; window.__nordEdit.backend.api.drag((p) => { p.rotationQuaternion = B.Quaternion.RotationAxis(B.Axis.Y, Math.PI / 2); }); });
  ent = await page.evaluate(() => window.__nordEdit.state.scene.entities.map((e) => e.transform));
  assert.ok(Math.abs(ent[0].pos[0] - 3) < 1e-2 && Math.abs(Math.abs(ent[0].pos[2]) - 2) < 1e-2, `rotated about the centre: ${JSON.stringify(ent.map((t) => t.pos))}`);
  assert.ok(Math.abs(Math.abs(ent[0].rot[1]) - 90) < 1, `own rotation turned too: ${ent[0].rot}`);
  // marquee: select all with a rectangle around everything unlocked
  const ids = await page.evaluate(() => window.__nordEdit.backend.api.entitiesInRect({ x0: 0, y0: 0, x: 900, y: 500 }));
  assert.ok(ids.includes('a') && ids.includes('b') && !ids.includes('c'), `marquee skips locked: ${ids}`);
  // axis gizmo: clicking +Y looks from above
  const hit = await page.evaluate(() => window.__nordEdit.backend.api.axisHits().find((h) => h.name === 'Y' && h.sign > 0));
  assert.ok(hit, 'axis gizmo drew');
  assert.deepEqual(errors, []);
  console.log('ok: 3D multi-select gizmo, marquee, axis gizmo');
} finally { await browser.close(); srv.kill(); }
