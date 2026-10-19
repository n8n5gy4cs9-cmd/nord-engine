// Built-in behaviors (set B): Pin, DragDrop, Anchor, Car, Orbit, Rotate, Flash, Timer, Tween, Turret, LineOfSight, Pathfinding, Physics, ScrollTo, Persist.
import { Behavior, registerBehavior } from './index.js';
import { bbox, solidsOf, layoutSize, setOpacity, overlaps, isType } from './util.js';
import { ease } from '../util.js';

const rad = Math.PI / 180, deg = 180 / Math.PI;
const A = (type, def, extra) => ({ type, default: def, ...extra });
const ENABLED = { conditions: { 'is-enabled': { test: (b) => b.enabled } }, actions: { 'set-enabled': { params: ['state'], raw: ['state'], run: (b, p) => { b.enabled = p.state === 'enabled'; } } } };
const merge = (...o) => ({ conditions: Object.assign({}, ...o.map((x) => x.conditions)), actions: Object.assign({}, ...o.map((x) => x.actions)), expressions: Object.assign({}, ...o.map((x) => x.expressions)) });
/** Trigger that picks the firing entity; `extra(data, p)` can veto (e.g. timer tag). */
const trig = (extra, params = []) => ({
  params, raw: params, trigger: true,
  test: (r, p, { sol, cond }) => { const d = r.firing.data; if (!r.matches(d.entity, cond.object) || (extra && !extra(d, p))) return false; r.pick(sol, cond.object, [d.entity]); return true; },
});
/** First instance of object type `name` from the current SOL (for actions taking an "object" parameter). */
const target = (r, name, skip) => r.picked(name, r.solView ?? new Map()).find((e) => e !== skip) ?? null;
const setAngle = (e, a) => { e.rot = [e.rot[0], e.rot[1], a]; };
const norm = (a) => ((a % 360) + 540) % 360 - 180;
const control = (game, name, alt) => { const i = game.input; return i.actions[name] ? i.down(name) : alt.some((c) => i.key(c)); };

// ---------- Pin ----------
class Pin extends Behavior {
  static attributes = {};
  pinTo(t, mode = 'position') { this.t = t; this.mode = mode; this.dx = this.entity.pos[0] - t.pos[0]; this.dy = this.entity.pos[1] - t.pos[1]; this.a0 = t.rot[2]; this.ea0 = this.entity.rot[2]; this.d = Math.hypot(this.dx, this.dy); this.ang = Math.atan2(this.dy, this.dx); }
  tick() {
    const t = this.t; if (!t) return;
    if (t.destroyed) { this.t = null; return; }
    const e = this.entity;
    if (this.mode === 'position') e.pos = [t.pos[0] + this.dx, t.pos[1] + this.dy, e.pos[2]];
    else { const da = (t.rot[2] - this.a0) * rad; e.pos = [t.pos[0] + this.d * Math.cos(this.ang + da), t.pos[1] + this.d * Math.sin(this.ang + da), e.pos[2]]; setAngle(e, this.ea0 + (t.rot[2] - this.a0)); }
  }
}
registerBehavior('Pin', Pin, merge(ENABLED, {
  conditions: { 'is-pinned': { test: (b) => !!b.t } },
  actions: {
    'pin-to-object': { params: ['object', 'mode'], raw: ['object', 'mode'], run: (b, p, r) => { const t = target(r, p.object, b.entity); if (t) b.pinTo(t, p.mode ?? 'position'); } },
    unpin: { run: (b) => { b.t = null; } },
  },
}));

// ---------- Drag & Drop ----------
class DragDrop extends Behavior {
  static attributes = { axes: A('enum', 'both', { options: ['both', 'horizontal', 'vertical'] }) };
  dragging = false; _down = false;
  tick() {
    const ptr = this.game.input.pointer, e = this.entity, b = bbox(e);
    const inside = ptr.worldX >= b.l && ptr.worldX <= b.r && ptr.worldY >= b.t && ptr.worldY <= b.b;
    if (ptr.down && !this._down && inside && !this.game.scene._dragTaken) { this.dragging = true; this.ox = e.pos[0] - ptr.worldX; this.oy = e.pos[1] - ptr.worldY; this.game.scene._dragTaken = this; this.fire('on-drag-start'); }
    if (this.dragging) {
      if (ptr.down) e.pos = [this.props.axes === 'vertical' ? e.pos[0] : ptr.worldX + this.ox, this.props.axes === 'horizontal' ? e.pos[1] : ptr.worldY + this.oy, e.pos[2]];
      else { this.dragging = false; this.game.scene._dragTaken = null; this.fire('on-drop'); }
    }
    this._down = ptr.down;
  }
}
registerBehavior('DragDrop', DragDrop, merge(ENABLED, {
  conditions: { 'on-drag-start': trig(), 'on-drop': trig(), 'is-dragging': { test: (b) => b.dragging } },
  actions: { drop: { run: (b) => { if (b.dragging) { b.dragging = false; b.game.scene._dragTaken = null; b.fire('on-drop'); } } }, 'set-axes': { params: ['axes'], raw: ['axes'], run: (b, p) => { b.props.axes = p.axes; } } },
}));

