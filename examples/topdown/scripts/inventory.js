// @nord {"id":"gameplay.inventory","title":"Inventory (stacks + equip)","category":"gameplay","tier":["2d","3d"],"tags":["inventory","items","equip","game-ready"],"description":"Slot-based inventory with stacking, add/remove/has/count, equip slots and save/load. Items are {id, name, max?, slot?}. Emits 'inventory' {items} on the global bus. Other scripts call entity.getScript(Inventory)."}
import { NordScript } from 'nord';

export default class Inventory extends NordScript {
  static attributes = { slots: { type: 'int', default: 20, min: 1 }, saveKey: { type: 'string', default: '', label: 'Persist under this save key (empty = no)' } };
  start() {
    this.items = Array(this.attrs.slots).fill(null); this.equipped = {};
    if (this.attrs.saveKey) { const s = this.save.get(this.attrs.saveKey); if (s) { this.items = s.items; this.equipped = s.equipped; } }
  }
  /** Add `n` of `item`; returns how many did NOT fit. */
  add(item, n = 1) {
    const max = item.max ?? 99;
    for (const s of this.items) if (s && s.id === item.id && s.n < max && n > 0) { const t = Math.min(n, max - s.n); s.n += t; n -= t; }
    for (let i = 0; i < this.items.length && n > 0; i++) if (!this.items[i]) { const t = Math.min(n, max); this.items[i] = { ...item, n: t }; n -= t; }
    this.#changed(); return n;
  }
  count(id) { return this.items.reduce((a, s) => a + (s?.id === id ? s.n : 0), 0); }
  has(id, n = 1) { return this.count(id) >= n; }
  remove(id, n = 1) {
    if (!this.has(id, n)) return false;
    for (const [i, s] of this.items.entries()) if (s?.id === id && n > 0) { const t = Math.min(n, s.n); s.n -= t; n -= t; if (!s.n) this.items[i] = null; }
    this.#changed(); return true;
  }
  equip(index) {
    const s = this.items[index]; if (!s?.slot) return false;
    const prev = this.equipped[s.slot]; this.equipped[s.slot] = s; this.items[index] = prev ?? null;
    this.#changed(); this.entity.emit('equip', s); return true;
  }
  #changed() {
    if (this.attrs.saveKey) this.save.set(this.attrs.saveKey, { items: this.items, equipped: this.equipped });
    this.events.emit('inventory', { items: this.items, equipped: this.equipped });
  }
}
