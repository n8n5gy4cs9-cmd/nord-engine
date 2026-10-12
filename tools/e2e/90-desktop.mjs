// window.nord.desktop in a real browser: `http` transport against the real `nord serve` bridge (Rust permissions enforced), and the
// `web` fallback transport on a plain static server. Native-shell (wry IPC) transport is macOS/Windows-only → CI/owner.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import net from 'node:net';
import { suites, withPage, ROOT, loadPlaywright } from '../e2e-lib.mjs';

const NORD = `${ROOT}/target/debug/nord`;
function project(perms) {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'nord-desk-'));
  fs.writeFileSync(`${d}/nord.project.json`, JSON.stringify({ format: 1, name: 'Desk', id: 'com.test.desk', type: 'html', engineVersion: '0.0.1', startScene: '', desktop: { permissions: perms } }));
  fs.writeFileSync(`${d}/index.html`, `<!doctype html><meta charset=utf-8><title>Desk</title><meta name=nord-app-id content=com.test.desk><script type=module>import d from '/runtime/desktop/nord-desktop.js'; await d.ready; window.D = d; window.__ready = true;</script>`);
  return d;
}
const freePort = () => new Promise((ok) => { const s = net.createServer().listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => ok(p)); }); });

/** The same script runs on every transport; `granted` says whether privileged calls should work. */
async function exercise(page, expect) {
  await page.waitForFunction(() => window.__ready, null, { timeout: 15000 });
  assert.equal(await page.evaluate(() => D.transport), expect.transport);
  const r = await page.evaluate(async () => {
    const out = {};
    await D.store.set('theme', { dark: true }); out.store = await D.store.get('theme'); out.keys = await D.store.keys(); out.fallback = await D.store.get('nope', 42);
    await D.fs.writeText('notes/a.txt', 'hello'); await D.fs.append('notes/a.txt', '!'); out.read = await D.fs.readText('notes/a.txt');
    await D.fs.writeJson('cfg.json', { a: [1, 2] }); out.json = await D.fs.readJson('cfg.json');
    await D.fs.write('bin.dat', new Uint8Array([0, 1, 2, 255])); out.bin = Array.from(await D.fs.read('bin.dat'));
    out.list = (await D.fs.list('notes')).map((e) => e.name); out.exists = [await D.fs.exists('notes/a.txt'), await D.fs.exists('nope')];
    await D.fs.rename('notes/a.txt', 'notes/b.txt'); await D.fs.copy('notes/b.txt', 'c.txt'); out.after = (await D.fs.list('')).map((e) => e.name).filter((n) => /^(c.txt|notes)$/.test(n));
    await D.fs.remove('notes', { recursive: true }); out.removed = !(await D.fs.exists('notes/b.txt'));
    const err = async (f) => { try { await f(); return 'no error'; } catch (e) { return e.code; } };
    out.traversal = await err(() => D.fs.readText('../secret')); out.abs = await err(() => D.fs.readText('/etc/passwd')); out.docs = await err(() => D.fs.readText('documents:x.txt'));
    out.missing = await err(() => D.fs.readText('does-not-exist.txt'));
    out.process = await err(() => D.process.run('ls')); out.http = await err(() => D.http.fetch('https://example.com/'));
    out.unsupportedUrl = await err(() => D.shell.openUrl('file:///etc/passwd'));
    out.confirm = await D.dialog.confirm('ok?').catch((e) => e.code);
    out.watchEvents = []; const un = await D.fs.watch('', (e) => out.watchEvents.push(e.kind + ':' + e.path), { interval: 100 });
    await D.fs.writeText('w.txt', '1'); await new Promise((r) => setTimeout(r, 600)); un();
    out.info = (await D.app.info()).id;
    return out;
  });
  assert.deepEqual(r.store, { dark: true }); assert.deepEqual(r.keys, ['theme']); assert.equal(r.fallback, 42);
  assert.equal(r.read, 'hello!'); assert.deepEqual(r.json, { a: [1, 2] }); assert.deepEqual(r.bin, [0, 1, 2, 255]);
  assert.deepEqual(r.list, ['a.txt']); assert.deepEqual(r.exists, [true, false]);
  assert.deepEqual(r.after.sort(), ['c.txt', 'notes']); assert.equal(r.removed, true);
  assert.equal(r.traversal, 'denied'); assert.equal(r.abs, 'denied'); assert.equal(r.missing, 'not_found');
  assert.equal(r.docs, expect.docs); assert.equal(r.process, expect.process); assert.equal(r.http, expect.http); assert.equal(r.unsupportedUrl, 'denied');
  assert.equal(r.info, 'com.test.desk');
  assert.ok(r.watchEvents.some((e) => e.startsWith('created:') && e.endsWith('w.txt')), `watch events ${r.watchEvents}`);
  return r;
}

