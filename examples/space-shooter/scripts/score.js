// @nord {"id":"gameplay.score","title":"Score, combo & high score","category":"gameplay","tier":["2d","3d"],"tags":["score","combo","highscore","hud","game-ready"],"requires":["ui"],"description":"Score counter with a combo multiplier that decays, persistent high score and a HUD label. Add points via the global event 'score' (number) or addScore(n)."}
import { NordScript } from 'nord';

export default class Score extends NordScript {
  static attributes = { comboWindow: { type: 'number', default: 2, min: 0 }, maxCombo: { type: 'int', default: 8, min: 1 }, hud: { type: 'bool', default: true }, x: { type: 'number', default: 12 }, y: { type: 'number', default: 8 }, saveKey: { type: 'string', default: 'highscore' } };
  start() {
    this.score = 0; this.combo = 1; this.t = 0; this.high = this.save.get(this.attrs.saveKey, 0);
    this.off = this.events.on('score', (n) => this.addScore(typeof n === 'number' ? n : 1));
    this.label = this.attrs.hud ? this.ui.label('', { screen: 'hud', x: this.attrs.x, y: this.attrs.y, size: 22 }) : null; this.#draw();
  }
  onDestroy() { this.off?.(); this.label?.remove(); }
  addScore(n) {
    this.score += n * this.combo; this.combo = Math.min(this.attrs.maxCombo, this.combo + 1); this.t = this.attrs.comboWindow;
    if (this.score > this.high) { this.high = this.score; this.save.set(this.attrs.saveKey, this.high); }
    this.events.emit('score:changed', { score: this.score, combo: this.combo, high: this.high }); this.#draw();
  }
  update(dt) { if (this.t > 0 && (this.t -= dt) <= 0) { this.combo = 1; this.#draw(); } }
  #draw() { this.label?.set(`Score ${this.score}${this.combo > 1 ? `  x${this.combo}` : ''}   Best ${this.high}`); }
}
