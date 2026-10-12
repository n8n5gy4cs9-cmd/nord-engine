// Automies — computer drivers. They only produce a "pad" (the same input a player gives), so AI cars use exactly the same Driver 2 handling as the player.
//   CivDriver: follows the right-hand lane along the road graph, slows for turns and for cars ahead, recovers when stuck.
//   Chaser:    police (and the node test bot): BFS path over road cells to a target, pure-pursuit steering, powerslides tight corners with the handbrake.
import { LANE, TILE, DIR_VEC, right } from './city.js';

const TAU = Math.PI * 2, clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const wrap = (a) => { while (a > Math.PI) a -= TAU; while (a < -Math.PI) a += TAU; return a; };
/** analogue pad value for a wanted front-wheel angle (rad): the inverse of the cubic steering curve in car.js (angle units = s³/6400). */
export const steerFor = (rad, fast = false) => { const u = (rad * 4096) / TAU, s = Math.sign(u) * Math.cbrt(Math.abs(u) * (fast ? 3200 : 6400)); return clamp(s, -127, 127); };
const headingError = (c, tx, tz) => wrap(Math.atan2(tx - c.x, tz - c.z) - c.yaw); // + = target is to the right
const steerTowards = (c, e, speed, pad) => { pad.fast = Math.abs(e) > 0.9; pad.steer = steerFor(clamp((e * 1.15) / (1 + speed / 22), -0.62, 0.62), pad.fast); return pad; };
const lane = (d) => DIR_VEC[right(d)].map((v) => v * LANE);

/** Is `other` inside a box ahead of car c (forward `f` metres, half width `w`)? Returns the forward distance or Infinity. */
export function ahead(c, other, f = 16, w = 2.3) {
  const dx = other.x - c.x, dz = other.z - c.z, s = Math.sin(c.yaw), co = Math.cos(c.yaw), fwd = dx * s + dz * co, lat = dx * co - dz * s;
  return fwd > 0 && fwd < f && Math.abs(lat) < w + (other.cos.width ?? 1.9) / 2 ? fwd : Infinity;
}

export class CivDriver {
  constructor(car, city, rnd, cell, dir) {
    Object.assign(this, { car, city, rnd, route: [], stuck: 0, reverse: 0, lost: 0, cruise: 10 + rnd() * 6, turnSpeed: 6 + rnd() * 2 });
    this.route.push({ cx: cell[0], cy: cell[1], dIn: dir, dOut: dir });
    this.reset(cell, dir);
  }
  reset(cell, dir) {
    const c = this.car, [x, z] = this.city.center(...cell), l = lane(dir);
    this.route = [{ cx: cell[0], cy: cell[1], dIn: dir, dOut: this.pickOut(cell, dir) }];
    c.x = x + l[0]; c.z = z + l[1]; c.yaw = [Math.PI, Math.PI / 2, 0, -Math.PI / 2][dir]; c.vx = c.vz = c.w = 0; c.damage = 0; this.stuck = this.reverse = this.lost = this.jam = this.waiting = 0; this.ignore = 0;
    this.extend();
  }
  pickOut(cell, dIn) {
    const opts = this.city.nbrs(cell[0], cell[1]).filter(([d]) => d !== (dIn + 2) % 4); if (!opts.length) return (dIn + 2) % 4;
    const w = opts.map(([d]) => (d === dIn ? 3 : 1)), tot = w.reduce((a, b) => a + b, 0); let r = this.rnd() * tot;
    for (let i = 0; i < opts.length; i++) { r -= w[i]; if (r <= 0) return opts[i][0]; } return opts[0][0];
  }
  extend() { while (this.route.length < 4) { const l = this.route.at(-1), [dx, dy] = DIR_VEC[l.dOut], cx = l.cx + dx, cy = l.cy + dy; if (!this.city.isRoad(cx, cy)) { l.dOut = (l.dOut + 2) % 4; continue; } this.route.push({ cx, cy, dIn: l.dOut, dOut: this.pickOut([cx, cy], l.dOut) }); } }
  vertex(e) { const [x, z] = this.city.center(e.cx, e.cy), a = lane(e.dIn), b = e.dIn === e.dOut ? [0, 0] : lane(e.dOut); return [x + a[0] + b[0], z + a[1] + b[1]]; }
  /** others: array of cars to avoid. Returns a pad. */
  drive(others, dt = 1 / 30) {
    const c = this.car; this.extend();
    let v = this.vertex(this.route[0]);
    if (this.route.length > 1) { const [vx, vz] = v, [dx, dz] = DIR_VEC[this.route[0].dOut]; if ((c.x - vx) * dx + (c.z - vz) * dz > -3 || Math.hypot(c.x - vx, c.z - vz) < 5) { this.route.shift(); v = this.vertex(this.route[0]); } }
    const next = this.route[1] && this.vertex(this.route[1]), tgt = Math.hypot(v[0] - c.x, v[1] - c.z) < 9 && next ? next : v;
    const e = headingError(c, tgt[0], tgt[1]), speed = c.forward;
    let want = this.cruise;
    const turning = this.route.slice(0, 2).some((r) => r.dIn !== r.dOut); if (turning && Math.hypot(v[0] - c.x, v[1] - c.z) < 28) want = Math.min(want, this.turnSpeed);
    let gap = Infinity; if (!(this.ignore > 0)) for (const o of others) if (o !== c) gap = Math.min(gap, ahead(c, o));
    if (this.ignore > 0) this.ignore -= dt;
    if (gap < Infinity && Math.abs(speed) < 0.5) { this.waiting = (this.waiting ?? 0) + dt; if (this.waiting > 3) { this.ignore = 4; this.waiting = 0; this.jam = (this.jam ?? 0) + 1; } } else if (Math.abs(speed) > 2) { this.waiting = 0; this.jam = Math.max(0, (this.jam ?? 0) - dt * 0.05); } // gridlock breaker: nudge forward anyway
    if (gap < Infinity) want = Math.min(want, Math.max(0, (gap - 6) * 1.2));
    const pad = steerTowards(c, e, Math.abs(speed), {});
    if (this.reverse > 0) { this.reverse -= dt; pad.brake = true; pad.steer = -pad.steer; return pad; }
    if (speed < want - 0.5) pad.accel = true; else if (speed > want + 1.5) pad.brake = speed > 1; else if (want === 0 && speed < 1.5) pad.handbrake = true;
    if (want > 1 && Math.abs(speed) < 0.4) { this.stuck += dt; if (this.stuck > 2) { this.reverse = 1.1; this.stuck = 0; this.lost += 1; } } else if (Math.abs(speed) > 2) { this.stuck = 0; this.lost = Math.max(0, this.lost - dt * 0.2); }
    if (Math.abs(e) > 1.4 && Math.abs(speed) > 3 && gap === Infinity) pad.brake = true; // lost the lane: stop and sort it out
    return pad;
  }
  get needsRespawn() { return this.lost > 3 || (this.jam ?? 0) > 3; }
}

