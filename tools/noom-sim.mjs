#!/usr/bin/env node
// Headless sanity test for Noom's rules (no browser): level connectivity, monsters wake + chase + hurt the player, barrels chain-explode,
// shotgun damage, doors/keys. usage: node tools/noom-sim.mjs [-map]
import { Sim, W, H, TIC } from './examples/noom/scripts/noom/sim.js';

const s = new Sim();
if (process.argv.includes('-map')) {
  for (let y = 0; y < H; y++) { let r = ''; for (let x = 0; x < W; x++) { const i = y * W + x, d = s.doors.get(i); const m = s.mobjs.find((o) => Math.floor(o.x) === x && Math.floor(o.y) === y); r += d ? d.t : s.pillars.has(i) ? 'u' : s.solid[i] ? '#' : m ? ({ skeleton: 's', goblin: 'g', imp: 'i', baron: 'B', barrel: 'o', flask: 'p', bigflask: 'M', shells: 'e', armor: 'a', key: 'k', gun: 'W', torch: 'f', bones: 'b' }[m.type] ?? '?') : Math.floor(s.player.x) === x && Math.floor(s.player.y) === y ? '@' : '.'; } console.log(r); }
}
let fails = 0; const check = (c, m) => { if (!c) { console.log('FAIL', m); fails++; } else console.log('ok  ', m); };
// 1) connectivity (doors count as passable; exit gate cell must touch a reachable cell)
const seen = new Set(), q = [[Math.floor(s.player.x), Math.floor(s.player.y)]]; seen.add(q[0][1] * W + q[0][0]);
for (let h = 0; h < q.length; h++) for (const [ox, oy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const x = q[h][0] + ox, y = q[h][1] + oy, i = y * W + x; if (x < 0 || y < 0 || x >= W || y >= H || seen.has(i)) continue; const d = s.doors.get(i); if (s.solid[i] && !d) continue; seen.add(i); if (!d || d.t !== 'X') q.push([x, y]); }
const reach = (t) => s.mobjs.filter((o) => !t || o.type === t).every((o) => seen.has(Math.floor(o.y) * W + Math.floor(o.x)));
check(reach(), 'every thing is reachable from the start');
check([...s.doors.values()].every((d) => seen.has(d.i)), 'every door/exit is reachable');
// 2) a skeleton notices the player, chases and eventually hurts them
const sk = s.mobjs.find((m) => m.type === 'skeleton' && m.x > 20 && m.x < 24 && m.y < 27); s.player.x = sk.x - 3; s.player.y = sk.y; s.player.a = 0;
let hurt = false; for (let t = 0; t < 35 * 30 && !hurt; t++) { s.ticker(); if (s.player.hp < 100) hurt = true; }
check(hurt, `skeleton archer wounds the player (hp ${s.player.hp})`);
// 3) a goblin bites in melee
const s2 = new Sim(); const gb = s2.mobjs.find((m) => m.type === 'goblin' && !m.flags.ambush); s2.player.x = gb.x - 2; s2.player.y = gb.y; s2.player.a = 0; s2.noiseAlert?.();
let bit = false; for (let t = 0; t < 35 * 20 && !bit; t++) { s2.ticker(); if (s2.player.hp < 100) bit = true; }
check(bit, `goblin reaches and bites (hp ${s2.player.hp})`);
// 4) shotgun kills an imp, barrel chain
const s3 = new Sim(); s3.player.weapons.gun = true; s3.player.cur = 'gun'; s3.player.ammo = 50;
const imp = s3.mobjs.find((m) => m.type === 'imp'); s3.player.x = imp.x - 1.5; s3.player.y = imp.y; s3.player.a = 0; imp.hp = 60;
let shots = 0; for (let t = 0; t < 35 * 15 && !imp.dead; t++) { s3.updatePlayer(TIC, { fire: true }); s3.ticker(); if (s3.player.wframe === 'gun_fire') shots++; }
check(imp.dead, `shotgun kills an imp at 1.5 cells (${s3.player.ammo} shells left, hp ${s3.player.hp})`);
const s4 = new Sim(); const bs = s4.mobjs.filter((m) => m.kind === 'barrel' && m.x > 23 && m.x < 26 && m.y > 27); s4.player.x = bs[0].x - 3; s4.player.y = bs[0].y; s4.player.a = 0; s4.player.weapons.gun = true; s4.player.cur = 'gun';
for (let t = 0; t < 40 && !bs[0].dead; t++) { s4.updatePlayer(TIC, { fire: true }); s4.ticker(); }
for (let t = 0; t < 40; t++) s4.ticker();
check(bs.every((b) => b.dead || !s4.mobjs.includes(b)), 'barrels explode and chain');
// 5) locked door
const s5 = new Sim(); const k = [...s5.doors.values()].find((d) => d.t === 'K'); s5.player.x = k.x + 0.5; s5.player.y = k.y + 1.5; s5.player.a = -Math.PI / 2; s5.use();
check(k.mode === 'closed', 'blue door stays shut without the key'); s5.player.keys.blue = true; s5.use(); for (let t = 0; t < 60; t++) s5.ticker();
check(k.open >= 1 || k.mode.startsWith('open'), 'blue door opens with the key');
// 6) long idle run is stable and deterministic enough not to throw
const s6 = new Sim(); for (let t = 0; t < 35 * 120; t++) s6.ticker();
check(s6.player.hp === 100, 'two quiet minutes pass without anything attacking a sleeping player');
process.exit(fails ? 1 : 0);
