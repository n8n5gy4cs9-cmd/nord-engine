// Shared view helpers for X-KOM 2026 and Red Front 2026 (Phaser scene access, pixel text, HUD container that stays fixed on screen while the world scrolls).
import { NordScript } from 'nord';
import { PixelFont, PText } from './pixeltext.js';

export const VW = 320, VH = 200, ZOOM = 3;
export const COL = { text: '#d8dcff', dim: '#8a8fb8', gold: '#ffd25c', good: '#70e870', bad: '#ff6a50', blue: '#6ac8ff', amber: '#ffb040', alien: '#b8f070', cyan: '#60e8ff' };
// X-COM (UFO Defense) menu palette: purple-blue bevelled panels, pale lavender text; battlescape HUD in grey-olive metal.
export const UI = { face: 0x5c5c92, hi: 0xa4a4dc, lo: 0x26264c, dark: 0x12102a, panel: 0x3a3864, metal: 0x6a6652, metalHi: 0xa09a80, metalLo: 0x2e2c22, accent: 0xe8a020 };
const shade = (c, k) => { const r = Math.max(0, Math.min(255, Math.round(((c >> 16) & 255) * k))), g = Math.max(0, Math.min(255, Math.round(((c >> 8) & 255) * k))), b = Math.max(0, Math.min(255, Math.round((c & 255) * k))); return (r << 16) | (g << 8) | b; };

/** Bevelled rectangle (light top/left edge, dark bottom/right edge) — the X-COM button look. setFillStyle(face) recolours it. */
export class Bevel {
  constructor(host, x, y, w, h, face = UI.face, { hud = true, depth = 0, raised = true, texture = true } = {}) {
    this.host = host; this.parts = []; this.raised = raised; const mk = (px, py, pw, ph) => { const r = host.ps.add.rectangle(px, py, pw, ph, 0, 1).setOrigin(0).setDepth(depth); if (hud) host.hud.add(r); this.parts.push(r); return r; };
    this.f = mk(x, y, w, h); this.t = mk(x, y, w, 1); this.l = mk(x, y, 1, h); this.b = mk(x, y + h - 1, w, 1); this.r = mk(x + w - 1, y, 1, h); this.setFillStyle(face);
    if (texture && host.compact && w > 4 && h > 4) {
      const grain = host.ps.add.tileSprite(x + 2, y + 2, w - 4, h - 4, 'xk-panel-grain').setOrigin(0).setDepth(depth).setAlpha(0.035);
      if (hud) host.hud.add(grain); this.parts.push(grain);
    }
  }
  setFillStyle(c) { const hi = shade(c, 1.55), lo = shade(c, 0.42); this.f.setFillStyle(c, 1); for (const p of [this.t, this.l]) p.setFillStyle(this.raised ? hi : lo, 1); for (const p of [this.b, this.r]) p.setFillStyle(this.raised ? lo : hi, 1); return this; }
  setVisible(v) { for (const p of this.parts) p.setVisible(v); return this; }
  destroy() { for (const p of this.parts) p.destroy(); this.parts = []; }
}

/** Text drawn with a vendored Google font (Pixelify Sans / Orbitron) rendered at screen resolution; same API as the bitmap PText so callers don't care. */
export class FText {
  constructor(ps, { x = 0, y = 0, text = '', color = '#fff', scale = 1, origin = [0, 0], compact = false } = {}) {
    const head = scale >= 2, size = compact ? Math.round((head ? 6 : 8) * scale) : head ? (scale >= 3 ? 8 : 6) * scale : 13 * scale;
    this.img = ps.add.text(x, y - (head ? 0 : 2), String(text), { fontFamily: `${head ? 'XKTitle' : 'XKUI'}, monospace`, fontSize: `${size}px`, color, fontStyle: head ? '900' : '400' }).setOrigin(...origin).setResolution(ZOOM);
    this.img.setShadow(1, 1, '#06040f', 0, false, true);
    this.o = { color };
  }
  setText(t, color) { this.img.setText(String(t)); if (color && color !== this.o.color) { this.o.color = color; this.img.setColor(color); } return this; }
  get width() { return this.img.width; }
  setPosition(x, y) { this.img.setPosition(x, y); return this; }
  setVisible(v) { this.img.setVisible(v); return this; } setAlpha(a) { this.img.setAlpha(a); return this; } setDepth(d) { this.img.setDepth(d); return this; }
  destroy() { this.img?.destroy(); this.img = null; }
}

