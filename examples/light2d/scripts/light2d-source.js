// @nord {"id":"fx.light2d-source","title":"2D light source (point / cone / flashlight)","category":"fx","tier":["2d"],"tags":["light","shadow","torch","flashlight","flicker","game-ready"],"requires":["fx.light2d"],"description":"A shadow-casting light on this entity: colour, intensity, radius, falloff, optional cone (flashlight) that aims at the pointer / movement / entity rotation, flicker and soft shadows. Needs fx.light2d (copy light2d.js next to it) on any entity. Edit at runtime: script.on, .intensity, .radius, .angle, .color, .setColor('#rrggbb')."}
import { NordScript } from 'nord';
import { light2d, castRay, clear } from './light2d.js';

const TAU = Math.PI * 2, EPS = 2e-4, same = (a, b) => a && a.length === b.length && a.every((v, i) => v === b[i]);
const wrap = (a) => { a %= TAU; return a > Math.PI ? a - TAU : a < -Math.PI ? a + TAU : a; };

export default class LightSource2D extends NordScript {
  static attributes = {
    color: { type: 'color', default: '#ffd9a0' },
    intensity: { type: 'number', default: 1, min: 0, max: 4 },
    radius: { type: 'number', default: 160, min: 4, label: 'Radius (world units)' },
    falloff: { type: 'number', default: 1.6, min: 0.3, max: 6, label: 'Falloff (1 = linear, higher = tighter glow)' },
    shadows: { type: 'bool', default: true },
    softness: { type: 'number', default: 0, min: 0, label: 'Light size for soft shadows (px, 0 = hard)' },
    angle: { type: 'number', default: 360, min: 5, max: 360, label: 'Cone angle in degrees (360 = point light)' },
    aim: { type: 'enum', options: ['fixed', 'pointer', 'move'], default: 'fixed', label: 'Cone direction: entity rotation / mouse / movement' },
    direction: { type: 'number', default: 0, label: 'Cone direction offset (deg, 0 = right, 90 = down)' },
    turn: { type: 'number', default: 0, min: 0, label: 'Max turn speed (deg/s, 0 = instant)' },
    offset: { type: 'vec2', default: [0, 0] },
    flicker: { type: 'number', default: 0, min: 0, max: 1, label: 'Flicker amount (campfire = 0.25)' },
    flickerSpeed: { type: 'number', default: 9, min: 0 },
    on: { type: 'bool', default: true },
  };
  isLight2D = true;
  init() { // fields gameplay code may change at runtime
    const a = this.attrs;
    Object.assign(this, { on: a.on, intensity: a.intensity, radius: a.radius, falloff: a.falloff, shadows: a.shadows, softness: a.softness, angle: a.angle });
    this.setColor(a.color);
    this.dir = (a.direction * Math.PI) / 180; this.t = Math.random() * 100; this.last = null;
    this.i = this.intensity; this.r = this.radius; this.moveDir = this.dir;
    this.#place();
    this.world = light2d(this.game); this.world.lights.add(this);
  }
  onDestroy() { this.world?.lights.delete(this); }
  setColor(hex) { this.color = hex; const n = parseInt(hex.slice(1, 7), 16); this.rgb = [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
  #place() { const w = this.entity.worldPos, o = this.attrs.offset; this.x = w[0] + o[0]; this.y = w[1] + o[1]; }

  update(dt) {
    const a = this.attrs; this.#place(); this.t += dt;
    // flicker: layered sines + a little noise; the shadow shape uses the steady radius, only brightness and glow size wobble
    const f = a.flicker ? 1 - a.flicker * (0.5 + 0.5 * (Math.sin(this.t * a.flickerSpeed) * 0.5 + Math.sin(this.t * a.flickerSpeed * 2.3 + 1.7) * 0.3 + (Math.random() - 0.5) * 0.4)) : 1;
    this.i = this.intensity * f; this.r = this.radius * (a.flicker ? 0.97 + 0.03 * f : 1);
    if (this.angle >= 359) return;
    let want = this.dir;
    if (a.aim === 'pointer') want = Math.atan2(this.input.pointer.worldY - this.y, this.input.pointer.worldX - this.x);
    else if (a.aim === 'move') {
      if (this.last && Math.hypot(this.x - this.last[0], this.y - this.last[1]) > 0.2) this.moveDir = Math.atan2(this.y - this.last[1], this.x - this.last[0]);
      this.last = [this.x, this.y]; want = this.moveDir;
    } else want = ((this.entity.rot[2] + a.direction) * Math.PI) / 180;
    const d = wrap(want - this.dir), max = a.turn ? (a.turn * Math.PI * dt) / 180 : Infinity;
    this.dir = wrap(this.dir + Math.max(-max, Math.min(max, d)));
  }

  /** Segments of the occluders near this light (refreshed only when the light, an occluder or the enabled set changed). */
  refreshSegs(w, count = w.enabledCount()) {
    const s = (this._s ??= { key: null, segs: [] }), R = this.radius, key = [Math.round(this.x * 4), Math.round(this.y * 4), R, w.version, count];
    if (!same(s.key, key)) { s.key = key; w.segmentsIn(this.x - R, this.y - R, this.x + R, this.y + R, s.segs); }
    this.segs = s.segs; return s.segs.length;
  }

  /** Visibility polygons (one per soft-shadow sample) + lit occluder bodies, cached until something relevant changes. */
  shape(w, count) {
    const n = this.refreshSegs(w, count), S = this.softness * w.softness, cone = this.angle < 359, shadowed = this.shadows && w.shadows, ns = S > 0 || cone ? w.samples : 1;
    const key = [...this._s.key, Math.round(this.dir * 2000), this.angle, S, ns, shadowed ? 1 : 0];
    if (this._p && same(this._p.key, key)) return this._p;
    const R = this.radius, half = cone ? (this.angle * Math.PI) / 360 : Math.PI, edge = cone ? half * 0.12 : 0, B = R * 1.2;
    const list = shadowed ? this._s.segs.slice(0, n) : [];
    list.push(this.x - B, this.y - B, this.x + B, this.y - B, this.x + B, this.y - B, this.x + B, this.y + B, this.x + B, this.y + B, this.x - B, this.y + B, this.x - B, this.y + B, this.x - B, this.y - B);
    const polys = []; let rays = 0;
    for (let k = 0; k < ns; k++) {
      const jitter = ns > 1 && S > 0 ? S : 0, ja = (k / ns) * TAU + 0.7, ox = this.x + Math.cos(ja) * jitter, oy = this.y + Math.sin(ja) * jitter;
      const dir = this.dir + (ns > 1 ? (k / (ns - 1) - 0.5) * 2 * edge : 0), rel = [];
      const add = (r) => { if (!cone || Math.abs(r) <= half) rel.push(r); };
      for (let i = 0; i < list.length; i += 4) { const r = wrap(Math.atan2(list[i + 1] - oy, list[i] - ox) - dir); add(wrap(r - EPS)); add(wrap(r + EPS)); }
      if (cone) rel.push(-half, half);
      rel.sort((p, q) => p - q);
      const pts = cone ? [ox, oy] : [];
      for (const r of rel) {
        const dx = Math.cos(dir + r), dy = Math.sin(dir + r), d = castRay(ox, oy, dx, dy, list, list.length);
        pts.push(ox + dx * (d === Infinity ? B * 2 : d), oy + dy * (d === Infinity ? B * 2 : d));
      }
      polys.push(pts); rays += rel.length;
    }
    const bodies = [];
    if (shadowed) for (const o of w.occluders) {
      if (!o.lit || !o.entity.enabled || o.bb[2] < this.x - R || o.bb[0] > this.x + R || o.bb[3] < this.y - R || o.bb[1] > this.y + R) continue;
      for (let i = 0; i < o.pts.length; i += 2) { // lit when at least one (slightly outward-nudged) corner is seen
        const dx = o.pts[i] - o.cx, dy = o.pts[i + 1] - o.cy, m = Math.hypot(dx, dy) || 1, px = o.pts[i] + (dx / m) * 1.5, py = o.pts[i + 1] + (dy / m) * 1.5;
        if (cone && Math.abs(wrap(Math.atan2(py - this.y, px - this.x) - this.dir)) > half + edge) continue;
        if (clear(this.x, this.y, px, py, this._s.segs, n)) { bodies.push(o.pts); break; }
      }
    }
    return (this._p = { key, polys, bodies, rays, nseg: n });
  }
}
