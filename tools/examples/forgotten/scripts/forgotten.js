// @nord {"id":"forgotten.game","title":"Forgotten Wars — game view","category":"games","tier":["2d"],"tags":["strategy","turn-based","tactics","advance-wars"],"description":"Advance Wars-style turn-based tactics proof of concept: one map, Ember Legion vs Cobalt Pact, move/attack/capture/build, counter-attacks, terrain defence, a computer opponent (or hot-seat)."}
// Forgotten Wars — an Advance Wars 2-style tactics PoC (one map, you vs the AI). Crowelian 2026 + Sonnet.
// View + controller only. Rules are in fw/rules.js + fw/data.js (pure, node-testable), the computer player in fw/ai.js. See GUIDE.md.
import { NordScript } from 'nord';
import { PixelFont, PText } from './fw/pixeltext.js';
import { ARMIES, ORDER, UNITS, TERRAIN, BUILD_LIST } from './fw/data.js';
import { parseMap, newGame, reach, pathTo, targetsFrom, damage, tileAt, unitAt, doMove, doAttack, doCapture, doWait, doBuild, canBuild, endTurn, hpDisplay, key, enemyOf } from './fw/rules.js';
import { aiNext } from './fw/ai.js';

const TS = 16, VW = 320, VH = 256, ZOOM = 2, MAPH = 14 * TS;
const A = (p) => `assets/${p}`;
const PATH = { terrain: A('tiles/terrain.png'), units: A('sprites/units.png'), ui: A('ui/ui.png'), fx: A('sprites/fx.png'), icons: A('ui/icons.png'), font: A('ui/font.png'), map: A('maps/crossing.map') };
const SFX = (n) => `assets/audio/sfx/${n}.wav`;
const COL = { text: '#f4f0e0', dim: '#a8a4b8', gold: '#ffd25c', good: '#8be28b', bad: '#ff8a7a', ember: '#ff9a5c', cobalt: '#7ab4ff' };
const KEYDIR = { ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0], w: [0, -1], s: [0, 1], a: [-1, 0], d: [1, 0] };
const ROADLIKE = new Set(['road', 'bridge', 'city', 'factory', 'hq']), RIVERLIKE = new Set(['river', 'bridge', 'sea', 'shoal']);

export default class ForgottenWars extends NordScript {
  static attributes = {
    hotseat: { type: 'bool', default: false, label: 'Two human players (no computer opponent). ?hotseat=1 in the URL also works.' },
    seed: { type: 'int', default: 0, label: 'Random seed for damage luck (0 = random)' },
    aiDelay: { type: 'int', default: 160, min: 0, max: 1000, label: 'Pause between computer actions (ms)' },
  };

  start() { this.ready = false; this.boot().catch((e) => this.game.reportError(e, this, 'boot')); }

  async boot() {
    const g = this.game, ps = this.ps = g.backend.scene;
    await g.preload(Object.values(PATH).filter((p) => p.endsWith('.png')));
    this.meta = {}; for (const k of ['terrain', 'units', 'ui', 'fx', 'icons']) this.meta[k] = await g.loader.meta(PATH[k]);
    this.mapText = await g.loader.text(PATH.map);
    this.font = new PixelFont(ps, PATH.font);
    this.cam = ps.cameras.main; this.cam.setViewport(0, 0, VW * ZOOM, VH * ZOOM).setZoom(ZOOM).centerOn(VW / 2, VH / 2).setRoundPixels(true);
    const q = new URLSearchParams(location.search);
    this.humans = (this.attrs.hotseat || q.get('hotseat')) ? ['ember', 'cobalt'] : ['ember'];
    this.seed = this.attrs.seed || Number(q.get('seed')) || ((Math.random() * 1e9) | 0);
    this.onKey = (e) => this.keydown(e);
    this.onMove = (p) => this.pointer(p, false); this.onDown = (p) => this.pointer(p, true);
    window.addEventListener('keydown', this.onKey); ps.input.on('pointermove', this.onMove); ps.input.on('pointerdown', this.onDown);
    ps.input.mouse?.disableContextMenu?.();
    window.__fw = this;
    this.titleScreen();
    this.ready = true;
    ps.time.addEvent({ delay: 420, loop: true, callback: () => this.idleTick() });
  }
  onDestroy() { window.removeEventListener('keydown', this.onKey); this.ps?.input?.off('pointermove', this.onMove); this.ps?.input?.off('pointerdown', this.onDown); delete window.__fw; }

