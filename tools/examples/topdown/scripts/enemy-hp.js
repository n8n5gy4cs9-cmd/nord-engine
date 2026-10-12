import { NordScript } from 'nord';

// Press E near an enemy to hit it (3 hits). Keeps the example free of a weapon system.
export default class EnemyHp extends NordScript {
  static attributes = { hp: { type: 'int', default: 3 }, reach: { type: 'number', default: 34 } };
  start() { this.hp = this.attrs.hp; this.sprite = this.entity.getComponent('animatedSprite'); }
  update() {
    const p = this.scene.findByTag('player')[0]; if (!p || !this.input.pressed('interact')) return;
    if (Math.hypot(p.pos[0] - this.entity.pos[0], p.pos[1] - this.entity.pos[1]) > this.attrs.reach) return;
    this.events.emit('sfx', 'hit'); this.events.emit('popup', { x: this.entity.pos[0], y: this.entity.pos[1] - 12, text: '1' });
    if (--this.hp <= 0) { this.events.emit('score', 50); this.entity.destroy(); }
  }
}
