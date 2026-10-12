// Havok physics adapter for Babylon, same small API as the 2D adapters (`game.physics`), 3D vectors.
// Bodies are built from `rigidbody` + `collider` components (lazily, since components arrive one at a time).
// Stepped manually from the fixed-update loop (Babylon's own auto-step is disabled).
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
      body.setLinearDamping(cfg.drag); body.setAngularDamping(cfg.angularDrag);
      if (cfg.gravityScale !== 1) body.setGravityFactor(cfg.gravityScale);
    }
    body.setCollisionCallbackEnabled(true); body.setCollisionEndedCallbackEnabled(true);
    this.bodies.set(e, { body, shape, cfg });
  }

  forget(e) {
    this.dirty.delete(e);
    const r = this.bodies.get(e);
    if (r) { try { r.body.dispose(); r.shape.dispose(); } catch { /* already gone */ } this.bodies.delete(e); }
  }

  step() { this.flushDirty(); }
  #writeBack() {
    for (const [e, r] of this.bodies) {
      if (r.cfg.mode !== 'dynamic' || e.destroyed) continue;
      const n = e.native;
      e.t.pos[0] = n.position.x; e.t.pos[1] = n.position.y; e.t.pos[2] = n.position.z;
      if (!r.cfg.fixedRotation && n.rotationQuaternion) { const r3 = n.rotationQuaternion.toEulerAngles(); e.t.rot[0] = r3.x * R2D; e.t.rot[1] = r3.y * R2D; e.t.rot[2] = r3.z * R2D; }
    }
  }
  /** Entity transform was set from script: push it into Havok for the next step (pre-step sync is off by default), zeroing velocity for dynamic bodies. */
  teleported(e) {
    const r = this.bodies.get(e); if (!r) return;
    r.body.disablePreStep = false;
    this.scene.onAfterPhysicsObservable.addOnce(() => { r.body.disablePreStep = true; });
    if (r.cfg.mode === 'dynamic') { r.body.setLinearVelocity(this.B.Vector3.Zero()); r.body.setAngularVelocity(this.B.Vector3.Zero()); }
  }

  setVelocity(e, x, y, z) {
    const r = this.rec(e); if (!r) return;
    const c = r.body.getLinearVelocity();
    r.body.setLinearVelocity(new this.B.Vector3(x ?? c.x, y ?? c.y, z ?? c.z));
  }
  velocity(e) { const r = this.rec(e); return r ? r.body.getLinearVelocity().asArray() : [0, 0, 0]; }
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