  // ===== helpers ============================================================================================================
  sfx(n, v = 0.5, r = 1) { this.game.audio.play(SFX(n), { volume: v, rate: r }); }
  wait(ms) { return new Promise((r) => this.ps.time.delayedCall(Math.max(1, ms), r)); }
  tw(cfg) { return new Promise((r) => this.ps.tweens.add({ ...cfg, onComplete: r })); }
  text(x, y, str = '', color = COL.text, depth = 90, origin = [0, 0]) { const t = new PText(this.ps, this.font, { x, y, text: str, color, scale: 1, origin }); t.setDepth(depth); this.hudObjs?.push(t); return t; }
  img(tex, frame, x, y, depth = 10) { return this.ps.add.image(x, y, PATH[tex], frame).setOrigin(0).setDepth(depth); }
  frameOf(sheet, name) { const m = this.meta[sheet]; return (m.tiles ?? m.frames)[name]; }
  unitFrame(u, anim) { const m = this.meta.units, row = m.teams.indexOf(u.owner), idx = m.units.indexOf(u.type); return row * m.framesPerRow + idx * 2 + (anim & 1); }
  float(str, x, y, color) { const t = new PText(this.ps, this.font, { x, y, text: str, color, scale: 1, origin: [0.5, 1] }); t.setDepth(80); this.tw({ targets: t.img, y: y - 12, alpha: 0, duration: 900 }).then(() => t.destroy()); }
  fx(name, x, y, dur = 220) { const s = this.ps.add.image(x, y, PATH.fx, this.frameOf('fx', name)).setOrigin(0.5).setDepth(70); this.tw({ targets: s, alpha: 0, scale: 1.4, duration: dur }).then(() => s.destroy()); }

  // ===== new game / world ====================================================================================================
  newGame() {
    for (const o of this.objs ?? []) o.destroy?.(); this.objs = []; this.sprites = new Map(); this.ovl = []; this.anim = 0;
    this.g = newGame(parseMap(this.mapText), { seed: this.seed });
    this.mode = 'select'; this.sel = null; this.cx = 3; this.cy = 6; this.menu = null; this.busy = false;
    this.buildTerrain();
    for (const u of this.g.units) this.addUnitSprite(u);
    this.curSp = this.img('ui', this.frameOf('ui', 'cursorA'), 0, 0, 40);
    this.buildHud(); this.moveCursor(this.cx, this.cy); this.refreshAll();
    this.banner(`DAY 1 - ${ARMIES[this.g.current].name}`, ARMIES[this.g.current].color);
    this.game.audio.music('assets/audio/music/music_action.mp3', { volume: 0.18 });
    this.afterTurnStart();
  }
  buildTerrain() {
    const g = this.g; this.tileSp = [];
    const at = (x, y) => tileAt(g, x, y)?.t;
    for (let y = 0; y < g.h; y++) for (let x = 0; x < g.w; x++) {
      const t = at(x, y); let name = t;
      if (t === 'road' || t === 'river') {
        const like = t === 'road' ? ROADLIKE : RIVERLIKE; let m = 0;
        [[0, -1, 1], [1, 0, 2], [0, 1, 4], [-1, 0, 8]].forEach(([dx, dy, b]) => { const n = at(x + dx, y + dy); if (n && like.has(n)) m |= b; });
        name = `${t}${m}`;
      } else if (t === 'bridge') { const n = at(x, y - 1), s = at(x, y + 1); name = (n && RIVERLIKE.has(n) && n !== 'bridge') || (s && RIVERLIKE.has(s) && s !== 'bridge') || n === 'bridge' || s === 'bridge' ? 'bridgeH' : 'bridgeV'; }
      else if (t === 'sea') name = 'sea1';
      else if (TERRAIN[t].property) name = `${t}_${tileAt(g, x, y).owner ?? 'none'}`;
      // properties and forests sit on grass; mountains too
      const sp = this.img('terrain', this.frameOf('terrain', name), x * TS, y * TS, 0); this.objs.push(sp); this.tileSp.push({ sp, t, x, y });
    }
  }
  refreshProperty(x, y) { const t = tileAt(this.g, x, y), e = this.tileSp[y * this.g.w + x]; e.sp.setFrame(this.frameOf('terrain', `${t.t}_${t.owner ?? 'none'}`)); }
  addUnitSprite(u) {
    const sp = this.img('units', this.unitFrame(u, 0), u.x * TS, u.y * TS, 20); sp.setFlipX(u.owner === 'cobalt'); this.objs.push(sp);
    const hp = new PText(this.ps, this.font, { x: u.x * TS + 15, y: u.y * TS + 16, text: ' ', color: '#ffffff', scale: 1, origin: [1, 1] }); hp.setDepth(25);
    const e = { u, sp, hp }; this.sprites.set(u.id, e); this.syncUnit(e); return e;
  }
  syncUnit(e) {
    const u = e.u, d = hpDisplay(u.hp); e.hp.setText(d < 10 ? String(d) : ' ', '#ffffff'); e.hp.setPosition(e.sp.x + 15, e.sp.y + 16);
    e.sp.setTint(u.acted && u.owner === this.g.current ? 0x8a8a98 : 0xffffff);
  }
  removeUnitSprite(id) { const e = this.sprites.get(id); if (!e) return; e.sp.destroy(); e.hp.destroy(); this.sprites.delete(id); }
  idleTick() { if (!this.g) return; this.anim++; for (const e of this.sprites.values()) e.sp.setFrame(this.unitFrame(e.u, this.anim)); const s = this.frameOf('terrain', this.anim & 1 ? 'sea2' : 'sea1'); for (const t of this.tileSp) if (t.t === 'sea') t.sp.setFrame(s); this.curSp?.setFrame(this.frameOf('ui', this.anim & 1 ? 'cursorB' : 'cursorA')); }

