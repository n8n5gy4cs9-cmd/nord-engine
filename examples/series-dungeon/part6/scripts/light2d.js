// @nord {"id":"fx.light2d","title":"2D lighting & shadows (system)","category":"fx","tier":["2d"],"tags":["light","shadow","darkness","lightmap","lantern","flashlight","game-ready"],"description":"Dark-scene 2D lighting with real shadows. Put this on ONE entity (any name), add fx.light2d-source to lights (point or cone/flashlight, flicker, soft shadows) and fx.light2d-occluder to walls/pillars/crates. Renders a small lightmap multiplied over the world (HUD/UI and layer>=1 entities stay bright). Gameplay can query light with game.light2d.lightAt(x, y)."}
import { NordScript } from 'nord';

const TAU = Math.PI * 2, EPS = 2e-4;
const wrap = (a) => { a %= TAU; return a > Math.PI ? a - TAU : a < -Math.PI ? a + TAU : a; };

/** Distance along a ray (origin ox,oy; direction dx,dy) to the nearest segment in the flat list `s[0..n)` (x1,y1,x2,y2 …); Infinity if none. */
export function castRay(ox, oy, dx, dy, s, n) {
  let best = Infinity;
  for (let i = 0; i < n; i += 4) {
    const x1 = s[i], y1 = s[i + 1], ex = s[i + 2] - x1, ey = s[i + 3] - y1, den = dx * ey - dy * ex;
    if (den > -1e-9 && den < 1e-9) continue;
    const wx = x1 - ox, wy = y1 - oy, t = (wx * ey - wy * ex) / den, u = (wx * dy - wy * dx) / den;
    if (t > 1e-6 && u >= 0 && u <= 1 && t < best) best = t;
  }
  return best;
}
/** True when nothing in the segment list blocks the straight line from (ax,ay) to (bx,by). */
export function clear(ax, ay, bx, by, s, n) {
  const dx = bx - ax, dy = by - ay, d = Math.hypot(dx, dy);
  return d < 1e-6 || castRay(ax, ay, dx / d, dy / d, s, n) >= d - 0.75;
}

/**
 * Shared per-game state: registered lights + occluders, settings and queries. Created lazily by `light2d(game)` so the system,
 * sources and occluders can start in any order. Exposed as `game.light2d` for gameplay code.
 */
export class Light2DWorld {
  constructor() {
    this.lights = new Set(); this.occluders = new Set();
    this.version = 0; this.shadows = true; this.samples = 3;
    this.ambient = [0.08, 0.09, 0.16]; // lightmap base colour 0..1 (darkness level of unlit areas)
    this.force = 1; this.shadowStrength = 1; this.softness = 1; // global: light brightness x, shadow darkness 0..1, soft-shadow size x
    this.stats = { ms: 0, lights: 0, drawn: 0, occluders: 0, segments: 0, rays: 0 };
    this._buf = []; this._pt = { level: 0, dx: 0, dy: 0 };
  }
  /** Number of enabled occluders (part of every cache key, so enabling/disabling one invalidates shadows). */
  enabledCount() { let n = 0; for (const o of this.occluders) if (o.entity.enabled) n++; return n; }
  /** Copy the segments of enabled occluders whose bounds touch the box into `out` (cleared first); returns the flat length. */
  segmentsIn(x0, y0, x1, y1, out) {
    out.length = 0;
    for (const o of this.occluders) {
      const b = o.bb; if (!o.entity.enabled || b[2] < x0 || b[0] > x1 || b[3] < y0 || b[1] > y1) continue;
      for (const v of o.segs) out.push(v);
    }
    return out.length;
  }
  /** Light level at a world point, summed over all lights with line of sight (0 = dark; ~1 = fully lit). */
  lightAt(x, y) { return this.sample(x, y).level; }
  /** Like lightAt but also returns `dx,dy`, the unit direction towards the light(s) (weighted). The returned object is reused. */
  sample(x, y) {
    const r = this._pt; let level = 0, sx = 0, sy = 0;
    for (const l of this.lights) {
      if (!l.entity.enabled || !l.on) continue;
      const dx = x - l.x, dy = y - l.y, d = Math.hypot(dx, dy), R = l.radius;
      if (d >= R) continue;
      let k = l.i * (1 - d / R) ** l.falloff;
      if (l.angle < 359) { const half = (l.angle * Math.PI) / 360, off = Math.abs(wrap(Math.atan2(dy, dx) - l.dir)); k *= Math.max(0, Math.min(1, (half - off) / (half * 0.3))); }
      if (k <= 0.001) continue;
      if (l.shadows && this.shadows) { const n = l.refreshSegs(this); if (!clear(l.x, l.y, x, y, l.segs, n)) continue; }
      level += k; sx += (l.x - x) / (d || 1) * k; sy += (l.y - y) / (d || 1) * k;
    }
    const m = Math.hypot(sx, sy) || 1; r.level = level; r.dx = sx / m; r.dy = sy / m; return r;
  }
}
export const light2d = (game) => (game.light2d ??= new Light2DWorld());

