import { NordScript } from 'nord';

const COL = { 0: '#3b4252', 2: '#e5e9f0', 4: '#ebcb8b', 8: '#d08770', 16: '#bf616a', 32: '#b48ead', 64: '#88c0d0', 128: '#81a1c1', 256: '#a3be8c', 512: '#8fbcbb', 1024: '#5e81ac', 2048: '#ebcb8b' };
export default class Game2048 extends NordScript {
  static attributes = { size: { type: 'int', default: 4, min: 3, max: 6 } };
  start() {
    const n = this.attrs.size; this.g = Array.from({ length: n }, () => Array(n).fill(0)); this.score = 0; this.best = this.save.get('2048.best', 0); this.over = false;
    const d = this.ui.doc; this.root = d.createElement('div'); this.root.style.cssText = 'position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);text-align:center;pointer-events:auto';
    this.info = d.createElement('div'); this.info.style.cssText = 'font-size:20px;margin-bottom:8px'; this.board = d.createElement('div'); this.board.style.cssText = `display:grid;grid-template-columns:repeat(${n},64px);gap:6px;background:#2b303b;padding:6px;border-radius:8px`;
    this.root.append(this.info, this.board); this.ui.screen('hud').append(this.root); this.add(); this.add(); this.draw();
  }
  onDestroy() { this.root?.remove(); }
  add() { const e = []; this.g.forEach((r, y) => r.forEach((v, x) => !v && e.push([x, y]))); if (!e.length) return; const [x, y] = this.rng.pick(e); this.g[y][x] = this.rng.chance(0.9) ? 2 : 4; }
  slide(row) { const a = row.filter(Boolean), out = []; for (let i = 0; i < a.length; i++) { if (a[i] === a[i + 1]) { out.push(a[i] * 2); this.score += a[i] * 2; i++; } else out.push(a[i]); } while (out.length < row.length) out.push(0); return out; }
  move(dir) {
    const before = JSON.stringify(this.g), n = this.attrs.size, g = this.g;
    for (let i = 0; i < n; i++) {
      const line = dir === 'left' ? g[i] : dir === 'right' ? [...g[i]].reverse() : dir === 'up' ? g.map((r) => r[i]) : g.map((r) => r[i]).reverse(), res = this.slide(line);
      if (dir === 'left') g[i] = res; else if (dir === 'right') g[i] = res.reverse(); else { const col = dir === 'up' ? res : res.reverse(); col.forEach((v, y) => { g[y][i] = v; }); }
    }
    if (JSON.stringify(this.g) === before) return; this.events.emit('sfx', 'jump'); this.add(); this.best = Math.max(this.best, this.score); this.save.set('2048.best', this.best);
    const can = this.g.some((r, y) => r.some((v, x) => !v || v === r[x + 1] || v === this.g[y + 1]?.[x])); if (!can) { this.over = true; this.events.emit('game:over'); } this.draw();
  }
  update() { for (const d of ['left', 'right', 'up', 'down']) if (this.input.pressed(d)) this.move(d); if (this.over && this.input.pressed('fire')) this.game.restart(); }
  draw() {
    this.info.textContent = `Score ${this.score}   Best ${this.best}${this.over ? '   — Game over (Space = restart)' : ''}`; this.board.replaceChildren();
    for (const r of this.g) for (const v of r) { const c = this.ui.doc.createElement('div'); c.textContent = v || ''; c.style.cssText = `width:64px;height:64px;border-radius:6px;display:flex;align-items:center;justify-content:center;font:700 ${v > 100 ? 20 : 26}px sans-serif;background:${COL[v] ?? '#ebcb8b'};color:${v > 4 ? '#fff' : '#2e3440'}`; this.board.append(c); }
  }
}