// ---------- Anchor (keep distance to the edges of the layout view) ----------
class Anchor extends Behavior {
  static attributes = { left: A('bool', false), right: A('bool', false), top: A('bool', false), bottom: A('bool', false) };
  tick() {
    const e = this.entity, p = this.props, v = this.scene.backend?.viewRect?.() ?? { x: 0, y: 0, ...layoutSize(this.game, this.scene) };
    const vr = { l: v.x, t: v.y, r: v.x + v.w, b: v.y + v.h };
    this.d ??= { l: e.pos[0] - vr.l, r: vr.r - e.pos[0], t: e.pos[1] - vr.t, b: vr.b - e.pos[1] };
    let [x, y] = e.pos;
    if (p.right && !p.left) x = vr.r - this.d.r; else if (p.left) x = vr.l + this.d.l;
    if (p.bottom && !p.top) y = vr.b - this.d.b; else if (p.top) y = vr.t + this.d.t;
    if (x !== e.pos[0] || y !== e.pos[1]) e.pos = [x, y, e.pos[2]];
  }
}
registerBehavior('Anchor', Anchor, ENABLED);

// ---------- Car (top-down) ----------
class Car extends Behavior {
  static attributes = { maxSpeed: A('number', 200), acceleration: A('number', 100), deceleration: A('number', 50), steerSpeed: A('number', 120), driftRecover: A('number', 5), friction: A('number', 0), defaultControls: A('bool', true) };
  vx = 0; vy = 0; sim = {};
  get speed() { return Math.hypot(this.vx, this.vy); }
  tick(dt) {
    const e = this.entity, p = this.props, s = this.sim, g = this.game; this.sim = {};
    const dc = p.defaultControls;
    const up = s.accelerate || (dc && control(g, 'up', ['ArrowUp', 'KeyW'])), down = s.brake || (dc && control(g, 'down', ['ArrowDown', 'KeyS']));
    const l = s.left || (dc && control(g, 'left', ['ArrowLeft', 'KeyA'])), rt = s.right || (dc && control(g, 'right', ['ArrowRight', 'KeyD']));
    const a = e.rot[2] * rad, fx = Math.cos(a), fy = Math.sin(a);
    let fwd = this.vx * fx + this.vy * fy, side = -this.vx * fy + this.vy * fx; // velocity in car space
    if (up) fwd += p.acceleration * dt; else if (down) fwd -= p.acceleration * dt * 1.5;
    else fwd = Math.abs(fwd) <= p.deceleration * dt ? 0 : fwd - Math.sign(fwd) * p.deceleration * dt;
    fwd = Math.max(-p.maxSpeed / 2, Math.min(p.maxSpeed, fwd));
    side *= Math.max(0, 1 - p.driftRecover * dt); // sideways slip bleeds off
    const steer = ((rt ? 1 : 0) - (l ? 1 : 0)) * p.steerSpeed * Math.min(1, Math.abs(fwd) / 60) * Math.sign(fwd || 1);
    setAngle(e, e.rot[2] + steer * dt);
    const a2 = e.rot[2] * rad;
    this.vx = fwd * Math.cos(a2) - side * Math.sin(a2); this.vy = fwd * Math.sin(a2) + side * Math.cos(a2);
    const hit = solidsOf(this.scene, 'Solid', e);
    const ox = e.pos[0], oy = e.pos[1];
    e.pos = [ox + this.vx * dt, oy + this.vy * dt, e.pos[2]];
    if (hit.some((o) => overlaps(e, o))) { e.pos = [ox, oy, e.pos[2]]; this.vx = this.vy = 0; }
  }
}
registerBehavior('Car', Car, merge(ENABLED, {
  actions: {
    'simulate-control': { params: ['control'], raw: ['control'], run: (b, p) => { b.sim[p.control] = true; } },
    'set-max-speed': { params: ['value'], run: (b, p) => { b.props.maxSpeed = p.value; } },
    'set-acceleration': { params: ['value'], run: (b, p) => { b.props.acceleration = p.value; } },
    'set-steer-speed': { params: ['value'], run: (b, p) => { b.props.steerSpeed = p.value; } },
    stop: { run: (b) => { b.vx = b.vy = 0; } },
  },
  expressions: { Speed: (b) => b.speed, VectorX: (b) => b.vx, VectorY: (b) => b.vy, MaxSpeed: (b) => b.props.maxSpeed },
}));

