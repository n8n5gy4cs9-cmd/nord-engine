// Level → triangle batches (pure data) + baked vertex lighting. No Babylon here, so it is unit-tested in node; render.js turns batches into meshes.
import { CELL, STORY, unkey, ekey } from './level.js';

import { hasCorner, cornerBoundary, cellPolygon, hiddenCornerEdge } from './corners.js';

const Hn = (v) => (v === 'H' ? STORY : v);
const MAXE = 2; // longest quad edge in metres (finer = smoother baked light, more vertices)

export class Batch {
  constructor(tex) { this.tex = tex; this.pos = []; this.nor = []; this.uv = []; this.idx = []; this.col = null; }
  get verts() { return this.pos.length / 3; }
}

/** UVs are world-aligned (metres / tile) so a texture runs on seamlessly across neighbouring pieces. */
function uvOf(n, x, y, z, tile) {
  if (n[0]) return [z / tile, y / tile];
  if (n[1]) return [x / tile, z / tile];
  return [x / tile, y / tile];
}

/** Axis-aligned face: normal axis 'x'|'y'|'z' with sign, spanning [a0,a1]x[b0,b1] at constant c. ox/oy/oz = local origin subtracted from positions. */
function face(batch, axis, sign, c, a0, a1, b0, b1, tile, uvOrigin = [0, 0, 0], posOrigin = [0, 0, 0]) {
  if (a1 - a0 < 1e-5 || b1 - b0 < 1e-5) return;
  const n = axis === 'x' ? [sign, 0, 0] : axis === 'y' ? [0, sign, 0] : [0, 0, sign];
  const na = Math.max(1, Math.ceil((a1 - a0) / MAXE - 1e-6)), nb = Math.max(1, Math.ceil((b1 - b0) / MAXE - 1e-6));
  const base = batch.verts;
  for (let j = 0; j <= nb; j++) for (let i = 0; i <= na; i++) {
    const A = a0 + ((a1 - a0) * i) / na, B = b0 + ((b1 - b0) * j) / nb;
    const p = axis === 'x' ? [c, A, B] : axis === 'y' ? [A, c, B] : [A, B, c]; // x:(y,z) y:(x,z) z:(x,y)
    const uv = uvOf(n, p[0] + uvOrigin[0], p[1] + uvOrigin[1], p[2] + uvOrigin[2], tile);
    batch.pos.push(p[0] - posOrigin[0], p[1] - posOrigin[1], p[2] - posOrigin[2]); batch.nor.push(n[0], n[1], n[2]); batch.uv.push(uv[0], uv[1]);
  }
  for (let j = 0; j < nb; j++) for (let i = 0; i < na; i++) {
    const a = base + j * (na + 1) + i, b = a + 1, d = a + na + 1, e = d + 1;
    if ((sign > 0) === (axis !== 'y')) batch.idx.push(a, d, b, b, d, e); else batch.idx.push(a, b, d, b, e, d);
  }
}

/** A box with per-face texture batches: faces = { px, nx, py, ny, pz, nz } → Batch (missing/null = face skipped). */
function box(faces, x0, x1, y0, y1, z0, z1, tiles, posOrigin, uvOrigin) {
  const o = [posOrigin, uvOrigin];
  if (faces.px) face(faces.px, 'x', 1, x1, y0, y1, z0, z1, tiles.px, o[1], o[0]);
  if (faces.nx) face(faces.nx, 'x', -1, x0, y0, y1, z0, z1, tiles.nx, o[1], o[0]);
  if (faces.py) face(faces.py, 'y', 1, y1, x0, x1, z0, z1, tiles.py, o[1], o[0]);
  if (faces.ny) face(faces.ny, 'y', -1, y0, x0, x1, z0, z1, tiles.ny, o[1], o[0]);
  if (faces.pz) face(faces.pz, 'z', 1, z1, x0, x1, y0, y1, tiles.pz, o[1], o[0]);
  if (faces.nz) face(faces.nz, 'z', -1, z0, x0, x1, y0, y1, tiles.nz, o[1], o[0]);
}

