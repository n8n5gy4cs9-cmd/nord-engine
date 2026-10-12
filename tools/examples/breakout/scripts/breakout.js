import { NordScript } from 'nord';
import { rect } from './mk.js';

const ROWS = ['#bf616a', '#d08770', '#ebcb8b', '#a3be8c', '#88c0d0'];
export default class Breakout extends NordScript {
  static attributes = { lives: { type: 'int', default: 3 }, ballSpeed: { type: 'number', default: 240 }, paddleSpeed: { type: 'number', default: 340 } };
  async start() {
    this.paddle = this.scene.find('Paddle'); this.ball = this.scene.find('Ball'); this.info = this.scene.find('Info');
    this.lives = this.attrs.lives; this.bricks = []; this.stuck = true; this.livesLabel = this.ui.label('', { screen: 'hud', anchor: 'tl', x: 12, y: 36, size: 16 });
    for (let r = 0; r < ROWS.length; r++) for (let c = 0; c < 10; c++) this.bricks.push(await rect(this.scene, `Brick`, 40 + c * 62, 50 + r * 20, 56, 14, ROWS[r], { tags: ['brick'] }));
    this.hud();
  }
  onDestroy() { this.livesLabel?.remove(); }
  hud() { this.livesLabel.set('♥'.repeat(this.lives)); }
  update(dt) {
    const d = this.input.axis('left', 'right'), p = this.paddle;
    p.pos = [Math.max(40, Math.min(600, p.pos[0] + d * this.attrs.paddleSpeed * dt)), 340, 0];
    if (this.stuck) {
      this.ball.pos = [p.pos[0], 330, 0];
      if (this.input.pressed('fire') || this.input.pressed('jump')) { this.stuck = false; this.info.pos = [320, -50, 0]; const a = -Math.PI / 2 + (this.rng.next() - 0.5) * 0.8; this.v = [Math.cos(a) * this.attrs.ballSpeed, Math.sin(a) * this.attrs.ballSpeed]; }
      return;
    }
    let [x, y] = this.ball.pos; x += this.v[0] * dt; y += this.v[1] * dt;
    if (x < 4 || x > 636) { this.v[0] *= -1; x = Math.max(4, Math.min(636, x)); }
    if (y < 4) { this.v[1] = Math.abs(this.v[1]); y = 4; }
    if (this.v[1] > 0 && Math.abs(x - p.pos[0]) < 39 && y > 331 && y < 345) { const k = (x - p.pos[0]) / 39; const sp = Math.hypot(...this.v); this.v = [Math.sin(k * 1.1) * sp, -Math.cos(k * 1.1) * sp]; this.events.emit('sfx', 'jump'); this.combo = 0; }
    for (const b of this.bricks) {
      if (b.destroyed) continue;
      if (Math.abs(x - b.pos[0]) < 32 && Math.abs(y - b.pos[1]) < 11) {
        const ox = 32 - Math.abs(x - b.pos[0]), oy = 11 - Math.abs(y - b.pos[1]);
        if (ox < oy) this.v[0] *= -1; else this.v[1] *= -1;
        b.destroy(); this.events.emit('score', 10); this.events.emit('hit'); this.v = this.v.map((c) => c * 1.01); break;
      }
    }
    this.ball.pos = [x, y, 0];
    if (this.bricks.every((b) => b.destroyed)) this.events.emit('game:win');
    if (y > 372) {
      this.lives--; this.hud(); this.events.emit('sfx', 'explosion');
      if (this.lives <= 0) this.events.emit('game:over'); else { this.stuck = true; this.info.pos = [320, 190, 0]; }
    }
  }
}
