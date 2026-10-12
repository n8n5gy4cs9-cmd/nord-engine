// @nord {"id":"gameplay.key-door","title":"Keys, doors, switches","category":"gameplay","tier":["2d","3d"],"tags":["door","key","switch","puzzle"],"requires":["trigger"],"description":"A lock: opens (disables itself and its 'blockers', emits 'open' on the entity) when the toucher's inventory has the key item, or when a linked switch entity fires 'toggle'. Also usable as a pressure plate/lever via mode 'switch'."}
import { NordScript } from 'nord';

export default class KeyDoor extends NordScript {
  static attributes = { mode: { type: 'enum', options: ['door', 'switch'], default: 'door' }, key: { type: 'string', default: 'key', label: 'Key item id (door)' }, consume: { type: 'bool', default: true }, links: { type: 'array', default: [], label: 'Entity names to toggle (switch)' }, tag: { type: 'string', default: 'player' }, sticky: { type: 'bool', default: false }, blockers: { type: 'array', default: [], label: 'Entity names disabled when opened (e.g. the solid door wall)' } };
  start() { this.on = false; this.entity.on('toggle', () => this.attrs.mode === 'door' && this.open()); }
  onTriggerEnter(o) {
    if (!o.hasTag(this.attrs.tag)) return;
    if (this.attrs.mode === 'door') { const inv = o.scripts.find((s) => s.has && s.remove); if (this.attrs.key === '' || (inv?.has(this.attrs.key) && (!this.attrs.consume || inv.remove(this.attrs.key)))) this.open(); else this.events.emit('door:locked', this.entity); }
    else this.#flip(true);
  }
  onTriggerExit(o) { if (this.attrs.mode === 'switch' && !this.attrs.sticky && o.hasTag(this.attrs.tag)) this.#flip(false); }
  #flip(on) { this.on = on; for (const n of this.attrs.links) this.scene.find(n)?.emit('toggle', on); this.entity.emit('switch', on); this.events.emit('switch', { entity: this.entity, on }); }
  open() { if (this.opened) return; this.opened = true; this.entity.emit('open'); this.events.emit('door:open', this.entity); for (const n of this.attrs.blockers) { const b = this.scene.find(n); if (b) b.enabled = false; } this.entity.enabled = false; }
}
