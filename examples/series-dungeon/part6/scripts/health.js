import { NordScript } from 'nord';

export default class Health extends NordScript {
  static attributes = {
    max: { type: 'number', default: 3, min: 1 },
    grace: { type: 'number', default: 1, min: 0, label: 'Invulnerable seconds after a hit' },
  };

  start() {
    this.hp = this.attrs.max;
    this.grace = 0;
    this.entity.on('hit', (e) => this.hit(e));
    this.events.emit('health', { hp: this.hp, max: this.attrs.max });
  }

  hit({ from }) {
    if (this.hp <= 0 || this.grace > 0) return;                     // already dead, or still protected
    this.hp--;
    this.grace = this.attrs.grace;
    this.events.emit('health', { hp: this.hp, max: this.attrs.max });
    this.entity.emit('hurt', { from });                             // the hero script reacts with knockback
    if (this.hp <= 0) this.events.emit('died');
  }

  update(dt) {
    this.grace = Math.max(0, this.grace - dt);
    const blink = this.grace > 0 && Math.floor(this.grace * 10) % 2 === 0;
    this.entity.set('sprite', 'alpha', blink ? 0.35 : 1);
  }
}
