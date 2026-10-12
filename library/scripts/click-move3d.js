// @nord {"id":"controller3d.click-move","title":"Click to move (3D)","category":"controllers","tier":["3d"],"tags":["mouse","rts","point-and-click"],"description":"Click the ground to walk there (uses game.pick). Turns to face the target. Emits 'arrived' on the entity."}
import { NordScript } from 'nord';

export default class ClickMove3D extends NordScript {
  static attributes = { speed: { type: 'number', default: 5, min: 0 }, stopDistance: { type: 'number', default: 0.15, min: 0 }, groundTag: { type: 'string', default: '', label: 'Only pick entities with this tag (empty = any)' } };
  start() { this.target = null; }
  update(dt) {
    const down = this.input.pointer.down;
    if (down && !this.was) { const h = this.game.pick?.(); if (h?.point && (!this.attrs.groundTag || h.entity?.hasTag(this.attrs.groundTag))) this.target = h.point; }
    this.was = down;
    if (!this.target) return;
    const [x, y, z] = this.entity.pos, dx = this.target[0] - x, dz = this.target[2] - z, d = Math.hypot(dx, dz);
    if (d <= this.attrs.stopDistance) { this.target = null; this.entity.emit('arrived'); return; }
    const s = Math.min(d, this.attrs.speed * dt);
    this.entity.pos = [x + (dx / d) * s, y, z + (dz / d) * s];
    this.entity.rot = [0, (Math.atan2(dx, dz) * 180) / Math.PI, 0];
  }
}