export default class Light2D extends NordScript {
  static attributes = {
    ambient: { type: 'color', default: '#14172b', label: 'Ambient colour (what unlit areas look like; #ffffff = no darkness)' },
    scale: { type: 'number', default: 0.5, min: 0.15, max: 1, label: 'Lightmap resolution (1 = full, 0.5 = half, cheaper + softer)' },
    force: { type: 'number', default: 1, min: 0, max: 4, label: 'Light force: brightness multiplier for every light (visual only)' },
    shadowStrength: { type: 'number', default: 1, min: 0, max: 1, label: 'Shadow strength (1 = black shadows, 0 = no visible shadows)' },
    softness: { type: 'number', default: 1, min: 0, max: 4, label: 'Shadow softness multiplier (0 = hard; scales each light\'s own softness)' },
    shadows: { type: 'bool', default: true },
    softShadows: { type: 'int', default: 3, min: 1, max: 8, label: 'Samples for soft shadows / cone edges' },
    depth: { type: 'number', default: 500, label: 'Draw depth (entities on layer >= 1 draw above the darkness)' },
  };
  start() {
    const a = this.attrs, b = this.game.backend, ps = b?.scene, P = globalThis.Phaser;
    this.world = light2d(this.game);
    if (!ps || !P) { console.warn('[light2d] needs the Phaser 2D backend'); return; }
    const w = this.world; w.shadows = a.shadows; w.samples = a.softShadows; w.force = a.force; w.shadowStrength = a.shadowStrength; w.softness = a.softness; this.setAmbient(a.ambient);
    this.ps = ps; this.key = `__light2d_${Math.random().toString(36).slice(2, 8)}`;
    this.lw = Math.max(16, Math.round(b.width * a.scale)); this.lh = Math.max(16, Math.round(b.height * a.scale));
    this.tex = ps.textures.createCanvas(this.key, this.lw, this.lh); this.ctx = this.tex.getContext();
    this.img = ps.add.image(b.width / 2, b.height / 2, this.key).setScrollFactor(0).setDepth(a.depth).setBlendMode(P.BlendModes.MULTIPLY);
    this.hook = () => this.render(); ps.events.on('prerender', this.hook);
  }
  onDestroy() {
    try { this.ps?.events.off('prerender', this.hook); this.img?.destroy(); this.ps?.textures.remove(this.key); } catch { /* scene already gone */ }
    this.world?.lights.clear(); this.world?.occluders.clear();
  }
  /** Set the ambient (unlit) colour from '#rrggbb'. Brighter = less dark. */
  setAmbient(hex) { const n = parseInt(hex.slice(1, 7), 16); this.world.ambient = [(n >> 16) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255]; }
  /** Live tuning, all clamped: setLook({ force, shadowStrength, softness, ambient: '#rrggbb' }). Returns the resulting values. */
  setLook({ force, shadowStrength, softness, ambient } = {}) {
    const w = this.world, c = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
    if (force !== undefined) w.force = c(force, 0, 4);
    if (shadowStrength !== undefined) w.shadowStrength = c(shadowStrength, 0, 1);
    if (softness !== undefined) w.softness = c(softness, 0, 4);
    if (ambient !== undefined) this.setAmbient(ambient);
    return { force: w.force, shadowStrength: w.shadowStrength, softness: w.softness };
  }
  toggleShadows(on = !this.world.shadows) { this.world.shadows = on; return on; }

