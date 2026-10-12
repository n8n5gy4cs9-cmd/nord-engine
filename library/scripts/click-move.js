// @nord {"id":"controller.click-move","title":"Click to move","category":"controllers","tier":["2d"],"tags":["mouse","rts","point-and-click"],"description":"Walk to the clicked world position at a fixed speed; emits 'arrived' on the entity when done."}
import { NordScript } from 'nord';

export default class ClickMove extends NordScript {
  static attributes = {
    speed: { type: 'number', default: 160, min: 0 },
    stopDistance: { type: 'number', default: 3, min: 0 },
    button: { type: 'string', default: 'Mouse0', label: 'Input code that sets the target' },
  };
  start() { this.target = null; }
  update(dt) {
    if (this.input.key(this.attrs.button) && !this.held) { this.held = true; this.target = [this.input.pointer.worldX, this.input.pointer.worldY]; }
    if (!this.input.key(this.attrs.button)) this.held = false;
    if (!this.target) return;
    const [x, y, z] = this.entity.pos, dx = this.target[0] - x, dy = this.target[1] - y, d = Math.hypot(dx, dy);
    if (d <= this.attrs.stopDistance) { this.target = null; this.entity.emit('arrived'); return; }
    const s = Math.min(d, this.attrs.speed * dt);
    this.entity.pos = [x + (dx / d) * s, y + (dy / d) * s, z];
  }
}
