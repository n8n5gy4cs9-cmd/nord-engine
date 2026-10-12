// @nord {"id":"ui.pause","title":"Pause menu","category":"ui","tier":["2d","3d"],"tags":["pause","menu","game-ready"],"requires":["ui"],"description":"Toggle pause with Escape: freezes game time, shows Resume / Restart / Settings buttons. Also pauses on tab blur."}
import { NordScript } from 'nord';

export default class PauseMenu extends NordScript {
  static attributes = { pauseOnBlur: { type: 'bool', default: true } };
  start() {
    const ui = this.ui; ui.clear('pause');
    ui.panel({ screen: 'pause', x: 0, y: 0, style: { inset: 0, width: '100%', height: '100%', background: '#000a', border: 0, borderRadius: 0 } });
    ui.label('Paused', { screen: 'pause', x: 0, y: 70, size: 44, style: { width: '100%', textAlign: 'center' } });
    ui.menu('pause', [{ text: 'Resume', onClick: () => this.set(false) }, { text: 'Restart', onClick: () => { this.set(false); this.game.restart(); } }, { text: 'Settings', onClick: () => { ui.hide('pause'); ui.show('settings'); } }], { x: 0, y: 140 }).el.style.cssText += ';left:50%;transform:translateX(-50%)';
    this.key = (e) => { if (e.code === 'Escape') this.set(!this.game.paused); }; window.addEventListener('keydown', this.key);
    if (this.attrs.pauseOnBlur) { this.blur = () => this.set(true); window.addEventListener('blur', this.blur); }
  }
  onDestroy() { window.removeEventListener('blur', this.blur); window.removeEventListener('keydown', this.key); this.ui.hide('pause'); }
  set(p) { p ? (this.game.pause(), this.ui.show('pause')) : (this.game.resume(), this.ui.hide('pause')); }
}
