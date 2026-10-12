// @nord {"id":"physics.conveyor","title":"Conveyor belt","category":"physics","tier":["2d","3d"],"tags":["conveyor","trigger"],"requires":["trigger"],"description":"While something touches this trigger/collider it is pushed with a constant velocity along the given direction."}
import { NordScript } from 'nord';

export default class Conveyor extends NordScript {
  static attributes = { velocity: { type: 'vec3', default: [80, 0, 0] } };
  start() { this.on = new Set(); }
  onTriggerEnter(o) { this.on.add(o); } onTriggerExit(o) { this.on.delete(o); }
  onCollisionEnter(o) { this.on.add(o); } onCollisionExit(o) { this.on.delete(o); }
  fixedUpdate() {
    const v = this.attrs.velocity, three = this.game.project.type === '3d';
    for (const o of this.on) {
      if (o.destroyed) { this.on.delete(o); continue; }
      if (three) this.physics.setVelocity(o, v[0], null, v[2]); else this.physics.setVelocity(o, v[0], null);
    }
  }
}
