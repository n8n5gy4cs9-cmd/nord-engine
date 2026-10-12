// @nord {"id":"procedural.fog-of-war","title":"Fog of war","category":"procedural","tier":["2d"],"tags":["fog","vision","roguelike"],"description":"Grid fog overlay drawn in a DOM canvas above the game: cells within the viewer's radius are revealed and stay dimly remembered. Viewer = entity with this script; exposes revealed[][] for minimaps/saves."}
import { NordScript } from 'nord';

export default class FogOfWar extends NordScript {
  static attributes = { tile: { type: 'number', default: 16 }, grid: { type: 'vec2', default: [40, 23] }, radius: { type: 'int', default: 6, min: 1 }, memory: { type: 'number', default: 0.55, min: 0, max: 1 }, camera: { type: 'vec2', default: [0, 0], label: 'World position at the top-left of the view' } };
  start() {
    const [w, h] = this.attrs.grid, t = this.attrs.tile;
    this.revealed = Array.from({ length: h }, () => Array(w).fill(false));
    this.cv = this.ui.doc.createElement('canvas'); this.cv.width = w * t; this.cv.height = h * t;
    Object.assign(this.cv.style, { position: 'absolute', left: 0, top: 0, width: '100%', height: '100%', pointerEvents: 'none', imageRendering: 'pixelated' });
    this.ui.screen('fog').appendChild(this.cv); this.ui.show('fog'); this.ctx = this.cv.getContext('2d'); this.last = '';
  }
  onDestroy() { this.cv?.remove(); }
  update() {
    const a = this.attrs, t = a.tile, cx = Math.floor((this.entity.pos[0] - a.camera[0]) / t), cy = Math.floor((this.entity.pos[1] - a.camera[1]) / t); if (`${cx},${cy}` === this.last) return; this.last = `${cx},${cy}`;
    const [w, h] = a.grid, r = a.radius;
    for (let y = Math.max(0, cy - r); y <= Math.min(h - 1, cy + r); y++) for (let x = Math.max(0, cx - r); x <= Math.min(w - 1, cx + r); x++) if ((x - cx) ** 2 + (y - cy) ** 2 <= r * r) this.revealed[y][x] = true;
    const c = this.ctx; c.clearRect(0, 0, w * t, h * t);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const vis = (x - cx) ** 2 + (y - cy) ** 2 <= r * r;
      if (!vis) { c.fillStyle = this.revealed[y][x] ? `rgba(0,0,0,${a.memory})` : '#000'; c.fillRect(x * t, y * t, t, t); }
    }
  }
}
