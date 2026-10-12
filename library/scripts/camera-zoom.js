// @nord {"id":"camera.zoom","title":"Camera zoom (wheel / actions)","category":"camera","tier":["2d"],"tags":["camera","zoom"],"description":"Zoom the 2D camera with the 'zoomIn'/'zoomOut' actions, smoothly, within limits."}
import { NordScript } from 'nord';

export default class CameraZoom extends NordScript {
  static attributes = { min: { type: 'number', default: 0.5, min: 0.05 }, max: { type: 'number', default: 3 }, speed: { type: 'number', default: 1.2 }, start: { type: 'number', default: 1 } };
  start() { this.z = this.attrs.start; this.game.camera.zoom(this.z); }
  update(dt) {
    const d = this.input.axis('zoomOut', 'zoomIn');
    if (!d) return;
    this.z = Math.max(this.attrs.min, Math.min(this.attrs.max, this.z * (1 + d * this.attrs.speed * dt)));
    this.game.camera.zoom(this.z);
  }
}
