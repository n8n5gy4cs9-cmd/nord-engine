import { MonoBehaviour, SerializeField, ObjectPool, GameManager } from 'nord';
import Bullet from './bullet.js';

// The player's ship: WASD to move, the ship turns to face the mouse, hold fire to shoot.
export default class Ship extends MonoBehaviour {
  static attributes = SerializeField({ speed: 250, cooldown: 0.14 });

  async Start() {
    this.next = 0;
    this.pool = new ObjectPool(this.scene, 'prefabs/bullet.prefab.json');
    await this.pool.Warm(20);                       // 20 bullets are created once and reused
    this.entity.on('death', () => this.Die());     // the Health script emits 'death'
  }

  FixedUpdate() {
    if (GameManager.instance.state !== 'playing') { this.physics.setVelocity(this.entity, 0, 0); return; }
    const [x, y] = this.input.vec('left', 'right', 'up', 'down');          // normalised: no faster diagonals
    this.physics.setVelocity(this.entity, x * this.speed, y * this.speed);
  }

  Update() {
    if (GameManager.instance.state !== 'playing') return;
    const p = this.input.pointer, e = this.entity.pos;
    const angle = Math.atan2(p.worldY - e[1], p.worldX - e[0]) * 180 / Math.PI;   // degrees; 0 = pointing right
    this.entity.rot = [0, 0, angle];
    if (this.input.down('fire') && this.game.time.elapsed >= this.next && this.pool) {
      this.next = this.game.time.elapsed + this.cooldown;
      this.Shoot(angle);
    }
  }

  async Shoot(angle) {
    const r = angle * Math.PI / 180, e = this.entity.pos;
    const b = await this.pool.Get({ pos: [e[0] + Math.cos(r) * 26, e[1] + Math.sin(r) * 26, 4] });   // reuse a free bullet
    b.getScript(Bullet).Launch(this.pool, r);
  }

  Die() {
    this.entity.set('sprite', 'alpha', 0.2);
    GameManager.instance.GameOver();               // emits 'gameover' for the HUD
  }
}
