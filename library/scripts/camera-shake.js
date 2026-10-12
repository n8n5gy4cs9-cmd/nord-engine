// @nord {"id":"camera.shake","title":"Camera shake on event","category":"camera","tier":["2d","3d"],"tags":["camera","shake","juice"],"description":"Shakes the camera whenever a global event fires (default 'hit'). Event payload may be a number to scale the intensity. 3D: shakes this entity's position instead."}
import { NordScript } from 'nord';

export default class CameraShake extends NordScript {
  static attributes = { event: { type: 'string', default: 'hit' }, duration: { type: 'number', default: 0.25, min: 0 }, intensity: { type: 'number', default: 0.01, min: 0, label: '2D: fraction of view · 3D: metres' } };
  start() { this.off = this.events.on(this.attrs.event, (p) => this.shake(typeof p === 'number' ? p : 1)); this.left = 0; this.base = null; }
  onDestroy() { this.off?.(); }
  shake(scale = 1) {
    if (this.game.camera?.shake) return this.game.camera.shake(this.attrs.duration * 1000, this.attrs.intensity * scale);
    this.left = this.attrs.duration; this.scale = scale; this.base ??= [...this.entity.pos];
  }
  update(dt) {
    if (!this.base) return;
    if (this.left > 0) {
      this.left -= dt; const k = (this.left / this.attrs.duration) * this.attrs.intensity * this.scale;
      this.entity.pos = [this.base[0] + (this.rng.next() - 0.5) * 2 * k, this.base[1] + (this.rng.next() - 0.5) * 2 * k, this.base[2]];
    } else { this.entity.pos = this.base; this.base = null; }
  }
}
