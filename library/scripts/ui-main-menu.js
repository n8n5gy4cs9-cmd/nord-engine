// @nord {"id":"ui.main-menu","title":"Main menu","category":"ui","tier":["2d","3d"],"tags":["menu","title","game-ready"],"requires":["ui"],"description":"Title screen with Play / Settings / Quit-to-title buttons. Play loads a scene (default: restart). Uses the project's UI theme. Pairs with ui.settings."}
import { NordScript } from 'nord';

export default class MainMenu extends NordScript {
  static attributes = { title: { type: 'string', default: 'My Game' }, playScene: { type: 'asset', assetType: 'json', default: '' }, subtitle: { type: 'string', default: 'Press Play' }, pauseGame: { type: 'bool', default: true } };
  start() {
    const ui = this.ui; ui.clear('menu');
    ui.label(this.attrs.title, { screen: 'menu', x: 0, y: 60, size: 56, style: { width: '100%', textAlign: 'center' } });
    ui.label(this.attrs.subtitle, { screen: 'menu', x: 0, y: 130, size: 18, style: { width: '100%', textAlign: 'center', opacity: 0.7 } });
    ui.menu('menu', [{ text: 'Play', onClick: () => this.play() }, { text: 'Settings', onClick: () => { ui.hide('menu'); ui.show('settings'); } }], { x: 0, y: 190, gap: 10 }).el.style.cssText += ';left:50%;transform:translateX(-50%)';
    ui.show('menu'); if (this.attrs.pauseGame) this.game.pause();
    this.off = this.events.on('menu:show', () => { ui.show('menu'); if (this.attrs.pauseGame) this.game.pause(); });
  }
  onDestroy() { this.off?.(); this.ui.hide('menu'); }
  play() { this.ui.hide('menu'); this.game.resume(); if (this.attrs.playScene) this.game.loadScene(this.attrs.playScene); this.events.emit('game:play'); }
}
