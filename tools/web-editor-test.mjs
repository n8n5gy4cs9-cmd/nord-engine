// Web editor e2e (M11-14): serves dist/web-editor (run tools/build-web-editor.sh first), creates a project in the browser,
// reloads (IndexedDB persistence), presses Play (iframe + service worker), checks the game canvas renders.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { loadPlaywright, ROOT } from './e2e-lib.mjs';

const DIST = path.join(ROOT, 'dist/web-editor');
const MIME = { html: 'text/html', js: 'text/javascript', mjs: 'text/javascript', json: 'application/json', png: 'image/png', wasm: 'application/wasm', css: 'text/css', webmanifest: 'application/manifest+json', glb: 'model/gltf-binary', wav: 'audio/wav', mp3: 'audio/mpeg', svg: 'image/svg+xml' };
if (!fs.existsSync(path.join(DIST, 'index.html'))) { console.log('SKIP: dist/web-editor not built (tools/build-web-editor.sh)'); process.exit(0); }

const srv = http.createServer((req, res) => {
  const u = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  let p = path.join(DIST, u);
  if (u.split('/').includes('..') || !fs.existsSync(p)) { res.writeHead(404).end('not found'); return; }
  if (fs.statSync(p).isDirectory()) p = path.join(p, 'index.html');
  res.writeHead(200, { 'content-type': MIME[path.extname(p).slice(1)] ?? 'application/octet-stream', 'cache-control': 'no-cache' });
  fs.createReadStream(p).pipe(res);
});
await new Promise((ok) => srv.listen(0, '127.0.0.1', ok));
const base = `http://127.0.0.1:${srv.address().port}/`;

const { chromium } = loadPlaywright();
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const ctx = await browser.newContext({ viewport: { width: 800, height: 800 } });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
page.on('response', (r) => { if (process.env.NORD_DEBUG && /editor|engine|play/.test(r.url())) console.log('  ~', r.status(), r.url(), r.fromServiceWorker() ? '(sw)' : ''); if (r.status() >= 400) errors.push(`${r.status()} ${r.url()}`); });
let ok = true;
const check = (name, cond, extra = '') => { console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${extra ? '  ' + extra : ''}`); if (!cond) ok = false; };

try {
  await page.goto(base);
  await page.waitForFunction(() => !document.getElementById('msg') || document.getElementById('msg').textContent.includes('could not'), null, { timeout: 60000 });
  const m = await page.evaluate(() => document.getElementById('msg')?.textContent);
  if (m) throw new Error(m);
  await page.waitForTimeout(1500);
  check('editor starts (hub canvas)', true);
  check('service worker controls the page', await page.evaluate(() => !!navigator.serviceWorker.controller));
  await page.screenshot({ path: path.join(ROOT, 'dist/web-editor-hub.png') });
  await page.mouse.move(200, 620);
  await page.waitForTimeout(300);
  await page.mouse.click(201, 623); // Create project
  await page.waitForTimeout(3000);
  const keys = async () => page.evaluate(() => new Promise((r) => { const q = indexedDB.open('nord-editor', 1); q.onsuccess = () => { const g = q.result.transaction('files').objectStore('files').getAllKeys(); g.onsuccess = () => r(g.result); }; }));
  await page.waitForTimeout(2500);
  check('project files saved to IndexedDB', (await keys()).includes('/projects/My Game/nord.project.json'));
  await page.reload();
  await page.waitForFunction(() => !document.getElementById('msg'), null, { timeout: 60000 });
  await page.waitForTimeout(1500);
  await page.mouse.move(470, 238);
  await page.waitForTimeout(300);
  await page.mouse.click(470, 238); // open "My Game" from Recent
  await page.waitForTimeout(3000);
  await page.screenshot({ path: path.join(ROOT, 'dist/web-editor-opened.png') });
  await page.mouse.move(229, 52);
  await page.waitForTimeout(200);
  await page.mouse.click(229, 52); // Play
  await page.waitForTimeout(6000);
  const game = await page.evaluate(() => { const f = document.getElementById('nord-pane-game'); return f ? { src: f.src, display: f.style.display } : null; });
  check('Play creates the game iframe', !!game, JSON.stringify(game));
  const frame = page.frames().find((f) => f.url().includes('/play/') && !f.url().includes('__edit'));
  check('game page served by the service worker', !!frame, frame?.url());
  if (frame) {
    const ready = await frame.waitForFunction(() => window.__nord_ready === true || window.__nord_error, null, { timeout: 30000 }).then((h) => h.jsonValue()).catch(() => null);
    check('game booted (no __nord_error)', ready === true, String(ready));
    const px = await frame.evaluate(() => { const c = document.querySelector('canvas'); return c ? [c.width, c.height] : null; });
    check('game canvas exists', !!px && px[0] > 0, JSON.stringify(px));
  }
  await page.screenshot({ path: path.join(ROOT, 'dist/web-editor-play.png') });
  // Stop, then export from the browser: Export… (toolbar) -> Export button; the first press loads the engine files
  await page.mouse.move(231, 52); await page.waitForTimeout(200); await page.mouse.click(231, 52); // Stop
  await page.waitForTimeout(800);
  await page.mouse.move(48, 88); await page.waitForTimeout(200); await page.mouse.click(48, 88); // Export…
  await page.waitForTimeout(1000);
  const press = async () => { await page.mouse.move(63, 496); await page.waitForTimeout(200); await page.mouse.click(63, 496); };
  await press(); // loads the engine files
  await page.waitForTimeout(8000);
  const dl = page.waitForEvent('download', { timeout: 40000 }).catch(() => null);
  await press(); // exports (inline) and downloads the zip
  const d = await dl;
  check('export downloads a zip', !!d, d?.suggestedFilename());
  if (d) {
    const f = path.join(ROOT, 'dist/web-editor-export.zip');
    await d.saveAs(f);
    const size = fs.statSync(f).size;
    check('exported zip is not empty', size > 1000, `${size} bytes`);
  }
  await page.screenshot({ path: path.join(ROOT, 'dist/web-editor-export.png') });

} catch (e) { console.log('FAIL  exception', e.message); ok = false; }
if (errors.length) console.log('console errors:\n  ' + [...new Set(errors)].slice(0, 10).join('\n  '));
await browser.close(); srv.close();
process.exit(ok ? 0 : 1);
