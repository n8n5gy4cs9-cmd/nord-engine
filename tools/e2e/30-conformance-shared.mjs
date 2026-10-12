import fs from 'node:fs';
import { suites, withPage, waitReady, nonBlank, ROOT } from '../e2e-lib.mjs';

// One project/scene/script set, run on both runtimes: backend-independent behaviour must be identical, and both must render.
const dir = `${ROOT}/examples/conformance`;
fs.mkdirSync(`${ROOT}/target/e2e`, { recursive: true });

const run = (backend) => async () => {
  const { errors, result } = await withPage(dir, async (page) => {
    await waitReady(page, 40000);
    const err = await page.evaluate(() => window.__nord_error);
    if (err) throw new Error(err);
    await page.waitForTimeout(backend === 'babylon' ? 5000 : 2500);
    const conf = await page.evaluate(() => ({ ...window.__conf, orbs: window.__orbs, errs: window.__nord.errors.length, label: document.querySelector('.nord-label').textContent }));
    const shot = await page.screenshot({ path: `${ROOT}/target/e2e/conformance-${backend}.png` });
    return { conf, colors: await nonBlank(page, shot) };
  }, { path: `/?backend=${backend}`, viewport: backend === 'babylon' ? { width: 480, height: 270 } : { width: 800, height: 450 } });
  console.log(backend, JSON.stringify(result.conf));
  if (errors.length) throw new Error(errors.join('\n'));
  const c = result.conf;
  const want = { tweenDone: true, afterFired: true, eventSeen: true, saveOk: true, pathOk: true, labelOk: true };
  for (const [k, v] of Object.entries(want)) if (c[k] !== v) throw new Error(`${backend}: ${k} = ${c[k]}, expected ${v}`);
  if (c.errs) throw new Error(`${backend}: script errors`);
  if (c.everyCount < 3) throw new Error(`${backend}: every() fired ${c.everyCount}x`);
  if (c.spawnedMax !== 3 || c.orbs < 3) throw new Error(`${backend}: spawner max/orbs wrong: ${c.spawnedMax}/${c.orbs}`);
  if (result.colors < 10) throw new Error(`${backend}: canvas looks blank`);
};
suites['conformance-phaser'] = run('phaser');
suites['conformance-babylon'] = run('babylon');
