// Unity physics queries on top of the engine's colliders: Physics2D (Raycast, Linecast, CircleCast, BoxCast, CapsuleCast, Overlap*, Distance, IgnoreCollision …) and
// Physics (3D: Raycast, RaycastAll/NonAlloc, SphereCast, BoxCast, CapsuleCast, Overlap*, Check*, IgnoreCollision …).
// Collider data (`collider` component: shape box | circle | capsule | polygon | edge | composite in 2D; box | sphere | capsule | cylinder in 3D) is turned into the convex
// shapes of geometry.js, so every query is exact for every shape on every physics engine (arcade, matter, Havok) and works in the same frame.
// Layers are the entity `layer` numbers (the same numbers as LayerMask.GetMask).
import { Game } from './game.js';
import { Vector2, Vector3, Physics2D, unityHooks } from './unity.js';
import { Quaternion, Transform, Rigidbody2D, Physics } from './unity-extra.js';
import { Bounds } from './unity-math.js';
import * as G from './geometry.js';

const game = () => Game.current;
const D2R = Math.PI / 180;
const is3D = () => game()?.project?.type === '3d';

// ---------------------------------------------------------------- enums and filters
export const QueryTriggerInteraction = Object.freeze({ UseGlobal: 0, Ignore: 1, Collide: 2 });
export const CapsuleDirection2D = Object.freeze({ Vertical: 0, Horizontal: 1 });
export const Physics2DLayers = Object.freeze({ AllLayers: -1, DefaultRaycastLayers: ~(1 << 2), IgnoreRaycastLayer: 1 << 2 });
const ALL = -1;
/** Unity's ContactFilter2D: pass to `Physics2D.OverlapCollider(col, filter, results)` or the `Raycast(origin, dir, filter, results, dist)` overload. */
export class ContactFilter2D {
  constructor() { this.useTriggers = true; this.useLayerMask = false; this.layerMask = ALL; this.useDepth = false; this.minDepth = -Infinity; this.maxDepth = Infinity; this.useNormalAngle = false; this.minNormalAngle = 0; this.maxNormalAngle = 359.99; }
  SetLayerMask(m) { this.useLayerMask = true; this.layerMask = m; return this; }
  ClearLayerMask() { this.useLayerMask = false; return this; }
  SetDepth(min, max) { this.useDepth = true; this.minDepth = min; this.maxDepth = max; return this; }
  NoFilter() { this.useTriggers = true; this.useLayerMask = false; this.useDepth = false; this.useNormalAngle = false; return this; }
  NormalAngle(min, max) { this.useNormalAngle = true; this.minNormalAngle = min; this.maxNormalAngle = max; return this; }
  IsFilteringLayerMask(e) { return this.useLayerMask && !(this.layerMask & (1 << e.layer)); }
}
const maskOf = (m) => (m == null ? Physics2DLayers.DefaultRaycastLayers : m);

// ---------------------------------------------------------------- poses
const nativeBackend = () => game()?.backend;
/** World pose of an entity in 2D: `{ x, y, a (radians), sx, sy }` including the parents' rotation and scale. */
export function pose2D(e) {
  const b = nativeBackend();
  if (b?.world) { const w = b.world(e); return { x: w.x, y: w.y, a: w.angle * D2R, sx: w.sx, sy: w.sy }; }
  const chain = []; for (let p = e; p; p = p.parent) chain.unshift(p);
  let w = { x: 0, y: 0, a: 0, sx: 1, sy: 1 };
  for (const n of chain) {
    const lx = n.t.pos[0] * w.sx, ly = n.t.pos[1] * w.sy, c = Math.cos(w.a), s = Math.sin(w.a);
    w = { x: w.x + lx * c - ly * s, y: w.y + lx * s + ly * c, a: w.a + (n.t.rot[2] ?? 0) * D2R, sx: w.sx * n.t.scale[0], sy: w.sy * n.t.scale[1] };
  }
  return w;
}
const to2 = (w, x, y) => { const px = x * w.sx, py = y * w.sy, c = Math.cos(w.a), s = Math.sin(w.a); return [w.x + px * c - py * s, w.y + px * s + py * c, 0]; };

