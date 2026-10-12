import { NordScript } from 'nord';

const FACES = ['★', '♥', '♣', '♦', '☀', '☾', '✿', '⚑'];
export default class Memory extends NordScript {
  static attributes = { pairs: { type: 'int', default: 8, min: 2, max: 8 } };
  start() {
    const d = this.ui.doc, cards = this.rng.shuffle([...FACES.slice(0, this.attrs.pairs), ...FACES.slice(0, this.attrs.pairs)].map((f, i) => ({ f, i })));
    this.cards = cards.map((c) => ({ ...c, up: false, done: false })); this.first = null; this.lock = false; this.moves = 0; this.found = 0;
    this.root = d.createElement('div'); this.root.style.cssText = 'position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);text-align:center;pointer-events:auto';
    this.info = d.createElement('div'); this.info.style.cssText = 'font-size:20px;margin-bottom:8px'; this.grid = d.createElement('div'); this.grid.style.cssText = 'display:grid;grid-template-columns:repeat(4,70px);gap:8px';
    this.root.append(this.info, this.grid); this.ui.screen('hud').append(this.root); this.best = this.save.get('memory.best', 0); this.draw();
  }
  onDestroy() { this.root?.remove(); }
  flip(c) {
    if (this.lock || c.up || c.done) return; c.up = true; this.events.emit('sfx', 'jump');
    if (!this.first) this.first = c; else {
      this.moves++; const a = this.first; this.first = null;
      if (a.f === c.f) { a.done = c.done = true; this.found++; this.events.emit('sfx', 'coin'); if (this.found === this.attrs.pairs) { if (!this.best || this.moves < this.best) this.save.set('memory.best', this.moves); this.events.emit('sfx', 'powerup'); } }
      else { this.lock = true; this.after(0.8, () => { a.up = c.up = false; this.lock = false; this.draw(); }); }
    }
    this.draw();
  }
  draw() {
    this.info.textContent = this.found === this.attrs.pairs ? `You win in ${this.moves} moves!` : `Moves ${this.moves}   Best ${this.best || '—'}`; this.grid.replaceChildren();
    for (const c of this.cards) { const b = this.ui.doc.createElement('button'); b.className = 'nord-button'; b.textContent = c.up || c.done ? c.f : '?'; b.style.cssText = `width:70px;height:90px;font-size:30px;opacity:${c.done ? 0.4 : 1};transition:transform .2s`; b.onclick = () => this.flip(c); this.grid.append(b); }
  }
}
