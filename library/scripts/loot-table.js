// @nord {"id":"gameplay.loot-table","title":"Loot tables","category":"gameplay","tier":["2d","3d"],"tags":["loot","drops","random"],"description":"Weighted drops: on the entity's 'death' event (or drop()), spawn prefabs chosen from a table [{prefab, weight, min?, max?}] with an overall drop chance."}
import { NordScript } from 'nord';

export default class LootTable extends NordScript {
  static attributes = { table: { type: 'array', default: [], label: '[{prefab,weight,min,max}]' }, chance: { type: 'number', default: 1, min: 0, max: 1 }, rolls: { type: 'int', default: 1, min: 1 }, onDeath: { type: 'bool', default: true }, scatter: { type: 'number', default: 20 } };
  start() { if (this.attrs.onDeath) this.entity.on('death', () => this.drop()); }
  drop() {
    if (!this.rng.chance(this.attrs.chance)) return;
    const total = this.attrs.table.reduce((a, t) => a + (t.weight ?? 1), 0), [x, y, z] = this.entity.worldPos;
    for (let r = 0; r < this.attrs.rolls; r++) {
      let w = this.rng.next() * total; const e = this.attrs.table.find((t) => (w -= t.weight ?? 1) < 0) ?? this.attrs.table.at(-1); if (!e) return;
      const n = this.rng.int(e.min ?? 1, e.max ?? 1);
      for (let i = 0; i < n; i++) this.scene.spawn(e.prefab, { pos: [x + (this.rng.next() - 0.5) * this.attrs.scatter, y + (this.rng.next() - 0.5) * this.attrs.scatter, z] });
    }
  }
}
