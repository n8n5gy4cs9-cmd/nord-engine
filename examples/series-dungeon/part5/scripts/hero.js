import { MonoBehaviour, SerializeField, UnityInput as Input, GameManager, Time, Vector2 } from 'nord';

export default class Hero extends MonoBehaviour {
  static attributes = SerializeField({ speed: 160, knockbackSpeed: 260 });

  Start() { this.stun = 0; this.kick = Vector2.zero; }

  /** Called by Health when we are hit: fly away from the attacker for a moment. */
  Knockback(from) {
    const away = new Vector2(this.position.x - from.pos[0], this.position.y - from.pos[1]).normalized;
    this.kick = away.Mul(this.knockbackSpeed);
    this.stun = 0.15;                                                // no steering while we fly backwards
  }

  FixedUpdate() {
    if (GameManager.instance.state === 'gameover') { this.velocity = Vector2.zero; return; }
    if (this.stun > 0) { this.stun -= Time.fixedDeltaTime; this.velocity = this.kick; return; }
    const move = Vector2.ClampMagnitude(new Vector2(Input.GetAxis('Horizontal'), Input.GetAxis('Vertical')), 1);
    this.velocity = new Vector2(move.x, -move.y).Mul(this.speed);
  }
}
