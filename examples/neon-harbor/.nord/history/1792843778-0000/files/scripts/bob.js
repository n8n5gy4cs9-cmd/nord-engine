// Bob: floats the entity up and down around its start height.
import { MonoBehaviour } from 'nord';

export default class Bob extends MonoBehaviour {
  static attributes = { amplitude: { type: 'number', default: 0.25 }, speed: { type: 'number', default: 2 } };

  Start() { this.y0 = this.entity.pos[1]; this.phase = (this.entity.pos[0] + this.entity.pos[2]) * 0.37; }

  Update() {
    const p = this.entity.pos;
    this.entity.pos = [p[0], this.y0 + Math.sin(this.game.time.elapsed * this.speed + this.phase) * this.amplitude, p[2]];
  }
}
