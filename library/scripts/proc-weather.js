// @nord {"id":"procedural.weather","title":"Weather (rain / snow)","category":"procedural","tier":["2d"],"tags":["weather","rain","snow","particles"],"description":"Full-screen rain or snow drawn on a DOM canvas overlay (no assets needed). Intensity can be changed live (set 'weather:set' event: {type, intensity}); lightning flash optional for rain."}
import { NordScript } from 'nord';

export default class Weather extends NordScript {
  static attributes = { type: { type: 'enum', options: ['none', 'rain', 'snow'], default: 'rain' }, intensity: { type: 'number', default: 0.6, min: 0, max: 1 }, wind: { type: 'number', default: 40 }, lightning: { type: 'bool', default: false } };
  start() {
    this.cv = this.ui.doc.createElement('canvas'); this.cv.width = 640; this.cv.height = 360; Object.assign(this.cv.style, { position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' });
    this.ui.screen('weather').appendChild(this.cv); this.ui.show('weather'); this.c = this.cv.getContext('2d'); this.p = []; this.flash = 0;
    this.off = this.events.on('weather:set', (o) => Object.assign(this.attrs, o));
  }
  onDestroy() { this.cv?.remove(); this.off?.(); }
  update(dt) {
    const a = this.attrs, c = this.c, W = this.cv.width, H = this.cv.height, want = a.type === 'none' ? 0 : Math.floor(a.intensity * (a.type === 'rain' ? 300 : 160));
    while (this.p.length < want) this.p.push({ x: this.rng.range(-50, W + 50), y: this.rng.range(-H, 0), v: a.type === 'rain' ? this.rng.range(500, 800) : this.rng.range(30, 90), s: this.rng.range(1, 2.5) });
    this.p.length = Math.min(this.p.length, want);
    c.clearRect(0, 0, W, H);
    c.strokeStyle = 'rgba(170,200,255,.55)'; c.fillStyle = 'rgba(255,255,255,.85)';
    for (const q of this.p) {
      q.y += q.v * dt; q.x += (a.type === 'rain' ? a.wind : a.wind * 0.3 + Math.sin(q.y * 0.03) * 12) * dt;
      if (q.y > H) { q.y = -10; q.x = this.rng.range(-50, W + 50); }
      if (a.type === 'rain') { c.beginPath(); c.moveTo(q.x, q.y); c.lineTo(q.x + a.wind * 0.02, q.y + 9); c.stroke(); } else c.fillRect(q.x, q.y, q.s, q.s);
    }
    if (a.lightning && a.type === 'rain' && this.rng.chance(0.002 * a.intensity)) this.flash = 0.35;
    if (this.flash > 0) { c.fillStyle = `rgba(255,255,255,${this.flash})`; c.fillRect(0, 0, W, H); this.flash -= dt * 1.2; }
  }
}
