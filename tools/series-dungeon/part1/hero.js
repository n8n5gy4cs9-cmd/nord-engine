import { NordScript } from 'nord';

export default class Hero extends NordScript {
  static attributes = {
    speed: { type: 'number', default: 160, min: 0, label: 'Speed (px/s)' },
  };

  update(dt) {
    const [x, y] = this.input.vec('left', 'right', 'up', 'down');   // each -1..1, diagonals already normalised
    const p = this.entity.pos;
    const s = this.attrs.speed * dt;                                // pixels to move this frame
    this.entity.pos = [
      Math.max(12, Math.min(628, p[0] + x * s)),                    // keep the 24 px hero on the 640 x 360 screen
      Math.max(12, Math.min(348, p[1] + y * s)),
      p[2],
    ];
  }
}
