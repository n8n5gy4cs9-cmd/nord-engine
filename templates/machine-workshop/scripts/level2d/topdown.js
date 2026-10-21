// @nord {"id":"controller.topdown","title":"Top-down mover","category":"controllers","tier":["2d"],"tags":["topdown","4-dir","8-dir"],"requires":["rigidbody"],"description":"4- or 8-direction top-down movement with acceleration. Actions left/right/up/down. Falls back to direct movement without a rigidbody."}
import { NordScript } from 'nord';

export default class TopDown extends NordScript {
  static attributes = {
    speed: { type: 'number', default: 150, min: 0 },
    accel: { type: 'number', default: 1200, min: 0, label: 'Acceleration (px/s²)' },
    fourWay: { type: 'bool', default: false, label: '4-direction only' },
    faceMovement: { type: 'bool', default: false },
  };
  start() { this.v = [0, 0]; this.body = !!this.entity.getComponent('rigidbody'); }
  fixedUpdate(dt) {
    let [x, y] = this.input.vec('left', 'right', 'up', 'down');
    if (this.attrs.fourWay && x && y) { if (Math.abs(x) >= Math.abs(y)) y = 0; else x = 0; }
    const step = this.attrs.accel * dt;
    this.v[0] += Math.max(-step, Math.min(step, x * this.attrs.speed - this.v[0]));
    this.v[1] += Math.max(-step, Math.min(step, y * this.attrs.speed - this.v[1]));
    if (this.body) this.physics.setVelocity(this.entity, this.v[0], this.v[1]);
    else { const p = this.entity.pos; this.entity.pos = [p[0] + this.v[0] * dt, p[1] + this.v[1] * dt, p[2]]; }
    if (this.attrs.faceMovement && (x || y)) { const r = [...this.entity.rot]; r[2] = (Math.atan2(y, x) * 180) / Math.PI; this.entity.rot = r; }
  }
}
