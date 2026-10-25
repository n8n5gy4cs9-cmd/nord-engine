import { Singleton, SerializeField, Instantiate, Random, Mathf, Vector2, PlayerPrefs, EventBus, WaitForSeconds, WaitUntil, KeyCode, UnityInput as Input } from 'nord';
import Playfield from './Playfield.js';
import Rock from './Rock.js';

/** Score, lives, waves, and the heartbeat. Everything else asks `Game.instance`. */
export default class Game extends Singleton {
  static attributes = SerializeField({ startLives: 3, firstWave: 4 });

  Awake() {
    this.score = 0;
    this.lives = this.startLives;
    this.wave = 0;
    this.over = false;
    this.hiScore = PlayerPrefs.GetInt('vectorrocks.hi', 0);
  }

  Start() {
    this.StartCoroutine(this.Waves());
    this.StartCoroutine(this.Heartbeat());
  }

  RockCount() { return this.FindGameObjectsWithTag('Rock').length; }

  AddScore(points) {
    this.score += points;
    if (this.score > this.hiScore) { this.hiScore = this.score; PlayerPrefs.SetInt('vectorrocks.hi', this.hiScore); }
    EventBus.Publish('hud');
  }

  AddLife() { this.lives++; EventBus.Publish('hud'); }

  LoseLife() {
    this.lives--;
    EventBus.Publish('hud');
    if (this.lives <= 0) { this.over = true; EventBus.Publish('gameover'); }
    return this.lives > 0;
  }

  *Waves() {
    while (!this.over) {
      this.wave++;
      EventBus.Publish('hud');
      yield new WaitForSeconds(1.5);
      const ship = this.FindWithTag('Player');
      const count = Math.min(11, this.firstWave - 1 + this.wave);
      let pending = count;                                                      // Instantiate is asynchronous: count the rocks that have really arrived
      for (let i = 0; i < count; i++) {
        let p = Playfield.RandomEdgePoint();
        while (ship && Vector2.Distance(Vector2.From(p), Vector2.From(ship.pos)) < 160) p = Playfield.RandomEdgePoint();   // never on top of the ship
        const speed = 38 + this.wave * 5;
        const dir = Random.insideUnitCircle.normalized;
        Instantiate(Rock.Prefab(2), { pos: [p[0], p[1], 1] }).then((rock) => { rock.getScript(Rock).Launch(dir.Mul(speed)); pending--; });
      }
      yield new WaitUntil(() => pending === 0);
      yield new WaitUntil(() => this.RockCount() === 0);                        // the wave is over when the sky is empty
      yield new WaitForSeconds(1.2);
    }
  }

  /** Runs on the Game, which is always enabled: the dead ship's own coroutines are stopped while it is hidden. */
  *Respawn(ship) {
    yield new WaitForSeconds(1.5);
    ship.StartCoroutine(ship.Spawn());
  }

  /** The classic two-tone thump that speeds up as the rocks run out. */
  *Heartbeat() {
    let high = false;
    while (!this.over) {
      this.audio.play('assets/audio/sfx/tick.wav', { volume: 0.5, rate: high ? 0.7 : 0.5 });
      high = !high;
      yield new WaitForSeconds(Mathf.Lerp(0.3, 1.0, Mathf.Clamp01(this.RockCount() / 16)));
    }
  }

  Update() {
    if (this.over && (Input.GetKeyDown(KeyCode.Return) || Input.GetKeyDown(KeyCode.Space))) this.game.restart();
  }
}
