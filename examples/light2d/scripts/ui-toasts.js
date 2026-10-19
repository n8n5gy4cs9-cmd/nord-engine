// @nord {"id":"ui.toasts","title":"Toast notifications","category":"ui","tier":["2d","3d"],"tags":["toast","notification"],"requires":["ui"],"description":"Small slide-in messages. Emit the global event 'toast' with a string (or {text,color,time}). Also announces quest completion, level-ups and pickups when enabled."}
import { NordScript } from 'nord';

export default class Toasts extends NordScript {
  static attributes = { time: { type: 'number', default: 2.5 }, anchor: { type: 'enum', options: ['tl', 'tr', 'bl', 'br'], default: 'br' }, auto: { type: 'bool', default: true, label: 'Announce quests / level-ups' } };
  start() {
    this.box = this.ui.doc.createElement('div'); const [h, v] = { tl: ['left', 'top'], tr: ['right', 'top'], bl: ['left', 'bottom'], br: ['right', 'bottom'] }[this.attrs.anchor];
    this.box.style.cssText = `position:absolute;${h}:12px;${v}:12px;display:flex;flex-direction:column;gap:6px;pointer-events:none`; this.ui.screen('hud').appendChild(this.box);
    this.offs = [this.events.on('toast', (t) => this.toast(t))];
    if (this.attrs.auto) this.offs.push(this.events.on('quest:done', (q) => this.toast(`Quest complete: ${q.title}`)), this.events.on('levelup', (l) => this.toast(`Level ${l.level}!`)));
  }
  onDestroy() { this.offs.forEach((o) => o()); this.box.remove(); }
  toast(t) {
    const o = typeof t === 'string' ? { text: t } : t, el = this.ui.doc.createElement('div'); el.className = 'nord-panel'; el.textContent = o.text; el.style.cssText += `;opacity:0;transform:translateX(20px);transition:all .25s;${o.color ? `border-color:${o.color}` : ''}`; this.box.append(el);
    requestAnimationFrame(() => { el.style.opacity = 1; el.style.transform = 'none'; }); this.after(o.time ?? this.attrs.time, () => { el.style.opacity = 0; setTimeout(() => el.remove(), 300); });
  }
}
