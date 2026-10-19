// Localisation + accessibility (M10-30).
//   project.strings: { "en": { "play": "Play", "hello": "Hi {name}" }, "fi": { … } }   or a path to such a JSON file ("strings.json")
//   game.i18n.t('hello', { name: 'Ada' })  ·  game.i18n.setLanguage('fi')  ·  event sheet: Localisation.Text("play")
// Missing key → falls back to project.defaultLanguage ("en"), then to the key itself (so gaps are visible, never blank).
export class I18n {
  constructor(game) { this.game = game; this.tables = {}; this.language = 'en'; this.fallback = 'en'; }
  /** Called by Game on boot: inline tables are used as-is; a string is fetched as JSON. */
  async init() {
    const p = this.game.project;
    this.fallback = p.defaultLanguage ?? 'en';
    const tables = typeof p.strings === 'string' ? await this.game.loadJSON(p.strings) : p.strings;
    if (tables) this.load(tables);
    const saved = this.game.save.get('__language', null);
    this.language = this.has(saved) ? saved : this.has(p.language) ? p.language : this.has(this.#browser()) ? this.#browser() : this.fallback;
  }
  #browser() { return String(globalThis.navigator?.language ?? '').split('-')[0]; }
  load(tables) { for (const [lang, t] of Object.entries(tables)) this.tables[lang] = { ...this.tables[lang], ...t }; }
  has(lang) { return !!lang && !!this.tables[lang]; }
  get languages() { return Object.keys(this.tables); }
  setLanguage(lang) {
    if (!this.has(lang)) { this.game.warn(`[nord] unknown language '${lang}'`); return false; }
    this.language = lang;
    this.game.save.set('__language', lang);
    this.game.events.emit('language', lang);
    return true;
  }
  t(key, vars = {}) {
    const s = this.tables[this.language]?.[key] ?? this.tables[this.fallback]?.[key] ?? key;
    return String(s).replace(/\{(\w+)\}/g, (m, k) => (k in vars ? vars[k] : m));
  }
}

// ---- accessibility: colour-blind preview, UI scale, reduced motion
// 3x3 simulation matrices (Machado et al. 2009, severity 1.0) applied through an SVG feColorMatrix filter on the stage.
export const COLORBLIND = {
  none: null,
  protanopia: [0.152286, 1.052583, -0.204868, 0.114503, 0.786281, 0.099216, -0.003882, -0.048116, 1.051998],
  deuteranopia: [0.367322, 0.860646, -0.227968, 0.280085, 0.672501, 0.047413, -0.011820, 0.042940, 0.968881],
  tritanopia: [1.255528, -0.076749, -0.178779, -0.078411, 0.930809, 0.147602, 0.004733, 0.691367, 0.303900],
  achromatopsia: [0.299, 0.587, 0.114, 0.299, 0.587, 0.114, 0.299, 0.587, 0.114],
};
export function colorMatrixValues(mode) {
  const m = COLORBLIND[mode];
  if (!m) return null;
  return `${m[0]} ${m[1]} ${m[2]} 0 0  ${m[3]} ${m[4]} ${m[5]} 0 0  ${m[6]} ${m[7]} ${m[8]} 0 0  0 0 0 1 0`;
}
export class Accessibility {
  constructor(game) { this.game = game; this.colorBlind = 'none'; this.uiScale = 1; this.el = null; }
  /** Element the filters/scale are applied to (the stage). Backends/boot set it. */
  attach(el) { this.el = el; this.#apply(); }
  setColorBlind(mode) {
    if (!(mode in COLORBLIND)) { this.game.warn(`[nord] unknown colour-blind mode '${mode}'`); return false; }
    this.colorBlind = mode; this.#apply(); return true;
  }
  setUiScale(s) { this.uiScale = Math.min(3, Math.max(0.5, Number(s) || 1)); this.#apply(); }
  #apply() {
    const el = this.el; if (!el) return;
    const doc = el.ownerDocument;
    let filter = '';
    const values = colorMatrixValues(this.colorBlind);
    if (values) {
      let svg = doc.getElementById('nord-cb-filter');
      if (!svg) {
        svg = doc.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.id = 'nord-cb-filter'; svg.setAttribute('width', '0'); svg.setAttribute('height', '0'); svg.style.position = 'absolute';
        svg.innerHTML = '<filter id="nord-cb" color-interpolation-filters="linearRGB"><feColorMatrix type="matrix" values=""/></filter>';
        doc.body.appendChild(svg);
      }
      svg.querySelector('feColorMatrix').setAttribute('values', values);
      filter = 'url(#nord-cb)';
    }
    el.style.filter = filter;
    el.style.setProperty('--nord-ui-scale', String(this.uiScale));
    this.game.ui?.setScale?.(this.uiScale);
  }
}
