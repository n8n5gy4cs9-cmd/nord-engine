// @nord {"id":"procedural.minimap","title":"Minimap","category":"procedural","tier":["2d"],"tags":["minimap","hud","radar"],"requires":["ui"],"description":"Corner radar: draws dots for entities with tags (player, enemy, pickup…) scaled from world to a small DOM canvas, centred on this entity."}
import { NordScript } from 'nord';

export default class Minimap extends NordScript {
  static attributes = { size: { type: 'int', default: 140 }, range: { type: 'number', default: 400, label: 'World units shown (radius)' }, anchor: { type: 'enum', options: ['tl', 'tr', 'bl', 'br'], default: 'tr' }, tags: { type: 'array', default: ['enemy', 'pickup', 'coin'] }, colors: { type: 'array', default: ['#bf616a', '#ebcb8b', '#ebcb8b'] }, three: { type: 'bool', default: false, label: '3D: use x/z' } };
  start() {
    const s = this.attrs.size; this.panel = this.ui.panel({ screen: 'hud', anchor: this.attrs.anchor, x: 12, y: 12, w: s + 2, h: s + 2, style: { padding: '0', borderRadius: '50%', overflow: 'hidden' } });
    this.cv = this.ui.doc.createElement('canvas'); this.cv.width = this.cv.height = s; this.panel.el.appendChild(this.cv); this.c = this.cv.getContext('2d');
  }
  onDestroy() { this.panel?.remove(); }
  update() {
    const a = this.attrs, s = a.size, c = this.c, k = s / 2 / a.range, [px, py, pz] = this.entity.pos; c.clearRect(0, 0, s, s);
    const dot = (e, col, r) => { const x = s / 2 + (e.pos[0] - px) * k, y = s / 2 + ((a.three ? e.pos[2] - pz : e.pos[1] - py)) * k * (a.three ? -1 : 1); c.fillStyle = col; c.beginPath(); c.arc(x, y, r, 0, 6.3); c.fill(); };
    a.tags.forEach((tag, i) => { for (const e of this.scene.findByTag(tag)) dot(e, a.colors[i] ?? '#fff', 2.5); });
    c.fillStyle = '#a3be8c'; c.beginPath(); c.arc(s / 2, s / 2, 3.5, 0, 6.3); c.fill();
  }
}
