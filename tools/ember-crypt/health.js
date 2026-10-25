import { NordScript } from 'nord';

export default class Health extends NordScript {
  static attributes = {
    max: { type: 'number', default: 5, min: 1 },
    grace: { type: 'number', default: 1, min: 0, label: 'Invulnerable seconds after a hit' },
  };

  start() {
    this.hp = this.attrs.max;
    this.grace = 0;
    this.entity.on('hit', (e) => this.hit(e));
    this.entity.on('heal', ({ amount = 1 }) => {
      if (this.hp <= 0 || this.hp >= this.attrs.max) return;
      this.hp = Math.min(this.attrs.max, this.hp + amount);
      this.events.emit('health', { hp: this.hp, max: this.attrs.max });
    });
    this.events.emit('health', { hp: this.hp, max: this.attrs.max });
  }

  hit({ from, amount = 1 }) {
    if (this.hp <= 0 || this.grace > 0) return;
    this.hp = Math.max(0, this.hp - amount);
    this.grace = this.attrs.grace;
    this.audio.play('assets/audio/sfx/hurt.wav');
    this.game.camera.shake(160, 0.01);
    this.events.emit('health', { hp: this.hp, max: this.attrs.max });
    this.entity.emit('hurt', { from });
    if (this.hp <= 0) this.events.emit('died');
  }

  update(dt) {
    this.grace = Math.max(0, this.grace - dt);
    const blink = this.grace > 0 && Math.floor(this.grace * 12) % 2 === 0;
    this.entity.native.setAlpha(blink ? 0.3 : 1);                   // the escape hatch: the engine's own game object
  }
}
