// @nord {"id":"gameplay.checkpoint","title":"Checkpoints & respawn","category":"gameplay","tier":["2d","3d"],"tags":["checkpoint","respawn"],"requires":["trigger"],"description":"Put on every checkpoint trigger entity: touching one sets the respawn point; when the global 'died' event fires (or y passes killY) the player is moved back and healed after a delay. Emits 'checkpoint' and 'respawned'."}
import { NordScript } from 'nord';

export default class Checkpoint extends NordScript {
  static attributes = { tag: { type: 'string', default: 'player' }, respawnEvent: { type: 'string', default: 'died' }, killY: { type: 'number', default: 1e9, label: 'Respawn when player y exceeds this (2D, y down)' }, delay: { type: 'number', default: 0.8 } };
  start() {
    this.player = this.scene.findByTag(this.attrs.tag)[0]; this.point = this.player ? [...this.player.pos] : null;
    this.offs = [this.events.on('checkpoint', (pos) => { this.point = [...pos]; }), this.events.on(this.attrs.respawnEvent, () => this.after(this.attrs.delay, () => this.respawn()))];
  }
  onDestroy() { this.offs.forEach((o) => o()); }
  onTriggerEnter(o) { if (o.hasTag(this.attrs.tag)) { this.events.emit('checkpoint', this.entity.pos); this.entity.emit('activated'); } }
  update() { if (this.player && this.player.pos[1] > this.attrs.killY) this.respawn(); }
  respawn() {
    if (!this.player || !this.point) return; this.player.pos = [...this.point]; this.physics.setVelocity?.(this.player, 0, 0);
    this.player.emit('heal', { amount: 999 }); this.events.emit('respawned', this.player);
  }
}
