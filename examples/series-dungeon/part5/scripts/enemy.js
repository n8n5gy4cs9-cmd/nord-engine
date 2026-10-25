import { NordScript } from 'nord';

export default class Enemy extends NordScript {
  static attributes = {
    speed: { type: 'number', default: 80, min: 0 },
    sight: { type: 'number', default: 170, min: 0, label: 'Sees the hero within (px)' },
    reach: { type: 'number', default: 24, min: 0, label: 'Touch distance (px)' },
  };

  start() {
    this.hero = this.scene.find('Hero');
    this.dir = [0, 0];
    this.think = this.rng.range(0, 1);
  }

  distance() {
    return Math.hypot(this.hero.pos[0] - this.entity.pos[0], this.hero.pos[1] - this.entity.pos[1]);
  }

  fixedUpdate(dt) {
    if (!this.hero || this.hero.destroyed) return;
    const d = this.distance();
    if (d < this.attrs.sight) {                                     // chase
      this.dir = [(this.hero.pos[0] - this.entity.pos[0]) / d, (this.hero.pos[1] - this.entity.pos[1]) / d];
      this.think = 0.3;
    } else {                                                        // wander: pick a new direction every second or two
      this.think -= dt;
      if (this.think <= 0) {
        const a = this.rng.range(0, Math.PI * 2);
        this.dir = this.rng.next() < 0.3 ? [0, 0] : [Math.cos(a), Math.sin(a)];
        this.think = this.rng.range(1, 2.5);
      }
    }
    const s = this.attrs.speed * (d < this.attrs.sight ? 1 : 0.4);
    this.physics.setVelocity(this.entity, this.dir[0] * s, this.dir[1] * s);
  }

  update() {
    if (this.hero && !this.hero.destroyed && this.distance() < this.attrs.reach) this.hero.emit('hit', { from: this.entity });
  }
}
