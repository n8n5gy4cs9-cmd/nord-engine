// @nord {"id":"controller.car2d","title":"Top-down car","category":"controllers","tier":["2d"],"tags":["car","vehicle","drift"],"requires":["rigidbody"],"description":"Arcade top-down car with steering that scales with speed and sideways grip (drift). Actions up/down accelerate/brake, left/right steer."}
import { NordScript } from 'nord';

export default class Car2D extends NordScript {
  static attributes = {
    accel: { type: 'number', default: 260, min: 0 },
    maxSpeed: { type: 'number', default: 320, min: 0 },
    steer: { type: 'number', default: 150, min: 0, label: 'Max steer (deg/s)' },
    grip: { type: 'number', default: 6, min: 0, label: 'Sideways grip (higher = less drift)' },
    drag: { type: 'number', default: 0.6, min: 0 },
  };
  start() { this.v = [0, 0]; }
  fixedUpdate(dt) {
    const a = this.attrs, rot = [...this.entity.rot], th = (rot[2] * Math.PI) / 180;
    const fwd = [Math.cos(th), Math.sin(th)], side = [-fwd[1], fwd[0]];
    const speed = this.v[0] * fwd[0] + this.v[1] * fwd[1];
    rot[2] += this.input.axis('left', 'right') * a.steer * Math.min(1, Math.abs(speed) / 120) * Math.sign(speed || 1) * dt;
    this.entity.rot = rot;
    const th2 = (rot[2] * Math.PI) / 180, f2 = [Math.cos(th2), Math.sin(th2)];
    const thrust = this.input.axis('down', 'up') * a.accel * dt;
    this.v[0] += f2[0] * thrust; this.v[1] += f2[1] * thrust;
    const lat = this.v[0] * side[0] + this.v[1] * side[1];
    const k = Math.min(1, a.grip * dt);
    this.v[0] -= side[0] * lat * k; this.v[1] -= side[1] * lat * k;
    const d = Math.max(0, 1 - a.drag * dt); this.v[0] *= d; this.v[1] *= d;
    const m = Math.hypot(...this.v); if (m > a.maxSpeed) { this.v[0] *= a.maxSpeed / m; this.v[1] *= a.maxSpeed / m; }
    this.physics.setVelocity(this.entity, this.v[0], this.v[1]);
  }
  onCollisionEnter() { this.v = [this.v[0] * 0.3, this.v[1] * 0.3]; }
}
