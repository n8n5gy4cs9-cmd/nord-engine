#!/usr/bin/env node
// Sprite contracts, animation silhouettes, menu bounds and real controls; also runs against an offline export.
import assert from 'node:assert/strict';
import path from 'node:path';
import { ROOT, withPage } from './e2e-lib.mjs';
const project = path.resolve(process.argv[2] ?? path.join(ROOT, 'examples/vallout'));
const { errors } = await withPage(project, async page => {
  await page.waitForFunction(() => window.__valout?.ready, null, { timeout: 20000 });
  await page.mouse.click(3, 3); // Trusted first activation unlocks the owner's audio start gate.
  const art = await page.evaluate(() => {
    const { ctx } = window.__valout, ps = ctx.ps, checks = [], signatures = [];
    const contracts = { ground: [256, 32], walls: [224, 144], props: [240, 192], actors: [264, 384], boss: [528, 64], fx: [144, 16], items: [160, 24], ui: [128, 32], font: [96, 32], portraits: [256, 192], title: [640, 480], metal: [64, 64], world: [612, 346] };
    for (const [key, size] of Object.entries(contracts)) {
      const src = ps.textures.get(ctx.K[key]).getSourceImage(); checks.push([key, src.width === size[0] && src.height === size[1]]);
    }
    const src = ps.textures.get(ctx.K.actors).getSourceImage(), c = document.createElement('canvas'); c.width = 264; c.height = 384;
    const g = c.getContext('2d'); g.drawImage(src, 0, 0); const d = g.getImageData(0, 0, 264, 384).data;
    for (let row = 0; row < 12; row++) {
      const poses = [];
      for (let col = 0; col < 11; col++) {
        let n = 0, top = 32, bottom = 0, hash = 0;
        for (let y = 0; y < 32; y++) for (let x = 0; x < 24; x++) {
          const i = ((row * 32 + y) * 264 + col * 24 + x) * 4;
          if (d[i + 3] > 96) { n++; top = Math.min(top, y); bottom = Math.max(bottom, y); hash = (Math.imul(hash, 31) + d[i] + d[i + 1] * 7 + d[i + 2] * 13) >>> 0; }
        }
        checks.push([`actor ${row}:${col} visible`, n > 18]);
        if (row < 10 && col < 10) checks.push([`actor ${row}:${col} stable height`, bottom - top >= 27 && bottom >= 30]);
        if (col === 10) checks.push([`actor ${row} corpse near feet`, top >= 22]);
        poses.push(hash);
      }
      checks.push([`actor ${row} distinct walking poses`, poses[1] !== poses[2]]); signatures.push(poses);
    }
    return checks;
  });
  for (const [label, ok] of art) assert.ok(ok, label);
  console.log(`PASS ${art.length} sprite/animation checks`);
  await page.evaluate(() => { window.__valout.screens.create(); window.__valout.screens.start(); });
  await page.waitForTimeout(400);
  for (const method of ['inventory', 'character', 'nokia', 'options', 'wallGame']) {
    const bounds = await page.evaluate(method => {
      const s = window.__valout.screens; s[method](); const o = s.stack.at(-1);
      return o.L.texts.filter(t => t.o.text.trim()).map(t => {
        const b = t.img.getBounds(); return { text: t.o.text, fits: b.x >= o.x && b.y >= o.y && b.right <= o.x + o.w && b.bottom <= o.y + o.h };
      });
    }, method);
    for (const b of bounds) assert.ok(b.fits, `${method} text outside panel: ${b.text}`);
    await page.evaluate(() => window.__valout.screens.stack.at(-1).close());
  }
  console.log('PASS all menu text fits its panel');
  const volume = await page.evaluate(() => {
    const s = window.__valout.screens; s.options(); const o = s.stack.at(-1);
    const t = o.L.texts.find(t => t.o.text.startsWith('SOUND FX'));
    return { x: o.x + 224, y: o.y + 149, value: s.ctx.game.audio.volume('sfx'), textY: t.y, panelY: o.y };
  });
  assert.equal(volume.textY, volume.panelY + 145, 'volume label stays below Save/Load');
  await page.mouse.click(volume.x, volume.y);
  await page.waitForTimeout(150); // Phaser dispatches pointer events on the next game frame.
  assert.ok(await page.evaluate(before => window.__valout.ctx.game.audio.volume('sfx') < before, volume.value), 'real volume minus button works');
  await page.evaluate(() => window.__valout.screens.stack.at(-1).close());
  await page.keyboard.press('F10'); await page.keyboard.press('o');
  assert.ok(await page.evaluate(() => window.__valout.screens.stack.at(-1).L.texts.every(t => { const b = t.img.getBounds(), o = window.__valout.screens.stack.at(-1); return !t.o.text.trim() || b.right <= o.x + o.w; })), 'modern controls wrap inside options');
  console.log('PASS real volume controls and modern help wrapping');
}, { viewport: { width: 640, height: 480 } });
assert.deepEqual(errors, []);
console.log('PASS no errors or external network requests');
