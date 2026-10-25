import { MonoBehaviour, SerializeField, Instantiate, Destroy, Mathf, Vector2, Time, KeyCode, UnityInput as Input, WaitForSeconds, EventBus } from 'nord';
import Playfield from './Playfield.js';
import Game from './Game.js';
import Rock from './Rock.js';
import PowerUp from './PowerUp.js';
import Bullet from './Bullet.js';

export default class Ship extends MonoBehaviour {
  static attributes = SerializeField({ turnSpeed: 200, thrust: 260, maxSpeed: 340, drag: 0.35, fireDelay: 0.26 });

  Awake() {
    this.heading = 0;                       // degrees, 0 = up, clockwise
    this.v = Vector2.zero;
    this.nextShot = 0;
    this.alive = true;
    this.shieldLeft = 0;                    // seconds of each power-up that is still running
    this.rapidLeft = 0;
    this.tripleLeft = 0;
  }

  Start() {
    this.flame = this.FindChild('Flame');
    this.shield = this.FindChild('Shield');
    this.StartCoroutine(this.Spawn());
  }

  get invulnerable() { return this.shieldLeft > 0 || this.safe; }

  Update() {
    if (!this.alive) return;
    const dt = Time.deltaTime;
    this.heading += Input.GetAxis('Horizontal') * this.turnSpeed * dt;
    this.entity.rot = [0, 0, this.heading];

    const thrusting = Input.GetKey(KeyCode.UpArrow) || Input.GetKey(KeyCode.W);
    const r = this.heading * Mathf.Deg2Rad;
    if (thrusting) this.v = this.v.Add(new Vector2(Math.sin(r), -Math.cos(r)).Mul(this.thrust * dt));
    this.v = Vector2.ClampMagnitude(this.v.Mul(1 - this.drag * dt), this.maxSpeed);   // a little space friction keeps it playable
    this.flame.enabled = thrusting && Math.floor(Time.time * 30) % 2 === 0;               // flicker like a real vector flame

    if (Input.GetKey(KeyCode.Space) && Time.time >= this.nextShot) this.Fire();
    if (Input.GetKeyDown(KeyCode.LeftShift)) this.Hyperspace();

    this.shieldLeft = Math.max(0, this.shieldLeft - dt);
    this.rapidLeft = Math.max(0, this.rapidLeft - dt);
    this.tripleLeft = Math.max(0, this.tripleLeft - dt);
    this.shield.enabled = this.shieldLeft > 0 && (this.shieldLeft > 2 || Math.floor(this.shieldLeft * 8) % 2 === 0);   // blinks when it is about to run out
    Playfield.Wrap(this.entity, 14);
  }

  FixedUpdate() { if (this.alive) this.velocity = this.v; }

  async Fire() {
    this.nextShot = Time.time + (this.rapidLeft > 0 ? 0.08 : this.fireDelay);
    this.audio.play('assets/audio/sfx/laser.wav', { volume: 0.35, rate: 1.2 });
    const angles = this.tripleLeft > 0 ? [-12, 0, 12] : [0];
    const nose = new Vector2(Math.sin(this.heading * Mathf.Deg2Rad), -Math.cos(this.heading * Mathf.Deg2Rad)).Mul(22);
    for (const a of angles) {
      const b = await Instantiate('prefabs/bullet.prefab.json', { pos: [this.entity.pos[0] + nose.x, this.entity.pos[1] + nose.y, 2] });
      b.getScript(Bullet).Launch(this.heading + a, this.v.Mul(0.4));
    }
  }

  Hyperspace() {                            // a risky jump to a random place
    this.entity.pos = [Mathf.Lerp(Playfield.Left, Playfield.Right, Math.random()), Mathf.Lerp(Playfield.Top, Playfield.Bottom, Math.random()), 2];
    this.audio.play('assets/audio/sfx/teleport.wav', { volume: 0.5 });
  }

  OnTriggerEnter(other) {
    if (!this.alive) return;
    if (other.hasTag('PowerUp')) { this.Collect(other.getScript(PowerUp).type); Destroy(other); return; }
    if (other.hasTag('Rock') && !this.invulnerable) { other.getScript(Rock).Hit(); this.Die(); }
  }

  Collect(type) {
    this.audio.play('assets/audio/sfx/powerup.wav', { volume: 0.6 });
    if (type === 'shield') this.shieldLeft = 8;
    else if (type === 'rapid') this.rapidLeft = 8;
    else if (type === 'triple') this.tripleLeft = 8;
    else if (type === 'life') Game.instance.AddLife();
    else if (type === 'nova') this.Nova();
    EventBus.Publish('powerup', { type });
  }

  /** Blow up every rock that is on the screen right now. */
  Nova() {
    this.game.camera.flash(250, '#3dff7a');
    this.game.camera.shake(300, 0.012);
    Instantiate('prefabs/nova.prefab.json', { pos: [...this.entity.pos] }).then((fx) => Destroy(fx, 1.2));
    for (const rock of this.FindGameObjectsWithTag('Rock')) rock.getScript(Rock).Hit();
  }

  Die() {
    this.alive = false;
    this.entity.enabled = false;                                                 // hidden. A disabled object does not run its coroutines, so Game brings us back
    const p = this.entity.pos;
    this.audio.play('assets/audio/sfx/death.wav', { volume: 0.7 });
    this.game.camera.shake(350, 0.015);
    Instantiate('prefabs/explosion.prefab.json', { pos: [p[0], p[1], 3], overrides: { components: { 0: { burst: 40 } } } }).then((fx) => Destroy(fx, 1));
    this.shieldLeft = this.rapidLeft = this.tripleLeft = 0;
    if (Game.instance.LoseLife()) Game.instance.StartCoroutine(Game.instance.Respawn(this));   // no lives left: Game shows GAME OVER instead
  }

  *Spawn() {
    this.entity.enabled = true;
    this.entity.pos = [(Playfield.Left + Playfield.Right) / 2, (Playfield.Top + Playfield.Bottom) / 2, 2];
    this.v = Vector2.zero;
    this.heading = 0;
    this.alive = true;
    this.safe = true;                                                       // two seconds of blinking safety
    for (let i = 0; i < 20; i++) { this.entity.native?.setAlpha(i % 2 ? 1 : 0.25); yield new WaitForSeconds(0.1); }
    this.entity.native?.setAlpha(1);
    this.safe = false;
  }
}
