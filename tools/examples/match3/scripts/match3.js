import { NordScript } from 'nord';

const COLORS = ['#bf616a', '#a3be8c', '#88c0d0', '#ebcb8b', '#b48ead', '#d08770'];
/** Cells (as "x,y") that belong to a horizontal/vertical run of 3+. */
export function findMatches(g) {
  const hit = new Set(), n = g.length;
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    const v = g[y][x]; if (v < 0) continue;
    if (x < n - 2 && g[y][x + 1] === v && g[y][x + 2] === v) [0, 1, 2].forEach((i) => hit.add(`${x + i},${y}`));
    if (y < n - 2 && g[y + 1][x] === v && g[y + 2][x] === v) [0, 1, 2].forEach((i) => hit.add(`${x},${y + i}`));
  }
  return hit;
}
export default class Match3 extends NordScript {
  static attributes = { size: { type: 'int', default: 8, min: 5 }, moves: { type: 'int', default: 25 }, cell: { type: 'int', default: 40 } };
  start() {
    const n = this.attrs.size; this.moves = this.attrs.moves; this.score = 0; this.sel = null; this.busy = false; this.best = this.save.get('match3.best', 0);
    do { this.g = Array.from({ length: n }, () => Array.from({ length: n }, () => this.rng.int(0, COLORS.length - 1))); } while (findMatches(this.g).size);
    const d = this.ui.doc; this.root = d.createElement('div'); this.root.style.cssText = 'position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);text-align:center;pointer-events:auto';
    this.info = d.createElement('div'); this.info.style.cssText = 'font-size:18px;margin-bottom:6px'; this.board = d.createElement('div'); this.board.style.cssText = `display:grid;grid-template-columns:repeat(${n},${this.attrs.cell}px);gap:2px`;
    this.root.append(this.info, this.board); this.ui.screen('hud').append(this.root); this.draw();
  }
  onDestroy() { this.root?.remove(); }
  async swap(a, b) {
    const g = this.g, t = g[a[1]][a[0]]; g[a[1]][a[0]] = g[b[1]][b[0]]; g[b[1]][b[0]] = t; this.busy = true; this.draw();
    if (!findMatches(g).size) { await this.wait(0.2); g[b[1]][b[0]] = g[a[1]][a[0]]; g[a[1]][a[0]] = t; this.busy = false; this.draw(); return; }
    this.moves--; let combo = 0;
    for (let m = findMatches(g); m.size; m = findMatches(g)) {
      combo++; for (const k of m) { const [x, y] = k.split(',').map(Number); g[y][x] = -1; } this.score += m.size * 10 * combo; this.events.emit('sfx', 'coin'); this.draw(); await this.wait(0.25);
      for (let x = 0; x < g.length; x++) { const col = g.map((r) => r[x]).filter((v) => v >= 0); while (col.length < g.length) col.unshift(this.rng.int(0, COLORS.length - 1)); col.forEach((v, y) => { g[y][x] = v; }); }
      this.draw(); await this.wait(0.2);
    }
    if (this.score > this.best) { this.best = this.score; this.save.set('match3.best', this.best); }
    this.busy = false; if (this.moves <= 0) this.events.emit('toast', `Out of moves! Score ${this.score}`); this.draw();
  }
  wait(s) { return new Promise((ok) => this.after(s, ok)); }
  click(x, y) {
    if (this.busy || this.moves <= 0) return;
    if (!this.sel) { this.sel = [x, y]; this.draw(); return; }
    const [sx, sy] = this.sel; this.sel = null;
    if (Math.abs(sx - x) + Math.abs(sy - y) === 1) this.swap([sx, sy], [x, y]); else this.draw();
  }
  draw() {
    this.info.textContent = this.moves > 0 ? `Score ${this.score}   Moves ${this.moves}   Best ${this.best}` : `Game over — ${this.score} points (Space = restart)`; this.board.replaceChildren();
    this.g.forEach((r, y) => r.forEach((v, x) => { const b = this.ui.doc.createElement('button'); const s = this.attrs.cell; b.style.cssText = `width:${s}px;height:${s}px;border:0;border-radius:${v >= 0 ? 10 : 0}px;background:${v >= 0 ? COLORS[v] : 'transparent'};outline:${this.sel && this.sel[0] === x && this.sel[1] === y ? '3px solid #fff' : 'none'};cursor:pointer`; b.onclick = () => this.click(x, y); this.board.append(b); }));
  }
  update() { if (this.moves <= 0 && this.input.pressed('fire')) this.game.restart(); }
}
