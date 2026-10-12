// Harrison's Command — the simulation (no Babylon): carrier navigation, your Walrus/Manta units, enemy towers/mortars/HQ and drones.
// Weapon/structure numbers are real Warzone 2100 stats (wz-stats.json, GPL-2.0+); damage = max(damage/3, damage - armour) like WZ's armour rule.
// World axes: x east, z north (the map's "up"), y up; yaw 0 = facing +z, positive yaw turns toward +x. Metres.
import { groundAt, ISLANDS } from './layout.js';

export const TILE = 6;                        // metres per Warzone tile (stat ranges are in 1/128 tile)
const rangeM = (w) => (w.longRange / 128) * TILE;
const pauseS = (w) => (w.firePause ?? 30) / 10;
export const dmgAfter = (damage, armour) => Math.max(damage / 3, damage - armour);
const dist2 = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const angDiff = (a, b) => { let d = (b - a) % (Math.PI * 2); if (d > Math.PI) d -= Math.PI * 2; if (d < -Math.PI) d += Math.PI * 2; return d; };

export const STERN = 56;                      // metres behind the carrier's centre where units splash in / dock

export class Sim {
  constructor(wz, rnd = Math.random) {
    this.wz = wz; this.rnd = rnd; this.t = 0; this.events = []; this.nextId = 1; this.won = false; this.lost = false; this.kills = 0;
    const W = (k) => ({ ...wz.weapons[k], range: rangeM(wz.weapons[k]), pause: pauseS(wz.weapons[k]) });
    this.W = { mg: W('MG3Mk1'), cannon: W('Cannon1Mk1'), rocket: W('Rocket-Pod'), mortar: W('Mortar1Mk1'), mg1: W('MG1Mk1') };
    this.ship = { x: 0, z: 0, yaw: 0, speed: 0, target: null, hp: 1000, max: 1000, armour: 10, maxSpeed: 6, grounded: false };
    this.units = []; this.structs = []; this.drones = []; this.waveT = 40; this.waves = 0;
  }
  id() { return this.nextId++; }
  emit(e) { this.events.push(e); }
  drain() { const e = this.events; this.events = []; return e; }
  shipPos(dx = 0, dz = 0) { const s = this.ship, c = Math.cos(s.yaw), n = Math.sin(s.yaw); return { x: s.x + dx * c + dz * n, z: s.z - dx * n + dz * c }; }

  addUnit(type, bay) {
    const wzb = this.wz.bodies, def = type === 'walrus' ? { hp: wzb.Body11ABT.hitpoints, armour: wzb.Body11ABT.armourKinetic, weapon: this.W.cannon, air: false, speedSea: 9, speedLand: 5, name: 'WALRUS' }
      : { hp: wzb.Body3MBT.hitpoints, armour: wzb.Body3MBT.armourKinetic, weapon: this.W.rocket, air: true, speedSea: 22, speedLand: 22, name: 'MANTA' };
    const u = { id: this.id(), type, ...def, max: def.hp, bay, state: 'docked', x: 0, z: 0, y: 0, yaw: 0, tyaw: 0, order: null, cd: 0, label: `${def.name}-${this.units.filter((q) => q.type === type).length + 1}`, launchT: 0, from: null };
    this.units.push(u); return u;
  }
  addStruct(type, x, z, isle) {
    const S = this.wz.structures, d = type === 'tower' ? S.GuardTower1 : type === 'mortar' ? S['Emplacement-MortarPit01'] : S.A0CommandCentre;
    const s = { id: this.id(), type, x, z, y: groundAt(x, z), hp: d.hitpoints, max: d.hitpoints, armour: d.armour, weapon: type === 'tower' ? this.W.mg : type === 'mortar' ? this.W.mortar : null, cd: this.rnd() * 2, yaw: 0, isle, name: type === 'hq' ? 'ENEMY HQ' : type === 'tower' ? 'GUN TOWER' : 'MORTAR PIT' };
    this.structs.push(s); return s;
  }

