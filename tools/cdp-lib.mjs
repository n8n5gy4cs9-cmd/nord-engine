// Tiny headless-browser driver over the Chrome DevTools protocol (no Playwright): launch(), page.eval(js), page.shot(file).
// Needs a Chromium-family browser (NORD_BROWSER=/path/to/browser or one of the usual paths) and Node 22 (global WebSocket / fetch).
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export async function launch({ width = 1000, height = 620, port = 9335 } = {}) {
  const exe = process.env.NORD_BROWSER ?? ['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/Applications/Brave Browser.app/Contents/MacOS/Brave Browser', '/usr/bin/chromium', '/usr/bin/google-chrome'].find((p) => fs.existsSync(p));
  if (!exe) throw new Error('no browser found: set NORD_BROWSER');
  const proc = spawn(exe, [`--remote-debugging-port=${port}`, `--user-data-dir=${fs.mkdtempSync(path.join(os.tmpdir(), 'nordcdp-'))}`, '--headless=new', `--window-size=${width},${height}`, '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', 'about:blank'], { stdio: 'ignore' });
  let targets; for (let i = 0; i < 60 && !targets; i++) { await sleep(200); try { targets = await (await fetch(`http://127.0.0.1:${port}/json`)).json(); } catch { /* retry */ } }
  const ws = new WebSocket(targets.find((t) => t.type === 'page').webSocketDebuggerUrl); await new Promise((r) => (ws.onopen = r));
  let id = 0; const pending = new Map(); ws.onmessage = (m) => { const d = JSON.parse(m.data); pending.get(d.id)?.(d); };
  const cdp = (method, params = {}) => new Promise((res) => { const i = ++id; pending.set(i, res); ws.send(JSON.stringify({ id: i, method, params })); });
  await cdp('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false });
  return {
    cdp,
    goto: async (url, wait = 3000) => { await cdp('Page.navigate', { url }); await sleep(wait); },
    eval: async (js) => { const r = await cdp('Runtime.evaluate', { expression: js, awaitPromise: true, returnByValue: true }); if (r.result?.exceptionDetails) throw new Error(r.result.exceptionDetails.exception?.description ?? 'eval failed'); return r.result?.result?.value; },
    shot: async (file) => { await sleep(300); const r = await cdp('Page.captureScreenshot', { format: 'png' }); fs.writeFileSync(file, Buffer.from(r.result.data, 'base64')); },
    key: (code, down) => cdp('Input.dispatchKeyEvent', { type: down ? 'keyDown' : 'keyUp', code, key: code.replace('Key', '').toLowerCase(), windowsVirtualKeyCode: 0 }),
    close: () => { ws.close(); proc.kill(); },
  };
}
