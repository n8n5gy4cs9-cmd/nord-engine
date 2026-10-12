// @nord {"id":"controller3d.marble","title":"Marble roll","category":"controllers","tier":["3d"],"tags":["ball","physics","roll"],"requires":["rigidbody","collider"],"description":"Push a sphere around with the direction actions (forces relative to world axes), jump when grounded. Emits 'fell' on the global bus below killY."}
import { NordScript } from 'nord';

export default class Marble3D extends NordScript {
  static attributes = { force: { type: 'number', default: 14 }, maxSpeed: { type: 'number', default: 12 }, jumpImpulse: { type: 'number', default: 5 }, killY: { type: 'number', default: -20 } };
  fixedUpdate(dt) {
    const [mx, mz] = this.input.vec('left', 'right', 'down', 'up'), v = this.physics.velocity(this.entity);
    if ((mx || mz) && Math.hypot(v[0], v[2]) < this.attrs.maxSpeed) this.physics.applyImpulse(this.entity, mx * this.attrs.force * dt, 0, mz * this.attrs.force * dt);
    if (this.input.pressed('jump') && this.physics.isGrounded(this.entity, 0.2)) this.physics.applyImpulse(this.entity, 0, this.attrs.jumpImpulse, 0);
    if (this.entity.pos[1] < this.attrs.killY && !this.fell) { this.fell = true; this.events.emit('fell', this.entity); }
  }
}
