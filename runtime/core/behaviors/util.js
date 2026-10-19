// Geometry helpers shared by behaviors: AABB from the entity's `collider` component (centered on its position), solids, layout size.
export function bbox(e) {
  const c = e.getComponent('collider')?.data;
  const sz = c?.size ?? [32, 32], off = c?.offset ?? [0, 0];
  const w = Math.abs(sz[0] * (e.scale[0] ?? 1)), h = Math.abs(sz[1] * (e.scale[1] ?? 1));
  const x = e.pos[0] + off[0], y = e.pos[1] + off[1];
  return { l: x - w / 2, r: x + w / 2, t: y - h / 2, b: y + h / 2, w, h };
}
const hit = (a, b) => a.l < b.r && a.r > b.l && a.t < b.b && a.b > b.t;
export const overlaps = (a, b) => hit(bbox(a), bbox(b));

export function solidsOf(scene, type = 'Solid', skip = null) {
  const out = [];
  for (const e of scene.all()) if (e !== skip && e.enabled && e.behavior(type)?.enabled) out.push(e);
  return out;
}

export function layoutSize(game, scene) {
  const s = scene.settings?.layoutSize;
  return s ? { w: s[0], h: s[1] } : { w: game.project.display?.width ?? 1280, h: game.project.display?.height ?? 720 };
}

/**
 * Move `e` by (dx, dy) one axis at a time, pushing it out of `solids` (entities with the Solid behavior).
 * `oneway` entities (Jumpthru) only block downward movement from above. Returns { x: hitSolidOnX, y: hitSolidOnY }.
 */
export function moveAndCollide(e, dx, dy, solids, oneway = []) {
  const res = { x: null, y: null };
  if (dx) {
    e.pos[0] += dx;
    const me = bbox(e);
    for (const s of solids) {
      const o = bbox(s);
      if (!hit(me, o)) continue;
      e.pos[0] += dx > 0 ? o.l - me.r : o.r - me.l;
      res.x = s; break;
    }
  }
  if (dy) {
    const before = bbox(e);
    e.pos[1] += dy;
    const me = bbox(e);
    for (const s of solids) {
      const o = bbox(s);
      if (!hit(me, o)) continue;
      e.pos[1] += dy > 0 ? o.t - me.b : o.b - me.t;
      res.y = s; break;
    }
    if (!res.y && dy > 0) {
      for (const s of oneway) {
        const o = bbox(s);
        if (before.b <= o.t + 0.01 && hit(bbox(e), o)) { e.pos[1] += o.t - bbox(e).b; res.y = s; break; }
      }
    }
  }
  e.touch();
  return res;
}

export const setOpacity = (e, v) => { e.opacity = v; if (e.getComponent('sprite')) e.set('sprite', 'alpha', v); else if (e.getComponent('animatedSprite')) e.set('animatedSprite', 'alpha', v); };
