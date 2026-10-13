// Real rendered glyph bounds and tactical HUD containment, at the actual game resolution.
import assert from 'node:assert/strict';
import { withPage, waitReady, ROOT } from './e2e-lib.mjs';
const { errors, result } = await withPage(process.argv[2] ?? `${ROOT}/examples/xkom`, async page => {
  await waitReady(page); await page.waitForFunction(() => window.__xk?.ready);
  const bounds = await page.evaluate(() => {
    const h = window.__xk, v = h.tac;
    const ink = t => {
      const c = t.img.canvas, d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
      let top = c.height, bottom = 0;
      for (let y = 0; y < c.height; y++) for (let x = 0; x < c.width; x++) if (d[(y * c.width + x) * 4 + 3]) { top = Math.min(top, y); bottom = Math.max(bottom, y + 1); }
      const k = t.img.height / c.height;
      return t.img.y - t.img.displayOriginY + (top + bottom) / 2 * k;
    };
    return { barBottom: v.barHp.y + v.barHp.height, panelBottom: 197,
      buttons: v.btns.map(b => ({ label: b.t.img.text, center: ink(b.t), expected: b.y + b.h / 2, size: parseFloat(b.t.img.style.fontSize), width: b.t.img.width, available: b.w - 6 })) };
  });
  assert.ok(bounds.barBottom <= bounds.panelBottom - 1, `HP bar spills out of inset panel: ${JSON.stringify(bounds)}`);
  for (const b of bounds.buttons) { assert.ok(Math.abs(b.center - b.expected) <= 0.6, `label not vertically centered: ${JSON.stringify(b)}`); assert.ok(b.size <= 7); assert.ok(b.width <= b.available); }
  await page.screenshot({ path: '/tmp/xkom-layout.png' });
  const other = await page.evaluate(() => {
    const h = window.__xk, results = [];
    const check = (text, x, y, w, hh) => {
      const img = h.hud.list.find(o => o.text === text), c = img.canvas, d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
      let l = c.width, r = 0, t = c.height, b = 0;
      for (let yy = 0; yy < c.height; yy++) for (let xx = 0; xx < c.width; xx++) if (d[(yy * c.width + xx) * 4 + 3]) { l = Math.min(l, xx); r = Math.max(r, xx + 1); t = Math.min(t, yy); b = Math.max(b, yy + 1); }
      results.push({ text, dx: img.x - img.displayOriginX + (l + r) / 2 * img.width / c.width - (x + w / 2), dy: img.y - img.displayOriginY + (t + b) / 2 * img.height / c.height - (y + hh / 2) });
    };
    h.leaveMission(); h.titleScreen(); check('BEGIN CAMPAIGN  [ENTER]', 16, 166, 152, 17);
    h.geoscape(); const labels = ['BASE  [B]', 'HQ / GLOBE  [Z]', 'ZOOM +', 'ZOOM -', '< WEST', 'EAST >'];
    h.geoBtns.forEach((q, i) => check(labels[i], q.x, q.y, q.w, q.h));
    h.baseScreen(); check('LFT', 6, 24, 22, 22); check('HANGAR', 30, 72, 46, 46); check('BACK [B]', 262, 183, 56, 13);
    h.intercept(h.makeSites()[0]); h.air.radarBtns.forEach(q => check(q.label, 220, q.y, 94, 23));
    return results;
  });
  for (const q of other) assert.ok(Math.abs(q.dx) < 0.6 && Math.abs(q.dy) < 0.6, `misaligned label: ${JSON.stringify(q)}`);

  return bounds;
}, { path: '/?start=tac&seed=42', viewport: { width: 960, height: 600 } });
assert.deepEqual(errors, []); console.log('PASS centered compact button text and contained TU/HP bars', result);
