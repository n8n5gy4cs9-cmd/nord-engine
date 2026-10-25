// Unity-style maths types: Vector4, Matrix4x4, Bounds, Rect, RectInt, Ray, Ray2D, Plane, Color32, Random.ColorHSV, Vector2Int, Vector3Int.
// Member names and results follow Unity's public API (UnityCsReference: Runtime/Export/Math, Runtime/Export/Geometry); JS has no operator
// overloading, so `a * b` is `a.Mul(b)` / `Matrix4x4.Multiply(a, b)`. Pure maths: nothing here touches a backend.
//
//   import { Vector4, Matrix4x4, Bounds, Rect, Ray, Plane, Color32 } from 'nord';
import { clamp, lerp } from './util.js';
import { Vector2, Vector3, Color, Random } from './unity.js';
import { Quaternion } from './unity-extra.js';

const D2R = Math.PI / 180;
const EPS = 1e-6;

// ---------------------------------------------------------------- Vector4
export class Vector4 {
  constructor(x = 0, y = 0, z = 0, w = 0) { this.x = x; this.y = y; this.z = z; this.w = w; }
  static get zero() { return new Vector4(0, 0, 0, 0); }
  static get one() { return new Vector4(1, 1, 1, 1); }
  static get positiveInfinity() { return new Vector4(Infinity, Infinity, Infinity, Infinity); }
  static get negativeInfinity() { return new Vector4(-Infinity, -Infinity, -Infinity, -Infinity); }
  /** From a Vector2 / Vector3 / Vector4 / array (missing components 0, like Unity's implicit conversions). */
  static From(v) { return Array.isArray(v) ? new Vector4(v[0] ?? 0, v[1] ?? 0, v[2] ?? 0, v[3] ?? 0) : new Vector4(v.x ?? 0, v.y ?? 0, v.z ?? 0, v.w ?? 0); }
  static Distance(a, b) { return a.Sub(b).magnitude; }
  static Dot(a, b) { return a.x * b.x + a.y * b.y + a.z * b.z + a.w * b.w; }
  static Lerp(a, b, t) { t = clamp(t, 0, 1); return Vector4.LerpUnclamped(a, b, t); }
  static LerpUnclamped(a, b, t) { return new Vector4(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t, a.z + (b.z - a.z) * t, a.w + (b.w - a.w) * t); }
  static MoveTowards(a, b, maxDelta) { const d = b.Sub(a), m = d.magnitude; return m <= maxDelta || m < EPS ? b.Clone() : a.Add(d.Mul(maxDelta / m)); }
  static Scale(a, b) { return a.Scale(b); }
  static Project(a, n) { const s = Vector4.Dot(n, n); return s < EPS ? Vector4.zero : n.Mul(Vector4.Dot(a, n) / s); }
  static Min(a, b) { return new Vector4(Math.min(a.x, b.x), Math.min(a.y, b.y), Math.min(a.z, b.z), Math.min(a.w, b.w)); }
  static Max(a, b) { return new Vector4(Math.max(a.x, b.x), Math.max(a.y, b.y), Math.max(a.z, b.z), Math.max(a.w, b.w)); }
  get magnitude() { return Math.sqrt(Vector4.Dot(this, this)); }
  get sqrMagnitude() { return Vector4.Dot(this, this); }
  get normalized() { const m = this.magnitude; return m > 1e-5 ? this.Mul(1 / m) : Vector4.zero; }
  Clone() { return new Vector4(this.x, this.y, this.z, this.w); }
  Add(v) { return new Vector4(this.x + v.x, this.y + v.y, this.z + v.z, this.w + v.w); }
  Sub(v) { return new Vector4(this.x - v.x, this.y - v.y, this.z - v.z, this.w - v.w); }
  Mul(k) { return new Vector4(this.x * k, this.y * k, this.z * k, this.w * k); }
  Div(k) { return this.Mul(1 / k); }
  Scale(v) { return new Vector4(this.x * v.x, this.y * v.y, this.z * v.z, this.w * v.w); }
  Set(x, y, z, w) { this.x = x; this.y = y; this.z = z; this.w = w; return this; }
  Normalize() { const n = this.normalized; return this.Set(n.x, n.y, n.z, n.w); }
  Equals(v) { return this.x === v.x && this.y === v.y && this.z === v.z && this.w === v.w; }
  /** Components 0..3 (Unity's `v[i]`). */
  Get(i) { return [this.x, this.y, this.z, this.w][i]; }
  toArray() { return [this.x, this.y, this.z, this.w]; }
  toVector3() { return new Vector3(this.x, this.y, this.z); }
  toVector2() { return new Vector2(this.x, this.y); }
  toString() { return `(${this.x}, ${this.y}, ${this.z}, ${this.w})`; }
}

