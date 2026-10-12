// Seedable RNG with the helper set of SPD's `com.watabou.utils.Random` (Shattered Pixel Dungeon, GPL-3.0).
// Ported from SPD-classes/src/main/java/com/watabou/utils/Random.java (NormalIntRange etc.); the generator itself is mulberry32.
export class Rnd {
  constructor(seed = (Math.random() * 2 ** 32) >>> 0) { this.seed = seed >>> 0; this.s = this.seed; }
  /** [0,1) */
  float(max) { let t = (this.s += 0x6d2b79f5); t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); const f = ((t ^ (t >>> 14)) >>> 0) / 4294967296; return max === undefined ? f : f * max; }
  /** integer in [0,n) */
  int(n) { return Math.floor(this.float() * n); }
  /** integer in [a,b] */
  range(a, b) { return a + this.int(b - a + 1); }
  /** SPD NormalIntRange: triangular distribution, inclusive. */
  normalIntRange(min, max) { return min + Math.floor((this.float() + this.float()) * (max - min + 1) / 2); }
  /** index chosen by weights, e.g. chances([0,0,6,3,1]) */
  chances(w) { const sum = w.reduce((a, b) => a + b, 0); let r = this.float() * sum; for (let i = 0; i < w.length; i++) { r -= w[i]; if (r < 0) return i; } return w.length - 1; }
  pick(arr) { return arr[this.int(arr.length)]; }
  shuffle(arr) { for (let i = arr.length - 1; i > 0; i--) { const j = this.int(i + 1); [arr[i], arr[j]] = [arr[j], arr[i]]; } return arr; }
}
