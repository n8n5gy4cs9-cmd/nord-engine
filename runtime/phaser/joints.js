// 2D joints for the Matter adapter (the `joint` component). Pins, springs and rods are real Matter constraints; limits, motors, sliders, wheels, targets, relative and
// friction joints are solved by small per-step helpers on top (before/after each world step). Anchors are in the entity's local, unscaled space; the body's pivot is the entity origin.
//
// data: kind (hinge | spring | distance | fixed | slider | wheel | target | relative | friction), connectedBody (entity id, '' = the world), anchor [x, y], connectedAnchor [x, y],
//       autoConfigureConnectedAnchor, collideConnected, breakForce (0 = never breaks), distance + autoConfigureDistance + maxDistanceOnly, frequency (Hz), dampingRatio,
//       useLimits + lowerAngle / upperAngle (degrees), lowerTranslation / upperTranslation, useMotor + motorSpeed (degrees/s, units/s for sliders) + maxMotorTorque,
//       angle (slider / wheel axis, degrees), target [x, y] (world) + autoConfigureTarget, maxForce, linearOffset [x, y], angularOffset (degrees).
const D2R = Math.PI / 180;
const rot = (x, y, a) => ({ x: x * Math.cos(a) - y * Math.sin(a), y: x * Math.sin(a) + y * Math.cos(a) });
/** Matter constraint stiffness for a spring of `freq` Hz. Measured on Matter 0.20 (weak springs): ω² ≈ 3.3 · iterations · stiffness / dt². Stiff springs saturate (the step is 60 Hz). */
const stiffnessOf = (freq, iters = 2, dt = 1 / 60) => Math.min(0.5, Math.max(0.0002, (2 * Math.PI * freq * dt) ** 2 / (3.3 * iters)));

/** Matter's `damping` removes that fraction of the relative speed per step; a damping ratio ζ at ω = 2πf needs 2ζω·dt over the constraint's iterations. */
const dampingOf = (ratio, freq, iters = 2, dt = 1 / 60) => Math.min(1, 2 * ratio * 2 * Math.PI * freq * dt / iters);

