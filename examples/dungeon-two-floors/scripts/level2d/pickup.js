// @nord {"id":"gameplay.pickup","title":"Pickups & power-ups","category":"gameplay","tier":["2d","3d"],"tags":["coin","pickup","powerup","game-ready"],"requires":["trigger"],"description":"Put on collectible entities: when the player touches it, emits a global event (default 'score' + value), or applies a power-up (heal / speed / shield via entity events), plays a sound and disappears with a pop tween. Magnetises toward the player when close."}
import { NordScript } from 'nord';

export default class Pickup extends NordScript {
  static attributes = { kind: { type: 'enum', options: ['score', 'heal', 'speed', 'shield', 'xp', 'custom'], default: 'score' }, value: { type: 'number', default: 10 }, duration: { type: 'number', default: 5 }, event: { type: 'string', default: '', label: 'Custom global event' }, sfx: { type: 'asset', assetType: 'audio', default: '' }, tag: { type: 'string', default: 'player' }, magnet: { type: 'number', default: 0, label: 'Magnet radius' }, bob: { type: 'number', default: 3 } };
  start() { this.y0 = this.entity.pos[1]; this.t = this.rng.range(0, 6); this.taken = false; }
  update(dt) {
    const a = this.attrs, e = this.entity; this.t += dt;
    const p = a.magnet && this.scene.findByTag(a.tag)[0];
    if (p && Math.hypot(p.pos[0] - e.pos[0], p.pos[1] - e.pos[1]) < a.magnet) { const dx = p.pos[0] - e.pos[0], dy = p.pos[1] - e.pos[1], d = Math.hypot(dx, dy) || 1; e.pos = [e.pos[0] + (dx / d) * 220 * dt, e.pos[1] + (dy / d) * 220 * dt, e.pos[2]]; this.y0 = e.pos[1]; }
    else if (a.bob) e.pos = [e.pos[0], this.y0 + Math.sin(this.t * 4) * a.bob, e.pos[2]];
  }
  onTriggerEnter(o) {
    if (this.taken || !o.hasTag(this.attrs.tag)) return; this.taken = true; const a = this.attrs;
    if (a.kind === 'score') this.events.emit('score', a.value); else if (a.kind === 'xp') this.events.emit('xp', a.value); else if (a.kind === 'heal') o.emit('heal', { amount: a.value });
    else if (a.kind === 'speed') o.emit('apply', { type: 'haste', duration: a.duration, power: 1 }); else if (a.kind === 'shield') o.emit('shield', a.duration);
    else if (a.event) this.events.emit(a.event, o);
    if (a.sfx) this.audio.play(a.sfx); this.events.emit('pickup', { kind: a.kind, value: a.value });
    const s = { k: 1 }; this.tween(s, { k: 1.6 }, { duration: 0.12, onUpdate: () => { this.entity.scale = [s.k, s.k, s.k]; }, onComplete: () => this.entity.destroy() });
  }
}
