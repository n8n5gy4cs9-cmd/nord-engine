// Unity-style layer, part 2: Transform, GameObject members, Quaternion, component wrappers (SpriteRenderer, Rigidbody2D, Animator, AudioSource, Camera, …),
// Physics2D / Physics queries, and the static facades that were missing (Time, Input, SceneManager, Application, Resources, JsonUtility, PostProcessing).
// Behaviour is modelled on Unity's public API names; no Unity code is used. Everything is plain JS on top of Entity / Scene / game.* so it works in every backend;
// where a backend cannot do something (for example Camera.WorldToScreenPoint in 3D) the call warns once instead of failing silently.
//
//   import { Transform, Quaternion, SpriteRenderer, Rigidbody2D, Physics2D, Camera, JsonUtility, Resources } from 'nord';
import { Entity } from './entity.js';
import { sceneHooks } from './unity-lifecycle.js';
import { Game } from './game.js';
import { clamp, lerp } from './util.js';
import { Vector2, Vector3, Color, Mathf, Time, Debug, UnityInput, SceneManager, Application, Physics2D, unityHooks } from './unity.js';

const game = () => Game.current;
const D2R = Math.PI / 180, R2D = 180 / Math.PI;
const warned = new Set();
const warnOnce = (msg) => { if (!warned.has(msg)) { warned.add(msg); console.warn(`[nord] ${msg}`); } };
const is3D = () => game()?.project?.type === '3d';
const v3 = (a) => new Vector3(a[0] ?? 0, a[1] ?? 0, a[2] ?? 0);
const norm360 = (a) => ((a % 360) + 360) % 360;

// ---------------------------------------------------------------- Quaternion
/** Unity's Quaternion. `Quaternion.Euler(x, y, z)` takes degrees and rotates Z, then X, then Y, like Unity (and like Babylon's yaw/pitch/roll). */
export class Quaternion {
  constructor(x = 0, y = 0, z = 0, w = 1) { this.x = x; this.y = y; this.z = z; this.w = w; }
  static get identity() { return new Quaternion(0, 0, 0, 1); }
  static Multiply(a, b) {
    return new Quaternion(
      a.w * b.x + a.x * b.w + a.y * b.z - a.z * b.y,
      a.w * b.y - a.x * b.z + a.y * b.w + a.z * b.x,
      a.w * b.z + a.x * b.y - a.y * b.x + a.z * b.w,
      a.w * b.w - a.x * b.x - a.y * b.y - a.z * b.z);
  }
  static Euler(x = 0, y = 0, z = 0) {
    if (x instanceof Vector3) ({ x, y, z } = x);
    const qx = new Quaternion(Math.sin(x * D2R / 2), 0, 0, Math.cos(x * D2R / 2));
    const qy = new Quaternion(0, Math.sin(y * D2R / 2), 0, Math.cos(y * D2R / 2));
    const qz = new Quaternion(0, 0, Math.sin(z * D2R / 2), Math.cos(z * D2R / 2));
    return Quaternion.Multiply(Quaternion.Multiply(qy, qx), qz);
  }
  static AngleAxis(angle, axis) {
    const n = axis.normalized, s = Math.sin(angle * D2R / 2);
    return new Quaternion(n.x * s, n.y * s, n.z * s, Math.cos(angle * D2R / 2));
  }
  /** Rotation that looks along `forward` (+Z) with `up` (default +Y) as the up hint. */
  static LookRotation(forward, up = Vector3.up) {
    const f = forward.normalized;
    if (f.sqrMagnitude < 1e-12) return Quaternion.identity;
    let r = Vector3.Cross(up, f); if (r.sqrMagnitude < 1e-12) r = Vector3.Cross(Vector3.right, f);
    r = r.normalized;
    const u = Vector3.Cross(f, r);
    const m00 = r.x, m01 = u.x, m02 = f.x, m10 = r.y, m11 = u.y, m12 = f.y, m20 = r.z, m21 = u.z, m22 = f.z;
    const t = m00 + m11 + m22;
    if (t > 0) { const s = Math.sqrt(t + 1) * 2; return new Quaternion((m21 - m12) / s, (m02 - m20) / s, (m10 - m01) / s, s / 4); }
    if (m00 > m11 && m00 > m22) { const s = Math.sqrt(1 + m00 - m11 - m22) * 2; return new Quaternion(s / 4, (m01 + m10) / s, (m02 + m20) / s, (m21 - m12) / s); }
    if (m11 > m22) { const s = Math.sqrt(1 + m11 - m00 - m22) * 2; return new Quaternion((m01 + m10) / s, s / 4, (m12 + m21) / s, (m02 - m20) / s); }
    const s = Math.sqrt(1 + m22 - m00 - m11) * 2; return new Quaternion((m02 + m20) / s, (m12 + m21) / s, s / 4, (m10 - m01) / s);
  }
  static FromToRotation(from, to) {
    const a = from.normalized, b = to.normalized, d = Vector3.Dot(a, b);
    if (d > 0.999999) return Quaternion.identity;
    if (d < -0.999999) { let ax = Vector3.Cross(Vector3.right, a); if (ax.sqrMagnitude < 1e-6) ax = Vector3.Cross(Vector3.up, a); return Quaternion.AngleAxis(180, ax); }
    const c = Vector3.Cross(a, b);
    return new Quaternion(c.x, c.y, c.z, 1 + d).normalized;
  }
  static Dot(a, b) { return a.x * b.x + a.y * b.y + a.z * b.z + a.w * b.w; }
  static Angle(a, b) { const d = Math.min(Math.abs(Quaternion.Dot(a, b)), 1); return Math.acos(d) * 2 * R2D; }
  static Inverse(q) { return new Quaternion(-q.x, -q.y, -q.z, q.w); }
  static Lerp(a, b, t) {
    t = clamp(t, 0, 1);
    const s = Quaternion.Dot(a, b) < 0 ? -1 : 1;
    return new Quaternion(lerp(a.x, b.x * s, t), lerp(a.y, b.y * s, t), lerp(a.z, b.z * s, t), lerp(a.w, b.w * s, t)).normalized;
  }
  static Slerp(a, b, t) {
    t = clamp(t, 0, 1);
    let d = Quaternion.Dot(a, b), bb = b;
    if (d < 0) { d = -d; bb = new Quaternion(-b.x, -b.y, -b.z, -b.w); }
    if (d > 0.9995) return Quaternion.Lerp(a, bb, t);
    const th = Math.acos(d), s = Math.sin(th), wa = Math.sin((1 - t) * th) / s, wb = Math.sin(t * th) / s;
    return new Quaternion(a.x * wa + bb.x * wb, a.y * wa + bb.y * wb, a.z * wa + bb.z * wb, a.w * wa + bb.w * wb);
  }
  static RotateTowards(from, to, maxDegreesDelta) {
    const ang = Quaternion.Angle(from, to);
    return ang === 0 ? to : Quaternion.Slerp(from, to, Math.min(1, maxDegreesDelta / ang));
  }
  get normalized() { const m = Math.hypot(this.x, this.y, this.z, this.w) || 1; return new Quaternion(this.x / m, this.y / m, this.z / m, this.w / m); }
  get eulerAngles() {
    const { x, y, z, w } = this;
    const r12 = 2 * (y * z - w * x);
    let ex, ey, ez;
    if (Math.abs(r12) < 0.9999) {
      ex = Math.asin(-r12);
      ey = Math.atan2(2 * (x * z + w * y), 1 - 2 * (x * x + y * y));
      ez = Math.atan2(2 * (x * y + w * z), 1 - 2 * (x * x + z * z));
    } else {
      ex = r12 > 0 ? -Math.PI / 2 : Math.PI / 2;
      ey = Math.atan2(-2 * (x * z - w * y), 1 - 2 * (y * y + z * z));
      ez = 0;
    }
    return new Vector3(norm360(ex * R2D), norm360(ey * R2D), norm360(ez * R2D));
  }
  /** `q * q2` (combine rotations) when given a Quaternion, `q * v` (rotate a vector) when given a Vector3. */
  Multiply(o) {
    if (o instanceof Quaternion) return Quaternion.Multiply(this, o);
    const q = this, u = new Vector3(q.x, q.y, q.z), s = q.w;
    const cross1 = Vector3.Cross(u, o), cross2 = Vector3.Cross(u, cross1);
    return o.Add(cross1.Mul(2 * s)).Add(cross2.Mul(2));
  }
  Inverse() { return Quaternion.Inverse(this); }
  Clone() { return new Quaternion(this.x, this.y, this.z, this.w); }
  toString() { return `(${this.x}, ${this.y}, ${this.z}, ${this.w})`; }
}

/** Unity's Space for Translate / Rotate. */
export const Space = Object.freeze({ World: 'World', Self: 'Self' });

// ---------------------------------------------------------------- Transform
const transforms = new WeakMap();
/**
 * `this.transform` (and `entity.transform`). World position respects the parent's position and scale (rotation of parents is applied by the backend only);
 * 2D rotation is the Z angle in degrees, **clockwise** like the screen, y points **down**.
 */
