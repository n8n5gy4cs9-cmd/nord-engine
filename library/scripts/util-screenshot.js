// @nord {"id":"util.screenshot-recorder","title":"Screenshot & recorder","category":"utilities","tier":["any"],"tags":["screenshot","record","webm","capture"],"description":"F12 saves a PNG of the canvas; F10 starts/stops a WebM recording (MediaRecorder on canvas.captureStream) and downloads it."}
import { NordScript } from 'nord';

export default class Capture extends NordScript {
  static attributes = { shotKey: { type: 'string', default: 'F12' }, recKey: { type: 'string', default: 'F10' }, fps: { type: 'int', default: 30 } };
  start() { this.kd = (e) => { if (e.code === this.attrs.shotKey) this.shot(); else if (e.code === this.attrs.recKey) this.toggle(); }; window.addEventListener('keydown', this.kd); }
  onDestroy() { window.removeEventListener('keydown', this.kd); this.rec?.stop(); }
  #save(blob, name) { const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000); }
  shot() { document.querySelector('canvas')?.toBlob((b) => b && this.#save(b, `shot-${Date.now()}.png`)); }
  toggle() {
    if (this.rec) { this.rec.stop(); return; }
    const cv = document.querySelector('canvas'); if (!cv?.captureStream) return; const chunks = [];
    this.rec = new MediaRecorder(cv.captureStream(this.attrs.fps), { mimeType: 'video/webm' });
    this.rec.ondataavailable = (e) => chunks.push(e.data); this.rec.onstop = () => { this.#save(new Blob(chunks, { type: 'video/webm' }), `rec-${Date.now()}.webm`); this.rec = null; this.events.emit('toast', 'Recording saved'); };
    this.rec.start(); this.events.emit('toast', 'Recording…');
  }
}
