import Enemy from './enemy.js';

export default class Boss extends Enemy {
  static attributes = { ...Enemy.attributes, hp: { type: 'int', default: 5 }, damage: { type: 'number', default: 2 } };
  hurt() {
    this.game.camera?.shake?.(200, 0.01); this.physics.setVelocity(this.entity, null, -120);
    super.hurt();
    if (this.hp <= 0) { this.events.emit('score', 200); this.after(0.6, () => this.events.emit('game:win')); }
  }
}
