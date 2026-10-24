import { MonoBehaviour, SerializeField, GameManager } from 'nord';

export default class Enemy extends MonoBehaviour {
  static attributes = SerializeField({ speed: 80 });

  Start() {
    this.player = this.FindWithTag('player');
    this.entity.on('death', () => this.Explode());   // the Health script emits 'death' just before it destroys us
  }

  FixedUpdate() {
    if (!this.player || this.player.destroyed || !this.player.enabled) return;
    const dx = this.player.pos[0] - this.entity.pos[0], dy = this.player.pos[1] - this.entity.pos[1], d = Math.hypot(dx, dy) || 1;
    this.physics.setVelocity(this.entity, (dx / d) * this.speed, (dy / d) * this.speed);
  }

  OnCollisionEnter(other) {                          // ram the player: hurt it and break apart
    if (!other.hasTag('player')) return;
    other.emit('damage', { amount: 1, from: this.entity });
    this.entity.emit('damage', { amount: 99 });
  }

  Explode() {
    GameManager.instance.AddScore(10);
    this.Instantiate('prefabs/explosion.prefab.json', { pos: [this.entity.pos[0], this.entity.pos[1], 6] });
  }
}
