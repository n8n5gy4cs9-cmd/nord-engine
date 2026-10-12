// @nord {"id":"gameplay.status-effects","title":"Status effects","category":"gameplay","tier":["2d","3d"],"tags":["buff","debuff","poison","slow"],"description":"Timed effects on an entity: poison/burn (damage over time), regen, slow, haste, stun. Entity events: apply {type,duration,power}. Reads entity.speedMul / entity.stunned for controllers; DoT is delivered as 'damage' events."}
import { NordScript } from 'nord';

export default class StatusEffects extends NordScript {
  static attributes = { tick: { type: 'number', default: 1, min: 0.1, label: 'DoT tick (s)' } };
  start() { this.fx = []; this.entity.speedMul = 1; this.entity.stunned = false; this.entity.on('apply', (e) => this.apply(e.type, e.duration, e.power)); }
  apply(type, duration = 3, power = 1) { const f = this.fx.find((x) => x.type === type); if (f) f.left = Math.max(f.left, duration); else this.fx.push({ type, left: duration, power, t: 0 }); this.entity.emit('status', { type, on: true }); }
  has(type) { return this.fx.some((f) => f.type === type); }
  update(dt) {
    for (const f of this.fx) {
      f.left -= dt; f.t += dt;
      if (f.t >= this.attrs.tick) { f.t -= this.attrs.tick; if (f.type === 'poison' || f.type === 'burn') this.entity.emit('damage', { amount: f.power }); if (f.type === 'regen') this.entity.emit('heal', { amount: f.power }); }
    }
    for (const f of this.fx.filter((x) => x.left <= 0)) this.entity.emit('status', { type: f.type, on: false });
    this.fx = this.fx.filter((f) => f.left > 0);
    this.entity.speedMul = this.fx.reduce((m, f) => (f.type === 'slow' ? m * 0.5 : f.type === 'haste' ? m * 1.5 : m), 1);
    this.entity.stunned = this.has('stun');
  }
}
