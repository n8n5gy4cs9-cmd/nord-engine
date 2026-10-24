// Chase camera: follows the target from behind its heading and looks at it.
import { MonoBehaviour, SerializeField } from 'nord';

export default class ChaseCam extends MonoBehaviour {
  static attributes = { target: { type: 'string', default: 'Skiff' }, offset: { type: 'vec3', default: [0, 7, -13] }, smoothing: { type: 'number', default: 4 } };

  Start() { this.t = this.Find(this.target); }

  LateUpdate(dt) {
    if (!this.t || this.t.destroyed) return;
    const tp = this.t.worldPos, h = (this.t.rot[1] * Math.PI) / 180, o = this.offset;
    // offset[2] is how far behind the skiff (negative) along its heading, offset[1] the height
    const want = [tp[0] + Math.sin(h) * o[2], tp[1] + o[1], tp[2] + Math.cos(h) * o[2]];
    const k = Math.min(1, this.smoothing * dt), p = this.entity.pos;
    const np = [p[0] + (want[0] - p[0]) * k, p[1] + (want[1] - p[1]) * k, p[2] + (want[2] - p[2]) * k];
    this.entity.pos = np;
    const d = [tp[0] - np[0], tp[1] + 1 - np[1], tp[2] - np[2]];
    this.entity.rot = [(-Math.atan2(d[1], Math.hypot(d[0], d[2])) * 180) / Math.PI, (Math.atan2(d[0], d[2]) * 180) / Math.PI, 0];
  }
}
