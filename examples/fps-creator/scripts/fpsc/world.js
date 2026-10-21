// Collision, line-of-sight, floor height and path-finding for a level. Pure JS (no Babylon/DOM) so it is unit-tested in node.
import { CELL, STORY, key, unkey, ekey, dirVec, edgeCells } from './level.js';
import { hasCorner, cornerBoundary, cellContains, cellCenter, hiddenCornerEdge } from './corners.js';
import { pieceDef as defaultPiece, cellPieceDef as defaultCellPiece, stairDef as defaultStair } from './bank/segments.js';

const EPS = 1e-6;
const cidx = (cx, cz) => cx + cz * 4096;
const Hn = (v) => (v === 'H' ? STORY : v);

/** One solid/opaque box in world space. `door` set → only blocks while the door is (mostly) closed. */
function box(x0, x1, z0, z1, y0, y1, p, door) {
  return { x0, x1, z0, z1, y0, y1, solid: p.solid !== false, opaque: p.opaque !== false, bullet: p.bullet ?? (p.opaque !== false), door: door ?? null };
}

export class World {
  /** @param level normalized level; @param lookup optional { piece(id), cellPiece(id), stair(id) } to include project-defined bank items */
  constructor(level, lookup = {}) {
    this.level = level;
    this.W = level.w; this.D = level.d;
    this.lookup = { piece: lookup.piece ?? defaultPiece, cellPiece: lookup.cellPiece ?? defaultCellPiece, stair: lookup.stair ?? defaultStair };
    this.doors = new Map();      // ekey+layer -> Door
    this.colliders = level.layers.map(() => new Map());
    this.build();
  }

  base(L) { return L * STORY; }

  build() {
    const lv = this.level;
    lv.layers.forEach((ly, L) => {
      const by = this.base(L);
      for (const [k, piece] of Object.entries(ly.edges)) {
        if (hiddenCornerEdge(ly, k)) continue;
        const [ex, ez, o] = unkey(k);
        const def = this.lookup.piece(piece.k);
        if (!def) continue;
        let door = null;
        if (def.door) {
          door = { id: `${L}:${k}`, layer: L, x: ex, z: ez, o, def, style: def.door.style, speed: def.door.speed ?? 1.8, secret: !!def.door.secret, open: 0, target: 0, locked: piece.lock || null, auto: piece.auto !== false && !def.door.secret, name: piece.name || '', piece, flip: !!piece.flip };
          this.doors.set(door.id, door);
        }
        const ox = o === 'H' ? ex * CELL : ex * CELL, oz = o === 'H' ? ez * CELL : ez * CELL;
        const parts = def.parts.map((p) => ({ ...p, y: [Hn(p.y[0]), Hn(p.y[1])] }));
        parts.forEach((p) => {
          if (p.solid === false && p.opaque !== true && p.bullet !== true) return;
          const [t0, t1] = p.t ?? [-0.15, 0.15];
          const th0 = Math.min(t0, t1) - (t0 === t1 ? 0.01 : 0), th1 = Math.max(t0, t1) + (t0 === t1 ? 0.01 : 0);
          const a = p.u[0] * CELL, b = p.u[1] * CELL;
          const c = o === 'H' ? box(ox + a, ox + b, oz + th0, oz + th1, by + p.y[0], by + p.y[1], p, p.leaf ? door : null) : box(ox + th0, ox + th1, oz + a, oz + b, by + p.y[0], by + p.y[1], p, p.leaf ? door : null);
          this.#register(L, c);
        });
      }
      for (const [k, cell] of Object.entries(ly.cells)) {
        if (hasCorner(cell)) {
          const [cx, cz] = unkey(k), points = cornerBoundary(cell, cx, cz);
          for (let i = 1; i < points.length; i++) {
            const [ox, oz] = points[i-1], [ex, ez] = points[i], len = Math.hypot(ex-ox, ez-oz), ux = (ex-ox)/len, uz = (ez-oz)/len;
            const pad = 0.16, r = 0.15, ends = [[-pad,-r],[len+pad,-r],[len+pad,r],[-pad,r]].map(([a,b]) => [ox+ux*a-uz*b, oz+uz*a+ux*b]);
            const c = box(Math.min(...ends.map(p=>p[0])), Math.max(...ends.map(p=>p[0])), Math.min(...ends.map(p=>p[1])), Math.max(...ends.map(p=>p[1])), by + Math.min(0, cell.h || 0), by + STORY, {}, null);
            c.frame = { ox, oz, ux, uz, x0: -pad, x1: len+pad, z0: -r, z1: r };
            this.#register(L, c);
          }
        }
        if (!cell.p) continue;
        const [cx, cz] = unkey(k); const def = this.lookup.cellPiece(cell.p); if (!def) continue;
        const mx = (cx + 0.5) * CELL, mz = (cz + 0.5) * CELL, fy = by + (cell.h || 0);
        for (const p of def.parts) this.#register(L, box(mx + p.x[0], mx + p.x[1], mz + p.z[0], mz + p.z[1], fy + p.y[0], fy + Hn(p.y[1]), p, null));
      }
    });
  }