// ---------- Orbit ----------
class Orbit extends Behavior {
  static attributes = { speed: A('number', 90), acceleration: A('number', 0), primaryRadius: A('number', 100), secondaryRadius: A('number', 100), offsetAngle: A('number', 0), matchRotation: A('bool', false) };
  init() { this.angle = this.props.offsetAngle; this.sp = this.props.speed; this.cx = null; }
  tick(dt) {
    const e = this.entity, p = this.props;
    if (this.cx === null) { const a = this.angle * rad; this.cx = e.pos[0] - Math.cos(a) * p.primaryRadius; this.cy = e.pos[1] - Math.sin(a) * p.secondaryRadius; }
    this.sp += p.acceleration * dt; this.angle += this.sp * dt;
    const a = this.angle * rad;
    e.pos = [this.cx + Math.cos(a) * p.primaryRadius, this.cy + Math.sin(a) * p.secondaryRadius, e.pos[2]];
    if (p.matchRotation) setAngle(e, this.angle);
  }
}
registerBehavior('Orbit', Orbit, merge(ENABLED, {
  actions: {
    'set-speed': { params: ['value'], run: (b, p) => { b.sp = p.value; } }, 'set-primary-radius': { params: ['value'], run: (b, p) => { b.props.primaryRadius = p.value; } },
    'set-secondary-radius': { params: ['value'], run: (b, p) => { b.props.secondaryRadius = p.value; } }, 'set-center': { params: ['x', 'y'], run: (b, p) => { b.cx = p.x; b.cy = p.y; } },
  },
  expressions: { Speed: (b) => b.sp, PrimaryRadius: (b) => b.props.primaryRadius, SecondaryRadius: (b) => b.props.secondaryRadius, Angle: (b) => b.angle },
}));

// ---------- Rotate ----------
class Rotate extends Behavior {
  static attributes = { speed: A('number', 180), acceleration: A('number', 0) };
  init() { this.sp = this.props.speed; }
  tick(dt) { this.sp += this.props.acceleration * dt; setAngle(this.entity, this.entity.rot[2] + this.sp * dt); }
}
registerBehavior('Rotate', Rotate, merge(ENABLED, {
  actions: { 'set-speed': { params: ['value'], run: (b, p) => { b.sp = p.value; } }, 'set-acceleration': { params: ['value'], run: (b, p) => { b.props.acceleration = p.value; } } },
  expressions: { Speed: (b) => b.sp, Acceleration: (b) => b.props.acceleration },
}));

// ---------- Flash ----------
class Flash extends Behavior {
  t = 0; total = 0; on = 0; off = 0; active = false;
  tick(dt) {
    if (!this.active) return;
    this.t += dt;
    if (this.t >= this.total) { this.active = false; setOpacity(this.entity, 1); this.fire('on-flash-ended'); return; }
    setOpacity(this.entity, (this.t % (this.on + this.off)) < this.on ? 1 : 0);
  }
}
registerBehavior('Flash', Flash, merge(ENABLED, {
  conditions: { 'on-flash-ended': trig(), 'is-flashing': { test: (b) => b.active } },
  actions: { flash: { params: ['on', 'off', 'duration'], run: (b, p) => { b.on = p.on; b.off = p.off; b.total = p.duration; b.t = 0; b.active = true; } }, stop: { run: (b) => { b.active = false; setOpacity(b.entity, 1); } } },
}));

