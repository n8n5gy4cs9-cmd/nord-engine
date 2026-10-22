#!/usr/bin/env node
// Capture the screenshots used by the UI Designer + Graph manual chapters (docs/screenshots/ui-*.png, graph-*.png).
// Needs: `nord serve examples/nodegraph-coins -p 4190` (node tools/gen_examples.mjs nodegraph-coins first) and Playwright
// (playwright or playwright-core on NODE_PATH) with a Chromium-family browser: NORD_BROWSER=/path/to/browser if auto-detect fails.
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { ROOT } from './e2e-lib.mjs';

const BASE = process.env.NORD_SERVE ?? 'http://localhost:4190';
const OUT = path.join(ROOT, 'docs/screenshots');
const req = (n) => { for (const b of [ROOT, process.env.NODE_PATH].filter(Boolean)) { try { return createRequire(path.join(b, 'x.js'))(n); } catch { /* next */ } } return null; };
const pw = req('playwright') ?? req('playwright-core');
if (!pw) throw new Error('playwright not found');
const exe = process.env.NORD_BROWSER ?? ['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/Applications/Brave Browser.app/Contents/MacOS/Brave Browser', '/Applications/Chromium.app/Contents/MacOS/Chromium', '/usr/bin/chromium', '/usr/bin/google-chrome'].find((p) => fs.existsSync(p));
const browser = await pw.chromium.launch({ executablePath: exe, headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 860 } });
page.on('pageerror', (e) => console.error('page error:', e.message));
const shot = async (name, opts = {}) => { await page.waitForTimeout(opts.wait ?? 400); await page.screenshot({ path: path.join(OUT, `${name}.png`), ...opts.shot }); console.log('wrote', name); };
const crop = (name, sel, pad = 0) => async () => { const b = await page.locator(sel).first().boundingBox(); await shot(name, { shot: { clip: { x: b.x - pad, y: b.y - pad, width: b.width + pad * 2, height: b.height + pad * 2 } } }); };
const demo = async (d, name, size = { width: 960, height: 540 }) => { await page.setViewportSize({ width: size.width + 40, height: size.height + 40 }); await page.goto(`${BASE}/editor/uidesigner/docs-demo.html?demo=${d}`); await page.waitForFunction(() => window.__ready); await shot(name, { shot: { clip: { x: 20, y: 20, ...size } } }); await page.setViewportSize({ width: 1440, height: 860 }); };

// ── UI Designer ──
await page.goto(`${BASE}/editor/uidesigner/index.html?file=ui/hud.ui.json`);
await page.waitForSelector('#tree .row'); await page.waitForTimeout(600);
await page.locator('#tree .row', { hasText: 'restart' }).click();
await shot('ui-designer-overview');
await page.locator('#tabActions').click(); await page.waitForTimeout(900);
await shot('ui-designer-actions');
// an action nobody handles
await page.locator('.tabs button[data-tab="props"]').click();
await page.locator('#palette button', { hasText: /^button$/ }).click();
await page.locator('#tree .row.sel', { hasText: 'button1' }).waitFor(); await page.waitForTimeout(300);
const act = page.locator('#props .f', { hasText: /^Action/ }).locator('input'); await act.fill('two'); await act.press('Tab');
await page.waitForTimeout(900);
await shot('ui-designer-action-missing');
// image picker
await page.locator('#palette button', { hasText: /^panel$/ }).click();
await page.locator('#tree .row.sel', { hasText: 'panel1' }).waitFor(); await page.waitForTimeout(300);
await page.locator('#props button', { hasText: 'Browse project images' }).click(); await page.waitForSelector('.pgrid .pimg'); await page.waitForTimeout(500);
await shot('ui-designer-image-picker');
await page.locator('.pimg[title$="panel.png"]').click(); await page.waitForTimeout(300);
const modeSel = page.locator('#props .f', { hasText: /^Image mode/ }).locator('select'); await modeSel.selectOption('slice');
const slice = page.locator('#props .f', { hasText: /^9-slice/ }).locator('input'); await slice.fill('8 8 8 8'); await slice.press('Tab');
const scale = page.locator('#props .f', { hasText: /^Slice scale/ }).locator('input'); await scale.fill('2'); await scale.press('Tab'); await page.waitForTimeout(400);
await page.locator('#props .slicebox').scrollIntoViewIfNeeded();
await shot('ui-designer-slice-editor');
await page.locator('.tabs button[data-tab="styles"]').click(); await page.waitForTimeout(300);
await shot('ui-designer-styles');
// demos rendered with the real runtime
await demo('slice', 'ui-nine-slice-compare');
await demo('anchors', 'ui-anchors');
await demo('gallery', 'ui-node-gallery', { width: 960, height: 420 });
await demo('input', 'ui-input-image', { width: 720, height: 420 });

// ── Graph editor ──
await page.goto(`${BASE}/editor/graph/index.html?file=graphs/player.graph.json`);
await page.waitForTimeout(1200);
await shot('graph-editor-overview');
await page.locator('#search').fill('vector'); await page.waitForTimeout(300);
await shot('graph-palette-search');
await page.locator('#search').fill('');
await page.locator('#cv').click({ position: { x: 700, y: 120 } }); await page.waitForTimeout(300);
await shot('graph-editor-selected');
// the whole game graph + the templates menu
await page.goto(`${BASE}/editor/graph/index.html?file=graphs/game.graph.json`); await page.waitForTimeout(1000);
await shot('graph-editor-scene-graph');
await page.goto(`${BASE}/`); await page.waitForTimeout(2500);
await page.evaluate(async () => { const g = window.__nord; for (const c of g.scene.findByTag('coin').slice(0, 5)) { g.scene.find('Player').pos = [...c.pos]; await new Promise((r) => setTimeout(r, 250)); } });
await shot('graph-example-win');
await browser.close();
