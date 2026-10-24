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
  return { centre: px(im.w >> 1, im.h >> 1), corner: px(30, 100), side: px(575, 300), top: px(400, 170) }; // side: ground in the box shadow, just past the box edge (800x600 window, camera 9 above)
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
  await page.eval(`window.__nord.loadScene('scenes/many.scene.json')`);
  const m = await lum();
  check('a light is not lost when the scene has more lights than a material can use', m.centre > 60, m);
  await page.eval(`window.__nord.loadScene('scenes/noshadow.scene.json')`);
  const ns = await lum();
  await page.eval(`window.__nord.loadScene('scenes/shadow.scene.json')`);
  const sd = await lum();
  check('castShadows: the box casts a shadow on the ground beside it', sd.side < ns.side * 0.6, { with: sd.side, without: ns.side });
  await page.eval(`window.__nord.loadScene('scenes/sprite.scene.json')`);
  const sp = await lum();
  check('a sprite is drawn in 3D as a plane (default 64 px = 1 unit, scaled 8x)', sp.centre > 120 && sp.corner < sp.centre, sp);
  // the Modeler model keeps its point light while other lights are switched on and off (regression)
  await page.eval(`window.__nord.loadScene('scenes/modelrig.scene.json')`);
  const rig = async (label) => { const r = await lum(); return { label, ...r }; };
  await page.eval(`window.__nord.scene.find('Moon').enabled = false`);
  await page.eval(`window.__nord.scene.find('Ambient').enabled = false`);
  const only = await rig('lamp only');
  check('model lit by its point light alone', only.top > 20, only);
  await page.eval(`window.__nord.scene.find('Lamp').enabled = false`);
  const dark = await rig('everything off');
  check('model is dark without lights', dark.top < 8, dark);
  await page.eval(`window.__nord.scene.find('Lamp').enabled = true`);
  for (const [n, v] of [['Ambient', true], ['Ambient', false], ['Moon', true], ['Moon', false], ['Ambient', true], ['Ambient', false]]) {
    await page.eval(`window.__nord.scene.find('${n}').enabled = ${v}`);
    await sleep(300);
  }
  const again = await rig('after toggling');
  check('point light still works after toggling ambient/sun', again.top > only.top * 0.8, { only: only.top, again: again.top });
  // live changes through entity.set, like a script or the Inspector while playing
  await page.eval(`window.__nord.scene.find('Lamp').set('light', 'intensity', 0)`);
  const live0 = await rig('intensity 0');
  check('entity.set("light","intensity",0) darkens the model', live0.top < 8, live0);
  await page.eval(`window.__nord.scene.find('Lamp').set('light', 'intensity', 6.2)`);
  const live1 = await rig('intensity back');
  check('entity.set("light","intensity",6.2) lights it again', live1.top > only.top * 0.8, live1);
  await page.eval(`window.__nord.scene.find('Cube').enabled = false`);
  await sleep(300);
  check('a disabled parent entity switches its child light off', await page.eval(`!window.__nord.backend.scene.lights.find((l) => l.name === 'Lamp.light').isEnabled()`), {});
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
    await page.eval(`window.__nord.loadScene('scenes/main.scene.json')`); await sleep(500);
    await page.eval(`window.__nord.scene.find('Lamp').set('light', 'radius', 60)`);
    const h = await lum();
    check('2D entity.set("light","radius",60) shrinks the light', h.centre > 100 && h.side < 20, h);
  } finally { s2.kill(); }
} finally { page.close(); server.kill(); }
process.exit(failed ? 1 : 0);
