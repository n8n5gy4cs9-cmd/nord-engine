import fs from 'node:fs';
import { suites, withPage, waitReady, ROOT } from '../e2e-lib.mjs';

// Copy the 2D example, edit a script on disk, trigger the dev-server hook, assert the live instance changed without a page reload.
suites['hot-reload'] = async () => {
  const dir = `${ROOT}/target/e2e/hot2d`;
  fs.rmSync(dir, { recursive: true, force: true });
  fs.cpSync(`${ROOT}/examples/conformance-2d`, dir, { recursive: true });
  const f = `${dir}/scripts/coin.js`;
  const { errors, result } = await withPage(dir, async (page) => {
    await waitReady(page);
    await page.evaluate(() => { window.__marker = 'same-page'; });
    fs.writeFileSync(f, fs.readFileSync(f, 'utf8').replace('update(dt) {', 'update(dt) { window.__v = 2;'));
    const handled = await page.evaluate(() => window.__nord.hotReload(['scripts/coin.js']));
    await page.waitForTimeout(500);
    const ok = await page.evaluate(() => ({ v: window.__v, marker: window.__marker }));
    // a syntax error must not break the running game and must show the overlay
    fs.writeFileSync(f, 'export default class {{{');
    await page.evaluate(() => window.__nord.hotReload(['scripts/coin.js']));
    await page.waitForTimeout(400);
    const bad = await page.evaluate(() => ({ overlay: document.querySelector('.nord-error').style.display, alive: window.__nord.scene.find('Coin') != null }));
    return { handled, ok, bad };
  });
  const real = errors.filter((e) => !/SyntaxError|Unexpected token/.test(e));
  if (real.length) throw new Error(real.join('\n'));
  if (!result.handled || result.ok.v !== 2 || result.ok.marker !== 'same-page') throw new Error(`hot reload failed: ${JSON.stringify(result)}`);
  if (result.bad.overlay !== 'block' || !result.bad.alive) throw new Error(`error overlay/rollback failed: ${JSON.stringify(result)}`);
};
