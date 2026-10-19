// Built-in behaviors (set A): Solid, Jumpthru, Platform, EightDirection, Bullet, Sine, Fade, Wrap, BoundToLayout, DestroyOutsideLayout.
import { Behavior, registerBehavior } from './index.js';
import { moveAndCollide, solidsOf, layoutSize, bbox, setOpacity } from './util.js';

const rad = Math.PI / 180;
const A = (type, def, extra) => ({ type, default: def, ...extra });
const ENABLED = { conditions: { 'is-enabled': { test: (b) => b.enabled } }, actions: { 'set-enabled': { params: ['state'], raw: ['state'], run: (b, p) => { b.enabled = p.state === 'enabled'; } } } };
const merge = (...o) => ({ conditions: Object.assign({}, ...o.map((x) => x.conditions)), actions: Object.assign({}, ...o.map((x) => x.actions)), expressions: Object.assign({}, ...o.map((x) => x.expressions)) });

/** Default controls read project input actions (left/right/up/down/jump) if defined, else arrow keys / Space. */
const FALLBACK = { left: ['ArrowLeft', 'KeyA'], right: ['ArrowRight', 'KeyD'], up: ['ArrowUp', 'KeyW'], down: ['ArrowDown', 'KeyS'], jump: ['ArrowUp', 'Space', 'KeyW'] };
function control(game, name) {
  const inp = game.input;
  return inp.actions[name] ? inp.down(name) : FALLBACK[name].some((c) => inp.key(c));
}

class Solid extends Behavior { static attributes = { tags: A('string', '') }; }
registerBehavior('Solid', Solid, ENABLED);
class Jumpthru extends Behavior {}
registerBehavior('Jumpthru', Jumpthru, ENABLED);

// ---------- Platform ----------
class Platform extends Behavior {
  static attributes = {
    maxSpeed: A('number', 330, { min: 0 }), acceleration: A('number', 1500, { min: 0 }), deceleration: A('number', 1500, { min: 0 }),
    jumpStrength: A('number', 650, { min: 0 }), gravity: A('number', 1500), maxFallSpeed: A('number', 1000, { min: 0 }),
    doubleJump: A('bool', false), defaultControls: A('bool', true),
  };
  vx = 0; vy = 0; onFloor = false; jumps = 0; sim = {}; _jumpPrev = false; _wasFloor = false;
  tick(dt) {
    const e = this.entity, p = this.props, g = this.game, s = this.sim; this.sim = {};
    const dc = p.defaultControls;
    const left = s.left || (dc && control(g, 'left')), right = s.right || (dc && control(g, 'right')), jump = s.jump || (dc && control(g, 'jump'));
    const dir = (right ? 1 : 0) - (left ? 1 : 0);
    if (dir) {
      const a = (Math.sign(this.vx) === -dir ? p.deceleration + p.acceleration : p.acceleration) * dt;
      this.vx = Math.max(-p.maxSpeed, Math.min(p.maxSpeed, this.vx + dir * a));
      this.facing = dir;
    } else if (this.vx) {
      const d = p.deceleration * dt;
      this.vx = Math.abs(this.vx) <= d ? 0 : this.vx - Math.sign(this.vx) * d;
    }
    if (jump && !this._jumpPrev && (this.onFloor || (p.doubleJump && this.jumps === 1))) {
      this.vy = -p.jumpStrength; this.jumps = this.onFloor ? 1 : 2; this.onFloor = false; this.fire('on-jump');
    }
    this._jumpPrev = !!jump;
    this.vy = Math.min(p.maxFallSpeed, this.vy + p.gravity * dt);
    const solids = solidsOf(this.scene, 'Solid', e), oneway = solidsOf(this.scene, 'Jumpthru', e);
    const hit = moveAndCollide(e, this.vx * dt, this.vy * dt, solids, oneway);
    if (hit.x) this.vx = 0;
    if (hit.y) { if (this.vy > 0) { this.onFloor = true; this.jumps = 0; } else this.fire('on-hit-ceiling'); this.vy = 0; } else if (this.vy !== 0) this.onFloor = false;
    if (this.onFloor && !this._wasFloor) this.fire('on-landed');
    this._wasFloor = this.onFloor;
  }
  get speed() { return Math.hypot(this.vx, this.vy); }
}
const trig = (id) => ({ trigger: true, test: (r, p, { sol, cond }) => { const e = r.firing.data.entity; if (!r.matches(e, cond.object)) return false; r.pick(sol, cond.object, [e]); return true; } });
registerBehavior('Platform', Platform, merge(ENABLED, {
  conditions: {
    'on-jump': trig(), 'on-landed': trig(), 'on-hit-ceiling': trig(),
    'is-on-floor': { test: (b) => b.onFloor }, 'is-jumping': { test: (b) => b.vy < 0 }, 'is-falling': { test: (b) => !b.onFloor && b.vy > 0 }, 'is-moving': { test: (b) => Math.abs(b.vx) > 1 },
  },
  actions: {
    'simulate-control': { params: ['control'], raw: ['control'], run: (b, p) => { b.sim[p.control] = true; } },
    'set-max-speed': { params: ['value'], run: (b, p) => { b.props.maxSpeed = p.value; } },
    'set-acceleration': { params: ['value'], run: (b, p) => { b.props.acceleration = p.value; } },
    'set-deceleration': { params: ['value'], run: (b, p) => { b.props.deceleration = p.value; } },
    'set-jump-strength': { params: ['value'], run: (b, p) => { b.props.jumpStrength = p.value; } },
    'set-gravity': { params: ['value'], run: (b, p) => { b.props.gravity = p.value; } },
    'set-max-fall-speed': { params: ['value'], run: (b, p) => { b.props.maxFallSpeed = p.value; } },
    'set-vector-x': { params: ['value'], run: (b, p) => { b.vx = p.value; } },
    'set-vector-y': { params: ['value'], run: (b, p) => { b.vy = p.value; } },
    'set-double-jump': { params: ['state'], raw: ['state'], run: (b, p) => { b.props.doubleJump = p.state === 'enabled'; } },
  },
  expressions: { Facing: (b) => b.facing ?? 1, Speed: (b) => b.speed, VectorX: (b) => b.vx, VectorY: (b) => b.vy, MaxSpeed: (b) => b.props.maxSpeed, JumpStrength: (b) => b.props.jumpStrength, Gravity: (b) => b.props.gravity },
}));

