#!/usr/bin/env node
// Headless test: the Scene view keeps the point light on a Modeler model after the Ambient light is edited and the edit is undone
// (every scene change rebuilds the view). Uses the real `nord serve` on tools/light-check.
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { ROOT } from './e2e-lib.mjs';
import { launch, sleep } from './cdp-lib.mjs';

const nord = ['target/release/nord', 'target/debug/nord'].map((p) => path.join(ROOT, p)).find((p) => fs.existsSync(p));
const srv = spawn(nord, ['serve', `${ROOT}/tools/light-check`, '--port', '4176'], { env: { ...process.env, NORD_ROOT: ROOT }, stdio: 'ignore' });
await sleep(1800);
const page = await launch({ port: 9449, width: 900, height: 600 });
try {
  await page.goto('http://127.0.0.1:4176/__edit?mode=3d', 3000);
  const sceneJson = JSON.parse(fs.readFileSync(`${ROOT}/tools/light-check/scenes/modelrig.scene.json`, 'utf8'));
  const send = (rev, ambColor) => {
    const sc = JSON.parse(JSON.stringify(sceneJson));
    sc.entities.find((e) => e.name === 'Ambient').components[0].color = ambColor;
    return page.eval(`window.__nordEdit.onMessage(${JSON.stringify({ t: 'scene', rev, project: { display: { width: 1280, height: 720 } }, selection: [], scene: sc })}); 1`);
  };
  const probe = async () => JSON.parse(await page.eval(`(() => {
    const sc = window.BABYLON.EngineStore.LastCreatedScene;
    const cube = sc.meshes.filter((m) => m.name.includes('node0') && m.getTotalVertices() > 0);
    return JSON.stringify({ cube: cube.map((m) => m.lightSources.filter((l) => l.isEnabled()).length), lights: sc.lights.filter((l) => l.isEnabled()).length, point: sc.lights.filter((l) => l.getClassName() === 'PointLight' && l.isEnabled()).map((l) => (l.includedOnlyMeshes || []).filter((m) => m.name.includes('node0')).length) });
  })()`));
  await send(1, '#3a4688'); await sleep(1800);
  const a = await probe();
  assert.ok(a.cube.length && a.cube[0] >= 3 && a.point[0] === 1, `cube lit by sun, ambient and the point light at start: ${JSON.stringify(a)}`);
  for (let i = 0; i < 4; i++) { await send(2 + i * 2, '#ff2200'); await sleep(500); await send(3 + i * 2, '#3a4688'); await sleep(500); } // edit, undo, edit, undo ...
  await sleep(1500);
  const b = await probe();
  assert.deepEqual(b, a, `same lights after edit/undo: ${JSON.stringify(a)} -> ${JSON.stringify(b)}`);
  await page.eval(`window.__nordEdit.onMessage({ t: 'scene', rev: 99, project: { display: { width: 1280, height: 720 } }, selection: ['lamp'], scene: ${JSON.stringify(sceneJson)} }); 1`); await sleep(1200);
  const gz = JSON.parse(await page.eval(`JSON.stringify(window.BABYLON.EngineStore.LastCreatedScene.meshes.filter((m) => m.name.endsWith('.lightgizmo') && m.isEnabled()).map((m) => [m.name, m.isEnabled()]))`));
  assert.deepEqual(gz, [['lamp.lightgizmo', true]], 'the selected light shows its range gizmo');
  console.log('ok: Scene view keeps the point light on the model after editing the Ambient light', JSON.stringify(b));
} finally { page.close(); srv.kill(); }
