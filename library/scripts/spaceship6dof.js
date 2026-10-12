// @nord {"id":"controller3d.spaceship","title":"Spaceship 6DOF","category":"controllers","tier":["3d"],"tags":["space","flight","6dof"],"requires":["rigidbody"],"description":"Newtonian-ish ship: thrust forward/back, strafe, ascend/descend, pitch/yaw/roll with actions pitchUp/pitchDown/left/right/rollLeft/rollRight/up/down. Velocity damps slowly."}
import { NordScript } from 'nord';

export default class Spaceship6DOF extends NordScript {
  static attributes = { thrust: { type: 'number', default: 12 }, turn: { type: 'number', default: 90, label: 'Turn rate (deg/s)' }, damping: { type: 'number', default: 0.4, min: 0 }, maxSpeed: { type: 'number', default: 40 } };
  start() { this.q = [0, 0, 0, 1]; this.v = [0, 0, 0]; }
  fixedUpdate(dt) {
    const a = this.attrs, t = (a.turn * Math.PI) / 180 * dt;
    const pitch = this.input.axis('pitchDown', 'pitchUp') * t, yaw = this.input.axis('left', 'right') * t, roll = this.input.axis('rollLeft', 'rollRight') * t;
    this.q = norm(mul(this.q, fromEuler(pitch, yaw, roll)));
    const f = rotate(this.q, [0, 0, 1]), r = rotate(this.q, [1, 0, 0]), u = rotate(this.q, [0, 1, 0]);
    const tf = this.input.axis('down', 'up') * a.thrust * dt, ts = this.input.axis('strafeLeft', 'strafeRight') * a.thrust * dt, tu = this.input.axis('descend', 'ascend') * a.thrust * dt;
    for (let i = 0; i < 3; i++) this.v[i] = (this.v[i] + f[i] * tf + r[i] * ts + u[i] * tu) * (1 - a.damping * dt);
    const m = Math.hypot(...this.v); if (m > a.maxSpeed) this.v = this.v.map((x) => (x * a.maxSpeed) / m);
    this.physics.setVelocity(this.entity, ...this.v);
    this.entity.rot = toEulerDeg(this.q);
  }
}
const mul = ([x, y, z, w], [a, b, c, d]) => [w * a + x * d + y * c - z * b, w * b - x * c + y * d + z * a, w * c + x * b - y * a + z * d, w * d - x * a - y * b - z * c];
const norm = (q) => { const l = Math.hypot(...q) || 1; return q.map((v) => v / l); };
const fromEuler = (p, y, r) => { const [sp, cp, sy, cy, sr, cr] = [Math.sin(p / 2), Math.cos(p / 2), Math.sin(y / 2), Math.cos(y / 2), Math.sin(r / 2), Math.cos(r / 2)]; return [sp * cy * cr + cp * sy * sr, cp * sy * cr - sp * cy * sr, cp * cy * sr - sp * sy * cr, cp * cy * cr + sp * sy * sr]; };
const rotate = (q, v) => { const [x, y, z, w] = q, [vx, vy, vz] = v, tx = 2 * (y * vz - z * vy), ty = 2 * (z * vx - x * vz), tz = 2 * (x * vy - y * vx); return [vx + w * tx + y * tz - z * ty, vy + w * ty + z * tx - x * tz, vz + w * tz + x * ty - y * tx]; };
const toEulerDeg = ([x, y, z, w]) => {
  const D = 180 / Math.PI, sp = 2 * (w * x - y * z);
  return [Math.asin(Math.max(-1, Math.min(1, sp))) * D, Math.atan2(2 * (w * y + x * z), 1 - 2 * (x * x + y * y)) * D, Math.atan2(2 * (w * z + x * y), 1 - 2 * (x * x + z * z)) * D];
};
