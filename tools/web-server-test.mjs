// Server-mode e2e (M11-10/11/14): starts the real nord-editor-server on a temp workspace, opens the web editor in Chromium,
// logs in, creates a project (synced to the server), reloads, reopens it from the server, plays it, exports it on the server.
// Needs: tools/build-web-editor.sh, cargo build -p nord-editor-server -p nord-cli, Playwright.
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import net from 'node:net';
import { loadPlaywright, ROOT } from './e2e-lib.mjs';

const BIN = path.join(ROOT, 'target/debug/nord-editor-server');
const NORD = path.join(ROOT, 'target/debug/nord');
if (!fs.existsSync(BIN) || !fs.existsSync(path.join(ROOT, 'dist/web-editor/index.html'))) { console.log('SKIP: build first (see header)'); process.exit(0); }
const port = await new Promise((ok) => { const s = net.createServer().listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => ok(p)); }); });
const ws = fs.mkdtempSync(path.join(os.tmpdir(), 'nord-ws-'));
const TOKEN = 'e2e-token-123456';
const srv = spawn(BIN, ['--listen', `127.0.0.1:${port}`, '--workspace', ws, '--web', path.join(ROOT, 'dist/web-editor'), '--token', TOKEN, '--engine', ROOT, '--nord', NORD], { stdio: 'ignore' });
const base = `http://127.0.0.1:${port}/`;
for (let i = 0; i < 50; i++) { try { await fetch(base + 'api/ping'); break; } catch { await new Promise((r) => setTimeout(r, 100)); } }

const { chromium } = loadPlaywright();
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await (await browser.newContext({ viewport: { width: 800, height: 800 }, acceptDownloads: true })).newPage();
page.on('dialog', (d) => d.accept(TOKEN));
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
let ok = true;
const check = (name, cond, extra = '') => { console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${extra ? '  ' + extra : ''}`); if (!cond) ok = false; };
const click = async (x, y) => { await page.mouse.move(x, y); await page.waitForTimeout(250); await page.mouse.click(x, y); };
const ready = async () => { await page.waitForFunction(() => !document.getElementById('msg') || document.getElementById('msg').textContent.includes('could not'), null, { timeout: 60000 }); const m = await page.evaluate(() => document.getElementById('msg')?.textContent); if (m) throw new Error(m); await page.waitForTimeout(1500); };
try {
  await page.goto(base);
  await ready();
  check('login prompt accepted, editor started', true);
  await click(201, 623); // Create project
  await page.waitForTimeout(6000);
  const onDisk = path.join(ws, 'admin', 'My Game');
  check('project synced to the server workspace', fs.existsSync(path.join(onDisk, 'nord.project.json')) && fs.existsSync(path.join(onDisk, 'scenes/main.scene.json')), onDisk);
  await page.reload();
  await ready();
  await click(470, 238); // Recent: My Game (listed from the server)
  await page.waitForTimeout(5000);
  check('project opened from the server (editor shows its tabs)', await page.evaluate(() => !!document.getElementById('nord')));
  await click(229, 52); // Play
  await page.waitForTimeout(6000);
  const frame = page.frames().find((f) => f.url().includes('/play/') && !f.url().includes('__edit'));
  check('game runs from server-synced files', !!frame);
  if (frame) check('game booted', (await frame.waitForFunction(() => window.__nord_ready === true || window.__nord_error, null, { timeout: 30000 }).then((h) => h.jsonValue()).catch(() => null)) === true);
  await click(231, 52); // Stop
  await page.waitForTimeout(800);
  await click(48, 88); // Export…
  await page.waitForTimeout(1000);
  const dl = page.waitForEvent('download', { timeout: 60000 }).catch(() => null);
  await click(63, 496); // Export (server job)
  const d = await dl;
  check('server export downloads a zip', !!d, d?.suggestedFilename());
  if (d) { const f = path.join(ROOT, 'dist/web-server-export.zip'); await d.saveAs(f); check('server export zip is not empty', fs.statSync(f).size > 1000, `${fs.statSync(f).size} bytes`); }
} catch (e) { console.log('FAIL  exception', e.message); ok = false; }
if (errors.length) console.log('page errors:\n  ' + [...new Set(errors)].slice(0, 6).join('\n  '));
await browser.close(); srv.kill(); fs.rmSync(ws, { recursive: true, force: true });
process.exit(ok ? 0 : 1);
