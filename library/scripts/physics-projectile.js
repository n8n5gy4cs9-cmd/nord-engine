// @nord {"id":"physics.projectile","title":"Projectile (ballistic / homing)","category":"physics","tier":["2d"],"tags":["bullet","homing","projectile"],"description":"Put on a bullet prefab: flies along its rotation (z) at a speed, optionally curving toward the nearest entity with a target tag, dies after a lifetime or on hit and emits 'hit'."}
import { NordScript } from 'nord';

export default class Projectile extends NordScript {
  static attributes = { speed: { type: 'number', default: 360 }, life: { type: 'number', default: 2 }, gravity: { type: 'number', default: 0 }, homingTag: { type: 'string', default: '' }, turnRate: { type: 'number', default: 200, label: 'Homing deg/s' }, damage: { type: 'number', default: 1 }, destroyOnHit: { type: 'bool', default: true } };
  start() { const a = (this.entity.rot[2] * Math.PI) / 180; this.v = [Math.cos(a) * this.attrs.speed, Math.sin(a) * this.attrs.speed]; this.age = 0; }
  update(dt) {
    const a = this.attrs, e = this.entity; this.age += dt;
    if (this.age > a.life) return e.destroy();
    if (a.homingTag) {
      let best = null, bd = 1e9;
      for (const t of this.scene.findByTag(a.homingTag)) { const d = Math.hypot(t.pos[0] - e.pos[0], t.pos[1] - e.pos[1]); if (d < bd) { bd = d; best = t; } }
      if (best) {
        const want = Math.atan2(best.pos[1] - e.pos[1], best.pos[0] - e.pos[0]), cur = Math.atan2(this.v[1], this.v[0]);
        let d = ((want - cur + Math.PI * 3) % (Math.PI * 2)) - Math.PI; const m = (a.turnRate * Math.PI / 180) * dt; d = Math.max(-m, Math.min(m, d));
        this.v = [Math.cos(cur + d) * a.speed, Math.sin(cur + d) * a.speed];
      }
    }
    this.v[1] += a.gravity * dt;
    e.pos = [e.pos[0] + this.v[0] * dt, e.pos[1] + this.v[1] * dt, e.pos[2]];
    e.rot = [0, 0, (Math.atan2(this.v[1], this.v[0]) * 180) / Math.PI];
  }
  onTriggerEnter(o) { this.#hit(o); } onCollisionEnter(o) { this.#hit(o); }
  #hit(o) { if (o.hasTag('projectile')) return; o.emit('damage', { amount: this.attrs.damage, from: this.entity }); this.events.emit('hit', this.attrs.damage); if (this.attrs.destroyOnHit) this.entity.destroy(); }
}
