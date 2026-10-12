// @nord {"id":"ui.damage-numbers","title":"Floating damage numbers","category":"ui","tier":["2d"],"tags":["damage","numbers","juice"],"requires":["ui"],"description":"Listens for 'damage' events on any entity with this tag and floats the amount upward (world → screen via the DOM overlay scaled to the 640×360-style view). Emit the global 'popup' {x,y,text,color} for custom numbers."}
import { NordScript } from 'nord';

export default class DamageNumbers extends NordScript {
  static attributes = { tag: { type: 'string', default: 'enemy' }, view: { type: 'vec2', default: [640, 360], label: 'Game view size (px)' }, camera: { type: 'vec2', default: [0, 0], label: 'World pos at view top-left' }, color: { type: 'color', default: '#ebcb8b' } };
  start() { this.offs = [this.events.on('popup', (p) => this.pop(p.x, p.y, p.text, p.color))]; this.hooked = new Set(); }
  onDestroy() { this.offs.forEach((o) => o()); }
  update() { for (const e of this.scene.findByTag(this.attrs.tag)) if (!this.hooked.has(e)) { this.hooked.add(e); e.on('damage', (d) => this.pop(e.pos[0], e.pos[1] - 12, String(d.amount ?? 1), this.attrs.color)); } }
  pop(x, y, text, color = this.attrs.color) {
    const [vw, vh] = this.attrs.view, [cx, cy] = this.attrs.camera, l = this.ui.label(text, { screen: 'hud', x: 0, y: 0, size: 22, color }), el = l.el;
    el.style.left = `${((x - cx) / vw) * 100}%`; el.style.top = `${((y - cy) / vh) * 100}%`; el.style.transition = 'transform .7s ease-out, opacity .7s'; requestAnimationFrame(() => { el.style.transform = 'translateY(-36px)'; el.style.opacity = 0; }); this.after(0.8, () => l.remove());
  }
}
