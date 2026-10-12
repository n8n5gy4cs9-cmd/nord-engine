// Grid helpers modelled on SPD's `com.watabou.utils.PathFinder` (GPL-3.0): 8-neighbour BFS distance maps, uniform step cost.
export const NEIGHBOURS8 = (w) => [-w - 1, -w, -w + 1, -1, +1, w - 1, w, w + 1];
export const NEIGHBOURS4 = (w) => [-w, -1, +1, w];
const DX = [-1, 0, 1, -1, 1, -1, 0, 1], DY = [-1, -1, -1, 0, 0, 1, 1, 1];
export const dist = (w, a, b) => Math.max(Math.abs((a % w) - (b % w)), Math.abs(Math.floor(a / w) - Math.floor(b / w)));
export const adjacent = (w, a, b) => a !== b && dist(w, a, b) === 1;

/** Neighbour cell indices of `i` that stay inside the grid (no wrap-around). */
export function neighbours(w, h, i) {
  const x = i % w, y = (i / w) | 0, out = [];
  for (let k = 0; k < 8; k++) { const nx = x + DX[k], ny = y + DY[k]; if (nx >= 0 && ny >= 0 && nx < w && ny < h) out.push(ny * w + nx); }
  return out;
}

/** BFS distances from `from` over cells where passable(i) is true (the start itself always counts). Unreached = 0x7fff. `limit` caps the search radius. */
export function distanceMap(w, h, from, passable, limit = 1e9) {
  const d = new Int16Array(w * h).fill(0x7fff);
  const q = [from]; d[from] = 0;
  for (let head = 0; head < q.length; head++) {
    const c = q[head];
    if (d[c] >= limit) continue;
    for (const n of neighbours(w, h, c)) if (d[n] === 0x7fff && passable(n)) { d[n] = d[c] + 1; q.push(n); }
  }
  return d;
}

/** Shortest path from `from` to `to` (excluding `from`, including `to`) or null. */
export function findPath(w, h, from, to, passable) {
  const d = distanceMap(w, h, to, (i) => passable(i) || i === from);
  if (d[from] === 0x7fff) return null;
  const path = []; let c = from;
  while (c !== to) {
    let best = -1, bd = d[c];
    for (const n of neighbours(w, h, c)) if (d[n] < bd && (passable(n) || n === to)) { bd = d[n]; best = n; }
    if (best < 0) return null;
    path.push(best); c = best;
  }
  return path;
}
