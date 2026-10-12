// @nord {"id":"fx.trail","title":"Trail / afterimage","category":"fx","tier":["2d"],"tags":["trail","afterimage","dash"],"description":"Leaves fading afterimage clones of the entity's sprite as it moves (spawns clones of its own data, fades them with a tween). Great for dashes."}
import { NordScript } from 'nord';

export default class Trail extends NordScript {
  static attributes = { interval: { type: 'number', default: 0.05, min: 0.01 }, life: { type: 'number', default: 0.3 }, startAlpha: { type: 'number', default: 0.5 }, onlyWhenMoving: { type: 'bool', default: true } };
  start() { this.t = 0; this.last = [...this.entity.pos]; }
  update(dt) {
    this.t += dt; if (this.t < this.attrs.interval) return; this.t = 0;
    const [x, y] = this.entity.pos; if (this.attrs.onlyWhenMoving && Math.hypot(x - this.last[0], y - this.last[1]) < 1) return; this.last = [x, y];
    const data = this.entity.toJSON(true); data.scripts = []; data.children = []; data.components = data.components.filter((c) => c.type === 'sprite' || c.type === 'animatedSprite'); data.tags = [];
    this.scene.spawnData(data, null).then((g) => { g.set(g.components[0]?.type, 'alpha', this.attrs.startAlpha); const o = { a: this.attrs.startAlpha }; this.scene.scheduler.tween(o, { a: 0 }, { duration: this.attrs.life, ease: 'linear', onUpdate: () => g.set(g.components[0]?.type, 'alpha', o.a), onComplete: () => g.destroy() }); });
  }
}
