// Real keyboard/mouse paths: globe navigation, HQ zoom, compact text and two consecutive interceptions.
import assert from 'node:assert/strict';
import { withPage, waitReady, ROOT } from './e2e-lib.mjs';
const { errors, result } = await withPage(process.argv[2] ?? `${ROOT}/examples/xkom`, async page => {
  await waitReady(page); await page.waitForFunction(() => window.__xk?.mode === 'title');
  if (await page.locator('[data-nord-start-gate]').count()) await page.mouse.click(480, 300);
  const titleSize = await page.evaluate(() => parseFloat(window.__xk.screenObjs.find(o => o.img?.text === 'X-KOM').img.style.fontSize));
  assert.ok(titleSize <= 24);
  await page.keyboard.press('Enter'); await page.waitForFunction(() => window.__xk.mode === 'geo');
  const before = await page.evaluate(() => window.__xk.geo.canvas.toDataURL());
  await page.keyboard.press('ArrowRight'); assert.notEqual(await page.evaluate(() => window.__xk.geo.canvas.toDataURL()), before);
  await page.mouse.click(276 * 3, 43 * 3); await page.waitForFunction(() => window.__xk.geo.region);
  const hq = await page.evaluate(() => window.__xk.geo.project({ x: 8, y: 5 })); assert.deepEqual(hq, { x: 116, y: 88, visible: true });
  const zoom = await page.evaluate(() => window.__xk.geo.zoom); await page.mouse.click(255 * 3, 59 * 3); assert.ok(await page.evaluate(() => window.__xk.geo.zoom) > zoom);
  await page.screenshot({ path: `${ROOT}/docs/screenshots/xkom-hq-map.png` });
  await page.keyboard.press('g'); await page.waitForFunction(() => !window.__xk.geo.region);
  const textSize = await page.evaluate(() => parseFloat(window.__xk.geoLabel.img.style.fontSize)); assert.equal(textSize, 7);
  await page.keyboard.press('b'); await page.waitForFunction(() => window.__xk.mode === 'base'); await page.keyboard.press('b'); await page.waitForFunction(() => window.__xk.mode === 'geo');
  for (let i = 0; i < 2; i++) {
    await page.mouse.click(276 * 3, 109 * 3); await page.waitForFunction(() => window.__xk.mode === 'air');
    await page.mouse.click(267 * 3, 91 * 3); await page.waitForFunction(() => window.__xk.mode === 'tac');
    if (i === 0) await page.evaluate(() => window.__xk.geoscape());
  }
  await page.evaluate(() => window.__xk.geoscape()); await page.keyboard.press('1'); await page.waitForFunction(() => window.__xk.mode === 'air');
  await page.keyboard.press('Space'); await page.waitForFunction(() => window.__xk.air.phase === 'auto');
  // Advance the real campaign update deterministically; headless frame throttling must not govern this timer regression.
  await page.evaluate(() => { for (let i = 0; i < 27; i++) window.__xk.update(0.1); });
  assert.equal(await page.evaluate(() => window.__xk.air.resolved), true);
  await page.keyboard.press('d'); await page.waitForFunction(() => window.__xk.mode === 'tac');
  await page.evaluate(() => window.__xk.geoscape()); await page.keyboard.press('1'); await page.waitForFunction(() => window.__xk.mode === 'air');
  await page.waitForTimeout(1300); assert.equal(await page.evaluate(() => window.__xk.mode), 'air', 'previous auto-resolve timer must not finish the next interception');
  return await page.evaluate(() => window.__nord.errors.map(e => e.err?.message));
}, { path: '/?seed=42', viewport: { width: 960, height: 600 } });
assert.deepEqual(errors, []); assert.deepEqual(result, []);
console.log('PASS compact title/text, globe rotation, HQ zoom, base navigation and consecutive radar-button interceptions');
