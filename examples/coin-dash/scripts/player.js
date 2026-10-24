import { MonoBehaviour, SerializeField, UnityInput as Input, GameManager } from 'nord';

export default class Player extends MonoBehaviour {
  static attributes = SerializeField({ speed: 240 }); // shows up in the Inspector, read as this.speed

  Awake() { this.hurtUntil = 0; }

  FixedUpdate() {
    const gm = GameManager.instance;
    const alive = gm && gm.state === 'playing';
    const x = alive ? Input.GetAxis('Horizontal') : 0;
    const y = alive ? -Input.GetAxis('Vertical') : 0; // 2D screens have y pointing down
    this.physics.setVelocity(this.entity, x * this.speed, y * this.speed);
  }

  LateUpdate() { // keep the player inside the 960 x 540 arena
    const p = this.entity.pos;
    this.entity.pos = [Math.min(945, Math.max(15, p[0])), Math.min(525, Math.max(15, p[1])), p[2]];
  }

  OnCollisionEnter(other) {
    if (!other.hasTag('enemy') || performance.now() < this.hurtUntil) return;
    this.hurtUntil = performance.now() + 900; // short invulnerability
    GameManager.instance.LoseLife();
    this.Destroy(other);                      // the enemy that hit us disappears
  }
}