  // ---- orders ----
  setCourse(x, z) { this.ship.target = { x, z }; this.ship.grounded = false; }
  orderMove(u, x, z) { if (u.state === 'docked') this.launch(u); if (u.state === 'dead') return; u.order = { kind: 'move', x, z }; u.state = u.state === 'docked' ? 'launching' : 'active'; }
  orderAttack(u, target) { if (u.state === 'docked') this.launch(u); u.order = { kind: 'attack', target }; if (u.state === 'docked') u.state = 'launching'; }
  recall(u) { if (u.state === 'docked') return; u.order = { kind: 'recall' }; if (u.state === 'launching') u.state = 'active'; }
  launch(u) { const p = this.shipPos(...u.bay); u.from = { ...p }; const q = this.shipPos(0, -STERN); u.x = p.x; u.z = p.z; u.state = 'launching'; u.launchT = 1.8; u.to = q; this.emit({ type: 'launch', unit: u.id }); }

  // ---- stepping ----
  update(dt) {
    if (this.won || this.lost) return;
    this.t += dt; this.navigate(dt); for (const u of this.units) this.updateUnit(u, dt);
    for (const s of this.structs) this.updateStruct(s, dt);
    this.updateDrones(dt);
    this.waveT -= dt; if (this.waveT <= 0 && this.structs.some((s) => s.type === 'hq' && s.hp > 0)) { this.waveT = 70; this.spawnWave(); }
    const hq = this.structs.find((s) => s.type === 'hq'); if (hq && hq.hp <= 0) { this.won = true; this.emit({ type: 'win' }); }
    if (this.ship.hp <= 0) { this.lost = true; this.emit({ type: 'lose' }); }
  }
  navigate(dt) {
    const s = this.ship; let want = 0;
    if (s.target) {
      const dx = s.target.x - s.x, dz = s.target.z - s.z, d = Math.hypot(dx, dz);
      if (d < 12) { s.target = null; } else {
        const da = angDiff(s.yaw, Math.atan2(dx, dz)); s.yaw += Math.max(-0.11 * dt, Math.min(0.11 * dt, da));
        want = Math.abs(da) > 0.9 ? s.maxSpeed * 0.3 : Math.min(s.maxSpeed, d * 0.25 + 0.5);
      }
    }
    s.speed += Math.max(-1.5 * dt, Math.min(1.0 * dt, want - s.speed));
    const nx = s.x + Math.sin(s.yaw) * s.speed * dt, nz = s.z + Math.cos(s.yaw) * s.speed * dt;
    if (groundAt(nx, nz) > 0.4 || groundAt(nx + Math.sin(s.yaw) * 45, nz + Math.cos(s.yaw) * 45) > 1.2) { if (s.speed > 0.1) { s.grounded = true; s.target = null; } s.speed = Math.max(0, s.speed - 4 * dt); if (groundAt(nx, nz) > 0.4) return; }
    s.x = nx; s.z = nz;
  }
  hitShip(dmg, weapon, from) { const d = dmgAfter(dmg, this.ship.armour); this.ship.hp = Math.max(0, this.ship.hp - d); this.emit({ type: 'shipHit', dmg: d, weapon, from }); }

