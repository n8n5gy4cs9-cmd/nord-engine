// Collider shapes for the 2D physics adapters: the `collider` component (box, circle, capsule, polygon, edge, composite) as plain parts in the entity's local, unscaled space.
//   { kind: 'rect', x, y, w, h }          axis-aligned box centred at (x, y)
//   { kind: 'circle', x, y, r }
//   { kind: 'capsule', x, y, len, r, angle }  stadium of total length len + 2r along `angle` (radians) through (x, y)
//   { kind: 'poly', pts: [[x, y]…] }      convex polygon
//   { kind: 'segment', ax, ay, bx, by, thick }
// A polygon collider with a concave outline arrives as several convex `poly` parts (ear clipping), a composite is the union of its children's parts.
import { triangulate } from '../core/geometry.js';
import { toWorld } from './transform.js';

const D2R = Math.PI / 180;

/** Parts of one collider `d` (component data) whose default size is `size` (the visual's size). */
export function partsOfData(d, size) {
  const shape = d.shape ?? 'box', off = d.offset ?? [0, 0], [w, h] = d.size ?? size, ox = off[0], oy = off[1];
  switch (shape) {
    case 'circle': return [{ kind: 'circle', x: ox, y: oy, r: d.radius ?? Math.max(w, h) / 2 }];
    case 'capsule': {
      const horizontal = String(d.direction ?? (w > h ? 'horizontal' : 'vertical')).toLowerCase().startsWith('h');
      const r = Math.min(w, h) / 2;
      return [{ kind: 'capsule', x: ox, y: oy, len: Math.max((horizontal ? w : h) - 2 * r, 0), r, angle: horizontal ? 0 : Math.PI / 2 }];
    }
    case 'polygon': {
      const pts = (d.points?.length >= 3 ? d.points : [[-w / 2, -h / 2], [w / 2, -h / 2], [w / 2, h / 2], [-w / 2, h / 2]]).map((p) => [p[0] + ox, p[1] + oy]);
      return triangulate(pts).map((t) => ({ kind: 'poly', pts: t.map((p) => [p[0], p[1]]) }));
    }
    case 'edge': {
      const pts = (d.points?.length >= 2 ? d.points : [[-w / 2, 0], [w / 2, 0]]).map((p) => [p[0] + ox, p[1] + oy]), out = [], thick = Math.max((d.edgeRadius ?? 0) * 2, 2);
      for (let i = 0; i + 1 < pts.length; i++) out.push({ kind: 'segment', ax: pts[i][0], ay: pts[i][1], bx: pts[i + 1][0], by: pts[i + 1][1], thick });
      return out;
    }
    default: return [{ kind: 'rect', x: ox, y: oy, w, h }];
  }
}

/** Move parts from a child's local space into its composite parent's local space (child world pose `cw`, parent world pose `pw`). */
function carry(parts, cw, pw) {
  const to = ([x, y]) => {
    const px = x * cw.sx, py = y * cw.sy, c = Math.cos(cw.angle * D2R), s = Math.sin(cw.angle * D2R);
    const wx = cw.x + px * c - py * s, wy = cw.y + px * s + py * c;
    const a = -pw.angle * D2R, ca = Math.cos(a), sa = Math.sin(a), dx = wx - pw.x, dy = wy - pw.y;
    return [(dx * ca - dy * sa) / (pw.sx || 1), (dx * sa + dy * ca) / (pw.sy || 1)];
  };
  const k = Math.max(Math.abs(cw.sx), Math.abs(cw.sy)) / Math.max(Math.abs(pw.sx || 1), Math.abs(pw.sy || 1)), da = ((cw.angle - pw.angle) * D2R);
  return parts.map((p) => {
    switch (p.kind) {
      case 'circle': { const [x, y] = to([p.x, p.y]); return { kind: 'circle', x, y, r: p.r * k }; }
      case 'capsule': { const [x, y] = to([p.x, p.y]); return { kind: 'capsule', x, y, len: p.len * k, r: p.r * k, angle: p.angle + da }; }
      case 'poly': return { kind: 'poly', pts: p.pts.map(to) };
      case 'segment': { const [ax, ay] = to([p.ax, p.ay]), [bx, by] = to([p.bx, p.by]); return { ...p, ax, ay, bx, by }; }
      default: { const hw = p.w / 2, hh = p.h / 2; return { kind: 'poly', pts: [[p.x - hw, p.y - hh], [p.x + hw, p.y - hh], [p.x + hw, p.y + hh], [p.x - hw, p.y + hh]].map(to) }; }
    }
  });
}

/**
 * All parts of an entity's collider. `sizeOf(entity)` gives the default size for colliders without one. A composite collider collects the colliders marked
 * `usedByComposite` on its children (they get no body of their own: `ownedByComposite(entity)` is true for them).
 */
export function entityParts(backend, e, sizeOf) {
  const d = e.getComponent('collider')?.data; if (!d) return [];
  if (d.shape !== 'composite') return partsOfData(d, sizeOf(e));
  const pw = backend.world(e), out = [];
  for (const c of e.all()) {
    if (c === e || !c.enabled) continue;
    const cd = c.getComponent('collider')?.data; if (!cd?.usedByComposite || cd.shape === 'composite') continue;
    out.push(...carry(partsOfData(cd, sizeOf(c)), backend.world(c), pw));
  }
  return out;
}
/** Does a composite collider higher up own this entity's collider? */
export function ownedByComposite(e) {
  if (!e.getComponent('collider')?.data.usedByComposite) return false;
  for (let p = e.parent; p; p = p.parent) if (p.getComponent('collider')?.data.shape === 'composite') return true;
  return false;
}
/** Bounding box of parts as a centred rect `{ x, y, w, h }` (arcade physics only has boxes and circles). */
export function boundsOfParts(parts) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  const add = (x, y) => { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); };
  for (const p of parts) {
    if (p.kind === 'circle') { add(p.x - p.r, p.y - p.r); add(p.x + p.r, p.y + p.r); }
    else if (p.kind === 'rect') { add(p.x - p.w / 2, p.y - p.h / 2); add(p.x + p.w / 2, p.y + p.h / 2); }
    else if (p.kind === 'capsule') { const hx = Math.abs(Math.cos(p.angle)) * p.len / 2 + p.r, hy = Math.abs(Math.sin(p.angle)) * p.len / 2 + p.r; add(p.x - hx, p.y - hy); add(p.x + hx, p.y + hy); }
    else if (p.kind === 'segment') { add(p.ax, p.ay); add(p.bx, p.by); }
    else for (const q of p.pts) add(q[0], q[1]);
  }
  return x0 === Infinity ? { x: 0, y: 0, w: 1, h: 1 } : { x: (x0 + x1) / 2, y: (y0 + y1) / 2, w: Math.max(x1 - x0, 1), h: Math.max(y1 - y0, 1) };
}
export { toWorld };
