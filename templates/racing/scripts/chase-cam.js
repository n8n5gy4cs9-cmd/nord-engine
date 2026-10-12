import { NordScript } from 'nord';

// Chase camera that sits behind the car's heading (smoothed) and looks at it.
export default class ChaseCam extends NordScript {
  static attributes = { target: { type: 'string', default: 'Car' }, distance: { type: 'number', default: 9 }, height: { type: 'number', default: 3.5 }, smoothing: { type: 'number', default: 6 } };
  start() { this.t = this.scene.find(this.attrs.target); this.yaw = this.t?.rot[1] ?? 0; }
  lateUpdate(dt) {
    if (!this.t) return; const a = this.attrs, k = Math.min(1, a.smoothing * dt), want = this.t.rot[1];
    this.yaw += (((want - this.yaw + 540) % 360) - 180) * k; const r = (this.yaw * Math.PI) / 180, p = this.t.worldPos;
    const np = [p[0] - Math.sin(r) * a.distance, p[1] + a.height, p[2] - Math.cos(r) * a.distance];
    this.entity.pos = np; this.entity.rot = [(Math.atan2(a.height - 0.8, a.distance) * 180) / Math.PI, this.yaw, 0];
  }
}
