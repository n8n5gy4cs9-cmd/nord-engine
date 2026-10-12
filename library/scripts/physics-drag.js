// @nord {"id":"physics.drag-throw","title":"Drag & throw (2D)","category":"physics","tier":["2d"],"tags":["drag","throw","mouse"],"requires":["rigidbody","collider"],"description":"Click an entity carrying this script to drag it with the pointer; releasing throws it with the pointer's velocity."}
import { NordScript } from 'nord';

export default class DragThrow extends NordScript {
  static attributes = { radius: { type: 'number', default: 24, min: 1, label: 'Grab radius (px)' }, throwScale: { type: 'number', default: 1 }, maxSpeed: { type: 'number', default: 900 } };
  start() { this.drag = false; this.last = [0, 0]; this.vel = [0, 0]; }
  fixedUpdate(dt) {
    const p = this.input.pointer, e = this.entity;
    if (p.down && !this.drag && Math.hypot(p.worldX - e.pos[0], p.worldY - e.pos[1]) < this.attrs.radius && !this.was) this.drag = true;
    this.was = p.down;
    if (this.drag && p.down) {
      this.vel = [(p.worldX - this.last[0]) / dt, (p.worldY - this.last[1]) / dt];
      this.physics.teleport(e, p.worldX, p.worldY); this.physics.setVelocity(e, 0, 0);
    } else if (this.drag) {
      this.drag = false; const m = Math.hypot(...this.vel), k = Math.min(1, this.attrs.maxSpeed / (m || 1)) * this.attrs.throwScale;
      this.physics.setVelocity(e, this.vel[0] * k, this.vel[1] * k);
    }
    this.last = [p.worldX, p.worldY];
  }
}
