// `nord build` outputs run offline in headless Chromium: folder builds from a STRICT static server (only dist/ — no engine fallbacks),
// single-file builds straight from file://. Needs `cargo build -p nord-cli`.
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { execFileSync, spawn } from 'node:child_process';
import { suites, loadPlaywright, waitReady, nonBlank, ROOT } from '../e2e-lib.mjs';

const MIME = { html: 'text/html', js: 'text/javascript', json: 'application/json', png: 'image/png', wav: 'audio/wav', mp3: 'audio/mpeg', wasm: 'application/wasm', glb: 'model/gltf-binary', woff2: 'font/woff2' };
const NORD = `${ROOT}/target/debug/nord`;
fs.mkdirSync(`${ROOT}/target/e2e`, { recursive: true });

function build(example, name, flags) {
  const out = `${ROOT}/target/e2e/export-${name}`;
  fs.rmSync(out, { recursive: true, force: true });
  const log = execFileSync(NORD, ['build', `${ROOT}/examples/${example}`, '-o', out, ...flags], { encoding: 'utf8', env: { ...process.env, NORD_ROOT: ROOT } });
  console.log(log.split('\n').slice(0, 2).join(' | '));
  return out;
}

function strictServer(dir) {
  const srv = http.createServer((req, res) => {
    const u = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    let p = path.join(dir, u);
    if (u.split('/').includes('..') || !p.startsWith(dir)) { res.writeHead(400).end(); return; }
    if (fs.existsSync(p) && fs.statSync(p).isDirectory()) p = path.join(p, 'index.html');
    if (!fs.existsSync(p)) { res.writeHead(404).end('not found'); return; }
    res.writeHead(200, { 'content-type': MIME[path.extname(p).slice(1)] ?? 'application/octet-stream' });
    fs.createReadStream(p).pipe(res);
  });
  return new Promise((ok) => srv.listen(0, '127.0.0.1', () => ok({ url: `http://127.0.0.1:${srv.address().port}/`, close: () => srv.close() })));
}

async function open(dir, fileUrl, fn) {
  const { chromium } = loadPlaywright();
  const server = fileUrl ? null : await strictServer(dir);
  const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
  const errors = [];
  try {
    const page = await (await browser.newContext({ viewport: { width: 640, height: 360 } })).newPage();
    page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push(`console: ${m.text()}`); });
    page.on('response', (r) => { if (r.status() >= 400 && !r.url().endsWith('.meta.json')) errors.push(`HTTP ${r.status()}: ${r.url()}`); });
    page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
    await page.route('**/*', (r) => { const u = new URL(r.request().url()); return ['127.0.0.1', ''].includes(u.hostname) || u.protocol === 'data:' ? r.continue() : (errors.push(`external request: ${r.request().url()}`), r.abort()); });
    await page.goto(fileUrl ? `file://${dir}/index.html` : server.url);
    const result = await fn(page);
    return { errors, result };
  } finally { await browser.close(); server?.close(); }
}

const check2d = (name, flags, fileUrl) => async () => {
  const dir = build('conformance-2d', name, flags);
  const { errors, result } = await open(dir, fileUrl, async (page) => {
    await waitReady(page);
    if (await page.evaluate(() => window.__nord_error)) throw new Error(await page.evaluate(() => window.__nord_error));
    await page.waitForTimeout(1500);
    const info = await page.evaluate(() => { const g = window.__nord, h = g.scene.find('Hero'); return { grounded: g.physics.isGrounded(h), errs: g.errors.length, x: h.pos[0] }; });
    await page.keyboard.down('KeyD'); await page.waitForTimeout(600); await page.keyboard.up('KeyD');
    const x2 = await page.evaluate(() => window.__nord.scene.find('Hero').pos[0]);
    const fonts = await page.evaluate(async () => { await document.fonts.ready; return [...document.fonts].filter((f) => f.status === 'loaded').map((f) => f.family.replace(/"/g, '')); });
    const shot = await page.screenshot({ path: `${dir}.png` });
    return { info, moved: x2 - info.x, fonts, colors: await nonBlank(page, shot) };
  });
  console.log(JSON.stringify(result));
  if (errors.length) throw new Error(errors.join('\n'));
  if (!result.info.grounded || result.info.errs) throw new Error('2d export: hero not grounded or script errors');
  if (result.moved < 20) throw new Error('2d export: input does not move the hero');
  if (!result.fonts.includes('Plus Jakarta Sans')) throw new Error(`skin font not loaded: ${result.fonts}`);
  if (result.colors < 12) throw new Error('2d export: canvas looks blank');
};

const check3d = (name, flags, fileUrl) => async () => {
  const dir = build('conformance-3d', name, flags);
  const { errors, result } = await open(dir, fileUrl, async (page) => {
    await waitReady(page, 40000);
    const err = await page.evaluate(() => window.__nord_error);
    if (err) throw new Error(err);
    await page.waitForTimeout(6000);
    const info = await page.evaluate(() => { const g = window.__nord, b = g.scene.find('Ball'); return { y: +b.pos[1].toFixed(2), grounded: g.physics.isGrounded(b), errs: g.errors.length }; });
    const shot = await page.screenshot({ path: `${dir}.png` });
    return { info, colors: await nonBlank(page, shot) };
  });
  console.log(JSON.stringify(result));
  if (errors.length) throw new Error(errors.join('\n'));
  if (result.info.errs) throw new Error('3d export: script errors');
  if (result.info.y > 1.2 || result.info.y < 0.2) throw new Error('3d export: ball did not land (Havok not working?)');
  if (result.colors < 15) throw new Error('3d export: canvas looks blank');
};

suites['export-web-2d'] = check2d('web-2d', []);
suites['export-web-3d'] = check3d('web-3d', []);
suites['export-web-2d-min'] = check2d('web-2d-min', ['--minify', '--optimize']);
suites['export-single-2d'] = check2d('single-2d', ['--single-file', '--minify'], true);
suites['export-single-3d'] = check3d('single-3d', ['--single-file'], true);

// docs/HOSTING.md: the 3D build (ES modules + Havok .wasm) must work from plain `python3 -m http.server`
suites['export-python-http'] = async () => {
  const dir = build('conformance-3d', 'pyhttp', ['--minify']);
  const port = 18000 + Math.floor(Math.random() * 2000);
  const py = spawn('python3', ['-m', 'http.server', String(port), '--bind', '127.0.0.1', '--directory', dir], { stdio: 'ignore' });
  try {
    await new Promise((r) => setTimeout(r, 800));
    const { chromium } = loadPlaywright();
    const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
    const errors = [];
    try {
      const page = await (await browser.newContext({ viewport: { width: 480, height: 270 } })).newPage();
      page.on('pageerror', (e) => errors.push(e.message));
      page.on('response', (r) => { if (r.status() >= 400 && !r.url().endsWith('.meta.json')) errors.push(`HTTP ${r.status()} ${r.url()}`); });
      await page.goto(`http://127.0.0.1:${port}/`);
      await waitReady(page, 40000);
      const err = await page.evaluate(() => window.__nord_error);
      if (err) throw new Error(err);
    } finally { await browser.close(); }
    if (errors.length) throw new Error(errors.join('\n'));
  } finally { py.kill(); }
};
