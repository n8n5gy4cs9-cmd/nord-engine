// UI toolkit: layers (own + clean up their Phaser objects), bevelled F2-style panels, buttons, pixel text.
import { PixelFont, PText } from './pixeltext.js';
export { PixelFont };
export const COL = { text: '#c8c7ad', dim: '#999b83', orange: '#c7ad66', green: '#88ca65', dgreen: '#48773c', red: '#d96a4b', amber: '#dfc982', cyan: '#8faeab', white: '#e8e9cf', black: '#000000', pink: '#bb8a9f' };
export const FACE = 0x434338, HI = 0x8b8c73, LO = 0x151911, DARK = 0x0b0e0a, GLASS = 0x0a140c;
const ASCII = { ä: 'a', ö: 'o', å: 'a', Ä: 'A', Ö: 'O', Å: 'A', '“': '"', '”': '"', '’': "'", '–': '-', '—': '-', '€': 'E', '…': '...' };
export const ascii = (s) => String(s).replace(/[äöåÄÖÅ“”’–—€…]/g, (c) => ASCII[c] ?? '?');

export class Layer {
  constructor(ps, font, depth = 1000) { this.ps = ps; this.font = font; this.depth = depth; this.objs = []; this.texts = []; this.n = 0; }
  _a(o, d = 0) { o.setScrollFactor?.(0); o.setDepth?.(this.depth + d + this.n++ * 0.0001); this.objs.push(o); return o; }
  rect(x, y, w, h, color, alpha = 1, d = 0) { return this._a(this.ps.add.rectangle(x, y, w, h, color, alpha).setOrigin(0), d); }
  metal(x, y, w, h, d = 0, alpha = 1) {
    return this._a(this.ps.add.tileSprite(x, y, w, h, this.ctx.K.metal).setOrigin(0).setAlpha(alpha), d);
  }
  rivet(x, y, d = 2) { return this.img(this.ctx.K.ui, 13, x, y, 1, [0.5, 0.5], d); }
  hazard(x, y, w, d = 2) {
    const g = this.ps.add.graphics(); g.fillStyle(0x988044).fillRect(x, y, w, 5);
    g.fillStyle(0x20251b); for (let i = 0; i < w - 5; i += 10) g.fillTriangle(x + i, y, x + i + 5, y, x + i + 5, y + 5);
    return this._a(g, d);
  }
  /** F2-style bevelled slab. */
  bevel(x, y, w, h, { face = FACE, hi = HI, lo = LO, inset = false, alpha = 1, d = 0 } = {}) {
    if (inset) [hi, lo] = [lo, hi];
    this.rect(x, y, w, h, lo, alpha, d); this.rect(x, y, w - 1, h - 1, hi, alpha, d);
    const base = this.rect(x + 1, y + 1, w - 2, h - 2, face, alpha, d);
    if (this.ctx?.K.metal) {
      if (inset) {
        this.rect(x + 2, y + 2, w - 4, 1, 0x000000, 0.6, d);
        this.rect(x + 2, y + h - 3, w - 4, 1, 0x65764e, 0.3, d);
        const g = this.ps.add.graphics(); g.lineStyle(1, 0x000000, 0.13);
        for (let yy = y + 4; yy < y + h - 2; yy += 3) g.lineBetween(x + 2, yy, x + w - 3, yy);
        this._a(g, d);
      } else this.metal(x + 2, y + 2, w - 4, h - 4, d, 0.52);
    }
    return base;
  }
  panel(x, y, w, h, title) {
    this.bevel(x, y, w, h, { face: 0x30352a });
    this.rect(x + 3, y + 3, w - 6, 1, HI, 0.5);
    for (const xx of [x + 6, x + w - 7]) for (const yy of [y + 6, y + h - 7]) this.rivet(xx, yy);
    if (title) {
      this.bevel(x + 13, y + 4, w - 26, 13, { inset: true, face: 0x171f14 });
      this.text(x + w / 2, y + 7, title, COL.orange, [0.5, 0]);
    }
  }
  text(x, y, str, color = COL.text, origin = [0, 0], d = 5, scale = 1) {
    const t = new PText(this.ps, this.font, { x, y, text: ascii(str), color, scale, origin, shadow: '#0a0806' }); t.setDepth(this.depth + d + this.n++ * 0.0001); t.img.setScrollFactor(0);
    this.texts.push(t); this.objs.push(t.img); return t;
  }
  paragraph(x, y, w, h, str, color = COL.text) {
    const lines = Array.from({ length: Math.floor(h / 10) }, (_, i) => this.text(x, y + i * 10, '', color));
    const p = { setText: (value, tint = color) => { const parts = wrap(ascii(value), Math.floor(w / 6)); lines.forEach((t, i) => t.setText(parts[i] ?? '', tint)); return p; } };
    return p.setText(str);
  }
  img(key, frame, x, y, scale = 1, origin = [0, 0], d = 3) { const i = this.ps.add.image(x, y, key, frame).setOrigin(...origin).setScale(scale); return this._a(i, d); }
  zone(x, y, w, h, h2 = {}, d = 50) {
    const z = this.ps.add.zone(x, y, w, h).setOrigin(0).setInteractive({ useHandCursor: false }); this._a(z, d);
    if (h2.down) z.on('pointerdown', (p, lx, ly, ev) => { ev?.stopPropagation?.(); h2.down(p); });
    if (h2.over) z.on('pointerover', h2.over); if (h2.out) z.on('pointerout', h2.out); return z;
  }
  btn(x, y, w, h, label, cb, { color = COL.orange, face = FACE, hot = false, sound, d = 0 } = {}) {
    const base = this.bevel(x, y, w, h, { face, d }), t = this.text(x + w / 2, y + Math.floor((h - 8) / 2) + 1, label, color, [0.5, 0], 6 + d);
    const lamp = w >= 78 ? this.img(this.ctx.K.ui, 10, x + 10, y + h / 2, 0.65, [0.5, 0.5], 4 + d) : null;
    const z = this.zone(x, y, w, h, { down: () => { this.ctx?.sfx(sound ?? 'click', 0.5); cb(); }, over: () => { base.setFillStyle(0x5b5b45); lamp?.setFrame(9); t.setText(label, COL.white); }, out: () => { base.setFillStyle(face); lamp?.setFrame(10); t.setText(label, color); } });
    return { base, t, z };
  }
  destroy() { for (const t of this.texts) t.destroy(); for (const o of this.objs) o.destroy?.(); this.objs = []; this.texts = []; }
}
export const wrap = (str, cols) => {
  const out = []; for (const para of String(str).split('\n')) { let line = ''; for (const w of para.split(' ')) { if ((line + ' ' + w).trim().length > cols) { out.push(line); line = w; } else line = (line + ' ' + w).trim(); } out.push(line); } return out;
};