/** World matrix (column-major, translation at 12..14) of an entity in 3D: the native node's matrix, or the TRS chain when there is no native node. */
export function matrix3D(e) {
  const m = e.native?.getWorldMatrix?.();
  if (m?.m) return Array.from(m.m);
  let out = null;
  const chain = []; for (let p = e; p; p = p.parent) chain.unshift(p);
  for (const n of chain) {
    const q = Quaternion.Euler(n.t.rot[0] ?? 0, n.t.rot[1] ?? 0, n.t.rot[2] ?? 0), [x, y, z, w] = [q.x, q.y, q.z, q.w], [sx, sy, sz] = n.t.scale, [px, py, pz] = n.t.pos;
    const local = [
      (1 - 2 * (y * y + z * z)) * sx, (2 * (x * y + z * w)) * sx, (2 * (x * z - y * w)) * sx, 0,
      (2 * (x * y - z * w)) * sy, (1 - 2 * (x * x + z * z)) * sy, (2 * (y * z + x * w)) * sy, 0,
      (2 * (x * z + y * w)) * sz, (2 * (y * z - x * w)) * sz, (1 - 2 * (x * x + y * y)) * sz, 0,
      px, py, pz, 1,
    ];
    out = out ? mulMat(out, local) : local;
  }
  return out ?? [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
}
function mulMat(a, b) { // world = parent · local (column-major, column vectors)
  const r = new Array(16).fill(0);
  for (let c = 0; c < 4; c++) for (let rr = 0; rr < 4; rr++) { let s = 0; for (let k = 0; k < 4; k++) s += a[rr + k * 4] * b[k + c * 4]; r[rr + c * 4] = s; }
  return r;
}
const xf3 = (m, p) => [m[0] * p[0] + m[4] * p[1] + m[8] * p[2] + m[12], m[1] * p[0] + m[5] * p[1] + m[9] * p[2] + m[13], m[2] * p[0] + m[6] * p[1] + m[10] * p[2] + m[14]];
const axisLen = (m, i) => Math.hypot(m[i * 4], m[i * 4 + 1], m[i * 4 + 2]);

// ---------------------------------------------------------------- collider data → shapes
/** Size of a collider that has no explicit `size`: what the physics adapter measured from the visual. */
const autoSize = (e) => game()?.physics?.bodies?.get(e)?.cfg?.size ?? [16, 16];
const autoExtents = (e) => game()?.physics?.bodies?.get(e)?.cfg?.extents ?? null;

function parts2D(e, d, w) {
  const size = d.size ?? autoSize(e), off = d.offset ?? [0, 0], shape = d.shape ?? 'box';
  const at = (x, y) => to2(w, off[0] + x, off[1] + y);
  const smax = Math.max(Math.abs(w.sx), Math.abs(w.sy));
  if (shape === 'circle') return [G.sphere(at(0, 0), (d.radius ?? Math.max(size[0], size[1]) / 2) * smax)];
  if (shape === 'capsule') {
    const [cw, ch] = size, horizontal = (d.direction ?? (cw > ch ? 'horizontal' : 'vertical')).toString().toLowerCase().startsWith('h');
    const r = Math.min(cw, ch) / 2, half = Math.max((horizontal ? cw : ch) / 2 - r, 0);
    const a = horizontal ? at(-half, 0) : at(0, -half), b = horizontal ? at(half, 0) : at(0, half);
    return [G.capsule(a, b, r * smax)];
  }
  if (shape === 'polygon') {
    const pts = (d.points?.length >= 3 ? d.points : [[-size[0] / 2, -size[1] / 2], [size[0] / 2, -size[1] / 2], [size[0] / 2, size[1] / 2], [-size[0] / 2, size[1] / 2]]).map((p) => at(p[0], p[1]));
    return G.triangulate(pts).map((t) => G.poly(t));
  }
  if (shape === 'edge') {
    const pts = (d.points?.length >= 2 ? d.points : [[-size[0] / 2, 0], [size[0] / 2, 0]]).map((p) => at(p[0], p[1])), out = [];
    for (let i = 0; i + 1 < pts.length; i++) out.push(G.segment(pts[i], pts[i + 1]));
    if (d.closed) out.push(G.segment(pts.at(-1), pts[0]));
    return out;
  }
  // box
  const hw = size[0] / 2, hh = size[1] / 2;
  return [G.poly([at(-hw, -hh), at(hw, -hh), at(hw, hh), at(-hw, hh)])];
}
/** Shape (array of convex parts) of an entity's collider in 2D, or null. A composite collider is the union of the colliders marked `usedByComposite` on itself and its children. */
export function shape2D(e) {
  const col = e.getComponent('collider'); if (!col) return null;
  const d = col.data;
  if (d.shape === 'composite') {
    const out = [];
    for (const c of e.all()) { const cc = c.getComponent('collider'); if (cc && c.enabled && (c === e ? false : cc.data.usedByComposite)) out.push(...parts2D(c, { ...cc.data, shape: cc.data.shape === 'composite' ? 'box' : cc.data.shape }, pose2D(c))); }
    return out.length ? out : null;
  }
  if (d.usedByComposite && e.parent) for (let p = e.parent; p; p = p.parent) if (p.getComponent('collider')?.data.shape === 'composite') return null; // owned by the composite
  return parts2D(e, d, pose2D(e));
}

function parts3D(e, d, m) {
  const shape = d.shape ?? 'box', off = d.offset ?? [0, 0, 0];
  const sx = axisLen(m, 0), sy = axisLen(m, 1), sz = axisLen(m, 2);
  const ax = [[m[0] / (sx || 1), m[1] / (sx || 1), m[2] / (sx || 1)], [m[4] / (sy || 1), m[5] / (sy || 1), m[6] / (sy || 1)], [m[8] / (sz || 1), m[9] / (sz || 1), m[10] / (sz || 1)]];
  const ext = autoExtents(e), local = d.size ?? (ext ? ext.map((v, i) => v / ([sx, sy, sz][i] || 1)) : [1, 1, 1]);
  const c = xf3(m, off);
  if (shape === 'sphere') return [G.sphere(c, (d.radius ?? Math.max(...local) / 2) * Math.max(sx, sy, sz))];
  if (shape === 'capsule') {
    const r = (d.radius ?? Math.min(local[0], local[2]) / 2), hh = Math.max(local[1] / 2 - r, 0), k = Math.max(sx, sz);
    return [G.capsule(xf3(m, [off[0], off[1] - hh, off[2]]), xf3(m, [off[0], off[1] + hh, off[2]]), r * k)];
  }
  if (shape === 'cylinder') {
    const rr = local[0] / 2, hh = local[1] / 2, pts = [];
    for (let i = 0; i < 16; i++) { const a = i / 16 * Math.PI * 2; for (const y of [-hh, hh]) pts.push(xf3(m, [off[0] + Math.cos(a) * rr, off[1] + y, off[2] + Math.sin(a) * rr])); }
    return [{ kind: 'poly', core: pts, radius: 0 }];
  }
  return [G.box(c, ax, [local[0] / 2 * sx, local[1] / 2 * sy, (local[2] ?? 1) / 2 * sz])];
}
/** Shape of an entity's collider in 3D, or null. */
export function shape3D(e) {
  const col = e.getComponent('collider'); if (!col) return null;
  return parts3D(e, col.data, matrix3D(e));
}
const shapeOf = (e) => (is3D() ? shape3D(e) : shape2D(e));
unityHooks.shapeOf = shapeOf;

// ---------------------------------------------------------------- iteration and filtering
const ignoredPairs = new Set();
const ignoredLayers = new Set();
const pairKey = (a, b) => (a.id < b.id ? `${a.id}|${b.id}` : `${b.id}|${a.id}`);
const layerKey = (a, b) => (a < b ? `${a}|${b}` : `${b}|${a}`);
function* candidates(mask, includeTriggers, caster = null) {
  for (const e of game()?.scene?.all?.() ?? []) {
    if (!e.enabled || e.destroyed || !(mask & (1 << e.layer))) continue;
    const col = e.getComponent('collider'); if (!col || (!includeTriggers && col.data.trigger)) continue;
    if (caster && (e === caster || ignoredPairs.has(pairKey(e, caster)) || ignoredLayers.has(layerKey(e.layer, caster.layer)))) continue;
    const s = shapeOf(e); if (s) yield [e, s];
  }
}
const triggers2D = () => Physics2D.queriesHitTriggers !== false;
const triggers3D = (qti) => (qti === QueryTriggerInteraction.Ignore ? false : qti === QueryTriggerInteraction.Collide ? true : Physics.queriesHitTriggers !== false);
const fill = (results, list) => { const cap = results.length || Infinity; const n = Math.min(list.length, cap === Infinity ? list.length : cap); for (let i = 0; i < n; i++) results[i] = list[i]; return n; };
const rb2 = (e) => Rigidbody2D.Of(e);
const tr = (e) => Transform.Of(e);
const v2 = (a) => new Vector2(a[0] + 0, a[1] + 0);
const v3 = (a) => new Vector3(a[0] + 0, a[1] + 0, a[2] + 0);

// ---------------------------------------------------------------- Physics2D
const hit2 = (e, h, origin, dist, centroid) => ({
  collider: e, transform: tr(e), rigidbody: rb2(e), gameObject: e, point: v2(h.point), normal: v2(h.normal), distance: h.t, fraction: dist === Infinity ? 0 : h.t / dist,
  centroid: centroid ? v2(centroid) : v2(h.point),
});
const MISS2 = () => ({ collider: null, transform: null, rigidbody: null, gameObject: null, point: Vector2.zero, normal: Vector2.zero, distance: 0, fraction: 0, centroid: Vector2.zero });
const dir2 = (d) => { const l = Math.hypot(d.x, d.y) || 1; return [d.x / l, d.y / l, 0]; };
function castRay2D(origin, direction, distance, mask, filter = null) {
  const o = [origin.x, origin.y, 0], d = dir2(direction), out = [];
  for (const [e, s] of candidates(mask, filter ? filter.useTriggers : triggers2D())) {
    if (filter?.IsFilteringLayerMask(e)) continue;
    const h = G.ray(o, d, s, distance, Physics2D.queriesStartInColliders !== false);
    if (h) out.push(hit2(e, h, origin, distance));
  }
  return out.sort((a, b) => a.distance - b.distance);
}
function castShape2D(shapeAt, origin, direction, distance, mask, filter = null) {
  const d = dir2(direction), out = [], A = shapeAt(), c = [origin.x, origin.y, 0];
  for (const [e, s] of candidates(mask, filter ? filter.useTriggers : triggers2D())) {
    if (filter?.IsFilteringLayerMask(e)) continue;
    const h = G.sweep(A, d, distance, s, c);
    if (h) out.push(hit2(e, { t: h.t, point: h.point, normal: h.normal }, origin, distance, h.centroid));
  }
  return out.sort((a, b) => a.distance - b.distance);
}
const rot2 = (angle) => { const a = (angle ?? 0) * D2R; return [Math.cos(a), Math.sin(a)]; };
const circleShape = (p, r) => () => [G.sphere([p.x, p.y, 0], r)];
function boxShape(p, size, angle) {
  return () => {
    const [c, s] = rot2(angle), hw = size.x / 2, hh = size.y / 2, pt = (x, y) => [p.x + x * c - y * s, p.y + x * s + y * c, 0];
    return [G.poly([pt(-hw, -hh), pt(hw, -hh), pt(hw, hh), pt(-hw, hh)])];
  };
}
function capsuleShape(p, size, dir, angle) {
  return () => {
    const horizontal = dir === CapsuleDirection2D.Horizontal || String(dir).toLowerCase().startsWith('h'), [c, s] = rot2(angle);
    const r = Math.min(size.x, size.y) / 2, half = Math.max((horizontal ? size.x : size.y) / 2 - r, 0), pt = (x, y) => [p.x + x * c - y * s, p.y + x * s + y * c, 0];
    return [G.capsule(horizontal ? pt(-half, 0) : pt(0, -half), horizontal ? pt(half, 0) : pt(0, half), r)];
  };
}
function overlap2D(shape, mask, filter = null) {
  const out = [];
  for (const [e, s] of candidates(mask, filter ? filter.useTriggers : triggers2D())) {
    if (filter?.IsFilteringLayerMask(e)) continue;
    if (G.overlaps(shape, s)) out.push(e);
  }
  return out;
}
const isFilter = (x) => x instanceof ContactFilter2D;

Object.assign(Physics2D, {
  queriesHitTriggers: true,
  queriesStartInColliders: true,
  defaultContactOffset: 0.01,
  AllLayers: Physics2DLayers.AllLayers,
  DefaultRaycastLayers: Physics2DLayers.DefaultRaycastLayers,
  IgnoreRaycastLayer: Physics2DLayers.IgnoreRaycastLayer,

  /** `Raycast(origin, direction, distance, layerMask)` → hit (`.collider` is null when nothing is hit). With a ContactFilter2D: `Raycast(origin, direction, filter, results, distance)` → count. */
  Raycast(origin, direction, a = Infinity, b, c) {
    if (isFilter(a)) return fill(b, castRay2D(origin, direction, c ?? Infinity, a.useLayerMask ? a.layerMask : ALL, a));
    return castRay2D(origin, direction, a, maskOf(b))[0] ?? MISS2();
  },
  RaycastAll: (origin, direction, distance = Infinity, mask) => castRay2D(origin, direction, distance, maskOf(mask)),
  RaycastNonAlloc: (origin, direction, results, distance = Infinity, mask) => fill(results, castRay2D(origin, direction, distance, maskOf(mask))),
  Linecast(start, end, mask) { const d = new Vector2(end.x - start.x, end.y - start.y); return castRay2D(start, d, d.magnitude, maskOf(mask))[0] ?? MISS2(); },
  LinecastAll(start, end, mask) { const d = new Vector2(end.x - start.x, end.y - start.y); return castRay2D(start, d, d.magnitude, maskOf(mask)); },
  LinecastNonAlloc(start, end, results, mask) { return fill(results, Physics2D.LinecastAll(start, end, mask)); },

  CircleCast: (origin, radius, direction, distance = Infinity, mask) => castShape2D(circleShape(origin, radius), origin, direction, distance, maskOf(mask))[0] ?? MISS2(),
  CircleCastAll: (origin, radius, direction, distance = Infinity, mask) => castShape2D(circleShape(origin, radius), origin, direction, distance, maskOf(mask)),
  CircleCastNonAlloc: (origin, radius, direction, results, distance = Infinity, mask) => fill(results, castShape2D(circleShape(origin, radius), origin, direction, distance, maskOf(mask))),
  BoxCast: (origin, size, angle, direction, distance = Infinity, mask) => castShape2D(boxShape(origin, size, angle), origin, direction, distance, maskOf(mask))[0] ?? MISS2(),
  BoxCastAll: (origin, size, angle, direction, distance = Infinity, mask) => castShape2D(boxShape(origin, size, angle), origin, direction, distance, maskOf(mask)),
  BoxCastNonAlloc: (origin, size, angle, direction, results, distance = Infinity, mask) => fill(results, castShape2D(boxShape(origin, size, angle), origin, direction, distance, maskOf(mask))),
  CapsuleCast: (origin, size, capsuleDirection, angle, direction, distance = Infinity, mask) => castShape2D(capsuleShape(origin, size, capsuleDirection, angle), origin, direction, distance, maskOf(mask))[0] ?? MISS2(),
  CapsuleCastAll: (origin, size, capsuleDirection, angle, direction, distance = Infinity, mask) => castShape2D(capsuleShape(origin, size, capsuleDirection, angle), origin, direction, distance, maskOf(mask)),
  CapsuleCastNonAlloc: (origin, size, capsuleDirection, angle, direction, results, distance = Infinity, mask) => fill(results, castShape2D(capsuleShape(origin, size, capsuleDirection, angle), origin, direction, distance, maskOf(mask))),

  // Overlap*: the single-result forms return a collider's entity or null; *All return arrays; *NonAlloc fill `results` and return the count
  OverlapPoint: (p, mask = ALL) => overlap2D([G.sphere([p.x, p.y, 0], 0)], mask)[0] ?? null,
  OverlapPointAll: (p, mask = ALL) => overlap2D([G.sphere([p.x, p.y, 0], 0)], mask),
  OverlapPointNonAlloc: (p, results, mask = ALL) => fill(results, overlap2D([G.sphere([p.x, p.y, 0], 0)], mask)),
  OverlapCircle: (p, r, mask = ALL) => overlap2D(circleShape(p, r)(), mask)[0] ?? null,
  OverlapCircleAll: (p, r, mask = ALL) => overlap2D(circleShape(p, r)(), mask),
  OverlapCircleNonAlloc: (p, r, results, mask = ALL) => fill(results, overlap2D(circleShape(p, r)(), mask)),
  OverlapBox: (p, size, angle = 0, mask = ALL) => overlap2D(boxShape(p, size, angle)(), mask)[0] ?? null,
  OverlapBoxAll: (p, size, angle = 0, mask = ALL) => overlap2D(boxShape(p, size, angle)(), mask),
  OverlapBoxNonAlloc: (p, size, angle, results, mask = ALL) => fill(results, overlap2D(boxShape(p, size, angle)(), mask)),
  OverlapArea: (a, b, mask = ALL) => Physics2D.OverlapAreaAll(a, b, mask)[0] ?? null,
  OverlapAreaAll: (a, b, mask = ALL) => overlap2D(boxShape(new Vector2((a.x + b.x) / 2, (a.y + b.y) / 2), new Vector2(Math.abs(b.x - a.x), Math.abs(b.y - a.y)), 0)(), mask),
  OverlapAreaNonAlloc: (a, b, results, mask = ALL) => fill(results, Physics2D.OverlapAreaAll(a, b, mask)),
  OverlapCapsule: (p, size, dir, angle = 0, mask = ALL) => overlap2D(capsuleShape(p, size, dir, angle)(), mask)[0] ?? null,
  OverlapCapsuleAll: (p, size, dir, angle = 0, mask = ALL) => overlap2D(capsuleShape(p, size, dir, angle)(), mask),
  OverlapCapsuleNonAlloc: (p, size, dir, angle, results, mask = ALL) => fill(results, overlap2D(capsuleShape(p, size, dir, angle)(), mask)),
  /** Everything touching a collider: `OverlapCollider(collider, filter, results)` → count. */
  OverlapCollider(col, filter, results) {
    const e = col.entity ?? col, mine = shape2D(e); if (!mine) return 0;
    const list = [];
    for (const [o, s] of candidates(filter?.useLayerMask ? filter.layerMask : ALL, filter ? filter.useTriggers : triggers2D(), e)) if (G.overlaps(mine, s)) list.push(o);
    return fill(results ?? [], list);
  },

  /** Closest points between two colliders: `{ distance, isOverlapped, isValid, normal, pointA, pointB }` (distance < 0 when they overlap). */
  Distance(a, b) {
    const sa = shape2D(a.entity ?? a), sb = shape2D(b.entity ?? b);
    if (!sa || !sb) return { distance: 0, isOverlapped: false, isValid: false, normal: Vector2.zero, pointA: Vector2.zero, pointB: Vector2.zero };
    const d = G.distance(sa, sb);
    return { distance: d.distance, isOverlapped: d.overlap, isValid: true, normal: v2(d.normal), pointA: v2(d.pa), pointB: v2(d.pb) };
  },
  /** The point on a collider's surface closest to `position` (inside → the position itself). */
  ClosestPoint(position, col) {
    const s = shape2D(col.entity ?? col); if (!s) return position;
    const d = G.distance(s, [G.sphere([position.x, position.y, 0], 0)]);
    return d.overlap ? position : v2(d.pa);
  },
  /** Are the two colliders touching (shapes closer than the contact offset)? */
  IsTouching(a, b) { const sa = shape2D(a.entity ?? a), sb = shape2D(b.entity ?? b); return !!sa && !!sb && G.distance(sa, sb).distance <= Physics2D.defaultContactOffset; },
  IsTouchingLayers(col, mask = ALL) {
    const e = col.entity ?? col, mine = shape2D(e); if (!mine) return false;
    for (const [, s] of candidates(mask, true, e)) if (G.distance(mine, s).distance <= Physics2D.defaultContactOffset) return true;
    return false;
  },

  /** Make two colliders (or their objects) pass through each other. */
  IgnoreCollision(a, b, ignore = true) {
    const ea = a.entity ?? a, eb = b.entity ?? b, k = pairKey(ea, eb);
    if (ignore) ignoredPairs.add(k); else ignoredPairs.delete(k);
    game()?.physics?.setIgnore?.(ea, eb, ignore);
  },
  GetIgnoreCollision: (a, b) => ignoredPairs.has(pairKey(a.entity ?? a, b.entity ?? b)),
  IgnoreLayerCollision(layerA, layerB, ignore = true) {
    const k = layerKey(layerA, layerB);
    if (ignore) ignoredLayers.add(k); else ignoredLayers.delete(k);
    game()?.physics?.setIgnoreLayers?.(layerA, layerB, ignore);
  },
  GetIgnoreLayerCollision: (a, b) => ignoredLayers.has(layerKey(a, b)),
});

// ---------------------------------------------------------------- Physics (3D)
const hit3 = (e, h, dist) => ({
  collider: e, gameObject: e, transform: tr(e), rigidbody: rb2(e), point: v3(h.point), normal: v3(h.normal), distance: h.t, fraction: dist === Infinity ? 0 : h.t / dist,
});
const MISS3 = () => ({ collider: null, gameObject: null, transform: null, rigidbody: null, point: Vector3.zero, normal: Vector3.zero, distance: 0 });
const dir3 = (d) => { const l = Math.hypot(d.x, d.y, d.z) || 1; return [d.x / l, d.y / l, d.z / l]; };
const asRay = (a, b) => (a && a.origin && a.direction ? [a.origin, a.direction, b] : null);
function ray3(origin, direction, dist, mask, qti) {
  const o = [origin.x, origin.y, origin.z], d = dir3(direction), out = [];
  for (const [e, s] of candidates(mask, triggers3D(qti))) { const h = G.ray(o, d, s, dist, false); if (h) out.push(hit3(e, h, dist)); }
  return out.sort((a, b) => a.distance - b.distance);
}
function cast3(shape, centre, direction, dist, mask, qti) {
  const d = dir3(direction), out = [];
  for (const [e, s] of candidates(mask, triggers3D(qti))) { const h = G.sweep(shape, d, dist, s, centre); if (h) out.push({ ...hit3(e, h, dist), centroid: v3(h.centroid ?? centre) }); }
  return out.sort((a, b) => a.distance - b.distance);
}
function over3(shape, mask, qti) { const out = []; for (const [e, s] of candidates(mask, triggers3D(qti))) if (G.overlaps(shape, s)) out.push(e); return out; }
const sph3 = (c, r) => [G.sphere([c.x, c.y, c.z], r)];
const cap3 = (a, b, r) => [G.capsule([a.x, a.y, a.z], [b.x, b.y, b.z], r)];
function box3(c, half, q = Quaternion.identity) {
  const ax = [q.Multiply(Vector3.right), q.Multiply(Vector3.up), q.Multiply(Vector3.forward)].map((v) => [v.x, v.y, v.z]);
  return [G.box([c.x, c.y, c.z], ax, [half.x, half.y, half.z])];
}
/** Unity lets most casts take a Ray: `(ray, maxDistance, layerMask)`; both forms are accepted. */
const withRay = (fn) => (...a) => { const r = a[0]?.origin && a[0]?.direction ? a[0] : null; return r ? fn(r.origin, r.direction, ...a.slice(1)) : fn(...a); };
const M3 = (m) => (m == null ? ALL : m);
Object.assign(Physics, {
  queriesHitTriggers: true,
  AllLayers: -1, DefaultRaycastLayers: ~(1 << 2), IgnoreRaycastLayer: 1 << 2,
  /** Closest hit (Havok) when the engine has a physics world, else geometry; `.collider` is null on a miss. */
  Raycast: withRay((origin, direction, maxDistance = Infinity, mask = ALL, qti = 0) => {
    const px = game()?.physics;
    if (px?.raycast && mask === ALL && qti === 0 && Number.isFinite(maxDistance)) { // exact engine ray for the common call
      const d = new Vector3(direction.x, direction.y, direction.z).normalized, to = [origin.x + d.x * maxDistance, origin.y + d.y * maxDistance, origin.z + d.z * maxDistance];
      const h = px.raycast([origin.x, origin.y, origin.z], to);
      if (h) return { collider: h.entity, gameObject: h.entity, transform: h.entity && tr(h.entity), rigidbody: h.entity && rb2(h.entity), point: v3(h.point), normal: v3(h.normal), distance: h.distance };
    }
    return ray3(origin, direction, maxDistance, M3(mask), qti)[0] ?? MISS3();
  }),
  Linecast(a, b, mask = ALL, qti = 0) { const d = b.Sub(a); return Physics.Raycast(a, d, d.magnitude, mask, qti); },
  RaycastAll: withRay((origin, direction, maxDistance = Infinity, mask = ALL, qti = 0) => ray3(origin, direction, maxDistance, M3(mask), qti)),
  RaycastNonAlloc: withRay((origin, direction, results, maxDistance = Infinity, mask = ALL, qti = 0) => fill(results, ray3(origin, direction, maxDistance, M3(mask), qti))),
  SphereCast: withRay((origin, radius, direction, maxDistance = Infinity, mask = ALL, qti = 0) => cast3(sph3(origin, radius), [origin.x, origin.y, origin.z], direction, maxDistance, M3(mask), qti)[0] ?? MISS3()),
  SphereCastAll: withRay((origin, radius, direction, maxDistance = Infinity, mask = ALL, qti = 0) => cast3(sph3(origin, radius), [origin.x, origin.y, origin.z], direction, maxDistance, M3(mask), qti)),
  SphereCastNonAlloc: withRay((origin, radius, direction, results, maxDistance = Infinity, mask = ALL, qti = 0) => fill(results, cast3(sph3(origin, radius), [origin.x, origin.y, origin.z], direction, maxDistance, M3(mask), qti))),
  CapsuleCast: (p1, p2, radius, direction, maxDistance = Infinity, mask = ALL, qti = 0) => cast3(cap3(p1, p2, radius), [(p1.x + p2.x) / 2, (p1.y + p2.y) / 2, (p1.z + p2.z) / 2], direction, maxDistance, M3(mask), qti)[0] ?? MISS3(),
  CapsuleCastAll: (p1, p2, radius, direction, maxDistance = Infinity, mask = ALL, qti = 0) => cast3(cap3(p1, p2, radius), [(p1.x + p2.x) / 2, (p1.y + p2.y) / 2, (p1.z + p2.z) / 2], direction, maxDistance, M3(mask), qti),
  CapsuleCastNonAlloc: (p1, p2, radius, direction, results, maxDistance = Infinity, mask = ALL, qti = 0) => fill(results, Physics.CapsuleCastAll(p1, p2, radius, direction, maxDistance, mask, qti)),
  /** `BoxCast(center, halfExtents, direction, orientation, maxDistance, layerMask)`. */
  BoxCast: (center, half, direction, orientation = Quaternion.identity, maxDistance = Infinity, mask = ALL, qti = 0) => cast3(box3(center, half, orientation), [center.x, center.y, center.z], direction, maxDistance, M3(mask), qti)[0] ?? MISS3(),
  BoxCastAll: (center, half, direction, orientation = Quaternion.identity, maxDistance = Infinity, mask = ALL, qti = 0) => cast3(box3(center, half, orientation), [center.x, center.y, center.z], direction, maxDistance, M3(mask), qti),
  BoxCastNonAlloc: (center, half, direction, results, orientation = Quaternion.identity, maxDistance = Infinity, mask = ALL, qti = 0) => fill(results, Physics.BoxCastAll(center, half, direction, orientation, maxDistance, mask, qti)),

  OverlapSphere: (c, r, mask = ALL, qti = 0) => over3(sph3(c, r), M3(mask), qti),
  OverlapSphereNonAlloc: (c, r, results, mask = ALL, qti = 0) => fill(results, over3(sph3(c, r), M3(mask), qti)),
  OverlapBox: (c, half, orientation = Quaternion.identity, mask = ALL, qti = 0) => over3(box3(c, half, orientation), M3(mask), qti),
  OverlapBoxNonAlloc: (c, half, results, orientation = Quaternion.identity, mask = ALL, qti = 0) => fill(results, over3(box3(c, half, orientation), M3(mask), qti)),
  OverlapCapsule: (p1, p2, r, mask = ALL, qti = 0) => over3(cap3(p1, p2, r), M3(mask), qti),
  OverlapCapsuleNonAlloc: (p1, p2, r, results, mask = ALL, qti = 0) => fill(results, over3(cap3(p1, p2, r), M3(mask), qti)),
  CheckSphere: (c, r, mask = ALL, qti = 0) => over3(sph3(c, r), M3(mask), qti).length > 0,
  CheckBox: (c, half, orientation = Quaternion.identity, mask = ALL, qti = 0) => over3(box3(c, half, orientation), M3(mask), qti).length > 0,
  CheckCapsule: (p1, p2, r, mask = ALL, qti = 0) => over3(cap3(p1, p2, r), M3(mask), qti).length > 0,
  /** Closest point on a collider to a world position. */
  ClosestPoint(point, collider) {
    const s = shape3D(collider.entity ?? collider); if (!s) return point;
    const d = G.distance(s, [G.sphere([point.x, point.y, point.z], 0)]);
    return d.overlap ? point : v3(d.pa);
  },
  ComputePenetration() { return { hit: false, direction: Vector3.zero, distance: 0 }; },
  IgnoreCollision(a, b, ignore = true) {
    const ea = a.entity ?? a, eb = b.entity ?? b, k = pairKey(ea, eb);
    if (ignore) ignoredPairs.add(k); else ignoredPairs.delete(k);
    game()?.physics?.setIgnore?.(ea, eb, ignore);
  },
  GetIgnoreCollision: (a, b) => ignoredPairs.has(pairKey(a.entity ?? a, b.entity ?? b)),
  IgnoreLayerCollision(a, b, ignore = true) {
    const k = layerKey(a, b);
    if (ignore) ignoredLayers.add(k); else ignoredLayers.delete(k);
    game()?.physics?.setIgnoreLayers?.(a, b, ignore);
  },
  GetIgnoreLayerCollision: (a, b) => ignoredLayers.has(layerKey(a, b)),
});

/** World-space bounds (Unity Bounds, 3D axes; z = 0 in 2D) of an entity's collider, or null. Used by Collider.bounds. */
export function colliderBounds(e) {
  const s = shapeOf(e); if (!s) return null;
  const b = G.bounds(s), bb = new Bounds();
  bb.SetMinMax(new Vector3(b.min[0], b.min[1], b.min[2]), new Vector3(b.max[0], b.max[1], b.max[2]));
  return bb;
}
unityHooks.colliderBounds = colliderBounds;
/** Collider.Cast / Rigidbody2D.Cast: sweep the entity's own shape along `direction`, listing what it hits (never itself). */
unityHooks.castCollider = (e, direction, results, distance) => {
  const mine = shape2D(e); if (!mine) return 0;
  const d = dir2(direction), centre = e.worldPos, out = [];
  for (const [o, s] of candidates(ALL, triggers2D(), e)) {
    const h = G.sweep(mine, d, distance, s, [centre[0], centre[1], 0]);
    if (h) out.push(hit2(o, { t: h.t, point: h.point, normal: h.normal }, null, distance, h.centroid));
  }
  out.sort((a, b) => a.distance - b.distance);
  return fill(results, out);
};

/** Forget ignore pairs/layers of the finished scene (Game.loadScene does not reset these statics otherwise). */
export function resetPhysicsIgnores() { ignoredPairs.clear(); ignoredLayers.clear(); }
export { G as Geometry };
