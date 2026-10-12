// @nord {"id":"physics.gravity-well","title":"Magnet / gravity well","category":"physics","tier":["2d"],"tags":["gravity","magnet","attract"],"description":"Attracts (or repels with negative strength) all entities with a tag within a radius, force falling off with distance."}
import { NordScript } from 'nord';

export default class GravityWell extends NordScript {
  static attributes = { tag: { type: 'string', default: 'pullable' }, strength: { type: 'number', default: 600 }, radius: { type: 'number', default: 200, min: 1 } };
  fixedUpdate(dt) {
    const [x, y] = this.entity.pos, { strength, radius } = this.attrs;
    for (const o of this.scene.findByTag(this.attrs.tag)) {
      const dx = x - o.pos[0], dy = y - o.pos[1], d = Math.hypot(dx, dy);
      if (d > radius || d < 4) continue;
      const f = (strength * (1 - d / radius) * dt) / d, [vx, vy] = this.physics.velocity(o);
      this.physics.setVelocity(o, vx + dx * f, vy + dy * f);
    }
  }
}
