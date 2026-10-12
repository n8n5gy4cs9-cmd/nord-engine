import { NordScript } from 'nord';

const GEN = [{ id: 'cursor', name: 'Auto-clicker', base: 15, rate: 0.5 }, { id: 'farm', name: 'Farm', base: 100, rate: 4 }, { id: 'mine', name: 'Mine', base: 1100, rate: 28 }, { id: 'lab', name: 'Lab', base: 12000, rate: 160 }];
const fmt = (n) => (n >= 1e6 ? `${(n / 1e6).toFixed(2)}M` : n >= 1e3 ? `${(n / 1e3).toFixed(1)}k` : n.toFixed(n < 10 ? 1 : 0));
export default class Idle extends NordScript {
  static attributes = { growth: { type: 'number', default: 1.15, min: 1.01 }, offlineCap: { type: 'number', default: 8 * 3600 } };
  start() {
    const s = this.save.get('idle', { coins: 0, owned: {}, t: Date.now() }); this.s = s;
    const rate = this.rate(), away = Math.min(this.attrs.offlineCap, (Date.now() - s.t) / 1000); if (rate > 0 && away > 5) { s.coins += rate * away; this.note = `Welcome back! +${fmt(rate * away)} while away`; }
    const d = this.ui.doc; this.root = d.createElement('div'); this.root.style.cssText = 'position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);text-align:center;pointer-events:auto;min-width:300px';
    this.top = d.createElement('div'); this.top.style.cssText = 'font-size:26px;margin-bottom:8px'; this.btn = d.createElement('button'); this.btn.className = 'nord-button'; this.btn.textContent = 'Click! (+1)'; this.btn.style.cssText = 'font-size:22px;padding:14px 30px;margin-bottom:10px'; this.btn.onclick = () => { this.s.coins++; this.events.emit('sfx', 'coin'); };
    this.list = d.createElement('div'); this.root.append(this.top, this.btn, this.list); this.ui.screen('hud').append(this.root); this.save_t = 0; this.draw();
  }
  onDestroy() { this.persist(); this.root?.remove(); }
  cost(g) { return Math.ceil(g.base * this.attrs.growth ** (this.s.owned[g.id] ?? 0)); }
  rate() { return GEN.reduce((a, g) => a + (this.s?.owned[g.id] ?? 0) * g.rate, 0); }
  persist() { this.s.t = Date.now(); this.save.set('idle', this.s); }
  update(dt) {
    this.s.coins += this.rate() * dt; if ((this.save_t += dt) > 5) { this.save_t = 0; this.persist(); }
    this.top.textContent = `${fmt(this.s.coins)} coins  (${fmt(this.rate())}/s)`; this.list.querySelectorAll('button').forEach((b, i) => { b.disabled = this.s.coins < this.cost(GEN[i]); });
  }
  draw() {
    this.list.replaceChildren(...GEN.map((g) => { const b = this.ui.doc.createElement('button'); b.className = 'nord-button'; b.style.cssText = 'display:block;width:100%;margin-top:6px'; b.textContent = `${g.name} (${this.s.owned[g.id] ?? 0}) — ${fmt(this.cost(g))}`; b.onclick = () => { const c = this.cost(g); if (this.s.coins >= c) { this.s.coins -= c; this.s.owned[g.id] = (this.s.owned[g.id] ?? 0) + 1; this.events.emit('sfx', 'powerup'); this.draw(); } }; return b; }));
    if (this.note) { this.events.emit('toast', this.note); this.note = null; }
  }
}
