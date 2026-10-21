#!/usr/bin/env node
// Captures the manual's FPS Creator screenshots → docs/screenshots/ed-fpsc-*.png (resized + palette-quantized with Python/PIL).
// usage: node tools/fpsc-shots.mjs      (needs cargo build -p nord-cli, Playwright + Chromium, python3 + PIL)
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { loadPlaywright, ROOT } from './e2e-lib.mjs';

const proj = fs.mkdtempSync(path.join(os.tmpdir(), 'fpsc-shots-')); fs.cpSync(path.join(ROOT, 'templates/fps-creator'), proj, { recursive: true });
const port = 5300 + Math.floor(Math.random() * 300), base = `http://127.0.0.1:${port}`, tmp = path.join(ROOT, 'target/fpsc/shots'); fs.mkdirSync(tmp, { recursive: true });
const srv = spawn(path.join(ROOT, 'target/debug/nord'), ['serve', proj, '-p', String(port)], { env: { ...process.env, NORD_ROOT: ROOT }, stdio: 'ignore' });
for (let i = 0; i < 60; i++) { try { if ((await fetch(`${base}/api/project`)).ok) break; } catch { /* wait */ } await new Promise((r) => setTimeout(r, 150)); }
const { chromium } = loadPlaywright(); const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-sandbox'] });
try {
  const ed = await browser.newPage({ viewport: { width: 1600, height: 900 } });
  await ed.goto(`${base}/editor/fpsc/index.html?level=levels/level1.fpsl.json`); await ed.waitForFunction(() => window.__fpsc_editor_ready); await ed.waitForTimeout(1500);
  const E = (fn, a) => ed.evaluate(`(${fn})(window.__fpscEditor, ${JSON.stringify(a ?? null)})`);
  await E(`(ed) => { ed.setView('split'); ed.setTab('items'); ed.itemsUi = { cat: 'Enemies', q: '' }; ed.renderLeft(); const t = ed.level.entities.find((e) => e.name === 'labterm'); ed.selectEntity(t.id); ed.map.cx = 17.5 * 4; ed.map.cz = 20 * 4; ed.map.zoom = 8.5; ed.map.draw();
    const v = ed.v3; v.yaw = 0.55; v.pitch = 0.62; v.cam.position.set(17.5 * 4 - 38, 34, 20 * 4 - 46); v.setVisible(true); }`);
  await ed.waitForTimeout(1500); await ed.screenshot({ path: `${tmp}/ed-fpsc-editor.png` });
  await E(`(ed) => { ed.setTab('build'); ed.clearSel(); ed.setTool('wall'); ed.brush.piece = 'window'; ed.renderLeft(); }`); await ed.waitForTimeout(500); await ed.screenshot({ path: `${tmp}/ed-fpsc-build.png` });
  await E(`(ed) => { ed.setTab('assets'); ed.setTool('select'); }`); await ed.waitForTimeout(400); await ed.screenshot({ path: `${tmp}/ed-fpsc-assets.png` });
  await E(`(ed) => { const guard = ed.level.entities.find((e) => ed.bank.entity(e.type)?.enemy && e.path?.length > 1); guard.name ||= 'patrol_guard'; ed.selectEntity(guard.id, false, true); ed.objectsUi = { q: guard.name, layer: 'all' }; ed.setTab('objects'); ed.setTool('select'); ed.map.zoom = 8; ed.map.draw(); }`);
  await ed.waitForTimeout(900); await ed.screenshot({ path: `${tmp}/ed-fpsc-objects-patrol.png` });
  await E(`(ed) => ed.play(false)`);
  await ed.waitForFunction(() => document.getElementById('play-frame').contentWindow?.__fpsc_ready, null, { timeout: 30000 });
  const frame = ed.frames().find((f) => f.url().includes('play.html'));
  await frame.waitForFunction(() => window.__fpsc_ready);
  await frame.evaluate(() => { const g = window.__fpsc.game; g.ctl.noLock = true; g.begin(); g.player.god = true; g.player.teleport(24.2 * 4, 19.5 * 4, 0); g.player.yaw = 80 * Math.PI / 180; g.player.pitch = 0.05; g.update(1 / 30); g.pause(true); });
  await ed.waitForTimeout(500); await ed.screenshot({ path: `${tmp}/ed-fpsc-stop-test.png` });
  await E(`(ed) => ed.stopPlay()`);
  await E(`async ed=>{ed.setLevel(await (await fetch('/levels/corners.fpsl.json')).json(),'levels/corners.fpsl.json');ed.setTab('build');ed.brush.cellMode='corner';ed.setTool('cell');ed.map.fit(ed.level);ed.map.draw();const v=ed.v3;v.cam.position.set(23,58,-40);v.yaw=0;v.pitch=0.8;ed.sel.cells.add('4,4');ed.refreshInspector();document.getElementById('left-body').scrollTop=10000;v.setVisible(true);}`);
  await ed.waitForTimeout(1400); await ed.screenshot({path:`${tmp}/ed-fpsc-corners.png`});
  await E(`ed=>{const e=ed.addEntity('enemy_soldier',12,14);e.props.health=123;ed.scriptEntry(e,'ai-shooter').params.damage=2;ed.commit('gentle guard');ed.setTab('items');ed.saveVariant(e);}`);
  await ed.waitForSelector('[aria-label="Variant name"]'); await ed.screenshot({path:`${tmp}/ed-fpsc-variant.png`}); await ed.keyboard.press('Escape');
  const pg = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  await pg.goto(`${base}/editor/fpsc/play.html?level=levels/level1.fpsl.json&autostart&nolock&shot`); await pg.waitForFunction(() => window.__fpsc_ready);
  for (const [n, x, z, yaw, pitch] of [['yard', 24.2, 19.5, 80, 0.05], ['hall', 15.6, 16.5, 25, 0.02], ['arena', 29.5, 28.6, 0, 0.06]]) {
    await pg.evaluate(([x, z, yaw, pitch]) => { const g = window.__fpsc.game; g.player.god = true; g.player.teleport(x * 4, z * 4, 0); g.player.yaw = yaw * Math.PI / 180; g.player.pitch = pitch; g.hud.message('', 0.01); for (let i = 0; i < 40; i++) g.update(1 / 30); document.querySelector('.fpsc-msg').classList.remove('on'); }, [x, z, yaw, pitch]);
    await pg.waitForTimeout(500); await pg.screenshot({ path: `${tmp}/ed-fpsc-${n}.png` });
  }
} finally { await browser.close(); srv.kill(); fs.rmSync(proj, { recursive: true, force: true }); }
const py = spawnSync('python3', ['-c', `
from PIL import Image
import glob, os, sys
for f in sorted(glob.glob(${JSON.stringify(tmp)} + '/ed-fpsc-*.png')):
    im = Image.open(f).convert('RGB'); w, h = im.size
    if w > 1280: im = im.resize((1280, int(h * 1280 / w)), Image.LANCZOS)
    out = os.path.join(${JSON.stringify(path.join(ROOT, 'docs/screenshots'))}, os.path.basename(f))
    im.quantize(256, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE).save(out, optimize=True)
    print(os.path.basename(out), os.path.getsize(out) // 1024, 'KB')
`], { stdio: 'inherit' });
process.exit(py.status ?? 1);
