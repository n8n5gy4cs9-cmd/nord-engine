// Tactical view (UFO Defense look): isometric 32x16 tiles, fog of war, move/shoot with TU, reaction fire, event replay. Rules live in tactical.js.
import { VW, VH, COL, UI } from './base.js';
import { RACES, WEAPONS, key, newMission, at, live, solid, reach, pathTo, moveTo, shoot, canShoot, hitChance, shotCost, endPlayerTurn, computeSeen, visibleAlien } from './tactical.js';

const OX = 384, OY = 24, HUDY = 160;
const GFR = { grass: 0, dirt: 1, metal: 2, field: 3, road: 4 }, OFR = { wood: 0, hull: 1, power: 2, crate: 3, tree: 4 }, RACE_IDX = { soldier: 0, sectoid: 1, muton: 2 };
const iso = (x, y) => [OX + (x - y) * 16, OY + (x + y) * 8];

export class TacView {
  constructor(host) { this.h = host; }
  start({ squad, seed, aliens, mods, onEnd }) {
    const h = this.h, ps = h.ps; this.onEnd = onEnd; this.s = newMission({ seed, squad, aliens, mods });
    this.objs = []; this.spr = new Map(); this.tiles = []; this.mode = 'snap'; this.sel = null; this.busy = false; this.fxs = []; this.preview = []; this.hover = [0, 0]; this.over = false; this.anim = 0;
    const s = this.s;
    for (let y = 0; y < s.h; y++) for (let x = 0; x < s.w; x++) {
      const [sx, sy] = iso(x, y), gi = s.g[y * s.w + x];
      const t = { g: h.img('tground', GFR[gi], sx, sy, -1000 + (x + y) * 10, [0.5, 0]), o: null, x, y }; this.objs.push(t.g);
      const o = s.o[y * s.w + x]; if (o) { t.o = h.img('tobjects', OFR[o], sx, o === 'tree' ? sy - 14 : sy - 16, (x + y) * 10 + 5, [0.5, 0]); this.objs.push(t.o); }
      this.tiles.push(t);
    }
    for (const u of s.units) this.addSprite(u);
    this.cursor = h.img('tui', 0, 0, 0, 3000, [0.5, 0]); this.objs.push(this.cursor);
    this.ovl = []; this.buildHud(); this.refresh(); this.select(live(s, 'x')[0]); this.focus(this.sel, true);
    h.music('music_tactical', 0.22); this.msg(`MISSION START - ${s.aliensTotal} HOSTILES DETECTED`);
    this.timer = ps.time.addEvent({ delay: 380, loop: true, callback: () => { this.anim++; this.idle(); } });
  }
  destroy() { if (!this.s) return; this.timer?.remove(); for (const o of [...this.objs, ...this.ovl, ...this.fxs, ...this.preview]) o.destroy?.(); for (const e of this.spr.values()) e.sp.destroy(); this.spr.clear(); this.h.hud.removeAll(true); this.s = null; }