export class Transform {
  constructor(entity) { this.entity = entity; }
  static Of(entity) { let t = transforms.get(entity); if (!t) transforms.set(entity, (t = new Transform(entity))); return t; }
  get gameObject() { return this.entity; }
  get transform() { return this; }
  // older Nord code used `this.transform` as the entity itself: these keep `transform.pos`, `.rot`, `.find(...)`, `.on(...)` working
  get pos() { return this.entity.pos; }
  set pos(v) { this.entity.pos = v; }
  get rot() { return this.entity.rot; }
  set rot(v) { this.entity.rot = v; }
  get scale() { return this.entity.scale; }
  set scale(v) { this.entity.scale = v; }
  get worldPos() { return this.entity.worldPos; }
  find(n) { return this.entity.find(n); }
  hasTag(t) { return this.entity.hasTag(t); }
  on(n, f) { return this.entity.on(n, f); }
  emit(n, d) { this.entity.emit(n, d); }
  destroy() { this.entity.destroy(); }
  get name() { return this.entity.name; }
  get tag() { return this.entity.tags[0] ?? 'Untagged'; }
  CompareTag(t) { return this.entity.hasTag(t); }

  get position() { return v3(this.entity.worldPos); }
  set position(v) {
    const e = this.entity, p = e.parent;
    if (!p) { e.pos = [v.x, v.y, v.z]; return; }
    const pw = p.worldPos, ps = p.t.scale;
    e.pos = [(v.x - pw[0]) / (ps[0] || 1), (v.y - pw[1]) / (ps[1] || 1), (v.z - pw[2]) / (ps[2] || 1)];
  }
  get localPosition() { return v3(this.entity.pos); }
  set localPosition(v) { this.entity.pos = [v.x, v.y, v.z]; }
  get eulerAngles() { return v3(this.entity.rot); }
  set eulerAngles(v) { this.entity.rot = [v.x, v.y, v.z]; }
  get localEulerAngles() { return this.eulerAngles; }
  set localEulerAngles(v) { this.eulerAngles = v; }
  get rotation() { const r = this.entity.rot; return Quaternion.Euler(r[0] ?? 0, r[1] ?? 0, r[2] ?? 0); }
  set rotation(q) { const e = q.eulerAngles; this.entity.rot = [e.x, e.y, e.z]; }
  get localRotation() { return this.rotation; }
  set localRotation(q) { this.rotation = q; }
  get localScale() { return v3(this.entity.scale); }
  set localScale(v) { this.entity.scale = [v.x, v.y, v.z]; }
  get lossyScale() {
    let s = this.entity.scale.slice(), p = this.entity.parent;
    while (p) { s = s.map((v, i) => v * p.scale[i]); p = p.parent; }
    return v3(s);
  }

