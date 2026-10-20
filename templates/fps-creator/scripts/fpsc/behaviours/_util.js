// Helpers shared by built-in scripts (and handy in your own: import { inZone, applyTo } from './_util.js' when copying built-ins).
/** Is the player inside the entity's zone box (w × d metres, 3 m high) at its position? */
export function inZone(ent, p) {
  const z = ent.zone ?? { w: 4, d: 4, h: 3 };
  return p.alive && Math.abs(p.x - ent.x) <= z.w / 2 && Math.abs(p.z - ent.z) <= z.d / 2 && p.y + 0.5 >= ent.y - 0.2 && p.y <= ent.y + z.h;
}
/** Switch a target on/off: doors open/close, lights go on/off, other entities get an "open"/"close" event. */
export function applyTo(c, on) {
  const g = c.game, t = c.self.target; if (!t) return;
  for (const d of g.doorsNamed(t)) g.setDoor(d, on, { force: true });
  for (const e of g.find(t)) { if (e.light) g.setLight(e, on ? 'on' : 'off'); e.emit(on ? 'open' : 'close'); }
}
