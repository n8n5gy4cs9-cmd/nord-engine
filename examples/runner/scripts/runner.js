import { NordScript } from 'nord';
import { rect } from './mk.js';

export default class Runner extends NordScript {
  static attributes = { speed: { type: 'number', default: 200 }, gain: { type: 'number', default: 6 }, gravity: { type: 'number', default: 1500 }, jump: { type: 'number', default: 560 } };
  start() { this.r = this.scene.find('Runner'); this.y = 290; this.vy = 0; this.obs = []; this.t = 1; this.dist = 0; this.s = this.attrs.speed; this.dead = false; this.best = this.save.get('runner.best', 0); this.lbl = this.ui.label('', { screen: 'hud', x: 12, y: 8, size: 22 }); }
  onDestroy() { this.lbl?.remove(); }
  update(dt) {
    if (this.dead) return; this.s += this.attrs.gain * dt; this.dist += this.s * dt;
    const ground = 290, duck = this.input.down('down') && this.y >= ground;
    if (this.input.pressed('jump') && this.y >= ground) { this.vy = -this.attrs.jump; this.events.emit('sfx', 'jump'); }
    this.vy += this.attrs.gravity * dt; this.y = Math.min(ground, this.y + this.vy * dt); if (this.y >= ground) this.vy = 0;
    const h = duck ? 16 : 30; this.r.set('sprite', 'tint', duck ? '#d08770' : '#ebcb8b'); this.r.pos = [90, this.y + (30 - h) / 2, 5]; this.r.scale = [1, h / 30, 1];
    if ((this.t -= dt) <= 0) {
      this.t = this.rng.range(0.9, 1.8) * (200 / this.s) + 0.5; const air = this.rng.chance(0.3);
      rect(this.scene, 'Obstacle', 680, air ? 268 : 298, air ? 30 : 24, air ? 16 : 34, air ? '#b48ead' : '#bf616a', { z: 4 }).then((o) => this.obs.push({ o, w: air ? 30 : 24, h: air ? 16 : 34 }));
    }
    for (const q of this.obs) {
      q.o.pos = [q.o.pos[0] - this.s * dt, q.o.pos[1], 4];
      if (Math.abs(q.o.pos[0] - 90) * 2 < 22 + q.w && Math.abs(q.o.pos[1] - (this.y + (30 - h) / 2)) * 2 < h + q.h) this.die();
      if (q.o.pos[0] < -30) q.o.destroy();
    }
    this.obs = this.obs.filter((q) => !q.o.destroyed);
    this.lbl.set(`${Math.floor(this.dist / 10)} m   best ${this.best}`);
  }
  die() { this.dead = true; const m = Math.floor(this.dist / 10); if (m > this.best) this.save.set('runner.best', m); this.events.emit('sfx', 'hit'); this.events.emit('game:over'); }
}
