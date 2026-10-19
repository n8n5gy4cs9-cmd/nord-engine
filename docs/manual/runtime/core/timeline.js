// Timelines / keyframes (M10-21): animate properties of objects over time with easing, fire named events, loop.
//   scene.json  "settings": { "timelines": { "intro": { "duration": 3, "loop": false, "tracks": [
//       { "target": "Title", "property": "y", "keys": [ { "t": 0, "v": -50 }, { "t": 1, "v": 100, "ease": "backOut" } ] } ],
//     "events": [ { "t": 2.5, "name": "show-menu" } ] } } }
//   property: x y z angle scaleX scaleY opacity · "var:name" (instance variable) · "comp:sprite.tint" (numeric component field)
//   ease: a name from util.ease (linear, quadOut, cubicInOut, backOut, bounceOut…) or a cubic-bezier [x1,y1,x2,y2] (what a curve editor produces)
//   sheets: Timeline → Play / Pause / Resume / Stop / Set time;  triggers On finished (name) · On event (name);  expressions Timeline.Time(name), Timeline.Progress(name)
import { ease } from './util.js';
import { isType } from './behaviors/util.js';

/** cubic-bezier easing (same maths as CSS), Newton + bisection. */
export function bezier(x1, y1, x2, y2) {
  const cx = 3 * x1, bx = 3 * (x2 - x1) - cx, ax = 1 - cx - bx;
  const cy = 3 * y1, by = 3 * (y2 - y1) - cy, ay = 1 - cy - by;
  const X = (t) => ((ax * t + bx) * t + cx) * t, Y = (t) => ((ay * t + by) * t + cy) * t;
  return (x) => {
    if (x <= 0) return 0; if (x >= 1) return 1;
    let lo = 0, hi = 1, t = x;
    for (let i = 0; i < 30; i++) { const v = X(t); if (Math.abs(v - x) < 1e-6) break; if (v < x) lo = t; else hi = t; t = (lo + hi) / 2; }
    return Y(t);
  };
}
const easeFn = (e) => (Array.isArray(e) ? bezier(...e) : ease[e ?? 'linear'] ?? ease.linear);

const GET = { x: (e) => e.pos[0], y: (e) => e.pos[1], z: (e) => e.pos[2], angle: (e) => e.rot[2] ?? 0, scaleX: (e) => e.scale[0], scaleY: (e) => e.scale[1], opacity: (e) => e.opacity ?? 1 };
const SET = {
  x: (e, v) => { e.pos = [v, e.pos[1], e.pos[2]]; }, y: (e, v) => { e.pos = [e.pos[0], v, e.pos[2]]; }, z: (e, v) => { e.pos = [e.pos[0], e.pos[1], v]; },
  angle: (e, v) => { e.rot = [e.rot[0], e.rot[1], v]; }, scaleX: (e, v) => { e.scale = [v, e.scale[1], e.scale[2]]; }, scaleY: (e, v) => { e.scale = [e.scale[0], v, e.scale[2]]; },
  opacity: (e, v) => { e.opacity = v; for (const t of ['sprite', 'animatedSprite']) if (e.getComponent(t)) e.set(t, 'alpha', v); },
};
function write(e, prop, v) {
  if (SET[prop]) SET[prop](e, v);
  else if (prop.startsWith('var:')) e.vars[prop.slice(4)] = v;
  else if (prop.startsWith('comp:')) { const [t, f] = prop.slice(5).split('.'); e.set(t, f, v); }
}
function read(e, prop) {
  if (GET[prop]) return GET[prop](e);
  if (prop.startsWith('var:')) return e.vars[prop.slice(4)] ?? 0;
  if (prop.startsWith('comp:')) { const [t, f] = prop.slice(5).split('.'); return e.getComponent(t)?.data[f] ?? 0; }
  return 0;
}

/** Value of a keyframe list at time t (keys sorted by t; value eased from the previous key using the NEXT key's ease). */
export function sample(keys, t) {
  if (!keys.length) return undefined;
  if (t <= keys[0].t) return keys[0].v;
  const last = keys.at(-1); if (t >= last.t) return last.v;
  let i = 0; while (keys[i + 1].t < t) i++;
  const a = keys[i], b = keys[i + 1];
  const k = (t - a.t) / (b.t - a.t);
  return a.v + (b.v - a.v) * easeFn(b.ease ?? a.ease)(k);
}

export class Timelines {
  constructor(scene, defs) {
    this.scene = scene; this.game = scene.game; this.defs = defs ?? {};
    this.playing = new Map(); // name -> { time, speed, paused, fired:Set, from:Map(track -> start value) }
  }
  has(name) { return !!this.defs[name]; }
  play(name, { from = 0, speed = 1 } = {}) {
    const def = this.defs[name]; if (!def) { this.game.warn(`[nord] unknown timeline '${name}'`); return false; }
    this.playing.set(name, { time: from, speed, paused: false, fired: new Set() });
    this.#apply(name, def, from);
    return true;
  }
  pause(name) { const p = this.playing.get(name); if (p) p.paused = true; }
  resume(name) { const p = this.playing.get(name); if (p) p.paused = false; }
  stop(name) { this.playing.delete(name); }
  seek(name, t) { const p = this.playing.get(name); if (!p) return; p.time = t; p.fired.clear(); this.#apply(name, this.defs[name], t); }
  time(name) { return this.playing.get(name)?.time ?? 0; }
  progress(name) { const d = this.defs[name]?.duration; return d ? Math.min(1, this.time(name) / d) : 0; }
  isPlaying(name) { const p = this.playing.get(name); return !!p && !p.paused; }
  update(dt) {
    for (const [name, p] of [...this.playing]) {
      if (p.paused) continue;
      const def = this.defs[name], dur = def.duration ?? Math.max(0, ...def.tracks.flatMap((t) => t.keys.map((k) => k.t)));
      const prev = p.time;
      p.time += dt * p.speed;
      let done = false;
      if (p.time >= dur) { if (def.loop) p.time %= dur || 1; else { p.time = dur; done = true; } }
      for (const ev of def.events ?? []) { // events crossed this frame (handles loop wrap)
        const crossed = p.time >= prev ? ev.t > prev && ev.t <= p.time : ev.t > prev || ev.t <= p.time;
        if (crossed || (done && ev.t >= dur && !p.fired.has(ev))) { p.fired.add(ev); this.#fire('Timeline.on-event', { timeline: name, name: ev.name }); }
      }
      this.#apply(name, def, p.time);
      if (done) { this.playing.delete(name); this.#fire('Timeline.on-finished', { timeline: name }); }
    }
  }
  #fire(key, data) { this.game.events.emit(key, data); this.scene.eventSheet?.fire(key, data); }
  #apply(name, def, t) {
    for (const tr of def.tracks ?? []) {
      const keys = [...tr.keys].sort((a, b) => a.t - b.t);
      const v = sample(keys, t); if (v === undefined) continue;
      for (const e of this.scene.all()) if (!e.destroyed && isType(this.scene, e, tr.target)) write(e, tr.property, v);
    }
  }
}
export { read as readProperty };
