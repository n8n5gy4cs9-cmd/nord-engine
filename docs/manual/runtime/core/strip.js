// Geometry helpers for LineRenderer / TrailRenderer / SpriteShape: a poly-line with a changing width becomes a strip of quads, colours come from a gradient.
// Pure maths (no engine): the Phaser backend draws the triangles with Graphics, the Babylon backend turns them into a mesh.

/** '#rrggbb' or '#rrggbbaa' → [r, g, b, a] (0..1). */
export function parseColor(c, d = [1, 1, 1, 1]) {
  if (Array.isArray(c)) return [c[0] ?? 1, c[1] ?? 1, c[2] ?? 1, c[3] ?? 1];
  const m = typeof c === 'string' ? /^#([0-9a-f]{6})([0-9a-f]{2})?$/i.exec(c.trim()) : null;
  if (!m) return d;
  const n = parseInt(m[1], 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255, m[2] ? parseInt(m[2], 16) / 255 : 1];
}
export const toHex = (rgba) => `#${[0, 1, 2].map((i) => Math.round(Math.min(Math.max(rgba[i], 0), 1) * 255).toString(16).padStart(2, '0')).join('')}`;
export const toInt = (rgba) => (Math.round(rgba[0] * 255) << 16) | (Math.round(rgba[1] * 255) << 8) | Math.round(rgba[2] * 255);

/** Colour at t (0..1): `colors` = [[t, '#rrggbb', alpha?]…] when given, else startColor → endColor; `alpha` multiplies. Returns [r, g, b, a]. */
export function colorAt(d, t) {
  const stops = d.colors?.length ? d.colors.map(([s, c, a]) => [s, parseColor(c), a ?? 1]) : [[0, parseColor(d.startColor ?? '#ffffff'), 1], [1, parseColor(d.endColor ?? d.startColor ?? '#ffffff'), 1]];
  let a = stops[0], b = stops.at(-1);
  if (t <= a[0]) b = a; else if (t >= b[0]) a = b;
  else for (let i = 0; i + 1 < stops.length; i++) if (t >= stops[i][0] && t <= stops[i + 1][0]) { a = stops[i]; b = stops[i + 1]; break; }
  const k = b[0] === a[0] ? 0 : (t - a[0]) / (b[0] - a[0]), mix = (x, y) => x + (y - x) * k;
  return [mix(a[1][0], b[1][0]), mix(a[1][1], b[1][1]), mix(a[1][2], b[1][2]), mix(a[1][3] * a[2], b[1][3] * b[2]) * (d.alpha ?? 1)];
}
/** Width at t (0..1): startWidth → endWidth times the curve (`widthCurve` = [[t, multiplier]…]) times `widthMultiplier`. */
export function widthAt(d, t) {
  const s = d.startWidth ?? d.width ?? 1, e = d.endWidth ?? s;
  let m = 1;
  const c = d.widthCurve;
  if (c?.length) {
    m = c.at(-1)[1];
    if (t <= c[0][0]) m = c[0][1];
    else for (let i = 0; i + 1 < c.length; i++) if (t >= c[i][0] && t <= c[i + 1][0]) { const k = (t - c[i][0]) / ((c[i + 1][0] - c[i][0]) || 1); m = c[i][1] + (c[i + 1][1] - c[i][1]) * k; break; }
  }
  return Math.max(0, (s + (e - s) * t) * m * (d.widthMultiplier ?? 1));
}

/**
 * Turn points into a strip. `perp(dir, point)` gives the sideways unit vector for a direction (2D: (-dy, dx); 3D billboards pass the camera-facing one).
 * Returns { left, right, t, length, centre } with one entry per point: the two edge points, the position along the line (0..1) and the centre.
 * Corners are mitred (the width grows by 1/cos of half the turning angle, at most doubled).
 */
