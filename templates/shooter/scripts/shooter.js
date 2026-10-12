import { NordScript } from 'nord';
import { rect, circle } from './mk.js';

export default class Shooter extends NordScript {
  static attributes = { speed: { type: 'number', default: 220 }, fireRate: { type: 'number', default: 6 }, lives: { type: 'int', default: 3 }, spawnEvery: { type: 'number', default: 0.9 } };
  start() { this.p = this.scene.find('Player'); this.bullets = []; this.enemies = []; this.cd = 0; this.sp = 0.5; this.lives = this.attrs.lives; this.inv = 0; this.t = 0; this.dead = false; this.lbl = this.ui.label('', { screen: 'hud', anchor: 'tl', x: 12, y: 36, size: 16 }); this.hud(); }
  onDestroy() { this.lbl?.remove(); }
  hud() { this.lbl.set('♥'.repeat(this.lives)); }
  async update(dt) {
    if (this.dead) return; this.t += dt;
    const [x, y] = this.input.vec('left', 'right', 'up', 'down'), p = this.p;
    p.pos = [Math.max(14, Math.min(626, p.pos[0] + x * this.attrs.speed * dt)), Math.max(10, Math.min(350, p.pos[1] + y * this.attrs.speed * dt)), 5];
    this.inv -= dt; p.set('sprite', 'alpha', this.inv > 0 && Math.floor(this.inv * 16) % 2 ? 0.3 : 1);
    if ((this.cd -= dt) <= 0 && (this.input.down('fire') || this.input.pointer.down)) { this.cd = 1 / this.attrs.fireRate; this.events.emit('sfx', 'laser'); rect(this.scene, 'Bullet', p.pos[0] + 14, p.pos[1], 10, 3, '#ebcb8b', { z: 4 }).then((b) => this.bullets.push(b)); }
    if ((this.sp -= dt) <= 0) { this.sp = Math.max(0.3, this.attrs.spawnEvery - this.t * 0.005); const hp = 1 + Math.floor(this.t / 25), yy = this.rng.range(20, 340); circle(this.scene, 'Enemy', 660, yy, 22, '#bf616a', { z: 4 }).then((e) => this.enemies.push({ e, hp, y0: yy, ph: this.rng.range(0, 6), sp: this.rng.range(70, 130) })); }
    for (const b of this.bullets) { b.pos = [b.pos[0] + 480 * dt, b.pos[1], 4]; if (b.pos[0] > 660) b.destroy(); }
    for (const en of this.enemies) {
      const e = en.e; e.pos = [e.pos[0] - en.sp * dt, en.y0 + Math.sin(this.t * 2 + en.ph) * 40, 4];
      for (const b of this.bullets) if (!b.destroyed && Math.abs(b.pos[0] - e.pos[0]) < 14 && Math.abs(b.pos[1] - e.pos[1]) < 13) { b.destroy(); if (--en.hp <= 0) { e.destroy(); this.events.emit('score', 10); this.events.emit('sfx', 'explosion'); break; } }
      if (!e.destroyed && this.inv <= 0 && Math.abs(e.pos[0] - p.pos[0]) < 16 && Math.abs(e.pos[1] - p.pos[1]) < 14) { e.destroy(); this.lives--; this.inv = 1.5; this.hud(); this.events.emit('sfx', 'hit'); this.game.camera?.shake?.(200, 0.01); if (this.lives <= 0) { this.dead = true; this.events.emit('game:over'); } }
      if (e.pos[0] < -20) e.destroy();
    }
    this.bullets = this.bullets.filter((b) => !b.destroyed); this.enemies = this.enemies.filter((q) => !q.e.destroyed);
  }
}
