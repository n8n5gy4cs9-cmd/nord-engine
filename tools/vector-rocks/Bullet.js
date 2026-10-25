import { MonoBehaviour, SerializeField, Destroy, Vector2, Mathf } from 'nord';
import Playfield from './Playfield.js';
import Rock from './Rock.js';

export default class Bullet extends MonoBehaviour {
  static attributes = SerializeField({ speed: 460, lifetime: 1.0 });

  /** `heading` is in degrees, 0 = up, clockwise (the same as the ship's rotation). */
  Launch(heading, inherit) {
    const r = heading * Mathf.Deg2Rad;
    this.velocity = new Vector2(Math.sin(r) * this.speed, -Math.cos(r) * this.speed).Add(inherit);
    this.Destroy(this.entity, this.lifetime);
    this.spent = false;
  }

  Update() { Playfield.Wrap(this.entity, 4); }

  OnTriggerEnter(other) {
    if (this.spent || !other.hasTag('Rock')) return;
    this.spent = true;                                              // one bullet, one rock
    other.getScript(Rock).Hit();
    Destroy(this.entity);
  }
}
