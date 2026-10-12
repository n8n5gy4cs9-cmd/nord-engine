// @nord {"id":"ui.inventory","title":"Inventory grid UI","category":"ui","tier":["2d","3d"],"tags":["inventory","grid","tooltip"],"requires":["ui","gameplay.inventory"],"description":"Toggleable grid (action 'inventory', default key I via your input map) showing the Inventory script's slots with counts and a hover tooltip; click an item to equip it."}
import { NordScript } from 'nord';

export default class InventoryUI extends NordScript {
  static attributes = { source: { type: 'string', default: 'Player', label: 'Entity with the Inventory script' }, columns: { type: 'int', default: 5, min: 1 }, cell: { type: 'int', default: 48 } };
  start() { this.open = false; this.off = this.events.on('inventory', () => this.open && this.#draw()); }
  onDestroy() { this.off?.(); this.ui.clear('inventory'); }
  get inv() { return this.scene.find(this.attrs.source)?.scripts.find((s) => s.items && s.equip); }
  update() { if (this.input.pressed('inventory')) { this.open = !this.open; this.open ? (this.ui.show('inventory'), this.#draw()) : this.ui.hide('inventory'); } }
  #draw() {
    const inv = this.inv, ui = this.ui, d = ui.doc, a = this.attrs; if (!inv) return; ui.clear('inventory');
    const p = ui.panel({ screen: 'inventory', x: 0, y: 0, style: { left: '50%', top: '50%', transform: 'translate(-50%,-50%)' } }), g = d.createElement('div');
    g.style.cssText = `display:grid;grid-template-columns:repeat(${a.columns},${a.cell}px);gap:4px`; p.el.append(g);
    const tip = d.createElement('div'); tip.style.cssText = 'margin-top:8px;min-height:20px;font-size:14px'; p.el.append(tip);
    inv.items.forEach((s, i) => {
      const c = d.createElement('div'); c.style.cssText = `width:${a.cell}px;height:${a.cell}px;border:1px solid var(--nord-border,#4c566a);border-radius:4px;display:flex;align-items:center;justify-content:center;position:relative;cursor:pointer;background:var(--nord-bg,#2e3440)`;
      if (s) { c.textContent = (s.icon ?? s.name?.[0] ?? '?'); const n = d.createElement('span'); n.textContent = s.n > 1 ? s.n : ''; n.style.cssText = 'position:absolute;right:3px;bottom:1px;font-size:12px'; c.append(n); c.onmouseenter = () => { tip.textContent = `${s.name ?? s.id}${s.slot ? ` (${s.slot})` : ''}`; }; c.onclick = () => inv.equip(i); }
      g.append(c);
    });
  }
}
