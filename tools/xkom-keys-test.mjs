// Trusted keyboard events: held WASD, release, diagonals, RTS command conflicts and overlays.
import assert from 'node:assert/strict';
import { withPage, waitReady, ROOT } from './e2e-lib.mjs';
const project = process.argv[2] ?? 'xkom', dir = process.argv[3] ?? `${ROOT}/examples/${project}`;
const { errors } = await withPage(dir, async page => {
  await waitReady(page); await page.waitForFunction(() => (window.__xk ?? window.__rf)?.ready);
  await page.mouse.move(400, 300);
  await page.evaluate(() => { const h = window.__xk ?? window.__rf; h.update = () => {}; });
  const sample = async (mode, keys) => {
    await page.evaluate(m => { const h = window.__xk ?? window.__rf; h.panTween?.stop(); m === 'rts' ? h.rts.view(160, 160) : h.camCenter(384, 200); }, mode);
    for (const k of keys) await page.keyboard.down(k);
    const delta = await page.evaluate(m => { const h = window.__xk ?? window.__rf, before = [h.vx, h.vy]; h[m].update(0.1); return [h.vx - before[0], h.vy - before[1]]; }, mode);
    for (const k of keys) await page.keyboard.up(k);
    const released = await page.evaluate(m => { const h = window.__xk ?? window.__rf, before = [h.vx, h.vy]; h[m].update(0.1); return [h.vx - before[0], h.vy - before[1]]; }, mode);
    assert.deepEqual(released, [0, 0], `${mode} release stops scrolling`); return delta;
  };
  const directions = [['a', 0, -1], ['d', 0, 1], ['w', 1, -1], ['s', 1, 1], ['W', 1, -1], ['ArrowRight', 0, 1]];
  for (const [k, axis, sign] of directions) assert.equal(Math.sign((await sample('rts', [k]))[axis]), sign, `RTS ${k}`);
  assert.ok((await sample('rts', ['w', 'd'])).every((v, i) => i ? v < 0 : v > 0));
  await page.evaluate(() => { const r = (window.__xk ?? window.__rf).rts, u = r.s.units.find(u => u.team === 'p'); r.sel = new Set([u.id]); r.amove = false; u.order = { kind: 'move', x: u.x + 4, y: u.y }; });
  await page.keyboard.press('a'); assert.equal(await page.evaluate(() => (window.__xk ?? window.__rf).rts.amove), false, 'A only scrolls');
  await page.keyboard.press('s'); assert.ok(await page.evaluate(() => { const r = (window.__xk ?? window.__rf).rts; return r.s.units.find(u => r.sel.has(u.id)).order; }), 'S does not stop units');
  await page.keyboard.press('q'); assert.equal(await page.evaluate(() => (window.__xk ?? window.__rf).rts.amove), true);
  await page.keyboard.press('x'); assert.equal(await page.evaluate(() => { const r = (window.__xk ?? window.__rf).rts; return r.s.units.find(u => r.sel.has(u.id)).order; }), null);
  await page.screenshot({ path: `${ROOT}/docs/screenshots/${project}-rts.png` });
  await page.keyboard.down('d'); await page.keyboard.press('F1'); await page.keyboard.up('d'); await page.keyboard.press('Escape');
  assert.equal(await page.evaluate(() => !!(window.__xk ?? window.__rf).rts.keys.d), false, 'help clears held map keys');
  if (project === 'xkom') {
    await page.evaluate(() => { const h = window.__xk; h.leaveMission(); h.deploy(h.makeSites()[0]); });
    for (const [k, axis, sign] of directions) assert.equal(Math.sign((await sample('tac', [k]))[axis]), sign, `tactical ${k}`);
    const diag = await sample('tac', ['w', 'd']); assert.ok(diag[0] > 0 && diag[1] < 0);
    await page.keyboard.down('d'); await page.keyboard.press('p'); await page.keyboard.up('d'); await page.keyboard.press('p'); assert.equal(await page.evaluate(() => !!window.__xk.tac.keys.d), false);
    await page.keyboard.down('d'); await page.keyboard.press('F2'); await page.keyboard.up('d'); await page.keyboard.press('Escape'); assert.equal(await page.evaluate(() => !!window.__xk.tac.keys.d), false);
    await page.evaluate(() => { const h = window.__xk; h.leaveMission(); h.geoscape(); });
    for (const [key, field, sign] of [['a','yaw',-1],['d','yaw',1],['w','pitch',1],['s','pitch',-1],['W','pitch',1]]) {
      const before = await page.evaluate(f => window.__xk.geo[f], field); await page.keyboard.press(key);
      assert.equal(Math.sign(await page.evaluate(f => window.__xk.geo[f], field) - before), sign, `globe ${key}`);
    }
  }
}, { path: '/?start=rts&seed=42', viewport: { width: 960, height: 600 } });
assert.deepEqual(errors, []); console.log(`PASS ${project}: WASD/arrows, diagonals, key release, Q attack-move / X stop, overlays${project === 'xkom' ? ' and globe rotation' : ''}`);
