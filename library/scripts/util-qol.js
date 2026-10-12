// @nord {"id":"util.stats-pause","title":"Pause on blur, fullscreen key, local stats","category":"utilities","tier":["any"],"tags":["blur","fullscreen","stats","telemetry"],"description":"Quality-of-life bundle: pauses audio+game when the tab loses focus, F toggles fullscreen, and counts local-only play stats (sessions, play time, deaths) into the save file. No network."}
import { NordScript } from 'nord';

export default class QoL extends NordScript {
  static attributes = { pauseOnBlur: { type: 'bool', default: true }, fullscreenKey: { type: 'string', default: 'KeyF' }, stats: { type: 'bool', default: true } };
  start() {
    this.t = 0; if (this.attrs.stats) { const s = this.save.get('stats', { sessions: 0, seconds: 0, deaths: 0 }); s.sessions++; this.save.set('stats', s); this.off = this.events.on('died', () => { const q = this.save.get('stats'); q.deaths++; this.save.set('stats', q); }); }
    this.blur = () => this.attrs.pauseOnBlur && this.game.pause(); this.focus = () => this.attrs.pauseOnBlur && this.game.resume();
    this.kd = (e) => { if (e.code === this.attrs.fullscreenKey && !e.repeat && !e.ctrlKey && !e.metaKey) document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen?.(); };
    window.addEventListener('blur', this.blur); window.addEventListener('focus', this.focus); window.addEventListener('keydown', this.kd);
  }
  onDestroy() { window.removeEventListener('blur', this.blur); window.removeEventListener('focus', this.focus); window.removeEventListener('keydown', this.kd); this.off?.(); }
  update(dt) { if (!this.attrs.stats || (this.t += dt) < 10) return; this.t = 0; const s = this.save.get('stats'); s.seconds += 10; this.save.set('stats', s); }
}
