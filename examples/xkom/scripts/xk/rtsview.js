// RTS view (Red Alert / C&C look): scrolling 16px map, right sidebar (minimap, credits, build icons), drag-select, right-click orders, tiny event-driven effects.
// Rules live in rts.js. Used by X-KOM 2026 (operation vs the alien hive) and Red Front 2026 (Allies vs Soviets).
import { VW, VH, COL, UI } from './base.js';
import { newRts, step, train, order, U, B, PLAYER_UNITS, TILE } from './rts.js';

const TS = 16, SBX = 258, MAPVW = 256, TF = { grass1: 0, grass2: 1, dirt: 2, water1: 3, water2: 4, tree: 5, rock: 6, ore1: 7, ore2: 8, road: 9 };
const WSFX = { bullet: 'rifle', rocket: 'rocket', shell: 'cannon', claw: 'hit', acid: 'spit' };

export class RtsView {
  constructor(host) { this.h = host; }
  /** cfg: { mode, bonus, seed, diff, music, briefing, winText, loseText, onEnd } */
  start(cfg) {
    const h = this.h, ps = h.ps; this.cfg = cfg; this.s = newRts({ seed: cfg.seed, mode: cfg.mode, bonus: cfg.bonus ?? 0, diff: cfg.diff ?? 1, mods: cfg.mods });
    this.objs = []; this.usp = new Map(); this.bsp = new Map(); this.sel = new Set(); this.over = false; this.amove = false; this.drag = null; this.keys = {}; this.sx = 0; this.sy = 0; this.sfxT = {}; this.anim = 0; this.lines = []; this.dtLast = 0.016; this.edge = null;
    const s = this.s; this.um = h.meta.runits; this.ucols = this.um.framesPerRow;
    this.terr = [];
    for (let y = 0; y < s.h; y++) for (let x = 0; x < s.w; x++) {
      const t = s.tiles[y * s.w + x], hash = (x * 7 + y * 13) % 5; let f = TF.grass1;
      if (t === TILE.DIRT) f = TF.dirt; else if (t === TILE.WATER) f = TF.water1; else if (t === TILE.TREE) f = TF.tree; else if (t === TILE.ROCK) f = TF.rock; else if (hash === 0) f = TF.grass2;
      const sp = h.img('rterrain', f, x * TS, y * TS, 0); this.objs.push(sp); this.terr.push({ sp, t, x, y });
    }
    this.oreSp = new Map(); this.gfx = ps.add.graphics().setDepth(4000); this.fxg = ps.add.graphics().setDepth(3900); this.objs.push(this.gfx, this.fxg);
    this.cursor = h.img('rui', 0, 0, 0, 6000, [0, 0], true);
    this.buildHud(); this.syncOre(); this.view(0, 0); this.syncSprites();
    const pb = s.blds.find((b) => b.team === 'p' && b.type === 'fact'); this.view(pb.tx * TS - 40, pb.ty * TS - 90);
    h.music(cfg.music ?? 'music_rts', 0.25); this.say(cfg.briefing ?? 'DESTROY THE ENEMY BASE', COL.gold);
    this.wt = ps.time.addEvent({ delay: 520, loop: true, callback: () => { this.anim++; this.waterTick(); } });
    this.miniT = 0;
  }
  destroy() { this.wt?.remove(); for (const o of this.objs) o.destroy?.(); for (const e of this.usp.values()) e.sp.destroy(); for (const e of this.bsp.values()) e.sp.destroy(); for (const o of this.oreSp.values()) o.destroy(); this.h.hud.removeAll(true); this.usp.clear(); this.bsp.clear(); if (this.h.ps.textures.exists(this.miniKey)) this.h.ps.textures.remove(this.miniKey); }

