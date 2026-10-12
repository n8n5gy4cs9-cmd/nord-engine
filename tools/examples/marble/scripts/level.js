import { NordScript } from 'nord';

export default class Level extends NordScript {
  start() { this.spawn = [...this.entity.pos]; this.total = this.scene.findByTag('gem').length; this.got = 0; this.t = 0; this.won = false; this.lbl = this.ui.label('', { screen: 'hud', x: 12, y: 8, size: 24 }); this.offs = [this.events.on('pickup', () => { this.got++; }), this.events.on('fell', () => this.respawn())]; }
  onDestroy() { this.lbl?.remove(); this.offs?.forEach((o) => o()); }
  respawn() { this.physics.teleport(this.entity, ...this.spawn); this.entity.pos = [...this.spawn]; const m = this.entity.scripts.find((s) => 'fell' in s); if (m) m.fell = false; }
  onCollisionEnter(o) { if (o.hasTag('goal') && !this.won && this.got === this.total) { this.won = true; this.ui.label(`You made it in ${this.t.toFixed(1)}s!`, { screen: 'hud', x: 0, y: 100, size: 44, style: { width: '100%', textAlign: 'center' } }); this.events.emit('sfx', 'powerup'); } }
  update(dt) { if (!this.won) this.t += dt; this.lbl.set(`Gems ${this.got}/${this.total}   ${this.t.toFixed(1)}s${this.got < this.total ? '' : '  — reach the goal!'}`); }
}
