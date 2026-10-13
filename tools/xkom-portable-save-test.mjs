import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { withPage, waitReady, ROOT } from './e2e-lib.mjs';
const { errors } = await withPage(process.argv[2] ?? `${ROOT}/examples/xkom`, async page => {
  await waitReady(page); await page.waitForFunction(() => window.__xk?.ready);
  await page.evaluate(() => { const h = window.__xk; h.C.clockPaused = true; h.C.funds = 12345; h.C.squad[0].name = 'PORTABLE'; });
  await page.keyboard.press('Escape');
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export save', exact: true }).click();
  const d = await download, raw = await fs.readFile(await d.path(), 'utf8');
  assert.equal(d.suggestedFilename(), 'xkom-save.json');
  const exported = JSON.parse(raw); assert.equal(exported.checkpoint.C.funds, 12345);
  await page.evaluate(() => { const h = window.__xk; h.C.funds = 1; h.saveCampaign(); });
  const original = await page.evaluate(() => window.__xk.savedCampaign());
  const input = page.getByLabel('Import campaign save');
  const upload = raw => input.setInputFiles({ name: 'save.json', mimeType: 'application/json', buffer: Buffer.from(raw) });
  for (const invalid of ['garbage', JSON.stringify({ ...exported, game: 'redfront' }), JSON.stringify({ ...exported, checkpoint: { ...exported.checkpoint, C: { ...exported.checkpoint.C, contacts: [null, null, null] } } })]) {
    await upload(invalid); await page.getByRole('status').filter({ hasText: 'Import failed' }).waitFor();
    assert.deepEqual(await page.evaluate(() => window.__xk.savedCampaign()), original);
    assert.equal(await page.evaluate(() => window.__xk.C.funds), 1);
  }
  await upload(raw); await page.waitForFunction(() => !window.__xk.pause.open);
  assert.equal(await page.evaluate(() => window.__xk.C.funds), 12345);
  assert.equal(await page.evaluate(() => window.__xk.C.squad[0].name), 'PORTABLE');
  await page.goto(new URL('/?seed=42', page.url()).href); await waitReady(page); await page.waitForFunction(() => window.__xk?.ready);
  await page.mouse.click(480, 300); await page.keyboard.press('Enter'); assert.equal(await page.evaluate(() => window.__xk.C.funds), 12345);
  // Combat export contains the safe deployment checkpoint; import returns to HQ.
  await page.evaluate(() => { const h = window.__xk; h.deploy(h.makeSites()[0]); h.tac.sel.hp = 1; });
  await page.keyboard.press('Escape');
  const combatDownload = page.waitForEvent('download'); await page.getByRole('button', { name: 'Export save', exact: true }).click();
  const combat = await fs.readFile(await (await combatDownload).path(), 'utf8');
  await upload(combat); await page.waitForFunction(() => !window.__xk.pause.open);
  assert.equal(await page.evaluate(() => window.__xk.mode), 'geo');
  assert.ok(await page.evaluate(() => window.__xk.C.squad[0].hp > 1));
}, { path: '/?start=geo&seed=42', viewport: { width: 960, height: 600 } });
assert.deepEqual(errors, []); console.log('PASS portable save download/import, rejected files preserve campaign, persisted reload, combat HQ checkpoint');
