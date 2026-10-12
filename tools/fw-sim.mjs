#!/usr/bin/env node
// Forgotten Wars headless sim: AI vs AI on the shipped map. usage: node tools/fw-sim.mjs [games=6] [maxDays=60]
import fs from 'node:fs';
import { parseMap, newGame, doMove, doAttack, doCapture, doWait, doBuild, endTurn } from './examples/forgotten/scripts/fw/rules.js';
import { aiNext } from './examples/forgotten/scripts/fw/ai.js';
const text = fs.readFileSync(new URL('./examples/forgotten/assets/maps/crossing.map', import.meta.url), 'utf8');
export function play(seed, maxDays = 60) {
  const g = newGame(parseMap(text), { seed });
  let guard = 0;
  while (!g.winner && g.day <= maxDays && guard++ < 20000) {
    const a = aiNext(g);
    if (a.end) { endTurn(g); continue; }
    if (a.build) { doBuild(g, g.current, a.build.x, a.build.y, a.build.type); continue; }
    const u = a.unit;
    if (a.path.length > 1) doMove(g, u, a.path);
    if (a.act === 'attack') doAttack(g, u, a.target); else if (a.act === 'capture') doCapture(g, u); else doWait(g, u);
  }
  return g;
}
if (process.argv[1] === new URL(import.meta.url).pathname) {
  const n = +process.argv[2] || 6, maxDays = +process.argv[3] || 60, res = { ember: 0, cobalt: 0, none: 0 }; let days = 0;
  for (let s = 1; s <= n; s++) { const g = play(s, maxDays); res[g.winner ?? 'none']++; days += g.day; console.log(`seed ${s}: winner=${g.winner ?? '-'} day=${g.day} units E${g.units.filter((u) => u.owner === 'ember').length}/C${g.units.filter((u) => u.owner === 'cobalt').length} funds ${g.funds.ember}/${g.funds.cobalt}`); }
  console.log(res, 'avg day', (days / n).toFixed(1));
}
