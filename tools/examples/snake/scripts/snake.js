import { NordScript } from 'nord';
import { rect } from './mk.js';

const W = 32, H = 18, C = 20;
export default class Snake extends NordScript {
  static attributes = { stepTime: { type: 'number', default: 0.12, min: 0.03 }, speedup: { type: 'number', default: 0.002 }, wrap: { type: 'bool', default: false } };
  async start() {
    this.body = [[8, 9], [7, 9], [6, 9]]; this.dir = [1, 0]; this.next = [1, 0]; this.t = 0; this.score = 0; this.dead = false; this.step = this.attrs.stepTime;
    this.segs = []; this.label = this.ui.label('Score 0', { screen: 'hud', x: 12, y: 8, size: 20 });
    this.food = await rect(this.scene, 'Food', 0, 0, C - 4, C - 4, '#bf616a'); this.placeFood();
    for (const c of this.body) this.segs.push(await this.seg(c));
  }
  onDestroy() { this.label?.remove(); }
  seg(c) { return rect(this.scene, 'Seg', c[0] * C + C / 2, c[1] * C + C / 2, C - 2, C - 2, '#a3be8c'); }
  placeFood() {
    let c; do c = [this.rng.int(0, W - 1), this.rng.int(0, H - 1)]; while (this.body.some((b) => b[0] === c[0] && b[1] === c[1]));
    this.f = c; this.food.pos = [c[0] * C + C / 2, c[1] * C + C / 2, 0];
  }
  update(dt) {
    if (this.dead) return;
    for (const [a, d] of [['left', [-1, 0]], ['right', [1, 0]], ['up', [0, -1]], ['down', [0, 1]]]) if (this.input.pressed(a) && d[0] !== -this.dir[0] && d[1] !== -this.dir[1]) this.next = d;
    if ((this.t += dt) < this.step) return; this.t = 0; this.dir = this.next;
    let h = [this.body[0][0] + this.dir[0], this.body[0][1] + this.dir[1]];
    if (this.attrs.wrap) h = [(h[0] + W) % W, (h[1] + H) % H];
    if (h[0] < 0 || h[1] < 0 || h[0] >= W || h[1] >= H || this.body.some((b) => b[0] === h[0] && b[1] === h[1])) { this.dead = true; this.events.emit('sfx', 'explosion'); this.events.emit('game:over'); return; }
    this.body.unshift(h);
    if (h[0] === this.f[0] && h[1] === this.f[1]) {
      this.score++; this.label.set(`Score ${this.score}`); this.events.emit('sfx', 'coin'); this.step = Math.max(0.04, this.step - this.attrs.speedup * 10); this.placeFood();
      this.seg(h).then((s) => this.segs.unshift(s));
    } else { const tail = this.segs.pop(), c = this.body.pop(); tail.pos = [h[0] * C + C / 2, h[1] * C + C / 2, 0]; this.segs.unshift(tail); }
  }
}