  // ---- HUD / sidebar -------------------------------------------------------------------------------------------------------------------------
  buildHud() {
    const h = this.h, s = this.s;
    h.panel(SBX - 2, 0, VW - SBX + 2, VH, UI.metal, { depth: 1 });
    this.miniKey = 'xk-mini-' + Math.random().toString(36).slice(2, 6);
    const cv = h.ps.textures.createCanvas(this.miniKey, 60, 60), g = cv.getContext(), k = 60 / s.w, colr = ['#4a7a2c', '#4a7a2c', '#8a6a3c', '#2a4a8c', '#2f5a22', '#6a6a72'];
    for (let y = 0; y < s.h; y++) for (let x = 0; x < s.w; x++) { g.fillStyle = colr[s.tiles[y * s.w + x]] ?? '#4a7a2c'; g.fillRect(Math.floor(x * k), Math.floor(y * k), Math.ceil(k), Math.ceil(k)); }
    cv.refresh(); this.mini = h.ps.add.image(SBX, 3, this.miniKey).setOrigin(0).setDepth(6); h.hud.add(this.mini);
    this.dots = h.ps.add.graphics().setDepth(7); h.hud.add(this.dots);
    this.tCred = h.text(SBX + 30, 64, '', COL.gold, { origin: [0.5, 0], hud: true, depth: 8, bitmap: true }); this.tPow = h.text(SBX + 30, 73, '', COL.good, { origin: [0.5, 0], hud: true, depth: 8, bitmap: true });
    this.btn = [];
    Object.keys(PLAYER_UNITS).forEach((type, i) => {
      const x = SBX + (i % 2) * 31, y = 83 + ((i / 2) | 0) * 32, bg = h.panel(x, y, 30, 30, 0x6a6a84, { depth: 2 }), ic = h.img('runits', this.ufr(type, 'p', 0), x + 7, y + 2, 8, [0, 0], true);
      h.text(x + 15, y + 19, `${U[type].cost}`, COL.text, { origin: [0.5, 0], hud: true, depth: 8, bitmap: true }); const q = h.text(x + 3, y + 3, '', COL.gold, { hud: true, depth: 9, bitmap: true }), pr = h.rect(x, y + 28, 0, 1, 0x40e040, 1);
      h.text(x + 28, y + 3, String(i + 1), COL.dim, { origin: [1, 0], hud: true, depth: 9, bitmap: true });
      this.btn.push({ type, x, y, w: 30, h: 30, bg, q, pr, ic });
    });
    this.tMsg = h.text(4, 3, '', COL.gold, { hud: true, depth: 8, bitmap: true }); this.tMsg2 = h.text(4, 12, '', COL.dim, { hud: true, depth: 8, bitmap: true }); this.tSel = h.text(4, 190, '', COL.text, { hud: true, depth: 8, bitmap: true });
    ['RMB ORDER', 'A ATTACK'].forEach((t, i) => h.text(SBX + 30, 179 + i * 10, t, COL.dim, { origin: [0.5, 0], hud: true, depth: 8, bitmap: true }));
  }
  ufr(type, team, f) { const m = this.um, row = m.teams.length > 1 && team === 'e' ? 1 : 0; return row * this.ucols + m.units.indexOf(type) * 3 + f; }
  bfr(b, f = 0) { const m = this.h.meta['b_' + b.type], idx = m.teams.length > 1 ? (b.team === 'p' ? 0 : 1) : 0; return idx * m.framesPerTeam + Math.min(f, m.framesPerTeam - 1); }
  say(str, col = COL.gold) { this.tMsg.setText(str.slice(0, 41), col); this.msgT?.remove(); this.msgT = this.h.ps.time.delayedCall(3500, () => this.tMsg?.img && this.tMsg.setText('', col)); }
  say2(str, col) { const t = this.tMsg2; t.setText(str.slice(0, 41), col); this.msg2T?.remove(); this.msg2T = this.h.ps.time.delayedCall(2200, () => t?.img && t.setText('', col)); }
  hudRefresh() {
    const s = this.s; this.tCred.setText(`$ ${Math.floor(s.credits.p)}`, COL.gold); this.tPow.setText(s.lowPower.p ? 'LOW POWER' : 'POWER OK', s.lowPower.p ? COL.bad : COL.good);
    for (const b of this.btn) {
      const d = U[b.type], prods = s.blds.filter((x) => x.team === 'p' && x.type === d.from), ok = prods.length && s.credits.p >= d.cost && prods.every((p) => p.q.length < 5), qn = prods.reduce((n, p) => n + p.q.filter((q) => q === b.type).length, 0);
      b.bg.setFillStyle(ok ? 0x6a6a9a : 0x3c3c44); b.ic.setAlpha(prods.length ? 1 : 0.35); b.q.setText(qn ? String(qn) : '', COL.gold);
      const act = prods.find((p) => p.q[0] === b.type); b.pr.width = act ? 30 * act.prog / d.bt : 0;
    }
    const selected = [...this.sel].map(id => s.units.find(u => u.id === id) ?? s.blds.find(b => b.id === id)).filter(Boolean);
    this.sel = new Set(selected.map(o => o.id));
    this.tSel.setText(selected.length === 1 ? (U[selected[0].type] ?? B[selected[0].type]).name : selected.length ? `SELECTED ${selected.length}` : '', COL.text);
    if (--this.miniT <= 0) { this.miniT = 12; this.drawDots(); }
  }
  drawDots() {
    const s = this.s, k = 60 / s.w, g = this.dots; g.clear(); g.x = SBX; g.y = 3;
    for (const b of s.blds) { g.fillStyle(b.team === 'p' ? 0x60a0ff : 0xff5040, 1); g.fillRect(b.tx * k, b.ty * k, Math.max(2, b.w * k), Math.max(2, b.h * k)); }
    for (const u of s.units) { g.fillStyle(u.team === 'p' ? 0xa0d0ff : 0xff9080, 1); g.fillRect(u.x * k, u.y * k, 1.5, 1.5); }
    g.lineStyle(1, 0xffffff, 1); g.strokeRect(this.sx * k / TS, this.sy * k / TS, MAPVW * k / TS, VH * k / TS);
  }