// ---------------------------------------------------------------- Matrix4x4
// Stored column-major like Unity: element (row r, column c) is m[r + c * 4]. `m00 … m33` are the Unity field names (row, column).
const IDX = (r, c) => r + c * 4;
export class Matrix4x4 {
  constructor(c0, c1, c2, c3) {
    this.m = new Float64Array(16);
    if (c0) for (const [c, col] of [c0, c1, c2, c3].entries()) { this.m[c * 4] = col.x; this.m[c * 4 + 1] = col.y; this.m[c * 4 + 2] = col.z; this.m[c * 4 + 3] = col.w; }
  }
  static get identity() { const r = new Matrix4x4(); r.m[0] = r.m[5] = r.m[10] = r.m[15] = 1; return r; }
  static get zero() { return new Matrix4x4(); }
  static FromArray(a) { const r = new Matrix4x4(); r.m.set(a); return r; }
  /** Translation matrix. */
  static Translate(v) { const r = Matrix4x4.identity; r.m[12] = v.x; r.m[13] = v.y; r.m[14] = v.z; return r; }
  static Scale(v) { const r = Matrix4x4.identity; r.m[0] = v.x; r.m[5] = v.y; r.m[10] = v.z; return r; }
  /** Rotation matrix from a Quaternion. */
  static Rotate(q) {
    const { x, y, z, w } = q, r = Matrix4x4.identity;
    r.m[0] = 1 - 2 * (y * y + z * z); r.m[4] = 2 * (x * y - z * w); r.m[8] = 2 * (x * z + y * w);
    r.m[1] = 2 * (x * y + z * w); r.m[5] = 1 - 2 * (x * x + z * z); r.m[9] = 2 * (y * z - x * w);
    r.m[2] = 2 * (x * z - y * w); r.m[6] = 2 * (y * z + x * w); r.m[10] = 1 - 2 * (x * x + y * y);
    return r;
  }
  /** Translation · Rotation · Scale (applied to a point: scale first, then rotate, then translate). */
  static TRS(pos, q, s) {
    const r = Matrix4x4.Rotate(q);
    for (let c = 0; c < 3; c++) for (let i = 0; i < 3; i++) r.m[c * 4 + i] *= [s.x, s.y, s.z][c];
    r.m[12] = pos.x; r.m[13] = pos.y; r.m[14] = pos.z;
    return r;
  }
  /** Orthographic projection (OpenGL convention: camera looks down -Z, clip z in -1..1). */
  static Ortho(left, right, bottom, top, zNear, zFar) {
    const r = Matrix4x4.zero;
    r.m[0] = 2 / (right - left); r.m[12] = -(right + left) / (right - left);
    r.m[5] = 2 / (top - bottom); r.m[13] = -(top + bottom) / (top - bottom);
    r.m[10] = -2 / (zFar - zNear); r.m[14] = -(zFar + zNear) / (zFar - zNear); r.m[15] = 1;
    return r;
  }
  /** Perspective projection. `fov` is the vertical field of view in degrees. */
  static Perspective(fov, aspect, zNear, zFar) {
    const r = Matrix4x4.zero, y = 1 / Math.tan(fov * D2R / 2);
    r.m[0] = y / aspect; r.m[5] = y; r.m[10] = -(zFar + zNear) / (zFar - zNear); r.m[14] = -(2 * zFar * zNear) / (zFar - zNear); r.m[11] = -1;
    return r;
  }
  static Frustum(left, right, bottom, top, zNear, zFar) {
    const r = Matrix4x4.zero;
    r.m[0] = 2 * zNear / (right - left); r.m[8] = (right + left) / (right - left);
    r.m[5] = 2 * zNear / (top - bottom); r.m[9] = (top + bottom) / (top - bottom);
    r.m[10] = -(zFar + zNear) / (zFar - zNear); r.m[14] = -(2 * zFar * zNear) / (zFar - zNear); r.m[11] = -1;
    return r;
  }
  /** World → view matrix of a camera at `from` looking at `to` (inverse of the camera's own TRS, +Z forward like `Quaternion.LookRotation`). */
  static LookAt(from, to, up) {
    return Matrix4x4.TRS(from, Quaternion.LookRotation(to.Sub(from), up), Vector3.one).inverse;
  }
  static Multiply(a, b) {
    const r = new Matrix4x4();
    for (let c = 0; c < 4; c++) for (let rr = 0; rr < 4; rr++) {
      let s = 0; for (let k = 0; k < 4; k++) s += a.m[rr + k * 4] * b.m[k + c * 4];
      r.m[rr + c * 4] = s;
    }
    return r;
  }
  static Inverse(a) { return a.inverse; }
  static Transpose(a) { return a.transpose; }
  static Determinant(a) { return a.determinant; }
  /** `matrix * matrix2`, `matrix * Vector4` (→ Vector4) or `matrix * point` (Vector3, same as MultiplyPoint). */
  Mul(o) {
    if (o instanceof Matrix4x4) return Matrix4x4.Multiply(this, o);
    if (o instanceof Vector4) { const m = this.m; return new Vector4(m[0] * o.x + m[4] * o.y + m[8] * o.z + m[12] * o.w, m[1] * o.x + m[5] * o.y + m[9] * o.z + m[13] * o.w, m[2] * o.x + m[6] * o.y + m[10] * o.z + m[14] * o.w, m[3] * o.x + m[7] * o.y + m[11] * o.z + m[15] * o.w); }
    return this.MultiplyPoint(o);
  }
  /** Transform a point including the perspective divide. */
  MultiplyPoint(p) {
    const m = this.m, w = m[3] * p.x + m[7] * p.y + m[11] * p.z + m[15], d = Math.abs(w) > 1e-12 ? 1 / w : 0;
    return new Vector3((m[0] * p.x + m[4] * p.y + m[8] * p.z + m[12]) * d, (m[1] * p.x + m[5] * p.y + m[9] * p.z + m[13]) * d, (m[2] * p.x + m[6] * p.y + m[10] * p.z + m[14]) * d);
  }
  /** Transform a point by the affine part only (faster, ignores the last row). */
  MultiplyPoint3x4(p) {
    const m = this.m;
    return new Vector3(m[0] * p.x + m[4] * p.y + m[8] * p.z + m[12], m[1] * p.x + m[5] * p.y + m[9] * p.z + m[13], m[2] * p.x + m[6] * p.y + m[10] * p.z + m[14]);
  }
  /** Transform a direction (no translation). */
  MultiplyVector(v) {
    const m = this.m;
    return new Vector3(m[0] * v.x + m[4] * v.y + m[8] * v.z, m[1] * v.x + m[5] * v.y + m[9] * v.z, m[2] * v.x + m[6] * v.y + m[10] * v.z);
  }
  get transpose() { const r = new Matrix4x4(); for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) r.m[IDX(i, j)] = this.m[IDX(j, i)]; return r; }
  get determinant() {
    const m = this.m;
    const s0 = m[0] * m[5] - m[4] * m[1], s1 = m[0] * m[9] - m[8] * m[1], s2 = m[0] * m[13] - m[12] * m[1], s3 = m[4] * m[9] - m[8] * m[5], s4 = m[4] * m[13] - m[12] * m[5], s5 = m[8] * m[13] - m[12] * m[9];
    const c5 = m[10] * m[15] - m[14] * m[11], c4 = m[6] * m[15] - m[14] * m[7], c3 = m[6] * m[11] - m[10] * m[7], c2 = m[2] * m[15] - m[14] * m[3], c1 = m[2] * m[11] - m[10] * m[3], c0 = m[2] * m[7] - m[6] * m[3];
    return s0 * c5 - s1 * c4 + s2 * c3 + s3 * c2 - s4 * c1 + s5 * c0;
  }
  /** General 4×4 inverse; a singular matrix gives the zero matrix (as Unity does). */
  get inverse() {
    const m = this.m, inv = new Float64Array(16);
    inv[0] = m[5] * m[10] * m[15] - m[5] * m[11] * m[14] - m[9] * m[6] * m[15] + m[9] * m[7] * m[14] + m[13] * m[6] * m[11] - m[13] * m[7] * m[10];
    inv[4] = -m[4] * m[10] * m[15] + m[4] * m[11] * m[14] + m[8] * m[6] * m[15] - m[8] * m[7] * m[14] - m[12] * m[6] * m[11] + m[12] * m[7] * m[10];
    inv[8] = m[4] * m[9] * m[15] - m[4] * m[11] * m[13] - m[8] * m[5] * m[15] + m[8] * m[7] * m[13] + m[12] * m[5] * m[11] - m[12] * m[7] * m[9];
    inv[12] = -m[4] * m[9] * m[14] + m[4] * m[10] * m[13] + m[8] * m[5] * m[14] - m[8] * m[6] * m[13] - m[12] * m[5] * m[10] + m[12] * m[6] * m[9];
    inv[1] = -m[1] * m[10] * m[15] + m[1] * m[11] * m[14] + m[9] * m[2] * m[15] - m[9] * m[3] * m[14] - m[13] * m[2] * m[11] + m[13] * m[3] * m[10];
    inv[5] = m[0] * m[10] * m[15] - m[0] * m[11] * m[14] - m[8] * m[2] * m[15] + m[8] * m[3] * m[14] + m[12] * m[2] * m[11] - m[12] * m[3] * m[10];
    inv[9] = -m[0] * m[9] * m[15] + m[0] * m[11] * m[13] + m[8] * m[1] * m[15] - m[8] * m[3] * m[13] - m[12] * m[1] * m[11] + m[12] * m[3] * m[9];
    inv[13] = m[0] * m[9] * m[14] - m[0] * m[10] * m[13] - m[8] * m[1] * m[14] + m[8] * m[2] * m[13] + m[12] * m[1] * m[10] - m[12] * m[2] * m[9];
    inv[2] = m[1] * m[6] * m[15] - m[1] * m[7] * m[14] - m[5] * m[2] * m[15] + m[5] * m[3] * m[14] + m[13] * m[2] * m[7] - m[13] * m[3] * m[6];
    inv[6] = -m[0] * m[6] * m[15] + m[0] * m[7] * m[14] + m[4] * m[2] * m[15] - m[4] * m[3] * m[14] - m[12] * m[2] * m[7] + m[12] * m[3] * m[6];
    inv[10] = m[0] * m[5] * m[15] - m[0] * m[7] * m[13] - m[4] * m[1] * m[15] + m[4] * m[3] * m[13] + m[12] * m[1] * m[7] - m[12] * m[3] * m[5];
    inv[14] = -m[0] * m[5] * m[14] + m[0] * m[6] * m[13] + m[4] * m[1] * m[14] - m[4] * m[2] * m[13] - m[12] * m[1] * m[6] + m[12] * m[2] * m[5];
    inv[3] = -m[1] * m[6] * m[11] + m[1] * m[7] * m[10] + m[5] * m[2] * m[11] - m[5] * m[3] * m[10] - m[9] * m[2] * m[7] + m[9] * m[3] * m[6];
    inv[7] = m[0] * m[6] * m[11] - m[0] * m[7] * m[10] - m[4] * m[2] * m[11] + m[4] * m[3] * m[10] + m[8] * m[2] * m[7] - m[8] * m[3] * m[6];
    inv[11] = -m[0] * m[5] * m[11] + m[0] * m[7] * m[9] + m[4] * m[1] * m[11] - m[4] * m[3] * m[9] - m[8] * m[1] * m[7] + m[8] * m[3] * m[5];
    inv[15] = m[0] * m[5] * m[10] - m[0] * m[6] * m[9] - m[4] * m[1] * m[10] + m[4] * m[2] * m[9] + m[8] * m[1] * m[6] - m[8] * m[2] * m[5];
    const det = m[0] * inv[0] + m[1] * inv[4] + m[2] * inv[8] + m[3] * inv[12];
    const r = new Matrix4x4();
    if (Math.abs(det) < 1e-300) return r;
    for (let i = 0; i < 16; i++) r.m[i] = inv[i] / det;
    return r;
  }
  get isIdentity() { const id = Matrix4x4.identity.m; return this.m.every((v, i) => Math.abs(v - id[i]) < EPS); }
  /** Position part (the translation column). */
  GetPosition() { return new Vector3(this.m[12], this.m[13], this.m[14]); }
  get lossyScale() { const m = this.m; return new Vector3(Math.hypot(m[0], m[1], m[2]), Math.hypot(m[4], m[5], m[6]), Math.hypot(m[8], m[9], m[10])); }
  /** Rotation as a Quaternion (scale removed). */
  get rotation() {
    const s = this.lossyScale, m = this.m;
    const r00 = m[0] / (s.x || 1), r10 = m[1] / (s.x || 1), r20 = m[2] / (s.x || 1), r01 = m[4] / (s.y || 1), r11 = m[5] / (s.y || 1), r21 = m[6] / (s.y || 1), r02 = m[8] / (s.z || 1), r12 = m[9] / (s.z || 1), r22 = m[10] / (s.z || 1);
    const t = r00 + r11 + r22;
    if (t > 0) { const k = Math.sqrt(t + 1) * 2; return new Quaternion((r21 - r12) / k, (r02 - r20) / k, (r10 - r01) / k, k / 4); }
    if (r00 > r11 && r00 > r22) { const k = Math.sqrt(1 + r00 - r11 - r22) * 2; return new Quaternion(k / 4, (r01 + r10) / k, (r02 + r20) / k, (r21 - r12) / k); }
    if (r11 > r22) { const k = Math.sqrt(1 + r11 - r00 - r22) * 2; return new Quaternion((r01 + r10) / k, k / 4, (r12 + r21) / k, (r02 - r20) / k); }
    const k = Math.sqrt(1 + r22 - r00 - r11) * 2; return new Quaternion((r02 + r20) / k, (r12 + r21) / k, k / 4, (r10 - r01) / k);
  }
  /** Is this an affine matrix with a usable rotation/scale (last row 0 0 0 1)? */
  ValidTRS() { const m = this.m; return Math.abs(m[3]) < EPS && Math.abs(m[7]) < EPS && Math.abs(m[11]) < EPS && Math.abs(m[15] - 1) < EPS; }
  SetTRS(pos, q, s) { this.m.set(Matrix4x4.TRS(pos, q, s).m); }
  /** Element at (row, column), like Unity's `m[row, column]`. */
  Get(row, column) { return this.m[IDX(row, column)]; }
  Set(row, column, v) { this.m[IDX(row, column)] = v; return this; }
  GetColumn(i) { return new Vector4(this.m[i * 4], this.m[i * 4 + 1], this.m[i * 4 + 2], this.m[i * 4 + 3]); }
  GetRow(i) { return new Vector4(this.m[i], this.m[i + 4], this.m[i + 8], this.m[i + 12]); }
  SetColumn(i, v) { this.m[i * 4] = v.x; this.m[i * 4 + 1] = v.y; this.m[i * 4 + 2] = v.z; this.m[i * 4 + 3] = v.w; }
  SetRow(i, v) { this.m[i] = v.x; this.m[i + 4] = v.y; this.m[i + 8] = v.z; this.m[i + 12] = v.w; }
  /** Plane (a,b,c,d) transformed by this matrix. */
  TransformPlane(plane) { const t = this.inverse.transpose, v = t.Mul(new Vector4(plane.normal.x, plane.normal.y, plane.normal.z, plane.distance)); return new Plane(new Vector3(v.x, v.y, v.z), v.w); }
  Clone() { return Matrix4x4.FromArray(this.m); }
  Equals(o) { return this.m.every((v, i) => v === o.m[i]); }
  toString() { const m = this.m; return [0, 1, 2, 3].map((r) => [0, 1, 2, 3].map((c) => m[IDX(r, c)].toFixed(5)).join('\t')).join('\n'); }
}
for (const r of [0, 1, 2, 3]) for (const c of [0, 1, 2, 3]) {
  Object.defineProperty(Matrix4x4.prototype, `m${r}${c}`, { configurable: true, get() { return this.m[IDX(r, c)]; }, set(v) { this.m[IDX(r, c)] = v; } });
}

