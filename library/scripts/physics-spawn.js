// @nord {"id":"physics.spawn-on-click","title":"Spawn bodies on click / key","category":"physics","tier":["2d","3d"],"tags":["spawn","sandbox","pool"],"description":"Spawns a prefab at the pointer (2D) or in front of the entity (3D) on the 'fire' action or pointer click, with an optional cap so old bodies are recycled."}
import { NordScript } from 'nord';

export default class SpawnOnClick extends NordScript {
  static attributes = { prefab: { type: 'asset', assetType: 'prefab', default: '' }, max: { type: 'int', default: 100, min: 1 }, velocity: { type: 'vec3', default: [0, 0, 0] }, jitter: { type: 'number', default: 0 } };
  start() { this.live = []; }
  update() {
    const p = this.input.pointer, hit = this.input.pressed('fire') || (p.down && !this.was);
    this.was = p.down;
    if (!hit || !this.attrs.prefab) return;
    const pos = this.game.project.type === '3d' ? [...this.entity.worldPos] : [p.worldX, p.worldY, 0];
    pos[0] += (this.rng.next() - 0.5) * this.attrs.jitter;
    this.scene.spawn(this.attrs.prefab, { pos }).then((b) => {
      const v = this.attrs.velocity; if (v.some(Boolean)) this.physics.setVelocity(b, ...v);
      this.live.push(b);
      while (this.live.length > this.attrs.max) this.live.shift().destroy();
    });
  }
}
