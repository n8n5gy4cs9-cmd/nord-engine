// 2D physics adapters for Phaser: arcade and matter, behind one small API (`game.physics`).
// Both are stepped manually from the fixed-update loop so script fixedUpdate and physics stay in lockstep.
// Entities declare bodies with `rigidbody` + `collider` components (either may be absent). Colliders with trigger:true only overlap.
import { toLocal } from './transform.js';

const key = (a, b) => (a.id < b.id ? `${a.id}|${b.id}` : `${b.id}|${a.id}`);

class Base {
  constructor(backend, scene, settings) {
    this.backend = backend; this.scene = scene; this.settings = settings;
    this.bodies = new Map();            // entity → { go, mode, trigger, cfg }
    this.touching = new Map();          // pair key → { a, b, trigger, seen }
    this.layers = [];                   // collidable tilemap layers
    this.dirty = new Set();             // entities whose body must be (re)built — components arrive one at a time
  }
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
      fixedRotation: rb?.fixedRotation ?? true, maxVelocity: rb?.maxVelocity ?? null, friction: rb?.friction ?? 0.1,
      shape: col?.shape ?? 'box', size, radius: col?.radius ?? Math.max(size[0], size[1]) / 2, offset: col?.offset ?? [0, 0], trigger: !!col?.trigger, hasCollider: !!col,
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
  create(entity) {
    const go = entity.native, cfg = this.cfg(entity);
    this.forget(entity);
    if (go.body) { try { this.world.remove(go.body); } catch { /* ignore */ } go.body = null; }
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
    const solids = [], trig = [], all = [];
    for (const [e, b] of this.bodies) {
      if (!b.go.body?.enable || !e.enabled) continue;
      all.push(b.go); (b.trigger ? trig : solids).push(b.go);
    }
    this.world.update(0, dt * 1000); // fixedStep=false → exactly one preUpdate+step of `dt`
    const hits = [];
    const entityOf = (o) => o.__nordEntity;
    if (solids.length) {
      this.world.collide(solids, solids, (x, y) => { const a = entityOf(x), b = entityOf(y); if (a && b) hits.push([a, b, false, { touching: { ...x.body.touching }, blocked: { ...x.body.blocked } }]); });
      for (const layer of this.layers) this.world.collide(solids, layer);
    }
    if (trig.length) this.world.overlap(trig, all, (x, y) => { const a = entityOf(x), b = entityOf(y); if (a && b && a !== b) hits.push([a, b, true, null]); });
    this.world.postUpdate();
    this.writeBack();
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
}

export class MatterAdapter extends Base {
  kind = 'matter';
  constructor(backend, scene, settings) {
    super(backend, scene, settings);
    this.world = scene.matter.world;
    const g = settings.gravity ?? [0, 0, 0];
    this.world.engine.gravity.x = g[0] / 1000; this.world.engine.gravity.y = g[1] / 1000;
    this.world.autoUpdate = false;
    this.hits = []; this.groundFrame = new Map(); this.frame = 0;
    this.world.on('collisionactive', (ev) => this.#pairs(ev));
    this.world.on('collisionstart', (ev) => this.#pairs(ev));
  }
  #pairs(ev) {
    for (const p of ev.pairs) {
      const a = p.bodyA.gameObject?.__nordEntity, b = p.bodyB.gameObject?.__nordEntity;
      if (!a !== !b) { // contact with a non-entity body (tilemap): remember "ground below" for isGrounded()
        const me = a ?? b, mine = a ? p.bodyA : p.bodyB, other = a ? p.bodyB : p.bodyA;
        if (!p.bodyA.isSensor && !p.bodyB.isSensor && other.position.y > mine.position.y) this.groundFrame.set(me, this.frame);
      }
      if (a && b) this.hits.push([a, b, p.bodyA.isSensor || p.bodyB.isSensor, { normal: [p.collision?.normal?.x ?? 0, p.collision?.normal?.y ?? 0] }]);
    }
  }
  create(entity) {
    const go = entity.native, cfg = this.cfg(entity);
    this.forget(entity);
    if (go.body) { this.scene.matter.world.remove(go.body); go.body = null; }
    go.setSize(cfg.size[0], cfg.size[1]);
    const shape = cfg.shape === 'circle' ? { type: 'circle', radius: cfg.radius } : { type: 'rectangle', width: cfg.size[0], height: cfg.size[1] };
    this.scene.matter.add.gameObject(go, {
      shape, isStatic: cfg.mode === 'static' || cfg.mode === 'kinematic', isSensor: cfg.trigger, mass: cfg.mass,
      frictionAir: cfg.drag * 0.05, restitution: cfg.bounce, friction: cfg.friction, ignoreGravity: cfg.mode !== 'dynamic' || cfg.gravityScale === 0,
    });
    if (cfg.fixedRotation) go.setFixedRotation();
    go.__nordEntity = entity;
    this.bodies.set(entity, { go, mode: cfg.mode, trigger: cfg.trigger, cfg });
  }
  step(dt) {
    this.flushDirty();
    this.hits = []; this.frame++;
    for (const [e, b] of this.bodies) if (b.mode === 'kinematic' && b.go.body) this.#moveKinematic(e, b, dt);
    this.world.step(dt * 1000);
    this.writeBack();
    // 'collisionactive' only reports after the first step; de-dup within frame is handled by the pair key in flush()
    this.flush(this.hits);
  }
  rec(e) { if (this.dirty.has(e)) this.flushDirty(); return this.bodies.get(e); }
  #moveKinematic(e, b, dt) { const v = b.kv; if (v) b.go.setPosition(b.go.x + v[0] * dt, b.go.y + v[1] * dt); }
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
}