// ---------------------------------------------------------------- Bounds (axis-aligned box)
export class Bounds {
  constructor(center = Vector3.zero, size = Vector3.zero) {
    this.center = center.Clone(); this.extents = new Vector3(size.x * 0.5, size.y * 0.5, size.z * 0.5);
  }
  get size() { return this.extents.Mul(2); }
  set size(v) { this.extents = v.Mul(0.5); }
  get min() { return this.center.Sub(this.extents); }
  set min(v) { this.SetMinMax(v, this.max); }
  get max() { return this.center.Add(this.extents); }
  set max(v) { this.SetMinMax(this.min, v); }
  SetMinMax(min, max) { this.extents = max.Sub(min).Mul(0.5); this.center = min.Add(this.extents); }
  /** Grow to contain a point (Vector3) or another Bounds. */
  Encapsulate(o) {
    if (o instanceof Bounds) { this.Encapsulate(o.min); this.Encapsulate(o.max); return; }
    this.SetMinMax(Vector3.Min(this.min, o), Vector3.Max(this.max, o));
  }
  /** Grow the size by `amount` on every axis (number) or per axis (Vector3). */
  Expand(a) { const v = typeof a === 'number' ? new Vector3(a, a, a) : a; this.extents = this.extents.Add(v.Mul(0.5)); }
  Contains(p) { const mn = this.min, mx = this.max; return p.x >= mn.x && p.x <= mx.x && p.y >= mn.y && p.y <= mx.y && p.z >= mn.z && p.z <= mx.z; }
  Intersects(b) { const a0 = this.min, a1 = this.max, b0 = b.min, b1 = b.max; return a0.x <= b1.x && a1.x >= b0.x && a0.y <= b1.y && a1.y >= b0.y && a0.z <= b1.z && a1.z >= b0.z; }
  /** Squared distance from a point to the box (0 inside). */
  SqrDistance(p) { const mn = this.min, mx = this.max; const dx = Math.max(mn.x - p.x, 0, p.x - mx.x), dy = Math.max(mn.y - p.y, 0, p.y - mx.y), dz = Math.max(mn.z - p.z, 0, p.z - mx.z); return dx * dx + dy * dy + dz * dz; }
  ClosestPoint(p) { const mn = this.min, mx = this.max; return new Vector3(clamp(p.x, mn.x, mx.x), clamp(p.y, mn.y, mx.y), clamp(p.z, mn.z, mx.z)); }
  /** Ray test. Returns the hit distance in `{ hit, distance }`; `hit` is false when the ray misses. */
  IntersectRayDetail(ray) {
    const o = [ray.origin.x, ray.origin.y, ray.origin.z], d = [ray.direction.x, ray.direction.y, ray.direction.z];
    const mn = this.min.toArray(), mx = this.max.toArray();
    let tmin = 0, tmax = Infinity;
    for (let i = 0; i < 3; i++) {
      if (Math.abs(d[i]) < 1e-12) { if (o[i] < mn[i] || o[i] > mx[i]) return { hit: false, distance: 0 }; continue; }
      let t1 = (mn[i] - o[i]) / d[i], t2 = (mx[i] - o[i]) / d[i];
      if (t1 > t2) [t1, t2] = [t2, t1];
      tmin = Math.max(tmin, t1); tmax = Math.min(tmax, t2);
      if (tmin > tmax) return { hit: false, distance: 0 };
    }
    return { hit: true, distance: tmin };
  }
  IntersectRay(ray) { return this.IntersectRayDetail(ray).hit; }
  Clone() { const b = new Bounds(); b.center = this.center.Clone(); b.extents = this.extents.Clone(); return b; }
  Equals(o) { return this.center.Equals(o.center) && this.extents.Equals(o.extents); }
  toString() { return `Center: ${this.center}, Extents: ${this.extents}`; }
}

