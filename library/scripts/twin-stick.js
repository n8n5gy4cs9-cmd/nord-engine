// @nord {"id":"controller.twin-stick","title":"Twin-stick shooter","category":"controllers","tier":["2d"],"tags":["shooter","mouse","topdown"],"requires":["rigidbody"],"description":"Move with left/right/up/down, aim at the pointer, fire a prefab with the 'fire' action (or pointer). Spawned prefab gets a velocity via its own script, or is moved here when it has none."}
import { NordScript } from 'nord';

export default class TwinStick extends NordScript {
  static attributes = {
    speed: { type: 'number', default: 170, min: 0 },
    bullet: { type: 'asset', assetType: 'prefab', default: '', label: 'Bullet prefab' },
    bulletSpeed: { type: 'number', default: 420, min: 0 },
    bulletLife: { type: 'number', default: 1.2, min: 0 },
    fireRate: { type: 'number', default: 8, min: 0, label: 'Shots / second' },
    spread: { type: 'number', default: 0, min: 0, label: 'Random spread (deg)' },
  };
  start() { this.cd = 0; this.bullets = []; }
  fixedUpdate(dt) {
    const [x, y] = this.input.vec('left', 'right', 'up', 'down');
    this.physics.setVelocity(this.entity, x * this.attrs.speed, y * this.attrs.speed);
    this.cd -= dt;
    const [px, py] = this.entity.pos, p = this.input.pointer;
    const ang = Math.atan2(p.worldY - py, p.worldX - px);
    const r = [...this.entity.rot]; r[2] = (ang * 180) / Math.PI; this.entity.rot = r;
    if ((this.input.down('fire') || p.down) && this.cd <= 0 && this.attrs.bullet) {
      this.cd = 1 / Math.max(0.01, this.attrs.fireRate);
      const a = ang + ((this.rng.next() - 0.5) * this.attrs.spread * Math.PI) / 180;
      this.scene.spawn(this.attrs.bullet, { pos: [px, py, this.entity.pos[2]] }).then((b) => {
        b.rot = [0, 0, (a * 180) / Math.PI];
        const vx = Math.cos(a) * this.attrs.bulletSpeed, vy = Math.sin(a) * this.attrs.bulletSpeed;
        if (b.getComponent('rigidbody')) this.physics.setVelocity(b, vx, vy); else this.bullets.push({ b, vx, vy });
        this.after(this.attrs.bulletLife, () => !b.destroyed && b.destroy());
      });
      this.events.emit('shoot', this.entity);
    }
    for (const o of this.bullets) if (!o.b.destroyed) o.b.pos = [o.b.pos[0] + o.vx * dt, o.b.pos[1] + o.vy * dt, o.b.pos[2]];
    this.bullets = this.bullets.filter((o) => !o.b.destroyed);
  }
}