// ---------- 8 Direction ----------
class EightDirection extends Behavior {
  static attributes = { maxSpeed: A('number', 200, { min: 0 }), acceleration: A('number', 600, { min: 0 }), deceleration: A('number', 500, { min: 0 }), directions: A('enum', '8', { options: ['4', '8'] }), defaultControls: A('bool', true), setAngle: A('bool', false) };
  vx = 0; vy = 0; sim = {};
  tick(dt) {
    const e = this.entity, p = this.props, g = this.game, s = this.sim; this.sim = {};
    const dc = p.defaultControls;
    let ix = ((s.right || (dc && control(g, 'right'))) ? 1 : 0) - ((s.left || (dc && control(g, 'left'))) ? 1 : 0);
    let iy = ((s.down || (dc && control(g, 'down'))) ? 1 : 0) - ((s.up || (dc && control(g, 'up'))) ? 1 : 0);
    if (p.directions === '4' && ix && iy) iy = 0;
    const len = Math.hypot(ix, iy) || 1;
    const tx = (ix / len) * p.maxSpeed, ty = (iy / len) * p.maxSpeed;
    const step = (v, t) => { const a = (t === 0 ? p.deceleration : p.acceleration) * dt; return Math.abs(t - v) <= a ? t : v + Math.sign(t - v) * a; };
    this.vx = step(this.vx, tx); this.vy = step(this.vy, ty);
    const hit = moveAndCollide(e, this.vx * dt, this.vy * dt, solidsOf(this.scene, 'Solid', e));
    if (hit.x) this.vx = 0; if (hit.y) this.vy = 0;
    if (p.setAngle && (this.vx || this.vy)) e.rot = [e.rot[0], e.rot[1], Math.atan2(this.vy, this.vx) / rad];
  }
  get speed() { return Math.hypot(this.vx, this.vy); }
}
registerBehavior('EightDirection', EightDirection, merge(ENABLED, {
  conditions: { 'is-moving': { test: (b) => b.speed > 1 } },
  actions: {
    'simulate-control': { params: ['control'], raw: ['control'], run: (b, p) => { b.sim[p.control] = true; } },
    'set-max-speed': { params: ['value'], run: (b, p) => { b.props.maxSpeed = p.value; } },
    'set-acceleration': { params: ['value'], run: (b, p) => { b.props.acceleration = p.value; } },
    'set-deceleration': { params: ['value'], run: (b, p) => { b.props.deceleration = p.value; } },
    'set-vector-x': { params: ['value'], run: (b, p) => { b.vx = p.value; } },
    'set-vector-y': { params: ['value'], run: (b, p) => { b.vy = p.value; } },
    stop: { run: (b) => { b.vx = b.vy = 0; } },
  },
  expressions: { Speed: (b) => b.speed, VectorX: (b) => b.vx, VectorY: (b) => b.vy, MaxSpeed: (b) => b.props.maxSpeed },
}));

