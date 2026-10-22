#!/usr/bin/env node
// Headless test: Unity-style Scene view navigation in 3D (hold RMB = mouse look + WASD fly). Uses the real `nord serve`.
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
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(`${base}/__edit?mode=3d`);
  await page.waitForFunction(() => window.__nord_edit_ready === true, null, { timeout: 60000 });
  const scene = JSON.parse(await (await fetch(`${base}/scenes/main.scene.json`)).text());
  await page.evaluate((m) => window.__nordEdit.onMessage(m), { t: 'scene', rev: 1, project: { display: { width: 1280, height: 720 } }, selection: [], scene });
  const cam = () => page.evaluate(() => { const c = window.BABYLON.EngineStore.LastCreatedScene.activeCamera, t = c.getTarget().subtract(c.position).normalize(); return { p: c.position.asArray(), f: t.asArray() }; });
  const dist = (a, b) => Math.hypot(...a.map((v, i) => v - b[i]));
  await page.waitForTimeout(1500);
  const c0 = await cam();
  await page.mouse.move(450, 250);
  await page.mouse.down({ button: 'right' });
  await page.mouse.move(550, 250, { steps: 5 }); // look right
  const c1 = await cam(); 
  assert.ok(dist(c0.p, c1.p) < 1e-2, `looking does not move the camera: ${c0.p} -> ${c1.p}`);
  assert.ok(c1.f[0] > c0.f[0] + 0.1, `looked right: ${c0.f} -> ${c1.f}`);
  await page.keyboard.down('KeyW'); await page.waitForTimeout(600); await page.keyboard.up('KeyW');
  const c2 = await cam();
  assert.ok(dist(c1.p, c2.p) > 2, `W flew forward ${dist(c1.p, c2.p)}`);
  const along = c2.p.map((v, i) => v - c1.p[i]).reduce((s, v, i) => s + v * c1.f[i], 0);
  assert.ok(along > 2, 'moved along the view direction');
  await page.mouse.up({ button: 'right' });
  await page.keyboard.down('KeyW'); await page.waitForTimeout(300); await page.keyboard.up('KeyW');
  assert.ok(dist((await cam()).p, c2.p) < 1e-3, 'WASD only flies while RMB is held');
  assert.deepEqual(errors, []);
  console.log('ok: RMB mouse look + WASD fly');
} finally { await browser.close(); srv.kill(); }
