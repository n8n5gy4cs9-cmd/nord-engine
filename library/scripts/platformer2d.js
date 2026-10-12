// @nord {"id":"controller.platformer2d","title":"Platformer 2D","category":"controllers","tier":["2d"],"tags":["platformer","jump","game-ready"],"requires":["rigidbody","collider"],"description":"Side-scroller controller: run, coyote time, jump buffer, variable jump height, wall slide/jump and dash. Needs actions left/right/jump (+ optional dash)."}
import { NordScript } from 'nord';

export default class Platformer2D extends NordScript {
  static attributes = {
    speed: { type: 'number', default: 180, min: 0, label: 'Run speed' },
    jumpForce: { type: 'number', default: 420, min: 0 },
    coyoteTime: { type: 'number', default: 0.1, min: 0, label: 'Coyote time (s)' },
    jumpBuffer: { type: 'number', default: 0.12, min: 0, label: 'Jump buffer (s)' },
    cutJump: { type: 'number', default: 0.5, min: 0, max: 1, label: 'Velocity kept when jump released early' },
    wallSlide: { type: 'bool', default: false },
    wallSlideSpeed: { type: 'number', default: 60, min: 0 },
    dash: { type: 'bool', default: false },
    dashSpeed: { type: 'number', default: 420, min: 0 },
    dashTime: { type: 'number', default: 0.14, min: 0 },
    dashCooldown: { type: 'number', default: 0.6, min: 0 },
  };

  start() {
    this.coyote = 0; this.buffer = 0; this.dashLeft = 0; this.dashCd = 0; this.facing = 1; this.jumping = false;
    this.sprite = this.entity.getComponent('animatedSprite') ?? this.entity.getComponent('sprite');
  }

  fixedUpdate(dt) {
    const a = this.attrs, p = this.physics, e = this.entity;
    const dir = this.input.axis('left', 'right');
    const grounded = p.isGrounded(e);
    const [, vy] = p.velocity(e);
    this.coyote = grounded ? a.coyoteTime : this.coyote - dt;
    this.buffer = this.input.pressed('jump') ? a.jumpBuffer : this.buffer - dt;
    this.dashCd -= dt;
    if (dir) { this.facing = dir; this.sprite?.setFlip?.(dir < 0); }

    if (a.dash && this.dashCd <= 0 && this.input.pressed('dash')) { this.dashLeft = a.dashTime; this.dashCd = a.dashCooldown; this.events.emit('dash', e); }
    if (this.dashLeft > 0) { this.dashLeft -= dt; p.setVelocity(e, this.facing * a.dashSpeed, 0); return; }

    p.setVelocity(e, dir * a.speed, null);
    if (this.buffer > 0 && this.coyote > 0) {
      p.setVelocity(e, null, -a.jumpForce); this.buffer = 0; this.coyote = 0; this.jumping = true; this.events.emit('jump', e);
    } else if (this.jumping && vy < 0 && !this.input.down('jump')) { p.setVelocity(e, null, vy * a.cutJump); this.jumping = false; }
    if (grounded) this.jumping = false;
    if (a.wallSlide && !grounded && dir && vy > a.wallSlideSpeed) {
      const w = p.overlapBox?.(e.pos[0] + dir * 10, e.pos[1], 4, 12)?.filter((o) => o !== e) ?? [];
      if (w.some?.((o) => o !== e && !o.getComponent?.('collider')?.data.trigger)) {
        p.setVelocity(e, null, a.wallSlideSpeed);
        if (this.input.pressed('jump')) { p.setVelocity(e, -dir * a.speed, -a.jumpForce); this.facing = -dir; }
      }
    }
  }
}
