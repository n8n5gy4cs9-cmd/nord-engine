import { NordScript } from 'nord';

/** Third-person follow camera that orbits the player with Q / E. */
export default class CameraRig extends NordScript {
  static attributes = {
    distance: { type: 'number', default: 9, min: 2, max: 30 },
    height: { type: 'number', default: 4, min: 0, max: 20 },
    orbitSpeed: { type: 'number', default: 90, label: 'Orbit deg/sec' },
  };

  start() { this.yaw = 0; this.target = this.scene.find('Player'); }

  lateUpdate(dt) {
    this.yaw += this.input.axis('camLeft', 'camRight') * this.attrs.orbitSpeed * dt;
    this.game.camYaw = this.yaw;
    const t = this.target.worldPos, r = (this.yaw * Math.PI) / 180, d = this.attrs.distance;
    const want = [t[0] - Math.sin(r) * d, t[1] + this.attrs.height, t[2] - Math.cos(r) * d];
    const p = this.entity.pos, k = 1 - Math.pow(0.001, dt); // frame-rate independent smoothing
    this.entity.pos = [p[0] + (want[0] - p[0]) * k, p[1] + (want[1] - p[1]) * k, p[2] + (want[2] - p[2]) * k];
    this.entity.rot = [Math.atan2(this.attrs.height - 1, d) * 180 / Math.PI, this.yaw, 0];
  }
}
