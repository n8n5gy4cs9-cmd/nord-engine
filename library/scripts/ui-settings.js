// @nord {"id":"ui.settings","title":"Settings screen","category":"ui","tier":["2d","3d"],"tags":["settings","volume","fullscreen","game-ready"],"requires":["ui"],"description":"Volume sliders (master/music/sfx), fullscreen toggle and a back button. Values persist in the save store. Open with ui.show('settings')."}
import { NordScript } from 'nord';

export default class Settings extends NordScript {
  static attributes = { back: { type: 'string', default: 'menu', label: 'Screen to return to' } };
  start() {
    const ui = this.ui, d = ui.doc; ui.clear('settings');
    ui.panel({ screen: 'settings', x: 0, y: 0, style: { inset: 0, width: '100%', height: '100%', background: '#000c', border: 0, borderRadius: 0 } });
    ui.label('Settings', { screen: 'settings', x: 0, y: 40, size: 40, style: { width: '100%', textAlign: 'center' } });
    const box = d.createElement('div'); box.style.cssText = 'position:absolute;left:50%;top:120px;transform:translateX(-50%);display:flex;flex-direction:column;gap:14px;pointer-events:auto;min-width:260px'; ui.screen('settings').appendChild(box);
    for (const bus of ['master', 'music', 'sfx']) {
      const row = d.createElement('label'); row.style.cssText = 'display:flex;justify-content:space-between;gap:12px;font-size:18px'; row.textContent = bus[0].toUpperCase() + bus.slice(1);
      const r = d.createElement('input'); r.type = 'range'; r.min = 0; r.max = 1; r.step = 0.05; r.value = this.save.get(`vol.${bus}`, 1);
      r.oninput = () => { this.audio.volume(bus, +r.value); this.save.set(`vol.${bus}`, +r.value); }; this.audio.volume(bus, +r.value); row.append(r); box.append(row);
    }
    const b = ui.button('Fullscreen', () => (document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen?.()), { screen: 'settings' }); b.el.classList.remove('nord-el'); box.append(b.el);
    const back = ui.button('Back', () => { ui.hide('settings'); ui.show(this.attrs.back); }, { screen: 'settings' }); back.el.classList.remove('nord-el'); box.append(back.el);
  }
}
