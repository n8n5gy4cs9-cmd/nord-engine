import { NordScript } from 'nord';

export default class Arena extends NordScript {
  start() {
    this.total = this.scene.findByTag('target').length; this.left = this.total; this.t = 0;
    this.cross = this.ui.label('+', { screen: 'hud', x: 0, y: 0, size: 30, style: { left: '50%', top: '50%', transform: 'translate(-50%,-50%)' } });
    this.lbl = this.ui.label('', { screen: 'hud', x: 12, y: 8, size: 22 }); this.draw();
    this.offs = [this.events.on('destroyed', () => { this.left--; this.draw(); if (this.left === 0) this.win(); }), this.events.on('shot', () => this.events.emit('sfx', 'laser'))];
  }
  onDestroy() { this.cross?.remove(); this.lbl?.remove(); this.offs?.forEach((o) => o()); }
  draw() { this.lbl.set(`Targets ${this.left}/${this.total}   Time ${this.t.toFixed(1)}s`); }
  update(dt) { if (this.left > 0) { this.t += dt; this.draw(); } }
  win() { const best = this.save.get('fps.best'); if (!best || this.t < best) this.save.set('fps.best', this.t); this.ui.label(`Arena cleared in ${this.t.toFixed(1)}s`, { screen: 'hud', x: 0, y: 120, size: 40, style: { width: '100%', textAlign: 'center' } }); }
}
