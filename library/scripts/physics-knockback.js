// @nord {"id":"physics.knockback","title":"Knockback receiver","category":"physics","tier":["2d"],"tags":["knockback","hit","combat"],"requires":["rigidbody"],"description":"Listens for 'damage' events carrying a source and shoves the entity away from it for a short stun, during which controllers should check entity.stunned."}
import { NordScript } from 'nord';

export default class Knockback extends NordScript {
  static attributes = { force: { type: 'vec2', default: [220, -160] }, stun: { type: 'number', default: 0.25 } };
  start() { this.entity.stunned = false; this.entity.on('damage', (d) => this.push(d.from)); this.entity.on('knockback', (d) => this.push(d.from)); }
  push(from) {
    if (!from) return;
    const s = Math.sign(this.entity.pos[0] - from.pos[0]) || 1;
    this.physics.setVelocity(this.entity, this.attrs.force[0] * s, this.attrs.force[1]);
    this.entity.stunned = true; this.after(this.attrs.stun, () => { this.entity.stunned = false; });
  }
}
