import { NordScript } from 'nord';
import { lineClear } from './world.js';
import { floatText, burst, hitStop } from './fx.js';
import { coin } from './entities.js';

export default class Enemy extends NordScript {
  static attributes = {
    speed: { type: 'number', default: 55, min: 0 },
    hp: { type: 'number', default: 2, min: 1 },
    sight: { type: 'number', default: 150, min: 0, label: 'Sees the hero within (px)' },
    reach: { type: 'number', default: 20, min: 0, label: 'Touch distance (px)' },
    anim: { type: 'string', default: 'idle' },
    zigzag: { type: 'number', default: 0, min: 0, label: 'Sideways wobble (bats)' },
  };

  start() {
    this.hero = this.scene.find('Hero');
    this.sprite = this.entity.getComponent('animatedSprite');
    this.hp = this.attrs.hp;
    this.dir = [0, 0];
    this.think = this.rng.range(0, 1);
    this.stun = 0;
    this.kick = [0, 0];
    this.t = this.rng.range(0, 6);
    this.entity.on('damage', (e) => this.damage(e));
  }

  fixedUpdate(dt) {
    if (!this.hero || this.hero.destroyed) return;
    this.t += dt;
    if (this.stun > 0) { this.stun -= dt; this.physics.setVelocity(this.entity, this.kick[0], this.kick[1]); return; }
    const [ex, ey] = this.entity.pos, [hx, hy] = this.hero.pos;
    const d = Math.hypot(hx - ex, hy - ey);
    const sees = d < this.attrs.sight && lineClear(ex, ey, hx, hy);   // close enough AND no wall in between
    if (sees) {
      this.dir = [(hx - ex) / d, (hy - ey) / d];
      this.think = 0.4;
    } else {
      this.think -= dt;
      if (this.think <= 0) {
        const a = this.rng.range(0, Math.PI * 2);
        this.dir = this.rng.next() < 0.3 ? [0, 0] : [Math.cos(a), Math.sin(a)];
        this.think = this.rng.range(1, 2.5);
      }
    }
    const wobble = Math.sin(this.t * 7) * this.attrs.zigzag * 0.8;     // push sideways: the bat swerves
    const vx = this.dir[0] - this.dir[1] * wobble, vy = this.dir[1] + this.dir[0] * wobble;
    const s = this.attrs.speed * (sees ? 1 : 0.45);
    this.physics.setVelocity(this.entity, vx * s, vy * s);
    if (this.dir[0]) this.sprite.setFlip(this.dir[0] < 0);
  }

  update() {
    if (!this.hero || this.hero.destroyed) return;
    const d = Math.hypot(this.hero.pos[0] - this.entity.pos[0], this.hero.pos[1] - this.entity.pos[1]);
    if (d < this.attrs.reach) this.hero.emit('hit', { from: this.entity });
  }

  damage({ amount, from }) {
    this.hp -= amount;
    const [x, y] = this.entity.pos;
    const dx = x - from.pos[0], dy = y - from.pos[1], d = Math.hypot(dx, dy) || 1;
    this.kick = [dx / d * 260, dy / d * 260];
    this.stun = 0.18;
    floatText(this.scene, x, y, amount, '#ffe27a');
    this.audio.play('assets/audio/sfx/hit.wav', { volume: 0.8 });
    hitStop(this.game, 55);
    burst(this.scene, x, y, { tint: '#ffffff', tintEnd: '#9bd1ff', count: 6, life: 250 });
    if (this.hp <= 0) this.die();
  }

  die() {
    const [x, y] = this.entity.pos;
    burst(this.scene, x, y, { texture: 'assets/particles/smoke.png', tint: '#d8e4ff', tintEnd: '#2a2f45', count: 12, life: 600 });
    this.audio.play('assets/audio/sfx/death.wav', { volume: 0.6 });
    if (this.rng.next() < 0.6) this.scene.spawnData(coin(x, y));      // sometimes drops a coin
    this.entity.destroy();
  }
}
