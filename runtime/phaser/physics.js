// 2D physics adapters for Phaser: arcade and matter, behind one small API (`game.physics`).
// Both are stepped manually from the fixed-update loop so script fixedUpdate and physics stay in lockstep.
// Entities declare bodies with `rigidbody` + `collider` components (either may be absent). Colliders with trigger:true only overlap.
import { toLocal } from './transform.js';
import { entityParts, ownedByComposite, boundsOfParts } from './shapes.js';
import { MatterJoint } from './joints.js';
import { shape2D } from '../core/unity-physics.js';
import { sweep } from '../core/geometry.js';

const P = () => globalThis.Phaser;
const key = (a, b) => (a.id < b.id ? `${a.id}|${b.id}` : `${b.id}|${a.id}`);

class Base {
  constructor(backend, scene, settings) {
    this.backend = backend; this.scene = scene; this.settings = settings;
    this.bodies = new Map();            // entity → { go, mode, trigger, cfg }
    this.touching = new Map();          // pair key → { a, b, trigger, seen }
    this.layers = [];                   // collidable tilemap layers
    this.dirty = new Set();             // entities whose body must be (re)built — components arrive one at a time
    this.ignorePairs = new Set();       // Physics2D.IgnoreCollision: pair keys that pass through each other
    this.ignoreLayers = new Set();      // Physics2D.IgnoreLayerCollision: "a|b" layer pairs
    this.joints = new Map();            // joint component → solver (matter only; arcade has a small positional solver)
    this.warned = new Set();
  }
  warnOnce(msg) { if (!this.warned.has(msg)) { this.warned.add(msg); this.backend.game.warn(`[nord] ${msg}`); } }
  setIgnore(a, b, on) { const k = key(a, b); if (on) this.ignorePairs.add(k); else this.ignorePairs.delete(k); }
  setIgnoreLayers(la, lb, on) { const k = la < lb ? `${la}|${lb}` : `${lb}|${la}`; if (on) this.ignoreLayers.add(k); else this.ignoreLayers.delete(k); }
  isIgnored(a, b) { return this.ignorePairs.has(key(a, b)) || (this.ignoreLayers.size > 0 && this.ignoreLayers.has(a.layer < b.layer ? `${a.layer}|${b.layer}` : `${b.layer}|${a.layer}`)); }
  /** Visual size of an entity (collider default size). */
  visualSize(e) { const v = e.native; return [v?.width || 16, v?.height || 16]; }
  /** Joints: the `joint` component registers here; the other body may not exist yet, so building is retried every step. */
  addJoint(comp) { this.joints.set(comp, this.makeJoint?.(comp) ?? null); if (!this.makeJoint) this.warnOnce('joints need physics.engine "matter" (Project ▸ Physics); with "arcade" only the position-pull kinds work'); }
  removeJoint(comp) { this.joints.get(comp)?.destroy?.(); this.joints.delete(comp); }
  stepJoints(phase, dt) { for (const j of this.joints.values()) { if (!j) continue; if (!j.built && !j.build()) continue; j[phase]?.(dt); } }
  /** Interpolation (rigidbody.interpolation): after a step remember where the body was and is; before drawing, show the point in between; undo before the next step. */
  snapshot() {
    for (const [e, b] of this.bodies) {
      if (b.mode === 'static' || b.cfg.interpolation === 'none' || e.destroyed) continue;
      const go = b.go; b.prev = b.cur ?? [go.x, go.y, go.angle]; b.cur = [go.x, go.y, go.angle];
    }
  }
  interpolate(alpha) {
    for (const b of this.bodies.values()) {
      if (!b.cur || !b.prev || b.cfg.interpolation === 'none') continue;
      const t = b.cfg.interpolation === 'extrapolate' ? 1 + alpha : alpha, go = b.go;
      b.shown = true;
      go.setPosition(b.prev[0] + (b.cur[0] - b.prev[0]) * t, b.prev[1] + (b.cur[1] - b.prev[1]) * t);
      go.setAngle(b.prev[2] + (b.cur[2] - b.prev[2]) * t);
    }
  }
  endInterpolate() { for (const b of this.bodies.values()) if (b.shown) { b.shown = false; b.go.setPosition(b.cur[0], b.cur[1]); b.go.setAngle(b.cur[2]); } }
  /**
   * Continuous detection (rigidbody.collisionDetection ≠ discrete): before the step, sweep each fast body's shape along this step's movement. If something would be hit
   * on the way, put the body just in front of it and take the speed into the surface away (a bounce when the body has `bounce`), so it cannot jump through a thin collider.
   */
  guard(dt) {
    for (const [e, b] of this.bodies) {
      if (b.cfg.ccd === 'discrete' || b.mode !== 'dynamic' || b.trigger || !e.enabled || !b.go.body) continue;
      const v = this.velocity(e), dist = Math.hypot(v[0], v[1]) * dt;
      if (dist < 1) continue;
      const mine = shape2D(e); if (!mine) continue;
      const dir = [v[0] * dt / dist, v[1] * dt / dist, 0], c = e.worldPos;
      let best = null;
      for (const [o, ob] of this.bodies) {
        if (o === e || ob.trigger || !o.enabled || this.isIgnored(e, o)) continue;
        const shape = shape2D(o); if (!shape) continue;
        const h = sweep(mine, dir, dist, shape, [c[0], c[1], 0]);
        if (h && h.t > 0.01 && (!best || h.t < best.t)) best = h; // t = 0: already touching, the solver has it
      }
      if (best && best.t < dist) {
        const m = Math.max(best.t - 0.05, 0), n = best.normal, vn = v[0] * n[0] + v[1] * n[1];
        this.translate(e, dir[0] * m, dir[1] * m);
        if (vn < 0) { const k = (1 + b.cfg.bounce) * vn; this.setVelocity(e, v[0] - k * n[0], v[1] - k * n[1]); } // stop (or bounce) at the contact: the solver runs after this step's movement
      }
    }
  }
  setInterpolation(e, mode) { const b = this.bodies.get(e); if (b) { b.cfg.interpolation = mode ?? 'none'; if (mode === 'none') this.endInterpolate(); } }
  setContinuous(e, mode) { const b = this.bodies.get(e); if (b) b.cfg.ccd = mode ?? 'discrete'; }
  build(entity) { this.dirty.add(entity); }
  /** Build bodies for entities whose rigidbody/collider components changed. Called before every step and by accessors. */
  flushDirty() { for (const e of [...this.dirty]) { this.dirty.delete(e); if (!e.destroyed && e.native) this.create(e); } }
  game() { return this.backend.game; }
  cfg(entity) {
    const rb = entity.getComponent('rigidbody')?.data ?? null, col = entity.getComponent('collider')?.data ?? null;
    const vis = entity.native;
    const size = col?.size ?? [vis.width || 16, vis.height || 16];
    return {
      mode: rb?.mode ?? 'static', mass: rb?.mass ?? 1, drag: rb?.drag ?? 0, bounce: rb?.bounce ?? 0, gravityScale: rb?.gravityScale ?? 1,
      maxVelocity: rb?.maxVelocity ?? null, friction: rb?.friction ?? 0.1,
      shape: col?.shape ?? 'box', size, radius: col?.radius ?? Math.max(size[0], size[1]) / 2, offset: col?.offset ?? [0, 0], trigger: !!col?.trigger, hasCollider: !!col,
      // legacy: a 2D rigidbody without the flag keeps its rotation fixed; freezeRotationZ (Inspector / Rigidbody2D.constraints) overrides it
      fixedRotation: rb?.freezeRotationZ ?? rb?.fixedRotation ?? true,
      freezeX: !!rb?.freezePositionX, freezeY: !!rb?.freezePositionY,
      interpolation: rb?.interpolation ?? 'none', ccd: rb?.collisionDetection ?? 'discrete',
    };
  }
  /** Entity-level event dispatch with enter/exit bookkeeping. `hits` = array of [entityA, entityB, trigger, contact]. */
  flush(hits) {
    const seen = new Set();
    for (const [a, b, trigger, contact] of hits) {
      if (a.destroyed || b.destroyed) continue;
      const k = (trigger ? 't:' : 'c:') + key(a, b);
      seen.add(k);
      if (!this.touching.has(k)) {
        this.touching.set(k, { a, b, trigger });
        const [ma, mb] = trigger ? ['onTriggerEnter', 'onTriggerEnter'] : ['onCollisionEnter', 'onCollisionEnter'];
        this.backend.game.scene.dispatch(a, ma, b, contact); this.backend.game.scene.dispatch(b, mb, a, contact);
        a.emit(trigger ? 'triggerEnter' : 'collisionEnter', b); b.emit(trigger ? 'triggerEnter' : 'collisionEnter', a);
      }
    }
    for (const [k, p] of this.touching) {
      if (seen.has(k)) continue;
      this.touching.delete(k);
      const m = p.trigger ? 'onTriggerExit' : 'onCollisionExit';
      if (!p.a.destroyed) this.backend.game.scene.dispatch(p.a, m, p.b);
      if (!p.b.destroyed) this.backend.game.scene.dispatch(p.b, m, p.a);
    }
  }
  /** After a step: copy body-driven container positions back to entity local transforms. */
  writeBack() {
    for (const [e, b] of this.bodies) {
      if (b.mode === 'static' || e.destroyed) continue;
      const go = b.go;
      const pw = e.parent ? this.backend.world(e.parent) : null;
      const [lx, ly] = toLocal(go.x, go.y, pw);
      e.t.pos[0] = lx; e.t.pos[1] = ly;
      if (!b.cfg.fixedRotation || this.kind === 'matter') e.t.rot[2] = go.angle - (pw?.angle ?? 0);
      this.backend.syncChildren(e);
    }
  }
  tilemap(layer) { this.layers.push(layer); }
  removeTilemap(layer) { this.layers = this.layers.filter(l => l !== layer); }
  forget(entity) { this.dirty.delete(entity); this.bodies.delete(entity); for (const [k, p] of this.touching) if (p.a === entity || p.b === entity) this.touching.delete(k); }
}

