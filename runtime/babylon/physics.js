// Havok physics adapter for Babylon, same small API as the 2D adapters (`game.physics`), 3D vectors.
// Bodies are built from `rigidbody` + `collider` components (lazily, since components arrive one at a time).
// Stepped manually from the fixed-update loop (Babylon's own auto-step is disabled).
import { HavokJoint } from './joints.js';

const key = (a, b) => (a.id < b.id ? `${a.id}|${b.id}` : `${b.id}|${a.id}`);
const R2D = 180 / Math.PI;

export class HavokAdapter {
  kind = 'havok';
  constructor(backend, hk, gravity) {
    const B = this.B = backend.B;
    this.backend = backend; this.scene = backend.scene;
    this.plugin = new B.HavokPlugin(true, hk);
    this.scene.enablePhysics(new B.Vector3(...gravity), this.plugin);
    this.engine = this.scene.getPhysicsEngine();
    // Havok emits collision events reliably only when stepped by the scene itself: use Babylon's fixed sub-step accumulator (60 Hz)
    // and copy results back to entities after each physics step.
    this.engine.setSubTimeStep(1000 / 60);
    this.scene.onAfterPhysicsObservable.add(() => this.#writeBack());
    this.bodies = new Map();   // entity → { body, shape, cfg }
    this.dirty = new Set();
    this.touching = new Set();
    this.joints = new Map();    // joint component → HavokJoint
    this.ignorePairs = new Map(); // Physics.IgnoreCollision: pair key → { a, b, con } (a constraint that only switches collisions between the two bodies off)
    this.ignoreLayers = new Set();
    const ent = (b) => b?.transformNode?.metadata?.entity ?? null;
    const dispatch = (a, b, method, ev, ...extra) => {
      if (!a || !b || a.destroyed || b.destroyed) return;
      this.backend.game.scene?.dispatch(a, method, b, ...extra); this.backend.game.scene?.dispatch(b, method, a, ...extra);
      a.emit(ev, b); b.emit(ev, a);
    };
    this.plugin.onTriggerCollisionObservable.add((ev) => {
      const a = ent(ev.collider), b = ent(ev.collidedAgainst);
      if (ev.type === 'TRIGGER_ENTERED') dispatch(a, b, 'onTriggerEnter', 'triggerEnter');
      else if (ev.type === 'TRIGGER_EXITED') dispatch(a, b, 'onTriggerExit', 'triggerExit');
    });
    this.plugin.onCollisionObservable.add((ev) => {
      if (ev.type !== 'COLLISION_STARTED') return;
      const a = ent(ev.collider), b = ent(ev.collidedAgainst);
      if (a && b) dispatch(a, b, 'onCollisionEnter', 'collisionEnter', { point: ev.point?.asArray?.() ?? null, normal: ev.normal?.asArray?.() ?? null, impulse: ev.impulse });
    });
    this.plugin.onCollisionEndedObservable.add((ev) => {
      const a = ent(ev.collider), b = ent(ev.collidedAgainst);
      if (a && b) dispatch(a, b, 'onCollisionExit', 'collisionExit');
    });
  }

  build(e) { this.dirty.add(e); }
  flushDirty() { for (const e of [...this.dirty]) { this.dirty.delete(e); if (!e.destroyed && e.native) this.create(e); } }
  rec(e) { if (this.dirty.has(e)) this.flushDirty(); return this.bodies.get(e); }

  /** World-space extents of the entity's meshes, used when the collider has no explicit size. */
  #bounds(e) {
    const B = this.B; let min = null, max = null;
    for (const m of e.__meshes ?? []) {
      m.computeWorldMatrix(true);
      const bb = m.getBoundingInfo().boundingBox;
      min = min ? B.Vector3.Minimize(min, bb.minimumWorld) : bb.minimumWorld.clone();
      max = max ? B.Vector3.Maximize(max, bb.maximumWorld) : bb.maximumWorld.clone();
    }
    return min ? max.subtract(min).asArray() : [1, 1, 1];
  }

