// Real trusted browser gestures: mouse, touch and key open audio only; the next gesture reaches the game.
import assert from 'node:assert/strict';
import { withPage, waitReady, ROOT } from './e2e-lib.mjs';
const dir = process.argv[2] ?? `${ROOT}/examples/xkom`;
for (const kind of ['mouse', 'touch', 'keyboard']) {
  const { errors, result } = await withPage(dir, async page => {
    await waitReady(page); await page.waitForFunction(() => window.__xk?.ready);
    await page.screenshot({ path: `${ROOT}/docs/screenshots/xkom-start-gate.png` });
    const title = await page.evaluate(() => window.__xk.PATH.title);
    const layout = await page.evaluate(() => { const h = window.__xk, c = h.ps.sys.game.canvas; return [c.width, c.height, h.cam.zoom, h.cam.scrollX, h.cam.scrollY, h.hud.list.length]; });
    if (kind === 'mouse') await page.mouse.click(480, 300);
    else if (kind === 'touch') await page.touchscreen.tap(480, 300);
    else await page.keyboard.press('Enter');
    assert.equal(await page.evaluate(() => window.__xk.mode), 'title', `${kind}: first gesture must not start the campaign`);
    assert.equal(await page.locator('[data-nord-start-gate]').count(), 0);
    assert.equal(await page.evaluate(() => window.__xk.PATH.title), title);
    assert.deepEqual(await page.evaluate(() => { const h = window.__xk, c = h.ps.sys.game.canvas; return [c.width, c.height, h.cam.zoom, h.cam.scrollX, h.cam.scrollY, h.hud.list.length]; }), layout, 'title layout and camera remain unchanged');
    await page.waitForFunction(() => window.__nord.audio._music?.src?.buffer && window.__nord.audio.ctx.state === 'running');
    assert.equal(await page.evaluate(() => window.__nord.audio.musicPath), 'assets/audio/music/music_title.mp3');
    if (kind === 'mouse') await page.mouse.click(270, 520);
    else if (kind === 'touch') await page.touchscreen.tap(270, 520);
    else await page.keyboard.press('Enter');
    await page.waitForFunction(() => window.__xk.mode === 'geo');
    // Returning to title and disposing the helper must not swallow any later input.
    await page.evaluate(() => { window.__xk.titleScreen(); window.__xk.startGate.destroy(); });
    await page.keyboard.press('Enter'); await page.waitForFunction(() => window.__xk.mode === 'geo');
    return await page.evaluate(() => window.__nord.errors.map(e => e.err?.message));
  }, { path: '/?seed=42', viewport: { width: 960, height: 600 }, contextOptions: { hasTouch: kind === 'touch' } });
  assert.deepEqual(errors, []); assert.deepEqual(result, []); console.log(`PASS ${kind}: first gesture unlocks title audio, second plays game, later inputs unaffected`);
}
