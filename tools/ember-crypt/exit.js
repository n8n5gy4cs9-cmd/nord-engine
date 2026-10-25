import { MonoBehaviour, Time, Vector3 } from 'nord';
import Run from './Run.js';

export default class Exit extends MonoBehaviour {
  Start() { this.hero = this.Find('Hero'); this.done = false; }

  Update() {
    this.Rotate(0, 0, 30 * Time.deltaTime);                          // the rune slowly turns
    if (!this.done && Vector3.Distance(this.position, Vector3.From(this.hero.pos)) < 16) { this.done = true; Run.instance.End(true); }
  }
}