// ---------------------------------------------------------------- Rect
export class Rect {
  constructor(x = 0, y = 0, width = 0, height = 0) {
    if (x instanceof Vector2) { this.x = x.x; this.y = x.y; this.width = y.x; this.height = y.y; return; }
    this.x = x; this.y = y; this.width = width; this.height = height;
  }
  static get zero() { return new Rect(0, 0, 0, 0); }
  static MinMaxRect(xmin, ymin, xmax, ymax) { return new Rect(xmin, ymin, xmax - xmin, ymax - ymin); }
  static PointToNormalized(r, p) { return new Vector2(Rect.#inv(r.x, r.x + r.width, p.x), Rect.#inv(r.y, r.y + r.height, p.y)); }
  static NormalizedToPoint(r, n) { return new Vector2(lerp(r.x, r.x + r.width, n.x), lerp(r.y, r.y + r.height, n.y)); }
  static #inv(a, b, v) { return a === b ? 0 : clamp((v - a) / (b - a), 0, 1); }
  get position() { return new Vector2(this.x, this.y); }
  set position(v) { this.x = v.x; this.y = v.y; }
  get center() { return new Vector2(this.x + this.width / 2, this.y + this.height / 2); }
  set center(v) { this.x = v.x - this.width / 2; this.y = v.y - this.height / 2; }
  get min() { return new Vector2(this.xMin, this.yMin); }
  set min(v) { this.xMin = v.x; this.yMin = v.y; }
  get max() { return new Vector2(this.xMax, this.yMax); }
  set max(v) { this.xMax = v.x; this.yMax = v.y; }
  get size() { return new Vector2(this.width, this.height); }
  set size(v) { this.width = v.x; this.height = v.y; }
  get xMin() { return this.x; } set xMin(v) { const m = this.xMax; this.x = v; this.width = m - this.x; }
  get yMin() { return this.y; } set yMin(v) { const m = this.yMax; this.y = v; this.height = m - this.y; }
  get xMax() { return this.width + this.x; } set xMax(v) { this.width = v - this.x; }
  get yMax() { return this.height + this.y; } set yMax(v) { this.height = v - this.y; }
  Set(x, y, w, h) { this.x = x; this.y = y; this.width = w; this.height = h; return this; }
  /** Is the point (Vector2/Vector3) inside? Left/top edges count, right/bottom do not (like Unity). */
  Contains(p) { return p.x >= this.xMin && p.x < this.xMax && p.y >= this.yMin && p.y < this.yMax; }
  /** Do the rectangles overlap? `allowInverse` accepts rects with negative width/height. */
  Overlaps(o, allowInverse = false) {
    let a = this, b = o;
    if (allowInverse) { a = a.#fix(); b = b.#fix(); }
    return b.xMax > a.xMin && b.xMin < a.xMax && b.yMax > a.yMin && b.yMin < a.yMax;
  }
  #fix() { const r = this.Clone(); if (r.width < 0) { r.x += r.width; r.width = -r.width; } if (r.height < 0) { r.y += r.height; r.height = -r.height; } return r; }
  Clone() { return new Rect(this.x, this.y, this.width, this.height); }
  Equals(o) { return this.x === o.x && this.y === o.y && this.width === o.width && this.height === o.height; }
  toString() { return `(x:${this.x}, y:${this.y}, width:${this.width}, height:${this.height})`; }
}
/** Integer rectangle (Unity's RectInt): same members with whole numbers. */
export class RectInt {
  constructor(x = 0, y = 0, width = 0, height = 0) { this.x = x | 0; this.y = y | 0; this.width = width | 0; this.height = height | 0; }
  get xMin() { return Math.min(this.x, this.x + this.width); } get xMax() { return Math.max(this.x, this.x + this.width); }
  get yMin() { return Math.min(this.y, this.y + this.height); } get yMax() { return Math.max(this.y, this.y + this.height); }
  get position() { return new Vector2Int(this.x, this.y); } get size() { return new Vector2Int(this.width, this.height); }
  get center() { return new Vector2(this.x + this.width / 2, this.y + this.height / 2); }
  Contains(p) { return p.x >= this.xMin && p.y >= this.yMin && p.x < this.xMax && p.y < this.yMax; }
  Overlaps(o) { return o.xMin < this.xMax && o.xMax > this.xMin && o.yMin < this.yMax && o.yMax > this.yMin; }
  /** Every cell position inside, row by row (Unity's `allPositionsWithin`). */
  *allPositionsWithin() { for (let y = this.yMin; y < this.yMax; y++) for (let x = this.xMin; x < this.xMax; x++) yield new Vector2Int(x, y); }
  toString() { return `(x:${this.x}, y:${this.y}, width:${this.width}, height:${this.height})`; }
}

// ---------------------------------------------------------------- Vector2Int / Vector3Int
export class Vector2Int {
  constructor(x = 0, y = 0) { this.x = Math.trunc(x); this.y = Math.trunc(y); }
  static get zero() { return new Vector2Int(0, 0); } static get one() { return new Vector2Int(1, 1); }
  static get up() { return new Vector2Int(0, 1); } static get down() { return new Vector2Int(0, -1); }
  static get left() { return new Vector2Int(-1, 0); } static get right() { return new Vector2Int(1, 0); }
  static Distance(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }
  static FloorToInt(v) { return new Vector2Int(Math.floor(v.x), Math.floor(v.y)); }
  static CeilToInt(v) { return new Vector2Int(Math.ceil(v.x), Math.ceil(v.y)); }
  static RoundToInt(v) { return new Vector2Int(Math.round(v.x), Math.round(v.y)); }
  get magnitude() { return Math.hypot(this.x, this.y); } get sqrMagnitude() { return this.x * this.x + this.y * this.y; }
  Add(v) { return new Vector2Int(this.x + v.x, this.y + v.y); } Sub(v) { return new Vector2Int(this.x - v.x, this.y - v.y); }
  Mul(k) { return new Vector2Int(this.x * k, this.y * k); } Scale(v) { return new Vector2Int(this.x * v.x, this.y * v.y); }
  Set(x, y) { this.x = Math.trunc(x); this.y = Math.trunc(y); return this; }
  Equals(v) { return this.x === v.x && this.y === v.y; } Clone() { return new Vector2Int(this.x, this.y); }
  toVector2() { return new Vector2(this.x, this.y); } toArray() { return [this.x, this.y]; }
  toString() { return `(${this.x}, ${this.y})`; }
}
export class Vector3Int {
  constructor(x = 0, y = 0, z = 0) { this.x = Math.trunc(x); this.y = Math.trunc(y); this.z = Math.trunc(z); }
  static get zero() { return new Vector3Int(0, 0, 0); } static get one() { return new Vector3Int(1, 1, 1); }
  static get up() { return new Vector3Int(0, 1, 0); } static get down() { return new Vector3Int(0, -1, 0); }
  static get left() { return new Vector3Int(-1, 0, 0); } static get right() { return new Vector3Int(1, 0, 0); }
  static get forward() { return new Vector3Int(0, 0, 1); } static get back() { return new Vector3Int(0, 0, -1); }
  static Distance(a, b) { return Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z); }
  static FloorToInt(v) { return new Vector3Int(Math.floor(v.x), Math.floor(v.y), Math.floor(v.z)); }
  static CeilToInt(v) { return new Vector3Int(Math.ceil(v.x), Math.ceil(v.y), Math.ceil(v.z)); }
  static RoundToInt(v) { return new Vector3Int(Math.round(v.x), Math.round(v.y), Math.round(v.z)); }
  get magnitude() { return Math.hypot(this.x, this.y, this.z); } get sqrMagnitude() { return this.x * this.x + this.y * this.y + this.z * this.z; }
  Add(v) { return new Vector3Int(this.x + v.x, this.y + v.y, this.z + v.z); } Sub(v) { return new Vector3Int(this.x - v.x, this.y - v.y, this.z - v.z); }
  Mul(k) { return new Vector3Int(this.x * k, this.y * k, this.z * k); } Scale(v) { return new Vector3Int(this.x * v.x, this.y * v.y, this.z * v.z); }
  Set(x, y, z) { this.x = Math.trunc(x); this.y = Math.trunc(y); this.z = Math.trunc(z); return this; }
  Equals(v) { return this.x === v.x && this.y === v.y && this.z === v.z; } Clone() { return new Vector3Int(this.x, this.y, this.z); }
  toVector3() { return new Vector3(this.x, this.y, this.z); } toArray() { return [this.x, this.y, this.z]; }
  toString() { return `(${this.x}, ${this.y}, ${this.z})`; }
}

// ---------------------------------------------------------------- Ray / Ray2D
export class Ray {
  #o; #d;
  constructor(origin = Vector3.zero, direction = Vector3.forward) { this.#o = origin.Clone(); this.#d = direction.normalized; }
  get origin() { return this.#o; } set origin(v) { this.#o = v.Clone(); }
  get direction() { return this.#d; } set direction(v) { this.#d = v.normalized; }
  GetPoint(distance) { return this.#o.Add(this.#d.Mul(distance)); }
  toString() { return `Origin: ${this.#o}, Dir: ${this.#d}`; }
}
export class Ray2D {
  #o; #d;
  constructor(origin = Vector2.zero, direction = Vector2.right) { this.#o = origin.Clone(); this.#d = direction.normalized; }
  get origin() { return this.#o; } set origin(v) { this.#o = v.Clone(); }
  get direction() { return this.#d; } set direction(v) { this.#d = v.normalized; }
  GetPoint(distance) { return this.#o.Add(this.#d.Mul(distance)); }
  toString() { return `Origin: ${this.#o}, Dir: ${this.#d}`; }
}

// ---------------------------------------------------------------- Plane
/** Plane `normal · p + distance = 0` (Unity's Plane). Constructors: `(normal, point)`, `(normal, distance)`, `(a, b, c)` (three points, clockwise). */
export class Plane {
  constructor(a = Vector3.up, b = 0, c) {
    if (c) { this.normal = Vector3.Cross(b.Sub(a), c.Sub(a)).normalized; this.distance = -Vector3.Dot(this.normal, a); }
    else if (typeof b === 'number') { this.normal = a.Clone(); this.distance = b; }
    else { this.normal = a.normalized; this.distance = -Vector3.Dot(this.normal, b); }
  }
  /** Same as Unity's `new Plane(normal, point)`. */
  static FromNormalPoint(n, p) { return new Plane(n, p); }
  static Translate(plane, t) { return new Plane(plane.normal, plane.distance + Vector3.Dot(plane.normal, t)); }
  get flipped() { return new Plane(this.normal.Mul(-1), -this.distance); }
  Flip() { this.normal = this.normal.Mul(-1); this.distance = -this.distance; }
  SetNormalAndPosition(n, p) { this.normal = n.normalized; this.distance = -Vector3.Dot(this.normal, p); }
  Set3Points(a, b, c) { this.normal = Vector3.Cross(b.Sub(a), c.Sub(a)).normalized; this.distance = -Vector3.Dot(this.normal, a); }
  Translate(t) { this.distance += Vector3.Dot(this.normal, t); }
  GetDistanceToPoint(p) { return Vector3.Dot(this.normal, p) + this.distance; }
  GetSide(p) { return Vector3.Dot(this.normal, p) + this.distance > 0; }
  SameSide(a, b) { const da = this.GetDistanceToPoint(a), db = this.GetDistanceToPoint(b); return (da > 0 && db > 0) || (da <= 0 && db <= 0); }
  ClosestPointOnPlane(p) { return p.Sub(this.normal.Mul(this.GetDistanceToPoint(p))); }
  /** `plane.Raycast(ray)` → `{ hit, enter }` (`enter` = distance along the ray; hit is false when the ray is parallel or points away). */
  Raycast(ray) {
    const vdot = Vector3.Dot(ray.direction, this.normal), ndot = -Vector3.Dot(ray.origin, this.normal) - this.distance;
    if (Math.abs(vdot) < 1e-9) return { hit: false, enter: 0 };
    const enter = ndot / vdot;
    return { hit: enter > 0, enter };
  }
  toString() { return `(normal:${this.normal}, distance:${this.distance.toFixed(2)})`; }
}

// ---------------------------------------------------------------- Color32
const byte = (v) => clamp(Math.round(v), 0, 255);
/** 4 bytes per colour (0-255). `Color32` ↔ `Color` convert with `toColor()` / `Color32.From(color)`. */
export class Color32 {
  constructor(r = 0, g = 0, b = 0, a = 255) { this.r = byte(r); this.g = byte(g); this.b = byte(b); this.a = byte(a); }
  static From(c) { return new Color32(c.r * 255, c.g * 255, c.b * 255, c.a * 255); }
  static FromHex(h) { return Color32.From(Color.FromHex(h)); }
  static Lerp(a, b, t) { t = clamp(t, 0, 1); return new Color32(lerp(a.r, b.r, t), lerp(a.g, b.g, t), lerp(a.b, b.b, t), lerp(a.a, b.a, t)); }
  static LerpUnclamped(a, b, t) { return new Color32(a.r + (b.r - a.r) * t, a.g + (b.g - a.g) * t, a.b + (b.b - a.b) * t, a.a + (b.a - a.a) * t); }
  toColor() { return new Color(this.r / 255, this.g / 255, this.b / 255, this.a / 255); }
  toHex() { const h = (v) => v.toString(16).padStart(2, '0'); return `#${h(this.r)}${h(this.g)}${h(this.b)}`; }
  Clone() { return new Color32(this.r, this.g, this.b, this.a); }
  Equals(o) { return this.r === o.r && this.g === o.g && this.b === o.b && this.a === o.a; }
  toString() { return `RGBA(${this.r}, ${this.g}, ${this.b}, ${this.a})`; }
}

// ---------------------------------------------------------------- Color extras + Random.ColorHSV
/** Unity's Color.HSVToRGB(h, s, v) with all inputs 0..1. */
export function HSVToRGB(h, s, v) {
  h = ((h % 1) + 1) % 1;
  const i = Math.floor(h * 6), f = h * 6 - i, p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  const [r, g, b] = [[v, t, p], [q, v, p], [p, v, t], [p, q, v], [t, p, v], [v, p, q]][i % 6];
  return new Color(r, g, b, 1);
}
/** Unity's Color.RGBToHSV: `{ h, s, v }` (0..1). */
export function RGBToHSV(c) {
  const mx = Math.max(c.r, c.g, c.b), mn = Math.min(c.r, c.g, c.b), d = mx - mn;
  let h = 0;
  if (d > 0) h = mx === c.r ? (((c.g - c.b) / d) % 6) / 6 : mx === c.g ? ((c.b - c.r) / d + 2) / 6 : ((c.r - c.g) / d + 4) / 6;
  return { h: (h + 1) % 1, s: mx === 0 ? 0 : d / mx, v: mx };
}
Object.assign(Color, {
  HSVToRGB: (h, s, v) => HSVToRGB(h, s, v),
  RGBToHSV: (c) => RGBToHSV(c),
  get orange() { return new Color(1, 0.5, 0); }, get purple() { return new Color(0.5, 0, 0.5); }, get grey() { return new Color(0.5, 0.5, 0.5); },
  LerpUnclamped: (a, b, t) => new Color(a.r + (b.r - a.r) * t, a.g + (b.g - a.g) * t, a.b + (b.b - a.b) * t, a.a + (b.a - a.a) * t),
});
Object.defineProperty(Color.prototype, 'grayscale', { configurable: true, get() { return 0.299 * this.r + 0.587 * this.g + 0.114 * this.b; } });
Object.defineProperty(Color.prototype, 'maxColorComponent', { configurable: true, get() { return Math.max(this.r, this.g, this.b); } });
Color.prototype.toColor32 ??= function toColor32() { return Color32.From(this); };
/** Unity's Random.ColorHSV(): a random colour; limits default to the whole range. `Random.ColorHSV(hueMin, hueMax, satMin, satMax, valMin, valMax, alphaMin, alphaMax)`. */
Random.ColorHSV = (hMin = 0, hMax = 1, sMin = 0, sMax = 1, vMin = 0, vMax = 1, aMin = 1, aMax = 1) => {
  const c = HSVToRGB(lerp(hMin, hMax, Random.value), lerp(sMin, sMax, Random.value), lerp(vMin, vMax, Random.value));
  c.a = lerp(aMin, aMax, Random.value);
  return c;
};
Object.defineProperty(Random, 'rotation', { configurable: true, get() { const u = Random.value, v = Random.value * 2 * Math.PI, w = Random.value * 2 * Math.PI, a = Math.sqrt(1 - u), b = Math.sqrt(u); return new Quaternion(a * Math.sin(v), a * Math.cos(v), b * Math.sin(w), b * Math.cos(w)); } });
Object.defineProperty(Random, 'insideUnitCircleNormalized', { configurable: true, get() { return Random.insideUnitCircle.normalized; } });
