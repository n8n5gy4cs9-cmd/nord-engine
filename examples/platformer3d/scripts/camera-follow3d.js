// @nord {"id":"camera.follow3d","title":"Camera follow (3D rig)","category":"camera","tier":["3d"],"tags":["camera","follow","chase"],"description":"Chase camera for 3D: keeps an offset from a target entity (by name), smoothing position. Put on a camera entity (non-orbit) — it looks at the target."}
import { NordScript } from 'nord';

export default class CameraFollow3D extends NordScript {
  static attributes = { target: { type: 'string', default: 'Player' }, offset: { type: 'vec3', default: [0, 4, -8] }, smoothing: { type: 'number', default: 5, min: 0 } };
  start() { this.t = this.scene.find(this.attrs.target); }
  lateUpdate(dt) {
    if (!this.t || this.t.destroyed) return;
    const a = this.attrs, tp = this.t.worldPos, p = this.entity.pos, k = Math.min(1, a.smoothing * dt || 1);
    const want = [tp[0] + a.offset[0], tp[1] + a.offset[1], tp[2] + a.offset[2]];
    const np = p.map((v, i) => v + (want[i] - v) * k);
    this.entity.pos = np;
    const d = [tp[0] - np[0], tp[1] - np[1], tp[2] - np[2]];
    this.entity.rot = [(-Math.atan2(d[1], Math.hypot(d[0], d[2])) * 180) / Math.PI, (Math.atan2(d[0], d[2]) * 180) / Math.PI, 0];
  }
}
