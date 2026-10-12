// Example desktop apps: code editor (browser fallback transport) and web server app (real `nord serve` bridge, real HTTP server).
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import net from 'node:net';
import { spawn } from 'node:child_process';
import { suites, withPage, ROOT, loadPlaywright } from '../e2e-lib.mjs';

const NORD = `${ROOT}/target/debug/nord`;
const freePort = () => new Promise((ok) => { const s = net.createServer().listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => ok(p)); }); });

suites['desktop-app-code-editor'] = async () => {
  const { errors } = await withPage(`${ROOT}/examples/app-code-editor`, async (page) => {
    await page.waitForSelector('.cm-editor');
    const q = (s) => page.evaluate((s) => document.querySelector(s)?.textContent ?? '', s);
    assert.match(await q('.ce .tabs'), /welcome\.md/);
    // syntax highlighting: a JS file gets coloured token spans
    await page.evaluate(async () => { await window.nord.desktop.fs.writeText('app.js', 'const a = 1; // hi\nfunction f(x) { return `t${x}`; }\n'); });
    await page.click('.ce .it >> text=Refresh', { timeout: 1000 }).catch(() => { });
    await page.evaluate(() => [...document.querySelectorAll('.ce .acts button')].find((b) => b.title === 'Refresh')?.click());
    await page.waitForSelector('.ce .tree >> text=app.js');
    await page.click('.ce .tree >> text=app.js');
    await page.waitForSelector('.ce .tab.on:has-text("app.js")');
    const spans = await page.evaluate(() => new Set([...document.querySelectorAll('.cm-line span[class]')].map((s) => getComputedStyle(s).color)).size);
    assert.ok(spans >= 3, `expected several token colours, got ${spans}`);
    assert.equal(await q('.ce .status'), (await q('.ce .status')), 'status renders');
    assert.match(await q('.ce .status'), /JavaScript/);
    // typing → dirty dot → Ctrl+S saves through the desktop API
    await page.click('.cm-content'); await page.keyboard.press('Control+End'); await page.keyboard.type('\nlet z = 2;');
    assert.ok(await page.evaluate(() => !!document.querySelector('.ce .tab.on .dot')), 'dirty marker');
    await page.keyboard.press('Control+s'); await page.waitForTimeout(300);
    assert.match(await page.evaluate(() => window.nord.desktop.fs.readText('app.js')), /let z = 2;/);
    assert.ok(await page.evaluate(() => !document.querySelector('.ce .tab.on .dot')), 'clean after save');
    // multi-cursor: select word + Ctrl+D selects next occurrence
    await page.keyboard.press('Control+Home'); await page.keyboard.press('Control+f'); await page.waitForSelector('.cm-search'); await page.keyboard.press('Escape');
    // go to line
    await page.keyboard.press('Control+g'); await page.fill('.ce .modal input', '2'); await page.keyboard.press('Enter');
    assert.match(await q('.ce .status'), /Ln 2,/);
    // quick open (fuzzy)
    await page.keyboard.press('Control+p'); await page.fill('.ce .modal input', 'wlc'); assert.match(await q('.ce .modal .lst'), /welcome\.md/); await page.keyboard.press('Enter');
    await page.waitForSelector('.ce .tab.on:has-text("welcome.md")');
    // JSON formatting + highlighting + folding gutter
    await page.evaluate(async () => { await window.nord.desktop.fs.writeText('d.json', '{"a":[1,2,{"b":null}],"c":true}'); });
    await page.evaluate(() => [...document.querySelectorAll('.ce .acts button')].find((b) => b.title === 'Refresh')?.click());
    await page.click('.ce .tree >> text=d.json'); await page.click('.ce .bar >> text=Format JSON');
    assert.ok((await page.evaluate(() => document.querySelectorAll('.cm-line').length)) > 5, 'pretty-printed');
    // theme toggle
    await page.click('.ce .bar button[title="Toggle theme"]');
    assert.equal(await page.evaluate(() => document.querySelector('.ce').dataset.theme), 'light');
    // session restore: reload keeps tabs
    await page.reload(); await page.waitForSelector('.ce .tab');
    await page.waitForTimeout(800); const tl = await page.evaluate(() => [...document.querySelectorAll('.ce .tab')].map((t) => t.textContent)); assert.ok(tl.length >= 3, 'tabs restored: ' + tl);
  }, { viewport: { width: 1100, height: 700 } });
  assert.deepEqual(errors.filter((e) => !/desktop\/events/.test(e)), []);
};

