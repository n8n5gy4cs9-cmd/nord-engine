#!/usr/bin/env node
// Headless RTS sim check: node tools/rts-sim.mjs [xkom|redfront] [seconds]   — player bot builds tanks and attack-moves; prints the outcome.
import { newRts, step, train, order, U } from './examples/xkom/scripts/xk/rts.js';
const mode = process.argv[2] ?? 'xkom', secs = +(process.argv[3] ?? 600);
const s = newRts({ seed: 7, mode, bonus: 3 });
let sent = 0;
for (let t = 0; t < secs * 10 && !s.result; t++) {
  step(s, 0.1);
  if (t % 20 === 0) { train(s, 'p', s.credits.p > 1200 ? 'mtank' : 'rifle'); }
  if (t % 300 === 299) { const army = s.units.filter((u) => u.team === 'p' && u.type !== 'harv' && !u.order); if (army.length > 8) { const tgt = s.blds.find((b) => b.team === 'e'); order(s, army.map((u) => u.id), { kind: 'amove', x: Math.floor(tgt.tx), y: Math.floor(tgt.ty) + 2 }); sent++; } }
  s.ev.length = 0;
}
console.log(`${mode}: result=${s.result ?? 'running'} time=${s.time.toFixed(0)}s kills=${s.kills} credits p=${Math.round(s.credits.p)} e=${Math.round(s.credits.e)} units p=${s.units.filter((u) => u.team === 'p').length} e=${s.units.filter((u) => u.team === 'e').length} waves=${sent} playerBld=${s.blds.filter((b) => b.team === 'p').length}`);
