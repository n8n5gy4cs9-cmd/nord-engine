// @nord {"id":"ui.loading","title":"Loading screen","category":"ui","tier":["2d","3d"],"tags":["loading","progress"],"requires":["ui"],"description":"Shows a title + progress bar while scenes load (events 'sceneUnload' → show, 'sceneLoad' → hide). Call events.emit('loading:progress', 0..1) from custom loaders."}
import { NordScript } from 'nord';

export default class Loading extends NordScript {
  static attributes = { text: { type: 'string', default: 'Loading…' }, minTime: { type: 'number', default: 0.3 } };
  start() {
    const ui = this.ui; ui.clear('loading'); ui.panel({ screen: 'loading', x: 0, y: 0, style: { inset: 0, width: '100%', height: '100%', border: 0, borderRadius: 0, background: 'var(--nord-bg,#2e3440)' } });
    ui.label(this.attrs.text, { screen: 'loading', x: 0, y: 140, size: 28, style: { width: '100%', textAlign: 'center' } }); this.bar = ui.bar(0, { screen: 'loading', x: 0, y: 190, w: 240, style: { left: '50%', marginLeft: '-120px' } });
    this.offs = [this.events.on('sceneUnload', () => { ui.show('loading'); this.bar.set(0.2); }), this.events.on('loading:progress', (p) => this.bar.set(p)), this.events.on('sceneLoad', () => { this.bar.set(1); setTimeout(() => ui.hide('loading'), this.attrs.minTime * 1000); })];
  }
  onDestroy() { this.offs?.forEach((o) => o()); }
}
