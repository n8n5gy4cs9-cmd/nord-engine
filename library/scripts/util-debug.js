// @nord {"id":"util.debug-overlay","title":"Debug overlay & console","category":"utilities","tier":["any"],"tags":["debug","fps","console","cheats"],"description":"F3 (or backquote) toggles an FPS/entity-count overlay; backquote opens a tiny cheat console: type `emit eventName [json]`, `tp x y`, `timescale 0.5`, `scene path`. Add your own via commands."}
import { NordScript } from 'nord';

export default class DebugOverlay extends NordScript {
  static attributes = { startVisible: { type: 'bool', default: false }, key: { type: 'string', default: 'F3' } };
  start() {
    this.fps = 0; this.acc = 0; this.n = 0; this.label = this.ui.label('', { screen: 'debug', x: 8, y: 8, size: 13, style: { fontFamily: 'monospace', background: '#0008', padding: '4px 6px' } }); this.ui.screen('debug'); this.on = this.attrs.startVisible; this.ui.screen('debug').classList.toggle('show', this.on);
    this.commands = { emit: ([n, ...j]) => this.events.emit(n, j.length ? JSON.parse(j.join(' ')) : undefined), tp: ([x, y]) => { const p = this.scene.findByTag('player')[0]; if (p) p.pos = [+x, +y, p.pos[2]]; }, timescale: ([v]) => { this.game.timeScale = +v; }, scene: ([p]) => this.game.loadScene(p) };
    this.kd = (e) => { if (e.code === this.attrs.key) { this.on = !this.on; this.ui.screen('debug').classList.toggle('show', this.on); } else if (e.code === 'Backquote') this.#console(); };
    window.addEventListener('keydown', this.kd);
  }
  onDestroy() { window.removeEventListener('keydown', this.kd); this.label?.remove(); }
  update(dt) { this.acc += dt; this.n++; if (this.acc >= 0.5) { this.fps = Math.round(this.n / this.acc); this.acc = this.n = 0; if (this.on) this.label.set(`${this.fps} fps\nentities ${[...this.scene.all()].length}\nt ${this.game.time.elapsed.toFixed(1)}s`); } }
  #console() {
    const line = prompt('console >'); if (!line) return; const [cmd, ...args] = line.trim().split(/\s+/);
    try { (this.commands[cmd] ?? (() => console.warn('unknown command', cmd)))(args); } catch (e) { console.error(e); }
  }
}
