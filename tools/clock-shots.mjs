#!/usr/bin/env node
// Takes the two screenshots of Examples page 3.5 (docs/screenshots/ex-clock-result.png and ex-clock-parts.png) from examples/clock with a fixed time of 10:09:36.
// Needs Playwright (see docs/TESTING.md). usage: node tools/clock-shots.mjs
import { serve, loadPlaywright, ROOT } from './e2e-lib.mjs';

const { chromium } = loadPlaywright();
const server = await serve(`${ROOT}/examples/clock`);
const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await (await browser.newContext({ viewport: { width: 600, height: 600 } })).newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push(m.text()); });
await page.addInitScript(() => {                         // a clock that always says 10:09:36, the classic photo time
  const fixed = new Date(2026, 0, 1, 10, 9, 36, 0).getTime(), RealDate = Date;
  globalThis.Date = class extends RealDate { constructor(...a) { super(...(a.length ? a : [fixed])); } static now() { return fixed; } };
});
await page.goto(server.url + '/');
await page.waitForFunction(() => window.__nord_ready === true || window.__nord_error, null, { timeout: 30000 });
await page.waitForTimeout(1500);
await page.screenshot({ path: `${ROOT}/docs/screenshots/ex-clock-result.png` });
await page.evaluate(() => { const s = window.__nord.scene; for (const n of ['Hours Arm Pivot', 'Minutes Arm Pivot', 'Seconds Arm Pivot']) s.find(n).enabled = false; });
await page.waitForTimeout(700);
await page.screenshot({ path: `${ROOT}/docs/screenshots/ex-clock-parts.png` });
await browser.close(); server.close();
if (errors.length) { console.log('errors:\n' + [...new Set(errors)].join('\n')); process.exit(1); }
console.log('ok   wrote ex-clock-result.png and ex-clock-parts.png');
