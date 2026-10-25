// Collision geometry for Physics2D / Physics queries: convex shapes (sphere, capsule, oriented box, convex polygon), GJK distance, shape casts by
// conservative advancement, exact rays. Works in 3D; 2D shapes are the same shapes in the z = 0 plane. Pure maths, no engine access.
//
// A shape is a list of convex parts. Every part has a `core` (the points whose convex hull is the part) and a `radius` that fattens it:
//   sphere / circle  → core [centre],            radius r
//   capsule          → core [end A, end B],      radius r
//   box              → core 8 corners (or 4),    radius 0     (+ `box` data for exact rays)
//   polygon          → core the vertices,        radius 0
// Distance between two parts = GJK distance of the cores − the radii. All vectors are plain [x, y, z] arrays.
const EPS = 1e-9;
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const mul = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const len = (a) => Math.sqrt(dot(a, a));
const norm = (a) => { const l = len(a); return l > EPS ? mul(a, 1 / l) : [0, 0, 0]; };
const neg = (a) => [-a[0], -a[1], -a[2]];

// ---------------------------------------------------------------- shape builders
export const sphere = (c, r) => ({ kind: 'sphere', core: [[c[0], c[1], c[2] ?? 0]], radius: r, c: [c[0], c[1], c[2] ?? 0] });
export const capsule = (a, b, r) => ({ kind: 'capsule', core: [[a[0], a[1], a[2] ?? 0], [b[0], b[1], b[2] ?? 0]], radius: r, a: [a[0], a[1], a[2] ?? 0], b: [b[0], b[1], b[2] ?? 0] });
/** Oriented box: centre, three unit axes ([[x],[y],[z]]) and half extents. `flat` = 2D box (z extent ignored: 4 corners in the plane of the first two axes). */
export function box(c, axes, half, flat = false) {
  const core = [];
  for (const sx of [-1, 1]) for (const sy of [-1, 1]) for (const sz of flat ? [0] : [-1, 1]) {
    core.push(add(c, add(add(mul(axes[0], sx * half[0]), mul(axes[1], sy * half[1])), mul(axes[2], sz * half[2]))));
  }
  return { kind: 'box', core, radius: 0, c, axes, half, flat };
}
/** Convex polygon (vertices in order, z = 0). Concave outlines go through `triangulate()` first. */
export const poly = (pts) => ({ kind: 'poly', core: pts.map((p) => [p[0], p[1], p[2] ?? 0]), radius: 0 });
/** Edge / segment with no thickness. */
export const segment = (a, b) => ({ kind: 'segment', core: [[a[0], a[1], a[2] ?? 0], [b[0], b[1], b[2] ?? 0]], radius: 0 });

