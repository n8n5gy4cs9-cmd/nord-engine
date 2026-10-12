// @nord {"id":"fx.crt-overlay","title":"CRT / scanline overlay","category":"fx","tier":["2d","3d"],"tags":["crt","scanlines","retro","css"],"description":"Pure-CSS CRT look on the UI layer: scanlines, vignette and subtle flicker, with no shader dependency (works on both runtimes). Toggle with events 'crt:toggle'."}
import { NordScript } from 'nord';

export default class CrtOverlay extends NordScript {
  static attributes = { scanlines: { type: 'number', default: 0.18, min: 0, max: 1 }, vignette: { type: 'number', default: 0.45, min: 0, max: 1 }, flicker: { type: 'bool', default: true } };
  start() {
    const a = this.attrs; this.p = this.ui.panel({ screen: 'crt', x: 0, y: 0, style: { inset: 0, width: '100%', height: '100%', border: 0, borderRadius: 0, padding: 0, pointerEvents: 'none', boxShadow: 'none', background: `repeating-linear-gradient(0deg,rgba(0,0,0,${a.scanlines}) 0 1px,transparent 1px 3px), radial-gradient(ellipse at center,transparent 55%,rgba(0,0,0,${a.vignette}) 100%)` } }); this.ui.show('crt');
    if (a.flicker) this.p.el.animate([{ opacity: 0.96 }, { opacity: 1 }, { opacity: 0.98 }], { duration: 120, iterations: Infinity });
    this.off = this.events.on('crt:toggle', () => this.ui.toggle('crt'));
  }
  onDestroy() { this.p?.remove(); this.off?.(); }
}
