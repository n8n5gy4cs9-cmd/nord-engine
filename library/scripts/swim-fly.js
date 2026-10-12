// @nord {"id":"controller.swim-fly","title":"Swim / fly","category":"controllers","tier":["2d"],"tags":["swim","fly","water"],"requires":["rigidbody"],"description":"Free 2D movement with floaty damping: use for swimming or flying characters. Optionally hold 'jump' to rise."}
import { NordScript } from 'nord';

export default class SwimFly extends NordScript {
  static attributes = { speed: { type: 'number', default: 110, min: 0 }, damping: { type: 'number', default: 4, min: 0 }, rise: { type: 'number', default: 0, label: 'Constant rise force (px/s²)' } };
  start() { this.v = [0, 0]; }
  fixedUpdate(dt) {
    const [x, y] = this.input.vec('left', 'right', 'up', 'down'), k = Math.min(1, this.attrs.damping * dt);
    this.v[0] += (x * this.attrs.speed - this.v[0]) * k;
    this.v[1] += (y * this.attrs.speed - this.v[1]) * k - (this.input.down('jump') ? this.attrs.rise * dt : 0);
    this.physics.setVelocity(this.entity, this.v[0], this.v[1]);
  }
}
