// Spin: rotates the entity continuously around one axis.
import { MonoBehaviour } from 'nord';

export default class Spin extends MonoBehaviour {
  static attributes = { speed: { type: 'number', default: 90 }, axis: { type: 'enum', options: ['x', 'y', 'z'], default: 'y' } };

  Update(dt) {
    const r = [...this.entity.rot];
    r[{ x: 0, y: 1, z: 2 }[this.axis]] += this.speed * dt;
    this.entity.rot = r;
  }
}
