// @nord {"id":"fx.particle-presets","title":"Particle presets","category":"fx","tier":["2d"],"tags":["particles","fire","smoke","sparks","explosion","confetti"],"requires":["particles"],"description":"Applies a named preset (fire, smoke, sparks, explosion, rain, snow, magic, hit, dust, coin, confetti) to this entity's particles component by rebuilding it. Also export PRESETS to use with entity.addComponent('particles', PRESETS.fire)."}
import { NordScript } from 'nord';

const tex = 'assets/sprites/particle.png';
export const PRESETS = {
  fire: { texture: tex, lifespan: 700, speed: [20, 60], angle: [250, 290], scale: [1, 0], alpha: [0.9, 0], gravityY: -40, tint: '#ff8a3c', frequency: 30, blend: 'add' },
  smoke: { texture: tex, lifespan: 1600, speed: [10, 30], angle: [255, 285], scale: [0.5, 2], alpha: [0.4, 0], gravityY: -10, tint: '#8f98a8', frequency: 90, blend: 'normal' },
  sparks: { texture: tex, lifespan: 400, speed: [100, 260], angle: [0, 360], scale: [0.5, 0], alpha: [1, 0], gravityY: 400, tint: '#ffe08a', frequency: 20, blend: 'add' },
  explosion: { texture: tex, lifespan: 600, speed: [80, 320], angle: [0, 360], scale: [1.4, 0], alpha: [1, 0], tint: '#ff6a3c', burst: 40, blend: 'add' },
  rain: { texture: tex, lifespan: 900, speed: [380, 460], angle: [80, 85], scale: [0.3, 0.3], alpha: [0.6, 0.6], tint: '#a8c8ff', frequency: 12, blend: 'normal' },
  snow: { texture: tex, lifespan: 4000, speed: [20, 50], angle: [70, 110], scale: [0.4, 0.4], alpha: [0.9, 0.9], tint: '#ffffff', frequency: 60, blend: 'normal' },
  magic: { texture: tex, lifespan: 900, speed: [10, 50], angle: [0, 360], scale: [0.8, 0], alpha: [1, 0], gravityY: -30, tint: '#b48ead', frequency: 40, blend: 'add' },
  hit: { texture: tex, lifespan: 250, speed: [60, 180], angle: [0, 360], scale: [0.8, 0], alpha: [1, 0], tint: '#ffffff', burst: 10, blend: 'add' },
  dust: { texture: tex, lifespan: 500, speed: [10, 40], angle: [200, 340], scale: [0.5, 1.2], alpha: [0.5, 0], tint: '#c9b79c', burst: 6, blend: 'normal' },
  coin: { texture: tex, lifespan: 700, speed: [80, 200], angle: [230, 310], scale: [0.7, 0], alpha: [1, 0], gravityY: 500, tint: '#ebcb8b', burst: 12, blend: 'add' },
  confetti: { texture: tex, lifespan: 2000, speed: [120, 300], angle: [200, 340], scale: [0.7, 0.7], alpha: [1, 0], gravityY: 300, tint: '#a3be8c', burst: 60, blend: 'normal' },
};

export default class ParticlePreset extends NordScript {
  static attributes = { preset: { type: 'enum', options: Object.keys(PRESETS), default: 'sparks' }, texture: { type: 'asset', assetType: 'image', default: tex }, onEvent: { type: 'string', default: '', label: 'Global event that bursts it' } };
  start() {
    const old = this.entity.getComponent('particles'); if (old) { old.impl?.destroy?.(old); this.entity.components.splice(this.entity.components.indexOf(old), 1); }
    this.comp = this.entity.addComponent('particles', { ...PRESETS[this.attrs.preset], texture: this.attrs.texture });
    if (this.attrs.onEvent) this.off = this.events.on(this.attrs.onEvent, () => this.comp.burst?.());
  }
  onDestroy() { this.off?.(); }
}
