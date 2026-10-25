import { NordScript } from 'nord';

export default class Coin extends NordScript {
  start() {
    this.y0 = this.entity.pos[1];
    this.t = this.rng.range(0, 6);                                  // every coin bobs out of step with the others
    this.taken = false;
  }

  update(dt) {
    this.t += dt;
    const p = this.entity.pos;
    this.entity.pos = [p[0], this.y0 + Math.sin(this.t * 4) * 2, p[2]];
  }

  onTriggerEnter(other) {
    if (this.taken || !other.hasTag('hero')) return;
    this.taken = true;                                              // destroy() is deferred to the end of the frame
    this.events.emit('coin');
    this.entity.destroy();
  }
}
