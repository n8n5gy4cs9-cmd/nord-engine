// RetroPaxDungeons (examples/retropaxdungeons): boots, an in-page bot plays through the real view code (events → sprites, HUD, fog) until the game ends;
// asserts no script/page errors, the HUD/log fill, and screenshots the boss fight + end screen. Rules balance: tools/rpd-sim.mjs (no browser).
import fs from 'node:fs';
import { suites, withPage, waitReady, nonBlank, ROOT } from '../e2e-lib.mjs';

fs.mkdirSync(`${ROOT}/target/e2e`, { recursive: true });
suites['rpd'] = async () => {
  const { errors, result } = await withPage(`${ROOT}/examples/retropaxdungeons`, async (page) => {
    await waitReady(page, 30000);
    await page.waitForFunction(() => window.__rpd?.ready, null, { timeout: 20000 });
    await page.waitForTimeout(500);
    const start = await page.screenshot({ path: `${ROOT}/target/e2e/rpd-start.png` });
    const colors = await nonBlank(page, start);
    // bot: walk to items, fight, drink potions, go for the Goo (drives the real view: d.act() → events → sprites)
    await page.evaluate(async () => {
      const { findPath } = await import('/scripts/rpd/pathfinder.js');
      const d = window.__rpd, w = d.w, h = w.hero, sleep = (ms) => new Promise((r) => setTimeout(r, ms));
      const step = (to) => { const [x, y] = w.xy(h.pos), [tx, ty] = w.xy(to); return d.act({ type: 'move', dx: Math.sign(tx - x), dy: Math.sign(ty - y) }); };
      const go = (c, ok) => { const p = findPath(w.w, w.h, h.pos, c, ok ?? ((i) => w.passable(i))); return p?.length ? step(p[0]) : false; };
      for (let i = 0; i < 3000 && w.state === 'play'; i++) {
        const adj = w.mobs.find((m) => m.hp > 0 && Math.max(Math.abs((m.pos % w.w) - (h.pos % w.w)), Math.abs(((m.pos / w.w) | 0) - ((h.pos / w.w) | 0))) === 1);
        if (h.hp < h.ht * 0.4) { const p = h.inv.findIndex((x) => x.type === 'potion'); if (p >= 0) { d.act({ type: 'use', index: p }); await sleep(8); continue; } }
        if (h.hunger > 320) { const f = h.inv.findIndex((x) => x.type === 'food'); if (f >= 0) { d.act({ type: 'use', index: f }); continue; } }
        if (adj) step(adj.pos);
        else {
          let best = null, bd = 1e9;
          for (const [c] of w.items) { const p = findPath(w.w, w.h, h.pos, c, (k) => w.passable(k)); if (p && p.length < bd) { bd = p.length; best = c; } }
          if (best !== null) go(best); else if (w.goo.hp > 0) { if (h.hp < h.ht * 0.8) d.act({ type: 'rest' }); else go(w.goo.pos); } else go(w.downCell, (k) => w.passable(k) || k === w.downCell);
        }
        if (w.goo.state === 'hunting' && !window.__bossShot) { window.__bossShot = true; await sleep(300); window.__needShot = 'boss'; await sleep(500); }
        await sleep(6);
        d.cool = 0;
      }
    });
    await page.screenshot({ path: `${ROOT}/target/e2e/rpd-boss.png` });
    await page.waitForTimeout(1800);
    const end = await page.screenshot({ path: `${ROOT}/target/e2e/rpd-end.png` });
    const info = await page.evaluate(() => { const d = window.__rpd, w = d.w; return { state: w.state, turn: Math.round(w.turn), lvl: w.hero.lvl, kills: w.kills, goo: w.goo.hp, log: d.log.length, errs: window.__nord.errors.length, overlay: d.overlay[0].visible }; });
    return { colors, info, endColors: await nonBlank(page, end) };
  }, { viewport: { width: 960, height: 540 } });
  console.log(JSON.stringify(result));
  if (errors.length) throw new Error(errors.join('\n'));
  if (result.info.errs) throw new Error('script errors');
  if (result.colors < 12) throw new Error('start screen looks blank');
  if (result.info.state === 'play') throw new Error('bot did not finish the game');
  if (!result.info.overlay) throw new Error('end screen not shown');
  if (!result.info.log) throw new Error('log empty');
};
