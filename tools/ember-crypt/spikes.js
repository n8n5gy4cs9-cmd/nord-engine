import { NordScript } from 'nord';

export default class Spikes extends NordScript {
  start() { this.hero = this.scene.find('Hero'); }
  update() {
    const [x, y] = this.entity.pos;
    if (Math.hypot(this.hero.pos[0] - x, this.hero.pos[1] - y) < 14) this.hero.emit('hit', { from: this.entity });
  }
}
