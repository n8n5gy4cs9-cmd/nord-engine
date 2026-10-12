// Follow pointer (2D) — moves the entity toward the mouse/touch position in world space.
import { NordScript } from 'nord';

export default class FollowPointer extends NordScript {
  static attributes = {
    speed: { type: 'number', default: 240, min: 0, label: 'Max speed (px/s)' },
    snapRadius: { type: 'number', default: 2, min: 0 },
  };

  update(dt) {
    const p = this.input.pointer;
    const [x, y] = this.entity.pos;
    const dx = p.worldX - x, dy = p.worldY - y;
    const d = Math.hypot(dx, dy);
    if (d <= this.attrs.snapRadius) return;
    const step = Math.min(d, this.attrs.speed * dt);
    this.entity.pos = [x + (dx / d) * step, y + (dy / d) * step, this.entity.pos[2]];
  }
}
