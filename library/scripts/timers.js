// @nord {"id":"gameplay.cooldowns","title":"Timers & cooldowns","category":"gameplay","tier":["2d","3d"],"tags":["timer","cooldown","countdown"],"description":"Countdown/count-up timer (shows mm:ss in the HUD) plus named cooldowns: cooldowns.start('dash', 0.5) / cooldowns.ready('dash'). Emits 'timer:done' when a countdown ends."}
import { NordScript } from 'nord';

export default class Timers extends NordScript {
  static attributes = { mode: { type: 'enum', options: ['countdown', 'countup', 'off'], default: 'off' }, seconds: { type: 'number', default: 60, min: 0 }, hud: { type: 'bool', default: true }, autostart: { type: 'bool', default: true } };
  start() { this.t = this.attrs.mode === 'countdown' ? this.attrs.seconds : 0; this.running = this.attrs.autostart && this.attrs.mode !== 'off'; this.cd = new Map(); this.label = this.attrs.hud && this.attrs.mode !== 'off' ? this.ui.label('', { screen: 'hud', anchor: 'tr', x: 12, y: 8, size: 22 }) : null; }
  onDestroy() { this.label?.remove(); }
  startCooldown(name, sec) { this.cd.set(name, sec); }
  ready(name) { return (this.cd.get(name) ?? 0) <= 0; }
  left(name) { return Math.max(0, this.cd.get(name) ?? 0); }
  pause() { this.running = false; } resume() { this.running = true; }
  update(dt) {
    for (const [k, v] of this.cd) if (v > 0) this.cd.set(k, v - dt);
    if (!this.running) return;
    if (this.attrs.mode === 'countdown') { this.t = Math.max(0, this.t - dt); if (this.t === 0) { this.running = false; this.events.emit('timer:done'); } } else this.t += dt;
    const s = Math.ceil(this.t); this.label?.set(`${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`);
  }
}
