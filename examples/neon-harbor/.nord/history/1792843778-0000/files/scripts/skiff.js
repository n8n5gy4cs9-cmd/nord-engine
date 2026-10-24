// The player's skiff: throttle/steer/boost, a little banking, obstacle push-out and the world bounds.
import { MonoBehaviour, SerializeField, Mathf } from 'nord';

export default class Skiff extends MonoBehaviour {
  static attributes = SerializeField({ maxSpeed: 14, boostSpeed: 26, accel: 16, turnRate: 92, bounds: 70 });

  Awake() {
    this.speed = 0;
    this.heading = 0; // degrees, 0 = +Z
    this.energy = 100;
    this.boosting = false;
    this.frozen = false;
    this.solids = [];
  }

  Start() {
    // everything tagged "solid" (towers, piers) becomes a rectangle the skiff cannot enter
    for (const e of this.FindGameObjectsWithTag('solid')) {
      const m = e.getComponent('mesh')?.data?.size;
      if (!m) continue;
      const p = e.worldPos, s = e.scale;
      this.solids.push({ x: p[0], z: p[2], hx: (m[0] * s[0]) / 2, hz: (m[2] * s[2]) / 2 });
    }
  }

  Update(dt) {
    if (this.frozen) return;
    const input = this.game.input;
    const throttle = input.axis('down', 'up');
    const steer = input.axis('left', 'right');
    this.boosting = input.down('boost') && throttle > 0 && this.energy > 0;
    const top = this.boosting ? this.boostSpeed : this.maxSpeed;
    const target = throttle * top * (throttle < 0 ? 0.4 : 1);
    this.speed = Mathf.MoveTowards(this.speed, target, this.accel * dt);
    this.heading += steer * this.turnRate * dt * Math.min(1, Math.abs(this.speed) / 4 + 0.25);
    this.energy = Math.min(100, Math.max(0, this.energy + (this.boosting ? -28 : 7) * dt));

    const r = (this.heading * Math.PI) / 180;
    let x = this.entity.pos[0] + Math.sin(r) * this.speed * dt;
    let z = this.entity.pos[2] + Math.cos(r) * this.speed * dt;
    for (const s of this.solids) { // push the skiff out of boxes (radius 1.3)
      const dx = x - s.x, dz = z - s.z, ox = s.hx + 1.3 - Math.abs(dx), oz = s.hz + 1.3 - Math.abs(dz);
      if (ox > 0 && oz > 0) { if (ox < oz) x += Math.sign(dx || 1) * ox; else z += Math.sign(dz || 1) * oz; this.speed *= 0.6; }
    }
    x = Math.max(-this.bounds, Math.min(this.bounds, x));
    z = Math.max(-this.bounds, Math.min(this.bounds, z));
    const bob = Math.sin(this.game.time.elapsed * 3) * 0.06;
    this.entity.pos = [x, 0.35 + bob, z];
    this.entity.rot = [Math.sin(this.game.time.elapsed * 2) * 1.5, this.heading, -steer * Math.min(1, Math.abs(this.speed) / 10) * 9];
  }
}
