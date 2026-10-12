import { NordScript } from 'nord';

// Contact rules: land on top of it (falling) → it dies and you bounce; touch it from the side → you take damage.
export default class Enemy extends NordScript {
  static attributes = { hp: { type: 'int', default: 1 }, damage: { type: 'number', default: 1 }, bounce: { type: 'number', default: 260 } };
  start() { this.hp = this.attrs.hp; }
  onCollisionEnter(o) {
    if (!o.hasTag('player')) return;
    const [, vy] = this.physics.velocity(o), above = o.pos[1] < this.entity.pos[1] - 6 * this.entity.scale[1];
    if (above && vy >= 0) { this.physics.setVelocity(o, null, -this.attrs.bounce); this.hurt(); } else o.emit('damage', { amount: this.attrs.damage, from: this.entity });
  }
  hurt() {
    this.events.emit('sfx', 'hit'); this.events.emit('hitstop', 40);
    if (--this.hp > 0) return;
    this.events.emit('score', 25); this.entity.emit('death'); this.entity.destroy();
  }
}
