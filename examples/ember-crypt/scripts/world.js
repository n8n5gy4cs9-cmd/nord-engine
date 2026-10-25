import { MAP } from './map.js';

/** Questions about the dungeon map. A static helper class: no entity, no state. */
export default class World {
  static TILE = 32;

  /** The map character at a world point. Outside the map everything is wall. */
  static TileAt(x, y) { return MAP[Math.floor(y / World.TILE)]?.[Math.floor(x / World.TILE)] ?? '#'; }

  /** True when no wall lies on the straight line between two points (line of sight). Samples every 8 px, finer than a tile. */
  static LineClear(ax, ay, bx, by) {
    const steps = Math.ceil(Math.hypot(bx - ax, by - ay) / 8);
    for (let i = 1; i < steps; i++) {
      const t = i / steps;
      if (World.TileAt(ax + (bx - ax) * t, ay + (by - ay) * t) === '#') return false;
    }
    return true;
  }
}