  /** Where the object's own X axis points (2D: along the sprite's right, 3D: Unity's `transform.right`). */
  get right() { return this.#axis(1, 0, 0); }
  /** Where the object's top points. In 2D screen space that is up the screen when rotation is 0: (0, -1). */
  get up() { return this.#axis(0, 1, 0); }
  /** 3D: Unity's `transform.forward` (+Z). In 2D it equals `right`'s counterpart on Z (0, 0, 1). */
  get forward() { return this.#axis(0, 0, 1); }
  #axis(x, y, z) {
    if (!is3D()) {
      const a = (this.entity.rot[2] ?? 0) * D2R, c = Math.cos(a), s = Math.sin(a);
      if (x) return new Vector3(c, s, 0);
      if (y) return new Vector3(s, -c, 0);
      return new Vector3(0, 0, 1);
    }
    return this.rotation.Multiply(new Vector3(x, y, z));
  }

  get parent() { return this.entity.parent ? Transform.Of(this.entity.parent) : null; }
  set parent(p) { this.SetParent(p); }
  get root() { let e = this.entity; while (e.parent) e = e.parent; return Transform.Of(e); }
  get childCount() { return this.entity.children.length; }
  GetChild(i) { const c = this.entity.children[i]; return c ? Transform.Of(c) : null; }
  /** `transform.Find("Child")` (a direct child) or `"Child/Grandchild"`. Returns a Transform or null. */
  Find(path) {
    let cur = this.entity;
    for (const part of String(path).split('/')) { cur = cur.children.find((c) => c.name === part); if (!cur) return null; }
    return Transform.Of(cur);
  }
  IsChildOf(t) { for (let e = this.entity.parent; e; e = e.parent) if (e === (t.entity ?? t)) return true; return false; }
  /** `SetParent(parent, worldPositionStays = true)`: move under another object (Transform, GameObject or null for the scene root) while the game runs. */
  SetParent(p, worldPositionStays = true) { this.entity.setParent(p ? (p.entity ?? p) : null, worldPositionStays); }
  /** Make every child a root object again, keeping where it is in the world. */
  DetachChildren() { for (const c of [...this.entity.children]) c.setParent(null, true); }
  GetSiblingIndex() { const l = this.entity.parent ? this.entity.parent.children : this.entity.scene.roots; return l.indexOf(this.entity); }
  SetSiblingIndex(i) {
    const l = this.entity.parent ? this.entity.parent.children : this.entity.scene.roots, k = l.indexOf(this.entity);
    if (k < 0) return; l.splice(k, 1); l.splice(clamp(i, 0, l.length), 0, this.entity);
  }
  SetAsFirstSibling() { this.SetSiblingIndex(0); }
  SetAsLastSibling() { this.SetSiblingIndex(Infinity); }

  /** `Translate(x, y, z)` or `Translate(Vector3, Space.Self | Space.World)`. Self (the Unity default) moves along the object's own axes. */
  Translate(a, b, c) {
    let d, space = Space.Self;
    if (a instanceof Vector3 || a instanceof Vector2) { d = new Vector3(a.x, a.y, a.z ?? 0); if (typeof b === 'string') space = b; }
    else { d = new Vector3(a ?? 0, b ?? 0, c ?? 0); if (typeof arguments[3] === 'string') space = arguments[3]; }
    if (space === Space.Self && (this.entity.rot[2] || this.entity.rot[0] || this.entity.rot[1])) d = this.TransformDirection(d);
    const p = this.entity.pos; this.entity.pos = [p[0] + d.x, p[1] + d.y, p[2] + d.z];
  }
  /** `Rotate(x, y, z)` or `Rotate(Vector3 eulerDegrees)`. In 2D only z matters. */
  Rotate(a, b, c) {
    const d = a instanceof Vector3 ? a : new Vector3(a ?? 0, b ?? 0, c ?? 0), r = this.entity.rot;
    this.entity.rot = [(r[0] ?? 0) + d.x, (r[1] ?? 0) + d.y, (r[2] ?? 0) + d.z];
  }
  /** Orbit around `point`. 2D: rotates about Z by `angle` degrees (clockwise). 3D: any axis. */
  RotateAround(point, axis, angle) {
    const p = this.position, rel = p.Sub(point);
    let rot;
    if (!is3D()) { const a = angle * D2R, c = Math.cos(a), s = Math.sin(a); rot = new Vector3(rel.x * c - rel.y * s, rel.x * s + rel.y * c, rel.z); }
    else rot = Quaternion.AngleAxis(angle, axis).Multiply(rel);
    this.position = point.Add(rot);
    if (!is3D()) this.entity.rot = [0, 0, (this.entity.rot[2] ?? 0) + angle]; else this.Rotate(axis.Mul(angle));
  }
  /** Face a point or Transform. 2D: rotates Z so the sprite's +X points at it. 3D: +Z points at it (Unity's `LookAt`). */
  LookAt(target, worldUp = Vector3.up) {
    const t = target instanceof Transform ? target.position : target.entity ? Transform.Of(target.entity).position : target, p = this.position;
    if (!is3D()) { this.entity.rot = [0, 0, Math.atan2(t.y - p.y, t.x - p.x) * R2D]; return; }
    this.rotation = Quaternion.LookRotation(new Vector3(t.x - p.x, t.y - p.y, t.z - p.z), worldUp);
  }
  TransformDirection(d) {
    if (!is3D()) { const a = (this.entity.rot[2] ?? 0) * D2R, c = Math.cos(a), s = Math.sin(a); return new Vector3(d.x * c - d.y * s, d.x * s + d.y * c, d.z ?? 0); }
    return this.rotation.Multiply(d);
  }
  InverseTransformDirection(d) {
    if (!is3D()) { const a = -(this.entity.rot[2] ?? 0) * D2R, c = Math.cos(a), s = Math.sin(a); return new Vector3(d.x * c - d.y * s, d.x * s + d.y * c, d.z ?? 0); }
    return Quaternion.Inverse(this.rotation).Multiply(d);
  }
  TransformPoint(p) { const s = this.lossyScale, d = this.TransformDirection(new Vector3(p.x * s.x, p.y * s.y, (p.z ?? 0) * s.z)); return this.position.Add(d); }
  InverseTransformPoint(p) {
    const d = this.InverseTransformDirection(new Vector3(p.x, p.y, p.z ?? 0).Sub(this.position)), s = this.lossyScale;
    return new Vector3(d.x / (s.x || 1), d.y / (s.y || 1), d.z / (s.z || 1));
  }
  SetPositionAndRotation(pos, rot) { this.position = pos; this.rotation = rot; }
  toString() { return `${this.entity.name} (Transform)`; }
}

// ---------------------------------------------------------------- GameObject members on Entity
const def = (name, desc) => { if (!Object.getOwnPropertyDescriptor(Entity.prototype, name)) Object.defineProperty(Entity.prototype, name, { configurable: true, ...desc }); };
def('gameObject', { get() { return this; } });
def('transform', { get() { return Transform.Of(this); } });
def('tag', { get() { return this.tags[0] ?? 'Untagged'; }, set(v) { this.tags = [v]; } });
def('activeSelf', { get() { return this._enabled; } });
def('activeInHierarchy', { get() { return this.enabled; } });
const methods = {
  CompareTag(t) { return this.tags.includes(t); },
  SetActive(on) { this.enabled = !!on; },
  GetComponent(type) { return getUnityComponent(this, type); },
  TryGetComponent(type) { return getUnityComponent(this, type); },
  GetComponents(type) { return [getUnityComponent(this, type)].filter(Boolean); },
  GetComponentInChildren(type) { for (const e of this.all()) { const c = getUnityComponent(e, type); if (c) return c; } return null; },
  GetComponentsInChildren(type) { return [...this.all()].map((e) => getUnityComponent(e, type)).filter(Boolean); },
  GetComponentInParent(type) { for (let e = this; e; e = e.parent) { const c = getUnityComponent(e, type); if (c) return c; } return null; },
  AddComponent(type, data = {}) {
    if (typeof type === 'function' && !type.nord) return this.addScript(type, data);
    const name = typeof type === 'string' ? type : type?.name, W = typeof type === 'function' ? type : WRAPPERS[name];
    const comp = this.addComponent(typeof type === 'function' ? type.nord : (UNITY_TO_NORD[name] ?? name), { ...(typeof type === 'function' ? type.defaults : UNITY_DEFAULTS[name]) ?? {}, ...data });
    return W?.fromComp ? W.fromComp(this, comp) : (W ? getUnityComponent(this, W) : comp);
  },
  SendMessage(method, arg) { this.callScripts(method, arg); },
  BroadcastMessage(method, arg) { for (const e of this.all()) e.callScripts(method, arg); },
  SendMessageUpwards(method, arg) { for (let e = this; e; e = e.parent) e.callScripts(method, arg); },
};
for (const [k, fn] of Object.entries(methods)) if (!Entity.prototype[k]) Entity.prototype[k] = fn;

// ---------------------------------------------------------------- component wrappers
/** Rebuild the physics body after a data change but keep its velocity (the body is created from the component data). */
function rebuildBody(e) {
  const ph = game()?.physics; if (!ph?.build) return;
  const v = ph.velocity?.(e);
  ph.build(e); ph.flushDirty?.();
  if (v) ph.setVelocity?.(e, ...v);
}
const MODE = { Dynamic: 'dynamic', Kinematic: 'kinematic', Static: 'static' };
const MODE_NAME = { dynamic: 'Dynamic', kinematic: 'Kinematic', static: 'Static' };
/** Unity's ForceMode2D / ForceMode. */
export const ForceMode2D = Object.freeze({ Force: 0, Impulse: 1 });
export const ForceMode = Object.freeze({ Force: 0, Acceleration: 5, Impulse: 1, VelocityChange: 2 });

export class ComponentBase {
  constructor(entity) { this.entity = entity; }
  get gameObject() { return this.entity; }
  get transform() { return Transform.Of(this.entity); }
  get tag() { return this.entity.tag; }
  CompareTag(t) { return this.entity.hasTag(t); }
  GetComponent(t) { return getUnityComponent(this.entity, t); }
  get comp() { return this.entity.getComponent(this.constructor.nord); }
  get data() { return this.comp?.data ?? {}; }
  set_(k, v) { this.entity.set(this.constructor.nord, k, v); }
}

/** Unity's Rigidbody2D (2D) and Rigidbody (3D). Fields change the body data; the body is rebuilt and keeps its velocity. */
export class Rigidbody2D extends ComponentBase {
  static nord = 'rigidbody';
  static Of(e) { return e.getComponent('rigidbody') ? new this(e) : null; }
  get #ph() { return game()?.physics; }
  get velocity() { const v = this.#ph?.velocity?.(this.entity) ?? [0, 0, 0]; return is3D() ? v3(v) : new Vector2(v[0], v[1]); }
  set velocity(v) { this.#ph?.setVelocity?.(this.entity, v.x, v.y, ...(is3D() ? [v.z ?? 0] : [])); }
  get linearVelocity() { return this.velocity; }
  set linearVelocity(v) { this.velocity = v; }
  get bodyType() { return MODE_NAME[this.data.mode ?? 'static']; }
  set bodyType(t) { this.set_('mode', MODE[t] ?? t); rebuildBody(this.entity); }
  get isKinematic() { return this.data.mode === 'kinematic'; }
  set isKinematic(on) { this.set_('mode', on ? 'kinematic' : 'dynamic'); rebuildBody(this.entity); }
  get mass() { return this.data.mass ?? 1; }
  set mass(v) { this.set_('mass', v); rebuildBody(this.entity); }
  /** Linear damping (Unity: `drag` in 2D older versions, `linearDamping` now). */
  get drag() { return this.data.drag ?? 0; }
  set drag(v) { this.set_('drag', v); rebuildBody(this.entity); }
  get linearDamping() { return this.drag; }
  set linearDamping(v) { this.drag = v; }
  get gravityScale() { return this.data.gravityScale ?? 1; }
  set gravityScale(v) { this.set_('gravityScale', v); rebuildBody(this.entity); }
  get freezeRotation() { return this.data.fixedRotation ?? true; }
  set freezeRotation(v) { this.set_('fixedRotation', !!v); rebuildBody(this.entity); }
  get simulated() { return this.entity.enabled; }
  set simulated(on) { this.#ph?.enable?.(this.entity, !!on); }
  get position() { return new Vector2(...this.entity.worldPos); }
  set position(v) { this.entity.pos = [v.x, v.y, this.entity.pos[2]]; }
  get rotation() { return this.entity.rot[2] ?? 0; }
  set rotation(a) { const r = this.entity.rot; this.entity.rot = [r[0], r[1], a]; }
  /** 2D: degrees per second (number). 3D: radians per second about each axis (Vector3), like Unity's Rigidbody. */
  get angularVelocity() {
    const ph = this.#ph, a = ph?.angularVelocity?.(this.entity);
    if (is3D()) return v3(Array.isArray(a) ? a : [0, 0, 0]);
    if (typeof a === 'number') return a;
    return ph?.body?.(this.entity)?.angularVelocity ?? 0;
  }
  set angularVelocity(v) {
    const ph = this.#ph;
    if (ph?.setAngularVelocity) { ph.setAngularVelocity(this.entity, is3D() ? [v.x, v.y, v.z] : v); return; }
    const b = ph?.body?.(this.entity); if (b) b.angularVelocity = v;
  }
  /** `AddForce(force)` continuous (call every FixedUpdate) or `AddForce(force, ForceMode2D.Impulse)` for a one-off push. */
  AddForce(f, mode = ForceMode2D.Force) {
    const m = this.mass || 1, dt = Time.fixedDeltaTime;
    let k = mode === ForceMode2D.Impulse || mode === ForceMode.Impulse ? 1 : dt;
    const z = f.z ?? 0;
    if (mode === ForceMode.VelocityChange || mode === ForceMode.Acceleration) k = mode === ForceMode.VelocityChange ? m : dt * m;
    this.#ph?.applyImpulse?.(this.entity, f.x * k, f.y * k, ...(is3D() ? [z * k] : []));
  }
  AddForceAtPosition(f, _pos, mode) { this.AddForce(f, mode); }
  AddTorque(t, mode) {
    const k = Time.fixedDeltaTime / (this.mass || 1);
    if (is3D()) { const a = this.angularVelocity; this.angularVelocity = new Vector3(a.x + t.x * k, a.y + t.y * k, a.z + t.z * k); } else this.angularVelocity = this.angularVelocity + t * k;
    void mode;
  }
  /** Drive a kinematic body to a position: sets the velocity that arrives there in one physics step. */
  MovePosition(target) {
    const p = this.entity.worldPos, dt = Time.fixedDeltaTime || 1 / 60;
    this.#ph?.setVelocity?.(this.entity, (target.x - p[0]) / dt, (target.y - p[1]) / dt, ...(is3D() ? [((target.z ?? p[2]) - p[2]) / dt] : []));
  }
  MoveRotation(a) { this.rotation = a; }
  Sleep() {} WakeUp() {}
  IsSleeping() { return false; }

  /** Freeze flags (Unity's `constraints`): RigidbodyConstraints2D / RigidbodyConstraints values or a mix with `|`. */
  get constraints() {
    const d = this.data, t = is3D() ? CONSTRAINTS3D : CONSTRAINTS2D;
    return (d.freezePositionX ? t.FreezePositionX : 0) | (d.freezePositionY ? t.FreezePositionY : 0) | (is3D() && d.freezePositionZ ? t.FreezePositionZ : 0)
      | (is3D() ? ((d.freezeRotationX ? t.FreezeRotationX : 0) | (d.freezeRotationY ? t.FreezeRotationY : 0) | ((d.freezeRotationZ ?? d.fixedRotation) ? t.FreezeRotationZ : 0)) : (d.fixedRotation ? t.FreezeRotation : 0));
  }
  set constraints(v) {
    const t = is3D() ? CONSTRAINTS3D : CONSTRAINTS2D, has = (f) => (v & f) === f && f !== 0;
    const set = { freezePositionX: has(t.FreezePositionX), freezePositionY: has(t.FreezePositionY) };
    if (is3D()) Object.assign(set, { freezePositionZ: has(t.FreezePositionZ), freezeRotationX: has(t.FreezeRotationX), freezeRotationY: has(t.FreezeRotationY), freezeRotationZ: has(t.FreezeRotationZ), fixedRotation: has(t.FreezeRotation) });
    else set.fixedRotation = has(t.FreezeRotation);
    for (const [k, val] of Object.entries(set)) this.set_(k, val);
    rebuildBody(this.entity);
  }
  /** 'None' | 'Interpolate' | 'Extrapolate' (Unity's RigidbodyInterpolation): smooths the picture between fixed physics steps. */
  get interpolation() { return INTERP_NAME[this.data.interpolation ?? 'none'] ?? 'None'; }
  set interpolation(v) { this.set_('interpolation', INTERP[v] ?? String(v).toLowerCase()); game()?.physics?.setInterpolation?.(this.entity, this.data.interpolation); }
  /** 'Discrete' | 'Continuous' (| 'ContinuousDynamic' | 'ContinuousSpeculative' in 3D): fast bodies are stepped in smaller pieces so they cannot tunnel through thin walls. */
  get collisionDetectionMode() { return CCD_NAME[this.data.collisionDetection ?? 'discrete'] ?? 'Discrete'; }
  set collisionDetectionMode(v) { this.set_('collisionDetection', CCD[v] ?? (typeof v === 'number' ? ['discrete', 'continuous', 'continuousDynamic', 'continuousSpeculative'][v] : String(v).toLowerCase())); game()?.physics?.setContinuous?.(this.entity, this.data.collisionDetection); }
  get angularDrag() { return this.data.angularDrag ?? 0.05; }
  set angularDrag(v) { this.set_('angularDrag', v); rebuildBody(this.entity); }
  get angularDamping() { return this.angularDrag; }
  set angularDamping(v) { this.angularDrag = v; }
  get useGravity() { return (this.data.gravityScale ?? 1) !== 0; }
  set useGravity(on) { this.gravityScale = on ? 1 : 0; }
  get detectCollisions() { return this.data.detectCollisions !== false; }
  set detectCollisions(on) { this.set_('detectCollisions', !!on); game()?.physics?.enable?.(this.entity, !!on); }
  /** `{ friction, bounciness }` of the body (Unity's PhysicsMaterial2D / PhysicMaterial); assigning copies the numbers. */
  get sharedMaterial() { return { friction: this.data.friction ?? 0.1, bounciness: this.data.bounce ?? 0 }; }
  set sharedMaterial(m) { if (m) { this.set_('friction', m.friction ?? m.dynamicFriction ?? 0.1); this.set_('bounce', m.bounciness ?? m.bounce ?? 0); rebuildBody(this.entity); } }
  /** Push everything near `position` away: `AddExplosionForce(force, position, radius, upwardsModifier, mode)` (linear fall-off). */
  AddExplosionForce(force, position, radius, upwards = 0, mode = ForceMode2D.Force) {
    const p = this.entity.worldPos, dx = p[0] - position.x, dy = p[1] - position.y, dz = is3D() ? p[2] - position.z : 0, d = Math.hypot(dx, dy, dz);
    if (d > radius) return;
    const k = (1 - d / radius) * force, n = d > 1e-9 ? [dx / d, dy / d, dz / d] : [0, is3D() ? 1 : -1, 0];
    this.AddForce(new Vector3(n[0] * k, n[1] * k + (is3D() ? upwards * k : 0), n[2] * k), mode === ForceMode2D.Force ? ForceMode2D.Impulse : mode);
  }
  GetPointVelocity(point) {
    const v = this.velocity, w = (this.angularVelocity ?? 0) * D2R, p = this.entity.worldPos, rx = point.x - p[0], ry = point.y - p[1];
    return is3D() ? v : new Vector2(v.x - w * ry, v.y + w * rx);
  }
  GetRelativePointVelocity(point) { return this.GetPointVelocity(point); }
  /** Sweep this body's collider along `direction` and list what it would hit (`results`, returns the count). */
  Cast(direction, results = [], distance = Infinity) {
    const c = Collider2D.Of(this.entity); return c ? c.Cast(direction, results, distance) : 0;
  }
  OverlapCollider(filter, results) { const c = Collider2D.Of(this.entity); return c ? c.OverlapCollider(filter, results) : 0; }
  IsTouching(other) { const c = Collider2D.Of(this.entity); return c ? c.IsTouching(other) : false; }
  IsTouchingLayers(mask = -1) { const c = Collider2D.Of(this.entity); return c ? c.IsTouchingLayers(mask) : false; }
  get worldCenterOfMass() { return is3D() ? v3(this.entity.worldPos) : new Vector2(...this.entity.worldPos); }
  get centerOfMass() { return is3D() ? Vector3.zero : Vector2.zero; }
}
/** Unity's RigidbodyConstraints2D (flags) and RigidbodyConstraints (3D). */
export const RigidbodyConstraints2D = Object.freeze({ None: 0, FreezePositionX: 1, FreezePositionY: 2, FreezeRotation: 4, FreezePosition: 3, FreezeAll: 7 });
export const RigidbodyConstraints = Object.freeze({ None: 0, FreezePositionX: 2, FreezePositionY: 4, FreezePositionZ: 8, FreezePosition: 14, FreezeRotationX: 16, FreezeRotationY: 32, FreezeRotationZ: 64, FreezeRotation: 112, FreezeAll: 126 });
const CONSTRAINTS2D = RigidbodyConstraints2D, CONSTRAINTS3D = RigidbodyConstraints;
export const RigidbodyInterpolation2D = Object.freeze({ None: 0, Interpolate: 1, Extrapolate: 2 });
export const RigidbodyInterpolation = RigidbodyInterpolation2D;
export const CollisionDetectionMode2D = Object.freeze({ Discrete: 0, Continuous: 1 });
export const CollisionDetectionMode = Object.freeze({ Discrete: 0, Continuous: 1, ContinuousDynamic: 2, ContinuousSpeculative: 3 });
export const RigidbodySleepMode2D = Object.freeze({ NeverSleep: 0, StartAwake: 1, StartAsleep: 2 });
const INTERP = { 0: 'none', 1: 'interpolate', 2: 'extrapolate', None: 'none', Interpolate: 'interpolate', Extrapolate: 'extrapolate' };
const INTERP_NAME = { none: 'None', interpolate: 'Interpolate', extrapolate: 'Extrapolate' };
const CCD = { 0: 'discrete', 1: 'continuous', 2: 'continuousDynamic', 3: 'continuousSpeculative', Discrete: 'discrete', Continuous: 'continuous', ContinuousDynamic: 'continuousDynamic', ContinuousSpeculative: 'continuousSpeculative' };
const CCD_NAME = { discrete: 'Discrete', continuous: 'Continuous', continuousDynamic: 'ContinuousDynamic', continuousSpeculative: 'ContinuousSpeculative' };
/** 3D alias: same members, Vector3 velocity. */
export class Rigidbody extends Rigidbody2D {}

/** BoxCollider2D / CircleCollider2D / Collider2D (and the 3D names). */
export class Collider2D extends ComponentBase {
  static nord = 'collider';
  static Of(e) { return e.getComponent('collider') ? new this(e) : null; }
  get isTrigger() { return !!this.data.trigger; }
  set isTrigger(v) { this.set_('trigger', !!v); rebuildBody(this.entity); }
  get enabled() { return this.entity.enabled; }
  set enabled(on) { game()?.physics?.enable?.(this.entity, !!on); }
  get size() { const s = this.data.size ?? [16, 16]; return is3D() ? v3(s) : new Vector2(s[0], s[1]); }
  set size(v) { this.set_('size', is3D() ? [v.x, v.y, v.z ?? 1] : [v.x, v.y]); rebuildBody(this.entity); }
  get radius() { return this.data.radius ?? Math.max(...(this.data.size ?? [16])) / 2; }
  set radius(r) { this.set_('radius', r); rebuildBody(this.entity); }
  get offset() { const o = this.data.offset ?? [0, 0]; return new Vector2(o[0], o[1]); }
  set offset(v) { this.set_('offset', [v.x, v.y]); rebuildBody(this.entity); }
  get attachedRigidbody() { return Rigidbody2D.Of(this.entity); }
  get usedByComposite() { return !!this.data.usedByComposite; }
  set usedByComposite(v) { this.set_('usedByComposite', !!v); rebuildBody(this.entity); }
  get sharedMaterial() { return Rigidbody2D.Of(this.entity)?.sharedMaterial ?? { friction: 0.1, bounciness: 0 }; }
  set sharedMaterial(m) { const r = Rigidbody2D.Of(this.entity); if (r) r.sharedMaterial = m; }
  get friction() { return this.sharedMaterial.friction; }
  get bounciness() { return this.sharedMaterial.bounciness; }
  /** Is `point` inside this collider? */
  OverlapPoint(point) { return Physics2D.OverlapPointAll(point).includes(this.entity); }
  /** Closest points to another collider: `{ distance, isOverlapped, isValid, normal, pointA, pointB }`. */
  Distance(other) { return Physics2D.Distance(this, other); }
  ClosestPoint(position) { return Physics2D.ClosestPoint(position, this); }
  IsTouching(other) { return Physics2D.IsTouching(this, other); }
  IsTouchingLayers(mask = -1) { return Physics2D.IsTouchingLayers(this, mask); }
  /** Everything overlapping this collider: `OverlapCollider(filter, results)` → count. */
  OverlapCollider(filter, results = []) { return Physics2D.OverlapCollider(this, filter, results); }
  /** Sweep this collider along `direction`: `Cast(direction, results, distance)` → count (hits are RaycastHit2D). */
  Cast(direction, results = [], distance = Infinity) { return unityHooks.castCollider?.(this.entity, direction, results, distance) ?? 0; }
  /** Rays starting at the collider's centre: `Raycast(direction, results, distance)` → count. */
  Raycast(direction, results = [], distance = Infinity) { return Physics2D.RaycastNonAlloc(new Vector2(...this.entity.worldPos.slice(0, 2)), direction, results, distance); }
  /** World-space Bounds of the collider (Unity's `collider.bounds`). */
  get bounds() { return unityHooks.colliderBounds?.(this.entity) ?? null; }
}
export class BoxCollider2D extends Collider2D {}
export class CircleCollider2D extends Collider2D {}
export class BoxCollider extends Collider2D {}
export class SphereCollider extends Collider2D {}
/** CapsuleCollider2D: `size` (Vector2) and `direction` ('Vertical' | 'Horizontal'). */
export class CapsuleCollider2D extends Collider2D {
  get direction() { const d = String(this.data.direction ?? 'vertical').toLowerCase(); return d.startsWith('h') ? 'Horizontal' : 'Vertical'; }
  set direction(v) { this.set_('direction', String(v).toLowerCase().startsWith('h') || v === 1 ? 'horizontal' : 'vertical'); rebuildBody(this.entity); }
}
/** CapsuleCollider (3D): `radius`, `height`, `direction` (0 X, 1 Y, 2 Z; the engine capsule is always upright, Y). */
export class CapsuleCollider extends Collider2D {
  get height() { return (this.data.size ?? [1, 2, 1])[1]; }
  set height(h) { const s = [...(this.data.size ?? [1, 2, 1])]; s[1] = h; this.set_('size', s); rebuildBody(this.entity); }
  get direction() { return 1; }
}
/** PolygonCollider2D: `points` (Vector2[]), `pointCount`, `pathCount` (1), GetPath / SetPath. Concave outlines are fine. */
export class PolygonCollider2D extends Collider2D {
  get points() { return (this.data.points ?? []).map((p) => new Vector2(p[0], p[1])); }
  set points(v) { this.set_('points', v.map((p) => [p.x, p.y])); rebuildBody(this.entity); }
  get pointCount() { return (this.data.points ?? []).length; }
  get pathCount() { return 1; }
  GetPath() { return this.points; }
  SetPath(_i, pts) { this.points = pts; }
  CreatePrimitive(sides, scale = Vector2.one, offset = Vector2.zero) { this.points = Array.from({ length: sides }, (_, i) => { const a = i / sides * Math.PI * 2; return new Vector2(Math.cos(a) * scale.x * 0.5 + offset.x, Math.sin(a) * scale.y * 0.5 + offset.y); }); }
}
/** EdgeCollider2D: an open (or closed) poly-line; `points`, `pointCount`, `edgeRadius` (thickness is half of it each side). */
export class EdgeCollider2D extends PolygonCollider2D {
  get edgeRadius() { return this.data.edgeRadius ?? 0; }
  set edgeRadius(v) { this.set_('edgeRadius', v); rebuildBody(this.entity); }
  Reset() { this.set_('points', [[-0.5, 0], [0.5, 0]]); rebuildBody(this.entity); }
}
/** CompositeCollider2D: merges the colliders (`usedByComposite = true`) on this object and its children into one body. */
export class CompositeCollider2D extends Collider2D {
  get pointCount() { return 0; }
  get geometryType() { return this.data.geometryType ?? 'Outlines'; }
  set geometryType(v) { this.set_('geometryType', v); rebuildBody(this.entity); }
  GenerateGeometry() { rebuildBody(this.entity); }
}

/** Unity's SpriteRenderer for `sprite` and `animatedSprite` components. */
export class SpriteRenderer extends ComponentBase {
  static nord = 'sprite';
  static Of(e) { return e.getComponent('sprite') || e.getComponent('animatedSprite') ? new this(e) : null; }
  get comp() { return this.entity.getComponent('sprite') ?? this.entity.getComponent('animatedSprite'); }
  get #type() { return this.comp.type; }
  /** The texture path (`assets/sprites/hero.png`). The texture must be used by some scene or prefab so it is preloaded. */
  get sprite() { return this.data.texture ?? null; }
  set sprite(path) { this.entity.set(this.#type, 'texture', path); }
  get color() { const c = Color.FromHex?.(this.data.tint ?? '#ffffff') ?? new Color(1, 1, 1); c.a = this.data.alpha ?? 1; return c; }
  set color(c) { this.entity.set(this.#type, 'tint', c.toHex()); this.entity.set(this.#type, 'alpha', c.a ?? 1); }
  get flipX() { return !!this.data.flipX; }
  set flipX(v) { const o = this.comp?.obj; if (this.comp?.setFlip) this.comp.setFlip(v, this.flipY); else this.entity.set(this.#type, 'flipX', v); this.data.flipX = v; void o; }
  get flipY() { return !!this.data.flipY; }
  set flipY(v) { this.entity.set(this.#type, 'flipY', v); }
  get enabled() { return this.comp?.obj?.visible ?? true; }
  set enabled(on) { this.comp?.obj?.setVisible?.(!!on); }
  /** Draw order: Nord uses the z position, bigger is in front. */
  get sortingOrder() { return this.entity.pos[2]; }
  set sortingOrder(v) { const p = this.entity.pos; this.entity.pos = [p[0], p[1], v]; }
  get size() { const s = this.data.size; return s ? new Vector2(s[0], s[1]) : null; }
  set size(v) { this.data.size = [v.x, v.y]; this.comp?.obj?.setDisplaySize?.(v.x, v.y); }
}

/** Unity's Animator. With an `animator` controller component it drives parameters and states; with only an `animatedSprite` it plays clips. */
export class Animator extends ComponentBase {
  static nord = 'animator';
  static Of(e) { return e.getComponent('animator') || e.getComponent('animatedSprite') ? new this(e) : null; }
  get #ctl() { return this.entity.getComponent('animator'); }
  SetFloat(n, v) { this.#ctl?.setFloat(n, v); }
  SetInteger(n, v) { this.#ctl?.setInt(n, v); }
  SetBool(n, v) { this.#ctl?.setBool(n, v); }
  SetTrigger(n) { this.#ctl?.setTrigger(n); }
  ResetTrigger(n) { this.#ctl?.resetTrigger(n); }
  GetFloat(n) { return Number(this.#ctl?.get(n) ?? 0); }
  GetInteger(n) { return Math.trunc(Number(this.#ctl?.get(n) ?? 0)); }
  GetBool(n) { return !!this.#ctl?.get(n); }
  /** `Play("Walk")`: a controller state, or (without a controller) a sprite clip. */
  Play(name) { const c = this.#ctl; if (c?.ctrl) c.play(name); else this.entity.getComponent('animatedSprite')?.play?.(name); }
  get currentState() { return this.#ctl?.state ?? this.entity.getComponent('animatedSprite')?.current ?? null; }
  get speed() { return this.entity.getComponent('animatedSprite')?.data?.speed ?? 1; }
  set speed(v) { this.entity.set('animatedSprite', 'speed', v); }
  get enabled() { return this.entity.enabled; }
}

/** Unity's AudioSource on an `audioSource` component. */
export class AudioSource extends ComponentBase {
  static nord = 'audioSource';
  static Of(e) { return e.getComponent('audioSource') ? new this(e) : null; }
  get clip() { return this.data.clip ?? null; }
  set clip(path) { this.comp.data.clip = path; }
  get volume() { return this.data.volume ?? 1; }
  set volume(v) { this.comp.data.volume = v; }
  get loop() { return !!this.data.loop; }
  set loop(v) { this.comp.data.loop = !!v; }
  Play() { this.comp?.play?.(); }
  Stop() { this.comp?.stop?.(); }
  PlayOneShot(clip, volume = 1) { return game()?.audio?.play(clip, { volume: volume * this.volume, bus: this.data.bus ?? 'sfx' }); }
  get isPlaying() { const h = this.comp?.handle; return !!h && !h.stopped; }
  static PlayClipAtPoint(clip, _position, volume = 1) { return game()?.audio?.play(clip, { volume }); }
}

/** Unity's Camera: `Camera.main` is the scene's camera entity. 2D conversions are exact; 3D `WorldToScreenPoint` warns (not available). */
export class Camera extends ComponentBase {
  static nord = 'camera';
  static Of(e) { return e.getComponent('camera') ? new this(e) : null; }
  static get main() {
    for (const e of game()?.scene?.all?.() ?? []) if (e.getComponent('camera')) return new Camera(e);
    return null;
  }
  get orthographic() { return !is3D(); }
  /** Half the visible world height (Unity's definition). 2D: project height / (2 × zoom). */
  get orthographicSize() { return (game()?.project?.display?.height ?? 360) / (2 * (this.data.zoom ?? 1)); }
  set orthographicSize(v) { const z = (game()?.project?.display?.height ?? 360) / (2 * v); this.data.zoom = z; game()?.camera?.zoom?.(z); }
  get zoom() { return this.data.zoom ?? 1; }
  set zoom(z) { this.data.zoom = z; game()?.camera?.zoom?.(z); }
  get fieldOfView() { const c = this.comp?.cam; return c?.fov != null && is3D() ? c.fov * R2D : (this.data.fov ?? 60); }
  set fieldOfView(deg) { this.data.fov = deg; const c = this.comp?.cam; if (c && 'fov' in c && is3D()) c.fov = deg * D2R; }
  get aspect() { const d = game()?.project?.display ?? { width: 16, height: 9 }; return d.width / d.height; }
  get backgroundColor() { return Color.FromHex?.(this.data.background ?? game()?.project?.display?.background ?? '#000000') ?? new Color(); }
  set backgroundColor(c) { this.data.background = c.toHex(); this.comp?.cam?.setBackgroundColor?.(c.toHex()); }
  /** Screen (canvas pixels, like `Input.mousePosition`) → world. 2D only. */
  ScreenToWorldPoint(p) {
    if (is3D()) { warnOnce('Camera.ScreenToWorldPoint is 2D only; in 3D use physics.raycast from the camera.'); return new Vector3(p.x, p.y, p.z ?? 0); }
    const w = game()?.backend?.toWorld?.(p.x, p.y) ?? [p.x, p.y];
    return new Vector3(w[0], w[1], p.z ?? 0);
  }
  WorldToScreenPoint(p) {
    const cam = game()?.backend?.scene?.cameras?.main;
    if (is3D() || !cam?.worldView) { warnOnce('Camera.WorldToScreenPoint is available in 2D only.'); return new Vector3(p.x, p.y, 0); }
    return new Vector3((p.x - cam.worldView.x) * cam.zoom, (p.y - cam.worldView.y) * cam.zoom, 0);
  }
  ViewportToWorldPoint(p) { const d = game()?.project?.display ?? { width: 640, height: 360 }; return this.ScreenToWorldPoint(new Vector3(p.x * d.width, p.y * d.height, p.z ?? 0)); }
  Shake(ms = 250, intensity = 0.01) { game()?.camera?.shake?.(ms, intensity); }
  Flash(ms = 250, color = '#ffffff') { game()?.camera?.flash?.(ms, color); }
}

/** Unity's Light for the 3D `light` component. */
export class Light extends ComponentBase {
  static nord = 'light';
  static Of(e) { return e.getComponent('light') ? new this(e) : null; }
  get intensity() { return this.data.intensity ?? 1; }
  set intensity(v) { this.set_('intensity', v); }
  get color() { return Color.FromHex?.(this.data.color ?? '#ffffff') ?? new Color(1, 1, 1); }
  set color(c) { this.set_('color', c.toHex()); }
  get shadows() { return this.data.castShadows ? 'Soft' : 'None'; }
  set shadows(v) { this.data.castShadows = v !== 'None'; }
  get enabled() { return this.entity.enabled; }
  set enabled(on) { this.entity.enabled = !!on; }
  get type() { return this.data.kind ?? 'point'; }
}

/** Unity's ParticleSystem for the `particles` component. */
export class ParticleSystem extends ComponentBase {
  static nord = 'particles';
  static Of(e) { return e.getComponent('particles') ? new this(e) : null; }
  Play() { this.comp?.emitter?.start?.(); }
  Stop() { this.comp?.emitter?.stop?.(); }
  /** `Emit(count)`: one burst. */
  Emit(n = 10) { this.comp?.burst?.(n); }
  get isPlaying() { return !!this.comp?.emitter?.emitting; }
  get isEmitting() { return this.isPlaying; }
}

/** World text (`text` component): TextMesh / TextMeshPro. */
export class TextMesh extends ComponentBase {
  static nord = 'text';
  static Of(e) { return e.getComponent('text') ? new this(e) : null; }
  get text() { return this.data.text ?? ''; }
  set text(v) { this.set_('text', String(v)); }
  get color() { return Color.FromHex?.(this.data.color ?? '#ffffff') ?? new Color(1, 1, 1); }
  set color(c) { this.set_('color', c.toHex()); }
  get fontSize() { return this.data.size ?? 24; }
}

/** Unity's Renderer / MeshRenderer for 3D (`material` + `mesh`/`model`). `material` gives colour, metallic and roughness. */
export class MeshRenderer extends ComponentBase {
  static nord = 'material';
  static Of(e) { return e.getComponent('mesh') || e.getComponent('model') || e.getComponent('material') ? new this(e) : null; }
  get material() { return new Material(this.entity); }
  get sharedMaterial() { return this.material; }
  get enabled() { return this.entity.enabled; }
  set enabled(on) { for (const m of this.entity.__meshes ?? []) m.setEnabled?.(!!on); }
}
export class Material extends ComponentBase {
  static nord = 'material';
  get color() { return Color.FromHex?.(this.data.color ?? '#ffffff') ?? new Color(1, 1, 1); }
  set color(c) { this.set_('color', c.toHex()); }
  get metallic() { return this.data.metallic ?? 0; }
  set metallic(v) { this.set_('metallic', v); }
  get roughness() { return this.data.roughness ?? 0.5; }
  set roughness(v) { this.set_('roughness', v); }
  /** `SetColor("_Color", c)`, `SetFloat("_Metallic", v)`: the common property names. */
  SetColor(name, c) { if (/color|albedo/i.test(name)) this.color = c; else if (/emis/i.test(name)) this.set_('emissive', c.toHex()); }
  SetFloat(name, v) { if (/metal/i.test(name)) this.metallic = v; else if (/rough|smooth/i.test(name)) this.roughness = /smooth/i.test(name) ? 1 - v : v; else if (/alpha|cutoff/i.test(name)) this.set_('alpha', v); }
}

const WRAPPERS = { Rigidbody2D, Rigidbody, Collider2D, BoxCollider2D, CircleCollider2D, CapsuleCollider2D, PolygonCollider2D, EdgeCollider2D, CompositeCollider2D, CapsuleCollider, Collider: Collider2D, BoxCollider, SphereCollider, SpriteRenderer, Animator, AudioSource, Camera, Light, ParticleSystem, TextMesh, Text: TextMesh, TextMeshPro: TextMesh, Renderer: MeshRenderer, MeshRenderer, Transform };
const UNITY_TO_NORD = { Rigidbody2D: 'rigidbody', Rigidbody: 'rigidbody', BoxCollider2D: 'collider', CircleCollider2D: 'collider', CapsuleCollider2D: 'collider', PolygonCollider2D: 'collider', EdgeCollider2D: 'collider', CompositeCollider2D: 'collider', CapsuleCollider: 'collider', Collider2D: 'collider', BoxCollider: 'collider', SphereCollider: 'collider', SpriteRenderer: 'sprite', AudioSource: 'audioSource', Light: 'light', ParticleSystem: 'particles', Camera: 'camera', Animator: 'animator', TextMesh: 'text' };

/** `GetComponent(type)`: a script class, a wrapper class (`SpriteRenderer`), a Unity name (`'Rigidbody2D'`), a Nord component type (`'sprite'`), a behavior name or a script class name. */
const UNITY_DEFAULTS = { Rigidbody2D: { mode: 'dynamic' }, Rigidbody: { mode: 'dynamic' }, CircleCollider2D: { shape: 'circle' }, SphereCollider: { shape: 'sphere' }, CapsuleCollider2D: { shape: 'capsule' }, CapsuleCollider: { shape: 'capsule' }, PolygonCollider2D: { shape: 'polygon' }, EdgeCollider2D: { shape: 'edge' }, CompositeCollider2D: { shape: 'composite' } };
/** Register a wrapper class for `GetComponent(Name)` / `AddComponent("Name")`: `Name` ↔ Nord component `nord`, with default data for AddComponent. */
export function registerUnityComponent(name, Class, nord, defaults) {
  WRAPPERS[name] = Class; UNITY_TO_NORD[name] = nord;
  if (defaults) UNITY_DEFAULTS[name] = defaults;
}
export function getUnityComponent(entity, type) {
  if (!entity || type == null) return null;
  if (typeof type === 'function') {
    if (typeof type.Of === 'function') return type === Transform ? Transform.Of(entity) : type.Of(entity);
    return entity.getScript(type);
  }
  const W = WRAPPERS[type];
  if (W) return W === Transform ? Transform.Of(entity) : W.Of(entity);
  return entity.getComponent(type) ?? entity.behavior(type) ?? entity.scripts.find((s) => s.constructor?.name === type) ?? null;
}
unityHooks.getComponent = getUnityComponent;
/** [RequireComponent]: `static RequireComponent = [Rigidbody2D, 'collider', OtherScript]` on a script class adds what the object is missing. */
sceneHooks.ensureRequired = (entity, need) => {
  if (typeof need === 'string') { const t = UNITY_TO_NORD[need] ?? need; if (!entity.getComponent(t)) entity.addComponent(t, t === 'rigidbody' ? { mode: 'dynamic' } : {}); return; }
  if (typeof need !== 'function') return;
  if (need.nord) { if (!entity.getComponent(need.nord)) entity.addComponent(need.nord, need.nord === 'rigidbody' ? { mode: 'dynamic' } : {}); return; }
  if (!entity.getScript(need)) entity.addScript(need);
};
unityHooks.transform = (e) => Transform.Of(e);

// ---------------------------------------------------------------- physics queries live in unity-physics.js (Physics2D casts / overlaps, Physics 3D)
// accessors must be defined, not copied by Object.assign (which would read the getter once)
Object.defineProperty(Physics2D, 'gravity', {
  configurable: true,
  get() { const g = game()?.physics?.world?.gravity; return g ? new Vector2(g.x, g.y) : new Vector2(...(game()?.project?.physics?.gravity ?? [0, 0, 0]).slice(0, 2)); },
  set(v) { game()?.physics?.setGravity?.(v.x, v.y); },
});
/** 3D physics facade (Unity's `Physics`); the query methods are added by unity-physics.js. */
export const Physics = {
  get gravity() { const g = game()?.project?.physics?.gravity ?? [0, -9.81, 0]; return v3(g); },
  set gravity(v) { game()?.physics?.setGravity?.(v.x, v.y, v.z); },
};

// ---------------------------------------------------------------- Time, Input, SceneManager, Application: missing members
let smooth = 1 / 60;
Object.defineProperties(Time, {
  smoothDeltaTime: { configurable: true, get() { smooth += (Time.deltaTime - smooth) * 0.1; return smooth; } },
  maximumDeltaTime: { configurable: true, get() { return 0.25; } },
  unscaledTime: { configurable: true, get() { return (globalThis.performance?.now?.() ?? Date.now()) / 1000; } },
  fixedUnscaledDeltaTime: { configurable: true, get() { return 1 / 60; } },
  inFixedTimeStep: { configurable: true, get() { return false; } },
});

const KEY_ALIASES = {
  space: 'Space', return: 'Enter', enter: 'Enter', escape: 'Escape', tab: 'Tab', backspace: 'Backspace', delete: 'Delete',
  up: 'ArrowUp', down: 'ArrowDown', left: 'ArrowLeft', right: 'ArrowRight', 'up arrow': 'ArrowUp', 'down arrow': 'ArrowDown', 'left arrow': 'ArrowLeft', 'right arrow': 'ArrowRight',
  'left shift': 'ShiftLeft', 'right shift': 'ShiftRight', 'left ctrl': 'ControlLeft', 'right ctrl': 'ControlRight', 'left alt': 'AltLeft', 'right alt': 'AltRight',
  'mouse 0': 'Mouse0', 'mouse 1': 'Mouse1', 'mouse 2': 'Mouse2',
};
/** Unity also accepts key *names* (`Input.GetKey("space")`, `"a"`, `"left shift"`, `"1"`): map them to the browser codes the engine uses. */
export function keyCode(k) {
  if (typeof k !== 'string') return k;
  if (/^(Key|Digit|Arrow|Shift|Control|Alt|Mouse|Numpad|Gamepad|F\d)/.test(k) || k === 'Space' || k === 'Enter' || k === 'Escape') return k;
  const low = k.toLowerCase();
  if (KEY_ALIASES[low]) return KEY_ALIASES[low];
  if (/^[a-z]$/.test(low)) return `Key${low.toUpperCase()}`;
  if (/^[0-9]$/.test(low)) return `Digit${low}`;
  if (/^f\d{1,2}$/.test(low)) return low.toUpperCase();
  return k;
}
const BUTTON_DEFAULTS = { Jump: ['Space'], Fire1: ['Mouse0', 'ControlLeft'], Fire2: ['Mouse1', 'AltLeft'], Fire3: ['Mouse2', 'ShiftLeft'], Submit: ['Enter'], Cancel: ['Escape'] };
const heldAny = (names) => names.some((c) => !!game()?.input.key(c));
const edge = (names, down) => { const i = game()?.input; return !!i?.heldSnap && names.some((c) => (down ? i.heldSnap.has(c) && !i.heldPrev.has(c) : !i.heldSnap.has(c) && i.heldPrev.has(c))); };
const actionCodes = (name) => { const a = game()?.input?.actions ?? {}; return a[name] ?? a[name.toLowerCase()] ?? BUTTON_DEFAULTS[name] ?? null; };
const baseKey = { GetKey: UnityInput.GetKey, GetKeyDown: UnityInput.GetKeyDown, GetKeyUp: UnityInput.GetKeyUp, GetButton: UnityInput.GetButton, GetButtonDown: UnityInput.GetButtonDown, GetButtonUp: UnityInput.GetButtonUp };
Object.assign(UnityInput, {
  GetKey: (k) => baseKey.GetKey(keyCode(k)),
  GetKeyDown: (k) => baseKey.GetKeyDown(keyCode(k)),
  GetKeyUp: (k) => baseKey.GetKeyUp(keyCode(k)),
  // Unity's button names (Jump, Fire1, Submit…) fall back to the usual keys when the project has no action with that name
  GetButton: (n) => { const c = actionCodes(n); return game()?.input.actions?.[n] || game()?.input.actions?.[n.toLowerCase()] ? baseKey.GetButton(game().input.actions[n] ? n : n.toLowerCase()) : !!c && heldAny(c); },
  GetButtonDown: (n) => { const c = actionCodes(n); return game()?.input.actions?.[n] || game()?.input.actions?.[n.toLowerCase()] ? baseKey.GetButtonDown(game().input.actions[n] ? n : n.toLowerCase()) : !!c && edge(c, true); },
  GetButtonUp: (n) => { const c = actionCodes(n); return game()?.input.actions?.[n] || game()?.input.actions?.[n.toLowerCase()] ? baseKey.GetButtonUp(game().input.actions[n] ? n : n.toLowerCase()) : !!c && edge(c, false); },
});
Object.defineProperties(UnityInput, {
  /** Wheel since the last frame (Unity: `mouseScrollDelta.y`). Positive = away from the user. */
  mouseScrollDelta: { configurable: true, get() { const w = game()?.input?.wheel ?? [0, 0]; return new Vector2(w[0], -w[1]); } },
  touchCount: { configurable: true, get() { return game()?.input?.touches?.size ?? 0; } },
  touchSupported: { configurable: true, get() { return !!globalThis.matchMedia?.('(pointer: coarse)')?.matches; } },
  touches: { configurable: true, get() { return [...(game()?.input?.touches?.values() ?? [])].map(touchOf); } },
  mousePresent: { configurable: true, get() { return !globalThis.matchMedia?.('(pointer: coarse)')?.matches; } },
  inputString: { configurable: true, get() { return ''; } },
});
/** A Unity `Touch`: `{ fingerId, position (screen), deltaPosition, phase }`. */
const touchOf = (t) => ({ fingerId: t.id, position: new Vector2(t.x, t.y), deltaPosition: new Vector2(t.dx ?? 0, t.dy ?? 0), phase: t.phase ?? 'Moved' });
UnityInput.GetTouch = (i) => UnityInput.touches[i] ?? null;

const loadedHandlers = new Set();
const sceneInfo = () => { const s = game()?.scene; return { name: s?.name ?? '', path: game()?.currentScenePath ?? s?.name ?? '', buildIndex: -1, isLoaded: !!s?.running, rootCount: s?.roots?.length ?? 0 }; };
/** Unity's AsyncOperation: `await SceneManager.LoadSceneAsync(path)` or poll `isDone` / `progress`. */
class AsyncOperation {
  constructor(p) { this.isDone = false; this.progress = 0; this.allowSceneActivation = true; this.completed = new Set(); this.promise = Promise.resolve(p).then((v) => { this.isDone = true; this.progress = 1; for (const f of this.completed) f(this); return v; }); }
  then(a, b) { return this.promise.then(a, b); }
}
Object.assign(SceneManager, {
  LoadSceneAsync: (path) => new AsyncOperation(game()?.loadScene(path)),
  GetActiveScene: () => sceneInfo(),
  get sceneCount() { return 1; },
  /** `SceneManager.sceneLoaded.AddListener((scene, mode) => …)` */
  sceneLoaded: {
    AddListener(fn) {
      const off = game()?.events.on('sceneLoad', (name) => fn({ ...sceneInfo(), name }, 'Single')); loadedHandlers.add(off);
      return () => { off?.(); loadedHandlers.delete(off); };
    },
    RemoveAllListeners() { for (const o of loadedHandlers) o?.(); loadedHandlers.clear(); },
  },
});

let targetFps = -1;
Object.defineProperties(Application, {
  targetFrameRate: { configurable: true, get() { return targetFps; }, set(v) { targetFps = v; const loop = game()?.backend?.game?.loop; if (loop && v > 0) loop.targetFps = v; } },
  persistentDataPath: { configurable: true, get() { return `nord://${game()?.project?.id ?? 'game'}/data`; } },
  dataPath: { configurable: true, get() { return `nord://${game()?.project?.id ?? 'game'}`; } },
  productName: { configurable: true, get() { return game()?.project?.name ?? ''; } },
  companyName: { configurable: true, get() { return String(game()?.project?.id ?? '').split('.').slice(0, 2).join('.'); } },
  version: { configurable: true, get() { return game()?.project?.version ?? '1.0.0'; } },
  isFocused: { configurable: true, get() { return globalThis.document?.hasFocus?.() ?? true; } },
  runInBackground: { configurable: true, get() { return true; }, set() {} },
  systemLanguage: { configurable: true, get() { return (globalThis.navigator?.language ?? 'en').split('-')[0]; } },
  unityVersion: { configurable: true, get() { return 'nord'; } },
});
Application.OpenURL = (url) => { if (/^(https?:|mailto:)/i.test(url)) globalThis.open?.(url, '_blank', 'noopener'); else warnOnce(`Application.OpenURL ignores ${url}: only http(s) and mailto links open.`); };

// ---------------------------------------------------------------- Resources, JsonUtility, Mathf extras, PostProcessing, Debug draw
const resCache = new Map();
/** `Resources.Load(path)` → Promise of the parsed JSON (or text). Textures and audio load through components and `audio.play(path)`; this is for data files. */
export const Resources = {
  Load(path) { if (!resCache.has(path)) resCache.set(path, game().loadJSON(path).catch(async () => (await (await fetch(path)).text()))); return resCache.get(path); },
  LoadAsync(path) { return new AsyncOperation(Resources.Load(path)); },
  UnloadUnusedAssets() { resCache.clear(); return new AsyncOperation(null); },
};
/** `JsonUtility.ToJson(obj)`, `FromJson(json)` (a plain object, or an instance of `Class` when given), `FromJsonOverwrite(json, obj)`. */
export const JsonUtility = {
  ToJson(o, pretty = false) { return JSON.stringify(o, null, pretty ? 2 : 0); },
  FromJson(json, Class) { const o = JSON.parse(json); if (!Class) return o; const t = new Class(); return Object.assign(t, o); },
  FromJsonOverwrite(json, target) { return Object.assign(target, JSON.parse(json)); },
};

// Perlin noise (improved, 2D) for Mathf.PerlinNoise: returns 0..1 like Unity.
const P = (() => { const p = []; let s = 1337; for (let i = 0; i < 256; i++) p.push(i); for (let i = 255; i > 0; i--) { s = (s * 16807) % 2147483647; const j = s % (i + 1); [p[i], p[j]] = [p[j], p[i]]; } return p.concat(p); })();
const fade = (t) => t * t * t * (t * (t * 6 - 15) + 10);
const grad = (h, x, y) => { const u = h & 1 ? x : y, v = h & 1 ? y : x; return ((h & 2) ? -u : u) + ((h & 4) ? -v : v) * 0.5; };
Object.assign(Mathf, {
  PerlinNoise(x, y) {
    const X = Math.floor(x) & 255, Y = Math.floor(y) & 255; x -= Math.floor(x); y -= Math.floor(y);
    const u = fade(x), v = fade(y), a = P[X] + Y, b = P[X + 1] + Y;
    const n = lerp(lerp(grad(P[a], x, y), grad(P[b], x - 1, y), u), lerp(grad(P[a + 1], x, y - 1), grad(P[b + 1], x - 1, y - 1), u), v);
    return clamp(n * 0.5 + 0.5, 0, 1);
  },
  NextPowerOfTwo: (v) => 2 ** Math.ceil(Math.log2(Math.max(1, v))),
  ClosestPowerOfTwo: (v) => 2 ** Math.round(Math.log2(Math.max(1, v))),
  IsPowerOfTwo: (v) => v > 0 && (v & (v - 1)) === 0,
  MoveTowardsAngle: (cur, target, maxDelta) => { const d = Mathf.DeltaAngle(cur, target); return Math.abs(d) <= maxDelta ? target : cur + Math.sign(d) * maxDelta; },
  Log2: Math.log2,
  Sinh: Math.sinh, Cosh: Math.cosh, Tanh: Math.tanh,
  Truncate: Math.trunc,
});

/** Unity's post-processing Volume, as a small facade over the engine's effects: `PostProcessing.Add('crt', { intensity: 0.4 })` returns a handle (`set`, `setEnabled`, `remove`). */
export const PostProcessing = {
  Add(type, params = {}) { return game()?.effects?.add(game().scene, type, params); },
  /** Effect on one object (2D filters like glow or blur). */
  AddTo(entity, type, params = {}) { return game()?.effects?.add(entity, type, params); },
  Clear() { game()?.effects?.clear?.('scene'); },
};

/** `Debug.DrawLine` / `DrawRay` as a short-lived line in the 2D Phaser view (nothing in other backends). */
Debug.DrawLine = (a, b, color = '#ff3b3b', duration = 0) => {
  const sc = game()?.backend?.scene;
  if (!sc?.add?.graphics) return;
  const g = sc.add.graphics().setDepth(1e6);
  const c = typeof color === 'string' ? parseInt(color.slice(1, 7), 16) : (color?.toHex ? parseInt(color.toHex().slice(1), 16) : 0xff3b3b);
  g.lineStyle(1.5, c, 1).lineBetween(a.x, a.y, b.x, b.y);
  sc.time.delayedCall(Math.max(16, (duration || 0.02) * 1000), () => g.destroy());
};
Debug.DrawRay = (o, d, color, duration) => Debug.DrawLine(o, new Vector2(o.x + d.x, o.y + d.y), color, duration);

/** `LayerMask`: Nord layers are plain numbers (draw order). `GetMask(0, 1)` ORs bits; names are not stored in the project, so `NameToLayer` returns -1. */
export const LayerMask = {
  GetMask: (...layers) => layers.reduce((m, l) => (typeof l === 'number' ? m | (1 << l) : m), 0),
  NameToLayer: () => -1,
  LayerToName: (i) => `Layer ${i}`,
};

// ---------------------------------------------------------------- Awaitable
const waitGame = (sec) => new Promise((res) => { const g = game(); if (g?.scene?.scheduler) g.scene.scheduler.after(sec, res); else setTimeout(res, sec * 1000); });
/** Unity's Awaitable: `await Awaitable.NextFrameAsync()` in an `async` method of a script. Uses game time, so it pauses with the game. */
export const Awaitable = {
  NextFrameAsync: () => waitGame(0),
  EndOfFrameAsync: () => waitGame(0),
  FixedUpdateAsync: () => waitGame(1 / 60),
  WaitForSecondsAsync: (sec) => waitGame(sec),
  MainThreadAsync: () => Promise.resolve(),
  BackgroundThreadAsync: () => Promise.resolve(),
  /** Resolves with the operation when a SceneManager.LoadSceneAsync / Resources.LoadAsync operation is done. */
  FromAsyncOperation: (op) => new Promise((res) => { const t = () => (op.isDone ? res(op) : waitGame(0).then(t)); t(); }),
};