export function strip(points, { widthOf = () => 1, loop = false, perp = (d) => [-d[1], d[0], 0] } = {}) {
  const n = points.length, left = [], right = [], t = [], dist = [0];
  for (let i = 1; i < n; i++) dist.push(dist[i - 1] + Math.hypot(points[i][0] - points[i - 1][0], points[i][1] - points[i - 1][1], (points[i][2] ?? 0) - (points[i - 1][2] ?? 0)));
  const total = dist[n - 1] || 1;
  const dir = (a, b) => { const x = b[0] - a[0], y = b[1] - a[1], z = (b[2] ?? 0) - (a[2] ?? 0), l = Math.hypot(x, y, z) || 1; return [x / l, y / l, z / l]; };
  for (let i = 0; i < n; i++) {
    const p = points[i], prev = i > 0 ? points[i - 1] : loop ? points[n - 1] : null, next = i < n - 1 ? points[i + 1] : loop ? points[0] : null;
    const d0 = prev ? dir(prev, p) : dir(p, next ?? p), d1 = next ? dir(p, next) : d0;
    const n0 = perp(d0, p), n1 = perp(d1, p);
    let m = [n0[0] + n1[0], n0[1] + n1[1], n0[2] + n1[2]], ml = Math.hypot(m[0], m[1], m[2]);
    if (ml < 1e-6) { m = n0; ml = 1; }
    m = [m[0] / ml, m[1] / ml, m[2] / ml];
    const cos = Math.max(m[0] * n0[0] + m[1] * n0[1] + m[2] * n0[2], 0.5), tt = dist[i] / total, w = widthOf(tt) / 2 / cos;
    left.push([p[0] + m[0] * w, p[1] + m[1] * w, (p[2] ?? 0) + m[2] * w]);
    right.push([p[0] - m[0] * w, p[1] - m[1] * w, (p[2] ?? 0) - m[2] * w]);
    t.push(tt);
  }
  return { left, right, t, length: total, centre: points };
}

/** Smooth a poly-line with Catmull-Rom splines (`detail` extra points per segment); `closed` wraps around. Used by SpriteShape. */
export function smooth(points, detail = 8, closed = false) {
  const n = points.length; if (n < 3 || detail < 1) return points.map((p) => [...p]);
  const get = (i) => points[closed ? ((i % n) + n) % n : Math.min(Math.max(i, 0), n - 1)], out = [];
  const segs = closed ? n : n - 1;
  for (let i = 0; i < segs; i++) {
    const p0 = get(i - 1), p1 = get(i), p2 = get(i + 1), p3 = get(i + 2);
    for (let k = 0; k < detail; k++) {
      const u = k / detail, u2 = u * u, u3 = u2 * u, c = (a, b, cc, d) => 0.5 * ((2 * b) + (-a + cc) * u + (2 * a - 5 * b + 4 * cc - d) * u2 + (-a + 3 * b - 3 * cc + d) * u3);
      out.push([c(p0[0], p1[0], p2[0], p3[0]), c(p0[1], p1[1], p2[1], p3[1]), c(p0[2] ?? 0, p1[2] ?? 0, p2[2] ?? 0, p3[2] ?? 0)]);
    }
  }
  if (!closed) out.push([...points[n - 1]]);
  return out;
}
/** Drop points closer than `tolerance` to the line through their neighbours (Ramer-Douglas-Peucker; Unity's LineRenderer.Simplify). */
export function simplify(points, tolerance = 0.1) {
  if (points.length < 3) return points.map((p) => [...p]);
  const a = points[0], b = points.at(-1), ab = [b[0] - a[0], b[1] - a[1], (b[2] ?? 0) - (a[2] ?? 0)], len2 = ab[0] ** 2 + ab[1] ** 2 + ab[2] ** 2;
  let idx = -1, best = 0;
  for (let i = 1; i < points.length - 1; i++) {
    const p = points[i], ap = [p[0] - a[0], p[1] - a[1], (p[2] ?? 0) - (a[2] ?? 0)], k = len2 ? Math.min(Math.max((ap[0] * ab[0] + ap[1] * ab[1] + ap[2] * ab[2]) / len2, 0), 1) : 0;
    const d = Math.hypot(ap[0] - ab[0] * k, ap[1] - ab[1] * k, ap[2] - ab[2] * k);
    if (d > best) { best = d; idx = i; }
  }
  if (best <= tolerance) return [[...a], [...b]];
  return [...simplify(points.slice(0, idx + 1), tolerance).slice(0, -1), ...simplify(points.slice(idx), tolerance)];
}
