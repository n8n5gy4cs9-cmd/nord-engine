#!/usr/bin/env node
// Builds examples/event-sheets with `nord build --pwa`, loads it in Chromium, waits for the service worker, goes offline and reloads.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import { loadPlaywright, serve, ROOT } from './e2e-lib.mjs';

const out = `${ROOT}/target/pwa-test`;
fs.rmSync(out, { recursive: true, force: true });
execFileSync('cargo', ['run', '-q', '-p', 'nord-cli', '--', 'build', `${ROOT}/examples/event-sheets`, '--out', out, '--pwa'], { stdio: 'inherit', env: { ...process.env, NORD_ROOT: ROOT } });
const { chromium } = loadPlaywright();
const srv = await serve(out);
const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
try {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await page.goto(srv.url);
  await page.waitForFunction(() => window.__nord_ready === true, null, { timeout: 30000 });
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.waitForFunction(async () => (await caches.keys()).length > 0 && (await (await caches.open((await caches.keys())[0])).keys()).length > 20, null, { timeout: 30000 });
  await ctx.setOffline(true);
  srv.close(); // the server is really gone: only the cache can answer
  await page.reload();
  await page.waitForFunction(() => window.__nord_ready === true, null, { timeout: 30000 });
  assert.ok(await page.evaluate(() => !!__nord.scene.find('Hero')), 'game runs from the service worker cache while offline');
  console.log('PWA offline reload OK');
} finally { await browser.close(); srv.close(); }
