#!/usr/bin/env node
// Headless tactical check: a simple bot (advance + shoot) vs the alien AI over a few missions. node tools/xk-sim.mjs [missions]
import { newMission, newSquad, live, reach, pathTo, moveTo, shoot, endPlayerTurn, sees, computeSeen } from './examples/xkom/scripts/xk/tactical.js';
const N = +(process.argv[2] ?? 5); let squad = newSquad(3);
for (let m = 0; m < N; m++) {
  const s = newMission({ seed: 10 + m, squad, aliens: 4 + m });
  while (!s.result && s.turn < 40) {
    for (const u of live(s, 'x')) {
      for (let g = 0; g < 6; g++) { const foes = live(s, 'a').filter((a) => sees(s, u, a)); if (foes.length) { const t = foes[0], r = shoot(s, u, t, u.tu >= 80 ? 'aimed' : 'snap'); if (!r.ev) break; } else { const tgt = live(s, 'a')[0]; if (!tgt) break; const R = reach(s, u, u.tu); let b = null, bd = 1e9; for (const [k, v] of R) { const d = Math.hypot((k % 32) - tgt.x, ((k / 32) | 0) - tgt.y); if (d < bd) { bd = d; b = [k % 32, (k / 32) | 0]; } } if (!b || (b[0] === u.x && b[1] === u.y)) break; moveTo(s, u, b[0], b[1]); } }
    }
    if (!s.result) endPlayerTurn(s);
  }
  console.log(`mission ${m + 1}: ${s.result ?? 'timeout'} turn=${s.turn} aliens killed=${s.kills}/${s.aliensTotal} soldiers alive=${live(s, 'x').length}/6`);
  squad = squad.filter((_, i) => s.units[i]?.dead === false); while (squad.length < 6) squad.push(...newSquad(50 + squad.length, 1));
}
// research sanity
import { newResearch, start, advance, mods, TECHS } from './examples/xkom/scripts/xk/research.js';
const R = newResearch(), f = { v: 5000 }; console.log('laser first:', start(R, f, 'laser')); console.log('alloys:', start(R, f, 'alloys')); advance(R, 6); console.log('done', R.done, 'mods', JSON.stringify(mods(R)), 'techs', TECHS.length);
