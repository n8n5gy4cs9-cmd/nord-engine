// @nord {"id":"gameplay.wave-spawner","title":"Wave spawner","category":"gameplay","tier":["2d","3d"],"tags":["waves","enemies","spawner","game-ready"],"description":"Spawns waves of prefabs around/at this entity: wave n has count = base + n*growth. Waits for the wave to be cleared (or a timer), emits 'wave:start' {n}, 'wave:clear' and 'wave:all-done'."}
import { NordScript } from 'nord';

export default class WaveSpawner extends NordScript {
  static attributes = { prefabs: { type: 'array', default: [], label: 'Enemy prefab paths' }, base: { type: 'int', default: 3 }, growth: { type: 'int', default: 2 }, waves: { type: 'int', default: 5, min: 1 }, interval: { type: 'number', default: 0.6 }, pause: { type: 'number', default: 3 }, radius: { type: 'number', default: 0, label: 'Spawn ring radius (0 = at entity)' }, tag: { type: 'string', default: 'enemy' } };
  start() { this.n = 0; this.left = 0; this.state = 'pause'; this.t = 1; }
  update(dt) {
    const a = this.attrs;
    if (this.state === 'pause') { if ((this.t -= dt) <= 0) this.#begin(); }
    else if (this.state === 'wave' && this.left === 0 && !this.scene.findByTag(a.tag).length) {
      this.events.emit('wave:clear', this.n);
      if (this.n >= a.waves) { this.state = 'done'; this.events.emit('wave:all-done'); } else { this.state = 'pause'; this.t = a.pause; }
    }
  }
  #begin() {
    const a = this.attrs; this.n++; this.left = a.base + (this.n - 1) * a.growth; this.state = 'wave'; this.events.emit('wave:start', this.n);
    const go = () => { if (this.left <= 0) return; this.left--; this.#spawn(); this.after(a.interval, go); }; go();
  }
  #spawn() {
    const a = this.attrs, p = this.entity.worldPos, ang = this.rng.range(0, Math.PI * 2), pf = this.rng.pick(a.prefabs); if (!pf) return;
    const three = this.game.project.type === '3d', off = a.radius ? (three ? [Math.cos(ang) * a.radius, 0, Math.sin(ang) * a.radius] : [Math.cos(ang) * a.radius, Math.sin(ang) * a.radius, 0]) : [0, 0, 0];
    this.scene.spawn(pf, { pos: [p[0] + off[0], p[1] + off[1], p[2] + off[2]] }).then((e) => { if (!e.tags.includes(a.tag)) e.tags.push(a.tag); });
  }
}
