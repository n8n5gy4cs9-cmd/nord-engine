import { NordScript } from 'nord';

// A small side-scroller camera: follows the target horizontally with smoothing and stays inside the level.
export default class CameraFollow extends NordScript {
  static attributes = {
    target: { type: 'entity', default: 'Player' },
    smooth: { type: 'number', default: 6 },
    minX: { type: 'number', default: 480 },   // half a screen from the left edge of the level
    maxX: { type: 'number', default: 1920 },  // level width - half a screen
  };
  start() { this.t = this.scene.find(this.attrs.target); }
  lateUpdate(dt) {                              // after the player moved this frame
    if (!this.t || this.t.destroyed) return;
    const p = this.entity.pos, goal = Math.min(this.attrs.maxX, Math.max(this.attrs.minX, this.t.pos[0]));
    this.entity.pos = [p[0] + (goal - p[0]) * Math.min(1, this.attrs.smooth * dt), p[1], p[2]];
  }
}
