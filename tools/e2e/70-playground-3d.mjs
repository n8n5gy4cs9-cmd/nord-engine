import fs from 'node:fs';
import { suites, withPage, waitReady, nonBlank, ROOT } from '../e2e-lib.mjs';

suites['playground-3d'] = async () => {
  fs.mkdirSync(`${ROOT}/target/e2e`, { recursive: true });
  const { errors, result } = await withPage(`${ROOT}/examples/playground-3d`, async (page) => {
    await waitReady(page, 40000);
    const err = await page.evaluate(() => window.__nord_error);
    if (err) throw new Error(err);
    await page.waitForTimeout(2500);
    const p0 = await page.evaluate(() => window.__nord.scene.find('Player').pos.map((v) => +v.toFixed(2)));
    await page.keyboard.down('KeyW'); await page.waitForTimeout(1200); await page.keyboard.up('KeyW');
    const p1 = await page.evaluate(() => window.__nord.scene.find('Player').pos.map((v) => +v.toFixed(2)));
    await page.keyboard.down('Space'); await page.waitForTimeout(250); await page.keyboard.up('Space');
    const jumped = await page.evaluate(() => window.__nord.scene.find('Player').pos[1]);
    await page.keyboard.down('KeyE'); await page.waitForTimeout(500); await page.keyboard.up('KeyE');
    const yaw = await page.evaluate(() => window.__nord.camYaw);
    // walk into a coin
    await page.evaluate(() => { const g = window.__nord; g.scene.find('Player').pos = g.scene.find('Coin1').pos.slice(); });
    await page.waitForTimeout(600);
    const coins = await page.evaluate(() => ({ left: window.__nord.scene.findByTag('coin').length, errs: window.__nord.errors.length }));
    const shot = await page.screenshot({ path: `${ROOT}/target/e2e/playground-3d.png` });
    return { p0, p1, jumped, yaw, coins, colors: await nonBlank(page, shot) };
  }, { viewport: { width: 640, height: 360 } });
  console.log(JSON.stringify(result));
  if (errors.length) throw new Error(errors.join('\n'));
  if (result.p1[2] < result.p0[2] + 2) throw new Error('W did not move the player forward');
  if (result.jumped < result.p1[1] + 0.3) throw new Error('Space did not jump');
  if (!(result.yaw > 5)) throw new Error('E did not orbit the camera');
  if (result.coins.left !== 7 || result.coins.errs) throw new Error(`coin pickup failed: ${JSON.stringify(result.coins)}`);
  if (result.colors < 15) throw new Error('canvas looks blank');
};