export class ArcadeAdapter extends Base {
  kind = 'arcade';
  constructor(backend, scene, settings) {
    super(backend, scene, settings);
    const w = this.world = scene.physics.world;
    const g = settings.gravity ?? [0, 0, 0];
    w.gravity.set(g[0], g[1]);
    // stop Phaser auto-stepping; we call world.step() from backend.step()
    scene.events.off('update', w.update, w);
    scene.events.off('postupdate', w.postUpdate, w);
    w.isPaused = false; w.fixedStep = false;
  }
  makeJoint(comp) { return new ArcadeJoint(this, comp); }
  create(entity) {
    const go = entity.native, cfg = this.cfg(entity);
    this.forget(entity);
    if (go.body) { try { this.world.remove(go.body); } catch { /* ignore */ } go.body = null; }
    if (ownedByComposite(entity)) return; // the composite collider on a parent owns this one
    if (cfg.shape !== 'box' && cfg.shape !== 'circle') { // arcade only has boxes and circles: use the bounding box of the real shape
      this.warnOnce(`collider shape '${cfg.shape}' needs physics.engine "matter" (Project ▸ Physics); arcade uses its bounding box`);
      const bb = boundsOfParts(entityParts(this.backend, entity, (x) => this.visualSize(x)));
      Object.assign(cfg, { shape: 'box', size: [bb.w, bb.h], offset: [bb.x, bb.y] });
    }
    const dynamic = cfg.mode !== 'static';
    go.setSize(cfg.size[0], cfg.size[1]);
    this.scene.physics.add.existing(go, !dynamic);
    const b = go.body;
    if (cfg.shape === 'circle') { b.setCircle(cfg.radius, cfg.offset[0] + cfg.size[0] / 2 - cfg.radius, cfg.offset[1] + cfg.size[1] / 2 - cfg.radius); }
    else { b.setSize(cfg.size[0], cfg.size[1], false); b.setOffset(cfg.offset[0], cfg.offset[1]); }
    if (dynamic) {
      b.setDrag(cfg.drag * 100, cfg.drag * 100).setBounce(cfg.bounce, cfg.bounce);
      b.setAllowGravity(cfg.mode === 'dynamic' && cfg.gravityScale !== 0);
      if (cfg.gravityScale !== 1) b.setGravity(0, (this.world.gravity.y) * (cfg.gravityScale - 1));
      if (cfg.mode === 'kinematic') b.setImmovable(true);
      if (cfg.maxVelocity) b.setMaxVelocity(cfg.maxVelocity[0], cfg.maxVelocity[1]);
      b.setMass(cfg.mass);
    }
    if (!cfg.hasCollider && cfg.mode === 'static') b.enable = false;
    this.bodies.set(entity, { go, mode: cfg.mode, trigger: cfg.trigger, cfg });
    go.__nordEntity = entity;
  }
  step(dt) {
    this.flushDirty();
    this.endInterpolate();
    const solids = [], trig = [], all = [];
    for (const [e, b] of this.bodies) {
      if (!b.go.body?.enable || !e.enabled) continue;
      all.push(b.go); (b.trigger ? trig : solids).push(b.go);
    }
    const hits = [], entityOf = (o) => o.__nordEntity, apart = (x, y) => !this.isIgnored(entityOf(x), entityOf(y));
    const frozen = [...this.bodies.values()].filter((b) => (b.cfg.freezeX || b.cfg.freezeY) && b.go.body);
    this.stepJoints('pre', dt);
    this.guard(dt);
    const keep = frozen.map((b) => [b.go.body, b.go.body.position.x, b.go.body.position.y, b.cfg]);
    this.world.update(0, dt * 1000); // fixedStep=false → exactly one preUpdate+step of `dt`
    if (solids.length) {
      this.world.collide(solids, solids, (x, y) => { const a = entityOf(x), b = entityOf(y); if (a && b) hits.push([a, b, false, { touching: { ...x.body.touching }, blocked: { ...x.body.blocked } }]); }, apart);
      for (const layer of this.layers) this.world.collide(solids, layer);
    }
    if (trig.length) this.world.overlap(trig, all, (x, y) => { const a = entityOf(x), b = entityOf(y); if (a && b && a !== b) hits.push([a, b, true, null]); }, (x, y) => x !== y && apart(x, y));
    for (const [body, px, py, c] of keep) { if (c.freezeX) { body.position.x = px; body.velocity.x = 0; } if (c.freezeY) { body.position.y = py; body.velocity.y = 0; } } // axis constraints
    this.world.postUpdate();
    this.stepJoints('post', dt);
    this.writeBack();
    this.snapshot();
    this.flush(hits);
  }
  body(e) { if (this.dirty.has(e)) this.flushDirty(); return this.bodies.get(e)?.go.body ?? null; }
  setVelocity(e, vx, vy) { const b = this.body(e); if (b) { if (vx !== null) b.velocity.x = vx; if (vy !== null) b.velocity.y = vy; } }
  velocity(e) { const b = this.body(e); return b ? [b.velocity.x, b.velocity.y] : [0, 0]; }
  applyImpulse(e, ix, iy) { const b = this.body(e); if (b) { b.velocity.x += ix / b.mass; b.velocity.y += iy / b.mass; } }
  isGrounded(e) { const b = this.body(e); return !!b && (b.blocked.down || b.touching.down); }
  setGravity(x, y) { this.world.gravity.set(x, y); }
  /** Things overlapping the box centred at (x, y) with size w×h (world px): entities with bodies, plus `{ tile: true }` markers for solid tilemap tiles. */
  overlapBox(x, y, w, h) {
    const out = [], l = x - w / 2, t = y - h / 2;
    this.flushDirty();
    for (const [e, b] of this.bodies) { const bd = b.go.body; if (bd && bd.enable !== false && bd.x < l + w && bd.x + bd.width > l && bd.y < t + h && bd.y + bd.height > t) out.push(e); }
    for (const layer of this.layers) for (const tile of layer.getTilesWithinWorldXY(l, t, w, h)) if (tile.collides) { out.push({ tile: true, getComponent: () => null, hasTag: () => false }); break; }
    return out;
  }
  enable(e, on) { const b = this.body(e); if (b) b.enable = on; }
  teleport(e, x, y) { const b = this.body(e); if (b) { b.reset(x, y); } }
  translate(e, dx, dy) { const b = this.body(e); if (b) { b.position.x += dx; b.position.y += dy; b.prev.x += dx; b.prev.y += dy; b.gameObject.x += dx; b.gameObject.y += dy; } }
}