export class Chaser {
  /** target: () => { x, z, then? } (then = the point after, so corners after a checkpoint are planned for) ; cruise (m/s) */
  constructor(car, city, target, { cruise = 40, brake = 11 } = {}) { Object.assign(this, { car, city, target, cruise, brakeDecel: brake, path: null, pathAt: -9, last: null, stuck: 0, reverse: 0 }); }
  drive(t, dt = 1 / 30) {
    const c = this.car, T = this.target(); if (!T) return {};
    const city = this.city, cell = city.cellOf(c.x, c.z), tcell = city.cellOf(T.x, T.z), dist = Math.hypot(T.x - c.x, T.z - c.z);
    if (t - this.pathAt > 0.4 || !this.last || Math.hypot(this.last.x - T.x, this.last.z - T.z) > 2) { this.pathAt = t; this.last = { x: T.x, z: T.z }; this.path = city.isRoad(...cell) && city.isRoad(...tcell) ? city.path(cell, tcell) : null;
      if (this.path && T.then) { const t2 = city.cellOf(T.then.x, T.then.z), more = city.path(tcell, t2); if (more) this.path = this.path.concat(more.slice(1)); } }
    const center = (q) => city.center(q[0], q[1]), speed = c.forward;
    // follow the road: pts = centres of the cells ahead (the first one is dropped once we are close to it)
    let aim = [T.x, T.z], want = this.cruise;
    if (dist > 28 && this.path && this.path.length > 1) {
      const pts = this.path.map(center); let i = 1; while (i < pts.length - 1 && Math.hypot(pts[i][0] - c.x, pts[i][1] - c.z) < 9) i++;
      // look a little further ahead on straights so the line is smooth
      const look = Math.min(pts.length - 1, i + (Math.abs(speed) > 22 ? 1 : 0)); aim = pts[look];
      // braking plan: for every upcoming corner, the speed we may still carry when we get there
      let d = Math.hypot(pts[i][0] - c.x, pts[i][1] - c.z), prev = [c.x, c.z];
      for (let k = i; k < Math.min(pts.length - 1, i + 6); k++) {
        const a1 = Math.atan2(pts[k][0] - prev[0], pts[k][1] - prev[1]), a2 = Math.atan2(pts[k + 1][0] - pts[k][0], pts[k + 1][1] - pts[k][1]), turn = Math.abs(wrap(a2 - a1));
        if (turn > 0.35) { const vc = clamp(18 - turn * 6.5, 7.5, 18); want = Math.min(want, Math.sqrt(vc * vc + 2 * this.brakeDecel * Math.max(0, d - 6))); }
        prev = pts[k]; d += Math.hypot(pts[k + 1][0] - pts[k][0], pts[k + 1][1] - pts[k][1]);
      }
    } else if (dist < 28) want = Math.min(want, 10 + dist * 0.6);
    const e = headingError(c, aim[0], aim[1]);
    const pad = steerTowards(c, e, Math.abs(speed), {});
    if (Math.abs(e) > 0.8) want = Math.min(want, 9);
    if (this.reverse > 0) { this.reverse -= dt; pad.brake = true; pad.steer = -pad.steer; return pad; }
    if (speed < want) pad.accel = true; else if (speed > want + 2) pad.brake = true;
    if (Math.abs(e) > 1.1 && speed > 14) { pad.handbrake = true; pad.accel = false; pad.brake = false; } // powerslide round a missed corner
    if (Math.abs(speed) < 0.5 && dist > 6) { this.stuck += dt; if (this.stuck > 1.6) { this.reverse = 1.0; this.stuck = 0; } } else this.stuck = 0;
    return pad;
  }
}