/**
 * Build all static geometry. `bank` = { texture(id) → { size, alpha?, alphaTest? } | null, piece(id), cellPiece(id), stair(id) }.
 * Returns { batches: Map<texId, Batch>, doors: [{ door, leaves: [{ pivot:[x,y,z], batches: Map }], style }], lights: [] }.
 */
export function buildGeometry(world, level, bank, opts = {}) {
  const ceilings = opts.ceilings !== false, maxLayer = opts.maxLayer ?? Infinity;
  const batches = new Map();
  const batchFor = (texId) => { const id = bank.texture(texId) ? texId : 'concrete'; let b = batches.get(id); if (!b) batches.set(id, (b = new Batch(id))); return b; };
  const tileOf = (id) => bank.texture(id)?.size ?? 2;
  const doors = [];
  const nodeUsed = (L, x, z, selfKey) => {
    const e = level.layers[L].edges;
    return [ekey(x - 1, z, 'H'), ekey(x, z, 'H'), ekey(x, z - 1, 'V'), ekey(x, z, 'V')].some((k) => k !== selfKey && e[k]);
  };

  level.layers.forEach((ly, L) => {
    if (L > maxLayer) return;
    const by = L * STORY;
    const hasFloorAbove = (cx, cz) => { for (let l2 = L + 1; l2 < level.layers.length; l2++) { const above=level.layers[l2].cells[`${cx},${cz}`], cell=ly.cells[`${cx},${cz}`]; if(above?.f && (!hasCorner(above) || hasCorner(cell) && above.shape.kind===cell.shape.kind && above.shape.corner===cell.shape.corner)) return true; } return false; };
    // ---- cells: floors, ceilings, stairs, raised platforms, pillars
    for (const [k, cell] of Object.entries(ly.cells)) {
      const [cx, cz] = unkey(k); const x0 = cx * CELL, x1 = x0 + CELL, z0 = cz * CELL, z1 = z0 + CELL;
      const fy = by + (cell.h || 0);
      if (hasCorner(cell)) {
        const below=level.layers[L-1]?.cells[k], underside=!(below?.c && (!hasCorner(below)||below.shape.kind===cell.shape.kind&&below.shape.corner===cell.shape.corner));
        emitCorner(cell, cx, cz, by, ceilings && !hasFloorAbove(cx,cz), batchFor, tileOf, ly, underside);
        continue;
      }
      if (cell.f) {
        const fb = batchFor(cell.f), ft = tileOf(cell.f);
        if (cell.s) buildStairs(world, cell, L, cx, cz, fb, ft, batchFor);
        else {
          face(fb, 'y', 1, fy, x0, x1, z0, z1, ft);
          if (L > 0) face(fb, 'y', -1, fy, x0, x1, z0, z1, ft);
          // platform sides / pit walls toward lower or missing neighbours
          for (const [dx, dz, axis, sign, c, a0, a1, b0, b1] of [[1, 0, 'x', 1, x1, 0, 0, z0, z1], [-1, 0, 'x', -1, x0, 0, 0, z0, z1], [0, 1, 'z', 1, z1, x0, x1, 0, 0], [0, -1, 'z', -1, z0, x0, x1, 0, 0]]) {
            const nb = ly.cells[`${cx + dx},${cz + dz}`];
            const ny = nb && nb.f ? by + (nb.h || 0) + (nb.s ? 0 : 0) : (L === 0 && !nb ? 0 : null);
            if (ny === null || nb?.s) continue;
            if (ny < fy - 1e-3) { if (axis === 'x') face(fb, 'x', sign, c, ny, fy, b0, b1, ft); else face(fb, 'z', sign, c, a0, a1, ny, fy, ft); }
            else if (ny > fy + 1e-3) { if (axis === 'x') face(fb, 'x', -sign, c, fy, ny, b0, b1, ft); else face(fb, 'z', -sign, c, a0, a1, fy, ny, ft); }
          }
        }
      }
      if (ceilings && cell.c && !hasFloorAbove(cx, cz)) face(batchFor(cell.c), 'y', -1, by + STORY, x0, x1, z0, z1, tileOf(cell.c));
      if (cell.p) {
        const def = world.lookup.cellPiece(cell.p);
        if (def) for (const p of def.parts) {
          const mx = (cx + 0.5) * CELL, mz = (cz + 0.5) * CELL;
          if (p.vis === false) continue;
          const bt = batchFor(cell.pt || 'concrete');
          box({ px: bt, nx: bt, py: bt, ny: null, pz: bt, nz: bt }, mx + p.x[0], mx + p.x[1], fy + p.y[0], fy + Hn(p.y[1]), mz + p.z[0], mz + p.z[1], { px: tileOf(bt.tex), nx: tileOf(bt.tex), py: tileOf(bt.tex), ny: 2, pz: tileOf(bt.tex), nz: tileOf(bt.tex) });
        }
      }
    }
    // ---- edge pieces
    for (const [k, piece] of Object.entries(ly.edges)) {
      if (hiddenCornerEdge(ly, k)) continue;
      const [ex, ez, o] = unkey(k); const def = world.lookup.piece(piece.k); if (!def) continue;
      const door = world.doors.get(`${L}:${k}`);
      const mats = { main: piece.t || 'concrete', trim: piece.tt || def.tt || 'metal_panel', door: piece.td || 'door_metal', glass: piece.tg || 'glass', mesh: 'fence_mesh' };
      const ctx = {
        o, ox: ex * CELL, oz: ez * CELL, by, mats, back: piece.tb || mats.main,
        startUsed: nodeUsed(L, ex, ez, k), endUsed: nodeUsed(L, o === 'H' ? ex + 1 : ex, o === 'H' ? ez : ez + 1, k),
      };
      const groups = [];
      for (const p of def.parts) {
        if (p.vis === false) continue;
        if (!(p.leaf && door)) { emitPart(p, ctx, batchFor, tileOf, null); continue; }
        // moving door leaf: its own geometry per animated group (side doors split into two halves that slide apart)
        const [xa, xb, za, zb] = partBox(p, ctx);
        const along = o === 'H' ? [xa, xb] : [za, zb], mid = (along[0] + along[1]) / 2;
        const pv = (v) => (o === 'H' ? [v, by, ctx.oz] : [ctx.ox, by, v]);
        const spec = door.style === 'side' ? [{ lo: along[0], hi: mid, pivot: pv(along[0]), half: -1 }, { lo: mid, hi: along[1], pivot: pv(mid), half: 1 }]
          : door.style === 'swing' ? [{ lo: along[0], hi: along[1], pivot: pv(along[0]), half: 0 }] : [{ lo: along[0], hi: along[1], pivot: pv(mid), half: 0 }];
        for (const sp of spec) {
          const batches = new Map(), bf = (id) => { const t = bank.texture(id) ? id : 'concrete'; if (!batches.has(t)) { const nb = new Batch(t); nb.origin = sp.pivot; batches.set(t, nb); } return batches.get(t); };
          emitPart({ ...p, u: o === 'H' ? [(sp.lo - ctx.ox) / CELL, (sp.hi - ctx.ox) / CELL] : [(sp.lo - ctx.oz) / CELL, (sp.hi - ctx.oz) / CELL] }, { ...ctx, startUsed: false, endUsed: false }, bf, tileOf, sp.pivot);
          groups.push({ pivot: sp.pivot, half: sp.half, batches });
        }
      }
      if (door) doors.push({ door, leaves: groups, style: door.style });
    }
  });
  // ground plane etc. is created by the renderer
  return { batches, doors };
}

