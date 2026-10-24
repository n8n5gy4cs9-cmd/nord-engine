// Slow fly-over for the title screen.
import { MonoBehaviour } from 'nord';

export default class OrbitCam extends MonoBehaviour {
  static attributes = { radius: { type: 'number', default: 70 }, height: { type: 'number', default: 18 }, speed: { type: 'number', default: 6 } };

  Update(dt) {
    this.a = (this.a ?? 200) + this.speed * dt;
    const r = (this.a * Math.PI) / 180;
    this.entity.pos = [Math.sin(r) * this.radius, this.height, Math.cos(r) * this.radius];
    const d = [-this.entity.pos[0], 6 - this.height, -this.entity.pos[2]];
    this.entity.rot = [(-Math.atan2(d[1], Math.hypot(d[0], d[2])) * 180) / Math.PI, (Math.atan2(d[0], d[2]) * 180) / Math.PI, 0];
  }
}
