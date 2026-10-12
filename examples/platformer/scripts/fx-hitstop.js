// @nord {"id":"fx.hitstop-slowmo","title":"Hit-stop, slow-mo, flash","category":"fx","tier":["2d","3d"],"tags":["juice","hitstop","slowmo","flash"],"description":"Game-feel events: 'hitstop' (ms) freezes time briefly, 'slowmo' ({scale,time}) eases timeScale, 'flash' flashes the screen. Also reacts to the global 'hit' event with a tiny hit-stop."}
import { NordScript } from 'nord';

export default class Juice extends NordScript {
  static attributes = { hitStopOnHit: { type: 'number', default: 50, min: 0, label: 'ms of hit-stop on "hit"' }, flashColor: { type: 'color', default: '#ffffff' } };
  start() {
    this.offs = [this.events.on('hitstop', (ms) => this.stop(ms)), this.events.on('hit', () => this.attrs.hitStopOnHit && this.stop(this.attrs.hitStopOnHit)),
      this.events.on('slowmo', ({ scale = 0.3, time = 1 } = {}) => { this.game.timeScale = scale; setTimeout(() => { const o = { s: scale }; this.scene.scheduler.tween(o, { s: 1 }, { duration: 0.4, onUpdate: () => { this.game.timeScale = o.s; } }); }, time * 1000); }),
      this.events.on('flash', (ms = 120) => this.game.camera?.flash?.(ms, this.attrs.flashColor))];
  }
  onDestroy() { this.offs.forEach((o) => o()); this.game.timeScale = 1; }
  stop(ms) { const prev = this.game.timeScale || 1; if (this.frozen) return; this.frozen = true; this.game.timeScale = 0.0001; setTimeout(() => { this.game.timeScale = prev; this.frozen = false; }, ms); }
}
