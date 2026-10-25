import { MonoBehaviour, SerializeField, Instantiate, Destroy, Random, Time, Vector2, Vector3, WaitForSeconds } from 'nord';
import World from './World.js';
import Fx from './Fx.js';
import Health from './Health.js';

/** Slime and bat are the same script on two prefabs with different numbers (Unity: a prefab variant). */
export default class Enemy extends MonoBehaviour {
  static attributes = SerializeField({ speed: 55, hp: 2, sight: 150, reach: 20, zigzag: 0 });

  Start() {
    this.hero = this.Find('Hero');
    this.animator = this.GetComponent('animatedSprite');
    this.health = this.hp;
    this.dir = Vector2.zero;
    this.stun = 0;
    this.kick = Vector2.zero;
    this.t = Random.value * 6;
    this.StartCoroutine(this.Wander());
  }

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
    this.t += Time.fixedDeltaTime;
    if (this.stun > 0) { this.stun -= Time.fixedDeltaTime; this.velocity = this.kick; return; }
    const p = this.position;
    const sees = this.distance < this.sight && World.LineClear(p.x, p.y, this.hero.pos[0], this.hero.pos[1]);   // close AND no wall in between
    let dir = this.dir;
    if (sees) dir = new Vector2(this.hero.pos[0] - p.x, this.hero.pos[1] - p.y).normalized;
    const wobble = Math.sin(this.t * 7) * this.zigzag * 0.8;         // the bat swerves: add a bit of the perpendicular
    const v = new Vector2(dir.x - dir.y * wobble, dir.y + dir.x * wobble).Mul(this.speed * (sees ? 1 : 0.45));
    this.velocity = v;
    if (dir.x !== 0) this.animator.setFlip(dir.x < 0);
  }

  Update() {
    if (this.hero && !this.hero.destroyed && this.distance < this.reach) this.hero.getScript(Health).TakeDamage(this.entity);
  }

  TakeDamage(amount, from) {
    this.health -= amount;
    const p = this.position;
    this.kick = new Vector2(p.x - from.pos[0], p.y - from.pos[1]).normalized.Mul(260);
    this.stun = 0.18;
    Fx.FloatText(p.x, p.y, amount, '#ffe27a');
    this.audio.play('assets/audio/sfx/hit.wav', { volume: 0.8 });
    Fx.HitStop(55);
    Fx.Burst(p.x, p.y, { tint: '#ffffff', tintEnd: '#9bd1ff', burst: 6, lifespan: 250 });
    if (this.health <= 0) this.Die();
  }

  Die() {
    const p = this.position;
    Fx.Burst(p.x, p.y, { texture: 'assets/particles/smoke.png', tint: '#d8e4ff', tintEnd: '#2a2f45', burst: 12, lifespan: 600 });
    this.audio.play('assets/audio/sfx/death.wav', { volume: 0.6 });
    if (Random.value < 0.6) Instantiate('prefabs/coin.prefab.json', { pos: [p.x, p.y, 2] });   // sometimes drops a coin
    Destroy(this.entity);
  }
}
