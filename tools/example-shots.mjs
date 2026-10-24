#!/usr/bin/env node
// Screenshots of examples/coin-dash for the Examples pages (docs/screenshots/ex-coin-dash-*.png), headless Chromium-family browser over CDP.
// Needs `nord serve examples/coin-dash -p 4194`, Node 22. NORD_BROWSER=/path/to/browser
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { ROOT } from './e2e-lib.mjs';

const BASE = process.env.NORD_SERVE ?? 'http://localhost:4194';
const exe = process.env.NORD_BROWSER ?? ['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/Applications/Brave Browser.app/Contents/MacOS/Brave Browser', '/usr/bin/chromium'].find((p) => fs.existsSync(p));
const port = 9334;
const proc = spawn(exe, [`--remote-debugging-port=${port}`, `--user-data-dir=${fs.mkdtempSync(path.join(os.tmpdir(), 'nordshot-'))}`, '--headless=new', '--window-size=1000,620', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', 'about:blank'], { stdio: 'ignore' });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let targets; for (let i = 0; i < 50 && !targets; i++) { await sleep(200); try { targets = await (await fetch(`http://127.0.0.1:${port}/json`)).json(); } catch { /* retry */ } }
const ws = new WebSocket(targets.find((t) => t.type === 'page').webSocketDebuggerUrl); await new Promise((r) => (ws.onopen = r));
let id = 0; const pending = new Map(); ws.onmessage = (m) => { const d = JSON.parse(m.data); pending.get(d.id)?.(d); };
const cdp = (method, params = {}) => new Promise((res) => { const i = ++id; pending.set(i, res); ws.send(JSON.stringify({ id: i, method, params })); });
const ev = async (js) => (await cdp('Runtime.evaluate', { expression: js, awaitPromise: true, returnByValue: true })).result?.result?.value;
await cdp('Emulation.setDeviceMetricsOverride', { width: 1000, height: 620, deviceScaleFactor: 1, mobile: false });
const shot = async (name) => { await sleep(400); const r = await cdp('Page.captureScreenshot', { format: 'png' }); fs.writeFileSync(path.join(ROOT, 'docs/screenshots', `ex-coin-dash-${name}.png`), Buffer.from(r.result.data, 'base64')); console.log(name); };

await cdp('Page.navigate', { url: BASE + '/' }); await sleep(3500);
// run the game at 6x speed for a moment so coins and enemies exist, keep the player away from enemies
await ev(`(async()=>{const g=window.__nord;g.timeScale=1;const gm=[...g.scene.all()].find(e=>e.name==='GameManager').scripts[0];for(let i=0;i<8;i++){await g.scene.spawn('prefabs/coin.prefab.json',{pos:[120+i*95,120+(i%3)*110,1]});}await g.scene.spawn('prefabs/enemy.prefab.json',{pos:[820,420,2]});await g.scene.spawn('prefabs/enemy.prefab.json',{pos:[150,430,2]});const c=g.scene.findByTag('coin')[0];g.scene.find('Player').pos=[c.pos[0]+4,c.pos[1],5];await new Promise(r=>setTimeout(r,400));gm.AddScore(4);})()`);
await sleep(300); await shot('play');
await ev(`(()=>{const g=window.__nord;const gm=[...g.scene.all()].find(e=>e.name==='GameManager').scripts[0];gm.AddScore(6);gm.SetLives(0);})()`);
await sleep(600); await shot('over');
ws.close(); proc.kill();
