// @nord {"id":"controller3d.platformer","title":"3D platformer","category":"controllers","tier":["3d"],"tags":["platformer","jump","coyote"],"requires":["rigidbody","collider"],"description":"World-axis movement (works with a fixed or follow camera looking down +z): coyote time, jump buffer, variable jump height, double jump."}
import { NordScript } from 'nord';

export default class Platformer3D extends NordScript {
  static attributes = {
    speed: { type: 'number', default: 5, min: 0 }, jumpSpeed: { type: 'number', default: 8, min: 0 },
    coyote: { type: 'number', default: 0.1, min: 0 }, buffer: { type: 'number', default: 0.12, min: 0 },
    doubleJump: { type: 'bool', default: true }, cut: { type: 'number', default: 0.5, min: 0, max: 1 },
  };
  start() { this.ct = 0; this.bt = 0; this.air = 0; }
  fixedUpdate(dt) {
    const a = this.attrs, e = this.entity, g = this.physics.isGrounded(e);
    const [mx, mz] = this.input.vec('left', 'right', 'down', 'up');
    this.physics.setVelocity(e, mx * a.speed, null, mz * a.speed);
    if (mx || mz) e.rot = [0, (Math.atan2(mx, mz) * 180) / Math.PI, 0];
    this.ct = g ? a.coyote : this.ct - dt; if (g) this.air = 0;
    this.bt = this.input.pressed('jump') ? a.buffer : this.bt - dt;
    const vy = this.physics.velocity(e)[1];
    if (this.bt > 0 && (this.ct > 0 || (a.doubleJump && this.air === 1))) {
      if (this.ct <= 0) this.air = 2; else this.air = 1;
      this.physics.setVelocity(e, null, a.jumpSpeed, null); this.bt = 0; this.ct = 0;
    } else if (!g && vy > 0 && this.input.released('jump')) this.physics.setVelocity(e, null, vy * a.cut, null);
  }
}
