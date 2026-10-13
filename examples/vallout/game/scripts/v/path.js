// Grid helpers (pure): A* with 8-dir movement (diagonal cost 1 AP like Fallout hexes), flood reach, Bresenham line of sight.
export const DIRS = [[0, -1], [1, -1], [1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1]];
export const key = (x, y) => y * 1000 + x;
/** blocked(x,y) → bool. Returns [{x,y}…] excluding start, or null. maxCost optional. */
export function findPath(w, h, blocked, a, b, maxCost = 999, goalAdjacent = false) {
  if (a.x === b.x && a.y === b.y) return [];
  const open = [{ x: a.x, y: a.y, g: 0, f: 0 }], best = new Map([[key(a.x, a.y), 0]]), from = new Map();
  const hh = (x, y) => Math.max(Math.abs(x - b.x), Math.abs(y - b.y));
  while (open.length) {
    open.sort((p, q) => p.f - q.f); const cur = open.shift();
    if (cur.x === b.x && cur.y === b.y || (goalAdjacent && hh(cur.x, cur.y) <= 1)) {
      const out = []; let k = key(cur.x, cur.y); const kk = [];
      while (k !== key(a.x, a.y)) { kk.push(k); k = from.get(k); }
      for (const q of kk.reverse()) out.push({ x: q % 1000, y: Math.floor(q / 1000) });
      return out;
    }
    for (const [dx, dy] of DIRS) {
      const nx = cur.x + dx, ny = cur.y + dy;
      if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
      const isGoal = nx === b.x && ny === b.y;
      if (blocked(nx, ny) && !(isGoal && goalAdjacent)) continue;
      if (dx && dy && (blocked(cur.x + dx, cur.y) && blocked(cur.x, cur.y + dy))) continue;   // no squeezing diagonally between two blockers
      const g = cur.g + 1; if (g > maxCost) continue;
      const k = key(nx, ny); if (best.has(k) && best.get(k) <= g) continue;
      best.set(k, g); from.set(k, key(cur.x, cur.y)); open.push({ x: nx, y: ny, g, f: g + hh(nx, ny) });
    }
  }
  return null;
}
/** Tiles reachable within `ap` steps → Map key → cost. */
export function reach(w, h, blocked, a, ap) {
  const cost = new Map([[key(a.x, a.y), 0]]), q = [[a.x, a.y]];
  while (q.length) { const [x, y] = q.shift(), g = cost.get(key(x, y)); if (g >= ap) continue; for (const [dx, dy] of DIRS) { const nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx >= w || ny >= h || blocked(nx, ny) || cost.has(key(nx, ny))) continue; cost.set(key(nx, ny), g + 1); q.push([nx, ny]); } }
  return cost;
}
/** Line of sight/fire: true when no `opaque` tile lies strictly between. Returns {clear, crowd} where crowd counts tiles flagged by `crowded`. */
export function line(a, b, opaque, crowded = () => false) {
  let x0 = a.x, y0 = a.y; const x1 = b.x, y1 = b.y, dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1; let err = dx + dy, crowd = 0;
  for (let n = 0; n < 200; n++) {
    if (x0 === x1 && y0 === y1) return { clear: true, crowd };
    const e2 = 2 * err; if (e2 >= dy) { err += dy; x0 += sx; } if (e2 <= dx) { err += dx; y0 += sy; }
    if (x0 === x1 && y0 === y1) return { clear: true, crowd };
    if (opaque(x0, y0)) return { clear: false, crowd };
    if (crowded(x0, y0)) crowd++;
  }
  return { clear: true, crowd };
}
