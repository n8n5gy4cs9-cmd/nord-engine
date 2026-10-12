// @nord {"id":"util.i18n","title":"Localisation (JSON)","category":"utilities","tier":["any"],"tags":["i18n","language","text"],"description":"Loads a JSON file per language ({\"key\": \"text {name}\"}) and updates every uiLabel/text component with a 'i18nKey' data field. Switch with events.emit('lang:set','de'). Remembers the choice."}
import { NordScript } from 'nord';

export default class I18n extends NordScript {
  static attributes = { folder: { type: 'string', default: 'assets/lang' }, languages: { type: 'array', default: ['en'] }, fallback: { type: 'string', default: 'en' } };
  async start() { this.lang = this.save.get('lang', this.attrs.fallback); this.dict = {}; await this.load(this.lang); this.off = this.events.on('lang:set', (l) => this.load(l)); }
  onDestroy() { this.off?.(); }
  async load(lang) { this.dict = await this.game.loadJSON(`${this.attrs.folder}/${lang}.json`).catch(() => ({})); this.lang = lang; this.save.set('lang', lang); this.apply(); this.events.emit('lang:changed', lang); }
  t(key, vars = {}) { return (this.dict[key] ?? key).replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? `{${k}}`); }
  apply() { for (const e of this.scene.all()) for (const c of e.components) if (c.data.i18nKey) e.set(c.type, 'text', this.t(c.data.i18nKey)); }
}
