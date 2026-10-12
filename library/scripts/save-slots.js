// @nord {"id":"gameplay.save-slots","title":"Save / load slots","category":"gameplay","tier":["2d","3d"],"tags":["save","load","slots","game-ready"],"description":"Saves the position and custom data of tagged entities into numbered slots and restores them. Events: 'game:save' (slot), 'game:load' (slot). Uses save.slot(n) (localStorage)."}
import { NordScript } from 'nord';

export default class SaveSlots extends NordScript {
  static attributes = { tag: { type: 'string', default: 'persist', label: 'Entities with this tag are saved' }, slot: { type: 'int', default: 1, min: 1 } };
  start() { this.offs = [this.events.on('game:save', (s) => this.write(s ?? this.attrs.slot)), this.events.on('game:load', (s) => this.read(s ?? this.attrs.slot))]; }
  onDestroy() { this.offs.forEach((o) => o()); }
  write(slot) {
    const data = { t: Date.now(), scene: this.scene.name, entities: Object.fromEntries(this.scene.findByTag(this.attrs.tag).map((e) => [e.name, { pos: e.pos, extra: e.saveData?.() ?? null }])) };
    this.save.slot(slot).set('game', data); this.events.emit('game:saved', slot);
  }
  read(slot) {
    const d = this.save.slot(slot).get('game'); if (!d) return false;
    for (const [n, s] of Object.entries(d.entities)) { const e = this.scene.find(n); if (e) { e.pos = s.pos; if (s.extra) e.loadData?.(s.extra); } }
    this.events.emit('game:loaded', slot); return true;
  }
  info(slot) { const d = this.save.slot(slot).get('game'); return d ? { t: d.t, scene: d.scene } : null; }
}
