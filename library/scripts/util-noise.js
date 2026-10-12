// @nord {"id":"util.noise","title":"Simplex / value noise","category":"utilities","tier":["any"],"tags":["noise","perlin","procedural","math"],"description":"Seeded 2D simplex noise + fractal sum. import { makeNoise } from './util-noise.js'; const n = makeNoise(seed); n(x,y) → -1..1, n.fbm(x,y,octaves) → -1..1. The default script wobbles its entity with noise (camera-handheld look)."}
import { NordScript, Rng } from 'nord';

export function makeNoise(seed = 1) {
  const r = new Rng(seed), p = Array.from({ length: 256 }, (_, i) => i); r.shuffle(p); const perm = [...p, ...p];
  const g = [[1, 1], [-1, 1], [1, -1], [-1, -1], [1, 0], [-1, 0], [0, 1], [0, -1]], F = 0.5 * (Math.sqrt(3) - 1), G = (3 - Math.sqrt(3)) / 6;
  const n = (x, y) => {
    const s = (x + y) * F, i = Math.floor(x + s), j = Math.floor(y + s), t = (i + j) * G, x0 = x - (i - t), y0 = y - (j - t), [i1, j1] = x0 > y0 ? [1, 0] : [0, 1];
    const c = (xx, yy, gi) => { let t0 = 0.5 - xx * xx - yy * yy; if (t0 < 0) return 0; t0 *= t0; const q = g[gi % 8]; return t0 * t0 * (q[0] * xx + q[1] * yy); };
    return 70 * (c(x0, y0, perm[(i & 255) + perm[j & 255]]) + c(x0 - i1 + G, y0 - j1 + G, perm[((i + i1) & 255) + perm[(j + j1) & 255]]) + c(x0 - 1 + 2 * G, y0 - 1 + 2 * G, perm[((i + 1) & 255) + perm[(j + 1) & 255]]));
  };
  n.fbm = (x, y, oct = 4, lac = 2, gain = 0.5) => { let a = 1, f = 1, s = 0, m = 0; for (let o = 0; o < oct; o++) { s += a * n(x * f, y * f); m += a; a *= gain; f *= lac; } return s / m; };
  return n;
}

export default class NoiseWobble extends NordScript {
  static attributes = { amount: { type: 'vec3', default: [4, 4, 0] }, speed: { type: 'number', default: 0.6 }, seed: { type: 'int', default: 1 } };
  start() { this.n = makeNoise(this.attrs.seed); this.base = [...this.entity.pos]; this.t = 0; }
  update(dt) { this.t += dt * this.attrs.speed; const a = this.attrs.amount; this.entity.pos = [this.base[0] + this.n(this.t, 0) * a[0], this.base[1] + this.n(0, this.t) * a[1], this.base[2] + this.n(this.t, this.t) * a[2]]; }
}
