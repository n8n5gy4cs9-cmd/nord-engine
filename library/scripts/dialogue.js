// @nord {"id":"gameplay.dialogue","title":"Dialogue (branching, typewriter)","category":"gameplay","tier":["2d","3d"],"tags":["dialogue","story","ui","game-ready"],"requires":["ui"],"description":"Branching dialogue from a JSON asset ({start, nodes:{id:{speaker,text,next|choices:[{text,next}]}}}). Typewriter text in a DOM box, choices as buttons, 'interact' advances. Start with start() or the global event 'dialogue:start' (payload = node id)."}
import { NordScript } from 'nord';

export default class Dialogue extends NordScript {
  static attributes = { file: { type: 'asset', assetType: 'json', default: '' }, speed: { type: 'number', default: 45, min: 1, label: 'Characters / second' }, autostart: { type: 'bool', default: false } };
  async start() {
    this.data = this.attrs.file ? await this.game.loadJSON(this.attrs.file) : null;
    this.off = this.events.on('dialogue:start', (id) => this.begin(id));
    if (this.attrs.autostart) this.begin();
  }
  onDestroy() { this.off?.(); this.#close(); }
  begin(id = this.data?.start) { if (!this.data) return; this.node = id; this.#show(); }
  #show() {
    this.#close();
    const n = this.data.nodes[this.node]; if (!n) return this.#end();
    this.box = this.ui.panel({ screen: 'dialogue', x: 40, y: 24, anchor: 'bl', style: { right: '40px', minHeight: '110px' } });
    const title = this.ui.label(n.speaker ?? '', { screen: 'dialogue', size: 18, color: 'var(--nord-accent,#88c0d0)' }), txt = this.ui.label('', { screen: 'dialogue', size: 20 });
    this.box.el.append(title.el, txt.el); [title.el, txt.el].forEach((e) => { e.classList.remove('nord-el'); e.style.position = 'static'; e.style.whiteSpace = 'pre-wrap'; });
    this.ui.show('dialogue');
    let i = 0; this.full = n.text; this.typing = true;
    this.cancel = this.every(1 / this.attrs.speed, () => { txt.set(this.full.slice(0, ++i)); if (i >= this.full.length) { this.cancel(); this.typing = false; this.#choices(n); } });
    this.txt = txt; this.n = n;
  }
  #choices(n) {
    if (!n.choices) return;
    for (const c of n.choices) { const b = this.ui.button(c.text, () => { this.events.emit('dialogue:choice', c); this.node = c.next; this.#show(); }, { screen: 'dialogue' }); b.el.classList.remove('nord-el'); b.el.style.cssText += ';display:block;margin-top:6px'; this.box.el.append(b.el); }
  }
  update() {
    if (!this.n || !this.input.pressed('interact')) return;
    if (this.typing) { this.cancel(); this.txt.set(this.full); this.typing = false; this.#choices(this.n); }
    else if (!this.n.choices) { this.node = this.n.next; this.#show(); }
  }
  #end() { this.n = null; this.#close(); this.ui.hide('dialogue'); this.events.emit('dialogue:end'); }
  #close() { this.cancel?.(); this.ui.clear('dialogue'); }
}