/** Subdivide cut floors for the same baked-light density as rectangular floors. */
function triangleSurface(batch, a, b, c, y, sign, tile) {
  if (Math.max(Math.hypot(a[0]-b[0],a[1]-b[1]),Math.hypot(b[0]-c[0],b[1]-c[1]),Math.hypot(c[0]-a[0],c[1]-a[1])) > MAXE + 1e-6) {
    const mid = (p,q) => [(p[0]+q[0])/2,(p[1]+q[1])/2], ab=mid(a,b),bc=mid(b,c),ca=mid(c,a);
    for (const t of [[a,ab,ca],[ab,b,bc],[ca,bc,c],[ab,bc,ca]]) triangleSurface(batch,...t,y,sign,tile);
    return;
  }
  const n = batch.verts;
  for (const p of [a,b,c]) { batch.pos.push(p[0],y,p[1]); batch.nor.push(0,sign,0); batch.uv.push(p[0]/tile,p[1]/tile); }
  batch.idx.push(...(sign > 0 ? [n,n+2,n+1] : [n,n+1,n+2]));
}
function emitCorner(cell, cx, cz, by, ceiling, batchFor, tileOf, layer, underside) {
  const polygon = cellPolygon(cell,cx,cz), fy = by+(cell.h||0), boundary=cornerBoundary(cell,cx,cz);
  if (cell.f) for (let i=1;i<polygon.length-1;i++) {
    triangleSurface(batchFor(cell.f),polygon[0],polygon[i],polygon[i+1],fy,1,tileOf(cell.f));
    if (by > 0 && underside) triangleSurface(batchFor(cell.f),polygon[0],polygon[i],polygon[i+1],fy,-1,tileOf(cell.f));
  }
  // Retained straight edges keep the same step/pit skirts as square cells.
  if(cell.f && cell.h) for(let i=0;i<polygon.length;i++) {
    const a=polygon[i],b=polygon[(i+1)%polygon.length]; let neighbour;
    if(Math.abs(a[0]-b[0])<1e-6) neighbour=layer.cells[`${cx+(a[0]< (cx+0.5)*CELL?-1:1)},${cz}`];
    else if(Math.abs(a[1]-b[1])<1e-6) neighbour=layer.cells[`${cx},${cz+(a[1]< (cz+0.5)*CELL?-1:1)}`]; else continue;
    if(neighbour?.s)continue;
    const ny=neighbour?.f?by+(neighbour.h||0):by, lo=Math.min(ny,fy),hi=Math.max(ny,fy);
    if(hi-lo<1e-6)continue;
    const len=Math.hypot(b[0]-a[0],b[1]-a[1]), n=Math.max(1,Math.ceil(len/MAXE)), target=batchFor(cell.f), tile=tileOf(cell.f);
    for(let j=0;j<n;j++) {
      const t0=j/n,t1=(j+1)/n,x0=a[0]+(b[0]-a[0])*t0,z0=a[1]+(b[1]-a[1])*t0,x1=a[0]+(b[0]-a[0])*t1,z1=a[1]+(b[1]-a[1])*t1,k=target.verts,sgn=fy>ny?1:-1;
      for(const [x,y,z] of [[x0,lo,z0],[x1,lo,z1],[x0,hi,z0],[x1,hi,z1]]) { target.pos.push(x,y,z);target.nor.push(sgn*(b[1]-a[1])/len,0,-sgn*(b[0]-a[0])/len);target.uv.push((j+(x===x1&&z===z1?1:0))*len/n/tile,y/tile); }
      target.idx.push(...(sgn>0?[k,k+2,k+1,k+1,k+2,k+3]:[k,k+1,k+2,k+1,k+3,k+2]));
    }
  }
  if (ceiling && cell.c) for (let i=1;i<polygon.length-1;i++) triangleSurface(batchFor(cell.c),polygon[0],polygon[i],polygon[i+1],by+STORY,-1,tileOf(cell.c));
  const front = cell.shape.t || 'concrete', back = cell.shape.tb || front;
  for (let i=1;i<boundary.length;i++) {
    const [ox,oz]=boundary[i-1],[ex,ez]=boundary[i],len=Math.hypot(ex-ox,ez-oz),ux=(ex-ox)/len,uz=(ez-oz)/len;
    // Generate ordinary textured boxes locally, then rotate their vertices/normals (not a staircase of AABBs).
    const local = new Map(), bf = id => { if(!local.has(id)) local.set(id,new Batch(id)); return local.get(id); }, f=bf(front), b=bf(back), tf=tileOf(front),tb=tileOf(back);
    box({px:f,nx:f,py:f,ny:null,pz:f,nz:b},-0.16,len+0.16,by+Math.min(0,cell.h||0),by+STORY,-0.15,0.15,{px:tf,nx:tf,py:tf,ny:tf,pz:tf,nz:tb});
    for (const [id,part] of local) {
      const target=batchFor(id), offset=target.verts;
      for(let j=0;j<part.pos.length;j+=3) {
        const x=part.pos[j],z=part.pos[j+2],nx=part.nor[j],nz=part.nor[j+2];
        target.pos.push(ox+ux*x-uz*z,part.pos[j+1],oz+uz*x+ux*z); target.nor.push(ux*nx-uz*nz,part.nor[j+1],uz*nx+ux*nz);
      }
      target.uv.push(...part.uv); target.idx.push(...part.idx.map(n=>n+offset));
    }
  }
}

