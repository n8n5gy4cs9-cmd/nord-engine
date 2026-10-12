// @nord {"id":"physics.one-way","title":"One-way platform","category":"physics","tier":["2d"],"tags":["platform","jump-through"],"requires":["collider"],"description":"Put on a platform entity: its collider only blocks things moving downward from above. Hold 'down' + 'jump' on the platform to drop through (body tagged 'player')."}
import { NordScript } from 'nord';

export default class OneWay extends NordScript {
  static attributes = { playerTag: { type: 'string', default: 'player' }, dropTime: { type: 'number', default: 0.25 } };
  start() { this.drop = 0; }
  fixedUpdate(dt) {
    const top = this.entity.pos[1] - (this.entity.getComponent('collider')?.data.size?.[1] ?? 8) / 2;
    this.drop -= dt;
    for (const b of this.scene.findByTag(this.attrs.playerTag)) {
      const [, vy] = this.physics.velocity(b);
      const bottom = b.pos[1] + (b.getComponent('collider')?.data.size?.[1] ?? 16) / 2;
      if (this.input.down('down') && this.input.pressed('jump')) this.drop = this.attrs.dropTime;
      const pass = vy < 0 || bottom > top + 6 || this.drop > 0;
      this.physics.enable(this.entity, !pass);
    }
  }
}
