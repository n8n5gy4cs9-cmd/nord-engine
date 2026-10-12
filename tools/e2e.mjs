// Headless-Chromium end-to-end checks. Usage: node tools/e2e.mjs [phaser|babylon…]
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire('/node-tools/'); const { chromium } = require('playwright');
const root = path.resolve(import.meta.dirname, '..');
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.png': 'image/png' };
const server = http.createServer((req, res) => {
  const f = path.join(root, decodeURIComponent(new URL(req.url, 'http://x').pathname));
  if (!f.startsWith(root) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404).end(); return; }
  res.writeHead(200, { 'content-type': mime[path.extname(f)] ?? 'application/octet-stream' }).end(fs.readFileSync(f));
}).listen(0);
const base = `http://127.0.0.1:${server.address().port}`;
const suites = {
  async phaser(page) {
    await page.goto(`${base}/tests/e2e/phaser/index.html`);
    await page.waitForFunction(() => window.__ready, null, { timeout: 15000 });
    await page.waitForTimeout(600);
    const r = await page.evaluate(() => { const s = window.__game.scene; const h = s.find('Hero'); return { n: [...s.all()].length, x: h.pos[0], cx: h.native.x, kids: h.native.list.length, hasCanvas: !!document.querySelector('canvas') }; });
    ok(r.n === 4 && r.hasCanvas, `entities+canvas ${JSON.stringify(r)}`);
    ok(r.x > 100 && r.cx === r.x, 'script moved hero and native synced');
    ok(r.kids === 1, 'hero has sprite child');
    await page.screenshot({ path: path.join(process.env.E2E_OUT ?? '/tmp', 'e2e-phaser.png') });
  },
};
let failed = 0; const ok = (c, m) => { console.log(`${c ? 'ok  ' : 'FAIL'} ${m}`); if (!c) failed++; };
const want = process.argv.slice(2); const run = want.length ? want : Object.keys(suites);
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM ?? undefined });
for (const name of run) {
  const page = await browser.newPage(); const errs = [];
  page.on('response', (r) => r.status() === 404 && errs.push('404 ' + r.url())); page.on('console', (m) => m.type() === 'error' && errs.push(m.text())); page.on('pageerror', (e) => errs.push(e.message));
  try { await suites[name](page); } catch (e) { ok(false, `${name}: ${e.message}`); }
  ok(errs.length === 0, `${name}: no console errors ${errs.join(' | ')}`);
}
await browser.close(); server.close(); process.exit(failed ? 1 : 0);
