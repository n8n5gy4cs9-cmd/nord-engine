// @nord {"id":"procedural.dungeon","title":"Dungeon generator (BSP / cellular)","category":"procedural","tier":["2d"],"tags":["dungeon","bsp","cellular","roguelike","tilemap"],"requires":["tilemap"],"description":"Generates a map with BSP rooms+corridors or cellular-automata caves and paints it into this entity's tilemap component (setTile). Also exports bsp(), cellular() returning a 2D array (1 = wall). Seeded: same seed → same map."}
import { NordScript, Rng } from 'nord';

export function bsp(w, h, rng, { minRoom = 5, depth = 5 } = {}) {
  const g = Array.from({ length: h }, () => Array(w).fill(1)), rooms = [];
  const split = (x, y, rw, rh, d) => {
    if (d === 0 || rw < minRoom * 2 + 2 || rh < minRoom * 2 + 2) {
      const cw = rng.int(minRoom, Math.max(minRoom, rw - 2)), ch = rng.int(minRoom, Math.max(minRoom, rh - 2)), cx = x + rng.int(1, Math.max(1, rw - cw - 1)), cy = y + rng.int(1, Math.max(1, rh - ch - 1));
      for (let j = cy; j < cy + ch && j < h - 1; j++) for (let i = cx; i < cx + cw && i < w - 1; i++) g[j][i] = 0;
      const r = { x: cx, y: cy, w: cw, h: ch, cx: cx + (cw >> 1), cy: cy + (ch >> 1) }; rooms.push(r); return r;
    }
    let a, b;
    if (rw > rh) { const s = rng.int(minRoom + 1, rw - minRoom - 1); a = split(x, y, s, rh, d - 1); b = split(x + s, y, rw - s, rh, d - 1); }
    else { const s = rng.int(minRoom + 1, rh - minRoom - 1); a = split(x, y, rw, s, d - 1); b = split(x, y + s, rw, rh - s, d - 1); }
    for (let i = Math.min(a.cx, b.cx); i <= Math.max(a.cx, b.cx); i++) g[a.cy][i] = 0;
    for (let j = Math.min(a.cy, b.cy); j <= Math.max(a.cy, b.cy); j++) g[j][b.cx] = 0;
    return rng.chance(0.5) ? a : b;
  };
  split(0, 0, w, h, depth);
  return { grid: g, rooms };
}

export function cellular(w, h, rng, { fill = 0.45, steps = 4 } = {}) {
  let g = Array.from({ length: h }, (_, y) => Array.from({ length: w }, (_, x) => (x === 0 || y === 0 || x === w - 1 || y === h - 1 || rng.chance(fill) ? 1 : 0)));
  for (let s = 0; s < steps; s++) g = g.map((row, y) => row.map((_, x) => { let n = 0; for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) n += g[y + j]?.[x + i] ?? 1; return n >= 5 ? 1 : 0; }));
  return { grid: g, rooms: [] };
}

export default class DungeonGen extends NordScript {
  static attributes = { algorithm: { type: 'enum', options: ['bsp', 'cellular'], default: 'bsp' }, size: { type: 'vec2', default: [40, 23] }, seed: { type: 'int', default: 1 }, wallTile: { type: 'int', default: 0 }, floorTile: { type: 'int', default: 1 }, spawnTag: { type: 'string', default: 'player', label: 'Entity to move to the first room' }, tileSize: { type: 'number', default: 16 } };
  start() {
    const a = this.attrs, rng = new Rng(a.seed), { grid, rooms } = (a.algorithm === 'bsp' ? bsp : cellular)(a.size[0], a.size[1], rng);
    const tm = this.entity.getComponent('tilemap');
    if (tm?.setTile) grid.forEach((row, y) => row.forEach((v, x) => tm.setTile(x, y, v ? a.wallTile : a.floorTile)));
    this.grid = grid; this.rooms = rooms; this.events.emit('dungeon:ready', { grid, rooms });
    const p = this.scene.findByTag(a.spawnTag)[0];
    if (p) { const r = rooms[0] ?? this.#openCell(grid); const [x, y] = this.entity.pos; p.pos = [x + (r.cx ?? r[0]) * a.tileSize + a.tileSize / 2, y + (r.cy ?? r[1]) * a.tileSize + a.tileSize / 2, p.pos[2]]; }
  }
  #openCell(g) { for (let y = 1; y < g.length; y++) for (let x = 1; x < g[0].length; x++) if (!g[y][x]) return [x, y]; return [1, 1]; }
}
