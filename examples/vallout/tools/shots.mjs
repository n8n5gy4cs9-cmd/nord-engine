#!/usr/bin/env node
// Headless Chromium smoke test + screenshots → docs/screenshots/. usage: node tools/shots.mjs [scenario…]   (scenarios: title create classic combat modern world dialog inv)
import { createRequire } from 'node:module'; import path from 'node:path'; import fs from 'node:fs'; import { fileURLToPath } from 'node:url';
import { server } from './serve.mjs';
const require = createRequire('/opt/node-tools/node_modules/'); const { chromium } = require('playwright');
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'), OUT = path.join(ROOT, 'docs/screenshots'); fs.mkdirSync(OUT, { recursive: true });
const want = process.argv.slice(2); const on = (n) => !want.length || want.includes(n);
await new Promise((r) => server.listen(8123, r));
const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage({ viewport: { width: 960, height: 720 } }); const errors = [];
page.on('pageerror', (e) => errors.push(e.stack ?? String(e))); page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errors.push(`${m.type()}: ${m.text()}`); });
await page.goto('http://localhost:8123/game/'); await page.waitForFunction(() => window.__valout?.ready || window.__nord_error, null, { timeout: 20000 });
const wait = (ms) => page.waitForTimeout(ms), shot = async (n) => { await page.screenshot({ path: path.join(OUT, `${n}.png`) }); console.log('shot', n); };
const S = () => page.evaluate(() => window.__valout.screens), ev = (fn, arg) => page.evaluate(fn, arg);
await wait(800); if (on('title')) await shot('01-title');
await ev(() => window.__valout.screens.create()); await wait(300); if (on('create')) await shot('02-create');
await ev(() => window.__valout.screens.start()); await wait(1500);
if (on('classic')) await shot('03-classic-explore');
if (on('dialog')) { await ev(() => window.__valout.ctx.openDialog('pena')); await wait(300); await shot('04-dialog'); await ev(() => window.__valout.screens.stack.at(-1)?.close()); }
if (on('inv')) { await ev(() => window.__valout.screens.inventory()); await wait(200); await shot('05-inventory'); await ev(() => window.__valout.screens.stack.at(-1)?.close()); await ev(() => window.__valout.screens.character()); await wait(200); await shot('06-character'); await ev(() => window.__valout.screens.stack.at(-1)?.close()); }
if (on('combat')) {
  await ev(() => { const c = window.__valout.ctx, a = c.area, e = a.foes()[0]; e.x = a.player.x + 4; e.y = a.player.y; c.give('pistol', 1); c.give('ammo22', 30); c.equip('pistol'); c.G.char.weapon = 'pistol'; a.startCombat(); });
  await wait(1500); await shot('07-combat-start');
  for (let i = 0; i < 3; i++) { await ev(async () => { const a = window.__valout.ctx.area; const t = a.foes().find((f) => f.awake); if (t && a.playerTurnOn) await a.playerAttack(t); }); await wait(700); }
  await shot('08-combat-shot'); await ev(() => { const a = window.__valout.ctx.area; a.foes().forEach((f) => { f.hp = 0; a.killEnemy(f); }); }); await wait(1500);
}
if (on('modern')) {
  await ev(() => window.__valout.ctx.setMode('modern')); await ev(() => { const a = window.__valout.ctx.area; a.player.x = 12; a.player.y = 16; a.G.char.weapon = 'pistol'; }); await page.keyboard.down('KeyD'); await wait(600); await page.keyboard.up('KeyD');
  await page.mouse.move(700, 280); await page.mouse.down(); await wait(300); await page.mouse.up(); await shot('09-modern');
  await ev(() => window.__valout.ctx.setMode('classic'));
}
if (on('world')) { await ev(() => window.__valout.screens.world()); await wait(300); await shot('10-worldmap'); }
if (on('areas')) for (const id of ['keskusta', 'sampola', 'kuopat', 'joki', 'klaukkala']) { await ev((id) => window.__valout.screens.startArea(id), id); await wait(1200); await shot(`11-area-${id}`); }
console.log(errors.length ? `ERRORS:\n${errors.slice(0, 20).join('\n')}` : 'no console errors');
await browser.close(); server.close(); process.exit(errors.length ? 1 : 0);
