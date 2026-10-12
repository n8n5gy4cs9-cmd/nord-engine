// Pure rules (no Phaser): dice, levels, and the breadth-first step used by monsters in tactical combat. Testable with plain node.
export const between = (rng, [a, b]) => a + Math.floor(rng() * (b - a + 1));
export const hits = (rng, pct) => rng() * 100 < pct;
export const levelOf = (xp) => 1 + Math.floor(Math.sqrt(xp / 25));
export const hpBonus = (lvl) => (lvl - 1) * 6;
export const DIRS = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
export const dist = (a, b) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y);

/** First step of a shortest path from `from` toward any cell in `goals` (4-way). `free(x,y)` tells whether a cell can be entered; goal cells are always reachable. */
export function bfsStep(from, goals, free, w, h) {
  const key = (x, y) => y * w + x, goal = new Set(goals.map((g) => key(g.x, g.y)));
  const prev = new Map([[key(from.x, from.y), null]]), q = [[from.x, from.y]];
  while (q.length) {
    const [x, y] = q.shift();
    if (goal.has(key(x, y)) && !(x === from.x && y === from.y)) { let k = key(x, y), p = prev.get(k); while (p !== null && prev.get(p) !== null) { k = p; p = prev.get(k); } return { x: k % w, y: (k / w) | 0 }; }
    for (const [dx, dy] of Object.values(DIRS)) {
      const nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx >= w || ny >= h || prev.has(key(nx, ny))) continue;
      if (!goal.has(key(nx, ny)) && !free(nx, ny)) continue;
      prev.set(key(nx, ny), key(x, y)); q.push([nx, ny]);
    }
  }
  return null;
}
