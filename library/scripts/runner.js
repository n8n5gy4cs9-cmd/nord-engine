// @nord {"id":"controller.runner","title":"Auto-runner","category":"controllers","tier":["2d"],"tags":["runner","endless","jump"],"requires":["rigidbody"],"description":"Side-scroll auto-runner: runs right at increasing speed, jump (and optional slide) actions. Emits 'dead' on the global bus when hitting something tagged 'hazard'."}
import { NordScript } from 'nord';

export default class Runner extends NordScript {
  static attributes = {
    speed: { type: 'number', default: 160, min: 0 },
    speedGain: { type: 'number', default: 4, min: 0, label: 'Speed gained per second' },
    maxSpeed: { type: 'number', default: 420, min: 0 },
    jumpForce: { type: 'number', default: 440, min: 0 },
    doubleJump: { type: 'bool', default: false },
  };
  start() { this.s = this.attrs.speed; this.jumps = 0; this.dead = false; this.dist = 0; }
  fixedUpdate(dt) {
    if (this.dead) return;
    this.s = Math.min(this.attrs.maxSpeed, this.s + this.attrs.speedGain * dt);
    this.dist += this.s * dt;
    this.physics.setVelocity(this.entity, this.s, null);
    if (this.physics.isGrounded(this.entity)) this.jumps = 0;
    if (this.input.pressed('jump') && (this.jumps === 0 || (this.attrs.doubleJump && this.jumps === 1))) {
      this.physics.setVelocity(this.entity, null, -this.attrs.jumpForce); this.jumps++;
    }
    this.events.emit('distance', Math.floor(this.dist / 10));
  }
  onCollisionEnter(o) { if (o.hasTag('hazard') && !this.dead) { this.dead = true; this.physics.setVelocity(this.entity, 0, null); this.events.emit('dead', { distance: Math.floor(this.dist / 10) }); } }
  onTriggerEnter(o) { this.onCollisionEnter(o); }
}
