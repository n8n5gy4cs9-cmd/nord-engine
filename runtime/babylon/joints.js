// 3D joints for the Havok adapter (the `joint` component): every Unity joint is one Physics6DoFConstraint with the right axes locked, limited or free.
//   hinge      one free (or limited / motorised) rotation about `axis`, everything else locked          HingeJoint
//   fixed      all six degrees of freedom locked                                                           FixedJoint
//   spring     the anchors are pulled toward `distance` (min/max distance, stiffness from `frequency`)     SpringJoint
//   distance   the anchors stay within `distance` of each other (a rope / rod)
//   ball       position locked, rotation free within twist / swing limits                                   CharacterJoint
//   configurable   xMotion / yMotion / zMotion and angularXMotion / angularYMotion / angularZMotion ('locked' | 'limited' | 'free')   ConfigurableJoint
// data: kind, connectedBody (entity id, '' = the world), anchor [x, y, z], connectedAnchor, autoConfigureConnectedAnchor, axis [x, y, z], collideConnected, distance, autoConfigureDistance,
//       frequency (Hz), dampingRatio, useLimits + lowerAngle / upperAngle (degrees), useMotor + motorSpeed (degrees/s) + maxMotorTorque, twistMin / twistMax / swingLimit (degrees),
//       linearLimit, breakForce is not supported by Havok constraints in Babylon (ignored).
const D2R = Math.PI / 180;

