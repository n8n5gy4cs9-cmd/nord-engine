#!/usr/bin/env node
// Runs the self-tests of the Physics Lab projects (examples/physics-lab on matter and arcade, examples/physics-lab-3d on Havok) in headless Chromium.
// usage: node tools/physics-lab-test.mjs            Needs Playwright + Chromium (see tools/e2e-lib.mjs). The checks are in each project's scripts/lab*.js (`await __lab.selfTest()`).
import assert from 'node:assert/strict';
import { withPage, waitReady, ROOT } from './e2e-lib.mjs';

const run = async (project, query, expectAtLeast) => {
  const { errors, result } = await withPage(`${ROOT}/examples/${project}`, async (page) => {
    await waitReady(page);
    assert.equal(await page.evaluate(() => window.__nord_error), undefined);
    await page.waitForTimeout(600);
    return page.evaluate(() => window.__lab.selfTest());
  }, { path: `/${query}` });
  const failed = result.filter((r) => !r.ok);
  assert.deepEqual(failed, [], `${project}${query}: ${failed.map((f) => `${f.name} (${f.info})`).join('; ')}`);
  assert.ok(result.length >= expectAtLeast, `${project}${query}: only ${result.length} checks ran`);
  assert.deepEqual(errors, [], `${project}: console errors`);
  console.log(`ok  ${project}${query}  ${result.length} checks`);
};

await run('physics-lab', '', 17);                  // matter: shapes, composite, joints, constraints, ignore pairs, continuous detection, interpolation, queries
await run('physics-lab', '?physics=arcade', 8);    // arcade: ignore pairs, constraints, continuous detection, interpolation, queries
await run('physics-lab-3d', '', 22);               // Havok: queries, camera, joints, constraints, ignore pairs, layers, continuous detection, motor
