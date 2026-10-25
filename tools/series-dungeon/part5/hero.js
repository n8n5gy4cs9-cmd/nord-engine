import { NordScript } from 'nord';

export default class Hero extends NordScript {
  static attributes = {
    speed: { type: 'number', default: 160, min: 0, label: 'Speed (px/s)' },
    knockback: { type: 'number', default: 260, min: 0 },
  };

  start() {
    this.kick = [0, 0];
    this.stun = 0;
    this.dead = false;
    this.entity.on('hurt', ({ from }) => {
      const dx = this.entity.pos[0] - from.pos[0], dy = this.entity.pos[1] - from.pos[1];
      const d = Math.hypot(dx, dy) || 1;
      this.kick = [dx / d * this.attrs.knockback, dy / d * this.attrs.knockback];
      this.stun = 0.15;                                             // no steering while we fly backwards
    });
    this.off = this.events.on('died', () => { this.dead = true; });
  }

  fixedUpdate(dt) {
    if (this.dead) { this.physics.setVelocity(this.entity, 0, 0); return; }
    if (this.stun > 0) {
      this.stun -= dt;
      this.physics.setVelocity(this.entity, this.kick[0], this.kick[1]);
      return;
    }
    const [x, y] = this.input.vec('left', 'right', 'up', 'down');
    this.physics.setVelocity(this.entity, x * this.attrs.speed, y * this.attrs.speed);
  }

  onDestroy() { this.off?.(); }
}
