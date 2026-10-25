import { NordScript } from 'nord';
import State from './state.js';
import { floatText, burst } from './fx.js';

export default class Door extends NordScript {
  start() {
    this.hero = this.scene.find('Hero');
    this.state = this.scene.find('Game').getScript(State);
    this.nag = 0;
  }

  update(dt) {
    if (this.opened) return;                                       // a neighbour tile already used the key this frame
    this.nag -= dt;
    const [x, y] = this.entity.pos;
    if (Math.hypot(this.hero.pos[0] - x, this.hero.pos[1] - y) > 30) return;
    if (this.state.useKey()) this.open();
    else if (this.nag <= 0) { this.nag = 1.5; floatText(this.scene, x, y, 'Locked', '#ff8a8a'); this.audio.play('assets/audio/sfx/error.wav', { volume: 0.5 }); }
  }

  /** One key opens the whole gate: this tile and its neighbours. */
  open() {
    this.audio.play('assets/audio/sfx/door.wav');
    const [x, y] = this.entity.pos;
    for (const d of this.scene.findByTag('door')) {
      if (Math.hypot(d.pos[0] - x, d.pos[1] - y) < 40) {
        burst(this.scene, d.pos[0], d.pos[1], { texture: 'assets/particles/smoke.png', tint: '#bbbbbb', tintEnd: '#333333', count: 8 });
        d.getScript(Door).opened = true;
        d.destroy();
      }
    }
  }
}