/** Arcade has no rotation, so its joints are position-only: pins (hinge / fixed), springs and rods (spring / distance), sliders, and a pulling target. Use Matter for the rest. */
class ArcadeJoint {
  constructor(adapter, comp) { this.adapter = adapter; this.comp = comp; this.entity = comp.entity; this.built = false; this.alive = true; }
  get d() { return this.comp.data; }
  bodyOf(e) { return e ? this.adapter.bodies.get(e)?.go.body ?? null : null; }
  build() {
    const d = this.d, A = this.bodyOf(this.entity); if (!A) return false;
    let B = null, other = null;
    if (d.connectedBody) { other = this.entity.scene.findById(d.connectedBody) ?? this.entity.scene.find(d.connectedBody); B = this.bodyOf(other); if (!B) return false; }
    this.A = A; this.B = B; this.other = other;
    const a = d.anchor ?? [0, 0];
    this.pa = () => ({ x: A.center.x + a[0], y: A.center.y + a[1] });
    const c = d.connectedAnchor ?? [0, 0];
    const wa = this.pa();
    this.cb = B ? (d.autoConfigureConnectedAnchor !== false || !d.connectedAnchor ? { x: wa.x - B.center.x, y: wa.y - B.center.y } : { x: c[0], y: c[1] }) : wa;
    this.pb = () => (B ? { x: B.center.x + this.cb.x, y: B.center.y + this.cb.y } : this.cb);
    const wb = this.pb();
    this.rest = d.autoConfigureDistance !== false || !d.distance ? Math.hypot(wb.x - wa.x, wb.y - wa.y) : d.distance;
    if (d.kind === 'target') this.cb = (d.autoConfigureTarget !== false || !d.target) ? wa : { x: d.target[0], y: d.target[1] };
    this.built = true;
    if (!d.collideConnected && other) this.adapter.setIgnore(this.entity, other, true);
    return true;
  }
  setTarget(x, y) { this.cb = { x, y }; }
  pre() {}
  post(dt) {
    if (!this.built || !this.alive) return;
    const d = this.d, kind = d.kind ?? 'hinge', A = this.A, B = this.B, wa = this.pa(), wb = this.pb();
    const dx = wb.x - wa.x, dy = wb.y - wa.y, dist = Math.hypot(dx, dy) || 1e-6, nx = dx / dist, ny = dy / dist;
    const movable = (b) => b && !b.immovable && b.enable !== false;
    const ia = movable(A) ? 1 / A.mass : 0, ib = movable(B) ? 1 / B.mass : 0, sum = ia + ib;
    if (!sum && kind !== 'target') return;
    if (kind === 'hinge' || kind === 'fixed') this.pull(dist, nx, ny, 0, 1, ia, ib, sum, dt);
    else if (kind === 'distance') this.pull(dist, nx, ny, this.rest, 1, ia, ib, sum, dt, d.maxDistanceOnly);
    else if (kind === 'spring') { const k = Math.min(1, (2 * Math.PI * (d.frequency ?? 5) * dt) ** 2); this.pull(dist, nx, ny, this.rest, k, ia, ib, sum, dt, d.maxDistanceOnly); }
    else if (kind === 'target') { const t = this.cb, tx = t.x - wa.x, ty = t.y - wa.y, k = Math.min(1, (2 * Math.PI * (d.frequency ?? 5) * dt) ** 2); this.shift(A, tx * k, ty * k, dt); }
    this.last = dist;
  }
  /** Move A and B along the line so that their distance goes toward `want` (share by inverse mass, softness k 0..1). */
  pull(dist, nx, ny, want, k, ia, ib, sum, dt, onlyIfLonger = false) {
    let err = dist - want; if (onlyIfLonger && err < 0) return;
    err *= k;
    if (ia) this.shift(this.A, nx * err * ia / sum, ny * err * ia / sum, dt);
    if (ib) this.shift(this.B, -nx * err * ib / sum, -ny * err * ib / sum, dt);
  }
  shift(body, dx, dy, dt) { body.position.x += dx; body.position.y += dy; body.velocity.x += dx / dt * 0.5; body.velocity.y += dy / dt * 0.5; body.gameObject.x += dx; body.gameObject.y += dy; }
  destroy() { this.alive = false; if (this.built && this.other && !this.d.collideConnected) this.adapter.setIgnore(this.entity, this.other, false); }
}

