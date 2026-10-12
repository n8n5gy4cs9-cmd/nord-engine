#!/usr/bin/env node
// Headless balance / sanity simulation of RetroPaxDungeons' rules (no browser): a simple bot walks to items, fights, drinks potions,
// and hunts the Goo. usage: node tools/rpd-sim.mjs [seeds=40] [heroLevel=4] [-v]
import { World, HUNTING } from './examples/retropaxdungeons/scripts/rpd/world.js';
import { findPath } from './examples/retropaxdungeons/scripts/rpd/pathfinder.js';

const N = +(process.argv[2] ?? 40), LVL = +(process.argv[3] ?? 4), verbose = process.argv.includes('-v');
const stats = { won: 0, dead: 0, stuck: 0, turns: [], gooHp: [] };
for (let seed = 1; seed <= N; seed++) {
  const w = new World({ seed, heroLevel: LVL }), h = w.hero;
  let steps = 0;
  const step = (to) => { const [x, y] = w.xy(h.pos), [tx, ty] = w.xy(to); return w.heroAct({ type: 'move', dx: Math.sign(tx - x), dy: Math.sign(ty - y) }); };
  const goTo = (c, passable) => { const p = findPath(w.w, w.h, h.pos, c, passable ?? ((i) => w.passable(i) && i !== w.upCell && i !== w.downCell)); return p?.length ? step(p[0]) : false; };
  const trail = [];
  while (w.state === 'play' && steps++ < 4000) {
    for (const e of w.drain()) if (verbose && (e.t === 'msg')) { trail.push(`${Math.round(w.turn)} hp${h.hp} ${e.text}`); if (trail.length > 14) trail.shift(); }
    const adj = w.mobs.find((m) => m.hp > 0 && Math.max(Math.abs(m.pos % w.w - h.pos % w.w), Math.abs(((m.pos / w.w) | 0) - ((h.pos / w.w) | 0))) === 1);
    // emergency: drink the most plentiful unknown potion, preferring known healing
    if (h.hp < h.ht * 0.4) {
      const heal = h.inv.findIndex((i) => i.type === 'potion' && w.potionOf[i.key] === 'healing' && w.known.has('healing')) ;
      const any = heal >= 0 ? heal : h.inv.findIndex((i) => i.type === 'potion');
      if (any >= 0) { w.heroAct({ type: 'use', index: any }); continue; }
    }
    const arm = h.inv.findIndex((i) => i.type === 'armor' && i.key === 'leatherArmor' && h.armor !== 'leatherArmor'); if (arm >= 0) { w.heroAct({ type: 'use', index: arm }); continue; }
    const sw = h.inv.findIndex((i) => i.type === 'weapon' && i.key === 'sword' && h.weapon !== 'sword' && h.str >= 13); if (sw >= 0) { w.heroAct({ type: 'use', index: sw }); continue; }
    if (h.hunger > 320) { const f = h.inv.findIndex((i) => i.type === 'food'); if (f >= 0) { w.heroAct({ type: 'use', index: f }); continue; } }
    if (adj) { step(adj.pos); continue; }
    const hunting = w.mobs.find((m) => m.state === HUNTING && !m.isGoo && m.hp > 0 && w.fov[m.pos]);
    if (hunting) { if (!goTo(hunting.pos, (i) => w.passable(i))) w.heroAct({ type: 'rest' }); continue; }
    // pick up the nearest item, then go for the goo
    let best = null, bd = 1e9;
    for (const [c] of w.items) { const p = findPath(w.w, w.h, h.pos, c, (i) => w.passable(i) && i !== w.upCell && i !== w.downCell); if (p && p.length < bd) { bd = p.length; best = c; } }
    if (best !== null) { if (!goTo(best)) w.heroAct({ type: 'rest' }); continue; }
    if (h.hp < h.ht * 0.7 && !w.goo.hp <= 0) { w.heroAct({ type: 'rest' }); continue; } // rest up before the boss
    if (w.goo.hp > 0) { if (!goTo(w.goo.pos, (i) => w.passable(i))) w.heroAct({ type: 'rest' }); }
    else if (!goTo(w.downCell, (i) => w.passable(i) && i !== w.upCell)) w.heroAct({ type: 'rest' });
  }
  const r = w.state === 'play' ? 'stuck' : w.state;
  stats[r === 'won' ? 'won' : r === 'dead' ? 'dead' : 'stuck']++; stats.turns.push(Math.round(w.turn)); stats.gooHp.push(w.goo.hp);
  if (verbose && r !== 'won') console.log(trail.join('\n'));
  if (verbose) console.log(`seed ${seed}: ${r} turn ${Math.round(w.turn)} lvl ${h.lvl} hp ${h.hp}/${h.ht} goo ${w.goo.hp} kills ${w.kills} ${w.endCause}`);
}
const avg = (a) => Math.round(a.reduce((x, y) => x + y, 0) / a.length);
console.log(`hero lvl ${LVL}: won ${stats.won}/${N}, dead ${stats.dead}, stuck ${stats.stuck}; avg turns ${avg(stats.turns)}; avg Goo hp left ${avg(stats.gooHp)}`);
process.exit(stats.stuck > N * 0.2 ? 1 : 0);
