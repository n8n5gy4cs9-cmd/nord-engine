// @nord {"id":"util.gamepad-map","title":"Gamepad mapper & rebinding","category":"utilities","tier":["any"],"tags":["gamepad","input","rebind"],"description":"Adds gamepad buttons to actions at runtime and supports key rebinding: events 'input:rebind' {action} waits for the next key press and stores it in the save file. Reapplies saved bindings on start."}
import { NordScript } from 'nord';

export default class GamepadMap extends NordScript {
  static attributes = { map: { type: 'string', default: '{"jump":"Gamepad0","fire":"Gamepad2","pause":"Gamepad9"}', label: 'JSON action → gamepad code' } };
  start() {
    const acts = this.input.actions, add = (a, c) => { acts[a] ??= []; if (!acts[a].includes(c)) acts[a].push(c); };
    for (const [a, c] of Object.entries(JSON.parse(this.attrs.map))) add(a, c);
    for (const [a, codes] of Object.entries(this.save.get('bindings', {}))) acts[a] = codes;
    this.off = this.events.on('input:rebind', ({ action }) => this.#capture(action));
  }
  onDestroy() { this.off?.(); }
  #capture(action) {
    const h = (e) => { e.preventDefault(); window.removeEventListener('keydown', h, true); this.input.actions[action] = [e.code, ...this.input.actions[action].filter((c) => c.startsWith('Gamepad'))]; this.save.set('bindings', { ...this.save.get('bindings', {}), [action]: this.input.actions[action] }); this.events.emit('input:rebound', { action, code: e.code }); };
    window.addEventListener('keydown', h, true);
  }
}
