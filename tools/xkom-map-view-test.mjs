// Real renderer: four mission block layouts and rotated RTS deployments, without new art.
import assert from 'node:assert/strict';
import { withPage, waitReady, ROOT } from './e2e-lib.mjs';
const { errors, result } = await withPage(process.argv[2] ?? `${ROOT}/examples/xkom`, async page => {
  await waitReady(page); await page.waitForFunction(() => window.__xk?.ready);
  await page.evaluate(() => { window.__xk.update = () => {}; });
  const layouts = [];
  for (const seed of [1, 4, 7, 12]) {
    const layout = await page.evaluate(seed => {
      const h = window.__xk; h.leaveMission(); h.mode = 'tac'; h.tac.start({ seed, squad: h.C.squad, aliens: 8, onEnd: () => {} });
      // Reveal terrain only for these test overview captures; normal missions retain fog.
      for (const t of h.tac.tiles) { t.g.setVisible(true).setTint(0xffffff); t.o?.setVisible(true).setTint(0xffffff); }
      for (const e of h.tac.spr.values()) e.sp.setVisible(true);
      h.tac.cursor.setVisible(false); h.panTween?.stop(); h.cam.setZoom(1.1); h.cam.centerOn(384, 210); h.hud.setVisible(false);
      return h.tac.s.layout;
    }, seed);
    layouts.push(layout); await page.waitForTimeout(100);
    await page.screenshot({ path: `${ROOT}/docs/screenshots/xkom-mission-${layout.toLowerCase()}.png` });
  }
  assert.equal(new Set(layouts).size, 4);
  await page.evaluate(() => { const h = window.__xk; h.leaveMission(); h.cam.setZoom(3); h.hud.setVisible(true); });
  const factories = [];
  for (const seed of [1, 2, 3, 4]) {
    const view = await page.evaluate(seed => {
      const h = window.__xk; h.leaveMission(); h.clearScreen(); h.mode = 'rts'; h.rts.start({ mode: 'xkom', seed, music: 'music_game', onEnd: () => {} });
      const b = h.rts.s.blds.find(b => b.team === 'p' && b.type === 'fact'); return { x: b.tx, y: b.ty, viewX: h.vx, viewY: h.vy };
    }, seed);
    factories.push([view.x, view.y]); assert.ok(view.x * 16 >= view.viewX && view.x * 16 < view.viewX + 256); assert.ok(view.y * 16 >= view.viewY && view.y * 16 < view.viewY + 200);
  }
  assert.ok(new Set(factories.map(JSON.stringify)).size > 1);
  return await page.evaluate(() => window.__nord.errors.map(e => e.err?.message));
}, { path: '/?start=tac&seed=42', viewport: { width: 960, height: 600 } });
assert.deepEqual(errors, []); assert.deepEqual(result, []); console.log('PASS four rendered mission structures and varied RTS deployment cameras');
