import fs from 'node:fs';
import { suites, withPage, waitReady, nonBlank, ROOT } from '../e2e-lib.mjs';

const dir = `${ROOT}/examples/conformance-3d`;
fs.mkdirSync(`${ROOT}/target/e2e`, { recursive: true });

suites['conformance-3d'] = async () => {
  const { errors, result } = await withPage(dir, async (page) => {
    await waitReady(page, 40000);
    const err = await page.evaluate(() => window.__nord_error);
    if (err) throw new Error(err);
    await page.waitForTimeout(6000);
    const info = await page.evaluate(() => {
      const g = window.__nord, b = g.scene.find('Ball');
      const grounded = g.physics.isGrounded(b);
      g.scene.find('Zone');
      const ray = g.physics.raycast([0, 5, 0], [0, -5, 0], { ignore: b });
      return { ball: b.pos.map((v) => +v.toFixed(2)), grounded, hits: window.__ballHits ?? 0, ents: [...g.scene.all()].length, errs: g.errors.length, ray: ray && ray.entity?.name, anim: !!g.scene.find('Model').getComponent('model').current };
    });
    // drop the ball into the trigger zone
    await page.evaluate(() => { window.__nord.scene.find('Ball').pos = [-3, 3, 0]; });
    await page.waitForTimeout(4000);
    const zone = await page.evaluate(() => window.__zoneEnter ?? 0);
    const shot = await page.screenshot({ path: `${ROOT}/target/e2e/conformance-3d.png` });
    return { info, zone, colors: await nonBlank(page, shot) };
  }, { viewport: { width: 480, height: 270 } });
  console.log(JSON.stringify(result));
  if (errors.length) throw new Error(errors.join('\n'));
  if (result.info.errs) throw new Error('script errors');
  if (result.info.ball[1] > 1.2 || result.info.ball[1] < 0.2) throw new Error('ball did not land on ground');
  if (!result.info.hits) throw new Error('no collision events');
  if (!result.zone) throw new Error('trigger event not fired');
  if (!result.info.anim) throw new Error('model animation not playing');
  if (result.colors < 15) throw new Error('canvas looks blank');
};
