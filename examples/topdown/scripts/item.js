import { NordScript } from 'nord';

export default class Item extends NordScript {
  static attributes = { id: { type: 'string', default: 'item' }, name: { type: 'string', default: 'Item' }, icon: { type: 'string', default: '?' }, n: { type: 'int', default: 1 } };
  onTriggerEnter(o) {
    if (!o.hasTag('player')) return; const inv = o.scripts.find((s) => s.items && s.add);
    if (inv && inv.add({ id: this.attrs.id, name: this.attrs.name, icon: this.attrs.icon }, this.attrs.n) === 0) { this.events.emit('toast', `Picked up ${this.attrs.name}`); this.events.emit('sfx', 'powerup'); this.entity.destroy(); }
  }
}
