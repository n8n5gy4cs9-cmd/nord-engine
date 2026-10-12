// Automies — collisions between cars and the world (planar SAT + impulses). Driver 2 uses a Runge-Kutta rigid body solver; this is a deliberately small version:
// one contact per pair, normal impulse with restitution, a touch of tangential friction, and a damage figure from the impact speed. Pure / node-testable.
import { corners } from './car.js';

const E = 0.28, FRIC = 0.12, DMG_MIN = 3.2, DMG_K = 2.2;
const invI = (c) => 1 / ((c.cos.mass ?? 1) * ((c.cos.length ?? 4.4) ** 2 + (c.cos.width ?? 1.9) ** 2) / 12);
const invM = (c) => 1 / (c.cos.mass ?? 1);
const dot = (a, b) => a[0] * b[0] + a[1] * b[1];

function project(pts, ax) { let mn = Infinity, mx = -Infinity; for (const p of pts) { const d = dot(p, ax); if (d < mn) mn = d; if (d > mx) mx = d; } return [mn, mx]; }
/** SAT between two convex polygons (4 points each). Returns { n (points from B to A), depth } or null. */
function sat(A, B, axes) {
  let best = null;
  for (const ax of axes) {
    const [a0, a1] = project(A, ax), [b0, b1] = project(B, ax), o = Math.min(a1, b1) - Math.max(a0, b0);
    if (o <= 0) return null;
    if (!best || o < best.depth) { const ca = (a0 + a1) / 2, cb = (b0 + b1) / 2; best = { n: ca >= cb ? ax : [-ax[0], -ax[1]], depth: o }; }
  }
  return best;
}
const axesOf = (c) => { const s = Math.sin(c.yaw), co = Math.cos(c.yaw); return [[s, co], [co, -s]]; };
const velAt = (c, r) => [c.vx + c.w * r[1], c.vz - c.w * r[0]];
const torqueOf = (r, n) => r[1] * n[0] - r[0] * n[1];

/** Resolve car `a` against an immovable surface with normal n (pointing at the car) touching at world point p. Returns the impact speed. */
function impulseStatic(a, n, p) {
  const r = [p[0] - a.x, p[1] - a.z], v = velAt(a, r), vn = dot(v, n); if (vn >= 0) return 0;
  const k = torqueOf(r, n), j = (-(1 + E) * vn) / (invM(a) + invI(a) * k * k);
  a.vx += j * n[0] * invM(a); a.vz += j * n[1] * invM(a); a.w += invI(a) * j * k;
  const t = [-n[1], n[0]], vt = dot(velAt(a, r), t), kt = torqueOf(r, t), jt = Math.max(-Math.abs(FRIC * j), Math.min(Math.abs(FRIC * j), -vt / (invM(a) + invI(a) * kt * kt)));
  a.vx += jt * t[0] * invM(a); a.vz += jt * t[1] * invM(a); a.w += invI(a) * jt * kt;
  return -vn;
}
function impulsePair(a, b, n, p) {
  const ra = [p[0] - a.x, p[1] - a.z], rb = [p[0] - b.x, p[1] - b.z], va = velAt(a, ra), vb = velAt(b, rb), rel = [va[0] - vb[0], va[1] - vb[1]], vn = dot(rel, n); if (vn >= 0) return 0;
  const ka = torqueOf(ra, n), kb = torqueOf(rb, n), j = (-(1 + E) * vn) / (invM(a) + invM(b) + invI(a) * ka * ka + invI(b) * kb * kb);
  a.vx += j * n[0] * invM(a); a.vz += j * n[1] * invM(a); a.w += invI(a) * j * ka;
  b.vx -= j * n[0] * invM(b); b.vz -= j * n[1] * invM(b); b.w -= invI(b) * j * kb;
  return -vn;
}
const hurt = (c, speed, share = 1) => { if (speed > DMG_MIN) c.damage = Math.min(100, c.damage + (speed - DMG_MIN) * DMG_K * share); };