// ---------- Bullet ----------
class Bullet extends Behavior {
  static attributes = { speed: A('number', 400), acceleration: A('number', 0), gravity: A('number', 0), bounceOffSolids: A('bool', false), setAngle: A('bool', true), distanceTravelled: A('number', 0) };
  gy = 0; travelled = 0;
  init() { const a = (this.entity.rot[2] ?? 0) * rad; this.dir = [Math.cos(a), Math.sin(a)]; this.speed = this.props.speed; }
  tick(dt) {
    const e = this.entity, p = this.props;
    this.speed = Math.max(0, this.speed + p.acceleration * dt);
    this.gy += p.gravity * dt;
    const dx = this.dir[0] * this.speed * dt, dy = this.dir[1] * this.speed * dt + this.gy * dt;
    const hit = moveAndCollide(e, dx, dy, p.bounceOffSolids ? solidsOf(this.scene, 'Solid', e) : []);
    if (hit.x) { this.dir[0] = -this.dir[0]; } if (hit.y) { this.dir[1] = -this.dir[1]; this.gy = -this.gy; }
    this.travelled += Math.hypot(dx, dy);
    if (p.setAngle) e.rot = [e.rot[0], e.rot[1], Math.atan2(this.dir[1] * this.speed + this.gy, this.dir[0] * this.speed) / rad];
  }
  get angleOfMotion() { return Math.atan2(this.dir[1] * this.speed + this.gy, this.dir[0] * this.speed) / rad; }
}
registerBehavior('Bullet', Bullet, merge(ENABLED, {
  actions: {
    'set-speed': { params: ['value'], run: (b, p) => { b.speed = p.value; } },
    'set-acceleration': { params: ['value'], run: (b, p) => { b.props.acceleration = p.value; } },
    'set-gravity': { params: ['value'], run: (b, p) => { b.props.gravity = p.value; } },
    'set-angle-of-motion': { params: ['angle'], run: (b, p) => { b.dir = [Math.cos(p.angle * rad), Math.sin(p.angle * rad)]; b.gy = 0; } },
    'set-distance-travelled': { params: ['value'], run: (b, p) => { b.travelled = p.value; } },
    bounce: { run: (b) => { b.dir = [-b.dir[0], -b.dir[1]]; } },
  },
  expressions: { Speed: (b) => b.speed, Acceleration: (b) => b.props.acceleration, Gravity: (b) => b.props.gravity, AngleOfMotion: (b) => b.angleOfMotion, DistanceTravelled: (b) => b.travelled },
}));

// ---------- Sine ----------
const WAVES = {
  sine: (t) => Math.sin(t * 2 * Math.PI), triangle: (t) => 1 - 4 * Math.abs(((t + 0.25) % 1 + 1) % 1 - 0.5) , sawtooth: (t) => 2 * (((t % 1) + 1) % 1) - 1,
  'reverse-sawtooth': (t) => 1 - 2 * (((t % 1) + 1) % 1), square: (t) => (((t % 1) + 1) % 1 < 0.5 ? 1 : -1),
};
class Sine extends Behavior {
  static attributes = {
    movement: A('enum', 'horizontal', { options: ['horizontal', 'vertical', 'size', 'width', 'height', 'angle', 'opacity', 'value-only'] }),
    wave: A('enum', 'sine', { options: Object.keys(WAVES) }), period: A('number', 4, { min: 0.001 }), magnitude: A('number', 50), phase: A('number', 0), randomizePhase: A('bool', false),
  };
  value = 0;
  init() { this.t = ((this.props.phase) / 360) + (this.props.randomizePhase ? this.game.rng.next() : 0); this.base = null; }
  #read() {
    const e = this.entity;
    switch (this.props.movement) { case 'horizontal': return e.pos[0]; case 'vertical': return e.pos[1]; case 'size': return e.scale[0]; case 'width': return e.scale[0]; case 'height': return e.scale[1]; case 'angle': return e.rot[2]; case 'opacity': return e.opacity ?? 1; default: return 0; }
  }
  #write(v, delta) {
    const e = this.entity;
    switch (this.props.movement) {
      case 'horizontal': e.pos = [v, e.pos[1], e.pos[2]]; break;
      case 'vertical': e.pos = [e.pos[0], v, e.pos[2]]; break;
      case 'size': { const k = v / e.scale[0]; e.scale = [e.scale[0] * k, e.scale[1] * k, e.scale[2]]; break; }
      case 'width': e.scale = [v, e.scale[1], e.scale[2]]; break;
      case 'height': e.scale = [e.scale[0], v, e.scale[2]]; break;
      case 'angle': e.rot = [e.rot[0], e.rot[1], v]; break;
      case 'opacity': setOpacity(e, Math.min(1, Math.max(0, v))); break;
      default: break;
    }
  }
  tick(dt) {
    const p = this.props;
    this.t += dt / p.period;
    const w = WAVES[p.wave](this.t) * p.magnitude;
    if (p.movement === 'value-only') { this.value = w; return; }
    this.base ??= this.#read() - WAVES[p.wave](this.t - dt / p.period) * p.magnitude; // so the entity starts where it was placed
    this.value = w;
    this.#write(this.base + w);
  }
}
registerBehavior('Sine', Sine, merge(ENABLED, {
  actions: {
    'set-period': { params: ['value'], run: (b, p) => { b.props.period = Math.max(0.001, p.value); } },
    'set-magnitude': { params: ['value'], run: (b, p) => { b.props.magnitude = p.value; } },
    'set-phase': { params: ['degrees'], run: (b, p) => { b.t = p.degrees / 360; b.base = null; } },
    'set-movement': { params: ['movement'], raw: ['movement'], run: (b, p) => { b.props.movement = p.movement; b.base = null; } },
  },
  expressions: { Period: (b) => b.props.period, Magnitude: (b) => b.props.magnitude, Value: (b) => b.value, Phase: (b) => ((b.t % 1) * 360 + 360) % 360 },
}));

