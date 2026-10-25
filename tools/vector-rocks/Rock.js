import { MonoBehaviour, SerializeField, Instantiate, Destroy, Random, Time, Vector2 } from 'nord';
import Playfield from './Playfield.js';
import Game from './Game.js';

const SIZES = ['small', 'medium', 'large'];
const POINTS = [100, 50, 20];

export default class Rock extends MonoBehaviour {
  static attributes = SerializeField({ size: 2 });                 // 2 large, 1 medium, 0 small (set by the prefab)

  Awake() { this.spin = Random.Range(-70.5, 70.5); this.dead = false; }

  /** A prefab path for a rock of this size (2 large, 1 medium, 0 small): one of three shapes. */
  static Prefab(size) { return `prefabs/rock-${SIZES[size]}-${Random.Range(0, 3)}.prefab.json`; }

  Launch(velocity) { this.velocity = velocity; }

  Update() {
    this.Rotate(0, 0, this.spin * Time.deltaTime);
    Playfield.Wrap(this.entity, 40);
  }

  /** Called by a bullet, a nova, or the ship ramming us. */
  async Hit() {
    if (this.dead) return;
    this.dead = true;
    const game = Game.instance;
    const p = this.entity.pos;
    game.AddScore(POINTS[this.size]);
    this.audio.play(`assets/audio/sfx/explosion${this.size === 0 ? '_small' : ''}.wav`, { volume: 0.6 });
    Instantiate('prefabs/explosion.prefab.json', { pos: [p[0], p[1], 3], overrides: { components: { 0: { burst: 10 + this.size * 10 } } } }).then((fx) => Destroy(fx, 1));
    if (this.size > 0) {
      const v = this.velocity;                                     // children inherit a push from the parent, then fly apart
      for (let i = 0; i < 2; i++) {
        const away = Random.insideUnitCircle.normalized.Mul(30 + game.wave * 4);
        const child = await Instantiate(Rock.Prefab(this.size - 1), { pos: [p[0], p[1], 1] });
        child.getScript(Rock).Launch(v.Mul(0.5).Add(away).Mul(1.25));
      }
    }
    if (Random.value < [0.22, 0.14, 0.08][this.size]) {            // small rocks drop power-ups most often
      Instantiate(`prefabs/pu-${Random.Pick(['shield', 'rapid', 'triple', 'nova', 'life'])}.prefab.json`, { pos: [p[0], p[1], 2] });
    }
    Destroy(this.entity);
  }
}
