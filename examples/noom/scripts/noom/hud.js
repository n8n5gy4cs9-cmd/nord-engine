// Noom HUD: a transparent 2D canvas laid over the 3D view, drawn at a fixed virtual height (180 px) and scaled up with nearest-neighbour filtering:
// weapon sprite, status bar (ammo / health / face / armor / keys), message line, crosshair, automap, title / pause / death / exit screens.
import { W, H } from './sim.js';

export const VH = 180;
export class Hud {
  /** imgs: { hud, weapons, font, props } HTMLImageElements; meta: parsed .meta.json */
  constructor(canvas, imgs, meta) {
    this.c = canvas; this.g = canvas.getContext('2d'); this.imgs = imgs; this.meta = meta; this.tintCache = new Map();
    this.msgs = []; this.faceTimer = 0; this.vw = 320;
  }
  resize() { const r = this.c.getBoundingClientRect(); const aspect = r.width / Math.max(1, r.height); this.vw = Math.round(VH * aspect); this.c.width = this.vw; this.c.height = VH; this.g.imageSmoothingEnabled = false; }
  message(text) { this.msgs.push({ text, t: 4 }); if (this.msgs.length > 4) this.msgs.shift(); }
  rect(name) { return this.meta.hud.rects[name]; }
  draw(name, x, y) { const r = this.rect(name); this.g.drawImage(this.imgs.hud, r[0], r[1], r[2], r[3], Math.round(x), Math.round(y), r[2], r[3]); return r; }
  /** pixel text from the hand-drawn font sheet, tinted */
  text(str, x, y, color = '#ffffff', scale = 1, shadow = true) {
    const key = color; let t = this.tintCache.get(key);
    if (!t) { t = document.createElement('canvas'); t.width = this.imgs.font.width; t.height = this.imgs.font.height; const c = t.getContext('2d'); c.drawImage(this.imgs.font, 0, 0); c.globalCompositeOperation = 'source-in'; c.fillStyle = color; c.fillRect(0, 0, t.width, t.height); this.tintCache.set(key, t); }
    if (shadow && color !== '#0a080c') this.text(str, x + 1, y + 1, '#0a080c', scale, false);
    [...String(str).toUpperCase()].forEach((ch, i) => { const code = ch.charCodeAt(0) - 32, idx = code >= 0 && code < 64 ? code : 31; this.g.drawImage(t, (idx % 16) * 6, Math.floor(idx / 16) * 8, 6, 8, Math.round(x + i * 6 * scale), Math.round(y), 6 * scale, 8 * scale); });
  }
  textW(str, scale = 1) { return String(str).length * 6 * scale - scale; }
  center(str, y, color, scale = 1) { this.text(str, Math.round((this.vw - this.textW(str, scale)) / 2), y, color, scale); }
  number(n, right, y, pct = false) {
    const s = String(Math.max(0, Math.floor(n))) + (pct ? '%' : ''); let x = right - s.length * 9;
    for (const ch of s) { this.draw(ch === '%' ? 'dpct' : `d${ch}`, x, y); x += 9; }
  }

