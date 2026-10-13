// UFO interception (X-COM style radar animation) + optional short Star Fox-style shooter. Both can be skipped (D); auto-resolve (SPACE) just plays the radar dogfight.
// Result → { downed: 0..2, crashed, skipped }: every downed ship removes one alien from the ground mission and pays $300.
import { VW, VH, COL } from './base.js';
const Phaser_clamp = (v, a, b) => Math.max(a, Math.min(b, v));

export class InterceptView {
  constructor(host) { this.h = host; }
  start({ site, onEnd }) {
    this.site = site; this.onEnd = onEnd; this.objs = []; this.phase = 'radar'; this.t = 0; this.done = false; this.finished = false; this.resolved = false; this.doneFn = null; this.keys = {}; this.shots = []; this.foes = []; this.eshots = []; this.fx = [];
    const h = this.h; this.add(h.panel(0, 0, VW, VH, 0x071016, { texture: false })); this.add(h.panel(5, 22, 210, 144, 0x020c09, { raised: false, depth: 1, texture: false }));
    this.gfx = h.ps.add.graphics(); this.h.hud.add(this.gfx); this.gfx.setDepth(5).setScale(0.66, 0.72).setPosition(4, 23);
    this.radarBtns = [{ key: 'Enter', y: 26, label: 'ENGAGE' }, { key: ' ', y: 53, label: 'AUTO-RESOLVE' }, { key: 'Escape', y: 80, label: 'DISENGAGE' }];
    for (const b of this.radarBtns) { this.add(h.panel(220, b.y, 94, 23, 0x142a2b, { depth: 2, texture: false })); this.add(h.label(220, b.y, 94, 23, b.label, '#88cbb0', { depth: 8 })); }
    this.add(h.panel(220, 108, 94, 58, 0x06100e, { raised: false, depth: 1, texture: false })); this.add(h.img('jet', 0, 267, 137, 6, [0.5, 0.5], true)).setScale(1.4);
    this.add(h.text(267, 111, 'INTERCEPTOR', COL.dim, { origin: [0.5, 0], hud: true, depth: 8 }));
    this.tTitle = this.add(h.text(6, 4, `XK / AIR DEFENCE  -  ${site.name}`, '#88cbb0', { hud: true, depth: 8 }));
    this.tSub = this.add(h.text(6, 174, 'INTERCEPTOR LAUNCHED FROM HQ...', COL.dim, { hud: true, depth: 8 }));
    this.tKeys = this.add(h.text(VW / 2, 188, '[ENTER] ENGAGE   [SPACE] AUTO   [D] SKIP  [P] PAUSE', COL.gold, { origin: [0.5, 0], hud: true, depth: 8 }));
    h.music('music_game', 0.18, { offset: h.musicConfig.interceptStartSeconds, restart: true }); h.sfx('alarm', 0.2);
    this.ufo = { x: 250, y: 40 }; this.jet = { x: 70, y: 150 };
  }
  add(o) { this.objs.push(o); return o; }
  destroy() { this.resolveTimer?.remove(); this.msgTimer?.remove(); for (const o of this.objs) o.destroy?.(); this.gfx?.destroy(); this.objs = []; this.h.hud.removeAll(true); this.done = true; }

