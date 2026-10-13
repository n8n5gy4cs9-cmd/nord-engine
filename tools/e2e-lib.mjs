// Playwright e2e harness (headless Chromium). Serves a project dir at `/` plus `/vendor` and `/runtime` from the engine root
// (same mapping as `nord serve`), loads the page, asserts no console errors, optionally screenshots.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MIME = { html: 'text/html', js: 'text/javascript', mjs: 'text/javascript', json: 'application/json', png: 'image/png', wav: 'audio/wav', mp3: 'audio/mpeg', css: 'text/css', wasm: 'application/wasm', glb: 'model/gltf-binary', ttf: 'font/ttf', otf: 'font/otf', svg: 'image/svg+xml' };

export function loadPlaywright() {
  for (const base of [ROOT, process.env.NODE_PATH, '/opt/node22/lib/node_modules', '/opt/node-tools/node_modules'].filter(Boolean)) {
    try { return createRequire(path.join(base, 'x.js'))('playwright'); } catch { /* try next */ }
  }
  throw new Error('playwright not found (npm i -g playwright)');
}

/** Static server. `project` = dir served at `/`; /vendor and /runtime come from the engine. Returns { url, close }. */
export function serve(project, port = 0) {
  const srv = http.createServer((req, res) => {
    const u = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    if (u.split('/').includes('..')) { res.writeHead(400).end(); return; }
    const base = u.startsWith('/vendor/') || u.startsWith('/runtime/') || u.startsWith('/assets/') && !fs.existsSync(path.join(project, u)) ? ROOT : project;
    let p = path.join(base, u);
    if (fs.existsSync(p) && fs.statSync(p).isDirectory()) p = path.join(p, 'index.html');
    if (!fs.existsSync(p)) { res.writeHead(404).end('not found'); return; }
    res.writeHead(200, { 'content-type': MIME[path.extname(p).slice(1)] ?? 'application/octet-stream', 'cache-control': 'no-store' });
    fs.createReadStream(p).pipe(res);
  });
  return new Promise((ok) => srv.listen(port, '127.0.0.1', () => ok({ url: `http://127.0.0.1:${srv.address().port}`, close: () => srv.close() })));
}

/**
 * Open `page` of a served project, collect console errors/page errors, run `fn(page, ctx)`. Non-localhost requests are blocked
 * (offline guarantee) and counted as errors. Returns { errors, result }.
 */
export async function withPage(project, fn, { path: pagePath = '/', viewport = { width: 960, height: 540 }, contextOptions = {} } = {}) {
  const { chromium } = loadPlaywright();
  const server = await serve(project);
  const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
  const errors = [];
  try {
    const page = await (await browser.newContext({ viewport, ...contextOptions })).newPage();
    page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push(`console: ${m.text()}`); });
    page.on('response', (r) => { if (r.status() >= 400 && !r.url().endsWith('.meta.json')) errors.push(`HTTP ${r.status()}: ${r.url()}`); });
    page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
    await page.route('**/*', (r) => (new URL(r.request().url()).hostname === '127.0.0.1' ? r.continue() : (errors.push(`external request blocked: ${r.request().url()}`), r.abort())));
    await page.goto(server.url + pagePath);
    const result = await fn(page, { url: server.url, errors });
    return { errors, result };
  } finally { await browser.close(); server.close(); }
}

/** Wait until the page sets `window.__nord_ready` (runtime booted + first scene built). */
export const waitReady = (page, timeout = 20000) => page.waitForFunction(() => window.__nord_ready === true || window.__nord_error, null, { timeout });

/** Count non-background pixels of a screenshot buffer region via an in-page canvas (cheap blank-canvas detector). */
export async function nonBlank(page, buf) {
  return page.evaluate(async (b64) => {
    const img = new Image(); img.src = `data:image/png;base64,${b64}`; await img.decode();
    const c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
    const g = c.getContext('2d'); g.drawImage(img, 0, 0);
    const d = g.getImageData(0, 0, c.width, c.height).data;
    const seen = new Set();
    for (let i = 0; i < d.length; i += 4 * 17) seen.add((d[i] >> 4) << 8 | (d[i + 1] >> 4) << 4 | d[i + 2] >> 4);
    return seen.size;
  }, buf.toString('base64'));
}

export const suites = {};
