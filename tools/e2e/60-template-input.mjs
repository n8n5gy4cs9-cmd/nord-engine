// Mouse-driven templates really respond to the mouse: fps-arena mouse look (virtual lock = what WKWebView gets; real Pointer Lock
// is browser-native and cannot be driven by synthetic events) and kanban pointer drag & drop.
import assert from 'node:assert/strict';
import { suites, withPage, waitReady, ROOT } from '../e2e-lib.mjs';

suites['template-fps-mouse-look'] = async () => {
  const { errors } = await withPage(`${ROOT}/examples/fps-arena`, async (page) => {
    await waitReady(page); await page.waitForTimeout(1200);
    await page.evaluate(() => { HTMLCanvasElement.prototype.requestPointerLock = undefined; });
    await page.mouse.click(400, 300); await page.waitForTimeout(500);
    assert.equal(await page.evaluate(() => window.nordMouse?.locked), true, 'click captures the mouse');
    assert.equal(await page.evaluate(() => getComputedStyle(document.querySelector('canvas')).cursor), 'none');
    for (let i = 0; i < 10; i++) { await page.mouse.move(400 + i * 20, 300 + i * 5); await page.waitForTimeout(40); }
    const yaw = await page.evaluate(() => window.__nord.scene.find('Player').rot[1]);
    assert.ok(yaw > 5, `yaw changed (${yaw})`);
    await page.keyboard.press('Escape'); await page.waitForTimeout(200);
    assert.equal(await page.evaluate(() => window.nordMouse.locked), false, 'Esc releases');
    assert.equal(await page.evaluate(() => getComputedStyle(document.querySelector('canvas')).cursor), 'auto');
  }, { viewport: { width: 800, height: 450 } });
  assert.deepEqual(errors, []);
};

suites['template-kanban-drag'] = async () => {
  const { errors } = await withPage(`${ROOT}/examples/app-kanban`, async (page) => {
    await page.waitForTimeout(600);
    const cols = page.locator('.nk .card.grow');
    const b = await page.locator('.nk .card.row').first().boundingBox(), c2 = await cols.nth(2).boundingBox();
    await page.mouse.move(b.x + 20, b.y + 10); await page.mouse.down(); await page.mouse.move(c2.x + 30, c2.y + 60, { steps: 8 }); await page.mouse.up();
    await page.waitForTimeout(200);
    assert.equal(await cols.nth(2).locator('.card.row').count(), 1, 'card moved to the 3rd column');
  }, { viewport: { width: 900, height: 500 } });
  assert.deepEqual(errors, []);
};
