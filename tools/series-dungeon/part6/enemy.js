import { MonoBehaviour, SerializeField, Random, Vector2, Vector3, WaitForSeconds } from 'nord';
import Health from './health.js';

export default class Enemy extends MonoBehaviour {
  static attributes = SerializeField({ speed: 80, sight: 170, reach: 24 });

  Start() {
    this.hero = this.Find('Hero');
    this.dir = Vector2.zero;
    this.StartCoroutine(this.Wander());                              // a coroutine: "do this, wait, do that" without timers
  }

  /** Every second or two pick a new direction, and sometimes stand still. */
  *Wander() {
    while (true) {
      const a = Random.value * Math.PI * 2;
      this.dir = Random.value < 0.3 ? Vector2.zero : new Vector2(Math.cos(a), Math.sin(a));
      yield new WaitForSeconds(Random.Range(1.0, 2.5));
    }
  }

  get distance() { return Vector3.Distance(this.position, Vector3.From(this.hero.pos)); }

  FixedUpdate() {
    if (!this.hero || this.hero.destroyed) return;
    const chasing = this.distance < this.sight;
    const toHero = Vector2.From(this.hero.pos).Sub(Vector2.From(this.entity.pos));
    const dir = chasing ? toHero.normalized : this.dir;              // a unit vector: direction without speed
    this.velocity = dir.Mul(this.speed * (chasing ? 1 : 0.4));
  }

  Update() {
    if (this.hero && !this.hero.destroyed && this.distance < this.reach) this.hero.getScript(Health).TakeDamage(this.entity);
  }
}
