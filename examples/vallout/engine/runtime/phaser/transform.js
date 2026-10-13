// 2D world-transform helpers. Entity containers are flat on the display list; hierarchy is resolved here
// (so physics bodies never live inside a transformed parent container).
const D2R = Math.PI / 180;

/** Local {pos,rot,scale} → world {x,y,angle,sx,sy} given parent's world (or null). */
export function toWorld(t, pw) {
  const lx = t.pos[0], ly = t.pos[1];
  if (!pw) return { x: lx, y: ly, z: t.pos[2] ?? 0, angle: t.rot[2] ?? 0, sx: t.scale[0], sy: t.scale[1] };
  const c = Math.cos(pw.angle * D2R), s = Math.sin(pw.angle * D2R);
  const px = lx * pw.sx, py = ly * pw.sy;
  return { x: pw.x + px * c - py * s, y: pw.y + px * s + py * c, z: (pw.z ?? 0) + (t.pos[2] ?? 0), angle: pw.angle + (t.rot[2] ?? 0), sx: pw.sx * t.scale[0], sy: pw.sy * t.scale[1] };
}

/** Inverse: world position → local position under parent world `pw`. */
export function toLocal(x, y, pw) {
  if (!pw) return [x, y];
  const c = Math.cos(-pw.angle * D2R), s = Math.sin(-pw.angle * D2R);
  const dx = x - pw.x, dy = y - pw.y;
  return [(dx * c - dy * s) / (pw.sx || 1), (dx * s + dy * c) / (pw.sy || 1)];
}