export class XkBase extends NordScript {
  /** paths: { key: 'assets/..png' } – every .png is preloaded and its .meta.json read into this.meta[key]. */
  async initBase(paths) {
    const g = this.game, ps = this.ps = g.backend.scene; this.PATH = paths; this.meta = {}; this.compact = !!paths.world;
    if (this.compact && !ps.textures.exists('xk-panel-grain')) {
      const canvas = document.createElement('canvas'); canvas.width = canvas.height = 32; const ctx = canvas.getContext('2d');
      for (let y = 0; y < 32; y++) for (let x = 0; x < 32; x++) { const v = (x * 17 + y * 31 + x * y * 7) % 9; ctx.fillStyle = v < 3 ? '#000000' : v > 5 ? '#ffffff' : '#a6acb5'; ctx.fillRect(x, y, 1, 1); }
      ps.textures.addCanvas('xk-panel-grain', canvas).setFilter(globalThis.Phaser.Textures.FilterMode.NEAREST);
    }
    await g.preload(Object.values(paths).filter((p) => p.endsWith('.png')));
    for (const [k, p] of Object.entries(paths)) if (p.endsWith('.png') && k !== 'font') this.meta[k] = await g.loader.meta(p);
    this.font = new PixelFont(ps, paths.font); this.ttf = await this.loadFonts();
    this.cam = ps.cameras.main; this.cam.setViewport(0, 0, VW * ZOOM, VH * ZOOM).setZoom(ZOOM).setRoundPixels(true); 
    this.hud = ps.add.container(0, 0).setDepth(5000); this.camCenter(VW / 2, VH / 2);
    this.hudObjs = [];
  }
  /** load the vendored Google fonts (copied into assets/fonts/); falls back to the bitmap font if the browser refuses */
  async loadFonts() {
    try {
      const faces = [['XKUI', 'vt323-latin-400-normal.woff2', '400'], ['XKTitle', 'orbitron-latin-900-normal.woff2', '900']];
      for (const [fam, file, w] of faces) { const f = new FontFace(fam, `url(assets/fonts/${file})`, { weight: w }); await f.load(); document.fonts.add(f); }
      return true;
    } catch (e) { console.warn('[xk] fonts unavailable, using bitmap font', e); return false; }
  }
  panel(x, y, w, h, face = UI.face, o = {}) { return new Bevel(this, x, y, w, h, face, o); }
  // with zoom the camera scales around its middle, so HUD coordinates are (worldView.x + local) — keep the container glued to the view
  camCenter(x, y) { x = Math.round(x); y = Math.round(y); this.cam.centerOn(x, y); this.vx = x - VW / 2; this.vy = y - VH / 2; this.syncHud(); }
  panTo(x, y, duration = 220) { this.panTween?.stop(); const p = { x: this.vx + VW / 2, y: this.vy + VH / 2 }; this.panTween = this.ps.tweens.add({ targets: p, x, y, duration, ease: 'Sine.easeInOut', onUpdate: () => this.camCenter(p.x, p.y) }); }
  syncHud() { this.hud.setPosition(this.vx, this.vy); }
  /** screen pointer → [world x, world y, hud-local x, hud-local y] */
  ptr(p) { const k = ZOOM * (this.cam.width ? this.cam.width / (VW * ZOOM) : 1), lx = p.x / k, ly = p.y / k; return [this.vx + lx, this.vy + ly, lx, ly]; }
  // Edge bands belong to the map rectangle, never the sidebar/HUD or DOM overlays.
  edgeDirection(width, height, margin = 6) {
    const input = this.ps.input, p = input.mousePointer;
    if (!p || !input.manager.isOver || input.activePointer?.wasTouch) return [0, 0];
    const [, , x, y] = this.ptr(p);
    if (x < 0 || y < 0 || x >= width || y >= height) return [0, 0];
    return [x < margin ? -1 : x >= width - margin ? 1 : 0, y < margin ? -1 : y >= height - margin ? 1 : 0];
  }
  sfx(n, v = 0.5, r = 1) { this.game.audio.play(`assets/audio/sfx/${n}.wav`, { volume: v, rate: r }); }
  music(n, v = 0.25) { this.game.audio.music(`assets/audio/music/${n}.mp3`, { volume: v }); }
  wait(ms) { return new Promise((r) => this.ps.time.delayedCall(Math.max(1, ms), r)); }
  tw(cfg) { return new Promise((r) => this.ps.tweens.add({ ...cfg, onComplete: r })); }
  /** pixel text; inHud=true → child of the fixed HUD container (coordinates are screen-local) */
  text(x, y, str = '', color = COL.text, { scale = 1, origin = [0, 0], depth = 10, hud = false, bitmap = false } = {}) {
    const t = this.ttf && !bitmap ? new FText(this.ps, { x, y, text: str, color, scale, origin, compact: this.compact }) : new PText(this.ps, this.font, { x, y, text: str, color, scale, origin }); t.setDepth(depth); if (hud) this.hud.add(t.img); return t;
  }
  frameOf(sheet, name) { const m = this.meta[sheet]; return (m.tiles ?? m.frames)[name]; }
  img(sheet, frame, x, y, depth = 10, origin = [0, 0], hud = false) { const i = this.ps.add.image(x, y, this.PATH[sheet], frame).setOrigin(...origin).setDepth(depth); if (hud) this.hud.add(i); return i; }
  rect(x, y, w, h, color, alpha = 1, hud = true, depth = 0) { const r = this.ps.add.rectangle(x, y, w, h, color, alpha).setOrigin(0).setDepth(depth); if (hud) this.hud.add(r); return r; }
  /** big centred title / message card (screen space). returns a destroy() */
  card(lines, { w = 220, y = 40, color = 0x0c1424 } = {}) {
    const objs = []; const h = lines.reduce((n, l) => n + 12 + ((l[2] ?? 1) - 1) * 9, 0) + 10, x = (VW - w) / 2;
    objs.push(this.panel(x - 2, y - 2, w + 4, h + 4, UI.panel, { depth: 5 }), this.panel(x, y, w, h, color, { raised: false, depth: 5 }));
    let ly = y + 5; lines.forEach(([str, col, sc], i) => { objs.push(this.text(VW / 2, ly, str, col ?? COL.text, { origin: [0.5, 0], scale: sc ?? 1, hud: true, depth: 6 })); ly += 12 + ((sc ?? 1) - 1) * 9; void i; });
    return () => objs.forEach((o) => (o.destroy ? o.destroy() : null));
  }
  clearHud() { for (const o of this.hudObjs) o.destroy?.(); this.hudObjs = []; }
}
export { PText, PixelFont };
