// (Copy of the Altimu pixel-text helper — shared Nord bitmap font renderer.) Bitmap text from the hand-drawn font sheet (assets/ui/font.png: 16 cols × 4 rows of 6×8 cells, ASCII 32..95, white glyphs).
// Renders into a canvas texture so it stays pixel-perfect; lower-case is shown as upper-case.
let uid = 0;
/** '[word]' markup → [[text, highlighted], …] */
export const split = (s) => { const out = []; let cur = '', on = false; for (const ch of String(s)) { if (ch === '[' ) { out.push([cur, on]); cur = ''; on = true; } else if (ch === ']') { out.push([cur, on]); cur = ''; on = false; } else cur += ch; } out.push([cur, on]); return out; };
export const plain = (s) => split(s).map((p) => p[0]).join('');
export class PixelFont {
  constructor(ps, key) {
    this.ps = ps; this.key = key; this.cw = 6; this.ch = 8;
    this.src = ps.textures.get(key).getSourceImage();
    this.cache = new Map();
  }
  width(str, scale = 1) { return Math.max(0, plain(str).length * this.cw - 1) * scale; }
  #mask(str) {
    const c = document.createElement('canvas'); c.width = Math.max(1, str.length * this.cw); c.height = this.ch;
    const g = c.getContext('2d'); g.imageSmoothingEnabled = false;
    [...str.toUpperCase()].forEach((ch, i) => {
      const code = ch.charCodeAt(0) - 32, idx = code >= 0 && code < 64 ? code : 31; // unknown → '?'
      g.drawImage(this.src, (idx % 16) * this.cw, Math.floor(idx / 16) * this.ch, this.cw, this.ch, i * this.cw, 0, this.cw, this.ch);
    });
    return c;
  }
  /** Draw `str` tinted `color` (+ optional 1px shadow) into a fresh canvas at integer `scale`. Words in [brackets] are drawn in `hi` (brackets not shown). */
  render(str, color = '#ffffff', scale = 1, shadow = '#0d0a14', hi = '#ffd25c') {
    const parts = split(str), total = parts.reduce((n, p) => n + p[0].length, 0), pad = shadow ? 1 : 0;
    const c = document.createElement('canvas'); c.width = (total * this.cw + pad) * scale; c.height = (this.ch + pad) * scale;
    const g = c.getContext('2d'); g.imageSmoothingEnabled = false;
    const tint = (m, col) => { const t = document.createElement('canvas'); t.width = m.width; t.height = m.height; const x = t.getContext('2d'); x.drawImage(m, 0, 0); x.globalCompositeOperation = 'source-in'; x.fillStyle = col; x.fillRect(0, 0, t.width, t.height); return t; };
    let at = 0;
    for (const [txt, bright] of parts) {
      if (!txt) continue;
      const m = this.#mask(txt), x0 = at * this.cw * scale;
      if (shadow) g.drawImage(tint(m, shadow), 0, 0, m.width, m.height, x0 + scale, scale, m.width * scale, m.height * scale);
      g.drawImage(tint(m, bright ? hi : color), 0, 0, m.width, m.height, x0, 0, m.width * scale, m.height * scale);
      at += txt.length;
    }
    return c;
  }
}

/** A Phaser Image that shows pixel text. `setText` re-renders only when something changed. */
export class PText {
  constructor(ps, font, { x = 0, y = 0, text = '', color = '#ffffff', scale = 2, shadow = '#0d0a14', origin = [0, 0], layer = null } = {}) {
    this.ps = ps; this.layer = layer; this.font = font; this.o = { text: null, color, scale, shadow }; this.key = `ptext:${uid++}`; this.origin = origin;
    this.img = null; this.x = x; this.y = y; this.setText(text);
  }
  setText(text, color) {
    text = String(text); color ??= this.o.color;
    if (text === this.o.text && color === this.o.color) return this;
    this.o.text = text; this.o.color = color;
    const c = this.font.render(text || ' ', color, this.o.scale, this.o.shadow);
    if (this.ps.textures.exists(this.key)) this.ps.textures.remove(this.key);
    this.ps.textures.addCanvas(this.key, c);
    if (!this.img) { this.img = this.ps.add.image(this.x, this.y, this.key).setOrigin(...this.origin); this.layer?.add?.(this.img); } else this.img.setTexture(this.key);
    this.img.setOrigin(...this.origin);
    return this;
  }
  get width() { return this.img?.width ?? 0; }
  setPosition(x, y) { this.x = x; this.y = y; this.img.setPosition(x, y); return this; }
  setVisible(v) { this.img.setVisible(v); return this; }
  setAlpha(a) { this.img.setAlpha(a); return this; }
  setDepth(d) { this.img.setDepth(d); return this; }
  destroy() { this.img?.destroy(); if (this.ps.textures.exists(this.key)) this.ps.textures.remove(this.key); this.img = null; }
}