  // ---- sprites -----------------------------------------------------------------------------------------------------------------------
  frame(u, st) { return RACE_IDX[u.race] * 5 + st; } // 0 idle · 1 walk · 2 aim · 3 shoot · 4 dead
  addSprite(u) { const [sx, sy] = iso(u.x, u.y), sp = this.h.img('tunits', this.frame(u, 0), sx, sy + 13, (u.x + u.y) * 10 + 8, [0.5, 1]); sp.setFlipX(u.face < 0); this.spr.set(u.id, { u, sp, x: u.x, y: u.y }); }
  place(e, x, y) { const [sx, sy] = iso(x, y); e.x = x; e.y = y; e.sp.setPosition(sx, sy + 13).setDepth((x + y) * 10 + 8); }
  idle() { for (const e of this.spr.values()) if (!e.u.dead && !this.busy) e.sp.setFrame(this.frame(e.u, 0)).setY(iso(e.x, e.y)[1] + 13 + (e.u.race === 'sectoid' && this.anim % 2 ? 0 : 0)); this.cursor.setAlpha(this.anim % 2 ? 0.6 : 1); }
  focus(u, snap = false) { if (!u) return; const [x, y] = iso(u.x, u.y); if (snap) this.h.camCenter(x, y - 10); else this.h.panTo(x, y - 10); }
  keepInView(x, y) {
    const h = this.h, dx = x < h.vx + 32 ? x - (h.vx + 64) : x > h.vx + VW - 32 ? x - (h.vx + VW - 64) : 0;
    const dy = y < h.vy + 28 ? y - (h.vy + 44) : y > h.vy + HUDY - 24 ? y - (h.vy + HUDY - 40) : 0;
    if (dx || dy) h.panTo(h.vx + VW / 2 + dx, h.vy + VH / 2 + dy, 350);
  }
  // fog of war: never-seen tiles black, remembered tiles dim, visible tiles normal; aliens only drawn when in view
  refresh() {
    const s = this.s; computeSeen(s);
    for (const t of this.tiles) { const k = key(t.x, t.y), v = s.vis.has(k), sn = s.seen.has(k), tint = v ? 0xffffff : sn ? 0x6a6a82 : 0x000000; t.g.setTint(tint); t.o?.setTint(tint); t.g.setVisible(sn); t.o?.setVisible(sn); }
    for (const e of this.spr.values()) { const u = e.u; e.sp.setVisible(u.side === 'x' || (s.vis.has(key(u.x, u.y)) || u.dead && s.seen.has(key(u.x, u.y)))); e.sp.setTint(u.dead && !s.vis.has(key(u.x, u.y)) ? 0x6a6a82 : 0xffffff); if (u.dead) e.sp.setFrame(this.frame(u, 4)); }
    this.hudRefresh();
  }

  // ---- selection + overlays -------------------------------------------------------------------------------------------------------------
  select(u) {
    if (!u || u.dead || u.side !== 'x') return; this.sel = u; this.reachMap = reach(this.s, u, u.tu); this.drawRange(); this.hudRefresh();
    for (const e of this.spr.values()) e.sp.setAlpha(1);
  }
  drawRange() { for (const o of this.ovl) o.destroy(); this.ovl = []; const u = this.sel; if (!u || this.busy) return;
    const R = this.reachMap; for (const [k, v] of R) { if (v.tu === 0) continue; const x = k % 32, y = (k / 32) | 0; if (v.tu > u.tu) continue; const [sx, sy] = iso(x, y); this.ovl.push(this.h.img('tui', 1, sx, sy, -500 + (x + y) * 0.1, [0.5, 0]).setAlpha(0.55)); } }
  drawPath(x, y) { for (const o of this.preview) o.destroy(); this.preview = []; const u = this.sel; if (!u || !this.reachMap?.has(key(x, y)) || this.busy) { this.pathTu = null; return; }
    const p = pathTo(this.reachMap, x, y); this.pathTu = this.reachMap.get(key(x, y)).tu;
    for (const [px, py] of p) { const [sx, sy] = iso(px, py); this.preview.push(this.h.rect(0, 0, 3, 3, 0xffe060, 1, false).setPosition(sx - 1, sy + 7).setDepth(2900)); } }
  tileAt(wx, wy) { const a = (wx - OX) / 16, b = (wy - OY - 8) / 8; return [Math.round((a + b) / 2), Math.round((b - a) / 2)]; }
  alienAt(x, y) { const u = at(this.s, x, y); return u && u.side === 'a' && visibleAlien(this.s, u) ? u : null; }

