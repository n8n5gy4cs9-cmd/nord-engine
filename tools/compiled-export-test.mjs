#!/usr/bin/env node
// `nord build` compiles event sheets to JavaScript; the exported game must use them and behave the same. Needs Playwright + Chromium + Node.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { loadPlaywright, serve, ROOT } from './e2e-lib.mjs';

const out = `${ROOT}/target/compiled-export`;
fs.rmSync(out, { recursive: true, force: true });
const env = { ...process.env, NORD_ROOT: ROOT };
execFileSync('cargo', ['run', '-q', '-p', 'nord-cli', '--', 'build', `${ROOT}/templates/es-platformer`, '--out', out], { stdio: 'inherit', env });
assert.ok(fs.existsSync(`${out}/events/main.events.compiled.js`), 'compiled module written');
assert.equal(JSON.parse(fs.readFileSync(`${out}/events/main.events.json`, 'utf8')).compiled, 'events/main.events.compiled.js');
assert.match(fs.readFileSync(`${out}/events/main.events.compiled.js`, 'utf8'), /sourceMappingURL=data:application\/json;base64,/);
// the source JSON of the project is untouched
assert.ok(!('compiled' in JSON.parse(fs.readFileSync(`${ROOT}/templates/es-platformer/events/main.events.json`, 'utf8'))));

const { chromium } = loadPlaywright();
const srv = await serve(out);
const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
try {
  const page = await (await browser.newContext()).newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if ((m.type() === 'error' && !/Failed to load resource/.test(m.text())) || (m.type() === 'warning' && m.text().includes('[nord]'))) errors.push(m.text()); });
  await page.goto(srv.url);
  await page.waitForFunction(() => window.__nord_ready === true, null, { timeout: 30000 });
  await page.waitForTimeout(800);
  const r = await page.evaluate(() => { const s = __nord.scene.eventSheet, h = __nord.scene.find('Hero'); return { aot: Object.keys(s.aot ?? {}).length, floor: h.behavior('Platform').onFloor, hud: __nord.scene.find('Hud').getComponent('text').data.text }; });
  assert.ok(r.aot > 10, `compiled expressions in use (${r.aot})`);
  assert.ok(r.floor, 'hero stands on the ground'); assert.match(r.hud, /Coins 0\s+Lives 3/, `HUD text from compiled expressions: ${r.hud}`);
  assert.deepEqual(errors, []);
  console.log('compiled export OK');
} finally { await browser.close(); srv.close(); }
