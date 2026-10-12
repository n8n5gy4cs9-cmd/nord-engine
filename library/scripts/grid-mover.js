// @nord {"id":"controller.grid-mover","title":"Grid / tile mover","category":"controllers","tier":["2d"],"tags":["roguelike","grid","turn-based"],"description":"Moves one tile per key press with a short slide tween. Set 'blocked' tag on obstacles; emits 'step' on the global bus after each move."}
import { NordScript } from 'nord';

export default class GridMover extends NordScript {
  static attributes = {
    tile: { type: 'number', default: 16, min: 1, label: 'Tile size (px)' },
    stepTime: { type: 'number', default: 0.1, min: 0 },
    blockedTag: { type: 'string', default: 'solid' },
  };
  start() { this.moving = false; }
  update() {
    if (this.moving) return;
    const t = this.attrs.tile;
    for (const [a, dx, dy] of [['left', -1, 0], ['right', 1, 0], ['up', 0, -1], ['down', 0, 1]]) {
      if (!this.input.down(a)) continue;
      const [x, y, z] = this.entity.pos, nx = x + dx * t, ny = y + dy * t;
      const hit = (this.physics.overlapBox?.(nx, ny, t * 0.5, t * 0.5) ?? []).some?.((o) => o !== this.entity && o.hasTag(this.attrs.blockedTag));
      if (hit) return;
      this.moving = true;
      const p = { x, y };
      this.tween(p, { x: nx, y: ny }, { duration: this.attrs.stepTime, ease: 'linear', onUpdate: () => { this.entity.pos = [p.x, p.y, z]; }, onComplete: () => { this.moving = false; this.events.emit('step', { x: nx, y: ny }); } });
      return;
    }
  }
}