  // ---- HUD ------------------------------------------------------------------------------------------------------------------------------------
  buildHud() {
    const h = this.h; this.hudGroup = [];
    const add = (o) => { this.hudGroup.push(o); return o; };
    add(h.panel(0, HUDY, VW, VH - HUDY, UI.metal, { depth: 0 })); add(h.panel(3, HUDY + 3, 68, 34, 0x1a1810, { raised: false, depth: 1 }));
    this.tName = add(h.text(6, HUDY + 4, '', COL.gold, { hud: true, depth: 6 })); this.tStat = add(h.text(6, HUDY + 13, '', COL.text, { hud: true, depth: 6 })); this.tStat2 = add(h.text(6, HUDY + 26, '', COL.text, { hud: true, depth: 6 })); this.tInfo = this.tStat2;
    this.barTu = add(h.rect(6, HUDY + 22, 62, 3, 0x40d040, 1)); this.barHp = add(h.rect(6, HUDY + 35, 62, 3, 0xe03030, 1));
    this.btns = [];
    const mk = (id, x, y, w, label) => { const bg = add(h.panel(x, y, w, 15, 0x7a7660, { depth: 1 })); const t = add(h.text(x + w / 2, y + 4, label, COL.text, { origin: [0.5, 0], hud: true, depth: 6 })); this.btns.push({ id, x, y, w, h: 15, bg, t }); };
    mk('snap', 74, HUDY + 5, 78, 'SNAP'); mk('aimed', 74, HUDY + 22, 78, 'AIMED'); mk('auto', 156, HUDY + 5, 78, 'AUTO'); mk('next', 156, HUDY + 22, 78, 'NEXT [TAB]');
    mk('end', 238, HUDY + 5, 76, 'END TURN'); mk('help', 238, HUDY + 22, 76, 'ENTER=END');
    this.tTurn = add(h.text(4, 3, '', COL.text, { hud: true, depth: 6 })); this.tMsg = add(h.text(VW / 2, 12, '', COL.gold, { origin: [0.5, 0], hud: true, depth: 6 }));
    this.tTip = add(h.text(VW - 4, 3, '', COL.dim, { origin: [1, 0], hud: true, depth: 6 }));
  }
  hudRefresh() {
    const s = this.s, u = this.sel; if (!this.tName) return;
    if (u && !u.dead) { this.tName.setText(`${u.name.toUpperCase()} K${u.kills}`, COL.gold); this.tStat.setText(`TU ${u.tu}/${u.maxTu}`, COL.good); this.barTu.width = Math.max(0.1, 62 * u.tu / u.maxTu); this.barHp.width = Math.max(0.1, 62 * u.hp / u.max); this.tStat2.setText(`HP ${u.hp}/${u.max}`, COL.bad); } else this.tName.setText('NO SELECTION', COL.dim);
    this.tTurn.setText(`TURN ${s.turn}  ALIENS ${live(s, 'a').length}  SQUAD ${live(s, 'x').length}`, COL.text);
    for (const b of this.btns) { const on = b.id === this.mode; b.bg.setFillStyle(on ? 0xb88a28 : 0x7a7660);
      if (['snap', 'aimed', 'auto'].includes(b.id) && u) { const w = WEAPONS[u.weapon][b.id]; b.t.setText(`${b.id.toUpperCase()} ${Math.round(u.firing * w[0] / 100)}% ${shotCost(u, b.id)}`, on ? '#ffffff' : COL.text); } }
  }
  msg(str, col = COL.gold) { this.tMsg.setText(str, col); this.msgT = this.h.ps.time.delayedCall(2500, () => this.tMsg?.setText('', col)); }

  // ---- input ----------------------------------------------------------------------------------------------------------------------------------------
  hudClick(lx, ly) { if (ly < HUDY) return false; const b = this.btns.find((q) => lx >= q.x && lx < q.x + q.w && ly >= q.y && ly < q.y + q.h); if (!b) return true; this.h.sfx('click', 0.4);
    if (b.id === 'end') this.endTurn(); else if (b.id === 'next') this.next(); else if (['snap', 'aimed', 'auto'].includes(b.id)) { this.mode = b.id; this.hudRefresh(); } return true; }
  pointer(p, down) {
    if (this.over || !this.s) return; const [wx, wy, lx, ly] = this.h.ptr(p), [tx, ty] = this.tileAt(wx, wy);
    if (ly >= HUDY) { if (down) this.hudClick(lx, ly); return; }
    this.hover = [tx, ty]; const [cxp, cyp] = iso(Math.max(0, Math.min(23, tx)), Math.max(0, Math.min(23, ty))); this.cursor.setPosition(cxp, cyp).setDepth(3000);
    const al = this.alienAt(tx, ty), u = this.sel;
    if (!down) { if (al && u) this.tTip.setText(`${RACES[al.race].name} HIT ${hitChance(this.s, u, al, this.mode)}%`, COL.bad); else if (this.pathTu !== undefined && this.reachMap?.has(key(tx, ty))) this.tTip.setText(`MOVE COST ${this.reachMap.get(key(tx, ty)).tu} TU`, COL.good); else this.tTip.setText('', COL.dim); this.drawPath(tx, ty); return; }
    if (this.busy) return; if (p.rightButtonDown?.()) { this.cycleMode(); return; }
    const own = at(this.s, tx, ty); if (own && own.side === 'x') { this.select(own); this.h.sfx('select', 0.4); return; }
    if (!u) return;
    if (al) { this.fire(u, al); return; }
    if (this.reachMap.has(key(tx, ty)) && !solid(this.s, tx, ty)) this.move(u, tx, ty);
  }
  cycleMode() { this.mode = this.mode === 'snap' ? 'aimed' : this.mode === 'aimed' ? 'auto' : 'snap'; this.hudRefresh(); }
  key(e) {
    if (this.over || !this.s) return; const k = e.key;
    if (k === '1') this.mode = 'snap'; else if (k === '2') this.mode = 'aimed'; else if (k === '3') this.mode = 'auto';
    else if (k === 'Tab' || k === ' ') this.next(); else if (k === 'Enter' || k === 'e' || k === 'E') this.endTurn();
    else { const d = { ArrowLeft: [24, 0], ArrowRight: [-24, 0], ArrowUp: [0, 24], ArrowDown: [0, -24] }[k]; if (d) { this.h.panTo(this.h.vx + VW / 2 - d[0], this.h.vy + VH / 2 - d[1], 150); } }
    this.hudRefresh();
  }
  next() { const l = live(this.s, 'x'); if (!l.length) return; const i = l.indexOf(this.sel); const n = l[(i + 1) % l.length]; this.select(n); this.focus(n); this.h.sfx('select', 0.4); }

