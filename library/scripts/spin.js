// @nord {"id": "util.spin", "title": "Spin", "category": "utilities", "tier": ["2d", "3d"], "tags": ["rotate", "simple"], "description": "Rotates the entity continuously around one axis.", "requires": []}
// Spin — rotates the entity continuously. Works in 2D (z axis) and 3D (y axis).
import { NordScript } from 'nord';

export default class Spin extends NordScript {
  static attributes = {
    speed: { type: 'number', default: 90, label: 'Degrees / second' },
    axis: { type: 'enum', options: ['x', 'y', 'z'], default: 'z' },
  };

  update(dt) {
    const r = [...this.entity.rot];
    r[{ x: 0, y: 1, z: 2 }[this.attrs.axis]] += this.attrs.speed * dt;
    this.entity.rot = r;
  }
}
