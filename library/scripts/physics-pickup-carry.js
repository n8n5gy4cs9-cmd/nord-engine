// @nord {"id":"physics.pickup-carry","title":"Pick up & carry","category":"physics","tier":["2d"],"tags":["carry","throw","interact"],"requires":["trigger"],"description":"Press 'interact' near an entity tagged 'carryable' to carry it above the head; press again to drop (or 'fire' to throw it forward)."}
import { NordScript } from 'nord';

export default class PickupCarry extends NordScript {
  static attributes = { tag: { type: 'string', default: 'carryable' }, radius: { type: 'number', default: 28 }, hold: { type: 'vec2', default: [0, -22], label: 'Hold offset' }, throwSpeed: { type: 'vec2', default: [260, -180] } };
  start() { this.held = null; this.face = 1; }
  update() {
    const e = this.entity, dx = this.input.axis('left', 'right'); if (dx) this.face = dx;
    if (this.held) {
      if (this.held.destroyed) { this.held = null; return; }
      this.physics.teleport(this.held, e.pos[0] + this.attrs.hold[0], e.pos[1] + this.attrs.hold[1]); this.physics.setVelocity(this.held, 0, 0);
      if (this.input.pressed('fire')) { const h = this.held; this.held = null; this.physics.setVelocity(h, this.attrs.throwSpeed[0] * this.face, this.attrs.throwSpeed[1]); }
      else if (this.input.pressed('interact')) this.held = null;
    } else if (this.input.pressed('interact')) {
      let best = null, bd = this.attrs.radius;
      for (const c of this.scene.findByTag(this.attrs.tag)) { const d = Math.hypot(c.pos[0] - e.pos[0], c.pos[1] - e.pos[1]); if (d < bd) { bd = d; best = c; } }
      this.held = best;
    }
  }
}
