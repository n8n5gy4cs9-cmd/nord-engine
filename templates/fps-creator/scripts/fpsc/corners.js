// One shared footprint for cut surfaces, walls, collision, navigation and the editor map.
import { CELL, unkey } from './level.js';
export const CORNERS = ['NE', 'NW', 'SE', 'SW'];
export function hasCorner(cell) { return !cell?.s && !cell?.p && ['diagonal', 'round'].includes(cell?.shape?.kind) && CORNERS.includes(cell.shape.corner); }
// Corner names identify the corner REMOVED. The opposite corner anchors the retained floor.
const anchors = { NE: [0, 0, 1, 1], NW: [1, 0, -1, 1], SE: [0, 1, 1, -1], SW: [1, 1, -1, -1] };
export function cornerBoundary(cell, cx, cz) {
  if (!hasCorner(cell)) return [];
  const [ax, az, sx, sz] = anchors[cell.shape.corner], n = cell.shape.kind === 'round' ? 8 : 1;
  return Array.from({ length: n + 1 }, (_, i) => {
    const a = Math.PI * 0.5 * i / n;
    return [(cx + ax + sx * Math.cos(a)) * CELL, (cz + az + sz * Math.sin(a)) * CELL];
  });
}
export function cellPolygon(cell, cx, cz) {
  if (!hasCorner(cell)) return [[cx, cz], [cx + 1, cz], [cx + 1, cz + 1], [cx, cz + 1]].map(([x,z]) => [x * CELL, z * CELL]);
  const [ax, az, sx, sz] = anchors[cell.shape.corner];
  const arc = cornerBoundary(cell, cx, cz);
  if (sx * sz < 0) arc.reverse();
  return [[(cx + ax) * CELL, (cz + az) * CELL], ...arc];
}
export function cellContains(cell, x, z, cx = Math.floor(x / CELL), cz = Math.floor(z / CELL)) {
  if (!hasCorner(cell)) return true;
  const p = cellPolygon(cell, cx, cz);
  return p.every((a, i) => { const b = p[(i + 1) % p.length]; return (b[0]-a[0]) * (z-a[1]) - (b[1]-a[1]) * (x-a[0]) >= -1e-6; });
}
export function cellCenter(cell, cx, cz) {
  const p = cellPolygon(cell, cx, cz); let area = 0, x = 0, z = 0;
  p.forEach((a, i) => { const b = p[(i + 1) % p.length], k = a[0]*b[1]-b[0]*a[1]; area += k; x += (a[0]+b[0])*k; z += (a[1]+b[1])*k; });
  return [x / (3 * area), z / (3 * area)];
}
export function cornerOpenSide(cell, side) { return !hasCorner(cell) || !cell.shape.corner.includes(side); }
/** Preserve original edges in JSON, but omit the two sides cut away by a shaped cell. */
export function hiddenCornerEdge(layer, edgeKey) {
  const [x,z,o] = unkey(edgeKey);
  return o === 'H' ? !cornerOpenSide(layer.cells[`${x},${z}`], 'S') || !cornerOpenSide(layer.cells[`${x},${z-1}`], 'N')
    : !cornerOpenSide(layer.cells[`${x},${z}`], 'W') || !cornerOpenSide(layer.cells[`${x-1},${z}`], 'E');
}
