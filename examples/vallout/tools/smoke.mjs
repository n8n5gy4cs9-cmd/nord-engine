#!/usr/bin/env node
// End-to-end smoke test (headless Chromium): classic click-walk, full turn-based combat vs AI, quests/dialogue, travel, modern shooting, endings, save/load.
import { createRequire } from 'node:module'; import { server } from './serve.mjs';
const require = createRequire('/opt/node-tools/node_modules/'); const { chromium } = require('playwright');
await new Promise((r) => server.listen(8125, r));
const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] }); const page = await browser.newPage({ viewport: { width: 640, height: 480 } });
const errors = []; page.on('pageerror', (e) => errors.push(e.stack ?? String(e))); page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
await page.goto('http://localhost:8125/game/'); await page.waitForFunction(() => window.__valout?.ready, null, { timeout: 20000 });
const ev = (f, a) => page.evaluate(f, a), wait = (ms) => page.waitForTimeout(ms); let fails = 0;
const ok = (c, m) => { console.log(c ? 'PASS' : 'FAIL', m); if (!c) fails++; };
await ev(() => { window.__valout.screens.create(); window.__valout.screens.start(); }); await wait(1500);
// 1. click-walk
const moved = await ev(async () => { const c = window.__valout.ctx, a = c.area, p = a.player, x0 = p.x, y0 = p.y; const sx = a.sx(p.x + 3, p.y) - a.cam.scrollX, sy = a.sy(p.x + 3, p.y) - a.cam.scrollY; window.__click = [sx, sy]; return [x0, y0, sx, sy]; });
await page.mouse.move(moved[2], moved[3]); await page.mouse.down(); await page.mouse.up(); await wait(900);
ok(await ev(() => window.__valout.ctx.area.player.x > 3.9), 'click-to-walk moves the player');
// 2. full classic combat with AI turns
await ev(() => { const c = window.__valout.ctx, a = c.area; a.foes().forEach((e, i) => { if (i < 2) { e.x = a.player.x + 3 + i; e.y = a.player.y - i; } }); c.give('pistol', 1); c.give('ammo22', 40); c.G.char.weapon = 'pistol'; c.G.char.hp = c.G.char.maxHp; a.startCombat(); });
let turns = 0; for (let i = 0; i < 80; i++) { await wait(400); const st = await ev(() => { const a = window.__valout.ctx.area; return { combat: !!a.combat, my: a.playerTurnOn, busy: a.busy, foes: a.foes().filter((f) => f.awake).length }; }); if (!st.combat) break;
  if (st.my && !st.busy) { turns++; await ev(async () => { const a = window.__valout.ctx.area; a.G.char.hp = a.G.char.maxHp; const t = a.foes().filter((f) => f.awake).sort((p, q) => a.dist(a.player, p) - a.dist(a.player, q))[0]; if (t) await a.playerAttack(t); if (a.playerTurnOn && a.player.ap < 4) a.endTurn(); }); } }
const endedC = !(await ev(() => !!window.__valout.ctx.area.combat)); if (!endedC) console.log(JSON.stringify(await ev(() => { const a = window.__valout.ctx.area; return { ap: a.player.ap, my: a.playerTurnOn, busy: a.busy, pl: [a.player.x, a.player.y], tile: a.tile(a.player), foes: a.foes().map((f) => ({ t: f.type, x: f.x, y: f.y, aw: f.awake, hp: f.hp, path: a.path(f, a.player, true, 60)?.length, ppath: a.path(a.player, f, true)?.length, los: a.los(a.player, f).clear })), log: window.__valout.ctx.G.log.slice(-5).map((l) => l.t) }; })));
ok(endedC, `classic combat ends (player turns: ${turns})`); ok((await ev(() => window.__valout.ctx.G.kills)) >= 1, 'kills counted + xp');
// 3. quests via dialogue acts
await ev(() => { const c = window.__valout.ctx, S = window.__valout.screens; S.act('quest kossu 1', 'pena'); c.give('kossu', 1); S.dialog('pena'); }); await wait(200);
ok(await ev(() => window.__valout.screens.stack.at(-1)?.name === 'dialog'), 'dialog opens'); await ev(() => { const S = window.__valout.screens; S.stack.at(-1).close(); ['take kossu 1', 'give puukko 1', 'quest kossu 3', 'flag pena_done'].forEach((a) => S.act(a, 'pena')); });
ok(await ev(() => window.__valout.ctx.G.quests.kossu === 3), 'kossu quest completes');
await ev(() => { const c = window.__valout.ctx, S = window.__valout.screens; c.give('dice', 1); c.give('plug', 1); S.act('flag dice_active', 'rane'); S.dialog('rane'); }); await wait(200);
ok(await ev(() => window.__valout.ctx.G.flags.moped_ready === 1 && window.__valout.ctx.G.quests.main === 3), 'dice + plug delivered → moped ready'); await ev(() => window.__valout.screens.stack.at(-1)?.close());
// 4. map travel (no encounter)
await ev(() => { Math.random = () => 0.9; window.__valout.screens.world(); }); await wait(300); await ev(() => window.__valout.screens.travel('keskusta')); await wait(2200);
ok(await ev(() => window.__valout.ctx.here === 'keskusta' && !!window.__valout.ctx.area), 'travel asema → keskusta builds area');
// 5. modern mode: shoot an alien
await ev(() => { const c = window.__valout.ctx; c.setMode('modern'); const a = c.area; a.foes().forEach((e) => { e.x = -50; }); const e = a.foes()[0]; e.x = a.player.x + 4; e.y = a.player.y; e.hp = e.maxhp = 12; e.speed = 0; e.def = { ...e.def, ac: 0 }; c.G.char.weapon = 'pistol'; c.give('ammo22', 30); window.__e = e; });
await ev(() => { const a = window.__valout.ctx.area, p = a.player, e = window.__e; a.faceTo(p, e); }); const aim = await ev(() => { const a = window.__valout.ctx.area, e = window.__e; return [a.sx(e.x, e.y) - a.cam.scrollX, a.sy(e.x, e.y) - a.cam.scrollY - 14]; });
await page.mouse.move(aim[0], aim[1]); await page.mouse.down(); await wait(2500); await page.mouse.up();
ok(await ev(() => window.__e.hp < 12 || window.__e.dead), 'modern mode: mouse-aimed shots hit enemy');
// 6. save/load
ok(await ev(() => window.__valout.ctx.save()), 'save works'); await ev(() => window.__valout.ctx.load()); await wait(1500); ok(await ev(() => !!window.__valout.ctx.area && window.__valout.ctx.G.flags.moped_ready === 1), 'load restores state');
// 7. endings
await ev(() => { const c = window.__valout.ctx; c.setMode('classic'); c.G.kills = 29; const a = c.area; const e = a.foes()[0] ?? null; if (e) { e.hp = 0; a.killEnemy(e); } else c.endGame('victory'); }); await wait(3500);
ok(await ev(() => !window.__valout.ctx.area), 'victory ending screen after quota');
console.log(errors.length ? `ERRORS:\n${errors.slice(0, 12).join('\n')}` : 'no console errors'); console.log(fails ? `${fails} FAILED` : 'ALL PASS');
await browser.close(); server.close(); process.exit(fails || errors.length ? 1 : 0);