  // ===== title / banners =====================================================================================================
  titleScreen() {
    this.mode = 'title'; this.titleObjs = [];
    const bg = this.ps.add.rectangle(0, 0, VW, VH, 0x0c1020, 0.93).setOrigin(0).setDepth(200), add = (t) => { this.titleObjs.push(t); return t; };
    add(bg);
    const big = (str, y, col, sc) => { const t = new PText(this.ps, this.font, { x: VW / 2, y, text: str, color: col, scale: sc, origin: [0.5, 0] }); t.setDepth(201); this.titleObjs.push(t); return t; };
    big('FORGOTTEN', 38, COL.ember, 4); big('WARS', 74, COL.cobalt, 4);
    const sp = (u, x, y, flip) => { const s = this.img('units', this.unitFrame({ owner: u[0], type: u[1] }, 0), x, y, 201).setScale(2); s.setFlipX(flip); this.titleObjs.push(s); };
    sp(['ember', 'tank'], 60, 128, false); sp(['ember', 'infantry'], 20, 132, false); sp(['cobalt', 'tank'], 228, 128, true); sp(['cobalt', 'copter'], 268, 130, true);
    big('A TURN-BASED TACTICS PROOF OF CONCEPT', 172, COL.dim, 1);
    big('CAPTURE THE COBALT HQ OR DESTROY THEIR ARMY', 188, COL.text, 1);
    big('PRESS ENTER OR CLICK TO BEGIN', 212, COL.gold, 1);
    big('CROWELIAN 2026 + SONNET', 240, COL.dim, 1);
  }
  start2() { for (const o of this.titleObjs) o.destroy?.(); this.titleObjs = []; this.sfx('confirm', 0.5); this.newGame(); }
  banner(str, color = '#fff') {
    const bar = this.ps.add.rectangle(0, 100, VW, 36, 0x101830, 0.9).setOrigin(0).setDepth(150), t = new PText(this.ps, this.font, { x: VW / 2, y: 109, text: str, color, scale: 2, origin: [0.5, 0] }); t.setDepth(151);
    this.tw({ targets: [bar, t.img], alpha: 0, delay: 900, duration: 400 }).then(() => { bar.destroy(); t.destroy(); });
    return this.wait(1100);
  }

