#!/usr/bin/env node
// Native player smoke test (M9-16): runs `nord-player` on a tiny desktop app, which exercises window.ipc → nord-desktop (files, store,
// permission denials, local web server) and writes result.json into its app-data folder. Used by e2e (Linux, under xvfb-run) and by CI
// on macOS / Windows where a window session exists.   usage: node tools/player-smoke.mjs <path-to-nord-player> [--xvfb]
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export async function runPlayerSmoke(player, { xvfb = false, timeoutS = 60 } = {}) {
  const app = fs.mkdtempSync(path.join(os.tmpdir(), 'nord-player-app-')), home = fs.mkdtempSync(path.join(os.tmpdir(), 'nord-player-home-'));
  fs.copyFileSync(`${ROOT}/runtime/desktop/nord-desktop.js`, `${app}/nord-desktop.js`);
  fs.writeFileSync(`${app}/nord.json`, JSON.stringify({ name: 'T', id: 'com.t.app', display: { width: 500, height: 300 }, desktop: { permissions: { server: true, prompt: false } } }));
  fs.writeFileSync(`${app}/index.html`, `<!doctype html><meta charset=utf-8><title>T</title><meta name=nord-app-id content=com.t.app><script type=module>
import d from './nord-desktop.js'; await d.ready; const out = { transport: d.transport };
await d.fs.writeText('hello.txt', 'from webview'); out.read = await d.fs.readText('hello.txt');
out.traversal = await d.fs.readText('../x').catch((e) => e.code); out.docs = await d.fs.readText('documents:a').catch((e) => e.code);
out.proc = await d.process.run('ls').catch((e) => e.code); out.notify = await d.notify('x').catch((e) => e.code);
await d.store.set('k', { n: 5 }); out.k = await d.store.get('k');
await d.fs.writeText('www/index.html', '<h1>native server</h1>'); const sv = await d.server.start({ root: 'appData:www', cors: true, liveReload: false }); out.served = (await (await fetch(sv.url)).text()); await d.server.stop(sv.id);
await d.fs.writeText('result.json', JSON.stringify(out)); await d.app.quit();</script>`);
  // app data lives under HOME / XDG_DATA_HOME / APPDATA depending on the OS: point all of them at the temp home
  const env = { ...process.env, HOME: home, USERPROFILE: home, XDG_DATA_HOME: `${home}/data`, APPDATA: `${home}/data` };
  const cmd = xvfb ? ['xvfb-run', ['-a', 'timeout', String(timeoutS), player, app]] : [player, [app]];
  try { execFileSync(cmd[0], cmd[1], { env, stdio: 'inherit', timeout: (timeoutS + 20) * 1000 }); } catch (e) { throw new Error(`player did not exit cleanly: ${e.message}`); }
  const dataDir = [`${home}/data/com.t.app`, `${home}/Library/Application Support/com.t.app`].find((d) => fs.existsSync(`${d}/result.json`));
  assert.ok(dataDir, 'player wrote no result.json (IPC did not work)');
  const r = JSON.parse(fs.readFileSync(`${dataDir}/result.json`, 'utf8'));
  assert.deepEqual(r, { transport: 'ipc', read: 'from webview', traversal: 'denied', docs: 'denied', proc: 'denied', notify: 'denied', k: { n: 5 }, served: '<h1>native server</h1>' });
  assert.deepEqual(JSON.parse(fs.readFileSync(`${dataDir}/store.json`, 'utf8')).k, { n: 5 });
  console.log('player smoke OK');
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const player = process.argv[2];
  if (!player) { console.error('usage: node tools/player-smoke.mjs <nord-player> [--xvfb]'); process.exit(2); }
  await runPlayerSmoke(path.resolve(player), { xvfb: process.argv.includes('--xvfb') });
}
