import { NordScript } from 'nord';

export default class HeroAnim extends NordScript {
  start() { this.s = this.entity.getComponent('animatedSprite'); }
  update() {
    const [x, y] = this.input.vec('left', 'right', 'up', 'down'), want = x || y ? 'walk' : 'idle'; if (x) this.s.setFlip(x < 0);
    if (want !== this.s.current) this.s.play(want);
  }
}