/** Split a simple polygon (any winding, may be concave) into triangles by ear clipping. Convex input is returned whole. */
export function triangulate(pts) {
  const n = pts.length;
  if (n < 3) return [];
  const area = pts.reduce((s, p, i) => { const q = pts[(i + 1) % n]; return s + (p[0] * q[1] - q[0] * p[1]); }, 0);
  const idx = pts.map((_, i) => i); if (area < 0) idx.reverse();
  const cr = (a, b, c) => (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
  if (idx.every((_, k) => cr(pts[idx[k]], pts[idx[(k + 1) % n]], pts[idx[(k + 2) % n]]) >= -1e-9)) return [idx.map((i) => pts[i])]; // already convex
  const out = [];
  let guard = n * n;
  while (idx.length > 3 && guard-- > 0) {
    let clipped = false;
    for (let k = 0; k < idx.length; k++) {
      const ia = idx[(k + idx.length - 1) % idx.length], ib = idx[k], ic = idx[(k + 1) % idx.length], a = pts[ia], b = pts[ib], c = pts[ic];
      if (cr(a, b, c) <= 1e-12) continue; // reflex or flat
      const inside = idx.some((j) => { if (j === ia || j === ib || j === ic) return false; const p = pts[j]; return cr(a, b, p) >= 0 && cr(b, c, p) >= 0 && cr(c, a, p) >= 0; });
      if (inside) continue;
      out.push([a, b, c]); idx.splice(k, 1); clipped = true; break;
    }
    if (!clipped) break;
  }
  if (idx.length === 3) out.push(idx.map((i) => pts[i]));
  return out;
}

// ---------------------------------------------------------------- GJK distance between convex hulls of point sets
const support = (pts, d) => { let best = pts[0], bd = dot(pts[0], d); for (let i = 1; i < pts.length; i++) { const v = dot(pts[i], d); if (v > bd) { bd = v; best = pts[i]; } } return best; };

function closestSegment(S) { // S = [{w}, {w}] ; returns {v, lam, keep}
  const a = S[0].w, b = S[1].w, ab = sub(b, a), d = dot(ab, ab);
  const t = d < EPS ? 0 : -dot(a, ab) / d;
  if (t <= 0) return { v: a, lam: [1], keep: [S[0]] };
  if (t >= 1) return { v: b, lam: [1], keep: [S[1]] };
  return { v: add(a, mul(ab, t)), lam: [1 - t, t], keep: [S[0], S[1]] };
}
function closestTriangle(S) {
  const [A, B, C] = S, a = A.w, b = B.w, c = C.w, ab = sub(b, a), ac = sub(c, a), ap = neg(a);
  const d1 = dot(ab, ap), d2 = dot(ac, ap);
  if (d1 <= 0 && d2 <= 0) return { v: a, lam: [1], keep: [A] };
  const bp = neg(b), d3 = dot(ab, bp), d4 = dot(ac, bp);
  if (d3 >= 0 && d4 <= d3) return { v: b, lam: [1], keep: [B] };
  const vc = d1 * d4 - d3 * d2;
  if (vc <= 0 && d1 >= 0 && d3 <= 0) { const t = d1 / (d1 - d3); return { v: add(a, mul(ab, t)), lam: [1 - t, t], keep: [A, B] }; }
  const cp = neg(c), d5 = dot(ab, cp), d6 = dot(ac, cp);
  if (d6 >= 0 && d5 <= d6) return { v: c, lam: [1], keep: [C] };
  const vb = d5 * d2 - d1 * d6;
  if (vb <= 0 && d2 >= 0 && d6 <= 0) { const t = d2 / (d2 - d6); return { v: add(a, mul(ac, t)), lam: [1 - t, t], keep: [A, C] }; }
  const va = d3 * d6 - d5 * d4;
  if (va <= 0 && d4 - d3 >= 0 && d5 - d6 >= 0) { const t = (d4 - d3) / ((d4 - d3) + (d5 - d6)); return { v: add(b, mul(sub(c, b), t)), lam: [1 - t, t], keep: [B, C] }; }
  const sum = va + vb + vc;
  if (Math.abs(sum) < 1e-18) { // degenerate (collinear) triangle: best edge
    const e = [closestSegment([A, B]), closestSegment([A, C]), closestSegment([B, C])];
    return e.reduce((m, x) => (dot(x.v, x.v) < dot(m.v, m.v) ? x : m));
  }
  const v = vb / sum, w = vc / sum;
  return { v: add(a, add(mul(ab, v), mul(ac, w))), lam: [1 - v - w, v, w], keep: [A, B, C] };
}
function closestTetra(S) {
  const [A, B, C, D] = S, a = A.w, b = B.w, c = C.w, d = D.w;
  const sign = (p, q, r, s) => { const n = cross(sub(q, p), sub(r, p)); return [dot(n, neg(p)), dot(n, sub(s, p))]; };
  const faces = [[A, B, C, D], [A, C, D, B], [A, D, B, C], [B, D, C, A]], pts = [a, b, c, d];
  let inside = true, best = null;
  for (const f of faces) {
    const [x, y, z, o] = f, [so, sw] = sign(x.w, y.w, z.w, o.w);
    if (Math.abs(sw) < 1e-14) { inside = false; continue; }
    if (so * sw < 0) { // origin is on the other side of this face than the 4th point
      inside = false;
      const r = closestTriangle([x, y, z]);
      if (!best || dot(r.v, r.v) < dot(best.v, best.v)) best = r;
    }
  }
  void pts;
  if (inside) return { v: [0, 0, 0], lam: [], keep: S, inside: true };
  return best ?? closestTriangle([A, B, C]);
}
function closestSimplex(S) {
  switch (S.length) {
    case 1: return { v: S[0].w, lam: [1], keep: S };
    case 2: return closestSegment(S);
    case 3: return closestTriangle(S);
    default: return closestTetra(S);
  }
}

/** GJK distance between the convex hulls of two point sets. `{ dist, pa, pb, overlap }`: `pa - pb` points from B toward A; dist is 0 when the hulls touch or overlap. */
export function gjk(ptsA, ptsB) {
  const sup = (d) => { const a = support(ptsA, d), b = support(ptsB, neg(d)); return { w: sub(a, b), a, b }; };
  let v = sub(ptsA[0], ptsB[0]), simplex = [], lam = [1];
  for (let it = 0; it < 64; it++) {
    const vv = dot(v, v);
    if (vv < 1e-14) return { dist: 0, pa: ptsA[0], pb: ptsB[0], overlap: true };
    const s = sup(neg(v));
    if (vv - dot(v, s.w) <= 1e-10 * Math.max(vv, 1e-6)) break;
    if (simplex.some((p) => p.w[0] === s.w[0] && p.w[1] === s.w[1] && p.w[2] === s.w[2])) break;
    simplex.push(s);
    const r = closestSimplex(simplex);
    if (r.inside) return { dist: 0, pa: ptsA[0], pb: ptsB[0], overlap: true };
    simplex = r.keep; v = r.v; lam = r.lam;
  }
  if (!simplex.length) return { dist: Math.sqrt(dot(v, v)), pa: ptsA[0], pb: ptsB[0], overlap: false };
  let pa = [0, 0, 0], pb = [0, 0, 0];
  simplex.forEach((s, i) => { pa = add(pa, mul(s.a, lam[i] ?? 0)); pb = add(pb, mul(s.b, lam[i] ?? 0)); });
  return { dist: Math.sqrt(dot(v, v)), pa, pb, overlap: false };
}

// ---------------------------------------------------------------- shape vs shape
/** Surface distance between two parts (negative = overlapping by that much along no particular axis; only the sign and 0 are exact), with closest surface points and the normal pointing from B to A. */
export function partDistance(A, B) {
  const g = gjk(A.core, B.core), rr = A.radius + B.radius;
  if (g.overlap) return { distance: -1e-9, overlap: true, pa: g.pa, pb: g.pb, normal: [0, 0, 0] };
  const n = g.dist > EPS ? mul(sub(g.pa, g.pb), 1 / g.dist) : [0, 0, 0];
  const d = g.dist - rr;
  return { distance: d, overlap: d <= 0, pa: sub(g.pa, mul(n, A.radius)), pb: add(g.pb, mul(n, B.radius)), normal: n };
}
const parts = (s) => (Array.isArray(s) ? s : [s]);
/** Closest pair between two shapes (arrays of parts): `{ distance, overlap, pa, pb, normal }`. */
export function distance(A, B) {
  let best = null;
  for (const a of parts(A)) for (const b of parts(B)) { const d = partDistance(a, b); if (!best || d.distance < best.distance) best = d; }
  return best ?? { distance: Infinity, overlap: false, pa: [0, 0, 0], pb: [0, 0, 0], normal: [0, 0, 0] };
}
export const overlaps = (A, B) => parts(A).some((a) => parts(B).some((b) => { const g = gjk(a.core, b.core); return g.overlap || g.dist <= a.radius + b.radius; }));
/** Is the point inside (or on) the shape? */
export const containsPoint = (S, p) => overlaps(S, sphere(p, 0));

const translate = (s, d) => ({ ...s, core: s.core.map((p) => add(p, d)) });
/**
 * Sweep shape A along the unit direction `dir` for at most `maxDist` and report the first contact with shape B (conservative advancement):
 * `{ t, normal (from B toward A), point (on B's surface), centroid (A's centre at the hit) }`, or null. Starting inside gives t = 0 and normal = −dir.
 */
export function sweep(A, dir, maxDist, B, centre = null) {
  let best = null;
  for (const a of parts(A)) for (const b of parts(B)) {
    const h = sweepPart(a, dir, maxDist, b);
    if (h && (!best || h.t < best.t)) best = h;
  }
  if (best) { best.centroid = centre ? add(centre, mul(dir, best.t)) : null; if (best.overlap && best.t === 0 && centre) best.point = centre; } // starting inside: the contact point is where we are, like Unity
  return best;
}
function sweepPart(a, dir, maxDist, b) {
  const rr = a.radius + b.radius;
  let t = 0;
  for (let it = 0; it < 80; it++) {
    const g = gjk(translate(a, mul(dir, t)).core, b.core);
    if (g.overlap) return { t, normal: neg(dir), point: g.pb, overlap: true };
    const sep = g.dist - rr;
    if (sep <= 1e-7) {
      const n = g.dist > EPS ? mul(sub(g.pa, g.pb), 1 / g.dist) : neg(dir);
      return t === 0 && sep < -1e-9 ? { t, normal: neg(dir), point: g.pb, overlap: true } : { t, normal: n, point: add(g.pb, mul(n, b.radius)), overlap: false };
    }
    const n = mul(sub(g.pa, g.pb), 1 / g.dist), approach = -dot(dir, n);
    if (approach <= 1e-9) return null; // moving away or sliding past
    t += sep / approach;
    if (t > maxDist) return null;
  }
  return null;
}

// ---------------------------------------------------------------- rays (exact)
function raySphere(o, d, c, r, startInside) {
  const f = sub(o, c), b = dot(f, d), cc = dot(f, f) - r * r;
  if (cc <= 0) return startInside ? { t: 0, n: neg(d) } : null;
  if (b > 0) return null;
  const disc = b * b - cc; if (disc < 0) return null;
  const t = -b - Math.sqrt(disc), p = add(o, mul(d, t));
  return { t, n: norm(sub(p, c)) };
}
function rayCapsule(o, d, a, b, r, startInside) {
  const ba = sub(b, a), baba = dot(ba, ba);
  if (baba < EPS) return raySphere(o, d, a, r, startInside);
  let best = null;
  const keep = (h) => { if (h && (!best || h.t < best.t)) best = h; };
  keep(raySphere(o, d, a, r, startInside)); keep(raySphere(o, d, b, r, startInside));
  // infinite cylinder around the axis, clamped to the segment
  const oa = sub(o, a), bad = dot(ba, d), baoa = dot(ba, oa);
  const k2 = baba - bad * bad, k1 = baba * dot(oa, d) - baoa * bad, k0 = baba * dot(oa, oa) - baoa * baoa - r * r * baba;
  if (Math.abs(k2) > EPS) {
    const h = k1 * k1 - k2 * k0;
    if (h >= 0) {
      const t = (-k1 - Math.sqrt(h)) / k2, y = baoa + t * bad;
      if (t >= 0 && y > 0 && y < baba) { const p = add(o, mul(d, t)), q = add(a, mul(ba, y / baba)); keep({ t, n: norm(sub(p, q)) }); }
      else if (t < 0 && startInside) { const y0 = baoa; if (y0 > 0 && y0 < baba && k0 <= 0) keep({ t: 0, n: neg(d) }); }
    }
  }
  return best;
}
function rayBox(o, d, bx, startInside) {
  const lo = sub(o, bx.c), ld = [dot(d, bx.axes[0]), dot(d, bx.axes[1]), dot(d, bx.axes[2])], lp = [dot(lo, bx.axes[0]), dot(lo, bx.axes[1]), dot(lo, bx.axes[2])];
  let tmin = -Infinity, tmax = Infinity, nAxis = -1, nSign = 1;
  for (let i = 0; i < 3; i++) {
    const h = bx.flat && i === 2 ? Infinity : bx.half[i];
    if (Math.abs(ld[i]) < 1e-12) { if (Math.abs(lp[i]) > h) return null; continue; }
    let t1 = (-h - lp[i]) / ld[i], t2 = (h - lp[i]) / ld[i], s = -1;
    if (t1 > t2) { [t1, t2] = [t2, t1]; s = 1; }
    if (t1 > tmin) { tmin = t1; nAxis = i; nSign = s; }
    tmax = Math.min(tmax, t2);
    if (tmin > tmax) return null;
  }
  if (tmax < 0) return null;
  if (tmin < 0) return startInside ? { t: 0, n: neg(d) } : null;
  return { t: tmin, n: mul(bx.axes[nAxis], nSign) };
}
function rayPoly(o, d, pts, startInside) {
  // convex polygon in z = 0: clip the ray against every edge half-plane
  const area = pts.reduce((s, p, i) => { const q = pts[(i + 1) % pts.length]; return s + (p[0] * q[1] - q[0] * p[1]); }, 0), sgn = area >= 0 ? 1 : -1;
  let tmin = -Infinity, tmax = Infinity, n = null;
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i], q = pts[(i + 1) % pts.length], e = [q[0] - p[0], q[1] - p[1], 0], nn = norm([e[1] * sgn, -e[0] * sgn, 0]);
    const denom = dot(nn, d), dist = dot(nn, sub(o, p));
    if (Math.abs(denom) < 1e-12) { if (dist > 0) return null; continue; }
    const t = -dist / denom;
    if (denom < 0) { if (t > tmin) { tmin = t; n = nn; } } else if (t < tmax) tmax = t;
    if (tmin > tmax) return null;
  }
  if (tmax < 0) return null;
  if (tmin < 0) return startInside ? { t: 0, n: neg(d) } : null;
  return n ? { t: tmin, n } : null;
}
/** Ray against one part (exact). `startInside`: a ray that starts inside reports t = 0 (2D default) instead of missing (3D default). */
export function rayPart(o, d, part, startInside) {
  switch (part.kind) {
    case 'sphere': return raySphere(o, d, part.c, part.radius, startInside);
    case 'capsule': return rayCapsule(o, d, part.a, part.b, part.radius, startInside);
    case 'box': return part.flat ? rayPoly(o, d, part.core.slice(0, 4).map((p) => p).sort(angularOrder(part.c)), startInside) : rayBox(o, d, part, startInside);
    case 'poly': return rayPoly(o, d, part.core, startInside);
    case 'segment': { // zero-thickness edge: intersect in the z = 0 plane
      const a = part.core[0], b = part.core[1], e = sub(b, a), den = d[0] * e[1] - d[1] * e[0];
      if (Math.abs(den) < 1e-12) return null;
      const w = sub(a, o), t = (w[0] * e[1] - w[1] * e[0]) / den, u = (w[0] * d[1] - w[1] * d[0]) / den;
      if (t < 0 || u < 0 || u > 1) return null;
      const nn = norm([e[1], -e[0], 0]);
      return { t, n: dot(nn, d) > 0 ? neg(nn) : nn };
    }
    default: return null;
  }
}
const angularOrder = (c) => (p, q) => Math.atan2(p[1] - c[1], p[0] - c[0]) - Math.atan2(q[1] - c[1], q[0] - c[0]);
/** First hit of the ray `o + t·d` (d must be unit length) against a shape (array of parts) within `maxDist`: `{ t, normal, point }` or null. */
export function ray(o, d, S, maxDist = Infinity, startInside = true) {
  let best = null;
  for (const p of parts(S)) {
    const h = rayPart(o, d, p, startInside);
    if (h && h.t <= maxDist && (!best || h.t < best.t)) best = { t: h.t, normal: h.n, point: add(o, mul(d, h.t)) };
  }
  return best;
}

// ---------------------------------------------------------------- bounds
/** Axis-aligned bounds `{ min, max }` of a shape. */
export function bounds(S) {
  const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
  for (const p of parts(S)) for (const c of p.core) for (let i = 0; i < 3; i++) { min[i] = Math.min(min[i], c[i] - p.radius); max[i] = Math.max(max[i], c[i] + p.radius); }
  return { min, max };
}
export const V = { add, sub, mul, dot, cross, norm, len, neg };