// ---------- Timer ----------
class Timer extends Behavior {
  timers = new Map();
  tick(dt) {
    for (const [tag, t] of [...this.timers]) {
      if (t.paused) continue;
      t.cur += dt; t.total += dt;
      if (t.cur >= t.dur) {
        this.fire('on-timer', { tag });
        if (this.timers.get(tag) !== t) continue;
        if (t.regular) t.cur -= t.dur; else this.timers.delete(tag);
      }
    }
  }
  fire(id, extra) { this.scene.eventSheet?.fire(`Behavior.Timer.${id}`, { entity: this.entity, ...extra }); }
}
registerBehavior('Timer', Timer, merge(ENABLED, {
  conditions: { 'on-timer': trig((d, p) => d.tag === p.tag, ['tag']), 'is-timer-running': { params: ['tag'], raw: ['tag'], test: (b, p) => b.timers.has(p.tag) } },
  actions: {
    'start-timer': { params: ['duration', 'type', 'tag'], raw: ['type', 'tag'], run: (b, p) => { b.timers.set(p.tag, { dur: p.duration, cur: 0, total: 0, regular: p.type === 'regular' }); } },
    'stop-timer': { params: ['tag'], raw: ['tag'], run: (b, p) => { b.timers.delete(p.tag); } },
    'pause-timer': { params: ['tag'], raw: ['tag'], run: (b, p) => { const t = b.timers.get(p.tag); if (t) t.paused = true; } },
    'resume-timer': { params: ['tag'], raw: ['tag'], run: (b, p) => { const t = b.timers.get(p.tag); if (t) t.paused = false; } },
  },
  expressions: {}, // CurrentTime/TotalTime/Duration need the tag argument → handled via method-style access below
}));
const timerExpr = (f) => (b, a) => f(b.timers.get(a?.[0]) ?? { cur: 0, total: 0, dur: 0 });

// ---------- Tween ----------
const PROPS = {
  x: [(e) => e.pos[0], (e, v) => { e.pos = [v, e.pos[1], e.pos[2]]; }], y: [(e) => e.pos[1], (e, v) => { e.pos = [e.pos[0], v, e.pos[2]]; }],
  angle: [(e) => e.rot[2], setAngle], width: [(e) => e.scale[0], (e, v) => { e.scale = [v, e.scale[1], e.scale[2]]; }], height: [(e) => e.scale[1], (e, v) => { e.scale = [e.scale[0], v, e.scale[2]]; }],
  size: [(e) => e.scale[0], (e, v) => { e.scale = [v, v, e.scale[2]]; }], opacity: [(e) => e.opacity ?? 1, setOpacity],
};
class Tween extends Behavior {
  tweens = new Map();
  start(tag, prop, end, time, easing = 'linear') {
    const [get] = PROPS[prop] ?? (() => { throw new Error(`Tween: unknown property '${prop}'`); })();
    this.tweens.set(tag, { prop, from: get(this.entity), to: end, t: 0, dur: Math.max(1e-6, time), fn: ease[easing] ?? ease.linear, value: get(this.entity) });
  }
  tick(dt) {
    for (const [tag, tw] of [...this.tweens]) {
      tw.t += dt;
      const k = Math.min(1, tw.t / tw.dur);
      tw.value = tw.from + (tw.to - tw.from) * tw.fn(k);
      PROPS[tw.prop][1](this.entity, tw.value);
      if (k >= 1) { this.tweens.delete(tag); this.scene.eventSheet?.fire('Behavior.Tween.on-tween-finished', { entity: this.entity, tag }); }
    }
  }
}
registerBehavior('Tween', Tween, merge(ENABLED, {
  conditions: { 'on-tween-finished': trig((d, p) => d.tag === p.tag, ['tag']), 'is-playing': { params: ['tag'], raw: ['tag'], test: (b, p) => b.tweens.has(p.tag) } },
  actions: {
    'tween-property': { params: ['tag', 'property', 'end', 'time', 'ease'], raw: ['tag', 'property', 'ease'], run: (b, p) => b.start(p.tag, p.property, p.end, p.time, p.ease) },
    'tween-position': { params: ['tag', 'x', 'y', 'time', 'ease'], raw: ['tag', 'ease'], run: (b, p) => { b.start(`${p.tag}`, 'x', p.x, p.time, p.ease); b.start(`${p.tag}:y`, 'y', p.y, p.time, p.ease); } },
    'stop-tween': { params: ['tag'], raw: ['tag'], run: (b, p) => { b.tweens.delete(p.tag); } },
  },
  expressions: { Value: (b, a) => b.tweens.get(a?.[0])?.value ?? 0 },
}));

