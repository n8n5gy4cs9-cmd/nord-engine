// @nord {"id":"ai.chase","title":"Enemy AI: chase","category":"ai","tier":["2d","3d"],"tags":["enemy","chase","follow"],"description":"Chases the nearest tagged target when it is within sight range, gives up beyond lose range, optionally keeps distance (kiting). Contact damage via the target's 'damage' event."}
import { NordScript } from 'nord';

export default class Chase extends NordScript {
  static attributes = { target: { type: 'string', default: 'player', label: 'Target tag' }, speed: { type: 'number', default: 80 }, sight: { type: 'number', default: 220 }, lose: { type: 'number', default: 320 }, keepDistance: { type: 'number', default: 0 }, contactDamage: { type: 'number', default: 1 }, contactCooldown: { type: 'number', default: 0.8 } };
  start() { this.t = null; this.cd = 0; this.three = this.game.project.type === '3d'; }
  fixedUpdate(dt) {
    const a = this.attrs, e = this.entity; this.cd -= dt;
    if (e.stunned) return;
    if (!this.t || this.t.destroyed) this.t = this.scene.findByTag(a.target)[0] ?? null;
    if (!this.t) return;
    const dx = this.t.pos[0] - e.pos[0], dz = this.three ? this.t.pos[2] - e.pos[2] : this.t.pos[1] - e.pos[1], d = Math.hypot(dx, dz);
    this.alert = d < (this.alert ? a.lose : a.sight);
    let k = 0; if (this.alert) k = d > a.keepDistance ? 1 : a.keepDistance && d < a.keepDistance * 0.8 ? -1 : 0;
    const s = a.speed * (e.speedMul ?? 1) * k / (d || 1);
    if (this.three) this.physics.setVelocity(e, dx * s, null, dz * s); else this.physics.setVelocity(e, dx * s, dz * s);
  }
  onCollisionEnter(o) { this.#touch(o); } onTriggerEnter(o) { this.#touch(o); }
  #touch(o) { if (o.hasTag(this.attrs.target) && this.cd <= 0) { this.cd = this.attrs.contactCooldown; o.emit('damage', { amount: this.attrs.contactDamage, from: this.entity }); } }
}