/** World-space box of an edge part: [x0,x1,z0,z1] (thickness across the edge, extended slightly at used nodes so corners close). */
function partBox(p, c) {
  const [t0, t1] = p.t ?? [-0.15, 0.15], tl = Math.min(t0, t1), th = Math.max(t0, t1);
  let a = p.u[0] * CELL, b = p.u[1] * CELL;
  if (!p.leaf && (p.mat ?? 'main') === 'main') { if (p.u[0] === 0 && c.startUsed) a -= th; if (p.u[1] === 1 && c.endUsed) b += th; }
  return c.o === 'H' ? [c.ox + a, c.ox + b, c.oz + tl, c.oz + th] : [c.ox + tl, c.ox + th, c.oz + a, c.oz + b];
}

function emitPart(p, c, batchOf, tileOf, pivot) {
  const m = p.mat ?? 'main', [xa, xb, za, zb] = partBox(p, c);
  const y0 = c.by + Hn(p.y[0]), y1 = c.by + Hn(p.y[1]);
  const front = batchOf(c.mats[m] ?? c.mats.main), back = batchOf(m === 'main' ? c.back : c.mats[m] ?? c.mats.main);
  const tf = tileOf(front.tex), tb = tileOf(back.tex);
  const capStart = !p.leaf && p.u[0] === 0 && c.startUsed ? null : front, capEnd = !p.leaf && p.u[1] === 1 && c.endUsed ? null : front;
  const faces = c.o === 'H'
    ? { pz: front, nz: back, nx: capStart, px: capEnd, py: front, ny: y0 > c.by + 1e-3 ? front : null }
    : { px: front, nx: back, nz: capStart, pz: capEnd, py: front, ny: y0 > c.by + 1e-3 ? front : null };
  const tiles = c.o === 'H' ? { pz: tf, nz: tb, px: tf, nx: tf, py: tf, ny: tf } : { px: tf, nx: tb, pz: tf, nz: tf, py: tf, ny: tf };
  box(faces, xa, xb, y0, y1, za, zb, tiles, pivot ?? [0, 0, 0], [0, 0, 0]);
}