// ---------- Turret ----------
class Turret extends Behavior {
  static attributes = { targetType: A('string', ''), range: A('number', 300), rotateSpeed: A('number', 180), rateOfFire: A('number', 2), autoShoot: A('bool', true), requireLineOfSight: A('bool', true) };
  cool = 0; target = null;
  tick(dt) {
    const e = this.entity, p = this.props;
    this.cool -= dt;
    if (!p.targetType) return;
    let best = null, bd = p.range;
    for (const t of this.scene.all()) {
      if (t === e || !isType(this.scene, t, p.targetType)) continue;
      const d = Math.hypot(t.pos[0] - e.pos[0], t.pos[1] - e.pos[1]);
      if (d < bd && (!p.requireLineOfSight || clearRay(this.scene, e, t))) { best = t; bd = d; }
    }
    if (best !== this.target && best) this.fire('on-target-acquired');
    this.target = best;
    if (!best) return;
    const want = Math.atan2(best.pos[1] - e.pos[1], best.pos[0] - e.pos[0]) * deg;
    const diff = norm(want - e.rot[2]), step = p.rotateSpeed * dt;
    setAngle(e, Math.abs(diff) <= step ? want : e.rot[2] + Math.sign(diff) * step);
    if (p.autoShoot && Math.abs(norm(want - e.rot[2])) < 3 && this.cool <= 0 && p.rateOfFire > 0) { this.cool = 1 / p.rateOfFire; this.fire('on-shoot'); }
  }
}
registerBehavior('Turret', Turret, merge(ENABLED, {
  conditions: { 'on-shoot': trig(), 'on-target-acquired': trig(), 'has-target': { test: (b) => !!b.target } },
  actions: {
    shoot: { run: (b) => { if (b.cool <= 0) { b.cool = 1 / Math.max(1e-6, b.props.rateOfFire); b.fire('on-shoot'); } } },
    'set-target-type': { params: ['object'], raw: ['object'], run: (b, p) => { b.props.targetType = p.object; } },
    'set-range': { params: ['value'], run: (b, p) => { b.props.range = p.value; } }, 'set-rate-of-fire': { params: ['value'], run: (b, p) => { b.props.rateOfFire = p.value; } },
  },
  expressions: { Range: (b) => b.props.range, RateOfFire: (b) => b.props.rateOfFire, TargetX: (b) => b.target?.pos[0] ?? 0, TargetY: (b) => b.target?.pos[1] ?? 0 },
}));

// ---------- Line of Sight ----------
function segHitsBox(x1, y1, x2, y2, o) { // Liang–Barsky
  let t0 = 0, t1 = 1; const dx = x2 - x1, dy = y2 - y1;
  for (const [p, q] of [[-dx, x1 - o.l], [dx, o.r - x1], [-dy, y1 - o.t], [dy, o.b - y1]]) {
    if (p === 0) { if (q < 0) return false; } else { const t = q / p; if (p < 0) { if (t > t1) return false; t0 = Math.max(t0, t); } else { if (t < t0) return false; t1 = Math.min(t1, t); } }
  }
  return true;
}
const clearRay = (scene, a, b, type = 'Solid') => !solidsOf(scene, type, a).some((s) => s !== b && segHitsBox(a.pos[0], a.pos[1], b.pos[0], b.pos[1], bbox(s)));
class LineOfSight extends Behavior {
  static attributes = { range: A('number', 300), coneOfView: A('number', 360), obstacleType: A('string', 'Solid') };
  canSee(t) {
    const e = this.entity, p = this.props, d = Math.hypot(t.pos[0] - e.pos[0], t.pos[1] - e.pos[1]);
    if (d > p.range) return false;
    if (p.coneOfView < 360 && Math.abs(norm(Math.atan2(t.pos[1] - e.pos[1], t.pos[0] - e.pos[0]) * deg - e.rot[2])) > p.coneOfView / 2) return false;
    return clearRay(this.scene, e, t, p.obstacleType);
  }
}
registerBehavior('LineOfSight', LineOfSight, merge(ENABLED, {
  conditions: {
    'has-line-of-sight-to': { params: ['object'], raw: ['object'], test: (b, p, r) => { const vis = r.picked(p.object, r.solView).filter((t) => t !== b.entity && b.canSee(t)); r.pick(r.solView, p.object, vis); return vis.length > 0; } },
  },
  actions: { 'set-range': { params: ['value'], run: (b, p) => { b.props.range = p.value; } }, 'set-cone': { params: ['degrees'], run: (b, p) => { b.props.coneOfView = p.degrees; } } },
  expressions: { Range: (b) => b.props.range, ConeOfView: (b) => b.props.coneOfView },
}));

