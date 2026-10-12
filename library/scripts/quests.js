// @nord {"id":"gameplay.quests","title":"Quest tracker","category":"gameplay","tier":["2d","3d"],"tags":["quests","objectives","game-ready"],"description":"Quest log driven by events: define quests as {id,title,goal:{event,count}}; each matching global event increments progress. Emits 'quest:update' and 'quest:done'. Persists to the save slot."}
import { NordScript } from 'nord';

export default class Quests extends NordScript {
  static attributes = { quests: { type: 'array', default: [], label: 'Quest definitions [{id,title,goal:{event,count}}]' }, saveKey: { type: 'string', default: 'quests' }, showHud: { type: 'bool', default: true } };
  start() {
    this.state = this.save.get(this.attrs.saveKey, {}); this.offs = [];
    for (const q of this.attrs.quests) {
      this.state[q.id] ??= { n: 0, done: false };
      this.offs.push(this.events.on(q.goal.event, (p) => { const s = this.state[q.id]; if (s.done) return; s.n += typeof p === 'number' ? p : 1; if (s.n >= q.goal.count) { s.done = true; this.events.emit('quest:done', q); } this.events.emit('quest:update', { quest: q, ...s }); this.#sync(); }));
    }
    if (this.attrs.showHud) this.hud = this.ui.label('', { screen: 'hud', x: 12, y: 40, size: 16 });
    this.#sync();
  }
  onDestroy() { this.offs?.forEach((o) => o()); this.hud?.remove(); }
  #sync() {
    this.save.set(this.attrs.saveKey, this.state);
    this.hud?.set(this.attrs.quests.map((q) => `${this.state[q.id].done ? '✔' : '•'} ${q.title}  ${Math.min(this.state[q.id].n, q.goal.count)}/${q.goal.count}`).join('\n'));
  }
}