  render() {
    const t0 = performance.now(), w = this.world, ctx = this.ctx, cam = this.ps.cameras.main;
    const vw = cam.width / cam.zoom, vh = cam.height / cam.zoom, left = cam.scrollX + cam.width / 2 - vw / 2, top = cam.scrollY + cam.height / 2 - vh / 2;
    this.img.setDisplaySize(vw, vh);
    const sx = this.lw / vw, sy = this.lh / vh, st = w.stats; st.lights = w.lights.size; st.occluders = w.occluders.size; st.drawn = 0; st.segments = 0; st.rays = 0;
    ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
    ctx.fillStyle = `rgb(${Math.round(w.ambient[0] * 255)},${Math.round(w.ambient[1] * 255)},${Math.round(w.ambient[2] * 255)})`;
    ctx.fillRect(0, 0, this.lw, this.lh);
    ctx.globalCompositeOperation = 'lighter';
    const count = w.enabledCount(), V = { left, top, sx, sy, count };
    for (const l of w.lights) {
      if (!l.entity.enabled || !l.on || l.i <= 0.002 || l.r <= 1) continue;
      if (l.x + l.r < left || l.x - l.r > left + vw || l.y + l.r < top || l.y - l.r > top + vh) continue;
      this.drawLight(ctx, l, V); st.drawn++;
    }
    ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
    this.tex.refresh();
    st.ms = st.ms * 0.9 + (performance.now() - t0) * 0.1;
  }

  drawLight(ctx, l, V) {
    const w = this.world, { left, top, sx, sy } = V, cx = (l.x - left) * sx, cy = (l.y - top) * sy, rr = l.r * sx, st = w.stats;
    const I = l.i * w.force, k = I > 1 ? I : 1, c = l.rgb, a0 = Math.min(1, I);
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, rr);
    for (let s = 0; s <= 5; s++) { const t = s / 5; g.addColorStop(t, `rgba(${Math.min(255, c[0] * k) | 0},${Math.min(255, c[1] * k) | 0},${Math.min(255, c[2] * k) | 0},${(a0 * (1 - t) ** l.falloff).toFixed(3)})`); }
    ctx.fillStyle = g;
    const cone = l.angle < 359, shadowed = l.shadows && w.shadows;
    if (!shadowed && !cone) { ctx.globalAlpha = 1; ctx.beginPath(); ctx.arc(cx, cy, rr, 0, TAU); ctx.fill(); return; }
    const cache = l.shape(w, V.count);
    st.segments += cache.nseg; st.rays += cache.rays;
    const str = w.shadowStrength; // weaker shadows: first lay down the light as if nothing blocked it
    if (shadowed && str < 1) {
      ctx.globalAlpha = 1 - str; ctx.beginPath();
      if (cone) { const h = (l.angle * Math.PI) / 360; ctx.moveTo(cx, cy); ctx.arc(cx, cy, rr, l.dir - h, l.dir + h); ctx.closePath(); } else ctx.arc(cx, cy, rr, 0, TAU);
      ctx.fill();
    }
    ctx.globalAlpha = (shadowed ? str : 1) / cache.polys.length;
    for (const p of cache.polys) {
      ctx.beginPath(); ctx.moveTo((p[0] - left) * sx, (p[1] - top) * sy);
      for (let j = 2; j < p.length; j += 2) ctx.lineTo((p[j] - left) * sx, (p[j + 1] - top) * sy);
      ctx.closePath(); ctx.fill();
    }
    ctx.globalAlpha = shadowed ? str : 1;
    for (const b of cache.bodies) { // lit tops of walls/pillars facing the light
      ctx.beginPath(); ctx.moveTo((b[0] - left) * sx, (b[1] - top) * sy);
      for (let j = 2; j < b.length; j += 2) ctx.lineTo((b[j] - left) * sx, (b[j + 1] - top) * sy);
      ctx.closePath(); ctx.fill();
    }
  }
}
