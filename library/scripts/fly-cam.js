// @nord {"id":"controller3d.fly-cam","title":"Fly camera","category":"controllers","tier":["3d"],"tags":["camera","free-look","debug"],"description":"Free-fly camera: WASD + up/down (actions 'ascend'/'descend'), mouse-drag look, 'sprint' to go faster. Put on the camera entity."}
import { NordScript } from 'nord';

export default class FlyCam extends NordScript {
  static attributes = { speed: { type: 'number', default: 8, min: 0 }, sprintFactor: { type: 'number', default: 3, min: 1 }, sensitivity: { type: 'number', default: 0.15, min: 0 }, lockPointer: { type: 'bool', default: false } };
  start() { this.yaw = this.entity.rot[1]; this.pitch = this.entity.rot[0]; this.#look(); }
  #look(on) {
    this.dx = 0; this.dy = 0;
    this.mm = (e) => { if (document.pointerLockElement || e.buttons) { this.dx += e.movementX; this.dy += e.movementY; } };
    this.click = () => { if (this.attrs.lockPointer) document.querySelector("canvas")?.requestPointerLock?.(); };
    window.addEventListener("mousemove", this.mm); window.addEventListener("pointerdown", this.click);
  }
  onDestroy() { window.removeEventListener("mousemove", this.mm); window.removeEventListener("pointerdown", this.click); }
  update(dt) {
    const a = this.attrs;
    this.yaw += this.dx * a.sensitivity; this.pitch = Math.max(-89, Math.min(89, this.pitch + this.dy * a.sensitivity)); this.dx = this.dy = 0;
    const [mx, mz] = this.input.vec('left', 'right', 'down', 'up'), my = this.input.axis('descend', 'ascend');
    const yr = (this.yaw * Math.PI) / 180, pr = (this.pitch * Math.PI) / 180, s = a.speed * dt * (this.input.down('sprint') ? a.sprintFactor : 1);
    const f = [Math.sin(yr) * Math.cos(pr), -Math.sin(pr), Math.cos(yr) * Math.cos(pr)], r = [Math.cos(yr), 0, -Math.sin(yr)];
    const p = this.entity.pos;
    this.entity.pos = [p[0] + (f[0] * mz + r[0] * mx) * s, p[1] + (f[1] * mz + my) * s, p[2] + (f[2] * mz + r[2] * mx) * s];
    this.entity.rot = [this.pitch, this.yaw, 0];
  }
}