function buildStairs(world, cell, L, cx, cz, fb, ft, batchFor) {
  const st = world.lookup.stair(cell.s.id) ?? { rise: STORY, steps: 8 };
  const d = cell.s.d || 'N', by = L * STORY + (cell.h || 0);
  const x0 = cx * CELL, z0 = cz * CELL;
  const n = st.steps > 0 ? st.steps : 6;
  // work in a frame where the stairs climb along +t
  const at = (t, w) => { // t 0..1 along climb, w 0..1 across → world x,z
    switch (d) { case 'N': return [x0 + w * CELL, z0 + t * CELL]; case 'S': return [x0 + w * CELL, z0 + (1 - t) * CELL]; case 'E': return [x0 + t * CELL, z0 + w * CELL]; default: return [x0 + (1 - t) * CELL, z0 + w * CELL]; }
  };
  const rect = (t0, t1, y0, y1) => { // block of the staircase between t0..t1 rising from the floor to y1 (we only emit the visible top + riser)
    const [ax, az] = at(t0, 0), [bx, bz] = at(t1, 1);
    const xa = Math.min(ax, bx), xb = Math.max(ax, bx), za = Math.min(az, bz), zb = Math.max(az, bz);
    face(fb, 'y', 1, y1, xa, xb, za, zb, ft);
    const sign = d === 'N' ? -1 : d === 'S' ? 1 : d === 'E' ? -1 : 1; // riser faces down the stairs
    if (d === 'N' || d === 'S') face(fb, 'z', sign, d === 'N' ? za : zb, xa, xb, y0, y1, ft);
    else face(fb, 'x', sign, d === 'E' ? xa : xb, y0, y1, za, zb, ft);
    // side walls of the steps
    const sd = (cxn, w) => { if (d === 'N' || d === 'S') face(fb, 'x', w ? 1 : -1, cxn, by, y1, za, zb, ft); else face(fb, 'z', w ? 1 : -1, cxn, xa, xb, by, y1, ft); };
    if (d === 'N' || d === 'S') { sd(x0, 0); sd(x0 + CELL, 1); } else { sd(z0, 0); sd(z0 + CELL, 1); }
  };
  if (st.steps > 0) for (let i = 0; i < n; i++) rect(i / n, (i + 1) / n, by + (i * st.rise) / n, by + ((i + 1) * st.rise) / n);
  else { // ramp: one slanted quad
    const p = (t, w, y) => { const [x, z] = at(t, w); return [x, y, z]; };
    const A = p(0, 0, by), B = p(0, 1, by), C = p(1, 1, by + st.rise), D = p(1, 0, by + st.rise);
    const e1 = [B[0] - A[0], B[1] - A[1], B[2] - A[2]], e2 = [D[0] - A[0], D[1] - A[1], D[2] - A[2]];
    let nn = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]]; const l = Math.hypot(...nn); nn = nn.map((v) => v / l); if (nn[1] < 0) nn = nn.map((v) => -v);
    const base = fb.verts;
    for (const q of [A, B, C, D]) { fb.pos.push(...q); fb.nor.push(...nn); fb.uv.push(q[0] / ft, q[2] / ft); }
    fb.idx.push(base, base + 1, base + 2, base, base + 2, base + 3, base, base + 2, base + 1, base, base + 3, base + 2);
  }
}

