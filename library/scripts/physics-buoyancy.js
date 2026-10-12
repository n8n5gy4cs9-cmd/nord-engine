// @nord {"id":"physics.buoyancy","title":"Water / buoyancy zone","category":"physics","tier":["2d"],"tags":["water","swim","float"],"requires":["trigger"],"description":"A water trigger: bodies inside float upward and are slowed (drag). Gravity-direction is +y (2D screen space)."}
import { NordScript } from 'nord';

export default class Buoyancy extends NordScript {
  static attributes = { lift: { type: 'number', default: 700, label: 'Upward accel (px/s²)' }, drag: { type: 'number', default: 3, min: 0 } };
  start() { this.in = new Set(); }
  onTriggerEnter(o) { this.in.add(o); this.entity.emit('splash', o); this.events.emit('splash', o); }
  onTriggerExit(o) { this.in.delete(o); }
  fixedUpdate(dt) {
    for (const o of this.in) {
      if (o.destroyed) { this.in.delete(o); continue; }
      const [vx, vy] = this.physics.velocity(o), k = Math.max(0, 1 - this.attrs.drag * dt);
      this.physics.setVelocity(o, vx * k, (vy - this.attrs.lift * dt) * k);
    }
  }
}
