#!/usr/bin/env node
// Headless check of 3D lighting: a point light must light the ground near it and not far away; ambient on/off must work.
//   NORD_BROWSER=... node tools/light-check/run.mjs
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { ROOT } from '../e2e-lib.mjs';
import { launch, sleep } from '../cdp-lib.mjs';
import { decodePng } from '../../mcp/lib/png.mjs';

const nord = process.env.NORD_BIN ?? ['target/release/nord', 'target/debug/nord'].map((p) => path.join(ROOT, p)).find((p) => fs.existsSync(p));
const server = spawn(nord, ['serve', path.join(ROOT, 'tools/light-check'), '-p', '4171'], { stdio: 'ignore' });
await sleep(1800);
const page = await launch({ port: 9445, width: 800, height: 600 });
const tmp = path.join(ROOT, 'target/light-check.png');
const lum = async () => {
  await sleep(600); await page.shot(tmp);
  const im = decodePng(fs.readFileSync(tmp)), px = (x, y) => { const i = (y * im.w + x) * 4; return (im.data[i] + im.data[i + 1] + im.data[i + 2]) / 3; };
  return { centre: px(im.w >> 1, im.h >> 1), corner: px(30, 100) };
};
let failed = 0;
const check = (name, ok, info) => { console.log(`${ok ? '✔' : '✖'} ${name} ${JSON.stringify(info)}`); if (!ok) failed++; };
try {
  await page.goto('http://localhost:4171/', 3500);
  const a = await lum();
  check('point light lights the ground below it, not the far corner', a.centre > 60 && a.corner < 40, a);
  await page.eval(`window.__nord.scene.find('Lamp').enabled = false`);
  const b = await lum();
  check('disabled light entity gives darkness', b.centre < 15, b);
  await page.eval(`window.__nord.loadScene('scenes/amb.scene.json')`);
  const c = await lum();
  check('scene ambient lights everything evenly', c.centre > 40 && Math.abs(c.centre - c.corner) < 12, c);
  await page.eval(`window.__nord.loadScene('scenes/off.scene.json')`);
  const d = await lum();
  check('ambientIntensity 0 switches ambient off', d.centre < 15 && d.corner < 15, d);
  // 2D (Phaser Light2D): ambient + a point light
  const s2 = spawn(nord, ['serve', path.join(ROOT, 'tools/light-check/2d'), '-p', '4172'], { stdio: 'ignore' });
  try {
    await sleep(1500); await page.goto('http://localhost:4172/', 3500);
    const e = await lum();
    check('2D point light lights the sprite near it, not the corner', e.centre > 100 && e.corner < 20, e);
    await page.eval(`window.__nord.loadScene('scenes/amb.scene.json')`);
    const f = await lum();
    check('2D scene ambient lights the sprite', f.corner > 60 && f.centre > 60, f);
    await page.eval(`window.__nord.loadScene('scenes/off.scene.json')`);
    const g = await lum();
    check('2D ambientIntensity 0 is dark', g.centre < 15 && g.corner < 15, g);
  } finally { s2.kill(); }
} finally { page.close(); server.kill(); }
process.exit(failed ? 1 : 0);
