// @nord {"id":"util.grid","title":"Grid & geometry helpers","category":"utilities","tier":["any"],"tags":["grid","math","bezier","collision"],"description":"Pure helpers: Grid class (get/set/neighbors/flood fill/world↔cell), rect/circle/segment intersection tests, bezier(t,…pts), distance to segment. import { Grid, bezier, rectsOverlap } from './util-grid.js'."}
import { NordScript } from 'nord';

export class Grid {
  constructor(w, h, fill = 0, cell = 16) { this.w = w; this.h = h; this.cell = cell; this.data = new Array(w * h).fill(fill); }
  inside(x, y) { return x >= 0 && y >= 0 && x < this.w && y < this.h; }
  get(x, y, d = undefined) { return this.inside(x, y) ? this.data[y * this.w + x] : d; }
  set(x, y, v) { if (this.inside(x, y)) this.data[y * this.w + x] = v; }
  toCell(wx, wy) { return [Math.floor(wx / this.cell), Math.floor(wy / this.cell)]; }
  toWorld(x, y) { return [(x + 0.5) * this.cell, (y + 0.5) * this.cell]; }
  neighbors(x, y, diag = false) { return (diag ? [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]] : [[1, 0], [-1, 0], [0, 1], [0, -1]]).map(([dx, dy]) => [x + dx, y + dy]).filter(([a, b]) => this.inside(a, b)); }
  /** Cells reachable from (x,y) through cells where pred(value) is true. */
  flood(x, y, pred = (v) => v === this.get(x, y)) { const seen = new Set(), out = [], st = [[x, y]]; while (st.length) { const [a, b] = st.pop(), k = b * this.w + a; if (seen.has(k) || !this.inside(a, b) || !pred(this.get(a, b))) continue; seen.add(k); out.push([a, b]); st.push(...this.neighbors(a, b)); } return out; }
}
export const rectsOverlap = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
export const circleRect = (c, r) => { const nx = Math.max(r.x, Math.min(c.x, r.x + r.w)), ny = Math.max(r.y, Math.min(c.y, r.y + r.h)); return (c.x - nx) ** 2 + (c.y - ny) ** 2 <= c.r * c.r; };
export const distToSegment = (p, a, b) => { const dx = b[0] - a[0], dy = b[1] - a[1], l = dx * dx + dy * dy, t = l ? Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / l)) : 0; return Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dy); };
export const segmentsIntersect = (p1, p2, p3, p4) => { const d = (p2[0] - p1[0]) * (p4[1] - p3[1]) - (p2[1] - p1[1]) * (p4[0] - p3[0]); if (!d) return false; const t = ((p3[0] - p1[0]) * (p4[1] - p3[1]) - (p3[1] - p1[1]) * (p4[0] - p3[0])) / d, u = ((p3[0] - p1[0]) * (p2[1] - p1[1]) - (p3[1] - p1[1]) * (p2[0] - p1[0])) / d; return t >= 0 && t <= 1 && u >= 0 && u <= 1; };
/** De Casteljau: bezier(t, p0, p1, p2, …) for points of any dimension. */
export const bezier = (t, ...pts) => { let p = pts; while (p.length > 1) p = p.slice(1).map((b, i) => b.map((v, k) => p[i][k] + (v - p[i][k]) * t)); return p[0]; };

export default class GridDemo extends NordScript {
  static attributes = { cell: { type: 'number', default: 16 }, snap: { type: 'bool', default: true, label: 'Snap this entity to the grid on start' } };
  start() { if (this.attrs.snap) { const c = this.attrs.cell, [x, y, z] = this.entity.pos; this.entity.pos = [Math.round(x / c) * c, Math.round(y / c) * c, z]; } }
}
