#!/usr/bin/env node
// Headless test: in the Scene view a sprite is lit by a red and a blue point light and the colours blend (red left, blue right, magenta between).
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { ROOT } from './e2e-lib.mjs';
import { launch, sleep } from './cdp-lib.mjs';
import { decodePng } from '../mcp/lib/png.mjs';

const nord = ['target/release/nord', 'target/debug/nord'].map((p) => path.join(ROOT, p)).find((p) => fs.existsSync(p));
const srv = spawn(nord, ['serve', `${ROOT}/tools/light-check`, '--port', '4177'], { env: { ...process.env, NORD_ROOT: ROOT }, stdio: 'ignore' });
await sleep(1800);
const page = await launch({ port: 9450, width: 900, height: 600 });
const tmp = path.join(ROOT, 'target/vp-sprite-lights.png');
let failed = 0;
try {
  await page.goto('http://127.0.0.1:4177/__edit?mode=3d', 3000);
  const sc = JSON.parse(fs.readFileSync(`${ROOT}/tools/light-check/scenes/colors2.scene.json`, 'utf8')); if (process.env.SCENE) Object.assign(sc, JSON.parse(fs.readFileSync(process.env.SCENE, 'utf8')));
  sc.entities = sc.entities.filter((e) => e.name !== 'Camera');
  await page.eval(`window.__nordEdit.onMessage(${JSON.stringify({ t: 'scene', rev: 1, project: { display: { width: 1280, height: 720 } }, selection: [], scene: sc })}); 1`);
  await sleep(1500);
  await page.eval(`(() => { const c = window.BABYLON.EngineStore.LastCreatedScene.activeCamera; c.setTarget(new window.BABYLON.Vector3(0, 0, 0)); c.alpha = -Math.PI / 2; c.beta = Math.PI / 2; c.radius = ${+(process.env.RADIUS ?? 9)}; })()`);
  await sleep(800); await page.shot(tmp); if (process.env.KEEP) fs.copyFileSync(tmp, process.env.KEEP);
  if (process.env.DEBUG) console.log(await page.eval(`JSON.stringify(window.BABYLON.EngineStore.LastCreatedScene.lights.map((l) => ({ n: l.name, c: l.getClassName(), i: l.intensity, r: l.range, d: l.diffuse, p: l.getAbsolutePosition(), on: l.isEnabled(), inc: (l.includedOnlyMeshes || []).map((m) => m.name), pr: l.renderPriority })))`));
  const im = decodePng(fs.readFileSync(tmp)), at = (fx) => { const i = ((im.h >> 1) * im.w + Math.floor(im.w * fx)) * 4; return [im.data[i], im.data[i + 1], im.data[i + 2]]; };
  const row = [at(0.4), at(0.5), at(0.6)];
  const ok = row[1][0] > 60 && row[1][2] > 60;
  console.log(ok ? '✔' : '✖', 'Scene view: red + blue point lights blend on a sprite', JSON.stringify(row));
  if (!ok) failed++;
} finally { page.close(); srv.kill(); }
process.exit(failed ? 1 : 0);
