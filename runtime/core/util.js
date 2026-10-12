// Math, rng, easing, tween, timers, object pool. Engine-agnostic.
export const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const remap = (v, a, b, c, d) => c + ((v - a) / (b - a)) * (d - c);
export const deg2rad = (d) => (d * Math.PI) / 180;
export const rad2deg = (r) => (r * 180) / Math.PI;
export const angleDiff = (a, b) => ((((b - a) % 360) + 540) % 360) - 180; // degrees, shortest signed
export const vec = {
  add: (a, b) => a.map((v, i) => v + b[i]),
  sub: (a, b) => a.map((v, i) => v - b[i]),
  scale: (a, s) => a.map((v) => v * s),
  len: (a) => Math.hypot(...a),
  dist: (a, b) => Math.hypot(...a.map((v, i) => v - b[i])),
  norm: (a) => { const l = Math.hypot(...a) || 1; return a.map((v) => v / l); },
  lerp: (a, b, t) => a.map((v, i) => lerp(v, b[i], t)),
};

/** Seedable rng (mulberry32). */
export class Rng {
  constructor(seed = Date.now()) { this.s = seed >>> 0; }
  next() {
    let t = (this.s += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  range(a, b) { return a + this.next() * (b - a); }
  int(a, b) { return Math.floor(this.range(a, b + 1)); }
  pick(arr) { return arr[Math.floor(this.next() * arr.length)]; }
  chance(p) { return this.next() < p; }
  shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(this.next() * (i + 1)); [arr[i], arr[j]] = [arr[j], arr[i]]; }
    return arr;
  }
}

const bounceOut = (t) => {
  const n = 7.5625, d = 2.75;
  if (t < 1 / d) return n * t * t;
  if (t < 2 / d) return n * (t -= 1.5 / d) * t + 0.75;
  if (t < 2.5 / d) return n * (t -= 2.25 / d) * t + 0.9375;
  return n * (t -= 2.625 / d) * t + 0.984375;
};
export const ease = {
  linear: (t) => t,
  quadIn: (t) => t * t,
  quadOut: (t) => 1 - (1 - t) * (1 - t),
  quadInOut: (t) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2),
  cubicIn: (t) => t ** 3,
  cubicOut: (t) => 1 - (1 - t) ** 3,
  cubicInOut: (t) => (t < 0.5 ? 4 * t ** 3 : 1 - (-2 * t + 2) ** 3 / 2),
  sineInOut: (t) => -(Math.cos(Math.PI * t) - 1) / 2,
  backOut: (t) => 1 + 2.70158 * (t - 1) ** 3 + 1.70158 * (t - 1) ** 2,
  elasticOut: (t) => (t === 0 || t === 1 ? t : 2 ** (-10 * t) * Math.sin(((t * 10 - 0.75) * (2 * Math.PI)) / 3) + 1),
  bounceOut,
  bounceIn: (t) => 1 - bounceOut(1 - t),
};

/** Timers + tweens, advanced by `update(dt)` with the (time-scaled) frame delta. */
export class Scheduler {
  #items = [];
  /** Run fn once after `sec`. Returns cancel(). */
  after(sec, fn) { return this.#add({ left: sec, fn, every: 0 }); }
  /** Run fn every `sec` until cancelled. */
  every(sec, fn) { return this.#add({ left: sec, fn, every: sec }); }
  /** Tween numeric props of `target` (object or array) to `to`. opts: duration, delay, ease, onUpdate, onComplete, yoyo, repeat */
  tween(target, to, opts = {}) {
    const from = {};
    const t = { target, to, from, t: 0, delay: opts.delay ?? 0, dur: opts.duration ?? 1, ease: ease[opts.ease ?? 'quadOut'] ?? opts.ease, opts, dir: 1, reps: opts.repeat ?? 0, started: false, tween: true };
    return this.#add(t);
  }
  #add(it) {
    this.#items.push(it);
    const cancel = () => { it.dead = true; };
    cancel.item = it;
    return cancel;
  }
  update(dt) {
    for (const it of [...this.#items]) {
      if (it.dead) continue;
      if (it.tween) this.#tweenStep(it, dt);
      else {
        it.left -= dt;
        while (it.left <= 0 && !it.dead) {
          it.fn();
          if (it.every > 0) it.left += it.every; else it.dead = true;
        }
      }
    }
    this.#items = this.#items.filter((i) => !i.dead);
  }
  #tweenStep(it, dt) {
    if (it.delay > 0) { it.delay -= dt; if (it.delay > 0) return; dt = -it.delay; it.delay = 0; }
    if (!it.started) { for (const k of Object.keys(it.to)) it.from[k] = it.target[k]; it.started = true; }
    it.t += (dt / it.dur) * it.dir;
    let done = false;
    if (it.t >= 1 - 1e-9 || it.t <= 0) {
      it.t = clamp(it.t, 0, 1);
      if (it.opts.yoyo && it.dir === 1) it.dir = -1;
      else if (it.reps !== 0) { if (it.reps > 0) it.reps--; it.dir = 1; it.t = 0; }
      else done = true;
    }
    const e = it.ease(it.t);
    for (const k of Object.keys(it.to)) it.target[k] = lerp(it.from[k], it.to[k], e);
    it.opts.onUpdate?.(it.target);
    if (done) { it.dead = true; it.opts.onComplete?.(it.target); }
  }
  get size() { return this.#items.filter((i) => !i.dead).length; }
  clear() { this.#items = []; }
}

export class Pool {
  #free = [];
  constructor(factory, reset = () => {}) { this.factory = factory; this.reset = reset; }
  get() { const o = this.#free.pop() ?? this.factory(); this.reset(o); return o; }
  release(o) { this.#free.push(o); }
  get available() { return this.#free.length; }
}