  create(e) {
    const B = this.B, node = e.native;
    this.forget(e);
    const rb = e.getComponent('rigidbody')?.data ?? null, col = e.getComponent('collider')?.data ?? null;
    const sc = node.absoluteScaling ?? node.scaling;
    const cfg = {
      mode: rb?.mode ?? 'static', mass: rb?.mass ?? 1, drag: rb?.drag ?? 0.05, angularDrag: rb?.angularDrag ?? 0.1, bounce: rb?.bounce ?? 0, friction: rb?.friction ?? 0.5,
      gravityScale: rb?.gravityScale ?? 1, fixedRotation: !!rb?.fixedRotation, trigger: !!col?.trigger, shape: col?.shape ?? 'box',
      freezePos: [!!rb?.freezePositionX, !!rb?.freezePositionY, !!rb?.freezePositionZ], freezeRot: [!!rb?.freezeRotationX, !!rb?.freezeRotationY, !!rb?.freezeRotationZ],
      interpolation: rb?.interpolation ?? 'none', ccd: rb?.collisionDetection ?? 'discrete', layer: e.layer ?? 0,
    };
    const bounds = col?.size ? col.size.map((v, i) => v * Math.abs([sc.x, sc.y, sc.z][i])) : this.#bounds(e);
    cfg.extents = bounds;
    const center = new B.Vector3(...(col?.offset ?? [0, 0, 0]));
    let shape;
    if (cfg.shape === 'sphere') shape = new B.PhysicsShapeSphere(center, col?.radius ?? Math.max(...bounds) / 2, this.scene);
    else if (cfg.shape === 'capsule') { const r = col?.radius ?? Math.min(bounds[0], bounds[2]) / 2, hh = Math.max(bounds[1] / 2 - r, 0); shape = new B.PhysicsShapeCapsule(center.add(new B.Vector3(0, -hh, 0)), center.add(new B.Vector3(0, hh, 0)), r, this.scene); }
    else if (cfg.shape === 'cylinder') shape = new B.PhysicsShapeCylinder(center.add(new B.Vector3(0, -bounds[1] / 2, 0)), center.add(new B.Vector3(0, bounds[1] / 2, 0)), bounds[0] / 2, this.scene);
    else shape = new B.PhysicsShapeBox(center, B.Quaternion.Identity(), new B.Vector3(...bounds), this.scene);
    shape.isTrigger = cfg.trigger;
    shape.material = { friction: cfg.friction, restitution: cfg.bounce };
    const motion = { static: B.PhysicsMotionType.STATIC, dynamic: B.PhysicsMotionType.DYNAMIC, kinematic: B.PhysicsMotionType.ANIMATED }[cfg.mode] ?? B.PhysicsMotionType.STATIC;
    const body = new B.PhysicsBody(node, motion, false, this.scene);
    body.shape = shape;
    if (cfg.mode === 'dynamic') {
      body.setMassProperties(cfg.fixedRotation ? { mass: cfg.mass, inertia: B.Vector3.ZeroReadOnly } : { mass: cfg.mass });
      if (!cfg.fixedRotation && cfg.freezeRot.some(Boolean)) { // axis constraints on rotation: no inertia on a frozen axis (Havok then does not turn the body about it)
        const i = body.getMassProperties().inertia ?? B.Vector3.One();
        body.setMassProperties({ mass: cfg.mass, inertia: new B.Vector3(cfg.freezeRot[0] ? 0 : i.x, cfg.freezeRot[1] ? 0 : i.y, cfg.freezeRot[2] ? 0 : i.z) });
      }
      body.setLinearDamping(cfg.drag); body.setAngularDamping(cfg.angularDrag);
      if (cfg.gravityScale !== 1) body.setGravityFactor(cfg.gravityScale);
    }
    body.setCollisionCallbackEnabled(true); body.setCollisionEndedCallbackEnabled(true);
    const rec = { body, shape, cfg, pin: node.position.asArray() };
    if (cfg.mode === 'dynamic' && cfg.freezePos.some(Boolean)) body.disablePreStep = false; // frozen position axes are pushed back every step from the node
    this.bodies.set(e, rec);
    this.#applyFilter(rec);
    this.#reapplyIgnores(e);
    for (const [comp, j] of this.joints) if (j.entity === e || j.other === e) j.rebuild?.(); // a body was rebuilt: its joints must be made again
  }
  /** Layer ignoring (Physics.IgnoreLayerCollision) uses Havok's membership/collide masks; with no ignored layers the defaults are left alone. */
  #applyFilter(rec) {
    if (!this.ignoreLayers.size && rec.shape.filterMembershipMask === undefined) return;
    const l = Math.min(Math.max(rec.cfg.layer | 0, 0), 30); let collide = 0xffffffff;
    for (const k of this.ignoreLayers) { const [x, y] = k.split('|').map(Number); if (x === l) collide &= ~(1 << y); if (y === l) collide &= ~(1 << x); }
    rec.shape.filterMembershipMask = 1 << l; rec.shape.filterCollideMask = collide | 0;
  }
  setIgnoreLayers(la, lb, on) { const k = la < lb ? `${la}|${lb}` : `${lb}|${la}`; if (on) this.ignoreLayers.add(k); else this.ignoreLayers.delete(k); for (const r of this.bodies.values()) this.#applyFilter(r); }
  /** Physics.IgnoreCollision(a, b): Havok has no per-pair switch, but a constraint with `collision: false` and no limits ties nothing and stops the two bodies from colliding. */
  setIgnore(a, b, on) {
    const k = key(a, b), have = this.ignorePairs.get(k);
    if (!on) { if (have) { try { have.con?.dispose(); } catch { /* gone */ } this.ignorePairs.delete(k); } return; }
    if (have) return;
    this.ignorePairs.set(k, { a, b, con: null }); this.#linkIgnore(this.ignorePairs.get(k));
  }
  #linkIgnore(p) {
    const ra = this.rec(p.a), rb = this.rec(p.b); if (!ra || !rb || p.con) return;
    const B = this.B, z = B.Vector3.Zero();
    p.con = new B.Physics6DoFConstraint({ pivotA: z, pivotB: z, axisA: new B.Vector3(1, 0, 0), axisB: new B.Vector3(1, 0, 0), perpAxisA: new B.Vector3(0, 1, 0), perpAxisB: new B.Vector3(0, 1, 0), collision: false }, [], this.scene);
    ra.body.addConstraint(rb.body, p.con);
  }
  #reapplyIgnores(e) { for (const p of this.ignorePairs.values()) if (p.a === e || p.b === e) { p.con = null; this.#linkIgnore(p); } }
  /** Joints (the `joint` component): HavokJoint builds a Physics6DoFConstraint once both bodies exist. */
  addJoint(comp) { this.joints.set(comp, new HavokJoint(this, comp)); }
  removeJoint(comp) { this.joints.get(comp)?.destroy(); this.joints.delete(comp); }
  setInterpolation(e, mode) { const r = this.bodies.get(e); if (r) r.cfg.interpolation = mode ?? 'none'; }
  setContinuous(e, mode) { const r = this.bodies.get(e); if (r) r.cfg.ccd = mode ?? 'discrete'; }

  forget(e) {
    this.dirty.delete(e);
    const r = this.bodies.get(e);
    if (r) {
      for (const j of this.joints.values()) if (j.entity === e || j.other === e) j.release?.();
      for (const p of this.ignorePairs.values()) if ((p.a === e || p.b === e) && p.con) { try { p.con.dispose(); } catch { /* gone */ } p.con = null; }
      try { r.body.dispose(); r.shape.dispose(); } catch { /* already gone */ } this.bodies.delete(e);
    }
  }

  /** Called once per game frame (before Babylon runs its physics sub-steps): build joints whose bodies now exist, and cut the physics step into smaller pieces for fast continuous bodies. */
  step(dt = 1 / 60) {
    this.flushDirty();
    for (const j of this.joints.values()) if (!j.built) j.build();
    let n = 1;
    for (const r of this.bodies.values()) {
      if (r.cfg.ccd === 'discrete' || r.cfg.mode !== 'dynamic') continue;
      const v = r.body.getLinearVelocity(), half = Math.max(Math.min(...r.cfg.extents) / 2, 0.01);
      n = Math.max(n, Math.min(8, Math.ceil(Math.hypot(v.x, v.y, v.z) * dt / half)));
    }
    if (n !== this.subSteps) { this.subSteps = n; this.engine.setSubTimeStep(1000 / 60 / n); }
  }
  #writeBack() {
    for (const [e, r] of this.bodies) {
      if (r.cfg.mode !== 'dynamic' || e.destroyed) continue;
      const n = e.native;
      if (r.cfg.freezePos.some(Boolean)) { // axis constraints on position: put the frozen coordinate back, remove the speed along it
        const v = r.body.getLinearVelocity(), P = ['x', 'y', 'z'];
        P.forEach((a, i) => { if (r.cfg.freezePos[i]) { n.position[a] = r.pin[i]; v[a] = 0; } });
        r.body.setLinearVelocity(v);
      }
      if (r.cfg.freezeRot.some(Boolean)) { // axis constraints on rotation: a spin that was set (or is left from before) is removed on the frozen axes
        const w = r.body.getAngularVelocity();
        ['x', 'y', 'z'].forEach((a, i) => { if (r.cfg.freezeRot[i]) w[a] = 0; });
        r.body.setAngularVelocity(w);
      }
      e.t.pos[0] = n.position.x; e.t.pos[1] = n.position.y; e.t.pos[2] = n.position.z;
      if (!r.cfg.fixedRotation && n.rotationQuaternion) { const r3 = n.rotationQuaternion.toEulerAngles(); e.t.rot[0] = r3.x * R2D; e.t.rot[1] = r3.y * R2D; e.t.rot[2] = r3.z * R2D; }
    }
  }
  /** Entity transform was set from script: push it into Havok for the next step (pre-step sync is off by default), zeroing velocity for dynamic bodies. */
  teleported(e, keepVelocity = false) {
    const r = this.bodies.get(e); if (!r) return;
    r.body.disablePreStep = false; r.pin = e.native.position.asArray(); // a script moved the entity: frozen axes freeze there
    if (!(r.cfg.mode === 'dynamic' && r.cfg.freezePos.some(Boolean))) this.scene.onAfterPhysicsObservable.addOnce(() => { r.body.disablePreStep = true; });
    if (r.cfg.mode === 'dynamic') { const v = keepVelocity ? r.body.getLinearVelocity() : this.B.Vector3.Zero(); r.body.setLinearVelocity(v); r.body.setAngularVelocity(this.B.Vector3.Zero()); }
  }

  setVelocity(e, x, y, z) {
    const r = this.rec(e); if (!r) return;
    const c = r.body.getLinearVelocity(), f = r.cfg.freezePos;
    r.body.setLinearVelocity(new this.B.Vector3(f[0] ? 0 : x ?? c.x, f[1] ? 0 : y ?? c.y, f[2] ? 0 : z ?? c.z));
  }
  velocity(e) { const r = this.rec(e); return r ? r.body.getLinearVelocity().asArray() : [0, 0, 0]; }
  /** Radians per second about x, y, z. */
  angularVelocity(e) { const r = this.rec(e); return r ? r.body.getAngularVelocity().asArray() : [0, 0, 0]; }
  setAngularVelocity(e, a) { const r = this.rec(e); if (r) r.body.setAngularVelocity(new this.B.Vector3(r.cfg.freezeRot[0] ? 0 : a[0], r.cfg.freezeRot[1] ? 0 : a[1], r.cfg.freezeRot[2] ? 0 : a[2])); }
  applyImpulse(e, ix, iy, iz) { const r = this.rec(e); if (r) r.body.applyImpulse(new this.B.Vector3(ix, iy, iz), e.native.getAbsolutePosition()); }
  setGravity(x, y, z) { this.engine.setGravity(new this.B.Vector3(x, y, z)); }
  /** Cast a ray; returns { entity, point, normal, distance } or null. `ignore` = entity to skip (e.g. the caster). */
  raycast(from, to, { ignore = null } = {}) {
    const B = this.B, res = new B.PhysicsRaycastResult();
    const f = new B.Vector3(...from), t = new B.Vector3(...to);
    this.engine.raycastToRef(f, t, res, { collideWith: undefined });
    if (!res.hasHit) return null;
    const ent = res.body?.transformNode?.metadata?.entity ?? null;
    if (ignore && ent === ignore) return null;
    return { entity: ent, point: res.hitPointWorld.asArray(), normal: res.hitNormalWorld.asArray(), distance: B.Vector3.Distance(f, res.hitPointWorld) };
  }
  isGrounded(e, tolerance = 0.12) {
    const r = this.rec(e); if (!r) return false;
    const p = e.native.getAbsolutePosition(), half = r.cfg.extents[1] / 2;
    // start just inside our own shape (rays ignore the shape they start in) so a resting body never starts inside the ground
    const hit = this.raycast([p.x, p.y - half + 0.05, p.z], [p.x, p.y - half - tolerance, p.z], { ignore: e });
    return !!hit;
  }
  enable(e, on) { if (on) this.dirty.add(e); else { const r = this.bodies.get(e); if (r) this.forget(e); } }
  teleport(e, x, y, z) { e.pos = [x, y, z]; }
}