  // ---- radar ---------------------------------------------------------------------------------------------------------------------------------------
  drawRadar(dt) {
    const g = this.gfx, cx = 160, cy = 100; g.clear(); g.lineStyle(1, 0x1f7a3a, 1); for (const r of [30, 60, 90]) g.strokeCircle(cx, cy, r); g.lineBetween(cx - 95, cy, cx + 95, cy); g.lineBetween(cx, cy - 95, cx, cy + 95);
    g.lineStyle(1, 0x244e3c, 0.35); for (let y = 6; y < 196; y += 4) g.lineBetween(4, y, 312, y);
    for (let i = 0; i < 24; i++) { const a = i / 24 * Math.PI * 2; g.lineStyle(1, 0x497866, 0.7); g.lineBetween(cx + Math.cos(a) * 91, cy + Math.sin(a) * 91, cx + Math.cos(a) * 96, cy + Math.sin(a) * 96); }
    const a = this.t * 2.2; for (let i = 0; i < 14; i++) { g.lineStyle(1, 0x30ff70, (1 - i / 14) * 0.55); g.lineBetween(cx, cy, cx + Math.cos(a - i * 0.05) * 95, cy + Math.sin(a - i * 0.05) * 95); }
    const k = Math.min(1, this.t / 4.5), ufo = { x: 245 - k * 55 + Math.sin(this.t * 1.3) * 3, y: 45 + k * 22 }, jet = { x: 60 + k * 118, y: 160 - k * 85 };
    if (this.phase === 'auto') { const m = Math.min(1, this.t / 2); ufo.x = 190 + Math.sin(this.t * 9) * 8 * (1 - m * 0.4); ufo.y = 67 + Math.cos(this.t * 8) * 6; jet.x = ufo.x - 24 * (1 - m) + Math.sin(this.t * 7) * 5; jet.y = ufo.y + 20 * (1 - m) + Math.cos(this.t * 6) * 5; }
    g.fillStyle(0xff3a2a, 1); g.fillRect(ufo.x - 2, ufo.y - 2, 5, 5); g.lineStyle(1, 0xff3a2a, 0.8); g.strokeCircle(ufo.x, ufo.y, 6 + (this.t * 6) % 6);
    g.fillStyle(0x4aa0ff, 1); g.fillRect(jet.x - 2, jet.y - 2, 5, 5); g.lineStyle(1, 0x4aa0ff, 0.5); for (let i = 1; i < 6; i++) g.lineBetween(jet.x - i * 3 * k, jet.y + i * 2.5 * k, jet.x - (i + 1) * 3 * k, jet.y + (i + 1) * 2.5 * k);
    if (this.phase === 'auto' && this.t > 1.6 && Math.floor(this.t * 10) % 2) { g.lineStyle(1, 0xffe060, 1); g.lineBetween(jet.x, jet.y, ufo.x, ufo.y); }
    if (this.phase === 'radar') { const d = Math.hypot(ufo.x - jet.x, ufo.y - jet.y); this.tSub.setText(d > 18 ? `RANGE ${Math.round(d * 4)} KM - CLOSING` : 'TARGET IN RANGE - AWAITING ORDERS', d > 18 ? COL.dim : COL.amber); }
  }