suites['desktop-app-web-server'] = async () => {
  if (!fs.existsSync(NORD)) throw new Error('build first: cargo build -p nord-cli');
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'nord-ws-data-')), port = await freePort();
  // headless dialogs can't answer the first-use prompt, so run a copy whose manifest turns prompts off
  const app = fs.mkdtempSync(path.join(os.tmpdir(), 'nord-ws-app-')); fs.cpSync(`${ROOT}/examples/app-web-server`, app, { recursive: true });
  const pj = JSON.parse(fs.readFileSync(`${app}/nord.project.json`, 'utf8')); pj.desktop.permissions.prompt = false; fs.writeFileSync(`${app}/nord.project.json`, JSON.stringify(pj));
  const proc = spawn(NORD, ['serve', app, '--port', String(port)], { env: { ...process.env, NORD_ROOT: ROOT, NORD_DESKTOP_BASE: base }, stdio: 'ignore' });
  try {
    for (let i = 0; i < 50; i++) { try { await fetch(`http://127.0.0.1:${port}/api/project`); break; } catch { await new Promise((r) => setTimeout(r, 100)); } }
    const { chromium } = loadPlaywright(); const b = await chromium.launch(); const errors = [];
    try {
      const page = await b.newPage({ viewport: { width: 1000, height: 800 } }); page.on('pageerror', (e) => errors.push(e.message));
      await page.goto(`http://127.0.0.1:${port}/`); await page.waitForSelector('.ws');
      // prepare a site inside the app's data folder and point the app at it (dialogs are headless in this mode)
      await page.evaluate(async () => { const D = window.nord.desktop; await D.fs.writeText('www/index.html', '<html><body><h1>served!</h1></body></html>'); await D.fs.writeText('www/a.txt', 'A'); await D.store.set('cfg', { folder: 'appData:www', auto: true, liveReload: true, listing: true, cors: true }); });
      await page.reload(); await page.waitForSelector('.ws');
      assert.equal(await page.evaluate(() => window.nord.desktop.transport), 'http');
      await page.click('.ws button:has-text("Start")'); await page.waitForSelector('.ws .url');
      const url = await page.textContent('.ws .url');
      const r1 = await (await fetch(url)).text(); assert.match(r1, /served!/); assert.match(r1, /EventSource/, 'live reload injected');
      assert.equal((await fetch(url + 'nope')).status, 404);
      assert.equal((await fetch(url + 'a.txt')).headers.get('access-control-allow-origin'), '*');
      assert.equal((await fetch(url + '../../etc/passwd')).status >= 400, true);
      await page.waitForFunction(() => document.querySelectorAll('.ws .log tr').length >= 4, null, { timeout: 5000 });
      const rows = await page.evaluate(() => [...document.querySelectorAll('.ws .log tr')].map((r) => r.textContent));
      assert.ok(rows.some((r) => r.includes('/nope') && r.includes('404')), rows.join('|'));
      await page.selectOption('.ws select', '4'); assert.ok((await page.evaluate(() => document.querySelectorAll('.ws .log tr').length)) >= 2);
      await page.click('.ws button:has-text("Stop")');
      await page.waitForTimeout(300);
      await fetch(url).then(() => assert.fail('server should be stopped'), () => { });
    } finally { await b.close(); }
    assert.deepEqual(errors, []);
  } finally { proc.kill(); }
};

suites['desktop-apps-notes-markdown'] = async () => {
  const { errors } = await withPage(`${ROOT}/examples/app-desktop-notes`, async (page) => {
    await page.waitForSelector('.dn textarea');
    await page.fill('.dn textarea', '# Shopping\n\nmilk, eggs'); await page.waitForTimeout(900);
    assert.match(await page.evaluate(() => window.nord.desktop.fs.readText(`notes/${[...document.querySelectorAll('.dn .it')][0].dataset.id}.md`)), /milk, eggs/);
    await page.click('.dn button:has-text("New note")'); await page.waitForTimeout(200);
    assert.equal(await page.locator('.dn .it').count(), 2);
    await page.fill('.dn aside input', 'shopping'); assert.equal(await page.locator('.dn .it').count(), 1);
    await page.evaluate(() => { window.nord.desktop.dialog.confirm = async () => true; }); // headless confirm
    await page.selectOption('.dn aside select', 'de'); await page.waitForSelector('.dn button:has-text("Neue Notiz")');
  }, { viewport: { width: 1000, height: 650 } });
  assert.deepEqual(errors.filter((e) => !/desktop\/events/.test(e)), []);
  const r2 = await withPage(`${ROOT}/examples/app-markdown-editor`, async (page) => {
    await page.waitForSelector('.me .cm-editor'); await page.waitForSelector('.me .pv h1');
    assert.match(await page.textContent('.me .pv h1'), /Hello/);
    await page.click('.me .cm-content'); await page.keyboard.press('Control+End'); await page.keyboard.type('\n\n<script>window.pwned=1</script><img src=x onerror="window.pwned=2"> **bold**');
    await page.waitForTimeout(200);
    assert.equal(await page.evaluate(() => window.pwned), undefined, 'preview is sanitised');
    assert.ok(await page.evaluate(() => !!document.querySelector('.me .pv strong')));
    assert.match(await page.textContent('.me .st'), /words/);
  }, { viewport: { width: 1100, height: 700 } });
  assert.deepEqual(r2.errors.filter((e) => !/desktop\/events|HTTP 404/.test(e)), []); // 404s = the test's own <img src=x> probes
};

suites['desktop-apps-load'] = async () => {
  for (const id of ['app-file-organizer', 'app-clipboard-manager']) {
    const { errors } = await withPage(`${ROOT}/examples/${id}`, async (page) => { await page.waitForTimeout(1500); assert.ok(await page.evaluate(() => document.querySelector('#app').children.length > 0), id); }, { viewport: { width: 1000, height: 650 } });
    assert.deepEqual(errors.filter((e) => !/desktop\/events/.test(e)), [], id);
  }
};
