import { MonoBehaviour, SerializeField, Instantiate, Destroy, UnityInput as Input, KeyCode, GameManager, EventBus, Time, Vector2, Vector3 } from 'nord';
import Enemy from './Enemy.js';

export default class Hero extends MonoBehaviour {
  static attributes = SerializeField({ speed: 120, knockbackSpeed: 220, reach: 34, swingDelay: 0.35 });

  Start() {
    this.animator = this.GetComponent('animatedSprite');
    this.facing = new Vector2(0, 1);
    this.kick = Vector2.zero;
    this.stun = 0;
    this.nextSwing = 0;
    this.moving = false;
    this.off = EventBus.Subscribe('gameover', () => this.animator.play('hurt'));
  }

  get dead() { return GameManager.instance.state === 'gameover'; }

  /** Called by Health when we are hit: fly away from the attacker for a moment. */
  Knockback(from) {
    const away = new Vector2(this.position.x - from.pos[0], this.position.y - from.pos[1]).normalized;
    this.kick = away.Mul(this.knockbackSpeed);
    this.stun = 0.15;
  }

  FixedUpdate() {
    if (this.dead) { this.velocity = Vector2.zero; return; }
    if (this.stun > 0) { this.stun -= Time.fixedDeltaTime; this.velocity = this.kick; return; }
    const move = Vector2.ClampMagnitude(new Vector2(Input.GetAxis('Horizontal'), Input.GetAxis('Vertical')), 1);
    this.velocity = new Vector2(move.x, -move.y).Mul(this.speed);
    this.moving = move.sqrMagnitude > 0;
    if (this.moving) {
      this.facing = new Vector2(move.x, -move.y).normalized;
      this.animator.setFlip(move.x < 0);                             // the art faces forward: mirror it to look left
    }
  }

  Update() {
    if (this.dead) return;
    const want = this.stun > 0 ? 'hurt' : this.moving ? 'walk' : 'idle';
    if (this.animator.current !== want) this.animator.play(want);    // only restart an animation when it changes
    if (Time.time >= this.nextSwing && (Input.GetKeyDown(KeyCode.Space) || Input.GetKeyDown(KeyCode.J) || Input.GetMouseButtonDown(0))) this.Swing();
  }

  Swing() {
    this.nextSwing = Time.time + this.swingDelay;
    this.audio.play('assets/audio/sfx/swing.wav', { volume: 0.7 });
    const p = this.position;
    Instantiate('prefabs/slash.prefab.json', { pos: [p.x + this.facing.x * 20, p.y + this.facing.y * 20, 6] });
    for (const e of this.FindGameObjectsWithTag('Enemy')) {
      const to = new Vector2(e.pos[0] - p.x, e.pos[1] - p.y);
      const inFront = Vector2.Dot(to.normalized, this.facing) > -0.1;   // the angle between "where it is" and "where I look"
      if (to.magnitude < this.reach && inFront) e.getScript(Enemy).TakeDamage(1, this.entity);
    }
  }

  OnDestroy() { this.off?.(); }
}
