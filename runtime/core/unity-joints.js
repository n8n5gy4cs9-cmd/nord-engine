// Unity joint classes on the `joint` component: HingeJoint2D, SpringJoint2D, DistanceJoint2D, FixedJoint2D, SliderJoint2D, WheelJoint2D, TargetJoint2D, RelativeJoint2D,
// FrictionJoint2D and HingeJoint, SpringJoint, FixedJoint, CharacterJoint, ConfigurableJoint. Setting a property changes the component data; the physics adapter rebuilds the joint
// (limits, motors, break force and targets are applied live). `GetComponent(HingeJoint2D)`, `AddComponent(HingeJoint2D)` and `GetComponents(...)` work for every kind.
//   const j = this.AddComponent(HingeJoint2D); j.connectedBody = other.GetComponent(Rigidbody2D); j.useMotor = true; j.motor = { motorSpeed: 90, maxMotorTorque: 1000 };
import { Vector2, Vector3 } from './unity.js';
import { ComponentBase, registerUnityComponent, Rigidbody2D, Rigidbody } from './unity-extra.js';
import { Game } from './game.js';

const game = () => Game.current;
const is3D = () => game()?.project?.type === '3d';
const vec = (a, n) => (n === 3 ? new Vector3(a?.[0] ?? 0, a?.[1] ?? 0, a?.[2] ?? 0) : new Vector2(a?.[0] ?? 0, a?.[1] ?? 0));
const arr = (v, n) => (n === 3 ? [v.x, v.y, v.z ?? 0] : [v.x, v.y]);

/** Base of all joints (Unity's Joint / Joint2D). */
export class Joint2D extends ComponentBase {
  static nord = 'joint';
  static fromComp(e, c) { return new this(e, c); }
  static Of(e) { const c = e.components.find((x) => x.type === 'joint' && (!this.kind || [].concat(this.kind).includes(x.data.kind ?? 'hinge'))); return c ? new this(e, c) : null; }
  static All(e) { return e.components.filter((x) => x.type === 'joint' && (!this.kind || [].concat(this.kind).includes(x.data.kind ?? 'hinge'))).map((c) => new this(e, c)); }
  constructor(entity, comp) { super(entity); this._comp = comp; }
  get comp() { return this._comp ?? this.entity.components.findLast?.((c) => c.type === 'joint'); }
  get data() { return this.comp?.data ?? {}; }
  set_(k, v) { this.comp.data[k] = v; const impl = this.comp.impl; if (impl?.set) impl.set(this.comp, k, v); }
  /** The body this joint is attached to (a Rigidbody2D / Rigidbody wrapper), or null for a joint to the world. */
  get connectedBody() { const id = this.data.connectedBody; if (!id) return null; const e = this.entity.scene.findById(id) ?? this.entity.scene.find(id); return e ? (is3D() ? Rigidbody : Rigidbody2D).Of(e) : null; }
  set connectedBody(b) { this.set_('connectedBody', b ? (b.entity ?? b).id : ''); }
  get attachedRigidbody() { return (is3D() ? Rigidbody : Rigidbody2D).Of(this.entity); }
  get anchor() { return vec(this.data.anchor, is3D() ? 3 : 2); }
  set anchor(v) { this.set_('anchor', arr(v, is3D() ? 3 : 2)); }
  get connectedAnchor() { return vec(this.data.connectedAnchor, is3D() ? 3 : 2); }
  set connectedAnchor(v) { this.set_('connectedAnchor', arr(v, is3D() ? 3 : 2)); this.set_('autoConfigureConnectedAnchor', false); }
  get autoConfigureConnectedAnchor() { return this.data.autoConfigureConnectedAnchor !== false; }
  set autoConfigureConnectedAnchor(v) { this.set_('autoConfigureConnectedAnchor', !!v); }
  /** Do the two connected bodies collide with each other? (`enableCollision` in 2D, `enableCollision` in 3D too.) */
  get enableCollision() { return !!this.data.collideConnected; }
  set enableCollision(v) { this.set_('collideConnected', !!v); }
  get breakForce() { return this.data.breakForce > 0 ? this.data.breakForce : Infinity; }
  set breakForce(v) { this.set_('breakForce', Number.isFinite(v) ? v : 0); }
  get breakTorque() { return this.data.breakTorque > 0 ? this.data.breakTorque : Infinity; }
  set breakTorque(v) { this.set_('breakTorque', Number.isFinite(v) ? v : 0); }
  get enabled() { return this.entity.enabled && this.data.componentEnabled !== false; }
  /** Live force on the joint is not reported by the engines (always zero). */
  get reactionForce() { return is3D() ? Vector3.zero : Vector2.zero; }
  get reactionTorque() { return 0; }
  GetReactionForce() { return this.reactionForce; }
  GetReactionTorque() { return 0; }
}
export { Joint2D as Joint };

