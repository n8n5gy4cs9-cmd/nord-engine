// Real mouse positions + deterministic view updates; game UI and out-of-canvas areas must never pan.
import assert from 'node:assert/strict';
import { withPage, waitReady, ROOT } from './e2e-lib.mjs';
const project = process.argv[2] ?? 'xkom', dir = process.argv[3] ?? `${ROOT}/examples/${project}`;
const { errors, result } = await withPage(dir, async page => {
  await waitReady(page); await page.waitForFunction(() => (window.__xk ?? window.__rf)?.ready);
  await page.evaluate(() => { const h = window.__xk ?? window.__rf; h.update = () => {}; });
  const mouse = async (x, y) => { const b = await page.locator('canvas').first().boundingBox(); await page.mouse.move(b.x + x * b.width / 320, b.y + y * b.height / 200); };
  const sample = async (mode, x, y) => {
    await page.evaluate(m => { const h = window.__xk ?? window.__rf; h.panTween?.stop(); m === 'rts' ? h.rts.view(160, 160) : h.camCenter(384, 200); }, mode);
    await mouse(x, y);
    return page.evaluate(m => { const h = window.__xk ?? window.__rf, before = [h.vx, h.vy]; if (m === 'rts') h.rts.update(0.1); else h.tac.update?.(0.1); return [h.vx - before[0], h.vy - before[1]]; }, mode);
  };
  for (const [x, y, axis, sign] of [[1,100,0,-1],[254,100,0,1],[120,1,1,-1],[120,199,1,1]]) {
    const d = await sample('rts', x, y); assert.equal(Math.sign(d[axis]), sign, `RTS map edge ${x},${y} scrolls`);
  }
  for (const [x, y] of [[319,1],[319,199],[270,1],[270,199],[270,100],[120,100],[-1,100]]) assert.deepEqual(await sample('rts',x,y), [0,0], `RTS UI/center/outside ${x},${y} stays still`);
  await mouse(254,100); await page.keyboard.press('F1'); const held = await page.evaluate(() => { const h = window.__xk ?? window.__rf; return [h.vx,h.vy]; });
  await page.evaluate(() => { const h = window.__xk ?? window.__rf; Object.getPrototypeOf(h).update.call(h, 0.1); }); assert.deepEqual(await page.evaluate(() => { const h = window.__xk ?? window.__rf; return [h.vx,h.vy]; }), held); await page.keyboard.press('Escape');
  if (project === 'xkom') {
    await page.evaluate(() => { const h = window.__xk; h.rts.destroy(); h.deploy(h.makeSites()[0]); });
    for (const [x,y,axis,sign] of [[1,100,0,-1],[319,100,0,1],[120,1,1,-1],[120,159,1,1],[319,159,0,1]]) {
      const d = await sample('tac',x,y); assert.equal(Math.sign(d[axis]), sign, `tactical map edge ${x},${y} scrolls`);
    }
    for (const [x,y] of [[1,170],[319,170],[160,199],[120,100],[-1,100]]) assert.deepEqual(await sample('tac',x,y), [0,0], `tactical HUD/center/outside ${x},${y} stays still`);
    await page.evaluate(() => window.__xk.tac.busy = true); assert.deepEqual(await sample('tac',319,100), [0,0], 'walking replay keeps camera control'); await page.evaluate(() => window.__xk.tac.busy = false);
    await page.keyboard.press('p'); assert.equal(await page.evaluate(() => window.__xk.pause.open), true); const heldPause = await page.evaluate(() => [window.__xk.vx, window.__xk.vy]); await page.evaluate(() => { const h = window.__xk; Object.getPrototypeOf(h).update.call(h, 0.1); }); assert.deepEqual(await page.evaluate(() => [window.__xk.vx, window.__xk.vy]), heldPause); await page.keyboard.press('p');
    await page.evaluate(() => { const h = window.__xk; h.leaveMission(); h.titleScreen(); });
    await page.waitForTimeout(2700); // Discarded scene message timers must not touch destroyed HUD text.
    assert.equal(await page.evaluate(() => window.__xk.screenObjs.some(o => o.img?.text?.includes('LISTEN'))), false);
    await page.screenshot({ path: `${ROOT}/docs/screenshots/xkom-title.png` });
  }
  return await page.evaluate(() => window.__nord.errors.map(e => e.err?.message));
}, { path: '/?start=rts&seed=42', viewport: process.env.XK_EDGE_WIDE ? { width: 1920, height: 1080 } : { width: 960, height: 640 } });
assert.deepEqual(errors, []); assert.deepEqual(result, []); console.log(`PASS ${project}: map-edge scrolling, HUD/sidebar exclusion, outside stop and title cleanup`);
