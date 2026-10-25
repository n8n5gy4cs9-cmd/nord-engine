#!/usr/bin/env node
// Runs the self-test of the Shadertoy Lab (examples/shadertoy-lab) in headless Chromium: every shader compiles and runs, Buffer A keeps the painted stroke,
// the keyboard texture is uploaded, the scene post effect adds and removes its overlay canvas.
// usage: node tools/shadertoy-lab-test.mjs          Needs Playwright + Chromium (see tools/e2e-lib.mjs).
import assert from 'node:assert/strict';
import { withPage, waitReady, ROOT } from './e2e-lib.mjs';

const { errors, result } = await withPage(`${ROOT}/examples/shadertoy-lab`, async (page) => {
  await waitReady(page);
  assert.equal(await page.evaluate(() => window.__nord_error), undefined);
  await page.waitForTimeout(600);
  return page.evaluate(() => window.__lab.selfTest());
});
const failed = result.filter((r) => !r.ok);
assert.deepEqual(failed, [], failed.map((f) => `${f.name} (${f.info})`).join('; '));
assert.ok(result.length >= 11, `only ${result.length} checks ran`);
assert.deepEqual(errors, [], 'console errors');
console.log(`ok  shadertoy-lab  ${result.length} checks`);
