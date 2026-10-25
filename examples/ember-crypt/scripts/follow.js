import { NordScript } from 'nord';

export default class Follow extends NordScript {
  static attributes = {
    target: { type: 'string', default: 'Hero', label: 'Name of the entity to follow' },
    stiffness: { type: 'number', default: 8, min: 0, label: 'Follow speed (0 = snap)' },
    viewport: { type: 'vec2', default: [640, 360] },
  };

  start() {
    this.target = this.scene.find(this.attrs.target);
    this.bounds = null;
    this.off = this.events.on('level', (size) => { this.bounds = size; this.snap = true; });
  }

  lateUpdate(dt) {
    if (!this.target || !this.bounds) return;
    const [hw, hh] = [this.attrs.viewport[0] / 2, this.attrs.viewport[1] / 2];
    const goalX = Math.max(hw, Math.min(this.bounds.width - hw, this.target.pos[0]));
    const goalY = Math.max(hh, Math.min(this.bounds.height - hh, this.target.pos[1]));
    const [x, y, z] = this.entity.pos;
    const k = this.snap || !this.attrs.stiffness ? 1 : 1 - Math.exp(-this.attrs.stiffness * dt);
    this.snap = false;
    this.entity.pos = [x + (goalX - x) * k, y + (goalY - y) * k, z];
  }

  onDestroy() { this.off?.(); }
}