  // ===== HUD =================================================================================================================
  buildHud() {
    this.hudObjs = [];
    const bar = this.ps.add.rectangle(0, MAPH, VW, VH - MAPH, 0x141a2c).setOrigin(0).setDepth(85); this.objs.push(bar);
    this.objs.push(this.ps.add.rectangle(0, MAPH, VW, 1, 0x4a5a8a).setOrigin(0).setDepth(86));
    this.tDay = this.text(6, MAPH + 3, '', COL.gold); this.tFunds = this.text(6, MAPH + 12, '', COL.text); this.tArmy = this.text(6, MAPH + 21, '', COL.text);
    this.tTerrain = this.text(150, MAPH + 3, '', COL.text); this.tUnit = this.text(150, MAPH + 12, '', COL.text); this.tHint = this.text(150, MAPH + 21, '', COL.dim);
    this.starIcons = Array.from({ length: 4 }, (_, i) => { const s = this.img('icons', this.frameOf('icons', 'star'), 0, 0, 90).setScale(0.5).setVisible(false); this.objs.push(s); return s; });
    this.coin = this.img('icons', this.frameOf('icons', 'coin'), 0, 0, 90).setScale(0.5); this.coin.setPosition(1, MAPH + 8); this.objs.push(this.coin);
  }
  refreshAll() {
    const g = this.g, a = ARMIES[g.current];
    this.tDay.setText(`DAY ${g.day}`, COL.gold); this.tFunds.setText(`   ${g.funds[g.current]}`, COL.text); this.tArmy.setText(a.name, a.color);
    for (const e of this.sprites.values()) this.syncUnit(e);
    this.refreshInfo();
  }
  refreshInfo() {
    const g = this.g, t = tileAt(g, this.cx, this.cy), u = unitAt(g, this.cx, this.cy);
    if (!t) return;
    const tn = TERRAIN[t.t]; let extra = '';
    if (tn.property) extra = t.owner ? ` (${ARMIES[t.owner].name.split(' ')[0]})` : ' (NEUTRAL)';
    if (tn.property && t.cap < 20) extra += ` CAP ${t.cap}`;
    this.tTerrain.setText(tn.name + extra, COL.text);
    this.starIcons.forEach((s, i) => s.setVisible(i < tn.stars).setPosition(280 + i * 8, MAPH + 1));
    this.tUnit.setText(u ? `${UNITS[u.type].name}  HP ${hpDisplay(u.hp)}` : ' ', u ? ARMIES[u.owner].color : COL.text);
    const hints = { select: 'Z SELECT  X CANCEL  TAB MENU', move: 'PICK A SPOT  X CANCEL', target: 'PICK A TARGET  X BACK', menu: 'UP/DOWN + ENTER', build: 'CHOOSE A UNIT  X CLOSE', busy: ' ' };
    this.tHint.setText(this.mode === 'select' && this.isHuman() ? hints.select : hints[this.mode] ?? ' ', COL.dim);
  }
  isHuman() { return this.humans.includes(this.g.current) && !this.g.winner; }

  // ===== cursor / overlays ===================================================================================================
  moveCursor(x, y) { this.cx = Math.max(0, Math.min(this.g.w - 1, x)); this.cy = Math.max(0, Math.min(this.g.h - 1, y)); this.curSp.setPosition(this.cx * TS, this.cy * TS); if (this.mode === 'move') this.drawPath(); this.refreshInfo(); }
  clearOverlay() { for (const o of this.ovl) o.destroy(); this.ovl = []; }
  showRange(tiles, name) { for (const [x, y] of tiles) this.ovl.push(this.img('ui', this.frameOf('ui', name), x * TS, y * TS, 5)); }
  drawPath() {
    for (const o of this.pathDots ?? []) o.destroy(); this.pathDots = [];
    const s = this.sel; if (!s) return; const n = s.reach.get(key(this.cx, this.cy)); if (!n) return;
    for (const p of pathTo(n).slice(1)) this.pathDots.push(this.img('ui', this.frameOf('ui', 'pathdot'), p.x * TS, p.y * TS, 6));
  }
  attackTiles(u, x, y) { const [lo, hi] = UNITS[u.type].rng, out = []; for (let dy = -hi; dy <= hi; dy++) for (let dx = -hi; dx <= hi; dx++) { const d = Math.abs(dx) + Math.abs(dy); if (d >= lo && d <= hi && tileAt(this.g, x + dx, y + dy)) out.push([x + dx, y + dy]); } return out; }