export class HavokJoint {
  constructor(adapter, comp) { this.adapter = adapter; this.comp = comp; this.entity = comp.entity; this.built = false; this.con = null; this.other = null; this.anchorBody = null; }
  get d() { return this.comp.data; }
  build() {
    if (this.built) return true;
    const ad = this.adapter, B = ad.B, d = this.d, A = ad.rec(this.entity); if (!A) return false;
    let rb = null, other = null;
    if (d.connectedBody) {
      other = this.entity.scene.findById(d.connectedBody) ?? this.entity.scene.find(d.connectedBody);
      rb = other ? ad.rec(other) : null; if (!rb) return false; // not there yet
    }
    this.other = other;
    const V = (a, k = 0) => new B.Vector3(a?.[0] ?? k, a?.[1] ?? k, a?.[2] ?? k);
    const nodeA = this.entity.native; nodeA.computeWorldMatrix(true);
    const wA = nodeA.getWorldMatrix(), pivotA = V(d.anchor), worldPivot = B.Vector3.TransformCoordinates(pivotA, wA);
    const axisA = (V(d.axis ?? [1, 0, 0]).lengthSquared() > 0 ? V(d.axis ?? [1, 0, 0]) : new B.Vector3(1, 0, 0)).normalize();
    const perpA = Math.abs(axisA.y) < 0.9 ? B.Vector3.Cross(axisA, new B.Vector3(0, 1, 0)).normalize() : B.Vector3.Cross(axisA, new B.Vector3(1, 0, 0)).normalize();
    let bodyB, pivotB, axisB, perpB;
    if (rb) {
      const nodeB = other.native; nodeB.computeWorldMatrix(true);
      const inv = nodeB.getWorldMatrix().clone().invert();
      pivotB = d.autoConfigureConnectedAnchor === false && d.connectedAnchor ? V(d.connectedAnchor) : B.Vector3.TransformCoordinates(worldPivot, inv);
      const worldAxis = B.Vector3.TransformNormal(axisA, wA).normalize(), worldPerp = B.Vector3.TransformNormal(perpA, wA).normalize();
      axisB = B.Vector3.TransformNormal(worldAxis, inv).normalize(); perpB = B.Vector3.TransformNormal(worldPerp, inv).normalize();
      bodyB = rb.body;
    } else { // the world: a static, shapeless-by-collision anchor body at the pivot
      const n = new B.TransformNode(`${this.entity.name}.jointAnchor`, ad.scene); n.position.copyFrom(worldPivot);
      const sh = new B.PhysicsShapeSphere(B.Vector3.Zero(), 0.01, ad.scene); sh.isTrigger = true;
      this.anchorBody = new B.PhysicsBody(n, B.PhysicsMotionType.STATIC, false, ad.scene); this.anchorBody.shape = sh; this.anchorNode = n;
      bodyB = this.anchorBody; pivotB = B.Vector3.Zero(); axisB = B.Vector3.TransformNormal(axisA, wA).normalize(); perpB = B.Vector3.TransformNormal(perpA, wA).normalize();
    }
    const ax = B.PhysicsConstraintAxis, lim = [];
    const lock = (axis) => lim.push({ axis, minLimit: 0, maxLimit: 0 });
    const range = (axis, lo, hi, extra = {}) => lim.push({ axis, minLimit: lo, maxLimit: hi, ...extra });
    const kind = d.kind ?? 'hinge', f = d.frequency ?? 5, damp = d.dampingRatio ?? 0.5;
    const dist = d.autoConfigureDistance !== false || !d.distance ? B.Vector3.Distance(worldPivot, rb ? B.Vector3.TransformCoordinates(pivotB, other.native.getWorldMatrix()) : worldPivot) : d.distance;
    switch (kind) {
      case 'fixed': for (const a of [ax.LINEAR_X, ax.LINEAR_Y, ax.LINEAR_Z, ax.ANGULAR_X, ax.ANGULAR_Y, ax.ANGULAR_Z]) lock(a); break;
      case 'spring': {
        const k = (2 * Math.PI * f) ** 2 * (A.cfg.mass || 1), c = 2 * damp * Math.sqrt(k * (A.cfg.mass || 1));
        range(ax.LINEAR_DISTANCE, d.maxDistanceOnly ? 0 : dist, dist, { stiffness: k, damping: c }); break;
      }
      case 'distance': range(ax.LINEAR_DISTANCE, d.maxDistanceOnly ? 0 : dist, dist); break;
      case 'ball': {
        for (const a of [ax.LINEAR_X, ax.LINEAR_Y, ax.LINEAR_Z]) lock(a);
        if (d.twistMin != null || d.twistMax != null) range(ax.ANGULAR_X, (d.twistMin ?? -45) * D2R, (d.twistMax ?? 45) * D2R);
        if (d.swingLimit != null) { range(ax.ANGULAR_Y, -d.swingLimit * D2R, d.swingLimit * D2R); range(ax.ANGULAR_Z, -d.swingLimit * D2R, d.swingLimit * D2R); }
        break;
      }
      case 'configurable': {
        const m = (v) => v ?? 'locked', L = (d.linearLimit ?? 0);
        [[ax.LINEAR_X, d.xMotion], [ax.LINEAR_Y, d.yMotion], [ax.LINEAR_Z, d.zMotion]].forEach(([a, mode]) => { if (m(mode) === 'locked') lock(a); else if (m(mode) === 'limited') range(a, -L, L); });
        [[ax.ANGULAR_X, d.angularXMotion, d.twistMin ?? -45, d.twistMax ?? 45], [ax.ANGULAR_Y, d.angularYMotion, -(d.swingLimit ?? 45), d.swingLimit ?? 45], [ax.ANGULAR_Z, d.angularZMotion, -(d.swingLimit ?? 45), d.swingLimit ?? 45]]
          .forEach(([a, mode, lo, hi]) => { if (m(mode) === 'locked') lock(a); else if (m(mode) === 'limited') range(a, lo * D2R, hi * D2R); });
        break;
      }
      default: { // hinge
        for (const a of [ax.LINEAR_X, ax.LINEAR_Y, ax.LINEAR_Z, ax.ANGULAR_Y, ax.ANGULAR_Z]) lock(a);
        if (d.useLimits) range(ax.ANGULAR_X, (d.lowerAngle ?? 0) * D2R, (d.upperAngle ?? 0) * D2R);
      }
    }
    this.con = new B.Physics6DoFConstraint({ pivotA, pivotB, axisA, axisB, perpAxisA: perpA, perpAxisB: perpB, collision: !!d.collideConnected }, lim, ad.scene);
    A.body.addConstraint(bodyB, this.con);
    if (kind === 'hinge' && d.useMotor) {
      this.con.setAxisMotorType(ax.ANGULAR_X, B.PhysicsConstraintMotorType.VELOCITY);
      this.con.setAxisMotorTarget(ax.ANGULAR_X, (d.motorSpeed ?? 0) * D2R);
      this.con.setAxisMotorMaxForce(ax.ANGULAR_X, d.maxMotorTorque ?? 10000);
    }
    this.built = true;
    return true;
  }
  /** One of the two bodies was rebuilt (its Havok body is new): make the constraint again. */
  rebuild() { this.release(); this.build(); }
  release() { try { this.con?.dispose(); } catch { /* already gone */ } this.con = null; try { this.anchorBody?.dispose(); this.anchorNode?.dispose(); } catch { /* gone */ } this.anchorBody = null; this.built = false; }
  destroy() { this.release(); }
}
