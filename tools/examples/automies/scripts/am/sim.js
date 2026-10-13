// Automies — the whole game world without any rendering: cars, traffic, police, checkpoints, damage, felony, timer. The view (automies.js) only draws it
// and feeds `sim.input[slot]` (a pad object) — so the mission, the AI and the handling are all testable in node (tools/am-sim.mjs --mission).
import { Car, DT } from './car.js';
import { CARS, CIVILIAN } from './cars.js';
import { carVsWorld, carVsCar } from './collide.js';
import { CivDriver, Chaser } from './traffic.js';
import { cpWorld, DIR_VEC, dirYaw } from './city.js';

export const MISSION = { time: 100, cpBonus: 12, maxCops: 4, civs: 16, respawnDelay: 3, respawnPenalty: 6, finishRadius: 12 };
const TINTS = ['#c0392b', '#2980b9', '#27ae60', '#8e44ad', '#e67e22', '#16a085', '#7f8c8d', '#d35400', '#34495e', '#bdc3c7'];
const PLAYER_CARS = ['muscle', 'coupe'];

export class Sim {
  constructor(city, rnd, { players = 1, civs = MISSION.civs, bots = false, cops = true } = {}) {
    Object.assign(this, { cops, city, rnd, actors: [], players: [], input: {}, events: [], t: 0, acc: 0, time: MISSION.time, over: null, nextId: 1, copTimer: 2, bots });
    for (let i = 0; i < players; i++) this.addPlayer(i + 1);
    for (let i = 0; i < civs; i++) this.addCiv();
    if (cops) for (let i = 0; i < 2; i++) this.addCop();
  }
  actor(kind, type, extra = {}) {
    const a = { id: this.nextId++, kind, type, car: new Car(CARS[type], { civ: kind === 'civ' }), driver: null, wreck: false, wreckT: 0, tint: extra.tint ?? CARS[type].color, ...extra };
    this.actors.push(a); return a;
  }
  addPlayer(slot) {
    const a = this.actor('player', PLAYER_CARS[(slot - 1) % PLAYER_CARS.length], { slot }), s = this.city.starts.find((p) => p.slot === slot) ?? this.city.starts[0], [x, z] = this.city.center(s.cx, s.cy);
    Object.assign(a.car, { x: x + s.ox, z: z + s.oz, yaw: s.yaw });
    const p = { slot, actor: a, cp: 0, done: false, finishT: null, respawn: 0, felony: 0, lastCell: [s.cx, s.cy], crashes: 0, speedMax: 0 };
    if (this.bots) a.bot = new Chaser(a.car, this.city, () => (p.cp < this.city.cps.length ? { ...cpWorld(this.city, p.cp), then: p.cp + 1 < this.city.cps.length ? cpWorld(this.city, p.cp + 1) : null } : null), { cruise: 38 });
    this.players.push(p); return p;
  }
  randomRoad(minDist = 0, avoid = true) {
    for (let k = 0; k < 40; k++) {
      const r = this.city.roads[Math.floor(this.rnd() * this.city.roads.length)], [x, z] = this.city.center(r.cx, r.cy);
      if (this.city.isWorks(r.cx, r.cy)) continue;
      if (!avoid || this.players.every((p) => Math.hypot(p.actor.car.x - x, p.actor.car.z - z) >= minDist)) return r;
    }
    return this.city.roads[0];
  }
  addCiv() {
    const type = CIVILIAN[Math.floor(this.rnd() * CIVILIAN.length)], a = this.actor('civ', type, { tint: type.startsWith('truck') || type === 'taxi' || type === 'van' ? undefined : TINTS[Math.floor(this.rnd() * TINTS.length)] });
    a.tint ??= TINTS[Math.floor(this.rnd() * TINTS.length)]; if (type === 'taxi') a.tint = CARS.taxi.color; if (type === 'van') a.tint = '#e8e8e8'; if (type.startsWith('truck')) a.tint = null; // Kenney trucks keep their own colours
    this.placeCiv(a); return a;
  }
  placeCiv(a) {
    let r = this.randomRoad(70);
    for (let k = 0; k < 30; k++) { const [x, z] = this.city.center(r.cx, r.cy); if (this.actors.every((o) => o === a || Math.hypot(o.car.x - x, o.car.z - z) > 14)) break; r = this.randomRoad(70); } // not on top of another car
    const dirs = this.city.nbrs(r.cx, r.cy).map(([d]) => d), dir = dirs[Math.floor(this.rnd() * dirs.length)] ?? 0;
    if (!a.driver) a.driver = new CivDriver(a.car, this.city, this.rnd, [r.cx, r.cy], dir); else a.driver.reset([r.cx, r.cy], dir);
    a.car.damage = 0; a.wreck = false;
  }
  addCop() {
    const a = this.actor('cop', 'cop', { cop: true }); a.car.boost = 1;
    a.driver = new Chaser(a.car, this.city, () => this.copTarget(a), { cruise: 42 }); this.placeCop(a); return a;
  }
  placeCop(a) {
    const r = this.randomRoad(110), [x, z] = this.city.center(r.cx, r.cy), dirs = this.city.nbrs(r.cx, r.cy).map(([d]) => d), d = dirs[Math.floor(this.rnd() * dirs.length)] ?? 0;
    Object.assign(a.car, { x, z, yaw: dirYaw(d), vx: 0, vz: 0, w: 0, damage: 0, thrust: 0, wheelAngle: 0 }); a.wreck = false; a.lost = 0; a.since = 0;
  }
  copTarget(a) { let best = null, bd = Infinity; for (const p of this.players) { if (p.actor.wreck || p.done) continue; const d = Math.hypot(p.actor.car.x - a.car.x, p.actor.car.z - a.car.z) - p.felony * 0.4; if (d < bd) { bd = d; best = p.actor.car; } } return best; }
  emit(e) { this.events.push(e); }

