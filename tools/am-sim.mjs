#!/usr/bin/env node
// Automies handling test bench (headless): acceleration, top speed, braking, skid-pad steering, handbrake turn for every car. usage: node tools/am-sim.mjs [car…]
import { Car, DT } from './examples/automies/scripts/am/car.js';
import { CARS } from './examples/automies/scripts/am/cars.js';
const kmh = (v) => (v * 3.6).toFixed(0);
export function run(name, secs, padFn, init = {}) {
  const c = new Car(CARS[name], { yaw: 0 }); Object.assign(c, init); const log = [];
  for (let i = 0; i < secs / DT; i++) { c.step(padFn(i * DT, c)); log.push({ t: i * DT, x: c.x, z: c.z, v: c.speed, f: c.forward, w: c.w, yaw: c.yaw, rev: c.revs, gear: c.gear }); }
  return { c, log };
}
const given = process.argv.slice(2).filter((n) => CARS[n]);
const names = process.argv.includes('--mission') ? [] : given.length ? given : ['muscle', 'coupe', 'cop', 'taxi', 'van', 'truckR'];
for (const n of names) {
  const acc = run(n, 20, () => ({ accel: true }));
  const t100 = acc.log.find((l) => l.v * 3.6 >= 100)?.t, t60 = acc.log.find((l) => l.v * 3.6 >= 60)?.t, top = acc.log.at(-1).v;
  // brake from 25 m/s
  const br = run(n, 6, (t) => ({ brake: true }), { vz: 25 }); const stopL = br.log.find((l) => l.v < 0.5), stopAt = stopL?.t, dist = stopL?.z ?? br.log.at(-1).z;
  // skid pad: full lock at 20 and 30 m/s, hold throttle gently (keyboard-style steering ramp)
  const pad = (v0) => { const s = run(n, 5, (t, c) => ({ left: false, right: true, accel: c.speed < v0 }), { vz: v0 }); const l = s.log.slice(-30); const w = l.reduce((a, b) => a + b.w, 0) / l.length; const vv = l.reduce((a, b) => a + b.v, 0) / l.length; return { w, r: vv / Math.abs(w), v: vv, slip: Math.abs(Math.atan2(s.c.vx * Math.cos(s.c.yaw) - s.c.vz * Math.sin(s.c.yaw), s.c.forward)) * 57.3 }; };
  const p20 = pad(20), p30 = pad(30);
  // handbrake turn: 20 m/s, steer right + handbrake for 0.8 s
  const hb = run(n, 3, (t) => ({ right: t < 1.0, handbrake: t > 0.2 && t < 1.0, accel: false }), { vz: 20 });
  console.log(`${n.padEnd(7)} 0-60 ${t60?.toFixed(1) ?? '-'}s  0-100 ${t100?.toFixed(1) ?? '-'}s  top ${kmh(top)} km/h | brake 25m/s→0 in ${stopAt?.toFixed(1) ?? '>6'}s ${dist.toFixed(0)}m | circle@20: r=${p20.r.toFixed(0)}m yaw ${p20.w.toFixed(2)}rad/s slip ${p20.slip.toFixed(0)}° | @30: r=${p30.r.toFixed(0)}m slip ${p30.slip.toFixed(0)}° | handbrake turn: heading change ${(hb.c.yaw * 57.3).toFixed(0)}° speed left ${kmh(hb.c.speed)} km/h`);
}

// ---- mission bench: node tools/am-sim.mjs --mission [seconds] [players] : a bot drives the checkpoint route through traffic and police -------------------------------------
if (process.argv.includes('--mission')) {
  const fs = await import('node:fs');
  const { parseCity } = await import('./examples/automies/scripts/am/city.js');
  const { Sim } = await import('./examples/automies/scripts/am/sim.js');
  const city = parseCity(fs.readFileSync(new URL('./examples/automies/assets/maps/haven.map', import.meta.url), 'utf8'));
  const nums = process.argv.filter((a) => /^\d+$/.test(a)).map(Number), secs = nums[0] ?? 120, players = nums[1] ?? 1;
  let s = 5; const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  const sim = new Sim(city, rnd, { players, bots: true });
  const tally = {}; let last = 0;
  for (let t = 0; t < secs; t += 1 / 30) {
    sim.update(1 / 30);
    for (const e of sim.events) { tally[e.type] = (tally[e.type] ?? 0) + 1; if (e.type === 'checkpoint') console.log(`t=${sim.t.toFixed(1)}s P${e.slot} checkpoint ${e.index + 1}/${city.cps.length}  time left ${sim.time.toFixed(0)}s`); if (e.type === 'wreck' && e.actor.kind === 'player') console.log(`t=${sim.t.toFixed(1)}s P${e.slot} WRECKED`); if (e.type === 'over') console.log('OVER', JSON.stringify(e)); }
    sim.events.length = 0;
    if (sim.t - last > 20) { last = sim.t; console.log(`t=${sim.t.toFixed(0)}s`, sim.players.map((p) => `P${p.slot} cp${p.cp} dmg${p.actor.car.damage.toFixed(0)} fel${p.felony.toFixed(0)} v${(p.actor.car.speed * 3.6).toFixed(0)}km/h`).join(' | '), `cops ${sim.actors.filter((a) => a.kind === 'cop').length} civs ${sim.actors.filter((a) => a.kind === 'civ').length}`); }
    if (sim.over) break;
  }
  console.log('events', tally, 'time left', sim.time.toFixed(0), sim.over);
  const civs = sim.actors.filter((a) => a.kind === 'civ'); console.log('civ speeds km/h', civs.map((a) => (a.car.speed * 3.6).toFixed(0)).join(' '));
}
