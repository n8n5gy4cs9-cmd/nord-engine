import { NordScript } from 'nord';
import { vertexSource, fragmentSource } from './prism-shaders.js';
export default class Prism extends NordScript {
  static attributes = {
    intensity: { type: 'number', default: 1.6, min: 0, max: 4 },
    frequency: { type: 'number', default: 8, min: 1, max: 32 },
  };
  start() {
    // Intentional Babylon escape hatch: Nord has no custom GLSL-material component.
    const backend = this.game.backend;
    this.material = new backend.B.ShaderMaterial('prism-relay', backend.scene,
      { vertexSource, fragmentSource }, {
        attributes: ['position', 'uv'],
        uniforms: ['worldViewProjection', 'uTime', 'uEnergy', 'uDanger', 'uIntensity', 'uFrequency'],
      });
    this.originals = [];
    for (const entity of this.scene.all()) {
      if (!/^Plat\d+$/.test(entity.name) && entity.name !== 'Start') continue;
      const mesh = entity.getComponent('mesh').mesh;
      this.originals.push([mesh, mesh.material]);
      mesh.material = this.material;
    }
    this.relay = this.scene.find('Player').scripts.find(s => 'energy' in s);
    this.ui.label('PRISM LAB: F = grid density | G = glow | Shift = sprint', {
      screen: 'prism', x: 12, y: 130, size: 16,
    });
    this.ui.show('prism');
  }
  update() {
    const r = this.relay, p = r.player.pos, h = r.hazard.pos;
    const distance = Math.hypot(...p.map((v, i) => v - h[i]));
    if (this.input.pressed('grid')) this.attrs.frequency = this.attrs.frequency === 8 ? 16 : 8;
    if (this.input.pressed('glow')) this.attrs.intensity = this.attrs.intensity === 1.6 ? 0.5 : 1.6;
    for (const [name, value] of Object.entries({
      uTime: r.elapsed, uEnergy: r.energy, uDanger: Math.max(0, 1 - distance / 6),
      uIntensity: this.attrs.intensity, uFrequency: this.attrs.frequency,
    })) this.material.setFloat(name, value);
  }
  onDestroy() {
    for (const [mesh, material] of this.originals ?? []) if (!mesh.isDisposed()) mesh.material = material;
    this.material?.dispose();
    this.ui.clear('prism');
  }
}
