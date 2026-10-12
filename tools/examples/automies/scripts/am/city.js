// Automies — the city as data: parses assets/maps/haven.map (ASCII, one character per 18 m tile) into road pieces, building colliders, a road graph for
// traffic / cop path-finding, checkpoints and spawn points. Pure (no Babylon) so it can be unit-tested with node.
export const TILE = 18;
export const ASPHALT_HALF = 5.4;           // half width of the Kenney road tile's asphalt at 18 m tiles (60 % of the tile)
export const LANE = 2.7;                    // lane centre offset from the road centre line
const DIRS = [{ n: 'N', dx: 0, dy: -1 }, { n: 'E', dx: 1, dy: 0 }, { n: 'S', dx: 0, dy: 1 }, { n: 'W', dx: -1, dy: 0 }]; // N = −Z, E = +X, S = +Z, W = −X
export const DIR_VEC = DIRS.map((d) => [d.dx, d.dy]);
export const dirYaw = (d) => [Math.PI, Math.PI / 2, 0, -Math.PI / 2][d];    // heading (forward = (sin yaw, cos yaw)) of N, E, S, W
export const right = (d) => (d + 1) % 4;

// What each map character is. `solid` blocks cars (half = half extent of the collision box in metres), `model` is the thing to draw.
export const LEGEND = {
  '+': { kind: 'road' }, '.': { kind: 'pave' }, '~': { kind: 'water', solid: true, half: TILE / 2 },
  g: { kind: 'park' }, f: { kind: 'fountain', round: 3.6 },
  1: { kind: 'tower', model: 'tower_a', solid: true, half: 7.4 }, 2: { kind: 'tower', model: 'tower_b', solid: true, half: 7.4 }, 3: { kind: 'tower', model: 'tower_c', solid: true, half: 6.6 }, 4: { kind: 'tower', model: 'tower_d', solid: true, half: 7.4 },
  a: { kind: 'kenney', model: 'building-small-a', h: 15, solid: true, half: 7.6 }, b: { kind: 'kenney', model: 'building-small-b', h: 26, solid: true, half: 7.6 },
  c: { kind: 'kenney', model: 'building-small-c', h: 28, solid: true, half: 7.6 }, d: { kind: 'kenney', model: 'building-small-d', h: 16, solid: true, half: 7.6 }, y: { kind: 'kenney', model: 'building-garage', h: 9, solid: true, half: 7.6 },
  B: { kind: 'landmark', model: 'bank', solid: true, half: 8.2 }, H: { kind: 'landmark', model: 'warehouse', solid: true, half: 8 }, S: { kind: 'landmark', model: 'safehouse', solid: true, half: 7.4 },
};