/** Adds `name` as a property mapped to a component field: kind 'number' | 'bool' | 'vec2' | 'vec3' | 'angle' (degrees both ways). */
function props(Class, map) {
  for (const [name, [key, kind, def]] of Object.entries(map)) {
    Object.defineProperty(Class.prototype, name, {
      configurable: true,
      get() {
        const v = this.data[key];
        if (kind === 'bool') return v ?? def ?? false;
        if (kind === 'vec2') return vec(v, 2);
        if (kind === 'vec3') return vec(v, 3);
        return v ?? def ?? 0;
      },
      set(x) { this.set_(key, kind === 'vec2' ? arr(x, 2) : kind === 'vec3' ? arr(x, 3) : kind === 'bool' ? !!x : x); },
    });
  }
}
/** `limits` / `motor` style struct properties (Unity returns structs): `j.limits = { min, max }` writes the fields; reading gives a plain object. */
function struct(Class, name, fields) {
  Object.defineProperty(Class.prototype, name, {
    configurable: true,
    get() { return Object.fromEntries(Object.entries(fields).map(([k, [key, def]]) => [k, this.data[key] ?? def])); },
    set(o) { for (const [k, [key]] of Object.entries(fields)) if (o && k in o) this.set_(key, o[k]); },
  });
}

const kinded = (name, kind, nord = 'joint', extra = {}) => {
  const C = { [name]: class extends Joint2D { static kind = kind; static defaults = { kind, ...extra }; } }[name];
  registerUnityComponent(name, C, nord, { kind, ...extra });
  return C;
};

// ------------------------------------------------------------ 2D
export const HingeJoint2D = kinded('HingeJoint2D', 'hinge');
props(HingeJoint2D, { useLimits: ['useLimits', 'bool'], useMotor: ['useMotor', 'bool'], referenceAngle: ['referenceAngle', 'number'] });
struct(HingeJoint2D, 'limits', { min: ['lowerAngle', 0], max: ['upperAngle', 0] });
struct(HingeJoint2D, 'motor', { motorSpeed: ['motorSpeed', 0], maxMotorTorque: ['maxMotorTorque', 10000] });
Object.defineProperties(HingeJoint2D.prototype, {
  jointAngle: { get() { return (this.comp && game()?.physics?.joints?.get(this.comp)?.angle) ?? 0; } },
  jointSpeed: { get() { return 0; } },
});
export const SpringJoint2D = kinded('SpringJoint2D', 'spring');
props(SpringJoint2D, { distance: ['distance', 'number'], autoConfigureDistance: ['autoConfigureDistance', 'bool', true], dampingRatio: ['dampingRatio', 'number', 0.5], frequency: ['frequency', 'number', 5] });
export const DistanceJoint2D = kinded('DistanceJoint2D', 'distance');
props(DistanceJoint2D, { distance: ['distance', 'number'], autoConfigureDistance: ['autoConfigureDistance', 'bool', true], maxDistanceOnly: ['maxDistanceOnly', 'bool'] });
export const FixedJoint2D = kinded('FixedJoint2D', 'fixed');
props(FixedJoint2D, { dampingRatio: ['dampingRatio', 'number', 0], frequency: ['frequency', 'number', 0] });
export const SliderJoint2D = kinded('SliderJoint2D', 'slider');
props(SliderJoint2D, { angle: ['angle', 'number'], autoConfigureAngle: ['autoConfigureAngle', 'bool'], useMotor: ['useMotor', 'bool'], useLimits: ['useLimits', 'bool'] });
struct(SliderJoint2D, 'limits', { min: ['lowerTranslation', 0], max: ['upperTranslation', 0] });
struct(SliderJoint2D, 'motor', { motorSpeed: ['motorSpeed', 0], maxMotorForce: ['maxMotorTorque', 10000] });
Object.defineProperty(SliderJoint2D.prototype, 'jointTranslation', { get() { return game()?.physics?.joints?.get(this.comp)?.translation ?? 0; } });
export const WheelJoint2D = kinded('WheelJoint2D', 'wheel');
props(WheelJoint2D, { useMotor: ['useMotor', 'bool'] });
struct(WheelJoint2D, 'suspension', { dampingRatio: ['dampingRatio', 0.7], frequency: ['frequency', 2], angle: ['angle', 90] });
struct(WheelJoint2D, 'motor', { motorSpeed: ['motorSpeed', 0], maxMotorTorque: ['maxMotorTorque', 10000] });
export const TargetJoint2D = kinded('TargetJoint2D', 'target');
props(TargetJoint2D, { autoConfigureTarget: ['autoConfigureTarget', 'bool', true], maxForce: ['maxForce', 'number', 10000], dampingRatio: ['dampingRatio', 'number', 1], frequency: ['frequency', 'number', 5] });
Object.defineProperty(TargetJoint2D.prototype, 'target', { get() { return vec(this.data.target, 2); }, set(v) { this.set_('autoConfigureTarget', false); this.set_('target', [v.x, v.y]); } });
export const RelativeJoint2D = kinded('RelativeJoint2D', 'relative');
props(RelativeJoint2D, { maxForce: ['maxForce', 'number', 0.2], linearOffset: ['linearOffset', 'vec2'], angularOffset: ['angularOffset', 'number'], autoConfigureOffset: ['autoConfigureOffset', 'bool', true] });
export const FrictionJoint2D = kinded('FrictionJoint2D', 'friction');
props(FrictionJoint2D, { maxForce: ['maxForce', 'number', 1], maxTorque: ['maxTorque', 'number', 1] });