  enemiesOf(u) {
    const out = []; for (const s of this.structs) if (s.hp > 0) out.push({ kind: 'struct', ref: s }); if (u.air) for (const d of this.drones) if (d.hp > 0) out.push({ kind: 'drone', ref: d });
    return out;
  }
  updateUnit(u, dt) {
    if (u.state === 'dead') return;
    u.cd = Math.max(0, u.cd - dt);
    if (u.state === 'docked') { u.hp = Math.min(u.max, u.hp + 14 * dt); const p = this.shipPos(...u.bay); u.x = p.x; u.z = p.z; u.yaw = this.ship.yaw; return; }
    if (u.state === 'launching') { // splash from the bay to the water behind the stern
      u.launchT -= dt; const q = this.shipPos(0, -STERN), t = 1 - Math.max(0, u.launchT) / 1.8, p0 = u.from; u.x = p0.x + (q.x - p0.x) * t; u.z = p0.z + (q.z - p0.z) * t; u.y = Math.sin(t * Math.PI) * 4;
      if (u.launchT <= 0) { u.state = 'active'; u.y = 0; this.emit({ type: 'splash', x: u.x, z: u.z }); if (!u.order) u.order = { kind: 'move', x: u.x, z: u.z - 0 }; } return;
    }
    // active: move toward the order
    let goal = null, stopAt = 2, o = u.order;
    if (o?.kind === 'move') goal = o; else if (o?.kind === 'attack') { const t = o.target; if (!t || t.hp <= 0) { u.order = null; } else { goal = t; stopAt = u.weapon.range * 0.8; } } else if (o?.kind === 'recall') { goal = this.shipPos(0, -STERN); stopAt = 6; }
    const ground = u.air ? 0 : groundAt(u.x, u.z), speed = (ground > 0.6 ? u.speedLand : u.speedSea);
    if (goal) {
      const dx = goal.x - u.x, dz = goal.z - u.z, d = Math.hypot(dx, dz);
      if (d <= stopAt) { if (o.kind === 'recall') this.dock(u); else if (o.kind === 'move') u.order = null; } else { u.tyaw = Math.atan2(dx, dz); u.yaw += Math.max(-2.2 * dt, Math.min(2.2 * dt, angDiff(u.yaw, u.tyaw))); const k = Math.min(speed * dt, d - stopAt * 0.5); u.x += Math.sin(u.yaw) * k; u.z += Math.cos(u.yaw) * k; }
    }
    u.y = u.air ? 14 + groundAt(u.x, u.z) : 0;
    // fire at the best target in range
    if (u.cd <= 0) {
      let best = null, bd = u.weapon.range;
      for (const e of this.enemiesOf(u)) { const d = dist2(u, e.ref); if (d < bd) { bd = d; best = e; } }
      if (o?.kind === 'attack' && o.target?.hp > 0 && dist2(u, o.target) < u.weapon.range) best = { kind: 'struct', ref: o.target };
      if (best) { u.cd = u.weapon.pause; const t = best.ref; this.emit({ type: 'shot', from: { x: u.x, y: u.y + 2, z: u.z }, to: { x: t.x, y: (t.y ?? 0) + 2, z: t.z }, kind: u.type === 'walrus' ? 'cannon' : 'rocket', by: u.id }); this.damage(best, u.weapon.damage, u); u.turretYaw = Math.atan2(t.x - u.x, t.z - u.z); }
    }
  }
  dock(u) { u.state = 'docked'; u.order = null; this.emit({ type: 'docked', unit: u.id }); }
  damage(target, dmg, by) {
    const t = target.ref; if (t.hp <= 0) return; t.hp -= dmgAfter(dmg, t.armour ?? 0);
    if (t.hp <= 0) { t.hp = 0; this.kills++; this.emit({ type: 'boom', x: t.x, y: t.y ?? 0, z: t.z, big: target.kind === 'struct', kind: target.kind, id: t.id }); }
  }
  updateStruct(s, dt) {
    if (s.hp <= 0 || !s.weapon) return; s.cd -= dt; if (s.cd > 0) return;
    const w = s.weapon, targets = [];
    for (const u of this.units) if (u.state === 'active' && dist2(s, u) < w.range * (u.air ? 0.9 : 1)) targets.push({ kind: 'unit', ref: u, d: dist2(s, u) });
    const sd = dist2(s, this.ship); if (sd < w.range) targets.push({ kind: 'ship', ref: this.ship, d: sd - (s.type === 'mortar' ? 30 : 0) });
    if (!targets.length) { s.cd = 0.4; return; }
    targets.sort((a, b) => a.d - b.d); const t = targets[0]; s.cd = w.pause; s.yaw = Math.atan2(t.ref.x - s.x, t.ref.z - s.z);
    const miss = this.rnd() < (s.type === 'mortar' ? 0.35 : 0.25); this.emit({ type: 'shot', from: { x: s.x, y: s.y + (s.type === 'tower' ? 5.4 : 2), z: s.z }, to: { x: t.ref.x + (miss ? 6 : 0), y: t.kind === 'ship' ? 3 : (t.ref.y ?? 0) + 1.5, z: t.ref.z }, kind: s.type === 'mortar' ? 'mortar' : 'mg', by: s.id, miss });
    if (miss) return; if (t.kind === 'ship') this.hitShip(w.damage, w.name, { x: s.x, z: s.z }); else { t.ref.hp -= dmgAfter(w.damage, t.ref.armour); if (t.ref.hp <= 0) { t.ref.hp = 0; t.ref.state = 'dead'; this.emit({ type: 'boom', x: t.ref.x, y: t.ref.y, z: t.ref.z, big: true, kind: 'unit', id: t.ref.id }); } }
  }
  spawnWave() {
    this.waves++; const hq = this.structs.find((s) => s.type === 'hq'); for (let i = 0; i < Math.min(3, 1 + this.waves); i++) this.drones.push({ id: this.id(), x: hq.x + i * 8, z: hq.z - 10, y: 25, hp: 30, max: 30, armour: 0, cd: 1 + i * 0.7, ang: this.rnd() * 6.28, orbit: 38 + this.rnd() * 10 });
    this.emit({ type: 'wave', n: this.waves });
  }
  updateDrones(dt) {
    const s = this.ship;
    for (const d of this.drones) {
      if (d.hp <= 0) continue; d.ang += dt * 0.35; const tx = s.x + Math.cos(d.ang) * d.orbit, tz = s.z + Math.sin(d.ang) * d.orbit, dx = tx - d.x, dz = tz - d.z, k = Math.min(1, 16 * dt / Math.max(1, Math.hypot(dx, dz)));
      d.yaw = Math.atan2(dx, dz); d.x += dx * k; d.z += dz * k; d.y += (22 - d.y) * dt; d.cd -= dt;
      if (d.cd <= 0 && Math.hypot(s.x - d.x, s.z - d.z) < 60) { d.cd = 1.8; const hit = this.rnd() < 0.55; this.emit({ type: 'shot', from: { x: d.x, y: d.y, z: d.z }, to: { x: s.x + (hit ? 0 : 8), y: 4, z: s.z }, kind: 'drone', by: d.id, miss: !hit }); if (hit) this.hitShip(this.W.mg1.damage, 'Drone', { x: d.x, z: d.z }); }
    }
    this.drones = this.drones.filter((d) => d.hp > 0 || (d.dead = true) && false);
  }
}

/** The one level: islands, enemy installations and the starting fleet. */
export function buildLevel(sim) {
  const isle = Object.fromEntries(ISLANDS.map((i) => [i.id, i]));
  const g = isle.gamma, b = isle.beta;
  sim.addStruct('hq', g.x, g.z + 18, 'gamma');
  for (const [dx, dz] of [[30, -55], [-35, -50], [55, 0], [-60, 15]]) sim.addStruct('tower', g.x + dx, g.z + dz, 'gamma');
  for (const [dx, dz] of [[0, -28], [10, 52]]) sim.addStruct('mortar', g.x + dx, g.z + dz, 'gamma');
  for (const [dx, dz] of [[-20, -20], [25, 12]]) sim.addStruct('tower', b.x + dx, b.z + dz, 'beta');
  const bays = [[-5.5, -43], [5.5, -43], [-5.5, -35.5], [5.5, -35.5], [-1.2, -46], [1.2, -33]];
  ['walrus', 'walrus', 'walrus', 'walrus', 'manta', 'manta'].forEach((t, i) => sim.addUnit(t, bays[i]));
  sim.ship.x = 0; sim.ship.z = 0; sim.ship.yaw = 0.35;
}