export function parseCity(text) {
  const city = { tile: TILE, cps: [], starts: [], copSpawns: [], meta: {}, rows: [] };
  let grid = false;
  for (const raw of text.split(/\r?\n/)) {
    if (grid) { if (raw.trim()) city.rows.push(raw.trimEnd()); continue; }
    if (raw.startsWith('---')) { grid = true; continue; }
    const t = raw.match(/^@\s*(\w+)\s*:\s*(.*)$/); if (t) { city.meta[t[1]] = t[2]; continue; }
    const p = raw.trim().split(/\s+/);
    if (p[0] === 'C') city.cps.push({ cx: +p[1], cy: +p[2] });
    else if (p[0] === 'P') city.starts.push({ slot: +p[1], cx: +p[2], cy: +p[3], yaw: (+p[4] * Math.PI) / 180, ox: +p[5] || 0, oz: +p[6] || 0 });
    else if (p[0] === 'K') city.copSpawns.push({ cx: +p[1], cy: +p[2] });
    else if (p[0] === 'W') (city.works ??= []).push({ cx: +p[1], cy: +p[2] });
  }
  city.w = Math.max(...city.rows.map((r) => r.length)); city.h = city.rows.length;
  city.at = (cx, cy) => (cx < 0 || cy < 0 || cx >= city.w || cy >= city.h ? '~' : city.rows[cy][cx] ?? '~');
  city.isRoad = (cx, cy) => city.at(cx, cy) === '+';
  city.center = (cx, cy) => [cx * TILE + TILE / 2, cy * TILE + TILE / 2];
  city.cellOf = (x, z) => [Math.floor(x / TILE), Math.floor(z / TILE)];
  city.size = [city.w * TILE, city.h * TILE];
  // road pieces: neighbour mask N=1 E=2 S=4 W=8
  city.roads = [];
  for (let cy = 0; cy < city.h; cy++) for (let cx = 0; cx < city.w; cx++) {
    if (!city.isRoad(cx, cy)) continue;
    let m = 0; DIRS.forEach((d, i) => { if (city.isRoad(cx + d.dx, cy + d.dy)) m |= 1 << i; });
    city.roads.push({ cx, cy, mask: m, ...roadPiece(m, cx, cy) });
  }
  // static colliders: axis-aligned boxes + circles
  city.boxes = []; city.circles = [];
  for (let cy = 0; cy < city.h; cy++) for (let cx = 0; cx < city.w; cx++) {
    const e = LEGEND[city.at(cx, cy)]; if (!e) continue; const [x, z] = city.center(cx, cy);
    if (e.solid) city.boxes.push({ x, z, hx: e.half, hz: e.half, cx, cy, kind: e.kind, ch: city.at(cx, cy) });
    if (e.round) city.circles.push({ x, z, r: e.round });
    if (e.kind === 'park') for (const [dx, dz] of TREES) city.circles.push({ x: x + dx, z: z + dz, r: 0.9 });
  }
  // props: deterministic street furniture (the view draws them, the physics gets matching colliders)
  city.props = [];
  const hash = (x, y, k) => { let h = (x * 374761393 + y * 668265263 + k * 2147483647) | 0; h = (h ^ (h >>> 13)) * 1274126177; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
  for (const r of city.roads) {
    if (!(r.mask === 5 || r.mask === 10)) continue; const [x, z] = city.center(r.cx, r.cy), alongZ = r.mask === 5, off = ASPHALT_HALF + 1.3;
    const side = hash(r.cx, r.cy, 1) < 0.5 ? -1 : 1;
    if (hash(r.cx, r.cy, 2) < 0.22) { const p = { kind: 'hydrant', x: alongZ ? x + side * off : x + (hash(r.cx, r.cy, 3) - 0.5) * 8, z: alongZ ? z + (hash(r.cx, r.cy, 3) - 0.5) * 8 : z + side * off, yaw: 0, r: 0.35 }; city.props.push(p); city.circles.push({ x: p.x, z: p.z, r: p.r }); }
    if (hash(r.cx, r.cy, 4) < 0.18) { const p = { kind: 'bin', x: alongZ ? x - side * off : x + (hash(r.cx, r.cy, 5) - 0.5) * 8, z: alongZ ? z + (hash(r.cx, r.cy, 5) - 0.5) * 8 : z - side * off, yaw: 0, r: 0.45 }; city.props.push(p); city.circles.push({ x: p.x, z: p.z, r: p.r }); }
  }
  for (const w of city.works ?? []) { // roadworks: a barrier across the right-hand lane, cones leading up to it
    const m = city.roads.find((r) => r.cx === w.cx && r.cy === w.cy)?.mask, [x, z] = city.center(w.cx, w.cy); if (m !== 5 && m !== 10) continue; const alongZ = m === 5;
    const bx = alongZ ? x + LANE : x, bz = alongZ ? z : z + LANE;   // right lane when driving in the + direction
    city.props.push({ kind: 'barrier', x: bx, z: bz, yaw: alongZ ? 0 : Math.PI / 2, r: 0 });
    city.boxes.push({ x: bx, z: bz, hx: alongZ ? 2.8 : 0.35, hz: alongZ ? 0.35 : 2.8, cx: w.cx, cy: w.cy, kind: 'barrier', ch: 'W' });
    for (const k of [-1, 1]) for (const d of [3.5, 5.5]) city.props.push({ kind: 'cone', x: alongZ ? bx + (k * 0.3) : bx + k * d, z: alongZ ? bz + k * d : bz + (k * 0.3), yaw: 0, r: 0 });
  }
  city.solidAt = (x, z) => { const [cx, cy] = city.cellOf(x, z); for (const b of city.boxes) if (Math.abs(b.cx - cx) <= 1 && Math.abs(b.cy - cy) <= 1 && Math.abs(x - b.x) < b.hx && Math.abs(z - b.z) < b.hz && b.kind !== 'barrier') return true; return false; };
  city.grass = (x, z) => { const [cx, cy] = city.cellOf(x, z); const c = city.at(cx, cy); return c === 'g' || c === 'f'; };
  // road graph: nodes are road cells, edges to road neighbours
  // roadworks cells are not routable for traffic / police path-finding (players can still drive through the open half)
  const worksSet = new Set((city.works ?? []).map((w) => w.cy * 1000 + w.cx)); city.isWorks = (cx, cy) => worksSet.has(cy * 1000 + cx);
  city.nbrs = (cx, cy) => DIRS.map((d, i) => [i, cx + d.dx, cy + d.dy]).filter(([, x, y]) => city.isRoad(x, y) && !city.isWorks(x, y));
  city.path = (from, to) => bfs(city, from, to);
  return city;
}
export const TREES = [[-4.5, -4.5], [4.5, -4.5], [-4.5, 4.5], [4.5, 4.5], [0, -5], [-5, 1], [5, 0], [1, 5.2]]; // tree positions inside a park cell (the view uses the same list)

/** Which Kenney piece and rotation (radians about Y) for a neighbour mask. Verified against the models: straight runs along Z; corner joins +Z/+X; split is open +Z/+X/−X. */
function roadPiece(m, cx, cy) {
  const N = m & 1, E = m & 2, S = m & 4, W = m & 8, n = !!N + !!E + !!S + !!W, Q = Math.PI / 2;
  if (n === 4) return { piece: 'road-intersection', rot: 0 };
  if (n === 3) return { piece: 'road-split', rot: !N ? 0 : !W ? Q : !S ? 2 * Q : 3 * Q };
  if (n === 2 && !(N && S) && !(E && W)) return { piece: 'road-corner', rot: S && E ? 0 : E && N ? Q : N && W ? 2 * Q : 3 * Q };
  const alongX = (E || W) && !(N || S);
  return { piece: (cx + cy) % 3 === 0 ? 'road-straight-lightposts' : 'road-straight', rot: alongX ? Q : 0 };
}
function bfs(city, a, b) {
  const key = (x, y) => y * 1000 + x, prev = new Map([[key(...a), null]]), q = [a];
  while (q.length) {
    const [x, y] = q.shift(); if (x === b[0] && y === b[1]) break;
    for (const [, nx, ny] of city.nbrs(x, y)) if (!prev.has(key(nx, ny))) { prev.set(key(nx, ny), [x, y]); q.push([nx, ny]); }
  }
  if (!prev.has(key(...b))) return null;
  const out = []; for (let c = b; c; c = prev.get(key(...c))) out.unshift(c); return out;
}
/** Checkpoint world position (road centre) and the facing needed to drive towards the next one. */
export const cpWorld = (city, i) => { const c = city.cps[i]; const [x, z] = city.center(c.cx, c.cy); return { x, z }; };