  // ---- world sync ----------------------------------------------------------------------------------------------------------------------------------
  view(x, y) { const s = this.s; this.sx = Math.max(0, Math.min(s.w * TS - MAPVW, x)); this.sy = Math.max(0, Math.min(s.h * TS - VH, y)); this.h.camCenter(Math.round(this.sx) + VW / 2, Math.round(this.sy) + VH / 2); }
  waterTick() { for (const t of this.terr) if (t.t === TILE.WATER) t.sp.setFrame(this.anim % 2 ? TF.water2 : TF.water1); }
  syncOre() {
    const s = this.s;
    for (let y = 0; y < s.h; y++) for (let x = 0; x < s.w; x++) {
      const k = y * s.w + x, v = s.ore[k]; let sp = this.oreSp.get(k);
      if (v > 0) { if (!sp) { sp = this.h.img('rterrain', TF.ore1, x * TS, y * TS, 1); this.oreSp.set(k, sp); } sp.setFrame(v > 450 ? TF.ore2 : TF.ore1).setVisible(true); } else if (sp) sp.setVisible(false);
    }
  }
  syncSprites() {
    const s = this.s, h = this.h;
    for (const b of s.blds) { let e = this.bsp.get(b.id); if (!e) { e = { sp: h.img(`b_${b.type}`, this.bfr(b), b.tx * TS, b.ty * TS, 10 + b.ty), b }; this.bsp.set(b.id, e); } e.sp.setFrame(this.bfr(b, b.fire > 0 ? 1 : 0)); e.sp.setTint(b.flash > 0 ? 0xff8080 : b.hp < b.max * 0.35 ? 0xb08080 : 0xffffff); }
    for (const [id, e] of this.bsp) if (!s.blds.includes(e.b)) { e.sp.destroy(); this.bsp.delete(id); }
    for (const u of s.units) {
      let e = this.usp.get(u.id); if (!e) { e = { sp: h.img('runits', this.ufr(u.type, u.team, 0), 0, 0, 20, [0.5, 0.75]), u }; this.usp.set(u.id, e); }
      const f = u.shoot > 0 ? 2 : u.moving ? Math.floor(u.anim * 6) % 2 : 0; e.sp.setFrame(this.ufr(u.type, u.team, f)).setPosition(u.x * TS, u.y * TS).setDepth(20 + u.y).setFlipX(u.face < 0); e.sp.setTint(u.flash > 0 ? 0xff8080 : 0xffffff);
    }
    for (const [id, e] of this.usp) if (!s.units.includes(e.u)) { e.sp.destroy(); this.usp.delete(id); }
  }
  drawOverlay() {
    const g = this.gfx; g.clear();
    const bar = (x, y, w, f) => { g.fillStyle(0x000000, 1); g.fillRect(x - 1, y - 1, w + 2, 3); g.fillStyle(f > 0.5 ? 0x40e040 : f > 0.25 ? 0xe0c020 : 0xe03020, 1); g.fillRect(x, y, w * f, 1); };
    for (const e of this.usp.values()) { const u = e.u, on = this.sel.has(u.id); if (on || u.hp < u.max) bar(u.x * TS - 6, u.y * TS - 9, 12, u.hp / u.max); if (on) { g.lineStyle(1, 0xffffff, 1); g.strokeRect(u.x * TS - 7, u.y * TS - 8, 14, 14); } }
    for (const e of this.bsp.values()) { const b = e.b; if (this.sel.has(b.id) || b.hp < b.max) bar(b.tx * TS + 2, b.ty * TS + 2, b.w * TS - 4, b.hp / b.max); if (this.sel.has(b.id)) { g.lineStyle(1, 0xffffff, 1); g.strokeRect(b.tx * TS, b.ty * TS, b.w * TS, b.h * TS); } }
    const d = this.drag; if (d && d.on) { g.lineStyle(1, 0x60ff60, 1); g.strokeRect(Math.min(d.x0, d.x1), Math.min(d.y0, d.y1), Math.abs(d.x1 - d.x0), Math.abs(d.y1 - d.y0)); }
  }
  throttle(n, ms) { const t = performance.now(); if (this.sfxT[n] && t - this.sfxT[n] < ms) return false; this.sfxT[n] = t; return true; }
  fxOnce(frame, x, y, ms, scale = 1) { const sp = this.h.img('rfx', frame, x, y, 3000, [0.5, 0.5]).setScale(scale); this.h.wait(ms).then(() => sp.destroy()); return sp; }
  events() {
    const s = this.s, h = this.h, fg = this.fxg;
    for (const ev of s.ev) {
      if (ev.t === 'shot') {
        const col = ev.w === 'acid' ? 0xc0f040 : ev.w === 'claw' ? 0xff6050 : ev.w === 'rocket' ? 0xffffff : 0xffe080;
        this.lines.push({ x0: ev.fx * TS, y0: ev.fy * TS, x1: ev.tx * TS, y1: ev.ty * TS, col, life: ev.w === 'rocket' || ev.w === 'shell' ? 0.14 : 0.07, w: ev.w });
        if (this.throttle(ev.w, 90)) h.sfx(WSFX[ev.w], ev.w === 'claw' ? 0.15 : 0.22, 0.95 + Math.random() * 0.1);
        this.fxOnce(ev.w === 'acid' ? 5 : 4, ev.fx * TS, ev.fy * TS, 70); this.fxOnce(4, ev.tx * TS, ev.ty * TS, 110);
      } else if (ev.t === 'boom') {
        const sp = h.img('rfx', 0, ev.x * TS, ev.y * TS, 3000, [0.5, 0.5]); if (ev.big) sp.setScale(2);
        (async () => { for (let f = 1; f <= 3; f++) { await h.wait(90); if (!sp.scene) return; sp.setFrame(f); } await h.wait(120); sp.destroy(); })();
        if (this.throttle('boom', 80)) h.sfx(ev.big ? 'explosion' : U[ev.unit]?.kind === 'alien' ? 'die_alien' : 'die_human', ev.big ? 0.4 : 0.3);
      } else if (ev.t === 'built' && ev.team === 'p') { h.sfx('built', 0.4); this.say2(`${U[ev.unit].name} READY`, COL.good); }
      else if (ev.t === 'cash' && ev.team === 'p' && this.throttle('cash', 400)) h.sfx('ore', 0.2);
      else if (ev.t === 'under' && this.throttle('under', 6000)) this.say2('UNIT UNDER ATTACK', COL.bad);
    }
    s.ev.length = 0; fg.clear();
    this.lines = this.lines.filter((l) => (l.life -= this.dtLast) > 0);
    for (const l of this.lines) { fg.lineStyle(l.w === 'rocket' ? 2 : 1, l.col, 1); fg.lineBetween(l.x0, l.y0, l.x1, l.y1); }
  }

