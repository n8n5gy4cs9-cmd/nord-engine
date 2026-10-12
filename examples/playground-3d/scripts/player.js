import { NordScript } from 'nord';

/** WASD / arrows move relative to the camera, Space jumps, Q/E orbit the camera. */
export default class Player extends NordScript {
  static attributes = {
    speed: { type: 'number', default: 6, min: 0, max: 20, label: 'Move speed' },
    jump: { type: 'number', default: 6.5, min: 0, max: 20, label: 'Jump speed' },
  };

  start() {
    this.coins = 0;
    this.spawn = [...this.entity.pos];
    this.hud = this.scene.find('Score');
  }

  fixedUpdate() {
    const yaw = ((this.game.camYaw ?? 0) * Math.PI) / 180;
    const fwd = this.input.axis('down', 'up'), side = this.input.axis('left', 'right');
    // camera looks along (sin yaw, cos yaw); right is (cos yaw, -sin yaw)
    const vx = (Math.sin(yaw) * fwd + Math.cos(yaw) * side) * this.attrs.speed;
    const vz = (Math.cos(yaw) * fwd - Math.sin(yaw) * side) * this.attrs.speed;
    this.physics.setVelocity(this.entity, vx, null, vz);
    if (this.input.pressed('jump') && this.physics.isGrounded(this.entity, 0.2)) {
      this.physics.setVelocity(this.entity, null, this.attrs.jump, null);
      this.audio.play('assets/audio/sfx/jump.wav');
    }
    if (this.entity.pos[1] < -8) { // fell off the world
      this.physics.teleport(this.entity, ...this.spawn);
      this.physics.setVelocity(this.entity, 0, 0, 0);
    }
  }

  onTriggerEnter(other) {
    if (!other.hasTag('coin')) return;
    this.coins++;
    this.audio.play('assets/audio/sfx/coin.wav');
    other.destroy();
    const left = this.scene.findByTag('coin').length;
    this.hud.set('uiLabel', 'text', left ? `Coins: ${this.coins}   (WASD move · Space jump · Q/E camera)` : `All ${this.coins} coins found! 🎉`);
  }
}
