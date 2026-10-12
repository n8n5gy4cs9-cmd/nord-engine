import { NordScript } from 'nord';

export default class Chest extends NordScript {
  start() { this.near = false; this.open = false; }
  onTriggerEnter(o) { if (o.hasTag('player')) this.near = true; }
  onTriggerExit(o) { if (o.hasTag('player')) this.near = false; }
  update() {
    if (!this.open && this.near && this.input.pressed('interact')) {
      this.open = true; this.entity.set('sprite', 'texture', 'assets/sprites/items/chest_open.png'); this.events.emit('score', 500); this.events.emit('sfx', 'powerup'); this.events.emit('dialogue:start', 'chest'); this.once = this.events.on('dialogue:end', () => { this.once(); this.events.emit('game:win'); });
    }
  }
}
