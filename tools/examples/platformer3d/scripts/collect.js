import { NordScript } from 'nord';

export default class Collect extends NordScript {
  static attributes = { killY: { type: 'number', default: -8 } };
  start() { this.spawn = [...this.entity.pos]; this.total = this.scene.findByTag('gem').length; this.got = 0; this.lbl = this.ui.label('', { screen: 'hud', x: 12, y: 8, size: 24 }); this.draw(); this.off = this.events.on('pickup', () => { this.got++; this.draw(); if (this.got === this.total) this.ui.label('All gems collected!', { screen: 'hud', x: 0, y: 100, size: 44, style: { width: '100%', textAlign: 'center' } }); }); }
  onDestroy() { this.lbl?.remove(); this.off?.(); }
  draw() { this.lbl.set(`Gems ${this.got}/${this.total}`); }
  update() { if (this.entity.pos[1] < this.attrs.killY) { this.physics.teleport(this.entity, ...this.spawn); this.entity.pos = [...this.spawn]; } }
}
