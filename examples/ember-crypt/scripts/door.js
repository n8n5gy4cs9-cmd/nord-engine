import { MonoBehaviour, Destroy, Time, Vector3 } from 'nord';
import Run from './Run.js';
import Fx from './Fx.js';

export default class Door extends MonoBehaviour {
  Start() { this.hero = this.Find('Hero'); this.nag = 0; this.opened = false; }

  Update() {
    if (this.opened) return;                                         // a neighbour tile already used the key this frame
    this.nag -= Time.deltaTime;
    if (Vector3.Distance(this.position, Vector3.From(this.hero.pos)) > 30) return;
    if (Run.instance.UseKey()) this.Open();
    else if (this.nag <= 0) {
      this.nag = 1.5;
      Fx.FloatText(this.position.x, this.position.y, 'Locked', '#ff8a8a');
      this.audio.play('assets/audio/sfx/error.wav', { volume: 0.5 });
    }
  }

  /** One key opens the whole gate: this tile and its neighbours within 40 pixels. */
  Open() {
    this.audio.play('assets/audio/sfx/door.wav');
    for (const d of this.FindGameObjectsWithTag('Door')) {
      if (Vector3.Distance(this.position, Vector3.From(d.pos)) < 40) {
        Fx.Burst(d.pos[0], d.pos[1], { texture: 'assets/particles/smoke.png', tint: '#bbbbbb', tintEnd: '#333333', burst: 8 });
        d.getScript(Door).opened = true;
        Destroy(d);
      }
    }
  }
}
