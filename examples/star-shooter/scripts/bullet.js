import { MonoBehaviour, SerializeField } from 'nord';

export default class Bullet extends MonoBehaviour {
  static attributes = SerializeField({ speed: 620, damage: 1, life: 1.2 });

  // called by the ship every time the pooled bullet is fired
  Launch(pool, radians) {
    this.pool = pool; this.age = 0; this.alive = true;
    this.physics.setVelocity(this.entity, Math.cos(radians) * this.speed, Math.sin(radians) * this.speed);
  }

  Update(dt) {
    if (!this.alive) return;
    this.age += dt;
    if (this.age > this.life) this.Recycle();
  }

  OnTriggerEnter(other) {
    if (!this.alive || !other.hasTag('enemy')) return;
    other.emit('damage', { amount: this.damage, from: this.entity });   // the enemy's Health script reacts
    this.Recycle();
  }

  Recycle() {                                       // give the bullet back to the pool (it is only disabled)
    if (!this.alive) return;
    this.alive = false;
    this.physics.setVelocity(this.entity, 0, 0);
    this.pool?.Release(this.entity);
  }
}