export class MatterJoint {
  constructor(adapter, comp) {
    this.adapter = adapter; this.comp = comp; this.entity = comp.entity; this.cons = []; this.alive = true; this.built = false;
    this.M = globalThis.Phaser.Physics.Matter.Matter;
  }
  get d() { return this.comp.data; }
  /** Try to build (both bodies must exist). Returns true once built. */
  build() {
    if (this.built) return true;
    const A = this.adapter.bodies.get(this.entity)?.go.body; if (!A) return false;
    const d = this.d, M = this.M;
    let B = null, other = null;
    if (d.connectedBody) {
      other = this.adapter.backend.game.scene?.findById(d.connectedBody) ?? this.adapter.backend.game.scene?.find(d.connectedBody);
      B = other ? this.adapter.bodies.get(other)?.go.body : null;
      if (!B) return false; // the other body is not there yet
    }
    this.A = A; this.B = B; this.other = other;
    const a = d.anchor ?? [0, 0];
    this.anchor = { x: a[0], y: a[1] };
    const wa = this.worldOf(A, this.anchor);
    if (B) {
      if (d.autoConfigureConnectedAnchor !== false || !d.connectedAnchor) { const r = rot(wa.x - B.position.x, wa.y - B.position.y, -B.angle); this.connected = r; }
      else this.connected = { x: d.connectedAnchor[0], y: d.connectedAnchor[1] };
    } else this.connected = (d.autoConfigureConnectedAnchor === false && d.connectedAnchor) ? { x: d.connectedAnchor[0], y: d.connectedAnchor[1] } : wa; // world anchor
    const wb = B ? this.worldOf(B, this.connected) : this.connected;
    this.rest = d.autoConfigureDistance !== false || !d.distance ? Math.hypot(wb.x - wa.x, wb.y - wa.y) : d.distance;
    this.refAngle = B ? B.angle - A.angle : -A.angle;
    const make = (o) => { const c = M.Constraint.create({ bodyA: A, bodyB: B ?? undefined, pointA: this.anchor, pointB: this.connected, ...o }); this.adapter.world.add(c); this.cons.push(c); return c; };
    const it = this.adapter.world.engine.constraintIterations || 2, f = d.frequency ?? 5, k = d.frequency ? stiffnessOf(f, it) : 1, damp = dampingOf(d.dampingRatio ?? 0.5, f, it);
    switch (d.kind ?? 'hinge') {
      case 'hinge': make({ length: 0, stiffness: 1 }); break;
      case 'spring': this.spring = make({ length: this.rest, stiffness: stiffnessOf(f, it), damping: damp }); break;
      case 'distance': this.spring = make({ length: this.rest, stiffness: d.frequency ? k : 1, damping: d.frequency ? damp : 0.1 }); break;
      case 'fixed': {
        make({ length: 0, stiffness: d.frequency ? k : 1, damping: d.frequency ? damp : 0.1 });
        const off = 30, p2 = { x: this.anchor.x + off, y: this.anchor.y }, q2 = B ? { x: this.connected.x + off, y: this.connected.y } : { x: this.connected.x + off * Math.cos(A.angle), y: this.connected.y + off * Math.sin(A.angle) };
        const c = M.Constraint.create({ bodyA: A, bodyB: B ?? undefined, pointA: p2, pointB: q2, length: 0, stiffness: d.frequency ? k : 1, damping: 0.1 }); this.adapter.world.add(c); this.cons.push(c);
        break;
      }
      case 'target': {
        const t = (d.autoConfigureTarget !== false || !d.target) ? wa : { x: d.target[0], y: d.target[1] };
        this.target = t; this.cons.push(M.Constraint.create({ bodyA: A, pointA: this.anchor, pointB: t, length: 0, stiffness: stiffnessOf(f, it), damping: damp })); this.adapter.world.add(this.cons[0]);
        break;
      }
      default: break; // slider, wheel, relative, friction: solved in pre()/post()
    }
    this.axisAngle = (d.angle ?? 0) * D2R;
    this.relOffset = B ? rot(B.position.x - A.position.x, B.position.y - A.position.y, -A.angle) : { x: 0, y: 0 };
    // Matter's solver only knows the inertia about a body's centre. A pivot d away from it must turn the body like a pendulum, so add m·d² (parallel axis theorem).
    for (const [body, off] of [[A, this.anchor], [B, this.connected]]) {
      if (!body || body.isStatic || !Number.isFinite(body.inertia) || body.inverseInertia === 0) continue;
      const dd = body === B ? Math.hypot(off.x, off.y) : Math.hypot(off.x, off.y);
      if (dd > 1) { M.Body.setInertia(body, body.inertia + body.mass * dd * dd); body.__jointInertia = (body.__jointInertia ?? 0) + body.mass * dd * dd; }
    }
    this.built = true;
    if (!d.collideConnected && B) this.adapter.setIgnore(this.entity, other, true);
    return true;
  }
  worldOf(body, local) { const r = rot(local.x, local.y, body.angle); return { x: body.position.x + r.x, y: body.position.y + r.y }; }
  setTarget(x, y) { this.target = { x, y }; if (this.cons[0]) this.cons[0].pointB = { x, y }; }
  axis() { const a = this.A.angle + this.axisAngle; return { x: Math.cos(a), y: Math.sin(a) }; }
  /** Before the world step: velocity-level effects. */
  pre(dt) {
    if (!this.built || !this.alive) return;
    const d = this.d, M = this.M, B = this.B;
    if (d.maxDistanceOnly && this.spring) { const wa = this.worldOf(this.A, this.anchor), wb = B ? this.worldOf(B, this.connected) : this.connected; this.spring.stiffness = Math.hypot(wb.x - wa.x, wb.y - wa.y) > this.rest ? (d.kind === 'distance' ? 1 : stiffnessOf(d.frequency ?? 5, this.adapter.world.engine.constraintIterations || 2)) : 0; }
    if (!B) return;
    if (d.kind === 'friction') {
      const k = Math.max(0, 1 - (d.maxForce ?? 1) * dt / Math.max(B.mass, 1e-3) / 60);
      const rv = { x: B.velocity.x - this.A.velocity.x, y: B.velocity.y - this.A.velocity.y };
      M.Body.setVelocity(B, { x: this.A.velocity.x + rv.x * k, y: this.A.velocity.y + rv.y * k });
      M.Body.setAngularVelocity(B, this.A.angularVelocity + (B.angularVelocity - this.A.angularVelocity) * k);
    }
  }
  /** After the world step: positional effects, limits, motors, break check. */
  post(dt) {
    if (!this.built || !this.alive) return;
    const d = this.d, M = this.M, A = this.A, B = this.B, kind = d.kind ?? 'hinge';
    if (kind === 'hinge' && B) {
      let ang = (B.angle - A.angle - this.refAngle) / D2R;
      if (d.useLimits) {
        const lo = d.lowerAngle ?? 0, hi = d.upperAngle ?? 0;
        if (ang < lo) { M.Body.setAngle(B, A.angle + this.refAngle + lo * D2R); if (B.angularVelocity < 0) M.Body.setAngularVelocity(B, 0); ang = lo; }
        else if (ang > hi) { M.Body.setAngle(B, A.angle + this.refAngle + hi * D2R); if (B.angularVelocity > 0) M.Body.setAngularVelocity(B, 0); ang = hi; }
      }
      if (d.useMotor) M.Body.setAngularVelocity(B, (d.motorSpeed ?? 0) * D2R * dt);
      this.angle = ang;
    } else if (kind === 'hinge' && d.useMotor) M.Body.setAngularVelocity(A, (d.motorSpeed ?? 0) * D2R * dt);
    if ((kind === 'slider' || kind === 'wheel') && B) {
      const u = this.axis(), wa = this.worldOf(A, this.anchor), wb = this.worldOf(B, this.connected);
      let along = (wb.x - wa.x) * u.x + (wb.y - wa.y) * u.y;
      const lo = d.useLimits ? d.lowerTranslation ?? 0 : -Infinity, hi = d.useLimits ? d.upperTranslation ?? 0 : Infinity;
      const clamped = Math.min(Math.max(along, lo), hi);
      if (kind === 'wheel') { // suspension: a spring pulls the wheel back to its rest place along the axis; the wheel turns freely
        const k = (2 * Math.PI * (d.frequency ?? 2)) ** 2 * B.mass, c = 2 * (d.dampingRatio ?? 0.7) * Math.sqrt(k * B.mass), vAlong = B.velocity.x * u.x + B.velocity.y * u.y;
        const f = -(k * along + c * vAlong) * dt * dt / 3600; // impulse per step in Matter units
        M.Body.setVelocity(B, { x: B.velocity.x + u.x * f / B.mass * 60, y: B.velocity.y + u.y * f / B.mass * 60 });
        if (d.useMotor) M.Body.setAngularVelocity(B, (d.motorSpeed ?? 0) * D2R * dt);
      } else {
        M.Body.setAngle(B, A.angle + this.refAngle);
        if (d.useMotor) along += (d.motorSpeed ?? 0) * dt;
      }
      const target = { x: wa.x + u.x * (kind === 'wheel' ? clamped : Math.min(Math.max(along, lo), hi)) - (wb.x - B.position.x), y: wa.y + u.y * (kind === 'wheel' ? clamped : Math.min(Math.max(along, lo), hi)) - (wb.y - B.position.y) };
      const perp = { x: -u.y, y: u.x }, off = (wb.x - wa.x) * perp.x + (wb.y - wa.y) * perp.y;
      M.Body.setPosition(B, { x: kind === 'wheel' ? B.position.x - perp.x * off : target.x, y: kind === 'wheel' ? B.position.y - perp.y * off : target.y });
      const va = B.velocity.x * u.x + B.velocity.y * u.y;
      M.Body.setVelocity(B, { x: u.x * va, y: u.y * va });
      this.translation = clamped;
    }
    if (kind === 'relative' && B) {
      const lo = d.linearOffset ?? [0, 0], r = rot(lo[0], lo[1], A.angle), want = { x: A.position.x + r.x, y: A.position.y + r.y };
      const k = Math.min(1, (d.maxForce ?? 0.2) > 1 ? 1 : (d.maxForce ?? 0.2));
      M.Body.setPosition(B, { x: B.position.x + (want.x - B.position.x) * k, y: B.position.y + (want.y - B.position.y) * k });
      M.Body.setAngle(B, B.angle + (A.angle + (d.angularOffset ?? 0) * D2R - B.angle) * k);
    }
    if (kind === 'target' && this.cons[0]) { const m = d.maxForce; if (m > 0 && m < 1e6) this.cons[0].stiffness = Math.min(stiffnessOf(d.frequency ?? 5, this.adapter.world.engine.constraintIterations || 2), m / 1000); }
    if (d.breakForce > 0 && this.cons[0] && ['hinge', 'spring', 'distance', 'fixed'].includes(kind)) {
      const wa = this.worldOf(A, this.anchor), wb = B ? this.worldOf(B, this.connected) : this.connected, err = Math.hypot(wb.x - wa.x, wb.y - wa.y) - (this.spring ? this.rest : 0);
      const force = Math.abs(err) * (this.cons[0].stiffness || 1) * (B ? B.mass : A.mass) * 3600 / 60;
      if (force > d.breakForce) this.breakNow(force);
    }
  }
  breakNow(force = 0) {
    if (!this.alive) return;
    this.destroy();
    this.adapter.backend.game.scene?.dispatch(this.entity, 'onJointBreak', { reactionForce: force, joint: this.comp });
    this.entity.emit('jointBreak', force);
  }
  destroy() {
    for (const c of this.cons) { try { this.adapter.world.remove(c); } catch { /* already gone */ } }
    this.cons = []; this.alive = false;
    if (this.built && this.other && !this.d.collideConnected) this.adapter.setIgnore(this.entity, this.other, false);
  }
}
