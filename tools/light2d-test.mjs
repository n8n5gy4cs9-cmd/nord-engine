#!/usr/bin/env node
// Headless test + screenshots for the Crypt of Embers example (fx.light2d library scripts). Needs Playwright + Chromium (see tools/e2e-lib.mjs).
// usage: node tools/light2d-test.mjs     → screenshots in target/light2d/
import fs from 'node:fs';
import assert from 'node:assert/strict';
import { withPage, waitReady, ROOT } from './e2e-lib.mjs';

const out = `${ROOT}/target/light2d`;
fs.mkdirSync(out, { recursive: true });
const { errors, result } = await withPage(`${ROOT}/examples/light2d`, async (page) => {
  await waitReady(page);
  assert.equal(await page.evaluate(() => window.__nord_error), undefined);
  const ev = (fn, ...a) => page.evaluate(fn, ...a);
  const wait = (ms) => page.waitForTimeout(ms);
  await wait(800);
  await page.screenshot({ path: `${out}/1-start.png` });

  // lights exist and answer gameplay queries
  const s = await ev(() => { const w = __nord.light2d, h = __nord.scene.find('Hero'); return { lights: w.lights.size, occ: w.occluders.size, atHero: w.lightAt(h.pos[0], h.pos[1]), far: w.lightAt(1200, 100) }; });
  assert.ok(s.lights >= 12 && s.occ >= 25, `lights/occluders registered ${JSON.stringify(s)}`);
  assert.ok(s.atHero > 0.3 && s.far === 0, `light at hero / far ${JSON.stringify(s)}`);

  // shadows: a point behind the pillar is dark with shadows, lit without
  const sh = await ev(async () => {
    const w = __nord.light2d, h = __nord.scene.find('Hero'); h.pos = [455, 300, 3];
    await new Promise((r) => setTimeout(r, 300));
    const on = w.lightAt(585, 300); w.shadows = false; const off = w.lightAt(585, 300); w.shadows = true;
    return { on, off };
  });
  assert.ok(sh.on === 0 && sh.off > 0.05, `pillar shadow ${JSON.stringify(sh)}`);
  await wait(300); await page.screenshot({ path: `${out}/2-pillar-shadow.png` });

  // beam: aim right and hold fire; a shade placed in the cone burns, one behind the pillar does not
  const beam = await ev(async () => {
    const g = __nord, h = g.scene.find('Hero'), tpl = g.scene.find('ShadeTemplate'); h.pos = [440, 420, 3];
    g.input.pointer.worldX = 900; g.input.pointer.worldY = 420; g.input.setKey('Mouse0', true);
    const mk = (x, y) => { const d = tpl.toJSON(true); d.enabled = true; d.transform.pos = [x, y, 3]; return g.scene.spawnData(d); };
    const sh = await mk(560, 420); window.__testShade = sh;
    await new Promise((r) => setTimeout(r, 400));
    const lit = g.light2d.lightAt(sh.pos[0], sh.pos[1]);
    return { lit, oil: h.scripts.find((s) => s.isLantern).oil };
  });
  assert.ok(beam.lit > 0.4, `shade in beam is lit ${JSON.stringify(beam)}`);
  await page.screenshot({ path: `${out}/3-beam.png` });
  await wait(2200);
  const dead = await ev(() => window.__testShade.destroyed);
  assert.ok(dead, 'shade burned up in the beam');
  await ev(() => __nord.input.setKey('Mouse0', false));

  // darkness: a shade in the dark chases and damages the hero
  const hurt = await ev(async () => {
    const g = __nord, h = g.scene.find('Hero'), tpl = g.scene.find('ShadeTemplate'); h.pos = [500, 700, 3];
    const d = tpl.toJSON(true); d.enabled = true; d.transform.pos = [780, 700, 3]; await g.scene.spawnData(d);
    const hs = h.scripts.find((x) => x.hp !== undefined && x.max !== undefined) ?? h.scripts.find((x) => 'inv' in x);
    await new Promise((r) => setTimeout(r, 3500));
    return hs.hp;
  });
  assert.ok(hurt < 5, `dark shade hurt the hero (hp ${hurt})`);

  // look dials: force / shadow strength / softness change the lightmap, not the gameplay light query
  const look = await ev(async () => {
    const sys = [...__nord.scene.all()].flatMap((e) => e.scripts).find((x) => x.setLook), px = () => { const c = sys.ctx.getImageData(0, 0, sys.lw, sys.lh).data; let t = 0; for (let i = 0; i < c.length; i += 4) t += c[i] + c[i + 1] + c[i + 2]; return t; };
    const wait = () => new Promise((r) => setTimeout(r, 250)); await wait();
    const base = px(); sys.setLook({ force: 2.5 }); await wait(); const bright = px(); sys.setLook({ force: 0.3 }); await wait(); const dim = px(); sys.setLook({ force: 1, shadowStrength: 0.4, softness: 3 });
    return { base, bright, dim, set: sys.setLook({ force: 99 }) };
  });
  assert.ok(look.bright > look.base && look.dim < look.base && look.set.force === 4, `look dials ${JSON.stringify(look)}`);
  await ev(() => [...__nord.scene.all()].flatMap((e) => e.scripts).find((x) => x.setLook).setLook({ force: 1, shadowStrength: 1, softness: 1 }));

  // brazier -> gate -> win
  await ev(() => { const h = __nord.scene.find('Hero'); h.scripts.find((s) => 'inv' in s).hp = 5; for (const b of __nord.scene.findByTag('brazier')) b.scripts.find((s) => s.ignite).ignite(); __nord.scene.find('Hero').pos = [380, 600, 3]; window.__won = false; __nord.events.on('game:win', () => { window.__won = true; }); });
  await wait(1200); await page.screenshot({ path: `${out}/4-braziers.png` });
  const win = await ev(async () => {
    const g = __nord, h = g.scene.find('Hero'), ex = g.scene.find('Exit'); h.pos = [ex.pos[0], ex.pos[1] + 20, 3];
    await new Promise((r) => setTimeout(r, 400));
    return { gateGone: !g.scene.find('Gate'), won: window.__won };
  });
  assert.ok(win.gateGone && win.won, `gate opens + win ${JSON.stringify(win)}`);
  await page.screenshot({ path: `${out}/5-win.png` });
  // restart keeps the lighting registry consistent
  const again = await ev(async () => { await __nord.restart(); await new Promise((r) => setTimeout(r, 600)); const w = __nord.light2d; return { lights: w.lights.size, occ: w.occluders.size }; });
  assert.ok(again.lights === 14 && again.occ === 33, `restart ${JSON.stringify(again)}`);

  const stats = await ev(() => ({ ...__nord.light2d.stats, scriptErrors: (__nord.errors ?? []).map((e) => `${e.script?.constructor?.name}.${e.method}: ${e.err?.message}`) }));
  assert.deepEqual(stats.scriptErrors, [], 'no script errors');
  return stats;
}, { viewport: { width: 960, height: 540 } });
assert.deepEqual(errors, [], `page errors: ${errors.join('\n')}`);
console.log('ok light2d', JSON.stringify({ ...result, ms: +result.ms.toFixed(2) }));