// ---- baked lighting -----------------------------------------------------------------------------------------------------------
/** light: { x,y,z, color:[r,g,b], intensity, range } */
export function lightAtPoint(world, lights, ambient, p, n = null, occlude = true, extra = null) {
  let r = ambient[0], g = ambient[1], b = ambient[2];
  if (extra && n) { const e = extra(p, n); if (e) { r += e[0]; g += e[1]; b += e[2]; } }
  for (const l of lights) {
    const dx = l.x - p[0], dy = l.y - p[1], dz = l.z - p[2];
    const d2 = dx * dx + dy * dy + dz * dz; if (d2 >= l.range * l.range) continue;
    const d = Math.sqrt(d2) || 1e-4;
    let k = Math.pow(1 - d / l.range, 1.5) * l.intensity * 1.3;
    if (n) { const nd = (dx * n[0] + dy * n[1] + dz * n[2]) / d; k *= Math.max(0, nd) * 0.8 + 0.2 * (nd > -0.2 ? 1 : 0); if (k <= 0.002) continue; }
    if (occlude && world) {
      const o = n ? [p[0] + n[0] * 0.06, p[1] + n[1] * 0.06, p[2] + n[2] * 0.06] : p;
      if (!world.los([l.x, l.y, l.z], o)) continue;
    }
    r += l.color[0] * k; g += l.color[1] * k; b += l.color[2] * k;
  }
  return [r, g, b];
}

/** Fill batch.col (RGBA floats) for every vertex. Returns the number of rays cast (for tests/stats). */
export function bakeBatches(world, batches, lights, ambient, { occlude = true, extra = null } = {}) {
  let rays = 0;
  for (const b of batches) {
    const n = b.verts; b.col = new Float32Array(n * 4);
    for (let i = 0; i < n; i++) {
      const p = [b.pos[i * 3] + (b.origin?.[0] ?? 0), b.pos[i * 3 + 1] + (b.origin?.[1] ?? 0), b.pos[i * 3 + 2] + (b.origin?.[2] ?? 0)], nr = [b.nor[i * 3], b.nor[i * 3 + 1], b.nor[i * 3 + 2]];
      const c = lightAtPoint(world, lights, ambient, p, nr, occlude, extra); rays += lights.length;
      b.col[i * 4] = c[0]; b.col[i * 4 + 1] = c[1]; b.col[i * 4 + 2] = c[2]; b.col[i * 4 + 3] = 1;
    }
  }
  return rays;
}
