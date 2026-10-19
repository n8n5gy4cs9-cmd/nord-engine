#!/usr/bin/env node
// Two browser pages play together over WebRTC through the dev server's signalling relay. Needs Playwright + Chromium.
import assert from 'node:assert/strict';
import { loadPlaywright, serve, ROOT } from './e2e-lib.mjs';

const { chromium } = loadPlaywright();
const srv = await serve(`${ROOT}/templates/es-multiplayer`);
// e2e-lib's static server has no /__signal relay: provide a tiny in-memory one on the same origin by routing
const rooms = new Map();
const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
try {
  const ctx = await browser.newContext({ viewport: { width: 960, height: 540 } });
  const errors = [];
  const open = async () => {
    const page = await ctx.newPage();
    page.on('pageerror', (e) => errors.push(e.message));
    await page.addInitScript(() => {
      // relay implemented in-page via BroadcastChannel (same browser context) — stands in for the server's /__signal endpoints
      const bc = new BroadcastChannel('nord-signal-test');
      window.EventSource = class { constructor() { this.h = (e) => this.onmessage?.({ data: e.data }); bc.addEventListener('message', this.h); } close() { bc.removeEventListener('message', this.h); } };
      const f = window.fetch.bind(window);
      window.fetch = (u, o) => (String(u).startsWith('/__signal/') ? (bc.postMessage(o.body), Promise.resolve(new Response(null, { status: 204 }))) : f(u, o));
    });
    await page.goto(srv.url);
    await page.waitForFunction(() => window.__nord_ready === true, null, { timeout: 30000 });
    return page;
  };
  const a = await open(), b = await open();
  // the real relay is covered by the Rust test; here the WebRTC + event-sheet part
  await a.evaluate(() => __nord.net.host('t1'));
  await b.evaluate(() => __nord.net.join('t1', 15000));
  assert.ok(await a.evaluate(() => __nord.net.isHost && __nord.net.peers.length === 1), 'host sees the guest');
  assert.ok(await b.evaluate(() => !__nord.net.isHost && __nord.net.peers.length === 1), 'guest connected');
  await a.evaluate(() => { __nord.scene.find('Me').pos = [111, 222, 5]; });
  await b.waitForFunction(() => Math.abs(__nord.scene.find('Other').pos[0] - 111) < 1 && Math.abs(__nord.scene.find('Other').pos[1] - 222) < 1, null, { timeout: 5000 });
  await b.evaluate(() => { __nord.scene.find('Me').pos = [333, 100, 5]; });
  await a.waitForFunction(() => Math.abs(__nord.scene.find('Other').pos[0] - 333) < 1, null, { timeout: 5000 });
  await a.screenshot({ path: `${ROOT}/target/multiplayer-host.png` });
  await b.evaluate(() => __nord.net.leave());
  await a.waitForFunction(() => __nord.net.peers.length === 0, null, { timeout: 5000 });
  assert.deepEqual(errors, []);
  console.log('multiplayer OK');
} finally { await browser.close(); srv.close(); }
