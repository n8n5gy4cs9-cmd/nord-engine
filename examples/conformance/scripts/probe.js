import { NordScript } from 'nord';
// Exercises backend-independent services and publishes results for the e2e conformance test.
export default class Probe extends NordScript {
  start() {
    const r = this.result = { tweenDone: false, afterFired: false, everyCount: 0, eventSeen: false, saveOk: false, pathOk: false, spawnedMax: 0, labelOk: false };
    window.__conf = r;
    this.label = this.scene.find('Hud').getComponent('uiLabel').h;
    const box = { v: 0 };
    this.tween(box, { v: 10 }, { duration: 0.4, ease: 'linear', onComplete: () => { r.tweenDone = box.v === 10; } });
    this.after(0.2, () => { r.afterFired = true; });
    this.every(0.25, () => { r.everyCount++; });
    this.events.on('ping', (d) => { r.eventSeen = d === 42; });
    this.events.emit('ping', 42);
    this.save.slot(9).set('k', { a: 1 });
    r.saveOk = this.save.slot(9).get('k')?.a === 1;
  }
  update() {
    const r = this.result, m = this.scene.find('Mover'), sp = this.scene.find('Spawner').getComponent('spawner');
    r.spawnedMax = Math.max(r.spawnedMax, sp.live.size);
    const p = this.scene.find('Path').getComponent('path').at(m.scripts[0].s);
    r.pathOk = Math.abs(p[0] - m.scripts[0].lastPath[0]) < 1e-6;
    this.label.set(`t=${this.time.elapsed.toFixed(1)} orbs=${sp.live.size}`);
    r.labelOk = this.label.el.textContent.startsWith('t=');
  }
}
