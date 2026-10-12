// @nord {"id":"physics.explosion","title":"Explosion force","category":"physics","tier":["2d"],"tags":["explosion","impulse","knockback"],"description":"Call explode() (or emit the configured event) to push every body within the radius away from this entity with falloff. Optionally shakes the camera and destroys itself."}
import { NordScript } from 'nord';

export default class Explosion extends NordScript {
  static attributes = { radius: { type: 'number', default: 140 }, force: { type: 'number', default: 500 }, event: { type: 'string', default: '', label: 'Global event that triggers it' }, onStart: { type: 'bool', default: false }, shake: { type: 'bool', default: true }, destroyAfter: { type: 'bool', default: true } };
  start() { if (this.attrs.event) this.off = this.events.on(this.attrs.event, () => this.explode()); if (this.attrs.onStart) this.explode(); }
  onDestroy() { this.off?.(); }
  explode() {
    const [x, y] = this.entity.pos, { radius, force } = this.attrs;
    for (const o of this.scene.all()) {
      if (o === this.entity || !o.getComponent('rigidbody')) continue;
      const dx = o.pos[0] - x, dy = o.pos[1] - y, d = Math.hypot(dx, dy);
      if (d > radius) continue;
      const k = (1 - d / radius) * force / (d || 1); this.physics.applyImpulse(o, dx * k, dy * k);
      o.emit('knockback', { from: this.entity, amount: 1 - d / radius });
    }
    if (this.attrs.shake) this.game.camera?.shake?.(300, 0.015);
    this.events.emit('explosion', this.entity);
    if (this.attrs.destroyAfter) this.entity.destroy();
  }
}
