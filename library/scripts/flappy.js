// @nord {"id":"controller.flappy","title":"Flappy flap","category":"controllers","tier":["2d"],"tags":["flappy","tap","one-button"],"requires":["rigidbody"],"description":"One-button flap: each 'jump' press sets upward velocity; tilts with velocity. Emits 'dead' on any collision."}
import { NordScript } from 'nord';

export default class Flappy extends NordScript {
  static attributes = {
    flap: { type: 'number', default: 300, min: 0 },
    tilt: { type: 'number', default: 0.08, min: 0, label: 'Tilt per px/s' },
  };
  start() { this.dead = false; }
  fixedUpdate() {
    if (this.dead) return;
    if (this.input.pressed('jump') || (this.input.pointer.down && !this.was)) this.physics.setVelocity(this.entity, null, -this.attrs.flap);
    this.was = this.input.pointer.down;
    const [, vy] = this.physics.velocity(this.entity);
    const r = [...this.entity.rot]; r[2] = Math.max(-30, Math.min(80, vy * this.attrs.tilt)); this.entity.rot = r;
  }
  onCollisionEnter() { if (!this.dead) { this.dead = true; this.events.emit('dead'); } }
}
