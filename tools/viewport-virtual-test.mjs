#!/usr/bin/env node
// Headless test: the 3D Scene view shows the FPS level contents (and a skybox/path) like the Game view does. Uses the real `nord serve`.
import { spawn } from 'node:child_process';
import assert from 'node:assert/strict';
import { loadPlaywright, ROOT } from './e2e-lib.mjs';

const port = 4900 + Math.floor(Math.random() * 200);
const srv = spawn('cargo', ['run', '-q', '-p', 'nord-cli', '--', 'serve', `${ROOT}/examples/fps-creator`, '--port', String(port)], { env: { ...process.env, NORD_ROOT: ROOT }, stdio: 'ignore' });
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
  await page.waitForFunction(() => window.BABYLON.EngineStore.LastCreatedScene.meshes.some((m) => m.metadata?.entityId === 'eeeeeee1' && m.getTotalVertices() > 100), null, { timeout: 20000 });
  const n = await page.evaluate(() => window.BABYLON.EngineStore.LastCreatedScene.meshes.filter((m) => m.metadata?.entityId === 'eeeeeee1').length);
  assert.ok(n >= 2, `FPS level meshes: ${n}`);
  assert.deepEqual(errors, []);
  console.log(`ok: FPS level preview has ${n} meshes in the 3D Scene view`);
} finally { await browser.close(); srv.kill(); }
