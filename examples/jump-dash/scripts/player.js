import { MonoBehaviour, SerializeField, WaitForSeconds, GameManager } from 'nord';

// Platformer movement with the three tricks that make jumping feel right:
//  - coyote time: you can still jump for a moment after walking off a ledge
//  - jump buffer: pressing jump just before landing still jumps
//  - variable height: releasing jump early cuts the jump short
export default class Player extends MonoBehaviour {
  static attributes = SerializeField({ speed: 260, jump: 600, coyote: 0.1, buffer: 0.12 });

  Awake() { this.dir = 0; this.coyoteLeft = 0; this.bufferLeft = 0; this.cut = false; this.invulnerable = false; this.spawnPoint = [80, 470]; }

  Update(dt) {                                       // read input and timers every frame
    this.dir = this.input.axis('left', 'right');
    this.bufferLeft = this.input.pressed('jump') ? this.buffer : Math.max(0, this.bufferLeft - dt);
    this.coyoteLeft = this.physics.isGrounded(this.entity) ? this.coyote : Math.max(0, this.coyoteLeft - dt);
    if (this.input.released('jump')) this.cut = true;
    if (this.dir) this.entity.set('sprite', 'flipX', this.dir < 0);
  }

  FixedUpdate() {                                    // apply movement with physics
    if (GameManager.instance.state !== 'playing') { this.physics.setVelocity(this.entity, 0, null); return; }
    const [, vy] = this.physics.velocity(this.entity);
    if (this.bufferLeft > 0 && this.coyoteLeft > 0) {
      this.physics.setVelocity(this.entity, this.dir * this.speed, -this.jump);   // up is negative y
      this.bufferLeft = 0; this.coyoteLeft = 0;
    } else {
      this.physics.setVelocity(this.entity, this.dir * this.speed, this.cut && vy < 0 ? vy * 0.45 : null);
    }
    this.cut = false;
  }

  LateUpdate() {
    if (this.entity.pos[1] > 700) this.Hurt(true);   // fell into a pit
  }

  // called by hazards: this.callScripts('Hurt') or other.getScript(Player).Hurt()
  Hurt(fell = false) {
    if (this.invulnerable || GameManager.instance.state !== 'playing') return;
    GameManager.instance.LoseLife();
    if (GameManager.instance.state !== 'playing') return;
    if (fell) { this.physics.teleport(this.entity, this.spawnPoint[0], this.spawnPoint[1]); this.physics.setVelocity(this.entity, 0, 0); }
    else this.physics.setVelocity(this.entity, -this.dir * 200, -380);            // small hop back
    this.StartCoroutine(this.Blink());
  }

  *Blink() {                                         // invulnerable for 1.2 s, flicker the sprite
    this.invulnerable = true;
    for (let i = 0; i < 6; i++) {
      this.entity.set('sprite', 'alpha', 0.25); yield new WaitForSeconds(0.1);
      this.entity.set('sprite', 'alpha', 1);    yield new WaitForSeconds(0.1);
    }
    this.invulnerable = false;
  }
}
