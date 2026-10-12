// @nord {"id":"controller.ladder","title":"Ladder climb","category":"controllers","tier":["2d"],"tags":["platformer","climb"],"requires":["trigger"],"description":"Add to the player next to a platformer controller: overlapping an entity tagged 'ladder' lets up/down climb and disables gravity pull while climbing."}
import { NordScript } from 'nord';

export default class Ladder extends NordScript {
  static attributes = { climbSpeed: { type: 'number', default: 90, min: 0 }, tag: { type: 'string', default: 'ladder' } };
  start() { this.n = 0; this.climbing = false; }
  onTriggerEnter(o) { if (o.hasTag(this.attrs.tag)) this.n++; }
  onTriggerExit(o) { if (o.hasTag(this.attrs.tag)) { this.n = Math.max(0, this.n - 1); if (!this.n) this.climbing = false; } }
  fixedUpdate() {
    const dy = this.input.axis('up', 'down');
    if (this.n && dy) this.climbing = true;
    if (this.climbing) this.physics.setVelocity(this.entity, null, dy * this.attrs.climbSpeed);
  }
}
