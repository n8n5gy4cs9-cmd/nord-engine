import { NordScript } from 'nord';
export default class Spin extends NordScript {
  static attributes = { speed: { type: 'number', default: 120, label: 'Degrees/sec' } };
  update(dt) { const r = this.entity.rot; this.entity.rot = [r[0], r[1] + this.attrs.speed * dt, r[2]]; }
}
