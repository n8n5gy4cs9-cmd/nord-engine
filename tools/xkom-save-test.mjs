import assert from 'node:assert/strict';
import { withPage, waitReady, ROOT } from './e2e-lib.mjs';
const { errors, result } = await withPage(process.argv[2] ?? `${ROOT}/examples/xkom`, async page => {
  const ready = async () => { await waitReady(page); await page.waitForFunction(() => window.__xk?.ready); };
  const press = key => page.keyboard.press(key);
  await ready(); await page.mouse.click(480, 300); await press('Enter');
  assert.equal(await page.evaluate(() => !!window.__xk.savedCampaign()), true);
  await page.evaluate(() => { const h = window.__xk; h.C.funds = 12345; h.C.R.done = ['alloys']; h.C.R.active = 'laser'; h.C.R.progress = 2; h.C.towns[0].occupied = true; h.C.clockSeconds = 20; h.C.clockPaused = true; });
  await press('p'); await page.waitForFunction(() => window.__xk.pause.open);
  await page.getByRole('button', { name: 'Save campaign', exact: true }).click();
  const saved = await page.evaluate(() => window.__xk.savedCampaign());
  assert.equal(saved.C.funds, 12345);
  await page.reload(); await ready(); assert.ok(await page.evaluate(() => window.__xk.screenObjs.some(o => o.img?.text === 'CONTINUE  [ENTER]')));
  await page.mouse.click(480, 300); assert.equal(await page.evaluate(() => window.__xk.mode), 'title'); assert.equal(await page.evaluate(() => window.__xk.saveCampaign()), false); assert.deepEqual(await page.evaluate(() => window.__xk.savedCampaign()), saved); await press('Enter');
  assert.deepEqual(await page.evaluate(() => window.__xk.C), saved.C);
  // Single names, multiple count, compact bitmap costs clear the 16px icon.
  await page.evaluate(() => window.__xk.startRts());
  const names = await page.evaluate(() => { const r = window.__xk.rts, units = r.s.units.filter(u => u.team === 'p'); r.sel = new Set([units[0].id]); r.hudRefresh(); const unit = r.tSel.o.text; r.sel = new Set([r.s.blds.find(b => b.type === 'fact' && b.team === 'p').id]); r.hudRefresh(); const building = r.tSel.o.text; r.sel = new Set(units.slice(0, 2).map(u => u.id)); r.hudRefresh(); return { unit, building, multiple: r.tSel.o.text, costs: r.h.hud.list.filter(o => o.texture?.key?.startsWith('ptext')).map(o => ({ w: o.width, h: o.height, x: o.x, y: o.y })) }; });
  assert.notEqual(names.unit, 'SELECTED 1'); assert.equal(names.building, 'CONSTRUCTION YARD'); assert.equal(names.multiple, 'SELECTED 2');
  assert.ok(names.costs.filter(o => [102, 134, 166].includes(o.y)).every(o => o.w <= 30 && o.h <= 9));
  await page.screenshot({ path: `${ROOT}/docs/screenshots/xkom-rts.png` });
  await press('Escape'); const t = await page.evaluate(() => window.__xk.rts.s.time); await page.waitForTimeout(200); assert.equal(await page.evaluate(() => window.__xk.rts.s.time), t);
  await page.getByRole('button', { name: 'Save campaign', exact: true }).click(); await page.getByRole('button', { name: 'Load campaign', exact: true }).click(); assert.equal(await page.evaluate(() => window.__xk.mode), 'geo');
  assert.equal(await page.evaluate(() => window.__xk.C.funds), 12345);
  // Pause/load during the actual walk replay must cancel old scene callbacks cleanly.
  await page.evaluate(() => { const h = window.__xk; h.deploy(h.makeSites()[0]); const v = h.tac, u = v.sel; const dest = [...v.reachMap].find(([k, t]) => t.tu >= 12 && t.tu <= 20); if (!dest) throw Error('No walking destination'); v.move(u, dest[0] % 32, Math.floor(dest[0] / 32)); });
  assert.equal(await page.evaluate(() => window.__xk.tac.busy), true); await press('p'); await page.getByRole('button', { name: 'Load campaign', exact: true }).click(); await page.waitForTimeout(1200); assert.equal(await page.evaluate(() => window.__xk.mode), 'geo');
  // Full finale: score alone isn't a win; research -> raid -> assault -> ending.
  await page.evaluate(() => { const h = window.__xk; h.C.kills = h.attrs.goal; h.afterEvent(); }); assert.equal(await page.evaluate(() => window.__xk.mode), 'geo');
  await page.evaluate(() => { const h = window.__xk; h.C.R.done = ['alloys','laser','elerium']; h.geoscape(); }); await press('f'); assert.equal(await page.evaluate(() => window.__xk.mode), 'tac');
  await press('Escape'); await page.getByRole('button', { name: 'Save campaign', exact: true }).click(); await page.getByRole('button', { name: 'Load campaign', exact: true }).click(); assert.equal(await page.evaluate(() => window.__xk.C.sourceSecured), false);
  await press('f'); await page.evaluate(() => { const h = window.__xk; h.tacDone({ win: true, kills: 12, dead: 0, survivors: structuredClone(h.C.squad) }); }); assert.equal(await page.evaluate(() => window.__xk.C.sourceSecured), true);
  await press('f'); assert.equal(await page.evaluate(() => window.__xk.finalOperation), true);
  await page.evaluate(() => window.__xk.rtsDone({ win: true, kills: 10 })); assert.equal(await page.evaluate(() => window.__xk.mode), 'end'); assert.equal(await page.evaluate(() => window.__xk.savedCampaign()), null);
  // Corrupt/obsolete saves do not offer Continue or break boot.
  await page.evaluate(() => window.__xk.game.save.set('campaign', { version: 0, C: {} })); await page.reload(); await ready(); assert.equal(await page.evaluate(() => window.__xk.savedCampaign()), null);
  return await page.evaluate(() => window.__nord.errors.map(e => e.err?.message));
}, { path: '/?seed=42', viewport: { width: 960, height: 600 } });
assert.deepEqual(errors, []); assert.deepEqual(result, []); console.log('PASS persisted Continue, campaign checkpoints, pause/load mid-walk, RTS names/costs, complete finale, obsolete save');
