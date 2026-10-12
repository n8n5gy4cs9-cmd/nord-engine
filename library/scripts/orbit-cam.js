// @nord {"id":"controller3d.orbit-cam","title":"Orbit camera (auto)","category":"controllers","tier":["3d"],"tags":["camera","orbit","showroom"],"requires":["camera"],"description":"Slowly auto-rotates an orbit camera around its target (turntable/showroom); pauses while the user drags. Put on the entity with the camera component (type 'orbit')."}
import { NordScript } from 'nord';

export default class OrbitCam extends NordScript {
  static attributes = { speed: { type: 'number', default: 20, label: 'Degrees / second' }, resumeAfter: { type: 'number', default: 2, min: 0 } };
  start() { this.cam = this.entity.getComponent('camera')?.camera; this.last = this.cam?.alpha; this.idle = 0; }
  update(dt) {
    if (!this.cam || this.cam.alpha === undefined) return;
    if (Math.abs(this.cam.alpha - this.last) > 1e-4) this.idle = 0; else this.idle += dt;
    if (this.idle >= this.attrs.resumeAfter) this.cam.alpha += (this.attrs.speed * Math.PI / 180) * dt;
    this.last = this.cam.alpha;
  }
}
