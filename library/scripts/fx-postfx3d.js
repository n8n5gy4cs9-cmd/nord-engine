// @nord {"id":"fx.postfx-presets","title":"Post-FX presets (3D)","category":"fx","tier":["3d"],"tags":["bloom","vignette","tonemap","postprocess","crt"],"requires":["postProcess"],"description":"Switch the postProcess component between looks at runtime: 'clean', 'cinematic' (bloom+vignette+ACES), 'retro' (grain+chromatic aberration), 'dream' (heavy bloom). Events 'postfx:set' name."}
import { NordScript } from 'nord';

const LOOKS = { clean: { bloom: false, vignette: 0, grain: 0, chromaticAberration: 0, tonemap: false, contrast: 1, exposure: 1 }, cinematic: { bloom: true, bloomWeight: 0.35, vignette: 0.4, tonemap: true, contrast: 1.15, exposure: 1 }, retro: { grain: 12, chromaticAberration: 40, vignette: 0.3, contrast: 1.2, sharpen: 0.3 }, dream: { bloom: true, bloomThreshold: 0.4, bloomWeight: 0.9, exposure: 1.1, vignette: 0.2 } };

export default class PostFxPresets extends NordScript {
  static attributes = { look: { type: 'enum', options: Object.keys(LOOKS), default: 'cinematic' } };
  start() { this.set(this.attrs.look); this.off = this.events.on('postfx:set', (n) => this.set(n)); }
  onDestroy() { this.off?.(); }
  set(name) { const comp = this.entity.getComponent('postProcess') ?? this.scene.findByTag('postfx')[0]?.getComponent('postProcess'); if (!comp) return; for (const [k, v] of Object.entries({ ...LOOKS.clean, ...LOOKS[name] })) comp.impl.set(comp, k, v); }
}
