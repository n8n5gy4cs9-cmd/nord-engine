// @nord {"id":"controller.mouse-aim","title":"Mouse aim","category":"controllers","tier":["2d"],"tags":["mouse","rotate","turret"],"description":"Rotates the entity (z) to face the pointer. Offset the angle if the sprite does not face +x."}
import { NordScript } from 'nord';

export default class MouseAim extends NordScript {
  static attributes = { offset: { type: 'number', default: 0, label: 'Angle offset (deg)' }, turnSpeed: { type: 'number', default: 0, min: 0, label: 'Max deg/s (0 = instant)' } };
  update(dt) {
    const [x, y] = this.entity.pos, p = this.input.pointer;
    const want = (Math.atan2(p.worldY - y, p.worldX - x) * 180) / Math.PI + this.attrs.offset;
    const r = [...this.entity.rot];
    const diff = ((((want - r[2]) % 360) + 540) % 360) - 180, max = this.attrs.turnSpeed * dt;
    r[2] += this.attrs.turnSpeed ? Math.max(-max, Math.min(max, diff)) : diff;
    this.entity.rot = r;
  }
}
