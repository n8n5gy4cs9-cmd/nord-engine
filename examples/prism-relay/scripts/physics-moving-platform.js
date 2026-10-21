// @nord {"id":"physics.moving-platform","title":"Moving platform","category":"physics","tier":["2d","3d"],"tags":["platform","path","carry"],"description":"Moves back and forth between its start and start+offset (sine or linear). Riders (anything standing on it with a rigidbody) are carried by applying the platform's delta."}
import { NordScript } from 'nord';

export default class MovingPlatform extends NordScript {
  static attributes = { offset: { type: 'vec3', default: [120, 0, 0] }, period: { type: 'number', default: 4, min: 0.1 }, mode: { type: 'enum', options: ['sine', 'pingpong'], default: 'sine' }, carryTag: { type: 'string', default: 'player' } };
  start() { this.o = [...this.entity.pos]; this.t = 0; this.prev = [...this.o]; }
  fixedUpdate(dt) {
    const a = this.attrs; this.t += dt / a.period;
    const f = a.mode === 'sine' ? (1 - Math.cos(this.t * Math.PI * 2)) / 2 : 1 - Math.abs(((this.t * 2) % 2) - 1);
    const np = this.o.map((v, i) => v + a.offset[i] * f), d = np.map((v, i) => v - this.prev[i]);
    this.entity.pos = np; this.prev = np;
    for (const r of this.scene.findByTag(a.carryTag)) {
      const dx = r.pos[0] - np[0], top = this.entity.getComponent('collider')?.data.size ?? [64, 16];
      if (Math.abs(dx) < top[0] / 2 && this.physics.isGrounded(r)) r.pos = r.pos.map((v, i) => v + d[i]);
    }
  }
}
