#!/usr/bin/env node
// Headless test + screenshot run of the Neon Harbor showcase (examples/neon-harbor): menu → run → collect every data core → win.
// Env NH_SHOTS=<dir> writes screenshots there (used for the tutorial pages).
import { spawn } from 'node:child_process';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { loadPlaywright, ROOT } from './e2e-lib.mjs';

const port = 6200 + Math.floor(Math.random() * 90);
const srv = spawn('cargo', ['run', '-q', '-p', 'nord-cli', '--', 'serve', `${ROOT}/examples/neon-harbor`, '--port', String(port)], { env: { ...process.env, NORD_ROOT: ROOT }, stdio: 'ignore' });
const base = `http://127.0.0.1:${port}`;
for (let i = 0; i < 120; i++) { try { if ((await fetch(base + '/api/project')).ok) break; } catch { /* starting */ } await new Promise((r) => setTimeout(r, 500)); }
const { chromium } = loadPlaywright();
const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const shots = process.env.NH_SHOTS;
if (shots) fs.mkdirSync(shots, { recursive: true });
try {
  const page = await (await browser.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
  const errors = [];
  page.on('response', (r) => { if (r.status() >= 400) errors.push(`HTTP ${r.status()} ${r.url()}`); });
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') { const t = m.text(); if (!/GL Driver|ReadPixels|WebGL|swiftshader/i.test(t)) errors.push(`${m.type()}: ${t}`); } });
  await page.goto(base + '/');
  await page.waitForFunction(() => window.__nord_ready === true || window.__nord_error, null, { timeout: 90000 });
  assert.equal(await page.evaluate(() => window.__nord_error ?? null), null);
  await page.waitForFunction(() => window.__nord?.ui?.scenes?.get?.('menu'), null, { timeout: 30000 });
  await page.waitForTimeout(2500);
  if (shots) await page.screenshot({ path: `${shots}/nh-menu.png` });
  // start the run through the real button
  await page.evaluate(() => window.__nord.ui.scenes.get('menu').$('play').el.click());
  await page.waitForFunction(() => window.__nord.scene?.name === 'harbor' && window.__nord.ui.scenes.get('hud'), null, { timeout: 60000 }).catch(async (e) => { console.log('STATE', await page.evaluate(() => ({ scene: window.__nord.scene?.name, ui: [...window.__nord.ui.scenes.screens.keys()] }))); console.log(errors.join('\n')); throw e; });
  await page.waitForTimeout(2500);
  const info = await page.evaluate(() => { const g = window.__nord, s = g.scene; return { orbs: s.findByTag('orb').length, solids: s.findByTag('solid').length, entities: [...s.all()].length, hud: !!g.ui.scenes.get('hud'), score: g.ui.scenes.get('hud').get('score').el.textContent }; });
  assert.equal(info.orbs, 14, JSON.stringify(info));
  assert.ok(info.solids >= 12, 'towers (including block children) are solid: ' + info.solids);
  // drive for a moment with the real input: throttle + steer
  await page.keyboard.down('KeyW'); await page.keyboard.down('KeyD'); await page.waitForTimeout(1200); await page.keyboard.up('KeyD'); await page.waitForTimeout(800); await page.keyboard.up('KeyW');
  const moved = await page.evaluate(() => window.__nord.scene.find('Skiff').pos);
  assert.ok(Math.hypot(moved[0], moved[2]) > 5, `skiff moved: ${moved}`);
  if (shots) await page.screenshot({ path: `${shots}/nh-run.png` });
  // pause with P (a DOM key, because the game loop stops), screenshot, resume with the button
  await page.keyboard.press('KeyP');
  await page.waitForFunction(() => window.__nord.paused === true || window.__nord.ui.scenes.get('pause').visible);
  assert.equal(await page.evaluate(() => window.__nord.ui.scenes.get('pause').visible), true, 'pause screen');
  if (shots) await page.screenshot({ path: `${shots}/nh-pause.png` });
  await page.evaluate(() => window.__nord.ui.scenes.get('pause').$('resume').el.click());
  assert.equal(await page.evaluate(() => window.__nord.ui.scenes.get('pause').visible), false, 'resumed');
  // collect the cores: put the skiff on each one in turn (the orb script does the rest)
  const log = [];
  await page.evaluate(() => { window.__log = []; for (const n of ['orb', 'overdrive']) window.__nord.events.on(n, () => window.__log.push(n)); });
  for (let i = 0; i < 14; i++) {
    await page.evaluate(() => { const s = window.__nord.scene, o = s.findByTag('orb')[0]; if (o) { const p = o.worldPos; s.find('Skiff').pos = [p[0], 0.35, p[2]]; } });
    await page.waitForTimeout(350);
    if (i === 2 && shots) await page.screenshot({ path: `${shots}/nh-overdrive.png` });
  }
  await page.waitForTimeout(1000);
  const res = await page.evaluate(() => { const g = window.__nord; return { log: window.__log, end: g.ui.scenes.get('gameover').visible, result: g.ui.scenes.get('gameover').get('result').el.textContent, hud: g.ui.scenes.get('hud').get('orbs').el.textContent }; });
  assert.equal(res.log.filter((x) => x === 'orb').length, 14, JSON.stringify(res));
  assert.ok(res.log.filter((x) => x === 'overdrive').length >= 3, 'the event sheet fires OVERDRIVE every third core: ' + JSON.stringify(res.log));
  assert.ok(res.end, 'end screen shown');
  assert.match(res.result, /SECURED/);
  const score = await page.evaluate(() => window.__nord.ui.scenes.get('gameover').el?.textContent ?? window.__nord.ui.scenes.get('gameover').rootEl.textContent);
  assert.match(score, /Score (\d+)/);
  assert.ok(Number(/Score (\d+)/.exec(score)[1]) >= 140, 'score counts the cores: ' + score);
  if (shots) await page.screenshot({ path: `${shots}/nh-win.png` });
  assert.deepEqual(errors, []);
  console.log('ok: Neon Harbor menu → run → 14 cores → win', res.log.length, 'events');
} finally { await browser.close(); srv.kill(); }
