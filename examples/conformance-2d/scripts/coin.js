import { NordScript } from 'nord';
export default class Coin extends NordScript {
  update(dt) { this.entity.t.pos[1] += Math.sin(this.time.elapsed * 4) * 0.2; this.entity.touch(); }
}
