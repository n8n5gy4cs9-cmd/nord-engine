import fs from 'node:fs';
import { suites, withPage, waitReady, nonBlank, ROOT } from '../e2e-lib.mjs';

const dir = `${ROOT}/examples/conformance-2d`;
fs.mkdirSync(`${ROOT}/target/e2e`, { recursive: true });

const run = (query) => async () => {
  const { errors, result } = await withPage(dir, async (page) => {
    await waitReady(page);
    if (await page.evaluate(() => window.__nord_error)) throw new Error(await page.evaluate(() => window.__nord_error));
    await page.waitForTimeout(1500);
    const info = await page.evaluate(() => {
      const g = window.__nord, h = g.scene.find('Hero');
      return { hero: h.pos.map((v) => Math.round(v)), grounded: g.physics.isGrounded(h), ents: [...g.scene.all()].length, errs: g.errors.length };
    });
    await page.keyboard.down('KeyD'); await page.waitForTimeout(600); await page.keyboard.up('KeyD');
    const moved = await page.evaluate(() => window.__nord.scene.find('Hero').pos[0]);
    await page.evaluate(() => { const g = window.__nord; g.scene.find('Hero').pos = g.scene.find('Coin').pos.map((v, i) => (i === 2 ? 1 : v)); });
    await page.waitForTimeout(400);
    const coin = await page.evaluate(() => ({ left: window.__nord.scene.findByTag('coin').length, score: window.__nord.scene.find('Score').getComponent('uiLabel').h.el.textContent }));
    const shot = await page.screenshot({ path: `${ROOT}/target/e2e/conformance-2d${query.replace(/\W/g, '')}.png` });
    return { info, moved, coin, colors: await nonBlank(page, shot) };
  }, { path: `/${query}` });
  console.log(JSON.stringify(result));
  if (errors.length) throw new Error(errors.join('\n'));
  if (result.info.errs) throw new Error('script errors');
  if (!result.info.grounded) throw new Error('hero not grounded (physics/tilemap collision failed)');
  if (result.moved <= result.info.hero[0] + 20) throw new Error('hero did not move right');
  if (result.coin.left !== 0 || result.coin.score !== 'Score: 1') throw new Error(`trigger/coin failed: ${JSON.stringify(result.coin)}`);
  if (result.colors < 12) throw new Error('canvas looks blank');
};

suites['conformance-2d'] = run('');
suites['conformance-2d-matter'] = run('?physics=matter');
