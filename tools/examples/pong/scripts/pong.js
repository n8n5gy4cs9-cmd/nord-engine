import { NordScript } from 'nord';

export default class Pong extends NordScript {
  static attributes = {
    twoPlayer: { type: 'bool', default: false },
    paddleSpeed: { type: 'number', default: 260 },
    ballSpeed: { type: 'number', default: 260 },
    aiSpeed: { type: 'number', default: 200, label: 'AI paddle speed' },
    winScore: { type: 'int', default: 7 },
  };
  start() {
    const f = (n) => this.scene.find(n);
    this.p1 = f('P1'); this.p2 = f('P2'); this.ball = f('Ball'); this.label = f('Score');
    this.score = [0, 0]; this.over = false; this.serve(1);
  }
  serve(dir) {
    this.ball.pos = [320, 180, 0];
    const a = (this.rng.next() - 0.5) * 0.8;
    this.v = [Math.cos(a) * this.attrs.ballSpeed * dir, Math.sin(a) * this.attrs.ballSpeed]; this.pause = 0.6;
  }
  move(p, dir, dt) { p.pos = [p.pos[0], Math.max(40, Math.min(320, p.pos[1] + dir * this.attrs.paddleSpeed * dt)), 0]; }
  update(dt) {
    if (this.over) return;
    this.move(this.p1, this.input.axis('up', 'down'), dt);
    if (this.attrs.twoPlayer) this.move(this.p2, this.input.axis('p2up', 'p2down'), dt);
    else { const d = this.ball.pos[1] - this.p2.pos[1]; this.p2.pos = [616, Math.max(40, Math.min(320, this.p2.pos[1] + Math.sign(d) * Math.min(Math.abs(d), this.attrs.aiSpeed * dt))), 0]; }
    if ((this.pause -= dt) > 0) return;
    let [x, y] = this.ball.pos; x += this.v[0] * dt; y += this.v[1] * dt;
    if (y < 8 || y > 352) { this.v[1] *= -1; y = Math.max(8, Math.min(352, y)); this.events.emit('sfx', 'jump'); }
    for (const p of [this.p1, this.p2]) {
      if (Math.abs(x - p.pos[0]) < 10 && Math.abs(y - p.pos[1]) < 37 && Math.sign(this.v[0]) === Math.sign(x - p.pos[0]) * -1) {
        const k = (y - p.pos[1]) / 37, sp = Math.min(560, Math.hypot(...this.v) * 1.06), dir = -Math.sign(this.v[0]);
        this.v = [dir * sp * Math.cos(k * 0.9), sp * Math.sin(k * 0.9)]; this.events.emit('hit');
      }
    }
    this.ball.pos = [x, y, 0];
    if (x < -10 || x > 650) {
      const w = x > 650 ? 0 : 1; this.score[w]++; this.events.emit('pickup'); this.label.set('text', 'text', `${this.score[0]}   ${this.score[1]}`);
      this.label.set('text', 'text', `${this.score[0]}   ${this.score[1]}`);
      if (this.score[w] >= this.attrs.winScore) { this.over = true; this.events.emit(w === 0 ? 'game:win' : 'game:over'); } else this.serve(w === 0 ? -1 : 1);
    }
  }
}
