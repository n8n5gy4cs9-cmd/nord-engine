import { NordScript } from 'nord';

// An unlit brazier glows faintly. Stand next to it and press interact (E) to light it for some oil; a lit brazier is a safe zone
// (shades burn in its light) and the gate opens once every brazier burns. Emits 'brazier:lit' {entity}.
export default class Brazier extends NordScript {
  static attributes = {
    cost: { type: 'number', default: 15, min: 0 },
    reach: { type: 'number', default: 46, min: 0 },
    radius: { type: 'number', default: 240, min: 10, label: 'Light radius once lit' },
    intensity: { type: 'number', default: 1.25, min: 0 },
  };
  start() {
    this.light = this.entity.scripts.find((s) => s.isLight2D);
    this.lit = false; this.near = false; this.cold = [this.light.radius, this.light.intensity];
    this.entity.set('sprite', 'tint', '#8a86a0');
  }
  update() {
    if (this.lit) return;
    const p = this.scene.findByTag('player')[0]; if (!p) return;
    const near = Math.hypot(p.pos[0] - this.entity.pos[0], p.pos[1] - this.entity.pos[1]) < this.attrs.reach;
    if (near !== this.near) { this.near = near; this.events.emit('hint', { id: this.entity.id, text: near ? `Press E to light the brazier (${this.attrs.cost} oil)` : '' }); }
    if (!near || !this.input.pressed('interact')) return;
    const lantern = p.scripts.find((s) => s.isLantern);
    if (!lantern || lantern.oil < this.attrs.cost) { this.events.emit('toast', { text: 'Not enough oil', color: '#ff6a5a' }); return; }
    lantern.oil -= this.attrs.cost; this.ignite();
  }
  ignite() {
    const a = this.attrs, l = this.light, k = { v: 0 };
    this.lit = true; l.softness = 5; l.attrs.flicker = 0.22; l.attrs.flickerSpeed = 8; l.setColor('#ffb25a');
    this.tween(k, { v: 1 }, { duration: 0.7, onUpdate: () => { l.radius = this.cold[0] + (a.radius - this.cold[0]) * k.v; l.intensity = this.cold[1] + (a.intensity - this.cold[1]) * k.v; } });
    this.entity.set('sprite', 'tint', '#ffffff'); this.entity.getComponent('particles')?.start();
    this.events.emit('hint', { id: this.entity.id, text: '' }); this.events.emit('sfx', 'powerup'); this.events.emit('brazier:lit', { entity: this.entity });
    this.game.camera.shake(140, 0.004);
  }
}
