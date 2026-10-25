import { MAP } from './map.js';

export const TILE = 32;

/** The character of the map tile that contains the world point (x, y). Outside the map everything is wall. */
export const tileAt = (x, y) => MAP[Math.floor(y / TILE)]?.[Math.floor(x / TILE)] ?? '#';

/** True when no wall tile lies on the straight line between the two points. Samples every 8 px, which is finer than a tile. */
export function lineClear(ax, ay, bx, by) {
  const steps = Math.ceil(Math.hypot(bx - ax, by - ay) / 8);
  for (let i = 1; i < steps; i++) {
    const t = i / steps;
    if (tileAt(ax + (bx - ax) * t, ay + (by - ay) * t) === '#') return false;
  }
  return true;
}
