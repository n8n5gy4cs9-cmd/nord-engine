import { NordScript } from 'nord';

export default class Npc extends NordScript {
  static attributes = { node: { type: 'string', default: 'elder' }, radius: { type: 'number', default: 36 } };
  update() {
    const p = this.scene.findByTag('player')[0]; if (!p || this.talking) return;
    if (Math.hypot(p.pos[0] - this.entity.pos[0], p.pos[1] - this.entity.pos[1]) < this.attrs.radius && this.input.pressed('interact')) { this.talking = true; this.events.emit('dialogue:start', this.attrs.node); this.once = this.events.on('dialogue:end', () => { this.talking = false; this.once(); }); }
  }
}