  #register(L, c) {
    const m = this.colliders[L];
    for (let cx = Math.floor((c.x0 - EPS) / CELL); cx <= Math.floor((c.x1 + EPS) / CELL); cx++) for (let cz = Math.floor((c.z0 - EPS) / CELL); cz <= Math.floor((c.z1 + EPS) / CELL); cz++) {
      const i = cidx(cx, cz); let a = m.get(i); if (!a) m.set(i, (a = [])); a.push(c);
    }
  }

  cellAt(L, cx, cz) { return this.level.layers[L]?.cells[key(cx, cz)] ?? null; }
  inside(x, z) { return x >= 0 && z >= 0 && x <= this.W * CELL && z <= this.D * CELL; }

  // ---- floors -----------------------------------------------------------------------------------------------------------------
  /** Floor surface height of one cell at world (x,z). null = no floor (hole). */
  cellFloorY(L, cell, x, z) {
    let y = this.base(L) + (cell.h || 0);
    if (cell.s) {
      const st = this.lookup.stair(cell.s.id) ?? { rise: STORY, steps: 8 };
      const cx = Math.floor(x / CELL), cz = Math.floor(z / CELL);
      const u = (x - cx * CELL) / CELL, v = (z - cz * CELL) / CELL;
      const t = { N: v, S: 1 - v, E: u, W: 1 - u }[cell.s.d || 'N'];
      const f = Math.max(0, Math.min(0.9999, t));
      y += st.steps > 0 ? Math.min(st.rise, (Math.floor(f * st.steps) + 1) * (st.rise / st.steps)) : f * st.rise;
    }
    return y;
  }

  /** Highest walkable surface at (x,z) not above `maxY`. Returns { y, layer } or null (void). Outdoors (no cell on layer 0) is ground at y=0 when the level has ground. */
  floorAt(x, z, maxY = Infinity) {
    const cx = Math.floor(x / CELL), cz = Math.floor(z / CELL);
    for (let L = this.level.layers.length - 1; L >= 0; L--) {
      const cell = this.cellAt(L, cx, cz);
      if (cell && cell.f && cellContains(cell, x, z, cx, cz)) { const y = this.cellFloorY(L, cell, x, z); if (y <= maxY + EPS) return { y, layer: L }; }
    }
    const c0 = this.cellAt(0, cx, cz); // the cut-away corner of a diagonal/round cell is outdoors again
    if (this.level.settings.ground !== 'none' && (!c0 || !cellContains(c0, x, z, cx, cz))) return 0 <= maxY + EPS ? { y: 0, layer: 0 } : null;
    return null;
  }

  /** Lowest ceiling above height y at (x,z) (Infinity = sky). */
  ceilingAt(x, z, y) {
    const cx = Math.floor(x / CELL), cz = Math.floor(z / CELL);
    let best = Infinity;
    for (let L = 0; L < this.level.layers.length; L++) {
      const cell = this.cellAt(L, cx, cz); if (!cell || !cellContains(cell, x, z, cx, cz)) continue;
      if (cell.c) { const cy = this.base(L) + STORY; if (cy > y + 0.2 && cy < best) best = cy; }
      if (L > 0 && cell.f) { const fy = this.cellFloorY(L, cell, x, z); if (fy > y + 0.2 && fy < best) best = fy; }
    }
    return best;
  }

  // ---- movement ---------------------------------------------------------------------------------------------------------------
  #near(x0, x1, z0, z1, y0, y1, fn) {
    const a = Math.floor(x0 / CELL), b = Math.floor(x1 / CELL), c = Math.floor(z0 / CELL), d = Math.floor(z1 / CELL);
    for (let L = 0; L < this.colliders.length; L++) {
      const by = this.base(L); if (y1 < by - 1 || y0 > by + STORY + 3) continue;
      const m = this.colliders[L];
      for (let cx = a; cx <= b; cx++) for (let cz = c; cz <= d; cz++) { const arr = m.get(cidx(cx, cz)); if (arr) for (const co of arr) fn(co); }
    }
  }

  /** Slide a vertical capsule (circle radius r, from feet y to y+h; obstacles lower than y+0.4 are stepped over) by (dx,dz). Returns { x, z, hit }. */
  moveCircle(x, z, y, h, r, dx, dz) {
    let px = x + dx, pz = z + dz, hit = false;
    const lo = y + 0.4, hi = y + h;
    for (let it = 0; it < 3; it++) {
      let moved = false;
      this.#near(px - r, px + r, pz - r, pz + r, y, hi, (c) => {
        if (!c.solid || c.y1 <= lo || c.y0 >= hi) return;
        if (c.door && c.door.open >= 0.8) return;
        const f = c.frame, b = f ?? c;
        let lx = f ? (px-f.ox)*f.ux + (pz-f.oz)*f.uz : px, lz = f ? -(px-f.ox)*f.uz + (pz-f.oz)*f.ux : pz;
        const qx = Math.max(b.x0, Math.min(lx, b.x1)), qz = Math.max(b.z0, Math.min(lz, b.z1));
        let ex = lx - qx, ez = lz - qz; const d2 = ex * ex + ez * ez;
        if (d2 >= r * r) return;
        if (d2 > EPS) { const d = Math.sqrt(d2), k = (r - d) / d; lx += ex * k; lz += ez * k; }
        else { // centre inside the box: leave through the nearest face
          const l = lx - b.x0, rr = b.x1 - lx, bot = lz - b.z0, top = b.z1 - lz, m = Math.min(l, rr, bot, top);
          if (m === l) lx = b.x0 - r; else if (m === rr) lx = b.x1 + r; else if (m === bot) lz = b.z0 - r; else lz = b.z1 + r;
        }
        px = f ? f.ox + lx*f.ux - lz*f.uz : lx; pz = f ? f.oz + lx*f.uz + lz*f.ux : lz;
        moved = true; hit = true;
      });
      if (!moved) break;
    }
    return { x: px, z: pz, hit };
  }

  // ---- rays -------------------------------------------------------------------------------------------------------------------
  /** Cast a ray. mask: 'sight' (opaque), 'bullet' (shot-blocking) or 'move' (solid). Returns { t, x, y, z, nx, nz, c } for the nearest hit or null. */
  ray(ox, oy, oz, dx, dy, dz, maxD, mask = 'bullet', slabs = mask === 'bullet') {
    const len = Math.hypot(dx, dy, dz); if (len < EPS) return null;
    dx /= len; dy /= len; dz /= len;
    const ex = ox + dx * maxD, ez = oz + dz * maxD;
    const seen = new Set(); let best = null;
    const test = (c) => {
      if (seen.has(c)) return; seen.add(c);
      if (mask === 'sight' ? !c.opaque : mask === 'bullet' ? !c.bullet : !c.solid) return;
      if (c.door && c.door.open >= 0.8) return;
      let t0 = 0, t1 = maxD, nx = 0, nz = 0;
      const slab = (o, d, lo, hi, axis) => {
        if (Math.abs(d) < EPS) return o >= lo && o <= hi;
        let a = (lo - o) / d, b = (hi - o) / d, n = d > 0 ? -1 : 1; if (a > b) { [a, b] = [b, a]; }
        if (a > t0) { t0 = a; nx = axis === 'x' ? n : 0; nz = axis === 'z' ? n : 0; }
        if (b < t1) t1 = b;
        return t0 <= t1;
      };
      const f = c.frame, b = f ?? c;
      const lx = f ? (ox-f.ox)*f.ux+(oz-f.oz)*f.uz : ox, lz = f ? -(ox-f.ox)*f.uz+(oz-f.oz)*f.ux : oz;
      const vx = f ? dx*f.ux+dz*f.uz : dx, vz = f ? -dx*f.uz+dz*f.ux : dz;
      if (!slab(lx, vx, b.x0, b.x1, 'x') || !slab(lz, vz, b.z0, b.z1, 'z') || !slab(oy, dy, c.y0, c.y1, 'y')) return;
      if (t0 < 0 || t0 > maxD) { if (!(t0 < 0 && t1 > 0)) return; t0 = 0; }
      if (f) { const n = nx; nx = n*f.ux-nz*f.uz; nz = n*f.uz+nz*f.ux; }
      if (!best || t0 < best.t) best = { t: t0, x: ox + dx * t0, y: oy + dy * t0, z: oz + dz * t0, nx, nz, c };
    };
    // 2D DDA across the grid
    let cx = Math.floor(ox / CELL), cz = Math.floor(oz / CELL);
    const ecx = Math.floor(ex / CELL), ecz = Math.floor(ez / CELL);
    const sx = dx > 0 ? 1 : -1, sz = dz > 0 ? 1 : -1;
    const tdx = Math.abs(dx) < EPS ? Infinity : Math.abs(CELL / dx), tdz = Math.abs(dz) < EPS ? Infinity : Math.abs(CELL / dz);
    let tmx = Math.abs(dx) < EPS ? Infinity : ((dx > 0 ? (cx + 1) * CELL - ox : ox - cx * CELL) / Math.abs(dx));
    let tmz = Math.abs(dz) < EPS ? Infinity : ((dz > 0 ? (cz + 1) * CELL - oz : oz - cz * CELL) / Math.abs(dz));
    for (let i = 0; i < 400; i++) {
      for (const dxc of [-1, 0, 1]) for (const dzc of [-1, 0, 1]) { // thin walls sit on cell borders → also look at the neighbours
        for (let L = 0; L < this.colliders.length; L++) { const arr = this.colliders[L].get(cidx(cx + dxc, cz + dzc)); if (arr) arr.forEach(test); }
      }
      if (best && best.t <= Math.min(tmx, tmz)) break;
      if ((cx === ecx && cz === ecz) || Math.min(tmx, tmz) > maxD) break;
      if (tmx < tmz) { cx += sx; tmx += tdx; } else { cz += sz; tmz += tdz; }
    }
    if (slabs) { const h = this.#slabHit(ox, oy, oz, dx, dy, dz, maxD); if (h && (!best || h.t < best.t)) best = h; }
    return best;
  }

  /** Floors and ceilings stop shots and sight: first flat floor/ceiling slab crossed by the ray (stairs and raised cells are skipped). */
  #slabHit(ox, oy, oz, dx, dy, dz, maxD) {
    if (Math.abs(dy) < EPS) return null;
    let best = null;
    for (let L = 0; L < this.level.layers.length; L++) for (const ceil of [false, true]) {
      const y = this.base(L) + (ceil ? STORY : 0); if (!ceil && L === 0) continue;
      const t = (y - oy) / dy; if (t <= EPS || t > maxD || (best && t >= best.t)) continue;
      const x = ox + dx * t, z = oz + dz * t, cx = Math.floor(x / CELL), cz = Math.floor(z / CELL), cell = this.cellAt(L, cx, cz);
      if (!cell || cell.s || (cell.h && !ceil) || !(ceil ? cell.c : cell.f) || !cellContains(cell, x, z, cx, cz)) continue;
      best = { t, x, y, z, nx: 0, nz: 0, ny: dy > 0 ? -1 : 1, c: { slab: true } };
    }
    return best;
  }

  /** Is the straight line between two 3D points free of sight-blocking pieces? */
  los(a, b) {
    const dx = b[0] - a[0], dy = b[1] - a[1], dz = b[2] - a[2], d = Math.hypot(dx, dy, dz);
    if (d < EPS) return true;
    const h = this.ray(a[0], a[1], a[2], dx, dy, dz, d - 0.05, 'sight', true);
    return !h;
  }

  // ---- navigation ------------------------------------------------------------------------------------------------------------
  /** Free gap (in u 0..1) of an edge piece for a walker 1.7 m tall? Returns the widest free [u0,u1] or null. `doors`: 'open' = closed doors count as free, 'none' = doors block. */
  edgeGap(L, x, z, o, doors = 'open') {
    const ly = this.level.layers[L];
    if (ly && hiddenCornerEdge(ly, ekey(x,z,o))) return null;
    const piece = ly?.edges[ekey(x, z, o)];
    if (!piece) return [0, 1];
    const def = this.lookup.piece(piece.k); if (!def) return [0, 1];
    const door = this.doors.get(`${L}:${ekey(x, z, o)}`);
    const iv = [];
    for (const p of def.parts) {
      if (p.solid === false) continue;
      const y0 = Hn(p.y[0]), y1 = Hn(p.y[1]);
      if (y1 <= 0.4 || y0 >= 1.7) continue;
      if (p.leaf && door && (doors === 'open' && !door.secret && (!door.locked || doors === 'all'))) continue;
      iv.push(p.u);
    }
    iv.sort((a, b) => a[0] - b[0]);
    let best = null, cur = 0;
    for (const [a, b] of iv) { if (a - cur > 0.18 && (!best || a - cur > best[1] - best[0])) best = [cur, a]; cur = Math.max(cur, b); }
    if (1 - cur > 0.18 && (!best || 1 - cur > best[1] - best[0])) best = [cur, 1];
    return best;
  }

  #cellWalkable(L, cx, cz) {
    if (cx < 0 || cz < 0 || cx >= this.W || cz >= this.D) return false;
    const cell = this.cellAt(L, cx, cz);
    if (!cell) return L === 0 && this.level.settings.ground !== 'none';
    if (!cell.f) return false;
    if (cell.p) { const d = this.lookup.cellPiece(cell.p); if (d && d.parts.some((p) => p.x[1] - p.x[0] > 3 && p.solid !== false)) return false; }
    return true;
  }

  /** A* over cells: from/to = { layer, x, z } in world metres. Returns [{x,z,layer}] (world centres, start excluded) or null. */
  path(from, to, { doors = 'open', maxNodes = 3000 } = {}) {
    const sx = Math.floor(from.x / CELL), sz = Math.floor(from.z / CELL), tx = Math.floor(to.x / CELL), tz = Math.floor(to.z / CELL);
    const nL = this.level.layers.length;
    const id = (L, x, z) => (L * this.D + z) * this.W + x;
    if (!this.#cellWalkable(to.layer, tx, tz) || !cellContains(this.cellAt(to.layer, tx, tz), to.x, to.z) || !cellContains(this.cellAt(from.layer, sx, sz), from.x, from.z)) return null;
    const start = id(from.layer, sx, sz), goal = id(to.layer, tx, tz);
    if (start === goal) return [{ x: to.x, z: to.z, layer: to.layer }];
    const g = new Map([[start, 0]]), prev = new Map(), open = [[0, start, from.layer, sx, sz]], closed = new Set();
    const h = (x, z) => Math.hypot(x - tx, z - tz);
    let n = 0;
    while (open.length && n++ < maxNodes) {
      let bi = 0; for (let i = 1; i < open.length; i++) if (open[i][0] < open[bi][0]) bi = i;
      const [, cur, L, x, z] = open.splice(bi, 1)[0];
      if (cur === goal) {
        const out = []; let c = cur;
        while (c !== start) { const [cL, cxx, czz] = [Math.floor(c / (this.W * this.D)), c % this.W, Math.floor(c / this.W) % this.D]; const [wx,wz] = cellCenter(this.cellAt(cL,cxx,czz),cxx,czz); out.push({ x: wx, z: wz, layer: cL }); c = prev.get(c); }
        out.reverse(); out[out.length - 1] = { x: to.x, z: to.z, layer: to.layer }; return out;
      }
      if (closed.has(cur)) continue; closed.add(cur);
      const tryMove = (nx, nz, nL2, edge, cost) => {
        if (!this.#cellWalkable(nL2, nx, nz)) return;
        if (edge && !this.edgeGap(...edge, doors)) return;
        const nid = id(nL2, nx, nz); if (closed.has(nid)) return;
        const ng = g.get(cur) + cost;
        if (ng < (g.get(nid) ?? Infinity)) { g.set(nid, ng); prev.set(nid, cur); open.push([ng + h(nx, nz), nid, nL2, nx, nz]); }
      };
      const edgeOf = (d) => { const [ex, ez, o] = ({ N: [x, z + 1, 'H'], S: [x, z, 'H'], E: [x + 1, z, 'V'], W: [x, z, 'V'] })[d]; return [L, ex, ez, o]; };
      for (const d of ['N', 'E', 'S', 'W']) { const [dx, dz] = dirVec[d]; tryMove(x + dx, z + dz, L, edgeOf(d), 1); }
      for (const [a, b] of [['N', 'E'], ['N', 'W'], ['S', 'E'], ['S', 'W']]) { // diagonals only when both straight neighbours are open
        const [ax, az] = dirVec[a], [bx, bz] = dirVec[b];
        if ([[x,z],[x+ax,z+az],[x+bx,z+bz],[x+ax+bx,z+az+bz]].some(([cx,cz]) => hasCorner(this.cellAt(L,cx,cz)))) continue;
        if (this.edgeGap(...edgeOf(a), doors) && this.edgeGap(...edgeOf(b), doors) && this.#cellWalkable(L, x + ax, z + az) && this.#cellWalkable(L, x + bx, z + bz)) tryMove(x + ax + bx, z + az + bz, L, null, 1.45);
      }
      const cell = this.cellAt(L, x, z);
      if (cell?.s && L + 1 < nL) { const [dx, dz] = dirVec[cell.s.d || 'N']; const st = this.lookup.stair(cell.s.id); if (st && st.rise >= STORY - 0.1) tryMove(x + dx, z + dz, L + 1, null, 2); }
      if (L > 0) { // coming down: the stair cell below whose top exit is this cell
        for (const d of ['N', 'E', 'S', 'W']) { const [dx, dz] = dirVec[d]; const below = this.cellAt(L - 1, x - dx, z - dz); if (below?.s && (below.s.d || 'N') === d) tryMove(x - dx, z - dz, L - 1, null, 2); }
      }
    }
    return null;
  }
}
