// @nord {"id":"ui.game-over","title":"Game over / win screen","category":"ui","tier":["2d","3d"],"tags":["game-over","win","restart","game-ready"],"requires":["ui"],"description":"Shows a Game Over screen on the global 'game:over' (or the configured death event) and a You Win screen on 'game:win' (also 'wave:all-done'), with Restart. Shows the score if gameplay.score is present."}
import { NordScript } from 'nord';

export default class GameOver extends NordScript {
  static attributes = { loseEvent: { type: 'string', default: 'died' }, delay: { type: 'number', default: 0.8 }, winEvent: { type: 'string', default: 'game:win' } };
  start() { this.offs = [this.events.on(this.attrs.loseEvent, () => this.after(this.attrs.delay, () => this.show('Game Over'))), this.events.on('game:over', () => this.show('Game Over')), this.events.on(this.attrs.winEvent, () => this.show('You Win!')), this.events.on('wave:all-done', () => this.show('You Win!'))]; }
  onDestroy() { this.offs.forEach((o) => o()); }
  show(text) {
    const ui = this.ui; ui.clear('end'); ui.panel({ screen: 'end', x: 0, y: 0, style: { inset: 0, width: '100%', height: '100%', background: '#000b', border: 0, borderRadius: 0 } });
    ui.label(text, { screen: 'end', x: 0, y: 90, size: 56, style: { width: '100%', textAlign: 'center' } });
    const sc = this.scene.all && [...this.scene.all()].flatMap((e) => e.scripts).find((s) => 'score' in s && 'high' in s);
    if (sc) ui.label(`Score ${sc.score}   Best ${sc.high}`, { screen: 'end', x: 0, y: 170, size: 22, style: { width: '100%', textAlign: 'center' } });
    ui.menu('end', [{ text: 'Restart', onClick: () => { ui.hide('end'); this.game.restart(); } }], { x: 0, y: 220 }).el.style.cssText += ';left:50%;transform:translateX(-50%)';
    ui.show('end');
  }
}
