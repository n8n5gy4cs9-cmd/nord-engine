// @nord {"id":"controller3d.third-person","title":"Third-person controller","category":"controllers","tier":["3d"],"tags":["third-person","orbit-camera","strafe"],"requires":["rigidbody","collider","camera"],"description":"Camera-relative movement with an orbiting follow camera (drag mouse to orbit). The character turns toward its movement direction. Needs a camera component with type 'orbit'."}
import { NordScript } from 'nord';

export default class ThirdPerson3D extends NordScript {
  static attributes = {
    speed: { type: 'number', default: 5, min: 0 },
    jumpSpeed: { type: 'number', default: 6.5, min: 0 },
    turnSpeed: { type: 'number', default: 12, min: 0 },
    sensitivity: { type: 'number', default: 0.3, min: 0 },
    lockPointer: { type: 'bool', default: false },
    cameraName: { type: 'string', default: 'Camera' },
  };
  start() {
    const c = this.scene.find(this.attrs.cameraName)?.getComponent('camera');
    this.cam = c?.camera; this.yawDeg = 0; this.#look();
    c?.follow?.(this.entity);
  }
  #look(on) {
    this.dx = 0; this.dy = 0;
    this.mm = (e) => { if (document.pointerLockElement || e.buttons) { this.dx += e.movementX; this.dy += e.movementY; } };
    this.click = () => { if (this.attrs.lockPointer) document.querySelector("canvas")?.requestPointerLock?.(); };
    window.addEventListener("mousemove", this.mm); window.addEventListener("pointerdown", this.click);
  }
  onDestroy() { window.removeEventListener("mousemove", this.mm); window.removeEventListener("pointerdown", this.click); }
  update() {
    if (this.cam?.alpha !== undefined) { this.cam.alpha -= this.dx * this.attrs.sensitivity * 0.02; this.cam.beta = Math.max(0.2, Math.min(1.5, this.cam.beta - this.dy * this.attrs.sensitivity * 0.02)); }
    this.dx = this.dy = 0;
  }
  fixedUpdate(dt) {
    const a = this.attrs, [mx, mz] = this.input.vec('left', 'right', 'down', 'up');
    const cy = this.cam?.alpha !== undefined ? -this.cam.alpha - Math.PI / 2 : 0; // camera yaw (rad)
    const sn = Math.sin(cy), cs = Math.cos(cy);
    const wx = (sn * mz + cs * mx), wz = (cs * mz - sn * mx);
    this.physics.setVelocity(this.entity, wx * a.speed, null, wz * a.speed);
    if (mx || mz) {
      const want = (Math.atan2(wx, wz) * 180) / Math.PI;
      const d = ((((want - this.yawDeg) % 360) + 540) % 360) - 180;
      this.yawDeg += d * Math.min(1, a.turnSpeed * dt); this.entity.rot = [0, this.yawDeg, 0];
    }
    if (this.input.pressed('jump') && this.physics.isGrounded(this.entity)) this.physics.setVelocity(this.entity, null, a.jumpSpeed, null);
  }
}