  // ===== input ===============================================================================================================
  keydown(e) {
    if (!this.ready || e.ctrlKey || e.metaKey || e.altKey) return;
    const k = e.key; if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' ', 'Tab'].includes(k)) e.preventDefault();
    if (this.mode === 'title') { if (k === 'Enter' || k === ' ' || k === 'z') this.start2(); return; }
    if (this.mode === 'over') { if (k === 'r' || k === 'R' || k === 'Enter') this.restart(); return; }
    if (this.busy || !this.isHuman()) return;
    const d = KEYDIR[k] ?? KEYDIR[k.toLowerCase()];
    if (this.menu) {
      if (d && d[1]) this.menuMove(d[1]); else if (k === 'Enter' || k === 'z' || k === 'Z' || k === ' ') this.menuPick(); else if (k === 'Escape' || k === 'x' || k === 'X' || k === 'Backspace') this.cancel();
      return;
    }
    if (d) { this.moveCursor(this.cx + d[0], this.cy + d[1]); return; }
    if (k === 'Enter' || k === 'z' || k === 'Z' || k === ' ') this.confirm();
    else if (k === 'Escape' || k === 'x' || k === 'X' || k === 'Backspace') this.cancel();
    else if (k === 'Tab' || k === 'e' || k === 'E') this.openMenu('system');
  }
  pointer(p, down) {
    if (!this.ready) return;
    const w = this.cam.getWorldPoint(p.x, p.y), tx = Math.floor(w.x / TS), ty = Math.floor(w.y / TS);
    if (this.mode === 'title') { if (down) this.start2(); return; }
    if (this.mode === 'over') { if (down) this.restart(); return; }
    if (this.busy || !this.isHuman()) return;
    if (this.menu) { const i = this.menu.rects.findIndex((r) => w.x >= r.x && w.x < r.x + r.w && w.y >= r.y && w.y < r.y + r.h); if (i >= 0) { this.menu.i = i; this.menuDraw(); if (down) this.menuPick(); } else if (down) this.cancel(); return; }
    if (ty < 14 && tx >= 0 && tx < this.g.w) { if (tx !== this.cx || ty !== this.cy) this.moveCursor(tx, ty); }
    if (down) { if (p.rightButtonDown?.() || p.button === 2) this.cancel(); else if (ty < 14) this.confirm(); }
  }
  restart() { for (const o of this.hudObjs ?? []) o.destroy?.(); this.clearOverlay(); for (const e of [...this.sprites.values()]) this.removeUnitSprite(e.u.id); this.curSp?.destroy(); this.overObjs?.forEach((o) => o.destroy()); this.seed = (Math.random() * 1e9) | 0; this.newGame(); }

  confirm() {
    const g = this.g, u = unitAt(g, this.cx, this.cy);
    if (this.mode === 'select') {
      if (u && u.owner === g.current && !u.acted) { this.select(u); return; }
      const t = tileAt(g, this.cx, this.cy);
      if (!u && t.t === 'factory' && t.owner === g.current) { this.openMenu('build'); return; }
      if (u && u.owner !== g.current) { this.showEnemyRange(u); return; }
      this.openMenu('system'); return;
    }
    if (this.mode === 'move') {
      const n = this.sel.reach.get(key(this.cx, this.cy)); if (!n) { this.sfx('error', 0.4); return; }
      this.sel.dest = n; this.openMenu('action'); return;
    }
    if (this.mode === 'target') {
      const e = unitAt(g, this.cx, this.cy);
      if (e && this.sel.targets.includes(e)) this.commit('attack', e); else this.sfx('error', 0.4);
    }
  }
  cancel() {
    if (this.menu) { const kind = this.menu.kind; this.closeMenu(); if (kind === 'action') { this.resetSprite(); this.mode = 'move'; this.refreshInfo(); } return; }
    if (this.mode === 'target') { this.clearOverlay(); this.mode = 'move'; this.beginMoveOverlay(); this.openMenu('action'); return; }
    if (this.mode === 'move') { this.deselect(); return; }
    this.clearOverlay();
  }
  select(u) {
    this.sfx('click', 0.4); this.mode = 'move'; const r = reach(this.g, u); this.sel = { u, reach: r, dest: null, targets: [], from: { x: u.x, y: u.y } };
    this.beginMoveOverlay(); this.refreshInfo();
  }
  beginMoveOverlay() { this.clearOverlay(); const s = this.sel; this.showRange([...s.reach.values()].map((n) => [n.x, n.y]), 'move'); this.drawPath(); }
  /** put the selected unit's sprite back on its real tile (it is only previewed at the destination while the action menu is open) */
  resetSprite() { const s = this.sel; if (!s) return; const e = this.sprites.get(s.u.id); if (e) { e.sp.setPosition(s.from.x * TS, s.from.y * TS); this.syncUnit(e); } }
  deselect() { this.resetSprite(); this.clearOverlay(); for (const o of this.pathDots ?? []) o.destroy(); this.pathDots = []; this.sel = null; this.mode = 'select'; this.refreshInfo(); }
  showEnemyRange(u) {
    this.clearOverlay(); const r = reach(this.g, { ...u, owner: u.owner }); const set = new Map();
    for (const n of r.values()) for (const [x, y] of this.attackTiles(u, n.x, n.y)) set.set(key(x, y), [x, y]);
    this.showRange([...set.values()], 'attack'); this.sfx('click', 0.3);
  }

  // ===== menus ===============================================================================================================
  openMenu(kind) {
    const g = this.g; let items = [];
    if (kind === 'action') {
      const s = this.sel, u = s.u, d = s.dest, moved = d.x !== u.x || d.y !== u.y, def = UNITS[u.type];
      const t = tileAt(g, d.x, d.y);
      s.targets = !(def.indirect && moved) ? targetsFrom(g, u, d.x, d.y) : [];
      if (s.targets.length) items.push(['ATTACK', 'attack']);
      if (def.capture && TERRAIN[t.t].property && t.owner !== u.owner) items.push(['CAPTURE', 'capture']);
      items.push(['WAIT', 'wait']);
      for (const o of this.pathDots ?? []) o.destroy(); this.pathDots = [];
      // slide the sprite to the destination (preview); it only becomes real when an action is chosen
      const e = this.sprites.get(u.id); e.sp.setPosition(d.x * TS, d.y * TS); this.syncUnit(e);
    } else if (kind === 'build') {
      const t = tileAt(g, this.cx, this.cy);
      items = BUILD_LIST.map((id) => [`${UNITS[id].name.padEnd(10)} ${String(UNITS[id].cost).padStart(5)}`, id, g.funds[g.current] < UNITS[id].cost]);
      this.mode = 'build'; this.buildAt = { x: this.cx, y: this.cy, t };
    } else items = [['END TURN', 'end'], ['RESTART GAME', 'restart'], ['CANCEL', 'close']];
    this.sfx('open', 0.4);
    this.menu = { kind, items, i: Math.max(0, items.findIndex((x) => !x[2])), rects: [], objs: [] }; this.menuDraw(); this.refreshInfo();
  }
  menuDraw() {
    const m = this.menu; for (const o of m.objs) o.destroy(); m.objs = []; m.rects = [];
    const w = m.kind === 'build' ? 112 : 84, h = m.items.length * 10 + 8;
    let x = this.cx * TS + 20, y = Math.min(this.cy * TS, MAPH - h - 2); if (x + w > VW - 2) x = this.cx * TS - w - 4; if (m.kind === 'system') { x = (VW - w) / 2; y = 80; }
    const box = this.ps.add.rectangle(x, y, w, h, 0x141a2c, 0.96).setOrigin(0).setDepth(120).setStrokeStyle(1, 0xc8d0f0); m.objs.push(box);
    m.items.forEach(([label, , off], i) => {
      const ry = y + 4 + i * 10; m.rects.push({ x, y: ry, w, h: 10 });
      if (i === m.i) m.objs.push(this.ps.add.rectangle(x + 2, ry, w - 4, 10, 0x3a5aa8).setOrigin(0).setDepth(121));
      const t = new PText(this.ps, this.font, { x: x + 8, y: ry + 1, text: label, color: off ? '#6a6a7a' : i === m.i ? '#ffffff' : COL.text, scale: 1 }); t.setDepth(122); m.objs.push(t);
    });
  }
  menuMove(d) { const m = this.menu, n = m.items.length; let i = m.i; for (let k = 0; k < n; k++) { i = (i + d + n) % n; if (!m.items[i][2]) break; } m.i = i; this.sfx('hover', 0.25); this.menuDraw(); }
  closeMenu() { for (const o of this.menu?.objs ?? []) o.destroy(); this.menu = null; }
  async menuPick() {
    const m = this.menu, [, id, off] = m.items[m.i]; if (off) { this.sfx('error', 0.4); return; }
    const kind = m.kind; this.closeMenu();
    if (kind === 'system') { if (id === 'end') this.humanEndTurn(); else if (id === 'restart') this.restart(); return; }
    if (kind === 'build') { const b = this.buildAt; this.mode = 'select'; this.busy = true; const ev = doBuild(this.g, this.g.current, b.x, b.y, id); this.sfx('coin', 0.5); await this.playEvents(ev); this.busy = false; this.refreshAll(); return; }
    // action menu
    if (id === 'attack') { const s = this.sel; this.mode = 'target'; this.clearOverlay(); this.showRange(this.attackTiles(s.u, s.dest.x, s.dest.y).filter(([x, y]) => s.targets.some((t) => t.x === x && t.y === y)), 'attack'); const t0 = s.targets[0]; this.moveCursor(t0.x, t0.y); this.refreshInfo(); return; }
    this.commit(id);
  }

  // ===== performing actions (player and AI share this) =======================================================================
  async commit(act, target = null) {
    const s = this.sel; this.busy = true; this.clearOverlay(); for (const o of this.pathDots ?? []) o.destroy(); this.pathDots = [];
    const u = s.u, e = this.sprites.get(u.id); e.sp.setPosition(s.from.x * TS, s.from.y * TS);
    this.mode = 'busy'; this.sel = null; this.refreshInfo();
    await this.perform(u, pathTo(s.dest), act, target);
    this.busy = false; this.mode = 'select'; this.refreshAll(); this.checkOver();
  }
  async perform(u, path, act, target) {
    const g = this.g; let ev = [];
    if (path.length > 1) ev.push(...doMove(g, u, path)); else if (u.capturing) { /* stays capturing */ }
    await this.playEvents(ev); ev = [];
    if (act === 'attack') ev = doAttack(g, u, target); else if (act === 'capture') ev = doCapture(g, u); else ev = doWait(g, u);
    await this.playEvents(ev);
    this.syncUnit(this.sprites.get(u.id) ?? { u, sp: { setTint() {} }, hp: { setText() {}, setPosition() {} } });
  }
  async playEvents(evs) {
    for (const ev of evs) {
      if (ev.type === 'move') {
        const e = this.sprites.get(ev.id); this.sfx('whoosh', 0.2, 1.4);
        for (let i = 1; i < ev.path.length; i++) { const p = ev.path[i], q = ev.path[i - 1]; if (p.x !== q.x) e.sp.setFlipX(p.x < q.x); await this.tw({ targets: e.sp, x: p.x * TS, y: p.y * TS, duration: 70, onUpdate: () => e.hp.setPosition(e.sp.x + 15, e.sp.y + 16) }); }
        e.hp.setPosition(e.sp.x + 15, e.sp.y + 16);
        e.sp.setFlipX(e.u.owner === 'cobalt'); this.syncUnit(e);
      } else if (ev.type === 'hit') {
        const e = this.sprites.get(ev.id); if (!e) continue; const att = this.sprites.get(ev.by);
        if (att) { const dx = Math.sign(e.sp.x - att.sp.x), dy = Math.sign(e.sp.y - att.sp.y); this.tw({ targets: att.sp, x: att.sp.x + dx * 4, y: att.sp.y + dy * 4, duration: 70, yoyo: true }); }
        this.sfx(ev.counter ? 'hit' : (['artillery', 'tank', 'mdtank'].includes(att?.u.type) ? 'shoot' : 'hit'), 0.45, ev.counter ? 1.2 : 1);
        this.fx('spark', e.sp.x + 8, e.sp.y + 8, 260); e.sp.setTint(0xff6a5a); this.float(`-${ev.dmg}`, e.sp.x + 8, e.sp.y, COL.bad);
        await this.wait(240); e.sp.clearTint(); this.syncUnit(e); e.hp.setText(hpDisplay(ev.hp) < 10 && ev.hp > 0 ? String(hpDisplay(ev.hp)) : ' ');
        await this.wait(120);
      } else if (ev.type === 'die') {
        const e = this.sprites.get(ev.id); const cx = ev.x * TS + 8, cy = ev.y * TS + 8; this.sfx('explosion_small', 0.5);
        for (const n of ['boom1', 'boom2', 'boom3', 'boom4']) { const s = this.ps.add.image(cx, cy, PATH.fx, this.frameOf('fx', n)).setDepth(75); if (n === 'boom2') e?.sp.setVisible(false); this.tw({ targets: s, alpha: 0, duration: 160 }).then(() => s.destroy()); await this.wait(95); }
        this.removeUnitSprite(ev.id);
      } else if (ev.type === 'capturing') { const e = this.sprites.get(ev.id); this.sfx('pickup', 0.35); this.float(`CAP ${ev.left}`, e.sp.x + 8, e.sp.y, COL.gold); await this.wait(350); }
      else if (ev.type === 'captured') { this.refreshProperty(ev.x, ev.y); this.sfx('level_up', 0.4); this.float('CAPTURED!', ev.x * TS + 8, ev.y * TS, COL.gold); await this.wait(500); }
      else if (ev.type === 'build') { const u = this.g.units.find((x) => x.id === ev.id); this.addUnitSprite(u); this.fx('spark', ev.x * TS + 8, ev.y * TS + 8); await this.wait(120); }
      else if (ev.type === 'repair') { const e = this.sprites.get(ev.id); if (e) { this.float('+2', e.sp.x + 8, e.sp.y, COL.good); this.syncUnit(e); } }
    }
  }

  // ===== turns / AI ==========================================================================================================
  humanEndTurn() { if (this.busy) return; this.endAndStart(); }
  async endAndStart() {
    this.busy = true; this.clearOverlay(); this.sel = null; this.mode = 'busy';
    const ev = endTurn(this.g); this.refreshAll(); await this.banner(`DAY ${this.g.day} - ${ARMIES[this.g.current].name}`, ARMIES[this.g.current].color);
    await this.playEvents(ev.filter((x) => x.type === 'repair')); this.refreshAll(); this.busy = false; this.mode = 'select';
    this.afterTurnStart();
  }
  afterTurnStart() { if (this.g.winner) return; if (!this.humans.includes(this.g.current)) this.runAI(); else this.refreshInfo(); }
  async runAI() {
    this.busy = true; this.mode = 'busy'; this.refreshInfo(); await this.wait(250);
    const g = this.g, me = g.current; let guard = 0;
    while (!g.winner && g.current === me && guard++ < 400) {
      const a = aiNext(g);
      if (a.end) break;
      if (a.build) { this.moveCursor(a.build.x, a.build.y); const ev = doBuild(g, me, a.build.x, a.build.y, a.build.type); this.sfx('coin', 0.3); await this.playEvents(ev); }
      else { this.moveCursor(a.unit.x, a.unit.y); await this.wait(this.attrs.aiDelay); await this.perform(a.unit, a.path, a.act, a.target); }
      this.refreshAll(); if (this.checkOver()) return;
      await this.wait(this.attrs.aiDelay * 0.5);
    }
    if (this.g.winner) return;
    this.busy = false; await this.endAndStart();
  }
  checkOver() {
    const g = this.g; if (!g.winner || this.mode === 'over') return !!g.winner;
    this.mode = 'over'; this.busy = false; this.overObjs = [];
    const human = this.humans.includes(g.winner), str = this.humans.length > 1 ? `${ARMIES[g.winner].name} WINS` : human ? 'VICTORY' : 'DEFEAT';
    this.sfx(human ? 'win' : 'lose', 0.6);
    const bar = this.ps.add.rectangle(0, 84, VW, 72, 0x101830, 0.92).setOrigin(0).setDepth(150); this.overObjs.push(bar);
    const t1 = new PText(this.ps, this.font, { x: VW / 2, y: 96, text: str, color: ARMIES[g.winner].color, scale: 4, origin: [0.5, 0] }); t1.setDepth(151); this.overObjs.push(t1);
    const t2 = new PText(this.ps, this.font, { x: VW / 2, y: 136, text: `DAY ${g.day} - PRESS R OR CLICK TO PLAY AGAIN`, color: COL.dim, scale: 1, origin: [0.5, 0] }); t2.setDepth(151); this.overObjs.push(t2);
    return true;
  }
}