// ---------- Fade ----------
class Fade extends Behavior {
  static attributes = { fadeInTime: A('number', 0, { min: 0 }), waitTime: A('number', 0, { min: 0 }), fadeOutTime: A('number', 1, { min: 0 }), destroyOnFadeOut: A('bool', true), activeAtStart: A('bool', true) };
  init() { this.restart(); this.active = this.props.activeAtStart; }
  restart() { this.t = 0; this.active = true; }
  tick(dt) {
    if (!this.active) return;
    const p = this.props; this.t += dt;
    let a;
    if (this.t < p.fadeInTime) a = this.t / p.fadeInTime;
    else if (this.t < p.fadeInTime + p.waitTime) a = 1;
    else if (p.fadeOutTime > 0 && this.t < p.fadeInTime + p.waitTime + p.fadeOutTime) a = 1 - (this.t - p.fadeInTime - p.waitTime) / p.fadeOutTime;
    else { a = 0; this.active = false; if (p.destroyOnFadeOut) this.entity.destroy(); }
    setOpacity(this.entity, a);
  }
}
registerBehavior('Fade', Fade, merge(ENABLED, {
  actions: {
    'start-fade': { run: (b) => b.restart() },
    'set-fade-in-time': { params: ['value'], run: (b, p) => { b.props.fadeInTime = p.value; } },
    'set-wait-time': { params: ['value'], run: (b, p) => { b.props.waitTime = p.value; } },
    'set-fade-out-time': { params: ['value'], run: (b, p) => { b.props.fadeOutTime = p.value; } },
  },
  expressions: { FadeInTime: (b) => b.props.fadeInTime, WaitTime: (b) => b.props.waitTime, FadeOutTime: (b) => b.props.fadeOutTime },
}));

// ---------- Wrap / Bound to layout / Destroy outside layout ----------
class Wrap extends Behavior {
  static attributes = { mode: A('enum', 'layout', { options: ['layout'] }) };
  tick() {
    const e = this.entity, { w, h } = layoutSize(this.game, this.scene), b = bbox(e);
    let [x, y] = e.pos;
    if (b.r < 0) x += w + b.w; else if (b.l > w) x -= w + b.w;
    if (b.b < 0) y += h + b.h; else if (b.t > h) y -= h + b.h;
    if (x !== e.pos[0] || y !== e.pos[1]) e.pos = [x, y, e.pos[2]];
  }
}
registerBehavior('Wrap', Wrap, ENABLED);
class BoundToLayout extends Behavior {
  tick() {
    const e = this.entity, { w, h } = layoutSize(this.game, this.scene), b = bbox(e);
    let [x, y] = e.pos;
    if (b.l < 0) x -= b.l; else if (b.r > w) x -= b.r - w;
    if (b.t < 0) y -= b.t; else if (b.b > h) y -= b.b - h;
    if (x !== e.pos[0] || y !== e.pos[1]) e.pos = [x, y, e.pos[2]];
  }
}
registerBehavior('BoundToLayout', BoundToLayout, ENABLED);
class DestroyOutsideLayout extends Behavior {
  static attributes = { margin: A('number', 0) };
  tick() {
    const { w, h } = layoutSize(this.game, this.scene), b = bbox(this.entity), m = this.props.margin;
    if (b.r < -m || b.l > w + m || b.b < -m || b.t > h + m) this.entity.destroy();
  }
}
registerBehavior('DestroyOutsideLayout', DestroyOutsideLayout, ENABLED);
export { Platform, EightDirection, Bullet, Sine, Fade, Solid };