suites['desktop-bridge-http'] = async () => {
  if (!fs.existsSync(NORD)) throw new Error('build first: cargo build -p nord-cli');
  const d = project({}); // default = least privilege
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'nord-desk-data-'));
  const port = await freePort();
  const proc = spawn(NORD, ['serve', d, '--port', String(port)], { env: { ...process.env, NORD_ROOT: ROOT, NORD_DESKTOP_BASE: base }, stdio: 'ignore' });
  try {
    for (let i = 0; i < 50; i++) { try { await fetch(`http://127.0.0.1:${port}/api/project`); break; } catch { await new Promise((r) => setTimeout(r, 100)); } }
    const { chromium } = loadPlaywright(); const b = await chromium.launch(); const errors = [];
    try {
      const page = await b.newPage(); page.on('pageerror', (e) => errors.push(e.message));
      await page.goto(`http://127.0.0.1:${port}/`);
      const r = await exercise(page, { transport: 'http', docs: 'denied', process: 'denied', http: 'denied' });
      assert.ok(r.confirm === false || r.confirm === 'unsupported' || typeof r.confirm === 'boolean');
      // writes landed in the redirected appData, and the audit log recorded the denials
      assert.ok(fs.existsSync(`${base}/data/com.test.desk/c.txt`));
      assert.match(fs.readFileSync(`${base}/data/com.test.desk/audit.log`, 'utf8'), /fs\.readText\tdenied/);
      // CSRF guard: the call endpoint refuses requests without the custom header
      assert.equal((await fetch(`http://127.0.0.1:${port}/__desktop/call`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{"method":"app.info"}' })).status, 403);
    } finally { await b.close(); }
    assert.deepEqual(errors, []);
  } finally { proc.kill(); }
};

suites['desktop-bridge-web'] = async () => {
  const d = project({});
  const { errors } = await withPage(d, async (page) => {
    await page.evaluate(() => { window.confirm = () => true; });
    const r = await exercise(page, { transport: 'web', docs: 'denied', process: 'unsupported', http: 'unsupported' });
    assert.equal(r.confirm, true);
  });
  assert.deepEqual(errors.filter((e) => !/desktop\/events/.test(e)), []);
};

// The real native shell (wry + tao + webkit2gtk) under Xvfb: page → window.ipc → Rust bridge → page. Needs
// `cargo build -p nord-player --features shell` and xvfb-run; skipped (passes with a note) when either is missing.
suites['desktop-player-ipc'] = async () => {
  const { execFileSync, spawnSync } = await import('node:child_process');
  const player = `${ROOT}/target/debug/nord-player`;
  const have = (c) => spawnSync('which', [c]).status === 0;
  if (!fs.existsSync(player) || !have('xvfb-run')) { console.log('     (skipped: build nord-player --features shell and install xvfb)'); return; }
  const app = fs.mkdtempSync(path.join(os.tmpdir(), 'nord-player-app-')), home = fs.mkdtempSync(path.join(os.tmpdir(), 'nord-player-home-'));
  fs.copyFileSync(`${ROOT}/runtime/desktop/nord-desktop.js`, `${app}/nord-desktop.js`);
  fs.writeFileSync(`${app}/nord.json`, JSON.stringify({ name: 'T', id: 'com.t.app', display: { width: 500, height: 300 }, desktop: { permissions: {} } }));
  fs.writeFileSync(`${app}/index.html`, `<!doctype html><meta charset=utf-8><title>T</title><meta name=nord-app-id content=com.t.app><script type=module>
import d from './nord-desktop.js'; await d.ready; const out = { transport: d.transport };
await d.fs.writeText('hello.txt', 'from webview'); out.read = await d.fs.readText('hello.txt');
out.traversal = await d.fs.readText('../x').catch((e) => e.code); out.docs = await d.fs.readText('documents:a').catch((e) => e.code);
out.proc = await d.process.run('ls').catch((e) => e.code); out.notify = await d.notify('x').catch((e) => e.code);
await d.store.set('k', { n: 5 }); out.k = await d.store.get('k');
await d.fs.writeText('result.json', JSON.stringify(out)); await d.app.quit();</script>`);
  try { execFileSync('xvfb-run', ['-a', 'timeout', '40', player, app], { env: { ...process.env, HOME: home, XDG_DATA_HOME: `${home}/data` }, stdio: 'ignore' }); } catch (e) { throw new Error(`player did not exit cleanly: ${e.message}`); }
  const r = JSON.parse(fs.readFileSync(`${home}/data/com.t.app/result.json`, 'utf8'));
  assert.deepEqual(r, { transport: 'ipc', read: 'from webview', traversal: 'denied', docs: 'denied', proc: 'denied', notify: 'denied', k: { n: 5 } });
  assert.deepEqual(JSON.parse(fs.readFileSync(`${home}/data/com.t.app/store.json`, 'utf8')).k, { n: 5 });
};