// ---------- Pathfinding (grid A*) ----------
function astar(grid, cols, rows, sx, sy, gx, gy, diag) {
  const idx = (x, y) => y * cols + x, open = [{ x: sx, y: sy, g: 0, f: 0 }], best = new Map([[idx(sx, sy), 0]]), from = new Map();
  const h = (x, y) => (diag ? Math.max(Math.abs(x - gx), Math.abs(y - gy)) : Math.abs(x - gx) + Math.abs(y - gy));
  const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1], ...(diag ? [[1, 1], [1, -1], [-1, 1], [-1, -1]] : [])];
  while (open.length) {
    open.sort((a, b) => a.f - b.f); const c = open.shift();
    if (c.x === gx && c.y === gy) { const out = [[gx, gy]]; let k = idx(gx, gy); while (from.has(k)) { k = from.get(k); out.push([k % cols, Math.floor(k / cols)]); } return out.reverse(); }
    if (c.g > best.get(idx(c.x, c.y))) continue;
    for (const [dx, dy] of dirs) {
      const nx = c.x + dx, ny = c.y + dy;
      if (nx < 0 || ny < 0 || nx >= cols || ny >= rows || grid[idx(nx, ny)]) continue;
      if (dx && dy && (grid[idx(c.x + dx, c.y)] || grid[idx(c.x, c.y + dy)])) continue; // no corner cutting
      const g = c.g + (dx && dy ? 1.4142 : 1);
      if (g < (best.get(idx(nx, ny)) ?? Infinity)) { best.set(idx(nx, ny), g); from.set(idx(nx, ny), idx(c.x, c.y)); open.push({ x: nx, y: ny, g, f: g + h(nx, ny) }); }
    }
  }
  return null;
}
class Pathfinding extends Behavior {
  static attributes = { cellSize: A('number', 32, { min: 4 }), diagonals: A('bool', true), maxSpeed: A('number', 200), obstacleType: A('string', 'Solid'), moving: A('bool', true) };
  path = []; i = 0; moving = false;
  findPath(x, y) {
    const e = this.entity, p = this.props, { w, h } = layoutSize(this.game, this.scene), cs = p.cellSize, cols = Math.ceil(w / cs), rows = Math.ceil(h / cs);
    const me = bbox(e), hw = me.w / 2 - 1, hh = me.h / 2 - 1, grid = new Uint8Array(cols * rows);
    for (const s of solidsOf(this.scene, p.obstacleType, e)) {
      const o = bbox(s);
      for (let cy = Math.max(0, Math.floor((o.t - hh) / cs)); cy <= Math.min(rows - 1, Math.floor((o.b + hh) / cs)); cy++) {
        for (let cx = Math.max(0, Math.floor((o.l - hw) / cs)); cx <= Math.min(cols - 1, Math.floor((o.r + hw) / cs)); cx++) {
          const ccx = (cx + 0.5) * cs, ccy = (cy + 0.5) * cs;
          if (ccx > o.l - hw && ccx < o.r + hw && ccy > o.t - hh && ccy < o.b + hh) grid[cy * cols + cx] = 1;
        }
      }
    }
    const cl = (v, n) => Math.min(n - 1, Math.max(0, Math.floor(v / cs)));
    const sx = cl(e.pos[0], cols), sy = cl(e.pos[1], rows), gx = cl(x, cols), gy = cl(y, rows);
    grid[sy * cols + sx] = 0;
    if (grid[gy * cols + gx]) { this.path = []; this.fire('on-failed'); return false; }
    const cells = astar(grid, cols, rows, sx, sy, gx, gy, p.diagonals);
    if (!cells) { this.path = []; this.fire('on-failed'); return false; }
    this.path = cells.map(([cx, cy]) => [(cx + 0.5) * cs, (cy + 0.5) * cs]);
    this.path[0] = [e.pos[0], e.pos[1]]; this.path[this.path.length - 1] = [x, y];
    this.i = 1; this.moving = p.moving && this.path.length > 1;
    this.fire('on-path-found');
    if (this.path.length <= 1) this.fire('on-arrived');
    return true;
  }
  tick(dt) {
    if (!this.moving) return;
    const e = this.entity;
    let left = this.props.maxSpeed * dt;
    while (left > 0 && this.i < this.path.length) {
      const [tx, ty] = this.path[this.i], dx = tx - e.pos[0], dy = ty - e.pos[1], d = Math.hypot(dx, dy);
      if (d <= left) { e.pos = [tx, ty, e.pos[2]]; left -= d; this.i++; } else { e.pos = [e.pos[0] + dx / d * left, e.pos[1] + dy / d * left, e.pos[2]]; left = 0; }
    }
    if (this.i >= this.path.length) { this.moving = false; this.fire('on-arrived'); }
  }
}
registerBehavior('Pathfinding', Pathfinding, merge(ENABLED, {
  conditions: { 'on-path-found': trig(), 'on-failed': trig(), 'on-arrived': trig(), 'is-moving': { test: (b) => b.moving } },
  actions: {
    'find-path': { params: ['x', 'y'], run: (b, p) => { b.findPath(p.x, p.y); } },
    stop: { run: (b) => { b.moving = false; } },
    'set-max-speed': { params: ['value'], run: (b, p) => { b.props.maxSpeed = p.value; } },
  },
  expressions: { PathNodeCount: (b) => b.path.length, MaxSpeed: (b) => b.props.maxSpeed },
}));
const nodeExpr = (k) => (b, a) => b.path[Math.floor(a?.[0] ?? 0)]?.[k] ?? 0;

