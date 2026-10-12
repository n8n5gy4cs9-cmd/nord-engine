// @nord {"id":"controller.tank","title":"Tank controls","category":"controllers","tier":["2d"],"tags":["tank","vehicle","rotate"],"requires":["rigidbody"],"description":"Rotate with left/right, drive forward/back with up/down. The sprite should face +x."}
import { NordScript } from 'nord';

export default class Tank extends NordScript {
  static attributes = {
    speed: { type: 'number', default: 140, min: 0 },
    turnRate: { type: 'number', default: 150, min: 0, label: 'Turn speed (deg/s)' },
    reverseFactor: { type: 'number', default: 0.6, min: 0 },
  };
  fixedUpdate(dt) {
    const r = [...this.entity.rot];
    r[2] += this.input.axis('left', 'right') * this.attrs.turnRate * dt;
    this.entity.rot = r;
    const f = this.input.axis('down', 'up'), a = (r[2] * Math.PI) / 180;
    const s = f * this.attrs.speed * (f < 0 ? this.attrs.reverseFactor : 1);
    this.physics.setVelocity(this.entity, Math.cos(a) * s, Math.sin(a) * s);
  }
}
