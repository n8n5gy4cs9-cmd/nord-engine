import { NordScript } from 'nord';

export default class Hero extends NordScript {
  static attributes = {
    speed: { type: 'number', default: 120, min: 0, label: 'Speed (px/s)' },
    knockback: { type: 'number', default: 220, min: 0 },
    reach: { type: 'number', default: 34, min: 0, label: 'Sword reach (px)' },
    cooldown: { type: 'number', default: 0.35, min: 0, label: 'Seconds between swings' },
  };

  start() {
    this.sprite = this.entity.getComponent('animatedSprite');
    this.facing = [0, 1];
    this.kick = [0, 0];
    this.stun = 0;
    this.wait = 0;
    this.dead = false;
    this.entity.on('hurt', ({ from }) => {
      const dx = this.entity.pos[0] - from.pos[0], dy = this.entity.pos[1] - from.pos[1];
      const d = Math.hypot(dx, dy) || 1;
      this.kick = [dx / d * this.attrs.knockback, dy / d * this.attrs.knockback];
      this.stun = 0.15;
    });
    this.off = this.events.on('died', () => { this.dead = true; this.sprite.play('hurt'); });
  }

  fixedUpdate(dt) {
    if (this.dead) { this.physics.setVelocity(this.entity, 0, 0); return; }
    if (this.stun > 0) {
      this.stun -= dt;
      this.physics.setVelocity(this.entity, this.kick[0], this.kick[1]);
      return;
    }
    const [x, y] = this.input.vec('left', 'right', 'up', 'down');
    this.physics.setVelocity(this.entity, x * this.attrs.speed, y * this.attrs.speed);
    this.moving = x !== 0 || y !== 0;
    if (this.moving) {
      const len = Math.hypot(x, y);
      this.facing = [x / len, y / len];
      this.sprite.setFlip(x < 0);                                   // the art looks right; mirror it to look left
    }
  }

  update(dt) {
    if (this.dead) return;
    this.wait -= dt;
    const want = this.stun > 0 ? 'hurt' : this.moving ? 'walk' : 'idle';
    if (this.sprite.current !== want) this.sprite.play(want);       // only restart an animation when it changes
    if (this.wait <= 0 && this.input.pressed('attack')) this.swing();
  }

  swing() {
    this.wait = this.attrs.cooldown;
    this.audio.play('assets/audio/sfx/swing.wav', { volume: 0.7 });
    const [fx, fy] = this.facing, [hx, hy] = this.entity.pos;
    this.slash(hx + fx * 20, hy + fy * 20);
    for (const enemy of this.scene.findByTag('enemy')) {
      const dx = enemy.pos[0] - hx, dy = enemy.pos[1] - hy, d = Math.hypot(dx, dy);
      if (d < this.attrs.reach && (dx * fx + dy * fy) / (d || 1) > -0.1) enemy.emit('damage', { amount: 1, from: this.entity });   // in range and in front
    }
  }

  /** The white crescent: a translucent circle that grows and fades. */
  async slash(x, y) {
    const e = await this.scene.spawnData({
      name: 'Slash', tags: [], layer: 1, transform: { pos: [x, y, 6], rot: [0, 0, 0], scale: [1, 1, 1] },
      components: [{ type: 'sprite', texture: 'assets/sprites/circle.png', size: [24, 24], tint: '#fff2c9', alpha: 0.7 }], scripts: [], children: [],
    });
    const s = { k: 0.6, a: 0.7 };
    this.tween(s, { k: 1.5, a: 0 }, { duration: 0.18, onUpdate: () => { if (!e.destroyed) { e.scale = [s.k, s.k, 1]; e.native.setAlpha(s.a); } }, onComplete: () => e.destroy() });
  }

  onDestroy() { this.off?.(); }
}
