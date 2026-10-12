#!/usr/bin/env node
// Headless smoke test: load each example (or the ids given) in Chromium for ~3 s, assert no console/page errors, no external requests,
// no script errors (game.errors) and a non-blank canvas. usage: node tools/smoke-examples.mjs [id…]
import fs from 'node:fs';
import { withPage, waitReady, nonBlank, ROOT } from './e2e-lib.mjs';

const all = fs.readdirSync(`${ROOT}/examples`).filter((d) => fs.existsSync(`${ROOT}/examples/${d}/nord.project.json`) || fs.existsSync(`${ROOT}/examples/${d}/index.html`));
const want = process.argv.slice(2);
const ids = (want.length ? want : all).filter((d) => all.includes(d));
fs.mkdirSync(`${ROOT}/target/smoke`, { recursive: true });
let failed = 0;
for (const id of ids) {
  const dir = `${ROOT}/examples/${id}`;
  try {
    const { errors, result } = await withPage(dir, async (page) => {
      await waitReady(page);
      const e = await page.evaluate(() => window.__nord_error);
      if (e) throw new Error(e);
      await page.waitForTimeout(3000);
      await page.keyboard.press('Space');
      await page.waitForTimeout(500);
      const scriptErrors = await page.evaluate(() => (window.__nord?.errors ?? []).map((x) => `${x.script?.constructor?.name}.${x.method}: ${x.err?.message}`));
      const shot = await page.screenshot({ path: `${ROOT}/target/smoke/${id}.png` });
      return { scriptErrors, colors: await nonBlank(page, shot) };
    }, { viewport: { width: 800, height: 450 } });
    const problems = [...new Set(errors.map((e) => e.split("\n")[0]))].slice(0, 5).concat([...result.scriptErrors.map((s) => `script: ${s}`)]);
    if (result.colors < 6) problems.push(`looks blank (${result.colors} colours)`);
    console.log(`${problems.length ? 'FAIL' : 'ok  '} ${id} (${result.colors} colours)`);
    for (const p of problems) console.log('     ' + p);
    if (problems.length) failed++;
  } catch (err) { failed++; console.log(`FAIL ${id}: ${err.message}`); }
}
process.exit(failed ? 1 : 0);