// ------------------------------------------------------------ 3D
export const HingeJoint = kinded('HingeJoint', 'hinge');
props(HingeJoint, { axis: ['axis', 'vec3'], useLimits: ['useLimits', 'bool'], useMotor: ['useMotor', 'bool'] });
struct(HingeJoint, 'limits', { min: ['lowerAngle', 0], max: ['upperAngle', 0] });
struct(HingeJoint, 'motor', { targetVelocity: ['motorSpeed', 0], force: ['maxMotorTorque', 10000] });
export const SpringJoint = kinded('SpringJoint', 'spring');
props(SpringJoint, { axis: ['axis', 'vec3'], spring: ['frequency', 'number', 5], damper: ['dampingRatio', 'number', 0.5], minDistance: ['minDistance', 'number'], maxDistance: ['distance', 'number'] });
export const FixedJoint = kinded('FixedJoint', 'fixed');
props(FixedJoint, { axis: ['axis', 'vec3'] });
export const CharacterJoint = kinded('CharacterJoint', 'ball');
props(CharacterJoint, { axis: ['axis', 'vec3'], swingAxis: ['swingAxis', 'vec3'] });
struct(CharacterJoint, 'lowTwistLimit', { limit: ['twistMin', -45] });
struct(CharacterJoint, 'highTwistLimit', { limit: ['twistMax', 45] });
struct(CharacterJoint, 'swing1Limit', { limit: ['swingLimit', 45] });
struct(CharacterJoint, 'swing2Limit', { limit: ['swingLimit', 45] });
export const ConfigurableJoint = kinded('ConfigurableJoint', 'configurable');
const MOTION = { Locked: 'locked', Limited: 'limited', Free: 'free', 0: 'free', 1: 'limited', 2: 'locked' };
/** Unity's ConfigurableJointMotion. */
export const ConfigurableJointMotion = Object.freeze({ Locked: 'locked', Limited: 'limited', Free: 'free' });
for (const k of ['xMotion', 'yMotion', 'zMotion', 'angularXMotion', 'angularYMotion', 'angularZMotion']) {
  Object.defineProperty(ConfigurableJoint.prototype, k, { configurable: true, get() { return this.data[k] ?? 'locked'; }, set(v) { this.set_(k, MOTION[v] ?? v); } });
}
props(ConfigurableJoint, { axis: ['axis', 'vec3'] });
struct(ConfigurableJoint, 'linearLimit', { limit: ['linearLimit', 0] });
struct(ConfigurableJoint, 'lowAngularXLimit', { limit: ['twistMin', -45] });
struct(ConfigurableJoint, 'highAngularXLimit', { limit: ['twistMax', 45] });
struct(ConfigurableJoint, 'angularYLimit', { limit: ['swingLimit', 45] });
struct(ConfigurableJoint, 'angularZLimit', { limit: ['swingLimit', 45] });