  // ---- update ---------------------------------------------------------------------------------------------------------------------------------------------
  update(dt) {
    if (!this.s) return; this.dtLast = dt; const s = this.s;
    if (!this.over) step(s, Math.min(dt, 0.1) * (this.cfg.speed ?? 1));
    const sp = 170 * dt, k = this.keys, dx = (k.ArrowRight ? 1 : 0) - (k.ArrowLeft ? 1 : 0), dy = (k.ArrowDown ? 1 : 0) - (k.ArrowUp ? 1 : 0);
    let ex = 0, ey = 0; if (this.edge) { const [x, y] = this.edge; if (x < 2) ex = -1; else if (x > VW - 3 && x < VW + 8) ex = 1; if (y < 2) ey = -1; else if (y > VH - 3 && y < VH + 8) ey = 1; }
    if (dx || dy || ex || ey) this.view(this.sx + (dx + ex) * sp, this.sy + (dy + ey) * sp);
    this.syncSprites(); this.syncOre(); this.events(); this.drawOverlay(); this.hudRefresh();
    if (s.result && !this.over) this.finish();
  }
  finish() {
    this.over = true; const s = this.s, win = s.result === 'win', h = this.h; h.sfx(win ? 'victory' : 'defeat', 0.5);
    const mine = s.units.filter((u) => u.team === 'p' && u.type !== 'harv').length;
    this.endCard = h.card([[win ? this.cfg.winText ?? 'MISSION ACCOMPLISHED' : this.cfg.loseText ?? 'BASE DESTROYED', win ? COL.good : COL.bad, 1], [`ENEMY KILLED ${s.kills}   YOUR FORCES ${mine}   TIME ${Math.floor(s.time / 60)}:${String(Math.floor(s.time % 60)).padStart(2, '0')}`, COL.text], ['PRESS ENTER', COL.gold]], { y: 60, w: 250 });
    this.doneKey = (e) => { if (e.key === 'Enter' || e.key === ' ') { this.endCard(); this.cfg.onEnd({ win, kills: s.kills, time: s.time }); } };
  }

