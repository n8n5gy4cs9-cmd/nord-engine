// @nord {"id":"controller3d.fps","title":"FPS controller","category":"controllers","tier":["3d"],"tags":["fps","first-person","mouse-look"],"requires":["rigidbody","collider"],"description":"First-person: WASD (left/right/up/down actions), mouse look (click for pointer lock), jump, sprint, crouch and head-bob. Put a camera entity as a child of this entity (at eye height) — it is pitched by this script."}
import { NordScript } from 'nord';

export default class FPS3D extends NordScript {
  static attributes = {
    speed: { type: 'number', default: 5, min: 0 },
    sprintFactor: { type: 'number', default: 1.7, min: 1 },
    crouchFactor: { type: 'number', default: 0.5, min: 0, max: 1 },
    jumpSpeed: { type: 'number', default: 6, min: 0 },
    sensitivity: { type: 'number', default: 0.12, min: 0, label: 'Mouse deg/px' },
    bob: { type: 'number', default: 0.04, min: 0, label: 'Head-bob amplitude (m)' },
    eyeHeight: { type: 'number', default: 0.7, label: 'Camera local y' },
    lockPointer: { type: 'bool', default: true },
    cameraName: { type: 'string', default: 'Camera' },
  };
  start() { this.yaw = this.entity.rot[1]; this.pitch = 0; this.bobT = 0; this.cam = this.entity.find(this.attrs.cameraName); this.#look(); }
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
    this.entity.rot = [0, this.yaw, 0];
    const [mx, mz] = this.input.vec('left', 'right', 'down', 'up');
    const moving = mx || mz;
    if (this.cam) {
      this.bobT += moving ? dt * 9 : 0;
      this.cam.pos = [0, a.eyeHeight * (this.input.down('crouch') ? 0.6 : 1) + (moving ? Math.sin(this.bobT) * a.bob : 0), 0];
      this.cam.rot = [this.pitch, 0, 0];
    }
  }
  fixedUpdate() {
    const a = this.attrs, [mx, mz] = this.input.vec('left', 'right', 'down', 'up');
    const s = a.speed * (this.input.down('sprint') ? a.sprintFactor : 1) * (this.input.down('crouch') ? a.crouchFactor : 1);
    const r = (this.yaw * Math.PI) / 180, sn = Math.sin(r), cs = Math.cos(r);
    this.physics.setVelocity(this.entity, (sn * mz + cs * mx) * s, null, (cs * mz - sn * mx) * s);
    if (this.input.pressed('jump') && this.physics.isGrounded(this.entity)) this.physics.setVelocity(this.entity, null, a.jumpSpeed, null);
  }
}
