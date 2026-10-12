// @nord {"id":"ai.astar","title":"A* pathfinding (grid)","category":"ai","tier":["2d"],"tags":["pathfinding","astar","grid"],"description":"A* on a boolean grid. Import { findPath } from './ai-astar.js': findPath(blocked(x,y)→bool, [sx,sy], [gx,gy], {w,h,diagonal}) → [[x,y]…] or null. Default script walks its entity along a path to the clicked tile on a grid with solid-tagged obstacles."}
import { NordScript } from 'nord';

/** blocked(x,y) → bool. Returns an array of cells from start to goal (inclusive) or null. Binary-heap open list. */
export function findPath(blocked, [sx, sy], [gx, gy], { w = 64, h = 64, diagonal = false } = {}) {
  const key = (x, y) => y * w + x, open = [[0, sx, sy]], g = new Map([[key(sx, sy), 0]]), from = new Map();
  const heap = { push(n) { open.push(n); let i = open.length - 1; while (i > 0) { const p = (i - 1) >> 1; if (open[p][0] <= open[i][0]) break; [open[p], open[i]] = [open[i], open[p]]; i = p; } }, pop() { const t = open[0], l = open.pop(); if (open.length) { open[0] = l; let i = 0; for (;;) { let m = i; const a = 2 * i + 1, b = a + 1; if (a < open.length && open[a][0] < open[m][0]) m = a; if (b < open.length && open[b][0] < open[m][0]) m = b; if (m === i) break; [open[m], open[i]] = [open[i], open[m]]; i = m; } } return t; } };
  const hf = (x, y) => (diagonal ? Math.max(Math.abs(x - gx), Math.abs(y - gy)) : Math.abs(x - gx) + Math.abs(y - gy));
  const dirs = diagonal ? [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]] : [[1, 0], [-1, 0], [0, 1], [0, -1]];
  while (open.length) {
    const [, x, y] = heap.pop();
    if (x === gx && y === gy) { const path = [[x, y]]; let k = key(x, y); while (from.has(k)) { k = from.get(k); path.push([k % w, Math.floor(k / w)]); } return path.reverse(); }
    for (const [dx, dy] of dirs) {
      const nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx >= w || ny >= h || (blocked(nx, ny) && !(nx === gx && ny === gy))) continue;
      const ng = g.get(key(x, y)) + (dx && dy ? 1.414 : 1), nk = key(nx, ny);
      if (ng < (g.get(nk) ?? Infinity)) { g.set(nk, ng); from.set(nk, key(x, y)); heap.push([ng + hf(nx, ny), nx, ny]); }
    }
  }
  return null;
}

export default class AStarWalker extends NordScript {
  static attributes = { tile: { type: 'number', default: 16 }, grid: { type: 'vec2', default: [40, 23] }, speed: { type: 'number', default: 90 }, obstacleTag: { type: 'string', default: 'solid' }, diagonal: { type: 'bool', default: false } };
  start() {
    const t = this.attrs.tile; this.solid = new Set(this.scene.findByTag(this.attrs.obstacleTag).map((e) => `${Math.floor(e.pos[0] / t)},${Math.floor(e.pos[1] / t)}`)); this.path = []; this.i = 0;
  }
  update(dt) {
    const t = this.attrs.tile, p = this.input.pointer;
    if (p.down && !this.was) {
      const path = findPath((x, y) => this.solid.has(`${x},${y}`), [Math.floor(this.entity.pos[0] / t), Math.floor(this.entity.pos[1] / t)], [Math.floor(p.worldX / t), Math.floor(p.worldY / t)], { w: this.attrs.grid[0], h: this.attrs.grid[1], diagonal: this.attrs.diagonal });
      if (path) { this.path = path; this.i = 1; }
    }
    this.was = p.down;
    if (this.i >= this.path.length) return;
    const [cx, cy] = this.path[this.i], tx = (cx + 0.5) * t, ty = (cy + 0.5) * t, [x, y, z] = this.entity.pos, d = Math.hypot(tx - x, ty - y), s = Math.min(d, this.attrs.speed * dt);
    this.entity.pos = [x + ((tx - x) / (d || 1)) * s, y + ((ty - y) / (d || 1)) * s, z]; if (d <= s + 0.01) this.i++;
    if (this.i >= this.path.length) this.entity.emit('arrived');
  }
}
