#!/usr/bin/env node
// Screenshots + error check for X-KOM 2026 / Red Front 2026 (headless Chromium).  node tools/xk-shots.mjs [xkom|redfront]
import fs from 'node:fs';
import { withPage, waitReady, ROOT } from './e2e-lib.mjs';
const id = process.argv[2] ?? 'xkom', out = `${ROOT}/docs/screenshots`; fs.mkdirSync(out, { recursive: true });
const steps = id === 'xkom'
  ? [['', 'title', 800], ['?start=geo', 'geoscape', 800], ['?start=base', 'base', 800], ['?start=geo', 'help', 800], ['?start=air', 'intercept-radar', 3500], ['?start=air', 'intercept-action', 500], ['?start=tac', 'tactical', 1500], ['?start=rts', 'rts', 3000], ['?start=rts', 'rts-battle', 1500]]
  : [['', 'title', 800], ['?start=rts', 'rts', 3000], ['?start=rts', 'rts-battle', 1500]];
for (const [q, name, wait] of steps) {
  const { errors, result } = await withPage(`${ROOT}/examples/${id}`, async (page) => {
    await waitReady(page); await page.waitForTimeout(wait);
    if (await page.locator('[data-nord-start-gate]').count()) { await page.mouse.click(480, 300); await page.waitForTimeout(200); }
    if (name === 'help') { await page.keyboard.press('F1'); await page.waitForTimeout(400); await page.keyboard.press('ArrowRight'); await page.keyboard.press('ArrowRight'); await page.waitForTimeout(300); }
    if (name === 'tactical') { await page.mouse.click(480, 300); await page.waitForTimeout(500); }
    if (name === 'intercept-action') { await page.keyboard.press('Enter'); await page.waitForTimeout(1200); await page.mouse.move(480, 420); await page.mouse.down(); await page.evaluate(() => { window.__xk.air.t = 12; }); await page.waitForTimeout(2600); await page.mouse.up(); }
    if (name === 'rts-battle') { // fast-forward an attack on the enemy base and look at the fight
      await page.evaluate(async () => { const g = window.__xk ?? window.__rf, r = g.rts, s = r.s, m = await import('/scripts/xk/rts.js'); r.cfg.speed = 6;
        for (const t of ['mtank', 'mtank', 'rifle', 'rifle', 'rocket']) m.train(s, 'p', t); s.credits.p += 3000; window.__t0 = s.time; });
      await page.waitForFunction(() => window.__t0 !== undefined && (window.__xk ?? window.__rf).rts.s.time > window.__t0 + 70, null, { timeout: 60000 });
      await page.evaluate(async () => { const g = window.__xk ?? window.__rf, r = g.rts, s = r.s, m = await import('/scripts/xk/rts.js'); const army = s.units.filter((u) => u.team === 'p' && u.type !== 'harv'), e = s.blds.find((b) => b.team === 'e');
        r.sel = new Set(army.map((u) => u.id)); m.order(s, army.map((u) => u.id), { kind: 'amove', x: e.tx + 1, y: e.ty + 4 }); r.cfg.speed = 6; window.__t1 = s.time; });
      await page.waitForFunction(() => (window.__xk ?? window.__rf).rts.s.time > window.__t1 + 28 || (window.__xk ?? window.__rf).rts.s.result, null, { timeout: 60000 });
      await page.evaluate(() => { const r = (window.__xk ?? window.__rf).rts, s = r.s; r.cfg.speed = 1; const a = s.units.filter((u) => u.team === 'p' && u.type !== 'harv'); const cx = a.reduce((n, u) => n + u.x, 0) / (a.length || 1), cy = a.reduce((n, u) => n + u.y, 0) / (a.length || 1); r.view(cx * 16 - 128, cy * 16 - 100); });
      await page.waitForTimeout(400);
    }
    if (name === 'rts') { await page.keyboard.press('Space'); await page.mouse.move(400, 300); await page.waitForTimeout(500); }
    await page.screenshot({ path: `${out}/${id}-${name}.png` });
    return (await page.evaluate(() => (window.__nord?.errors ?? []).map((x) => `${x.method}: ${x.err?.message}\n${x.err?.stack?.split('\n').slice(0, 3).join('\n')}`)));
  }, { path: '/' + q, viewport: { width: 960, height: 600 } });
  console.log(name, errors.length || result.length ? 'ERRORS' : 'ok'); for (const e of [...new Set([...errors, ...result])].slice(0, 5)) console.log('  ', e);
}
