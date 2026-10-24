#!/usr/bin/env node
// Capture the 3D Modeler manual screenshots (docs/screenshots/mod-*.png) with a headless Chromium-family browser over CDP (no Playwright needed).
// Needs: `nord serve <project that has models/bank.glb> -p 4199`, Node 22 (global WebSocket/fetch). NORD_BROWSER=/path/to/browser, NORD_SERVE=http://localhost:4199
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { ROOT } from './e2e-lib.mjs';

const BASE = process.env.NORD_SERVE ?? 'http://localhost:4199';
const OUT = path.join(ROOT, 'docs/screenshots');
const exe = process.env.NORD_BROWSER ?? ['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/Applications/Brave Browser.app/Contents/MacOS/Brave Browser', '/usr/bin/chromium'].find((p) => fs.existsSync(p));
if (!exe) throw new Error('no browser: set NORD_BROWSER');
const port = 9333;
const proc = spawn(exe, [`--remote-debugging-port=${port}`, `--user-data-dir=${fs.mkdtempSync(path.join(os.tmpdir(), 'nordshot-'))}`, '--headless=new', '--window-size=1440,860', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', 'about:blank'], { stdio: 'ignore' });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let targets;
for (let i = 0; i < 50 && !targets; i++) { await sleep(200); try { targets = await (await fetch(`http://127.0.0.1:${port}/json`)).json(); } catch { /* retry */ } }
const ws = new WebSocket(targets.find((t) => t.type === 'page').webSocketDebuggerUrl);
await new Promise((r) => (ws.onopen = r));
let id = 0; const pending = new Map();
ws.onmessage = (m) => { const d = JSON.parse(m.data); pending.get(d.id)?.(d); };
const cdp = (method, params = {}) => new Promise((res) => { const i = ++id; pending.set(i, res); ws.send(JSON.stringify({ id: i, method, params })); });
const ev = async (js) => (await cdp('Runtime.evaluate', { expression: js, awaitPromise: true, returnByValue: true })).result?.result?.value;
await cdp('Emulation.setDeviceMetricsOverride', { width: 1440, height: 860, deviceScaleFactor: 1, mobile: false });
const go = async (q = '') => { await cdp('Page.navigate', { url: `${BASE}/editor/modeler/index.html${q}` }); await sleep(2500); };
const click = (sel) => ev(`document.querySelector(${JSON.stringify(sel)}).click()`);
const shot = async (name) => { await sleep(500); const r = await cdp('Page.captureScreenshot', { format: 'png' }); fs.writeFileSync(path.join(OUT, `mod-${name}.png`), Buffer.from(r.result.data, 'base64')); console.log('mod-' + name); };
const mouse = (type, x, y) => cdp('Input.dispatchMouseEvent', { type, x, y, button: 'left', buttons: type === 'mouseReleased' ? 0 : 1, clickCount: 1 });
const stroke = async (pts) => { await mouse('mouseMoved', ...pts[0]); await mouse('mousePressed', ...pts[0]); for (const p of pts.slice(1)) await mouse('mouseMoved', ...p); await mouse('mouseReleased', ...pts.at(-1)); };

await go(); await shot('1-overview');
await click('[data-primitive=cube]'); await click('[data-action=all]'); await shot('2-cube');
await click('[data-action=extrude]'); await click('[data-action=inset]'); await shot('3-extrude');
await click('[data-view=tex]'); await click('[data-action=texnew]'); await sleep(400);
const r = JSON.parse(await ev(`JSON.stringify(document.querySelector('#texview').getBoundingClientRect())`));
await ev(`document.querySelector('#texcolor').value='#d94b3a';document.querySelector('#texcolor').dispatchEvent(new Event('input'))`);
const at = (u, v) => [r.x + r.width * u, r.y + r.height * v];
await stroke([at(.1, .2), at(.5, .3), at(.9, .2)]); await stroke([at(.1, .7), at(.5, .8), at(.9, .7)]);
await shot('4-texture');
await click('[data-view=uv]'); await shot('5-uv');
await click('[data-view=3d]'); await click('#paint3d'); await shot('6-paint-on-model');
await go('?file=models/bank.glb'); await shot('7-open-scene-model');
await go('?file=models/bank.glb&entity=abc&prefab=prefabs/bank.prefab.json'); await click('[data-action=save]'); await shot('8-save-dialog');
await go('?file=models/bank.glb&entity=abc'); await click('[data-action=save]'); await shot('9-save-dialog-plain');
ws.close(); proc.kill();
