// @nord {"id":"controller3d.vehicle","title":"Arcade vehicle (3D)","category":"controllers","tier":["3d"],"tags":["car","vehicle","racing"],"requires":["rigidbody","collider"],"description":"Simple arcade car on a single rigid body: throttle/brake with up/down, steer with left/right, hand-brake with 'jump'. Sideways velocity is damped for grip. Model should face +z."}
import { NordScript } from 'nord';

export default class Vehicle3D extends NordScript {
  static attributes = {
    accel: { type: 'number', default: 18, min: 0 }, maxSpeed: { type: 'number', default: 28, min: 0 },
    steer: { type: 'number', default: 100, label: 'Steer (deg/s at speed)' }, grip: { type: 'number', default: 5, min: 0 },
  };
  start() { this.yaw = this.entity.rot[1]; }
  fixedUpdate(dt) {
    const a = this.attrs, v = this.physics.velocity(this.entity), r = (this.yaw * Math.PI) / 180;
    const f = [Math.sin(r), Math.cos(r)], s = [f[1], -f[0]];
    const fwd = v[0] * f[0] + v[2] * f[1], lat = v[0] * s[0] + v[2] * s[1];
    this.yaw += this.input.axis('left', 'right') * a.steer * Math.min(1, Math.abs(fwd) / 6) * Math.sign(fwd || 1) * dt;
    this.entity.rot = [0, this.yaw, 0];
    const r2 = (this.yaw * Math.PI) / 180, f2 = [Math.sin(r2), Math.cos(r2)];
    let nf = fwd + this.input.axis('down', 'up') * a.accel * dt;
    if (this.input.down('jump')) nf *= 1 - Math.min(1, 3 * dt);
    nf = Math.max(-a.maxSpeed / 2, Math.min(a.maxSpeed, nf));
    const nl = lat * Math.max(0, 1 - a.grip * dt);
    this.physics.setVelocity(this.entity, f2[0] * nf + s[0] * nl, null, f2[1] * nf + s[1] * nl);
  }
}
