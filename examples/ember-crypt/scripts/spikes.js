import { MonoBehaviour, Vector3 } from 'nord';
import Health from './Health.js';

export default class Spikes extends MonoBehaviour {
  Start() { this.hero = this.Find('Hero'); }
  Update() {
    if (Vector3.Distance(this.position, Vector3.From(this.hero.pos)) < 14) this.hero.getScript(Health).TakeDamage(this.entity);
  }
}