// ---------- Physics (wraps the backend rigidbody) ----------
class Physics extends Behavior {
  static attributes = { immovable: A('bool', false), mass: A('number', 1), friction: A('number', 0.1), bounce: A('number', 0), gravityScale: A('number', 1), fixedRotation: A('bool', true) };
  init() {
    const e = this.entity, p = this.props;
    if (!e.getComponent('rigidbody')) e.addComponent('rigidbody', { mode: p.immovable ? 'static' : 'dynamic', mass: p.mass, friction: p.friction, bounce: p.bounce, gravityScale: p.gravityScale, fixedRotation: p.fixedRotation });
    if (!e.getComponent('collider')) e.addComponent('collider', { shape: 'box' });
  }
  get ph() { return this.game.physics; }
  get velocity() { return this.ph?.velocity(this.entity) ?? [0, 0]; }
}
registerBehavior('Physics', Physics, merge(ENABLED, {
  conditions: { 'is-on-floor': { test: (b) => !!b.ph?.isGrounded(b.entity) } },
  actions: {
    'apply-impulse': { params: ['x', 'y'], run: (b, p) => b.ph?.applyImpulse(b.entity, p.x, p.y) },
    'set-velocity': { params: ['x', 'y'], run: (b, p) => b.ph?.setVelocity(b.entity, p.x, p.y) },
  },
  expressions: { VelocityX: (b) => b.velocity[0], VelocityY: (b) => b.velocity[1], Speed: (b) => Math.hypot(...b.velocity) },
}));

// ---------- Scroll To (camera follow) ----------
class ScrollTo extends Behavior {
  static attributes = { lerp: A('number', 1, { min: 0.01, max: 1 }) };
  tick() {
    const cam = this.scene.backend?.cameraComp;
    if (cam?.follow && cam.target !== this.entity) cam.follow(this.entity, this.props.lerp);
    else if (!cam) this.scene.cameraTarget = this.entity; // headless/other tiers: read scene.cameraTarget
  }
}
registerBehavior('ScrollTo', ScrollTo, ENABLED);

// ---------- Persist (entity survives scene changes; handled in Game.loadScene) ----------
class Persist extends Behavior {}
registerBehavior('Persist', Persist, {});

// extra expressions that need the first argument (timer tag / node index)
import { behaviors } from './index.js';
Object.assign(behaviors.get('Timer').expressions, { CurrentTime: timerExpr((t) => t.cur), TotalTime: timerExpr((t) => t.total), Duration: timerExpr((t) => t.dur) });
Object.assign(behaviors.get('Pathfinding').expressions, { NodeX: nodeExpr(0), NodeY: nodeExpr(1) });
