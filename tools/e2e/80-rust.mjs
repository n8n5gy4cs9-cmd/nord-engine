// Rust/WASM tier: `nord export` (web-wasm-game, release cargo build) of both Rust examples, then run the exported folder in headless Chromium.
// Needs `cargo build -p nord-cli`, the wasm32 target and network access for crates.io the first time (slow: ~1–2 min per example).
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { suites, withPage, nonBlank, ROOT } from '../e2e-lib.mjs';

const NORD = `${ROOT}/target/debug/nord`;
const hasBindgen = () => { try { execFileSync('wasm-bindgen', ['--version']); return true; } catch { return false; } };
const run = (example, press, target = 'web-wasm-game', files = ['game.wasm', 'mq_js_bundle.js', 'index.html'], minColors = 12) => async () => {
  if (target === 'web-wasm-app' && !hasBindgen()) { console.log('SKIP (wasm-bindgen CLI not installed)'); return; }
  const out = `${ROOT}/target/e2e/export-rust-${example}`;
  fs.rmSync(out, { recursive: true, force: true });
  fs.mkdirSync(`${ROOT}/target/e2e`, { recursive: true });
  const log = execFileSync(NORD, ['export', `${ROOT}/examples/${example}`, '-t', target, '-o', out], { encoding: 'utf8', env: { ...process.env, NORD_ROOT: ROOT } });
  console.log(log.split('\n').slice(0, 2).join(' | '));
  for (const f of files) if (!fs.existsSync(`${out}/${f}`)) throw new Error(`export is missing ${f}`);
  const { errors, result } = await withPage(out, async (page) => {
    await page.waitForTimeout(3500);
    await press(page);
    const shot = await page.screenshot({ path: `${out}.png` });
    return { colors: await nonBlank(page, shot) };
  }, { viewport: { width: 640, height: 360 } });
  console.log(JSON.stringify(result));
  const real = errors.filter((e) => !/register_plugin is not defined/.test(e)); // known harmless error in macroquad's JS bundle (quad_net section)
  if (real.length) throw new Error(real.join('\n'));
  if (result.colors < minColors) throw new Error('rust export: canvas looks blank');
};
suites['rust-platformer'] = run('rust-platformer', async (page) => { await page.keyboard.down('KeyD'); await page.waitForTimeout(800); await page.keyboard.press('Space'); await page.waitForTimeout(500); await page.keyboard.up('KeyD'); });
suites['rust-physics-toys'] = run('rust-physics-toys', async (page) => { await page.mouse.click(300, 100); await page.keyboard.press('Space'); await page.waitForTimeout(1500); });
suites['rust-json-tool'] = run('rust-json-tool', async (page) => { await page.mouse.click(700, 100); await page.waitForTimeout(500); }, 'web-wasm-app', ['app.js', 'app_bg.wasm', 'index.html']);
suites['rust-asteroids'] = run('rust-asteroids', async (page) => { await page.keyboard.down('KeyW'); await page.keyboard.down('Space'); await page.waitForTimeout(1200); await page.keyboard.up('Space'); await page.keyboard.up('KeyW'); });
suites['rust-mq-snake'] = run('rust-mq-snake', async (page) => { await page.keyboard.press('ArrowUp'); await page.waitForTimeout(800); });
suites['rust-mq-life'] = run('rust-mq-life', async () => {}, 'web-wasm-game', ['game.wasm', 'mq_js_bundle.js', 'index.html'], 2); // black/white cells only
