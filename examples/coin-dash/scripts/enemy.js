import { MonoBehaviour, SerializeField } from 'nord';

export default class Enemy extends MonoBehaviour {
  static attributes = SerializeField({ speed: 90 });

  Start() { this.player = this.FindWithTag('player'); }

  FixedUpdate() {
    if (!this.player || this.player.destroyed) return;
    const dx = this.player.pos[0] - this.entity.pos[0], dy = this.player.pos[1] - this.entity.pos[1];
    const d = Math.hypot(dx, dy) || 1;
    this.physics.setVelocity(this.entity, (dx / d) * this.speed, (dy / d) * this.speed);
  }
}
