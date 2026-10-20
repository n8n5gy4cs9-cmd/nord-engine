// Movement + senses helpers for AI scripts (import them from your own scripts too). All distances in metres, angles in degrees unless noted.
import { STORY } from './level.js';

const R2D = 180 / Math.PI;
export const yawTo = (ax, az, bx, bz) => Math.atan2(bx - ax, bz - az) * R2D;
export const wrap = (a) => { a %= 360; return a > 180 ? a - 360 : a < -180 ? a + 360 : a; };
export const dist2d = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);

/** Turn `e.rot` toward `target` degrees at most `speed` deg/s. Returns remaining angle (abs). */
export function turnTo(e, target, speed, dt) {
  const d = wrap(target - e.rot), s = Math.max(-speed * dt, Math.min(speed * dt, d)); e.rot = wrap(e.rot + s); return Math.abs(d - s);
}

/** Can `e` see point/entity `t` (within `range`, inside `fov` degrees in front)? Uses sight-blocking pieces only (glass is see-through). */
export function canSee(game, e, t, range = 25, fov = 120) {
  const eye = e.eye ?? [e.x, e.y + 1.5, e.z], tp = t.eyePos ?? t.eye ?? [t.x, (t.y ?? 0) + 1.2, t.z];
  const dx = tp[0] - eye[0], dz = tp[2] - eye[2], d = Math.hypot(dx, dz);
  if (d > range) return false;
  if (fov < 360) { const a = Math.abs(wrap(yawTo(eye[0], eye[2], tp[0], tp[2]) - e.rot)); if (a > fov / 2) return false; }
  return game.world.los(eye, tp);
}

/** Move an entity by (dx,dz) with wall sliding + soft push-off from other solid entities; follows the floor, never walks into the void. */
export function step(game, e, dx, dz, dt, { flying = false } = {}) {
  const w = game.world, ox = e.x, oz = e.z;
  const m = w.moveCircle(e.x, e.z, e.y, e.height, e.radius, dx, dz);
  let nx = m.x, nz = m.z;
  for (const o of game.solids) { // soft separation
    if (o === e || !o.alive || o.destroyed) continue;
    const ddx = nx - o.x, ddz = nz - o.z, dd = Math.hypot(ddx, ddz), min = e.radius + o.radius;
    if (dd < min && dd > 1e-4 && Math.abs((o.y ?? 0) - e.y) < 1.5) { const push = (min - dd) * 0.5; nx += (ddx / dd) * push; nz += (ddz / dd) * push; }
  }
  if (!flying) {
    const f = w.floorAt(nx, nz, e.y + 0.5);
    if (!f) { e.blocked = true; return false; } // ledge / void: stay
    e.x = nx; e.z = nz; e.layer = f.layer;
    if (f.y >= e.y - 0.001) { e.y += Math.min(f.y - e.y, 8 * dt + 0.05); e.vy = 0; } // climb steps
    else { e.vy = (e.vy ?? 0) - 24 * dt; e.y = Math.max(f.y, e.y + e.vy * dt); if (e.y <= f.y) e.vy = 0; }
  } else { e.x = nx; e.z = nz; const f = w.floorAt(nx, nz, e.y + 2); if (f) e.layer = f.layer; }
  e.blocked = m.hit && Math.hypot(e.x - ox, e.z - oz) < Math.hypot(dx, dz) * 0.3;
  return true;
}

/** Walk toward a world point at `speed` m/s. Returns the remaining distance. */
export function moveToward(game, e, tx, tz, speed, dt, { turn = 540, flying = false } = {}) {
  const dx = tx - e.x, dz = tz - e.z, d = Math.hypot(dx, dz);
  if (d < 0.02) return d;
  turnTo(e, yawTo(e.x, e.z, tx, tz), turn, dt);
  const s = Math.min(d, speed * dt); step(game, e, (dx / d) * s, (dz / d) * s, dt, { flying });
  return Math.hypot(tx - e.x, tz - e.z);
}

/** Follow an A* path to goal {x,z,layer}; falls back to a straight walk when the goal is in plain sight. Returns remaining straight distance. */
export function followPath(game, e, goal, speed, dt, o = {}) {
  const st = e.state.nav ??= { pts: null, i: 0, t: 0, goal: null };
  const direct = Math.hypot(goal.x - e.x, goal.z - e.z) < 7 && Math.abs((goal.y ?? e.y) - e.y) < 1.2 && game.world.los([e.x, e.y + 0.9, e.z], [goal.x, e.y + 0.9, goal.z]) && !game.world.ray(e.x, e.y + 0.5, e.z, goal.x - e.x, 0, goal.z - e.z, Math.hypot(goal.x - e.x, goal.z - e.z), 'move');
  if (direct) { st.pts = null; return moveToward(game, e, goal.x, goal.z, speed, dt, o); }
  st.t -= dt;
  const moved = !st.goal || Math.hypot(st.goal.x - goal.x, st.goal.z - goal.z) > 2.5 || st.goal.layer !== goal.layer;
  if (!st.pts || st.t <= 0 && moved || st.t <= -2.5) {
    st.pts = game.world.path({ layer: e.layer, x: e.x, z: e.z }, { layer: goal.layer ?? e.layer, x: goal.x, z: goal.z }, { doors: o.doors ?? 'open' }); st.i = 0; st.t = 0.6; st.goal = { x: goal.x, z: goal.z, layer: goal.layer };
  }
  if (!st.pts) return moveToward(game, e, goal.x, goal.z, speed * 0.5, dt, o);
  let p = st.pts[st.i];
  while (p && Math.hypot(p.x - e.x, p.z - e.z) < 0.7 && st.i < st.pts.length - 1) p = st.pts[++st.i];
  if (!p) return 0;
  moveToward(game, e, p.x, p.z, speed, dt, o);
  if (e.blocked) st.t = Math.min(st.t, 0); // stuck → repath soon
  return Math.hypot(goal.x - e.x, goal.z - e.z);
}

/** Walk a patrol route (entity "path" points, in cell coordinates) back and forth/looping. Returns true when it arrived at a point this frame. */
export function patrol(game, e, route, speed, dt, loop = true) {
  if (!route?.length) return false;
  const st = e.state.patrol ??= { i: 0, dir: 1, wait: 0 };
  if (st.wait > 0) { st.wait -= dt; return false; }
  const pt = route[st.i], layer = e.layer;
  const left = followPath(game, e, { x: pt[0], z: pt[1], layer }, speed, dt);
  if (left < 0.6) { st.wait = pt[2] ?? 0.8; st.i += st.dir; if (st.i >= route.length || st.i < 0) { if (loop) st.i = 0; else { st.dir *= -1; st.i += st.dir * 2; } } return true; }
  return false;
}

/** Make noise: AIs within `radius` get their "heard" hook called. */
export const makeNoise = (game, pos, radius, src = null) => game.noise(pos, radius, src);
export const floorHeight = (game, x, z, layer = 0) => game.world.floorAt(x, z, layer * STORY + STORY - 0.05)?.y ?? 0;