/** Cars vs the city. `onHit(car, speed, point)` is called for impacts above the "audible" threshold. */
export function carVsWorld(c, city, onHit) {
  const P = corners(c), R = Math.hypot(c.cos.length ?? 4.4, c.cos.width ?? 1.9) / 2 + 0.5;
  const ax = axesOf(c), world = [[1, 0], [0, 1]];
  const touch = (n, depth, pts, ctr) => {
    c.x += n[0] * depth; c.z += n[1] * depth;
    // contact point: the corner that went deepest against the surface
    let pt = pts[0], d0 = Infinity; for (const q of pts) { const d = dot([q[0] - ctr[0], q[1] - ctr[1]], n); if (d < d0) { d0 = d; pt = q; } }
    const sp = impulseStatic(c, n, pt); if (sp > 0.5) { hurt(c, sp); onHit?.(c, sp, pt); }
  };
  const [cx0, cy0] = city.cellOf(c.x, c.z);
  for (const b of city.boxes) {
    if (Math.abs(b.cx - cx0) > 1 || Math.abs(b.cy - cy0) > 1) continue;
    const B = [[b.x - b.hx, b.z - b.hz], [b.x + b.hx, b.z - b.hz], [b.x + b.hx, b.z + b.hz], [b.x - b.hx, b.z + b.hz]];
    const hit = sat(P, B, [...ax, ...world]); if (hit) touch(hit.n, hit.depth, P, [b.x, b.z]);
  }
  for (const k of city.circles) {
    const dx = k.x - c.x, dz = k.z - c.z; if (dx * dx + dz * dz > (R + k.r) ** 2) continue;
    const s = Math.sin(c.yaw), co = Math.cos(c.yaw), lx = dx * co - dz * s, lz = dx * s + dz * co, hw = (c.cos.width ?? 1.9) / 2, hl = (c.cos.length ?? 4.4) / 2;
    const qx = Math.max(-hw, Math.min(hw, lx)), qz = Math.max(-hl, Math.min(hl, lz)), ddx = lx - qx, ddz = lz - qz, d = Math.hypot(ddx, ddz);
    if (d >= k.r) continue;
    // push the car out along the line from the circle to the nearest point on the car
    let nx = (qx - lx), nz = (qz - lz); if (d < 1e-6) { nx = 0; nz = 1; } else { nx /= d; nz /= d; }
    const n = [nx * co + nz * s, -nx * s + nz * co], depth = k.r - d; // world-space normal pointing at the car
    c.x += n[0] * depth; c.z += n[1] * depth;
    const sp = impulseStatic(c, n, [k.x - n[0] * k.r, k.z - n[1] * k.r]); if (sp > 0.5) { hurt(c, sp * (k.r < 2 ? 0.5 : 1)); onHit?.(c, sp, [k.x, k.z]); }
  }
  // map edge: a solid wall just inside the border
  const [W, H] = city.size, m = 2;
  if (c.x < m) { c.x = m; if (c.vx < 0) { onHit?.(c, -c.vx, [c.x, c.z]); hurt(c, -c.vx); c.vx *= -0.2; } }
  if (c.x > W - m) { c.x = W - m; if (c.vx > 0) { onHit?.(c, c.vx, [c.x, c.z]); hurt(c, c.vx); c.vx *= -0.2; } }
  if (c.z < m) { c.z = m; if (c.vz < 0) { onHit?.(c, -c.vz, [c.x, c.z]); hurt(c, -c.vz); c.vz *= -0.2; } }
  if (c.z > H - m) { c.z = H - m; if (c.vz > 0) { onHit?.(c, c.vz, [c.x, c.z]); hurt(c, c.vz); c.vz *= -0.2; } }
}

/** Car vs car. Returns the impact speed (0 = no contact). */
export function carVsCar(a, b, onHit) {
  const dx = b.x - a.x, dz = b.z - a.z, R = (Math.hypot(a.cos.length ?? 4.4, a.cos.width ?? 1.9) + Math.hypot(b.cos.length ?? 4.4, b.cos.width ?? 1.9)) / 2;
  if (dx * dx + dz * dz > R * R) return 0;
  const A = corners(a), B = corners(b), hit = sat(A, B, [...axesOf(a), ...axesOf(b)]); if (!hit) return 0;
  const { n, depth } = hit, ma = invM(a), mb = invM(b), wa = ma / (ma + mb), wb = mb / (ma + mb);
  a.x += n[0] * depth * wa; a.z += n[1] * depth * wa; b.x -= n[0] * depth * wb; b.z -= n[1] * depth * wb;
  // contact point: deepest vertex of either car inside the other, else the midpoint
  let pt = [(a.x + b.x) / 2, (a.z + b.z) / 2], best = -Infinity;
  for (const q of A) { const d = dot([b.x - q[0], b.z - q[1]], n); if (d > best) { best = d; pt = q; } }
  for (const q of B) { const d = dot([q[0] - a.x, q[1] - a.z], n); if (d > best) { best = d; pt = q; } }
  const sp = impulsePair(a, b, n, pt);
  if (sp > 0.5) { hurt(a, sp, wb * 1.4); hurt(b, sp, wa * 1.4); onHit?.(a, b, sp, pt); }
  return sp;
}