  // ---- input -----------------------------------------------------------------------------------------------------------------------------------------------
  enemyAt(wx, wy) {
    const s = this.s, tx = wx / TS, ty = wy / TS; let best = null, bd = 0.9;
    for (const u of s.units) if (u.team === 'e') { const d = Math.hypot(u.x - tx, u.y - ty); if (d < bd) { bd = d; best = u; } }
    return best ?? s.blds.find((b) => b.team === 'e' && tx >= b.tx && tx < b.tx + b.w && ty >= b.ty && ty < b.ty + b.h);
  }
  ownAt(wx, wy) { const tx = wx / TS, ty = wy / TS; return this.s.units.filter((u) => u.team === 'p' && Math.hypot(u.x - tx, u.y - ty) < 0.8).sort((a, b) => Math.hypot(a.x - tx, a.y - ty) - Math.hypot(b.x - tx, b.y - ty))[0]; }
  pointer(p, type) {
    if (!this.s) return; const [wx, wy, lx, ly] = this.h.ptr(p); this.edge = [lx, ly]; this.cursor.setPosition(lx, ly); if (this.over) return;
    const onSide = lx >= SBX - 2; this.cursor.setFrame(!onSide && this.sel.size && this.enemyAt(wx, wy) ? 1 : 0);
    if (type === 'move') { if (this.drag) { this.drag.x1 = wx; this.drag.y1 = wy; if (Math.hypot(wx - this.drag.x0, wy - this.drag.y0) > 4) this.drag.on = true; } return; }
    if (type === 'down') {
      if (onSide) { this.sidebarClick(lx, ly); return; }
      if (p.button === 2 || p.rightButtonDown?.()) { this.rightClick(wx, wy); return; }
      if (this.amove && this.sel.size) { order(this.s, [...this.sel], { kind: 'amove', x: wx / TS, y: wy / TS }); this.amove = false; this.h.sfx('ack', 0.4); return; }
      this.drag = { x0: wx, y0: wy, x1: wx, y1: wy, on: false };
    } else if (type === 'up' && this.drag) {
      const d = this.drag; this.drag = null;
      if (d.on) {
        const x0 = Math.min(d.x0, d.x1) / TS, x1 = Math.max(d.x0, d.x1) / TS, y0 = Math.min(d.y0, d.y1) / TS, y1 = Math.max(d.y0, d.y1) / TS;
        const ids = this.s.units.filter((u) => u.team === 'p' && u.type !== 'harv' && u.x >= x0 && u.x <= x1 && u.y >= y0 && u.y <= y1).map((u) => u.id); this.sel = new Set(ids); if (ids.length) this.h.sfx('select', 0.35);
      } else {
        const own = this.ownAt(d.x0, d.y0), foe = this.enemyAt(d.x0, d.y0);
        if (own) { this.sel = new Set([own.id]); this.h.sfx('select', 0.35); }
        else if (foe && this.sel.size) { order(this.s, [...this.sel], { kind: 'attack', id: foe.id }); this.h.sfx('ack', 0.4); }
        else { const b = this.s.blds.find((q) => q.team === 'p' && d.x0 / TS >= q.tx && d.x0 / TS < q.tx + q.w && d.y0 / TS >= q.ty && d.y0 / TS < q.ty + q.h); this.sel = b ? new Set([b.id]) : new Set(); }
      }
    }
  }
  rightClick(wx, wy) {
    const ids = [...this.sel].filter((id) => this.s.units.some((u) => u.id === id)); if (!ids.length) return; const foe = this.enemyAt(wx, wy);
    if (foe) order(this.s, ids, { kind: 'attack', id: foe.id }); else order(this.s, ids, { kind: 'move', x: wx / TS, y: wy / TS });
    this.h.sfx('ack', 0.4); this.amove = false; const m = this.h.img('rui', foe ? 1 : 3, wx, wy, 3000, [0.5, 0.5]); this.h.wait(300).then(() => m.destroy());
  }
  sidebarClick(lx, ly) {
    if (ly >= 3 && ly < 63) { const k = this.s.w / 60; this.view((lx - SBX) * k * TS - MAPVW / 2, (ly - 3) * k * TS - VH / 2); return; }
    const b = this.btn.find((q) => lx >= q.x && lx < q.x + q.w && ly >= q.y && ly < q.y + q.h); if (!b) return;
    const why = train(this.s, 'p', b.type); if (why) { this.h.sfx('error', 0.4); this.say2(why, COL.bad); } else this.h.sfx('click', 0.4);
  }
  key(e, down) {
    const k = e.key.length === 1 ? e.key.toLowerCase() : e.key; this.keys[k] = down; if (!down || this.over) return;
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) e.preventDefault();
    if (k === 'a' && this.sel.size) { this.amove = true; this.say2('ATTACK-MOVE: CLICK TARGET', COL.amber); }
    else if (k === 's') { for (const u of this.s.units) if (this.sel.has(u.id)) { u.path = null; u.order = null; u.target = 0; u.amove = false; } }
    else if (k === ' ') { const f = this.s.blds.find((b) => b.team === 'p' && b.type === 'fact'); if (f) this.view(f.tx * TS - 40, f.ty * TS - 90); }
    else if (k === 'Escape') { this.sel.clear(); this.amove = false; }
    else if (/^[1-5]$/.test(k)) { const b = this.btn[+k - 1]; if (b) this.sidebarClick(b.x + 1, b.y + 1); }
  }
}
