import { NordScript } from 'nord';
// records its lifecycle into window.__log so the smoke test can check the order
export default class Probe extends NordScript {
  static attributes = { speed: { type: 'number', default: 1, min: 0, max: 10 }, label: { type: 'string', default: 'x' }, flag: { type: 'bool', default: false } };
  init() { (window.__log ??= []).push('init'); }
  start() { window.__log.push('start'); }
  onEnable() { window.__log.push('onEnable'); }
  update(dt) { this.u = (this.u ?? 0) + 1; }
  fixedUpdate() { this.f = (this.f ?? 0) + 1; }
  lateUpdate() { this.l = (this.l ?? 0) + 1; }
  onDisable() { window.__log.push('onDisable'); }
  onDestroy() { window.__log.push('onDestroy'); }
  damage(n) { this.last = n; return n; }
}
