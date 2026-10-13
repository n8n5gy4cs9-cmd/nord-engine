// UI toolkit: layers (own + clean up their Phaser objects), bevelled F2-style panels, buttons, pixel text.
import { PixelFont, PText } from './pixeltext.js';
export { PixelFont };
export const COL = { text: '#d8d4c4', dim: '#8a8678', orange: '#ffb64a', green: '#46e86a', dgreen: '#2a9a44', red: '#ff5a4a', amber: '#ffd25c', cyan: '#6ad8ff', white: '#ffffff', black: '#000000', pink: '#ff7ac8' };
export const FACE = 0x34302a, HI = 0x6e6a5e, LO = 0x14110d, DARK = 0x0c0a08, GLASS = 0x06100a;
const ASCII = { ä: 'a', ö: 'o', å: 'a', Ä: 'A', Ö: 'O', Å: 'A', '“': '"', '”': '"', '’': "'", '–': '-', '—': '-', '€': 'E', '…': '...' };
export const ascii = (s) => String(s).replace(/[äöåÄÖÅ“”’–—€…]/g, (c) => ASCII[c] ?? '?');

export class Layer {
  constructor(ps, font, depth = 1000) { this.ps = ps; this.font = font; this.depth = depth; this.objs = []; this.texts = []; this.n = 0; }
  _a(o, d = 0) { o.setScrollFactor?.(0); o.setDepth?.(this.depth + d + this.n++ * 0.0001); this.objs.push(o); return o; }
  rect(x, y, w, h, color, alpha = 1, d = 0) { return this._a(this.ps.add.rectangle(x, y, w, h, color, alpha).setOrigin(0), d); }
  /** F2-style bevelled slab. */
  bevel(x, y, w, h, { face = FACE, hi = HI, lo = LO, inset = false, alpha = 1, d = 0 } = {}) {
    if (inset) [hi, lo] = [lo, hi];
    this.rect(x, y, w, h, lo, alpha, d); this.rect(x, y, w - 1, h - 1, hi, alpha, d); return this.rect(x + 1, y + 1, w - 2, h - 2, face, alpha, d);
  }
  panel(x, y, w, h, title) {
    this.bevel(x, y, w, h, { face: 0x25211b }); this.rect(x + 3, y + 3, w - 6, h - 6, 0x1a1712).setAlpha(0.0); this.rect(x + 3, y + 3, w - 6, 1, HI, 0.5);
    if (title) { this.rect(x + 4, y + 4, w - 8, 12, 0x3a2a14); this.text(x + w / 2, y + 6, title, COL.orange, [0.5, 0]); }
  }
  text(x, y, str, color = COL.text, origin = [0, 0], d = 5, scale = 1) {
    const t = new PText(this.ps, this.font, { x, y, text: ascii(str), color, scale, origin, shadow: '#0a0806' }); t.setDepth(this.depth + d + this.n++ * 0.0001); t.img.setScrollFactor(0);
    this.texts.push(t); this.objs.push(t.img); return t;
  }
  img(key, frame, x, y, scale = 1, origin = [0, 0], d = 3) { const i = this.ps.add.image(x, y, key, frame).setOrigin(...origin).setScale(scale); return this._a(i, d); }
  zone(x, y, w, h, h2 = {}, d = 50) {
    const z = this.ps.add.zone(x, y, w, h).setOrigin(0).setInteractive({ useHandCursor: false }); this._a(z, d);
    if (h2.down) z.on('pointerdown', (p, lx, ly, ev) => { ev?.stopPropagation?.(); h2.down(p); });
    if (h2.over) z.on('pointerover', h2.over); if (h2.out) z.on('pointerout', h2.out); return z;
  }
  btn(x, y, w, h, label, cb, { color = COL.orange, face = FACE, hot = false, sound, d = 0 } = {}) {
    const base = this.bevel(x, y, w, h, { face, d }), t = this.text(x + w / 2, y + Math.floor((h - 8) / 2) + 1, label, color, [0.5, 0], 6 + d);
    const z = this.zone(x, y, w, h, { down: () => { this.ctx?.sfx(sound ?? 'click', 0.5); cb(); }, over: () => { base.setFillStyle(0x4a4538); t.setText(label, COL.white); }, out: () => { base.setFillStyle(face); t.setText(label, color); } });
    return { base, t, z };
  }
  destroy() { for (const t of this.texts) t.destroy(); for (const o of this.objs) o.destroy?.(); this.objs = []; this.texts = []; }
}
export const wrap = (str, cols) => {
  const out = []; for (const para of String(str).split('\n')) { let line = ''; for (const w of para.split(' ')) { if ((line + ' ' + w).trim().length > cols) { out.push(line); line = w; } else line = (line + ' ' + w).trim(); } out.push(line); } return out;
};