  update(dt) { this.acc += Math.min(dt, 0.25); while (this.acc >= DT) { this.acc -= DT; this.tick(); } }
  tick() {
    this.t += DT; const cars = this.actors.map((a) => a.car);
    for (const a of this.actors) {
      let pad;
      if (a.wreck) pad = { handbrake: true };
      else if (a.kind === 'player') pad = a.bot ? a.bot.drive(this.t) : this.input[a.slot] ?? {};
      else if (a.kind === 'civ') pad = a.driver.drive(cars);
      else pad = a.driver.drive(this.t);
      const p = a.kind === 'player' && this.players.find((q) => q.actor === a); if (p && (p.done || this.over)) pad = { handbrake: true };
      a.car.step(pad, this.city.grass);
    }
    // collisions: two relaxation passes
    for (let it = 0; it < 2; it++) {
      for (const a of this.actors) carVsWorld(a.car, this.city, it === 0 ? (c, sp, pt) => this.emit({ type: 'crash', actor: a, speed: sp, x: pt[0], z: pt[1], world: true }) : null);
      for (let i = 0; i < this.actors.length; i++) for (let j = i + 1; j < this.actors.length; j++) {
        const A = this.actors[i], B = this.actors[j]; if (A.wreck && B.wreck) continue;
        carVsCar(A.car, B.car, it === 0 ? (a, b, sp, pt) => { this.emit({ type: 'crash', actor: A, other: B, speed: sp, x: pt[0], z: pt[1] }); this.felonyFor(A, B, sp); this.felonyFor(B, A, sp); } : null);
      }
    }
    this.gameplay();
  }
  felonyFor(a, b, sp) { if (a.kind !== 'player' || sp < 3.5) return; const p = this.players.find((q) => q.actor === a); p.crashes++; if (b.kind === 'civ') p.felony = Math.min(100, p.felony + 2 + sp * 0.5); else if (b.kind === 'cop') p.felony = Math.min(100, p.felony + 3 + sp * 0.4); }
  gameplay() {
    const dt = DT, over = !!this.over;
    if (!over) { const racing = this.players.some((p) => !p.done); if (racing) this.time -= dt; }
    for (const p of this.players) {
      const a = p.actor, c = a.car; p.speedMax = Math.max(p.speedMax, c.speed);
      p.felony = Math.max(0, p.felony - dt * 0.9);
      if (c.damage >= 100 && !a.wreck && !p.done) { a.wreck = true; a.wreckT = 0; p.respawn = MISSION.respawnDelay; this.emit({ type: 'wreck', actor: a, slot: p.slot }); }
      if (a.wreck) { p.respawn -= dt; if (p.respawn <= 0 && !over) this.respawn(p); }
      if (!over && !p.done && !a.wreck && p.cp < this.city.cps.length) {
        const w = cpWorld(this.city, p.cp); if (Math.hypot(w.x - c.x, w.z - c.z) < MISSION.finishRadius) {
          p.cp++; this.time += MISSION.cpBonus; const cell = this.city.cps[p.cp - 1]; p.lastCell = [cell.cx, cell.cy];
          this.emit({ type: 'checkpoint', slot: p.slot, index: p.cp - 1, last: p.cp >= this.city.cps.length });
          if (p.cp >= this.city.cps.length) { p.done = true; p.finishT = this.t; this.emit({ type: 'finish', slot: p.slot }); this.over = { winner: p.slot, reason: 'finish' }; this.emit({ type: 'over', ...this.over }); }
        }
      }
    }
    if (!over && this.time <= 0) { this.time = 0; const best = [...this.players].sort((a, b) => b.cp - a.cp)[0]; const tie = this.players.length > 1 && this.players[0].cp === this.players[1].cp; this.over = { winner: tie ? null : best.slot, reason: 'time' }; this.emit({ type: 'over', ...this.over }); }
    // wrecked / lost cops and civs
    const maxFel = Math.max(0, ...this.players.map((p) => p.felony)), wantCops = Math.min(MISSION.maxCops, 2 + Math.floor(maxFel / 30) + (this.t > 60 ? 1 : 0));
    const cops = this.actors.filter((a) => a.kind === 'cop');
    this.copTimer -= dt; if (this.cops && cops.length < wantCops && this.copTimer <= 0) { this.addCop(); this.copTimer = 4; this.emit({ type: 'cop-spawn' }); }
    for (const a of this.actors) {
      if (a.kind === 'civ') { if (a.car.damage >= 100 && !a.wreck) { a.wreck = true; a.wreckT = 0; } if (a.wreck) { a.wreckT += dt; if (a.wreckT > 6) this.placeCiv(a); } else if (a.driver.needsRespawn) { this.placeCiv(a); } }
      if (a.kind === 'cop') {
        if (a.car.damage >= 100 && !a.wreck) { a.wreck = true; a.wreckT = 0; this.emit({ type: 'wreck', actor: a }); }
        if (a.wreck) { a.wreckT += dt; if (a.wreckT > 4) this.placeCop(a); continue; }
        const tg = this.copTarget(a), d = tg ? Math.hypot(tg.x - a.car.x, tg.z - a.car.z) : 0;
        a.car.boost = d > 80 ? 1.12 : d > 40 ? 1.04 : 0.97; // rubber-banding: far cops catch up, close ones ease off (D2 does the same to its chasers)
        a.lost = d > 300 ? (a.lost ?? 0) + dt : 0; if (a.lost > 6) this.placeCop(a);
        if (a.car.speed < 0.6) a.since = (a.since ?? 0) + dt; else a.since = 0; if (a.since > 7) this.placeCop(a);
      }
    }
  }
  respawn(p) {
    const a = p.actor, c = a.car, cell = p.lastCell, nextI = Math.min(p.cp, this.city.cps.length - 1), n = this.city.cps[nextI], path = this.city.path(cell, [n.cx, n.cy]);
    const [x, z] = this.city.center(...cell); let yaw = c.yaw; if (path && path.length > 1) { const [dx, dy] = [path[1][0] - path[0][0], path[1][1] - path[0][1]]; yaw = Math.atan2(dx, dy); }
    Object.assign(c, { x, z, yaw, vx: 0, vz: 0, w: 0, damage: 0, thrust: 0, wheelAngle: 0, revs: 0 }); a.wreck = false; this.time = Math.max(1, this.time - MISSION.respawnPenalty);
    for (const o of this.actors) if (o !== a && Math.hypot(o.car.x - x, o.car.z - z) < 8) { if (o.kind === 'civ') this.placeCiv(o); else if (o.kind === 'cop') this.placeCop(o); }
    this.emit({ type: 'respawn', slot: p.slot });
  }
}