  // ---- action sequence (Star Fox / Raptor style) -------------------------------------------------------------------------------------------------------
  // Banking jet, barrel roll (invulnerable, reflects enemy shots back — the Star Fox trick), power-up pickups (P: 1→3 weapon levels, M: homing missiles, S: shield),
  // swarm / dart / ground-turret waves over scrolling sea + islands + clouds (Raptor), and a two-phase UFO boss.
  startAir() {
    const h = this.h; this.phase = 'air'; this.t = 0; for (const o of this.objs) o.destroy?.(); this.objs = []; this.gfx.clear(); this.gfx.setVisible(false);
    const add = (o) => { this.objs.push(o); h.hud.add(o); return o; };
    this.sea = add(h.ps.add.tileSprite(0, 0, VW, VH, h.PATH.sea).setOrigin(0).setDepth(1));
    this.scenery = []; // islands (ground layer) and clouds (high layer) drift down at different speeds = parallax
    for (let i = 0; i < 3; i++) this.scenery.push({ s: add(h.ps.add.image(40 + i * 110, -40 - i * 90, h.PATH.island).setDepth(2)), v: 55 });
    for (let i = 0; i < 4; i++) this.scenery.push({ s: add(h.ps.add.image((i * 97) % VW, i * 55 - 20, h.PATH.cloud).setOrigin(0).setDepth(9).setAlpha(0.65)), v: 95 + i * 14 });
    this.pl = { x: 160, y: 168, hp: 5, cd: 0, inv: 0, lvl: 1, missiles: 3, roll: 0, rollCd: 0, sp: add(h.ps.add.sprite(160, 168, h.PATH.jet, 0).setDepth(6)), lastDir: 0, tapT: { ArrowLeft: -9, ArrowRight: -9 } };
    this.tHud = this.add(h.text(4, 2, '', COL.text, { hud: true, depth: 12 })); this.tBoss = this.add(h.text(VW - 4, 2, '', COL.bad, { origin: [1, 0], hud: true, depth: 12 })); this.tScore = this.add(h.text(VW / 2, 2, '', COL.gold, { origin: [0.5, 0], hud: true, depth: 12 }));
    this.tMsg = this.add(h.text(VW / 2, 84, 'GO!  MOUSE/ARROWS MOVE - SPACE FIRE - X MISSILE - SHIFT BARREL ROLL', COL.gold, { origin: [0.5, 0], hud: true, depth: 12 })); h.ps.time.delayedCall(3200, () => this.tMsg?.img && this.tMsg.setText('', COL.gold));
    this.hpPips = Array.from({ length: 5 }, (_, i) => this.add(h.rect(4 + i * 9, 13, 7, 5, 0x40e040, 1, true, 12))); this.bossBar = this.add(h.rect(VW - 4, 14, 0, 4, 0xe03030, 1, true, 12));
    this.foes = []; this.shots = []; this.eshots = []; this.items = []; this.mis = []; this.score = 0; this.killed = 0; this.boss = null; this.over = false; this.step = 0;
    this.script = [[1.5, 'drone', -1], [4.5, 'drone', 1], [7.5, 'dart', 0], [9.5, 'turrets', 0], [12.5, 'drone', -1], [14.5, 'pickup', 0], [16, 'dart', 1], [19, 'drone', 1], [21, 'dart', 0], [25, 'boss', 0]];
    h.music('music_game', 0.2); this.mouseDown = false; this.mx = 160; this.my = 168;
  }
  spr(key, frame, x, y, depth = 5) { const s = this.h.ps.add.sprite(x, y, this.h.PATH[key], frame).setDepth(depth); this.h.hud.add(s); return s; }
  note(str, col = COL.gold, ms = 1600) { this.tMsg.setText(str, col); this.tMsg.setPosition(VW / 2, 84); this.msgTimer?.remove(); this.msgTimer = this.h.ps.time.delayedCall(ms, () => this.tMsg?.img && this.tMsg.setText('', col)); }
  fire() {
    const p = this.pl; if (p.cd > 0 || p.hp <= 0 || p.roll > 0) return; p.cd = 0.15; const L = p.lvl, xs = L === 1 ? [-5, 5] : L === 2 ? [-7, 0, 7] : [-8, -4, 0, 4, 8], vx = L === 1 ? [0, 0] : L === 2 ? [-28, 0, 28] : [-70, -35, 0, 35, 70];
    xs.forEach((dx, i) => this.shots.push({ x: p.x + dx, y: p.y - 12, vx: vx[i], vy: -300, dmg: 1, s: this.spr('shots', 0, p.x + dx, p.y - 12) }));
    if (this.t - (this.lastSfx ?? 0) > 0.11) { this.lastSfx = this.t; this.h.sfx('rifle', 0.1, 1.9 + L * 0.1); }
  }
  launchMissile() {
    const p = this.pl; if (p.missiles <= 0 || p.hp <= 0 || p.roll > 0 || this.mcd > 0) return; p.missiles--; this.mcd = 0.35; const s = this.spr('shots', 3, p.x, p.y - 10, 7).setScale(0.8).setTint(0xffa040);
    this.mis.push({ x: p.x, y: p.y - 10, vx: 0, vy: -140, t: 0, s }); this.h.sfx('rocket', 0.25, 1.4);
  }
  boom(x, y, big) { const s = this.spr('tfx', 0, x, y, 11).setScale(big ? 3 : 1.6); this.h.sfx('explosion', big ? 0.4 : 0.2, big ? 0.8 : 1.3); (async () => { for (let f = 1; f <= 3; f++) { await this.h.wait(90); if (!s.scene) return; s.setFrame(f); } await this.h.wait(100); s.destroy(); })(); }
  eshot(x, y, tx, ty, sp = 70, extra = 0) { const a = Math.atan2(ty - y, tx - x) + extra; this.eshots.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, refl: false, s: this.spr('shots', 1, x, y, 8) }); if (this.t - (this.lastE ?? 0) > 0.12) { this.lastE = this.t; this.h.sfx('spit', 0.1, 1.2); } }
  drop(x, y, kind) { this.items.push({ x, y, kind, s: this.spr('pickups', kind, x, y, 7) }); }
  addFoe(f) { f.s = this.spr(f.key, 0, f.x, f.y, f.ground ? 3 : 6); this.foes.push(f); return f; }
  spawn(kind, side) {
    const t = this.t;
    if (kind === 'drone') for (let i = 0; i < 4; i++) this.addFoe({ kind, key: 'drone', hw: 8, hh: 7, x: 160, y: -10, t0: t + i * 0.35, side, hp: 2, cd: 1 + Math.random() * 2, pts: 100, last: i === 3 });
    else if (kind === 'dart') for (let i = 0; i < 3; i++) this.addFoe({ kind, key: 'dart', hw: 7, hh: 7, x: 70 + i * 90 + (side ? 40 * side : 0), y: -14 - i * 22, t0: t, side, hp: 2, cd: 0.8 + i * 0.4, pts: 150, vy: 70 });
    else if (kind === 'turrets') for (let i = 0; i < 2; i++) { const x = 70 + i * 150, isl = this.scenery.filter((q) => q.s.texture.key === this.h.PATH.island)[i]; if (isl) { isl.s.setPosition(x, -30); } this.addFoe({ kind: 'turret', key: 'turret', ground: true, hw: 8, hh: 8, x, y: -24, hp: 5, cd: 1.5, pts: 200, vy: 55 }); }
    else if (kind === 'pickup') this.drop(60 + Math.random() * 200, -10, this.pl.lvl < 3 ? 0 : 1);
    else if (kind === 'boss') { this.boss = this.addFoe({ kind: 'ufo', key: 'saucer', hw: 14, hh: 8, x: 160, y: -20, hp: 34, max: 34, cd: 1.5, pts: 2000, phase: 1 }); this.note('ALIEN CRAFT!  DESTROY IT!', COL.bad, 2200); this.h.sfx('alarm', 0.25); }
  }
  hurt(why) { const p = this.pl; if (p.inv > 0 || p.roll > 0 || p.hp <= 0) return; p.hp--; p.inv = 1.4; this.h.sfx('hit', 0.4); void why; if (p.hp <= 0) { this.boom(p.x, p.y, true); p.sp.setVisible(false); this.finishAir(false); } }
  updateAir(dt) {
    const p = this.pl, k = this.keys, t = this.t, h = this.h; this.mcd = (this.mcd ?? 0) - dt;
    this.sea.tilePositionY -= 55 * dt; for (const q of this.scenery) { q.s.y += q.v * dt; if (q.s.y > VH + 40) { q.s.y = -50; q.s.x = 24 + Math.random() * (VW - 48); } }
    // --- player: move, bank, roll, fire
    if (p.hp > 0) {
      const sp = 155 * dt, dx = (k.ArrowRight ? 1 : 0) - (k.ArrowLeft ? 1 : 0), dy = (k.ArrowDown ? 1 : 0) - (k.ArrowUp ? 1 : 0), ox = p.x;
      if (dx || dy) { p.x += dx * sp; p.y += dy * sp; this.mx = p.x; this.my = p.y; } else { p.x += (this.mx - p.x) * Math.min(1, dt * 9); p.y += (this.my - p.y) * Math.min(1, dt * 9); }
      p.x = Math.max(14, Math.min(VW - 14, p.x)); p.y = Math.max(60, Math.min(VH - 16, p.y)); p.cd -= dt; p.inv -= dt; p.rollCd -= dt; const vxn = (p.x - ox) / Math.max(dt, 0.001);
      if ((k.Shift || k.z || k.Z || this.wantRoll) && p.roll <= 0 && p.rollCd <= 0) { p.roll = 0.6; p.rollCd = 1.2; h.sfx('select', 0.35, 1.6); this.wantRoll = false; }
      if (k[' '] || this.mouseDown) this.fire(); if (k.x || k.X) this.launchMissile();
      let sx = 1, rot = Phaser_clamp(vxn / 900, -0.22, 0.22);
      if (p.roll > 0) { p.roll -= dt; const a = (1 - p.roll / 0.6) * Math.PI * 2; sx = Math.cos(a); rot = 0; for (const s of this.eshots) if (!s.refl && Math.hypot(s.x - p.x, s.y - p.y) < 24) { s.refl = true; s.vx = -s.vx * 1.4; s.vy = -Math.abs(s.vy) * 1.4 - 30; s.s.setTint(0x80ffff); h.sfx('select', 0.15, 2); this.score += 10; } }
      else sx = 1 - Math.min(0.28, Math.abs(vxn) / 900);
      p.sp.setPosition(p.x, p.y).setFrame(Math.floor(t * 12) % 2).setScale(sx, 1).setRotation(rot).setAlpha(p.inv > 0 && Math.floor(t * 20) % 2 ? 0.35 : 1);
    }
    // --- script
    while (this.step < this.script.length && t > this.script[this.step][0]) { const [, kind, side] = this.script[this.step++]; this.spawn(kind, side); }
    // --- enemies
    for (const f of this.foes) {
      f.cd -= dt;
      if (f.kind === 'drone') { const tt = t - f.t0; f.y = -10 + tt * 56; f.x = 160 + f.side * (95 - Math.min(tt, 3) * 28) + Math.sin(tt * 2.6) * 40; if (f.cd <= 0 && f.y > 10 && f.y < 150) { f.cd = 2.4; this.eshot(f.x, f.y, p.x, p.y, 64); } f.s.setFrame(Math.floor(t * 8) % 2); }
      else if (f.kind === 'dart') { const tt = t - f.t0; if (f.y < 70 + f.cd * 20) f.y += f.vy * dt; else { f.x += (p.x - f.x) * Math.min(1, dt * 1.6); f.y += 120 * dt; } if (f.cd <= 0 && f.y > 0 && f.y < 120) { f.cd = 2; this.eshot(f.x, f.y + 6, p.x, p.y, 80); } f.s.setFrame(Math.floor(t * 10) % 2); }
      else if (f.kind === 'turret') { f.y += f.vy * dt; if (f.cd <= 0 && f.y > 5 && f.y < 150) { f.cd = 1.7; this.eshot(f.x, f.y, p.x, p.y, 70); f.s.setFrame(1); h.wait(120).then(() => f.s?.scene && f.s.setFrame(0)); } }
      else { // boss: phase 2 under 50% hull — faster, ring bursts
        f.y = Math.min(46, f.y + 32 * dt); const ph2 = f.hp < f.max * 0.5; f.x = 160 + Math.sin(t * (ph2 ? 1.5 : 0.9)) * 105; f.phase = ph2 ? 2 : 1;
        if (f.y >= 40 && f.cd <= 0) { f.cd = ph2 ? 0.8 : 1.15; for (const a of ph2 ? [-0.5, -0.25, 0, 0.25, 0.5] : [-0.25, 0, 0.25]) this.eshot(f.x, f.y + 6, p.x, p.y, ph2 ? 92 : 76, a); if (ph2 && (this.ring = (this.ring ?? 0) + 1) % 4 === 0) for (let a = 0; a < 12; a++) this.eshots.push({ x: f.x, y: f.y, vx: Math.cos(a / 12 * 6.28) * 55, vy: Math.sin(a / 12 * 6.28) * 55, refl: false, s: this.spr('shots', 2, f.x, f.y, 8) }); }
        f.s.setFrame(Math.floor(t * (ph2 ? 9 : 5)) % 2);
      }
      f.s.setPosition(f.x, f.y); if (f.y > VH + 20) f.hp = -99;
    }
    // --- player shots
    for (const s of this.shots) { s.x += s.vx * dt; s.y += s.vy * dt; s.s.setPosition(s.x, s.y); for (const f of this.foes) if (f.hp > 0 && Math.abs(s.x - f.x) < f.hw && Math.abs(s.y - f.y) < f.hh) { this.hitFoe(f, s.dmg, s.x, s.y); s.y = -99; break; } }
    for (const m of this.mis) { // homing missiles
      m.t += dt; const tgt = this.foes.filter((f) => f.hp > 0 && f.y > 0).sort((a, b) => Math.hypot(a.x - m.x, a.y - m.y) - Math.hypot(b.x - m.x, b.y - m.y))[0];
      if (tgt) { const a = Math.atan2(tgt.y - m.y, tgt.x - m.x), sp = Math.min(260, 140 + m.t * 400); m.vx += (Math.cos(a) * sp - m.vx) * Math.min(1, dt * 5); m.vy += (Math.sin(a) * sp - m.vy) * Math.min(1, dt * 5); } else m.vy -= 200 * dt;
      m.x += m.vx * dt; m.y += m.vy * dt; m.s.setPosition(m.x, m.y).setRotation(Math.atan2(m.vy, m.vx) + Math.PI / 2);
      for (const f of this.foes) if (f.hp > 0 && Math.abs(m.x - f.x) < f.hw + 2 && Math.abs(m.y - f.y) < f.hh + 2) { this.hitFoe(f, 7, m.x, m.y); this.boom(m.x, m.y, false); m.y = -99; break; }
    }
    // --- enemy shots (reflected ones hurt enemies)
    for (const s of this.eshots) {
      s.x += s.vx * dt; s.y += s.vy * dt; s.s.setPosition(s.x, s.y).setFrame(Math.floor(t * 10) % 2 + 1);
      if (s.refl) { for (const f of this.foes) if (f.hp > 0 && Math.abs(s.x - f.x) < f.hw + 3 && Math.abs(s.y - f.y) < f.hh + 3) { this.hitFoe(f, 3, s.x, s.y); s.y = -99; break; } }
      else if (p.hp > 0 && Math.abs(s.x - p.x) < 6 && Math.abs(s.y - p.y) < 8) { if (p.inv <= 0 && p.roll <= 0) { s.y = 999; this.hurt('shot'); } }
    }
    for (const f of this.foes) if (p.hp > 0 && f.hp > 0 && f.kind !== 'turret' && Math.abs(f.x - p.x) < f.hw + 4 && Math.abs(f.y - p.y) < f.hh + 4 && p.inv <= 0 && p.roll <= 0) { if (f.kind !== 'ufo') { f.hp = 0; this.boom(f.x, f.y); } this.hurt('crash'); }
    // --- pickups
    for (const it of this.items) { it.y += 50 * dt; it.s.setPosition(it.x, it.y + Math.sin(t * 6) * 1.5); if (p.hp > 0 && Math.abs(it.x - p.x) < 12 && Math.abs(it.y - p.y) < 12) { it.y = 999; h.sfx('built', 0.35, 1.5);
      if (it.kind === 0) { p.lvl = Math.min(3, p.lvl + 1); this.note(`WEAPON LEVEL ${p.lvl}`, COL.cyan, 1100); } else if (it.kind === 1) { p.missiles += 3; this.note('+3 MISSILES', COL.gold, 1100); } else { p.hp = Math.min(5, p.hp + 1); this.note('SHIELD +1', COL.good, 1100); } this.score += 50; } }
    // --- clean up
    for (const list of [this.shots, this.eshots, this.mis, this.items]) for (let i = list.length - 1; i >= 0; i--) if (list[i].y < -12 || list[i].y > VH + 12 || list[i].x < -12 || list[i].x > VW + 12) { list[i].s.destroy(); list.splice(i, 1); }
    for (let i = this.foes.length - 1; i >= 0; i--) { const f = this.foes[i]; if (f.hp <= 0) { f.s.destroy(); this.foes.splice(i, 1); if (f === this.boss && !this.over) { this.over = true; this.boss.dead = true; this.finishAir(true); } } }
    // --- HUD
    this.hpPips.forEach((r, i) => r.setFillStyle(i < p.hp ? (p.hp <= 2 ? 0xe03020 : 0x40e040) : 0x303040)); this.tHud.setText(`P${p.lvl}  MSL ${p.missiles}`, COL.cyan); this.tHud.setPosition(4, 20); this.tScore.setText(`SCORE ${this.score}`, COL.gold);
    if (this.boss && !this.boss.dead && this.boss.hp > 0) { this.bossBar.width = -60 * this.boss.hp / this.boss.max; this.tBoss.setText('UFO HULL', COL.bad); } else this.bossBar.width = 0;
    if (!this.over && t > 70 && p.hp > 0) { this.over = true; this.finishAir(false, true); }
  }
  hitFoe(f, dmg, x, y) {
    f.hp -= dmg; this.score += 5; const sp = this.spr('shots', 3, x, y, 11); this.h.wait(70).then(() => sp.destroy());
    if (f.hp <= 0) { this.boom(f.x, f.y, f.kind === 'ufo'); this.score += f.pts; if (f.kind !== 'turret' && f.kind !== 'ufo') this.killed++; if (f.last) this.drop(f.x, f.y, this.pl.lvl < 3 ? 0 : 1); if (f.kind === 'turret' && Math.random() < 0.5) this.drop(f.x, f.y, 1 + Math.floor(Math.random() * 2)); }
  }
  finishAir(win, escaped) {
    if (this.resolved) return; this.resolved = true; this.over = true; const h = this.h, downed = win ? 1 + (this.killed >= 8 ? 1 : 0) : 0, crashed = !win && !escaped;
    h.sfx(win ? 'victory' : 'defeat', 0.45);
    this.resolveTimer = h.ps.time.delayedCall(win ? 900 : 1200, () => { this.endCard = h.card([[win ? 'UFO SHOT DOWN!' : crashed ? 'INTERCEPTOR LOST' : 'UFO ESCAPED', win ? COL.good : COL.bad, 2], [`SCORE ${this.score}   FIGHTERS DESTROYED ${this.killed}`, COL.cyan], [win ? `${downed} CRAFT DOWNED - ${downed} FEWER ALIENS ON SITE  +$${downed * 300}` : 'NO EFFECT ON THE GROUND MISSION', COL.text], ['PRESS ENTER', COL.gold]], { y: 52, w: 260 }); this.doneFn = () => { this.endCard(); this.finish({ downed, crashed }); }; });
  }
  finish(r) { if (this.finished) return; this.finished = true; this.onEnd(r); }

  // ---- update / input -------------------------------------------------------------------------------------------------------------------------------------
  update(dt) {
    if (this.done) return; this.t += dt;
    if (this.phase === 'radar' || this.phase === 'auto') { this.drawRadar(dt);
      if (this.phase === 'auto' && this.t > 2.6 && !this.resolved) { this.resolved = true; const r = Math.random(), downed = r < 0.6 ? 1 : 0, crashed = r > 0.88; this.h.sfx(downed ? 'explosion' : 'defeat', 0.35);
        this.tSub.setText(downed ? 'UFO DESTROYED' : crashed ? 'INTERCEPTOR LOST' : 'UFO ESCAPED', downed ? COL.good : COL.bad); this.resolveTimer = this.h.ps.time.delayedCall(1100, () => this.finish({ downed, crashed })); } }
    else if (this.phase === 'air') this.updateAir(dt);
  }
  key(e, down) {
    const k = e.key; this.keys[k] = down; if (!down || this.done) return;
    if (k === 'Escape' || k === 'd' || k === 'D') { if (this.phase === 'air' && !this.resolved) this.resolved = true; this.finish({ downed: 0, skipped: true }); return; }
    if (this.phase === 'radar') { if (k === 'Enter') this.startAir(); else if (k === ' ') { this.phase = 'auto'; this.t = 0; this.tKeys.setText('', COL.gold); this.tSub.setText('DOGFIGHT...', COL.amber); this.h.sfx('rifle', 0.3); } }
    else if (this.phase === 'air' && this.doneFn && (k === 'Enter')) this.doneFn();
    else if (this.phase === 'air' && (k === 'ArrowLeft' || k === 'ArrowRight' || k === 'a' || k === 'd') && this.pl) { const key = k === 'a' ? 'ArrowLeft' : k === 'd' ? 'ArrowRight' : k, now = this.t; if (now - (this.pl.tapT[key] ?? -9) < 0.28) this.wantRoll = true; this.pl.tapT[key] = now; }
  }
  pointer(p, type) { const [, , lx, ly] = this.h.ptr(p); if (this.phase !== 'air') { if (type === 'down' && this.phase === 'radar') { const b = this.radarBtns.find(b => lx >= 220 && lx < 314 && ly >= b.y && ly < b.y + 23); if (b) this.key({ key: b.key }, true); else if (lx < 215 && ly > 22 && ly < 166) this.startAir(); } return; } if (type === 'move') { this.mx = lx; this.my = ly; } else if (type === 'down') { if (this.doneFn) this.doneFn(); else if (p.button === 2 || p.rightButtonDown?.()) this.launchMissile(); else { this.mouseDown = true; this.mx = lx; this.my = ly; } } else if (type === 'up') this.mouseDown = false; }
}