export class MatterAdapter extends Base {
  kind = 'matter';
  constructor(backend, scene, settings) {
    super(backend, scene, settings);
    this.world = scene.matter.world;
    this.M = P().Physics.Matter.Matter;
    const g = settings.gravity ?? [0, 0, 0];
    this.world.engine.gravity.x = g[0] / 1000; this.world.engine.gravity.y = g[1] / 1000;
    this.world.autoUpdate = false;
    this.hits = []; this.groundFrame = new Map(); this.frame = 0;
    this.world.on('collisionactive', (ev) => this.#pairs(ev));
    this.world.on('collisionstart', (ev) => this.#pairs(ev));
    // Physics2D.IgnoreCollision / IgnoreLayerCollision: Matter has no per-pair switch (pair.isActive is read too late), so the detector drops the pair before it is solved
    const D = this.M.Detector;
    if (!D.__nordIgnore) { const orig = D.collisions; D.collisions = function (det) { const l = orig.call(this, det); return det.nordIgnore ? l.filter((c) => !det.nordIgnore(c.bodyA, c.bodyB)) : l; }; D.__nordIgnore = true; }
    this.world.engine.detector.nordIgnore = (a, b) => { const x = (a.parent ?? a).gameObject?.__nordEntity, y = (b.parent ?? b).gameObject?.__nordEntity; return !!x && !!y && this.isIgnored(x, y); };
  }
  makeJoint(comp) { return new MatterJoint(this, comp); }
  #pairs(ev) {
    for (const p of ev.pairs) {
      const pa = p.bodyA.parent ?? p.bodyA, pb = p.bodyB.parent ?? p.bodyB; // compound bodies report their parts
      const a = pa.gameObject?.__nordEntity, b = pb.gameObject?.__nordEntity;
      if (!a !== !b) { // contact with a non-entity body (tilemap): remember "ground below" for isGrounded()
        const me = a ?? b, mine = a ? pa : pb, other = a ? pb : pa;
        if (!p.bodyA.isSensor && !p.bodyB.isSensor && other.position.y > mine.position.y) this.groundFrame.set(me, this.frame);
      }
      if (a && b) this.hits.push([a, b, p.bodyA.isSensor || p.bodyB.isSensor, { normal: [p.collision?.normal?.x ?? 0, p.collision?.normal?.y ?? 0] }]);
    }
  }
  /** One Matter body for the whole collider: a single shape, or a compound of the convex parts (capsule, polygon, edge, composite, offsets). */
  #compound(x0, y0, parts) {
    const { Bodies, Body } = this.M, opt = { isStatic: false };
    const made = parts.map((p) => {
      switch (p.kind) {
        case 'circle': return Bodies.circle(x0 + p.x, y0 + p.y, p.r, opt);
        case 'capsule': return Bodies.rectangle(x0 + p.x, y0 + p.y, p.len + 2 * p.r, 2 * p.r, { ...opt, angle: p.angle, chamfer: { radius: p.r } });
        case 'segment': { const dx = p.bx - p.ax, dy = p.by - p.ay; return Bodies.rectangle(x0 + (p.ax + p.bx) / 2, y0 + (p.ay + p.by) / 2, Math.hypot(dx, dy) + 0.01, p.thick, { ...opt, angle: Math.atan2(dy, dx) }); }
        case 'poly': {
          const cx = p.pts.reduce((s, q) => s + q[0], 0) / p.pts.length, cy = p.pts.reduce((s, q) => s + q[1], 0) / p.pts.length;
          return Bodies.fromVertices(x0 + cx, y0 + cy, [p.pts.map((q) => ({ x: q[0] - cx, y: q[1] - cy }))], opt, false, 0.01, 0.1) || Bodies.circle(x0 + cx, y0 + cy, 1, opt);
        }
        default: return Bodies.rectangle(x0 + p.x, y0 + p.y, p.w, p.h, opt);
      }
    });
    const body = Body.create({ parts: made, ...opt }); // always a compound parent, so each part keeps its own angle and the parent starts at angle 0
    Body.setCentre(body, { x: x0, y: y0 }, false); // the pivot (and the container) stays at the entity origin, as in Unity
    return body;
  }
  create(entity) {
    const go = entity.native, cfg = this.cfg(entity), M = this.M, w = this.backend.world(entity), rotation = w.angle * Math.PI / 180, x0 = w.x, y0 = w.y;
    this.forget(entity);
    if (go.body) { this.scene.matter.world.remove(go.body); go.body = null; }
    if (ownedByComposite(entity)) return;
    go.setSize(cfg.size[0], cfg.size[1]);
    // the container gets Phaser's Matter methods once (add.gameObject with addToWorld = false), then every body is built here and attached with setExistingBody
    if (typeof go.setExistingBody !== 'function') this.scene.matter.add.gameObject(go, { shape: { type: 'circle', radius: 1 } }, false);
    const body = this.#compound(x0, y0, entityParts(this.backend, entity, (x) => this.visualSize(x)));
    go.setExistingBody(body, true);
    M.Body.setAngle(body, rotation);
    go.setPosition(x0, y0);
    go.setMass(cfg.mass).setFriction(cfg.friction).setBounce(cfg.bounce).setFrictionAir(cfg.drag * 0.05).setIgnoreGravity(cfg.mode !== 'dynamic' || cfg.gravityScale === 0);
    go.setStatic(cfg.mode === 'static' || cfg.mode === 'kinematic'); // after setMass: a static body has infinite mass
    for (const part of body.parts) { part.isSensor = cfg.trigger; part.friction = cfg.friction; part.restitution = cfg.bounce; }
    body.isSensor = cfg.trigger;
    if (cfg.fixedRotation) go.setFixedRotation();
    go.__nordEntity = entity;
    this.bodies.set(entity, { go, mode: cfg.mode, trigger: cfg.trigger, cfg });
  }
  step(dt) {
    this.flushDirty();
    this.endInterpolate();
    this.hits = []; this.frame++;
    for (const [e, b] of this.bodies) if (b.mode === 'kinematic' && b.go.body) this.#moveKinematic(e, b, dt);
    this.stepJoints('pre', dt);
    const M = this.M, frozen = [...this.bodies.values()].filter((b) => (b.cfg.freezeX || b.cfg.freezeY) && b.go.body && b.mode === 'dynamic');
    this.guard(dt);
    const keep = frozen.map((b) => [b.go.body, b.go.body.position.x, b.go.body.position.y, b.cfg]);
    this.world.step(dt * 1000);
    for (const [body, px, py, c] of keep) { // axis constraints: put the frozen axis back and stop moving along it
      M.Body.setPosition(body, { x: c.freezeX ? px : body.position.x, y: c.freezeY ? py : body.position.y });
      M.Body.setVelocity(body, { x: c.freezeX ? 0 : body.velocity.x, y: c.freezeY ? 0 : body.velocity.y });
    }
    this.stepJoints('post', dt);
    this.writeBack();
    this.snapshot();
    // 'collisionactive' only reports after the first step; de-dup within frame is handled by the pair key in flush()
    this.flush(this.hits);
  }
  rec(e) { if (this.dirty.has(e)) this.flushDirty(); return this.bodies.get(e); }
  #moveKinematic(e, b, dt) { const v = b.kv; if (v) b.go.setPosition(b.go.x + v[0] * dt, b.go.y + v[1] * dt); }
  body(e) { return this.rec(e)?.go.body ?? null; }
  /** Degrees per second (Matter keeps radians per step). */
  angularVelocity(e) { const b = this.rec(e); return b ? b.go.body.angularVelocity * 60 * 180 / Math.PI : 0; }
  setAngularVelocity(e, degPerSec) { const b = this.rec(e); if (b) this.M.Body.setAngularVelocity(b.go.body, degPerSec * Math.PI / 180 / 60); }
  setVelocity(e, vx, vy) {
    const b = this.rec(e); if (!b) return;
    if (b.mode === 'kinematic') { b.kv = [vx ?? b.kv?.[0] ?? 0, vy ?? b.kv?.[1] ?? 0]; return; }
    const cur = b.go.body.velocity;
    b.go.setVelocity(vx === null ? cur.x : vx / 60, vy === null ? cur.y : vy / 60);
  }
  velocity(e) { const b = this.rec(e); if (!b) return [0, 0]; if (b.mode === 'kinematic') return b.kv ?? [0, 0]; return [b.go.body.velocity.x * 60, b.go.body.velocity.y * 60]; }
  applyImpulse(e, ix, iy) { const b = this.rec(e); if (b && b.mode === 'dynamic') b.go.setVelocity(b.go.body.velocity.x + ix / b.cfg.mass / 60, b.go.body.velocity.y + iy / b.cfg.mass / 60); }
  isGrounded(e) {
    const b = this.rec(e); if (!b) return false;
    if (this.frame - (this.groundFrame.get(e) ?? -9) <= 1) return true;
    for (const p of this.touching.values()) if (!p.trigger && (p.a === e || p.b === e)) {
      const o = p.a === e ? p.b : p.a; const ob = this.bodies.get(o);
      if (ob && ob.go.y > b.go.y && Math.abs(ob.go.x - b.go.x) < (ob.cfg.size[0] + b.cfg.size[0]) / 2) return true;
    }
    return false;
  }
  setGravity(x, y) { this.world.engine.gravity.x = x / 1000; this.world.engine.gravity.y = y / 1000; }
  /** Entities whose bodies overlap the box centred at (x, y) with size w×h (world px). */
  overlapBox(x, y, w, h) {
    const out = [], l = x - w / 2, t = y - h / 2;
    for (const [e, b] of this.bodies) {
      const bd = b.go.body; if (!bd) continue;
      if (bd.bounds.max.x >= l && bd.bounds.min.x <= l + w && bd.bounds.max.y >= t && bd.bounds.min.y <= t + h) out.push(e);
    }
    return out;
  }
  enable(e, on) { const b = this.rec(e); if (b) b.go.body.isSensor = !on || b.trigger; }
  teleport(e, x, y) { const b = this.rec(e); if (b) b.go.setPosition(x, y); }
  translate(e, dx, dy) { const b = this.rec(e); if (b) this.M.Body.translate(b.go.body, { x: dx, y: dy }); } // keeps the velocity
}
