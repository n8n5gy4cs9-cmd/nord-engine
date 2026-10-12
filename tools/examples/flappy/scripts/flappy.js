import { NordScript } from 'nord';
import { rect } from './mk.js';

export default class Flappy extends NordScript {
  static attributes = { gravity: { type: 'number', default: 900 }, flap: { type: 'number', default: 300 }, speed: { type: 'number', default: 130 }, gap: { type: 'number', default: 100 }, spacing: { type: 'number', default: 1.7 } };
  start() {
    this.bird = this.scene.find('Bird'); this.vy = 0; this.pipes = []; this.t = 1; this.score = 0; this.dead = false; this.started = false;
    this.label = this.ui.label('Press SPACE', { screen: 'hud', x: 0, y: 20, size: 28, style: { width: '100%', textAlign: 'center' } });
  }
  onDestroy() { this.label?.remove(); }
  async spawnPipe() {
    const gy = this.rng.range(70, 250), g = this.attrs.gap, col = '#a3be8c';
    const top = await rect(this.scene, 'PipeTop', 680, gy - g / 2 - 200, 44, 400, col, { z: 3 }), bot = await rect(this.scene, 'PipeBottom', 680, gy + g / 2 + 200, 44, 400, col, { z: 3 });
    this.pipes.push({ top, bot, passed: false });
  }
  update(dt) {
    if (this.dead) return;
    if (this.input.pressed('jump')) { this.started = true; this.vy = -this.attrs.flap; this.events.emit('sfx', 'jump'); if (!this.score) this.label.set('0'); }
    if (!this.started) return;
    this.vy += this.attrs.gravity * dt; const b = this.bird, y = b.pos[1] + this.vy * dt; b.pos = [150, y, 10]; b.rot = [0, 0, Math.max(-25, Math.min(70, this.vy * 0.1))];
    if ((this.t -= dt) <= 0) { this.t = this.attrs.spacing; this.spawnPipe(); }
    for (const p of this.pipes) {
      for (const s of [p.top, p.bot]) { s.pos = [s.pos[0] - this.attrs.speed * dt, s.pos[1], 3]; if (Math.abs(s.pos[0] - 150) < 32 && Math.abs(s.pos[1] - y) < 210) this.die(); }
      if (!p.passed && p.top.pos[0] < 150) { p.passed = true; this.score++; this.label.set(String(this.score)); this.events.emit('sfx', 'coin'); }
    }
    for (const p of this.pipes.filter((q) => q.top.pos[0] < -40)) { p.top.destroy(); p.bot.destroy(); }
    this.pipes = this.pipes.filter((q) => q.top.pos[0] >= -40);
    if (y > 340 || y < -20) this.die();
  }
  die() { if (this.dead) return; this.dead = true; this.events.emit('sfx', 'hit'); this.events.emit('game:over'); }
}