  frame(sim, o) {
    const g = this.g, p = sim.player, vw = this.vw;
    g.clearRect(0, 0, vw, VH);
    if (o.state === 'title') return this.title(o);
    // screen tints
    if (p.hurt > 0) { g.fillStyle = `rgba(210,20,20,${Math.min(0.55, p.hurt * 0.6)})`; g.fillRect(0, 0, vw, VH); }
    if (p.grin > 0) { g.fillStyle = `rgba(240,230,120,${Math.min(0.18, p.grin * 0.2)})`; g.fillRect(0, 0, vw, VH); }
    if (p.flash > 0) { g.fillStyle = `rgba(255,200,100,${p.flash * 1.4})`; g.fillRect(0, 0, vw, VH); }
    // weapon
    if (!p.dead) {
      const wm = this.meta.weapons, fi = wm.frames.indexOf(p.wframe), fw = wm.frameWidth;
      const bobx = Math.sin(p.bob) * 5 * Math.min(1, p.moving), boby = Math.abs(Math.cos(p.bob)) * 3 * Math.min(1, p.moving);
      g.drawImage(this.imgs.weapons, fi * fw, 0, fw, fw, Math.round(vw / 2 - fw / 2 + bobx + 14), Math.round(VH - 32 - fw + 14 + boby + p.wy * 60), fw, fw);
    }
    // crosshair
    if (!p.dead && o.state === 'play') this.draw('crosshair', vw / 2 - 2, (VH - 32) / 2 - 2);
    this.status(sim);
    // messages
    this.msgs.forEach((m, i) => { this.text(m.text, 4, 4 + i * 9, '#f4e3a0'); });
    if (o.automap) this.automap(sim);
    if (o.state === 'dead') { this.center('YOU DIED', 40, '#ff4a3a', 3); this.center('CLICK OR PRESS R TO TRY AGAIN', 72, '#ffd36a'); }
    if (o.state === 'pause') { g.fillStyle = 'rgba(8,6,12,0.6)'; g.fillRect(0, 0, vw, VH); this.center('PAUSED', 60, '#ffffff', 3); this.center('CLICK TO RESUME', 92, '#ffd36a'); }
    if (o.state === 'exit') this.intermission(sim, o);
    if (o.boss) { const b = o.boss, w = 120, x = (vw - w) / 2; g.fillStyle = '#0a080c'; g.fillRect(x - 1, 14, w + 2, 7); g.fillStyle = '#3a1218'; g.fillRect(x, 15, w, 5); g.fillStyle = '#d4402e'; g.fillRect(x, 15, Math.round(w * b.hp / b.def.hp), 5); this.center(b.def.name.toUpperCase(), 5, '#ff9a7a'); }
  }
  status(sim) {
    const g = this.g, p = sim.player, vw = this.vw, y0 = VH - 32, x0 = Math.round((vw - 320) / 2);
    for (let x = 0; x < vw; x += 16) for (let y = 0; y < 32; y += 16) this.draw('plate', x, y0 + y);
    const box = (bx) => this.draw('box', x0 + bx, y0 + 3);
    box(4); box(62); box(204); box(262); this.draw('faceFrame', x0 + 144, y0 + 1);
    const lab = (s, bx) => this.text(s, x0 + bx + 3, y0 + 5, '#9a96b8', 1, false);
    lab('SHELLS', 4); lab('HEALTH', 62); lab('ARMOR', 204); lab('KEYS', 262);
    this.number(p.cur === 'gun' ? p.ammo : p.ammo, x0 + 4 + 52, y0 + 16);
    this.number(p.hp, x0 + 62 + 52, y0 + 16, true); this.number(p.armor, x0 + 204 + 52, y0 + 16, true);
    if (p.keys.blue) { const r = this.meta.props.rects.key; g.drawImage(this.imgs.props, r[0], r[1], r[2], r[3], x0 + 262 + 20, y0 + 12, r[2], r[3]); }
    // face: wound level by health, ouch when hit, dead, grin on pickup
    let f = p.hp > 80 ? 0 : p.hp > 60 ? 1 : p.hp > 40 ? 2 : p.hp > 20 ? 3 : 4;
    if (p.dead) f = 5; else if (p.hurt > 0.5) f = 6;
    this.draw(`face${f}`, x0 + 148, y0 + 3);
  }
  automap(sim) {
    const g = this.g, vw = this.vw, sc = Math.min((vw - 20) / W, (VH - 40) / H), ox = (vw - W * sc) / 2, oy = 6;
    g.fillStyle = 'rgba(6,4,10,0.82)'; g.fillRect(0, 0, vw, VH - 32);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const i = y * W + x; if (!sim.seen[i]) continue;
      const d = sim.doors.get(i);
      g.fillStyle = d ? (d.t === 'K' ? '#4a8aff' : d.t === 'X' ? '#c060ff' : '#c08a3a') : sim.solid[i] ? '#9a6a3a' : '#2a2638';
      g.fillRect(ox + x * sc, oy + y * sc, sc + 0.3, sc + 0.3);
    }
    const p = sim.player; g.fillStyle = '#ffffff'; g.fillRect(ox + p.x * sc - 1.5, oy + p.y * sc - 1.5, 3, 3);
    g.strokeStyle = '#ffffff'; g.beginPath(); g.moveTo(ox + p.x * sc, oy + p.y * sc); g.lineTo(ox + (p.x + Math.cos(p.a) * 1.8) * sc, oy + (p.y + Math.sin(p.a) * 1.8) * sc); g.stroke();
    this.center('AUTOMAP - TAB', VH - 44, '#ffd36a');
  }
  title(o) {
    const g = this.g, vw = this.vw;
    g.fillStyle = 'rgba(6,4,10,0.78)'; g.fillRect(0, 0, vw, VH);
    this.center('NOOM', 24, '#e03a2a', 8); this.center('CRYPT OF THE BARON', 92, '#ffd36a', 2);
    this.center('WASD MOVE  MOUSE TURN  CLICK FIRE', 112, '#d9d6e8');
    this.center('SPACE USE  SHIFT RUN  1 MACE  2 GUN  TAB MAP', 124, '#d9d6e8');
    this.center(o.ready ? 'CLICK TO START' : 'LOADING...', 150, '#ffffff');
  }
  intermission(sim, o) {
    const g = this.g, vw = this.vw, s = sim.stats; g.fillStyle = 'rgba(6,4,10,0.92)'; g.fillRect(0, 0, vw, VH);
    this.center('CRYPT OF THE BARON', 14, '#ffd36a', 2); this.center('FINISHED!', 36, '#e03a2a', 3);
    const row = (a, b, y) => { this.text(a, vw / 2 - 90, y, '#d9d6e8', 1); this.text(b, vw / 2 + 90 - this.textW(b), y, '#ff9a7a', 1); };
    const t = Math.floor(sim.time), pct = (a, b) => `${b ? Math.round(100 * a / b) : 100}%`;
    row('KILLS', pct(s.kills, s.killsTotal), 72); row('ITEMS', pct(s.items, s.itemsTotal), 86); row('SECRETS', `${s.secrets}/${s.secretsTotal}`, 100); row('TIME', `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`, 114);
    this.center('CLICK OR PRESS R TO PLAY AGAIN', 146, '#ffffff');
  }
  tick(dt) { for (const m of this.msgs) m.t -= dt; this.msgs = this.msgs.filter((m) => m.t > 0); }
}
