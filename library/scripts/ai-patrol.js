// @nord {"id":"ai.patrol","title":"Enemy AI: patrol","category":"ai","tier":["2d"],"tags":["enemy","patrol","platformer"],"requires":["rigidbody"],"description":"Walks back and forth over a distance, turning at walls/ledge ends (checks ground ahead with overlapBox) and pauses at the ends."}
import { NordScript } from 'nord';

export default class Patrol extends NordScript {
  static attributes = { speed: { type: 'number', default: 50 }, distance: { type: 'number', default: 96 }, pause: { type: 'number', default: 0.5 }, ledgeCheck: { type: 'bool', default: true } };
  start() { this.x0 = this.entity.pos[0]; this.dir = 1; this.wait = 0; this.sprite = this.entity.getComponent('animatedSprite') ?? this.entity.getComponent('sprite'); }
  fixedUpdate(dt) {
    if (this.entity.stunned) return;
    if (this.wait > 0) { this.wait -= dt; this.physics.setVelocity(this.entity, 0, null); return; }
    const x = this.entity.pos[0], far = Math.abs(x - this.x0) > this.attrs.distance / 2 && Math.sign(x - this.x0) === this.dir;
    const ahead = this.attrs.ledgeCheck && this.physics.isGrounded(this.entity) && !(this.physics.overlapBox?.(x + this.dir * 14, this.entity.pos[1] + 14, 4, 6)?.length ?? 1);
    if (far || ahead) { this.dir = -this.dir; this.wait = this.attrs.pause; return; }
    this.sprite?.setFlip?.(this.dir < 0);
    this.physics.setVelocity(this.entity, this.dir * this.attrs.speed * (this.entity.speedMul ?? 1), null);
  }
  onCollisionEnter(o) { if (!o.hasTag('player') && Math.abs(o.pos[1] - this.entity.pos[1]) < 12) this.dir = -this.dir; }
}
