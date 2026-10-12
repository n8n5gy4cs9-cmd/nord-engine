import { NordScript } from 'nord';

export default class Race extends NordScript {
  static attributes = { laps: { type: 'int', default: 3 } };
  start() {
    this.cps = this.scene.findByTag('checkpoint'); this.next = 0; this.lap = 0; this.t = 0; this.best = this.save.get('race.best', 0); this.done = false; this.started = false;
    this.lbl = this.ui.label('', { screen: 'hud', x: 12, y: 8, size: 24 });
  }
  onDestroy() { this.lbl?.remove(); }
  onTriggerEnter(o) {
    if (this.done || !o.hasTag('checkpoint') || o.name !== `CP${this.next}`) return;
    this.events.emit('sfx', 'coin'); this.next = (this.next + 1) % this.cps.length;
    if (this.next === 1) { if (this.started) { this.lap++; const lt = this.t - (this.lapStart ?? 0); if (!this.best || lt < this.best) { this.best = lt; this.save.set('race.best', lt); } if (this.lap >= this.attrs.laps) this.done = true; } else this.started = true; this.lapStart = this.t; }
  }
  update(dt) {
    if (!this.done && this.started) this.t += dt;
    this.lbl.set(this.done ? `Finished! ${this.t.toFixed(2)}s   best lap ${this.best.toFixed(2)}s` : `Lap ${Math.min(this.lap + 1, this.attrs.laps)}/${this.attrs.laps}   ${this.t.toFixed(2)}s   best ${this.best ? this.best.toFixed(2) + 's' : '—'}   next CP${this.next}${this.started ? '' : '  (cross CP0 to start)'}`);
  }
}
