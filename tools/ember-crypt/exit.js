import { NordScript } from 'nord';

export default class Exit extends NordScript {
  start() { this.hero = this.scene.find('Hero'); this.t = 0; this.done = false; }
  update(dt) {
    this.t += dt;
    this.entity.rot = [0, 0, this.t * 30];                          // the rune slowly turns
    const [x, y] = this.entity.pos;
    if (!this.done && Math.hypot(this.hero.pos[0] - x, this.hero.pos[1] - y) < 16) { this.done = true; this.events.emit('exit'); }
  }
}
