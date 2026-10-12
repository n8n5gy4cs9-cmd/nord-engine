// @nord {"id":"procedural.day-night","title":"Day–night cycle","category":"procedural","tier":["2d","3d"],"tags":["day-night","lighting","time"],"description":"Advances a time-of-day clock (hours) and tints the scene: 2D overlays a colour wash on the UI layer; 3D rotates a named directional light and changes its intensity. Emits 'time:hour' each in-game hour and 'time:night'/'time:day'."}
import { NordScript } from 'nord';

const STOPS = [[0, [8, 12, 40, 0.65]], [5, [255, 140, 90, 0.35]], [8, [255, 255, 255, 0]], [17, [255, 255, 255, 0]], [19, [255, 110, 60, 0.35]], [21, [20, 25, 70, 0.55]], [24, [8, 12, 40, 0.65]]];

export default class DayNight extends NordScript {
  static attributes = { dayLength: { type: 'number', default: 120, min: 1, label: 'Real seconds per 24h' }, startHour: { type: 'number', default: 9, min: 0, max: 24 }, light: { type: 'string', default: 'Sun', label: '3D: directional light entity' }, overlay: { type: 'bool', default: true, label: '2D colour wash' } };
  start() {
    this.h = this.attrs.startHour; this.lastHour = Math.floor(this.h); this.night = null;
    if (this.attrs.overlay && this.game.project.type !== '3d') { this.wash = this.ui.panel({ screen: 'wash', x: 0, y: 0, style: { inset: '0', width: '100%', height: '100%', border: '0', borderRadius: '0', pointerEvents: 'none', mixBlendMode: 'multiply' } }); this.ui.show('wash'); }
    this.sun = this.scene.find(this.attrs.light);
  }
  onDestroy() { this.wash?.remove(); }
  update(dt) {
    this.h = (this.h + (dt * 24) / this.attrs.dayLength) % 24;
    const i = STOPS.findIndex((s, k) => this.h <= STOPS[k + 1]?.[0] ?? 24), [h0, c0] = STOPS[i], [h1, c1] = STOPS[i + 1], t = (this.h - h0) / (h1 - h0 || 1), c = c0.map((v, k) => v + (c1[k] - v) * t);
    if (this.wash) this.wash.el.style.background = `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${c[3]})`;
    if (this.sun) { this.sun.rot = [(this.h / 24) * 360 - 90, 30, 0]; this.sun.set('light', 'intensity', Math.max(0.05, 1 - c[3] * 1.4)); }
    const hr = Math.floor(this.h); if (hr !== this.lastHour) { this.lastHour = hr; this.events.emit('time:hour', hr); }
    const night = this.h < 6 || this.h >= 20; if (night !== this.night) { this.night = night; this.events.emit(night ? 'time:night' : 'time:day'); }
  }
}
