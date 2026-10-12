import { NordScript } from 'nord';

const SHAPES = { I: [[1, 1, 1, 1]], O: [[1, 1], [1, 1]], T: [[0, 1, 0], [1, 1, 1]], S: [[0, 1, 1], [1, 1, 0]], Z: [[1, 1, 0], [0, 1, 1]], J: [[1, 0, 0], [1, 1, 1]], L: [[0, 0, 1], [1, 1, 1]] };
const COL = { I: '#88c0d0', O: '#ebcb8b', T: '#b48ead', S: '#a3be8c', Z: '#bf616a', J: '#81a1c1', L: '#d08770' };
export const rotate = (m) => m[0].map((_, i) => m.map((r) => r[i]).reverse());
export default class Blocks extends NordScript {
  static attributes = { cell: { type: 'int', default: 16 } };
  start() {
    this.W = 10; this.H = 20; this.grid = Array.from({ length: this.H }, () => Array(this.W).fill(null)); this.score = 0; this.lines = 0; this.t = 0; this.over = false; this.bag = [];
    const c = this.attrs.cell; this.cv = this.ui.doc.createElement('canvas'); this.cv.width = this.W * c + 100; this.cv.height = this.H * c; Object.assign(this.cv.style, { position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%,-50%)', height: '90%', imageRendering: 'pixelated' });
    this.ui.screen('hud').append(this.cv); this.ctx = this.cv.getContext('2d'); this.next = this.take(); this.spawn(); this.draw();
  }
  onDestroy() { this.cv?.remove(); }
  take() { if (!this.bag.length) this.bag = this.rng.shuffle(Object.keys(SHAPES)); return this.bag.pop(); }
  spawn() { const k = this.next; this.next = this.take(); this.p = { k, m: SHAPES[k], x: 3, y: 0 }; if (this.hit(this.p.m, this.p.x, this.p.y)) { this.over = true; this.events.emit('game:over'); } }
  hit(m, px, py) { return m.some((r, y) => r.some((v, x) => v && (px + x < 0 || px + x >= this.W || py + y >= this.H || this.grid[py + y]?.[px + x]))); }
  lock() {
    this.p.m.forEach((r, y) => r.forEach((v, x) => v && (this.grid[this.p.y + y][this.p.x + x] = this.p.k)));
    let n = 0; for (let y = this.H - 1; y >= 0; y--) if (this.grid[y].every(Boolean)) { this.grid.splice(y, 1); this.grid.unshift(Array(this.W).fill(null)); n++; y++; }
    if (n) { this.lines += n; this.score += [0, 100, 300, 500, 800][n] * (1 + Math.floor(this.lines / 10)); this.events.emit('sfx', 'powerup'); } else this.events.emit('sfx', 'hit');
    this.spawn();
  }
  update(dt) {
    if (this.over) return; const p = this.p;
    if (this.input.pressed('left') && !this.hit(p.m, p.x - 1, p.y)) p.x--; if (this.input.pressed('right') && !this.hit(p.m, p.x + 1, p.y)) p.x++;
    if (this.input.pressed('rotate')) { const r = rotate(p.m); for (const k of [0, -1, 1, -2, 2]) if (!this.hit(r, p.x + k, p.y)) { p.m = r; p.x += k; break; } }
    if (this.input.pressed('drop')) { while (!this.hit(p.m, p.x, p.y + 1)) p.y++; this.lock(); this.draw(); return; }
    const speed = this.input.down('down') ? 0.04 : Math.max(0.08, 0.7 - 0.06 * Math.floor(this.lines / 10)); this.t += dt;
    if (this.t >= speed) { this.t = 0; if (this.hit(p.m, p.x, p.y + 1)) this.lock(); else p.y++; }
    this.draw();
  }
  draw() {
    const c = this.attrs.cell, g = this.ctx; g.fillStyle = '#2b303b'; g.fillRect(0, 0, this.cv.width, this.cv.height); g.fillStyle = '#232831'; g.fillRect(0, 0, this.W * c, this.H * c);
    const cell = (x, y, k) => { g.fillStyle = COL[k]; g.fillRect(x * c + 1, y * c + 1, c - 2, c - 2); };
    this.grid.forEach((r, y) => r.forEach((k, x) => k && cell(x, y, k))); this.p.m.forEach((r, y) => r.forEach((v, x) => v && cell(this.p.x + x, this.p.y + y, this.p.k)));
    g.fillStyle = '#d8dee9'; g.font = '12px sans-serif'; g.fillText(`Score`, this.W * c + 8, 20); g.fillText(String(this.score), this.W * c + 8, 36); g.fillText(`Lines ${this.lines}`, this.W * c + 8, 58); g.fillText('Next', this.W * c + 8, 90);
    SHAPES[this.next].forEach((r, y) => r.forEach((v, x) => v && (g.fillStyle = COL[this.next], g.fillRect(this.W * c + 8 + x * 12, 98 + y * 12, 11, 11))));
  }
}
