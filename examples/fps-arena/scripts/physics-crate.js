// @nord {"id":"physics.destructible","title":"Destructible crate","category":"physics","tier":["2d"],"tags":["destructible","health","debris"],"description":"Has hit points; takes 'damage' events and strong collisions, then breaks into debris prefabs and optionally drops loot. Emits 'destroyed'."}
import { NordScript } from 'nord';

export default class Destructible extends NordScript {
  static attributes = { hp: { type: 'number', default: 3, min: 1 }, debris: { type: 'asset', assetType: 'prefab', default: '' }, pieces: { type: 'int', default: 4, min: 0 }, drop: { type: 'asset', assetType: 'prefab', default: '' }, dropChance: { type: 'number', default: 0.5, min: 0, max: 1 } };
  start() { this.hp = this.attrs.hp; this.entity.on('damage', (d) => this.hit(d.amount ?? 1)); }
  hit(n) {
    this.hp -= n; this.game.camera?.shake?.(80, 0.003);
    if (this.hp > 0) return;
    const [x, y, z] = this.entity.pos;
    if (this.attrs.debris) for (let i = 0; i < this.attrs.pieces; i++) this.scene.spawn(this.attrs.debris, { pos: [x, y, z] }).then((d) => { this.physics.setVelocity(d, (this.rng.next() - 0.5) * 300, -this.rng.next() * 250); this.after(1.5, () => d.destroyed || d.destroy()); });
    if (this.attrs.drop && this.rng.chance(this.attrs.dropChance)) this.scene.spawn(this.attrs.drop, { pos: [x, y, z] });
    this.events.emit('destroyed', this.entity); this.entity.destroy();
  }
}
