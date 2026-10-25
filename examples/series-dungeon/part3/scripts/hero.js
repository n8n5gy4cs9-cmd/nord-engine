import { NordScript } from 'nord';

export default class Hero extends NordScript {
  static attributes = {
    speed: { type: 'number', default: 160, min: 0, label: 'Speed (px/s)' },
  };

  fixedUpdate() {
    const [x, y] = this.input.vec('left', 'right', 'up', 'down');
    this.physics.setVelocity(this.entity, x * this.attrs.speed, y * this.attrs.speed);   // the physics engine moves us and stops us at walls
  }
}