  // ---- actions (sim first, then replay the events) -------------------------------------------------------------------------------------------
  async move(u, x, y) { this.busy = true; this.drawPath(-1, -1); const ev = moveTo(this.s, u, x, y); await this.replay(ev); this.busy = false; this.afterAction(); }
  async fire(u, t) { const why = canShoot(this.s, u, t, this.mode); if (why) { this.msg(why, COL.bad); this.h.sfx('error', 0.4); return; } this.busy = true; const r = shoot(this.s, u, t, this.mode); await this.replay(r.ev); this.busy = false; this.afterAction(); }
  afterAction() {
    this.refresh(); if (this.s.result) return this.finish();
    if (this.sel?.dead) { const n = live(this.s, 'x')[0]; if (n) { this.select(n); this.focus(n); } } else this.select(this.sel);
  }
  async endTurn() {
    if (this.busy || this.over) return; this.busy = true; this.h.sfx('endturn', 0.45); this.msg('ALIEN ACTIVITY...', COL.bad); for (const o of this.ovl) o.destroy(); this.ovl = [];
    const ev = endPlayerTurn(this.s); await this.replay(ev, true); this.busy = false; this.refresh(); if (this.s.result) return this.finish();
    this.msg(`TURN ${this.s.turn}`, COL.good); const n = live(this.s, 'x')[0]; this.select(this.sel?.dead ? n : this.sel); if (this.sel) this.focus(this.sel);
  }
  async replay(events, aliens = false) {
    for (const ev of events) {
      if (ev.t === 'move') { const e = this.spr.get(ev.id); if (!e) continue; const [tx, ty] = iso(ev.x, ev.y), vis = this.s.vis.has(key(ev.x, ev.y)) || this.s.vis.has(key(ev.x0, ev.y0)) || e.u.side === 'x';
        if (e.u.side === 'a') e.sp.setVisible(vis); e.sp.setFlipX(ev.x < ev.x0 || ev.y > ev.y0 && ev.x <= ev.x0); e.sp.setFrame(this.frame(e.u, 1)); this.h.sfx('step', 0.25, 0.9 + Math.random() * 0.2);
        if (vis) this.keepInView(tx, ty); const ox = e.sp.x, oy = e.sp.y, distance = Math.hypot(tx - ox, ty + 13 - oy), duration = vis ? 220 : 1;
        await this.h.tw({ targets: e.sp, x: tx, y: ty + 13, duration, ease: 'Linear', onUpdate: () => {
          const progress = distance ? Math.min(1, Math.hypot(e.sp.x - ox, e.sp.y - oy) / distance) : 1;
          e.sp.setFrame(this.frame(e.u, progress < 0.5 ? 1 : 0));
          e.sp.setDepth((e.sp.y - 13 - OY) / 8 * 10 + 8);
        } }); e.x = ev.x; e.y = ev.y; e.sp.setDepth((ev.x + ev.y) * 10 + 8); e.sp.setFrame(this.frame(e.u, 0)); if (e.u.side === 'x') computeSeen(this.s), this.refreshFog(); }
      else if (ev.t === 'shot') await this.playShot(ev);
      else if (ev.t === 'die') { const e = this.spr.get(ev.id); if (!e) continue; this.h.sfx(e.u.side === 'x' ? 'die_human' : 'die_alien', 0.5); e.sp.setFrame(this.frame(e.u, 4)); e.sp.setDepth((e.x + e.y) * 10 + 2); await this.h.wait(250); }
    }
    for (const e of this.spr.values()) this.place(e, e.u.x, e.u.y);
  }
  refreshFog() { const s = this.s; for (const t of this.tiles) { const k = key(t.x, t.y), v = s.vis.has(k), sn = s.seen.has(k); t.g.setTint(v ? 0xffffff : sn ? 0x6a6a82 : 0).setVisible(sn); t.o?.setTint(v ? 0xffffff : 0x6a6a82).setVisible(sn); }
    for (const e of this.spr.values()) if (e.u.side === 'a' && !e.u.dead) e.sp.setVisible(s.vis.has(key(e.x, e.y))); }
  async playShot(ev) {
    const a = this.spr.get(ev.from), t = this.spr.get(ev.to); if (!a || !t) return; const h = this.h, [fx, fy] = iso(ev.fx, ev.fy), [tx, ty] = iso(ev.tx, ev.ty), seen = this.s.vis.has(key(ev.fx, ev.fy)) || this.s.vis.has(key(ev.tx, ev.ty));
    a.sp.setFlipX(ev.tx < ev.fx || (ev.tx === ev.fx && ev.ty > ev.fy)); if (!seen) return;
    if (ev.reaction) this.msg('REACTION FIRE!', COL.bad); this.keepInView((fx + tx) / 2, (fy + ty) / 2); a.sp.setFrame(this.frame(a.u, 3)); h.sfx(ev.shot === 'plasma' ? 'plasma' : 'rifle', 0.5);
    const b = h.img('tfx', ev.shot === 'plasma' ? 5 : 6, fx, fy + 4, 3500, [0.5, 0.5]); this.fxs.push(b);
    await h.tw({ targets: b, x: tx, y: ty + 2, duration: 110 }); b.destroy(); a.sp.setFrame(this.frame(a.u, 2));
    if (ev.hit) { h.sfx('hit', 0.5); const sp = h.img('tfx', 4, tx, ty - 4, 3500, [0.5, 0.5]); const f = h.text(tx, ty - 22, `-${ev.dmg}`, ev.dmg ? COL.bad : COL.dim, { origin: [0.5, 1], depth: 3600 }); h.tw({ targets: f.img, y: ty - 34, alpha: 0, duration: 800 }).then(() => f.destroy()); await h.wait(110); sp.destroy(); t.sp.setFrame(this.frame(t.u, 0)); }
    else { const f = h.text(tx, ty - 22, 'MISS', COL.dim, { origin: [0.5, 1], depth: 3600 }); h.tw({ targets: f.img, y: ty - 32, alpha: 0, duration: 600 }).then(() => f.destroy()); await h.wait(100); }
    if (ev.dmg >= 0) { if (!t.u.dead) { /* hp shown in HUD */ } } a.sp.setFrame(this.frame(a.u, 0));
    if (t.u.dead) { for (let i = 1; i <= 3; i++) { const bm = h.img('tfx', i - 1, tx, ty - 2, 3500, [0.5, 0.5]); this.fxs.push(bm); await h.wait(80); bm.destroy(); } }
  }
  finish() {
    this.over = true; const s = this.s, win = s.result === 'win'; this.h.sfx(win ? 'victory' : 'defeat', 0.5);
    const dead = s.units.filter((u) => u.side === 'x' && u.dead).length;
    this.endCard = this.h.card([[win ? 'MISSION SUCCESSFUL' : 'MISSION FAILED - SQUAD LOST', win ? COL.good : COL.bad, 1], [`ALIENS KILLED ${s.kills}   SOLDIERS LOST ${dead}`, COL.text], ['PRESS ENTER', COL.gold]], { y: 56 });
    this.after = true; this.doneKey = (e) => { if (e.key === 'Enter' || e.key === ' ') { this.endCard(); this.onEnd({ win, kills: s.kills, survivors: s.units.filter((u) => u.side === 'x' && !u.dead).map((u) => u.mem), dead }); } };
  }
}
