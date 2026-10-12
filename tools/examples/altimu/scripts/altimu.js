// @nord {"id":"altimu.game","title":"Altimu 5.7 — game view","category":"games","tier":["2d"],"tags":["rpg","ultima","tile-based","turn-based"],"description":"Ultima V-style top-down RPG proof of concept (Trinsic and its forest): tile map from a text .map file, typed conversations, tactical combat screen, day/night, party following in a trail."}
// Altimu 5.7 — an Ultima V-style RPG in Ultima VII's Trinsic. Modern pixel art, Ultima V rules: tile-by-tile walking, a party that follows in a line,
// typed word conversations, a separate tactical combat screen, hunger and a day/night clock. Crowelian 2026 + Sonnet.
// Everything is data-driven: assets/maps/trinsic.map (the world), scripts/altimu/data.js (people, monsters, quest) — see GUIDE.md.
import { NordScript } from 'nord';
import { parseMap } from './altimu/mapfile.js';
import { PixelFont, PText, plain } from './altimu/pixeltext.js';
import * as D from './altimu/data.js';
import { between, hits, levelOf, hpBonus, DIRS, dist, bfsStep } from './altimu/rules.js';

const TS = 16, ZOOM = 2, W = 960, H = 544, VX = 16, VY = 16, VW = 480, VH = 416, CELL = 16;
const ARENA = 11, AX = -4000, AY = -4000;
const A = (p) => `assets/${p}`;
const PATH = { tiles: A('tiles/tiles.png'), folk: A('sprites/folk.png'), beasts: A('sprites/beasts.png'), fx: A('sprites/fx.png'), ui: A('ui/frame.png'), font: A('ui/font.png'), map: A('maps/trinsic.map') };
const SFX = (n) => `assets/audio/sfx/${n}.wav`;
const COL = { normal: '#e6e0cc', npc: '#9fd4ff', good: '#8be28b', bad: '#ff8a7a', warn: '#ffd36a', dim: '#9a96a4' };
const KEYDIR = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right', w: 'up', s: 'down', a: 'left', d: 'right', W: 'up', S: 'down', A: 'left', D: 'right' };
// Ultima V's hours (chromeTone.ts in synthwave-pixel/ultima5): dawn 5-6, full day 6-19, dusk 19-20, night otherwise.
const DAYKEYS = [[0, 0x3a4a90], [5, 0x3a4a90], [5.5, 0xe8b898], [6, 0xffffff], [19, 0xffffff], [19.5, 0xf0a878], [20, 0x3a4a90], [24, 0x3a4a90]];
const lerpColor = (a, b, t) => { const r = (c, s) => (c >> s) & 255, m = (s) => Math.round(r(a, s) + (r(b, s) - r(a, s)) * t); return (m(16) << 16) | (m(8) << 8) | m(0); };
const todColor = (min) => { const h = (min / 60) % 24; for (let i = 0; i < DAYKEYS.length - 1; i++) { const [h0, c0] = DAYKEYS[i], [h1, c1] = DAYKEYS[i + 1]; if (h >= h0 && h <= h1) return lerpColor(c0, c1, (h - h0) / (h1 - h0)); } return 0xffffff; };
const clock = (min) => { const h = Math.floor(min / 60) % 24, m = Math.floor(min % 60), d = Math.floor(min / 1440) + 1; return `DAY ${d} ${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`; };
const LOOK = { grass1: 'GRASS', grass2: 'GRASS', grass3: 'WILDFLOWERS', forestfloor: 'FOREST FLOOR', tree: 'A GREAT OAK', pine: 'A PINE TREE', bush: 'A THICKET', rock: 'A BOULDER', stump: 'A STUMP', water1: 'WATER', water2: 'WATER', deep: 'DEEP WATER', sand: 'SAND', dock: 'A WOODEN DOCK', wallStone: 'THE TOWN WALL', gateClosed: 'THE NORTH GATE, SHUT', gateOpen: 'AN OPEN GATE', cobble: 'COBBLESTONES', path: 'A DIRT ROAD', wallPlaster: 'A WALL', wallWindow: 'A WINDOWED WALL', doorClosed: 'A DOOR', doorOpen: 'AN OPEN DOOR', woodfloor: 'A WOODEN FLOOR', stonefloor: 'A STONE FLOOR', rug: 'A FINE RUG', table: 'A TABLE', chair: 'A CHAIR', bed: 'A BED', bookshelf: 'A BOOKSHELF', anvil: 'AN ANVIL', forge: 'A COLD FORGE', counter: 'A COUNTER', crate: 'A CRATE', barrel: 'A BARREL', chestClosed: 'A CHEST', chestOpen: 'AN OPEN CHEST', grave: 'A GRAVE', lamp: 'A LAMP POST', sign: 'A SIGN', well: 'THE TOWN WELL', stall: 'A MARKET STALL', stable: 'A STABLE STALL', hay: 'HAY', blood: 'BLOOD', tent: 'A TENT', campfire1: 'A CAMPFIRE', campfire2: 'A CAMPFIRE', roofRed: 'A ROOF', roofRedEdge: 'A ROOF', thatch: 'A THATCHED ROOF' };

export default class Altimu extends NordScript {
  static attributes = {
    seed: { type: 'int', default: 0, label: 'Random seed (0 = random; ?seed=N in the URL also works)' },
    startHour: { type: 'int', default: 8, min: 0, max: 23, label: 'Start hour' },
  };

  start() { this.ready = false; this.boot().catch((e) => this.game.reportError(e, this, 'boot')); }

  async boot() {
    const g = this.game, ps = this.ps = g.backend.scene;
    await g.preload(Object.values(PATH).filter((p) => p.endsWith('.png')));
    this.meta = {};
    for (const k of ['tiles', 'folk', 'beasts', 'fx', 'ui']) this.meta[k] = await g.loader.meta(PATH[k]);
    this.tileIdx = this.meta.tiles.tiles;
    this.tileName = Object.fromEntries(Object.entries(this.tileIdx).map(([k, v]) => [v, k]));
    this.map = parseMap(await g.loader.text(PATH.map), this.tileIdx);
    this.font = new PixelFont(ps, PATH.font);
    let s = this.attrs.seed || Number(new URLSearchParams(location.search).get('seed')) || (Math.random() * 1e9) | 0;
    this.rand = () => { s |= 0; s = (s + 0x6d2b79f5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };

    this.worldLayer = ps.add.layer(); this.arenaLayer = ps.add.layer().setVisible(false); this.overlayLayer = ps.add.layer(); this.hudLayer = ps.add.layer();
    this.cam = ps.cameras.main; this.cam.setViewport(VX, VY, VW, VH).setZoom(ZOOM).setRoundPixels(true);
    this.cam.ignore(this.hudLayer);
    this.uiCam = ps.cameras.add(0, 0, W, H); this.uiCam.ignore([this.worldLayer, this.arenaLayer, this.overlayLayer]);
    this.tod = ps.add.rectangle(0, 0, 3000, 3000, 0xffffff).setBlendMode(Phaser.BlendModes.MULTIPLY).setDepth(100); this.overlayLayer.add(this.tod);

    this.newGame();
    this.onKey = (e) => this.keydown(e); this.onKeyUp = (e) => this.keys.delete(e.key);
    window.addEventListener('keydown', this.onKey); window.addEventListener('keyup', this.onKeyUp);
    window.__altimu = this;
    g.audio.music('assets/audio/music/music_adventure.mp3', { volume: 0.3 });
    this.ready = true;
  }

  onDestroy() { window.removeEventListener('keydown', this.onKey); window.removeEventListener('keyup', this.onKeyUp); delete window.__altimu; }

  // ===== new game ============================================================================================================
  newGame() {
    const m = this.map;
    this.cells = [...m.cells]; this.mode = 'explore'; this.keys = new Set(); this.lock = 0; this.anim = 0; this.phase = 0; this.floaters = [];
    this.st = { x: D.START.x, y: D.START.y, dir: 'down', gold: D.START.gold, food: D.START.food, herbs: D.START.herbs, min: (this.attrs.startHour ?? 8) * 60 + 5, flags: {}, steps: 0, hunger: 0, party: [] };
    for (const id of D.START_PARTY) this.st.party.push(this.makeMember(id));
    this.st.trail = [[this.st.x - 1, this.st.y], [this.st.x - 2, this.st.y], [this.st.x - 3, this.st.y]];
    this.log = []; this.ask = null; this.talk = null; this.cb = null;
    this.buildWorld(); this.buildActors(); this.buildHud();
    this.say('ALTIMU 5.7 - TRINSIC', COL.warn);
    this.say('THE STABLES IN THE NORTH-EAST HAVE BEEN SEALED. TWO LIE DEAD INSIDE. SPEAK WITH MAYOR [FINNIGAN] (NORTH-WEST HOUSE), SEARCH THE STABLES, THEN FIND THE KILLERS.', COL.normal);
    this.say('KEYS: ARROWS/WASD MOVE - T TALK - L LOOK - E EXAMINE - G GET/OPEN - H HERB - I PARTY - J JOURNAL - SPACE WAIT', COL.dim);
    this.refreshHud(); this.updateDaylight(true);
    this.cam.startFollow(this.leader.spr, true, 0.25, 0.25); this.cam.centerOn(this.st.x * TS + 8, this.st.y * TS + 8);
  }
  makeMember(id) { const d = D.PARTY[id]; return { id, name: d.name, def: d, hp: d.hp, max: d.hp, xp: 0, lvl: 1, down: false }; }

  // ===== world rendering =====================================================================================================
  frameOf(name) { return this.tileIdx[name]; }
  put(layer, obj) { layer.add(obj); return obj; }
  buildWorld() {
    for (const s of [...(this.baseSp ?? []), ...(this.topSp ?? [])]) s?.destroy();
    const m = this.map, key = PATH.tiles; this.baseSp = new Array(m.w * m.h); this.topSp = new Array(m.w * m.h); this.animCells = [];
    for (let i = 0; i < m.cells.length; i++) {
      const c = this.cells[i], x = i % m.w, y = (i / m.w) | 0;
      this.baseSp[i] = this.put(this.worldLayer, this.ps.add.image(x * TS, y * TS, key, c.base).setOrigin(0).setDepth(0));
      if (c.top >= 0) this.topSp[i] = this.put(this.worldLayer, this.ps.add.image(x * TS, y * TS, key, c.top).setOrigin(0).setDepth(1));
      if (c.flags.has('anim')) this.animCells.push(i);
    }
  }
  setChar(x, y, ch) {
    const i = y * this.map.w + x, c = this.map.legend[ch]; this.cells[i] = c;
    this.baseSp[i].setFrame(c.base);
    if (c.top >= 0) { if (this.topSp[i]) this.topSp[i].setFrame(c.top); else this.topSp[i] = this.put(this.worldLayer, this.ps.add.image(x * TS, y * TS, PATH.tiles, c.top).setOrigin(0).setDepth(1)); } else if (this.topSp[i]) { this.topSp[i].destroy(); this.topSp[i] = null; }
  }
  cellAt(x, y) { return x < 0 || y < 0 || x >= this.map.w || y >= this.map.h ? null : this.cells[y * this.map.w + x]; }
  blocked(x, y) { const c = this.cellAt(x, y); return !c || c.flags.has('solid') || c.flags.has('water'); }
  tname(c) { return this.tileName[c.top >= 0 ? c.top : c.base]; }

  personFrame(spr, key, dir, step = 0) {
    const row = this.meta.folk.rows[key], base = row * this.meta.folk.framesPerRow;
    spr.setFrame(base + (dir === 'down' ? 0 : dir === 'up' ? 2 : 4) + (step & 1)); spr.setFlipX(dir === 'left');
  }
  buildActors() {
    for (const o of [...(this.actorSprs ?? [])]) o.destroy();
    this.actorSprs = [];
    const add = (tex, frame, x, y, depth = 5) => { const s = this.ps.add.image(x * TS, y * TS, tex, frame).setOrigin(0).setDepth(depth); this.worldLayer.add(s); this.actorSprs.push(s); return s; };
    this.add = add;
    this.npcs = Object.entries(D.NPCS).map(([id, def]) => { const n = { id, def, x: def.x, y: def.y, hx: def.x, hy: def.y, dir: 'down', step: 0, spr: add(PATH.folk, 0, def.x, def.y) }; this.personFrame(n.spr, def.sprite, 'down'); return n; });
    this.dead = D.DEAD.map((d) => ({ ...d, spr: add(PATH.beasts, d.frame, d.x, d.y, 4) }));
    this.groups = D.GROUPS.map((gd) => { const lead = gd.members.includes('chief') ? 'chief' : gd.members[0], md = D.MONSTERS[lead]; const grp = { def: gd, x: gd.at[0], y: gd.at[1], alive: true, dir: 'down', lead: md }; grp.spr = md.folk ? add(PATH.folk, 0, grp.x, grp.y) : add(PATH.beasts, md.frames[0], grp.x, grp.y); if (md.folk) this.personFrame(grp.spr, md.folk, 'down'); return grp; });
    this.followers = [];
    this.leader = { spr: add(PATH.folk, 0, this.st.x, this.st.y, 7), key: 'avatar' }; this.personFrame(this.leader.spr, 'avatar', 'down');
    this.syncParty();
  }
  syncParty() {
    const live = this.st.party.slice(1);
    while (this.followers.length > live.length) this.followers.pop().spr.destroy();
    while (this.followers.length < live.length) { const spr = this.ps.add.image(0, 0, PATH.folk, 0).setOrigin(0).setDepth(6); this.worldLayer.add(spr); this.actorSprs.push(spr); this.followers.push({ spr }); }
    live.forEach((m, i) => { const f = this.followers[i], t = this.st.trail[i] ?? [this.st.x, this.st.y]; f.key = m.def.sprite; f.spr.setPosition(t[0] * TS, t[1] * TS); this.personFrame(f.spr, f.key, this.st.dir, 0); });
  }
  moveSpr(spr, x, y, dur = 100) { this.ps.tweens.add({ targets: spr, x: x * TS, y: y * TS, duration: dur, ease: 'Linear' }); }
  float(text, wx, wy, color = '#ffffff') {
    const pt = new PText(this.ps, this.font, { x: wx, y: wy, text, color, scale: 1, origin: [0.5, 1] }); (this.mode === 'combat' ? this.arenaLayer : this.worldLayer).add(pt.img); pt.img.setDepth(60);
    this.ps.tweens.add({ targets: pt.img, y: wy - 14, alpha: 0, duration: 900, onComplete: () => pt.destroy() });
  }
  fxAt(name, wx, wy, dur = 260, layer = null) {
    const s = this.ps.add.image(wx, wy, PATH.fx, this.meta.fx.frames[name]).setOrigin(0.5).setDepth(50); (layer ?? (this.mode === 'combat' ? this.arenaLayer : this.worldLayer)).add(s);
    this.ps.tweens.add({ targets: s, alpha: 0, duration: dur, onComplete: () => s.destroy() }); return s;
  }
  sfx(n, v = 0.5, r = 1) { this.game.audio.play(SFX(n), { volume: v, rate: r }); }

  // ===== HUD ==================================================================================================================
  frame(x, y, cw, ch, fill = true) {
    const f = this.meta.ui.frames, put = (n, cx, cy) => this.hudLayer.add(this.ps.add.image(x + cx * CELL, y + cy * CELL, PATH.ui, f[n]).setOrigin(0).setScale(2));
    if (fill) this.hudLayer.add(this.ps.add.rectangle(x, y, cw * CELL, ch * CELL, 0x14101e).setOrigin(0));
    for (let cx = 1; cx < cw - 1; cx++) { put('top', cx, 0); put('bottom', cx, ch - 1); }
    for (let cy = 1; cy < ch - 1; cy++) { put('left', 0, cy); put('right', cw - 1, cy); }
    put('tl', 0, 0); put('tr', cw - 1, 0); put('bl', 0, ch - 1); put('br', cw - 1, ch - 1);
  }
  text(x, y, str = '', color = COL.normal) { return new PText(this.ps, this.font, { x, y, text: str, color, scale: 2, layer: this.hudLayer }); }
  buildHud() {
    if (this.hudBuilt) return; this.hudBuilt = true;
    this.frame(0, 0, 32, 28, false); this.frame(512, 0, 28, 28); this.frame(0, 448, 60, 6);
    this.pTxt = []; this.pBar = [];
    for (let i = 0; i < 4; i++) {
      this.pTxt.push(this.text(528, 20 + i * 40, '')); this.pBg = this.pBg ?? []; const bg = this.ps.add.rectangle(528, 40 + i * 40, 400, 8, 0x3a1a1a).setOrigin(0); this.hudLayer.add(bg); this.pBg.push(bg);
      const bar = this.ps.add.rectangle(528, 40 + i * 40, 400, 8, 0x4ca85a).setOrigin(0); this.hudLayer.add(bar); this.pBar.push(bar);
    }
    this.sTxt = [this.text(528, 184, ''), this.text(528, 204, '')];
    this.logTxt = Array.from({ length: 11 }, (_, i) => this.text(528, 244 + i * 16, ''));
    this.promptTxt = this.text(24, 466, ''); this.hintTxt = this.text(24, 490, '', COL.dim); this.hint2Txt = this.text(24, 512, '', COL.dim);
  }
  say(text, color = COL.normal) {
    const WR = 33, words = String(text).split(' '); let line = '';
    for (const w of words) { if (plain(line + ' ' + w).length > WR && line) { this.log.push([line, color]); line = w; } else line = line ? `${line} ${w}` : w; }
    if (line) this.log.push([line, color]);
    if (this.log.length > 80) this.log.splice(0, this.log.length - 80);
    this.refreshLog();
  }
  refreshLog() { const v = this.log.slice(-11); this.logTxt.forEach((t, i) => { const e = v[i - (11 - v.length)]; t.setText(e ? e[0] : ' ', e ? e[1] : COL.normal); }); }
  refreshHud() {
    const st = this.st;
    for (let i = 0; i < 4; i++) {
      const m = st.party[i];
      if (!m) { this.pTxt[i].setText(' '); this.pBar[i].setVisible(false); this.pBg[i].setVisible(false); continue; }
      this.pBg[i].setVisible(true);
      this.pTxt[i].setText(`${m.name.padEnd(8)} LV${m.lvl}  HP ${String(Math.max(0, m.hp)).padStart(3)}/${m.max}${m.down ? ' DOWN' : ''}`, m.down ? COL.bad : m.hp < m.max / 3 ? COL.warn : COL.normal);
      this.pBar[i].setVisible(true).setSize(Math.max(0, 400 * Math.max(0, m.hp) / m.max), 8).setFillStyle(m.hp < m.max / 3 ? 0xd05a4a : 0x4ca85a);
    }
    this.sTxt[0].setText(`GOLD ${st.gold}  FOOD ${st.food}  HERBS ${st.herbs}`, COL.warn);
    this.sTxt[1].setText(`${clock(st.min)}  ${this.mode === 'combat' ? 'BATTLE' : this.placeName()}`, COL.dim);
    this.refreshPrompt();
  }
  placeName() { const x = this.st.x, y = this.st.y; return x >= 22 && x <= 61 && y >= 13 && y <= 40 ? 'TRINSIC' : y > 40 ? 'THE HARBOUR' : 'TRINSIC FOREST'; }
  refreshPrompt() {
    if (this.mode === 'talk') { const t = this.talk; this.promptTxt.setText(`YOU SAY: ${t.input}_`, COL.good); this.hintTxt.setText(`ASK: ${[...t.learned].join(' ')}`, COL.warn); this.hint2Txt.setText('TYPE A WORD, ENTER (4 LETTERS COUNT) - TAB CYCLES WORDS - BYE LEAVES', COL.dim); return; }
    if (this.mode === 'combat') {
      const u = this.cb?.active; this.promptTxt.setText(this.cb?.over ? '' : u ? `${u.name}: ${this.cb.aim ? 'FIRE - PICK A DIRECTION' : 'MOVE / ATTACK'}` : 'ENEMY TURN', COL.warn);
      this.hintTxt.setText('ARROWS MOVE OR BUMP TO STRIKE - F FIRE (BOW/CROSSBOW) THEN A DIRECTION', COL.dim); this.hint2Txt.setText('H HERB - SPACE PASS', COL.dim); return;
    }
    if (this.mode === 'end') { this.promptTxt.setText(this.st.flags.won ? 'THE END OF THE PROOF OF CONCEPT - R TO PLAY AGAIN' : 'THE PARTY HAS FALLEN - R TO RETRY', COL.warn); this.hintTxt.setText(' '); this.hint2Txt.setText(' '); return; }
    this.promptTxt.setText(this.ask ? `${this.ask.toUpperCase()} - WHICH DIRECTION? (ESC CANCELS)` : 'COMMAND:', this.ask ? COL.warn : COL.good);
    this.hintTxt.setText('T)ALK  L)OOK  E)XAMINE  G)ET/OPEN  H)ERB  I)PARTY  J)OURNAL  SPACE)WAIT', COL.dim);
    this.hint2Txt.setText('BUMP INTO PEOPLE TO TALK, INTO DOORS TO OPEN THEM, INTO CHESTS TO LOOT THEM', COL.dim);
  }

  // ===== daylight =============================================================================================================
  updateDaylight(force = false) {
    const c = this.cellAt(this.st.x, this.st.y), indoor = c && [this.frameOf('woodfloor'), this.frameOf('stonefloor'), this.frameOf('rug')].includes(c.base);
    let col = todColor(this.st.min); if (indoor) col = lerpColor(col, 0xffffff, 0.65);
    this.todTarget = col; if (force) this.todNow = col;
  }

  // ===== input ================================================================================================================
  keydown(e) {
    if (!this.ready || e.ctrlKey || e.metaKey || e.altKey) return;
    const k = e.key; if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' ', 'Tab', 'Backspace'].includes(k)) e.preventDefault();
    if (this.mode === 'talk') return this.talkKey(e);
    if (this.mode === 'end') { if (k === 'r' || k === 'R') location.reload(); return; }
    if (this.mode === 'combat') return this.combatKey(e);
    if (KEYDIR[k]) { if (!e.repeat || true) this.keys.add(k); if (this.ask) { const a = this.ask; this.ask = null; this.doDirCommand(a, KEYDIR[k]); this.keys.delete(k); this.refreshPrompt(); } return; }
    if (e.repeat) return;
    switch (k.toLowerCase()) {
      case 't': this.command('talk'); break;
      case 'l': this.command('look'); break;
      case 'g': this.command('get'); break;
      case 'e': this.cmdExamine(); break;
      case 'h': this.useHerb(); break;
      case 'i': this.showParty(); break;
      case 'j': this.showJournal(); break;
      case ' ': this.tick('WAIT'); break;
      case 'escape': this.ask = null; this.refreshPrompt(); break;
    }
  }
  command(kind) {
    const adj = this.adjacent();
    if (kind === 'talk' && adj.filter((a) => a.type === 'npc').length === 1) return this.startTalk(adj.find((a) => a.type === 'npc').npc);
    this.ask = kind; this.refreshPrompt();
  }
  doDirCommand(kind, dir) {
    const [dx, dy] = DIRS[dir], x = this.st.x + dx, y = this.st.y + dy; this.st.dir = dir;
    if (kind === 'talk') { const n = this.npcAt(x, y); if (n) return this.startTalk(n); const n2 = this.npcAt(x + dx, y + dy); if (n2 && this.cellAt(x, y)?.flags.has('solid') && /counter/.test(this.tname(this.cellAt(x, y)))) return this.startTalk(n2); return this.say('NO ONE TO TALK TO.', COL.dim); }
    if (kind === 'look') return this.look(x, y);
    if (kind === 'get') return this.getAt(x, y);
  }
  adjacent() { const out = []; for (const [dx, dy] of Object.values(DIRS)) { const x = this.st.x + dx, y = this.st.y + dy, n = this.npcAt(x, y); if (n) out.push({ type: 'npc', npc: n }); } return out; }
  npcAt(x, y) { return this.npcs.find((n) => n.x === x && n.y === y); }
  deadAt(x, y) { return this.dead.find((d) => d.x === x && d.y === y); }
  groupAt(x, y) { return this.groups.find((g) => g.alive && g.x === x && g.y === y); }

  // ===== exploring ============================================================================================================
  update(dt) {
    if (!this.ready) return;
    this.anim += dt; if (this.anim > 0.5) { this.anim = 0; this.phase ^= 1; this.animate(); }
    if (this.tod && this.todNow !== undefined) { this.todNow = lerpColor(this.todNow, this.todTarget, Math.min(1, dt * 2)); this.tod.setFillStyle(this.todNow); const c = this.cam; this.tod.setPosition(c.midPoint.x, c.midPoint.y); }
    if (this.lock > 0) { this.lock -= dt; return; }
    if (this.mode === 'explore' && !this.ask && this.keys.size) { for (const k of this.keys) if (KEYDIR[k]) { this.tryMove(KEYDIR[k]); break; } }
    if (this.winAt > 0 && (this.winAt -= dt) <= 0) this.showEnding();
  }
  animate() {
    const f = this.meta.tiles.tiles;
    for (const i of this.animCells) { const c = this.cells[i], x = i % this.map.w, y = (i / this.map.w) | 0; if (c.base === f.water1 || c.base === f.water2) this.baseSp[i].setFrame(((x + y + this.phase) & 1) ? f.water2 : f.water1); if (c.top === f.campfire1 || c.top === f.campfire2) this.topSp[i]?.setFrame(this.phase ? f.campfire2 : f.campfire1); }
  }
  tryMove(dir) {
    const st = this.st, [dx, dy] = DIRS[dir], x = st.x + dx, y = st.y + dy; st.dir = dir; this.personFrame(this.leader.spr, 'avatar', dir, st.steps);
    const npc = this.npcAt(x, y); if (npc) { this.keys.clear(); return this.startTalk(npc); }
    const grp = this.groupAt(x, y); if (grp) { this.keys.clear(); return this.startCombat(grp); }
    const dead = this.deadAt(x, y); if (dead) { this.lock = 0.2; return this.say(D.LOOKS[dead.id], COL.warn); }
    const c = this.cellAt(x, y);
    if (c?.flags.has('chest')) { this.keys.clear(); this.lock = 0.25; return this.getAt(x, y); }
    if (c?.flags.has('door') && c.flags.has('solid')) { if (c.flags.has('gate')) { this.lock = 0.4; this.sfx('error', 0.3); return this.say('THE NORTH GATE IS SHUT. GILBERTO THE GUARD HOLDS THE WINCH.', COL.warn); } this.setChar(x, y, 'd'); this.sfx('open', 0.4); this.lock = 0.2; return this.say('THOU OPENEST THE DOOR.', COL.dim); }
    if (c?.flags.has('sign')) { this.lock = 0.3; return this.say(`"${D.SIGNS[`${x},${y}`] ?? 'A SIGN'}"`, COL.warn); }
    if (this.blocked(x, y)) { this.lock = 0.12; this.sfx('error', 0.15); if (c?.flags.has('water')) this.say('THOU CANNOT SWIM THERE.', COL.dim); else if (c?.flags.has('solid') && this.rand() < 0.3) this.say(`BLOCKED: ${LOOK[this.tname(c)] ?? 'SOMETHING'}.`, COL.dim); return; }
    // step
    st.trail.unshift([st.x, st.y]); st.trail.length = 3; st.x = x; st.y = y; st.steps++;
    this.moveSpr(this.leader.spr, x, y);
    this.followers.forEach((f, i) => { const t = st.trail[i]; if (!t) return; const sdx = t[0] * TS - f.spr.x; this.personFrame(f.spr, f.key, Math.abs(sdx) > 0.5 ? (sdx < 0 ? 'left' : 'right') : t[1] * TS < f.spr.y ? 'up' : 'down', st.steps); this.moveSpr(f.spr, t[0], t[1]); });
    if (st.steps % 2 === 0) this.sfx(c?.base === this.frameOf('cobble') ? 'step_stone' : 'step_grass', 0.1);
    this.lock = 0.11; this.tick();
  }
  tick(why) {
    const st = this.st; st.min += why === 'WAIT' ? 10 : 2;
    st.hunger++; if (st.hunger >= 80) { st.hunger = 0; if (st.food > 0) { st.food--; if (st.food === 3) this.say('THE PARTY GROWS HUNGRY. BUY RATIONS AT THE INN OR HARBOUR.', COL.warn); } else { this.say('STARVING! THE PARTY LOSES STRENGTH.', COL.bad); for (const m of st.party) if (!m.down) m.hp = Math.max(1, m.hp - 2); } }
    for (const n of this.npcs) this.wanderNpc(n);
    if (this.moveGroups()) return;
    this.updateDaylight(); this.refreshHud();
  }
  wanderNpc(n) {
    const r = n.def.wander; if (!r || this.rand() > 0.35 || (this.talk && this.talk.npc === n)) return;
    const [dx, dy] = Object.values(DIRS)[(this.rand() * 4) | 0], x = n.x + dx, y = n.y + dy;
    if (this.blocked(x, y) || Math.abs(x - n.hx) > r || Math.abs(y - n.hy) > r || (x === this.st.x && y === this.st.y) || this.npcAt(x, y) || this.groupAt(x, y) || this.deadAt(x, y) || this.st.trail.some((t) => t[0] === x && t[1] === y)) return;
    const dir = dx < 0 ? 'left' : dx > 0 ? 'right' : dy < 0 ? 'up' : 'down'; n.x = x; n.y = y; n.step++; this.personFrame(n.spr, n.def.sprite, dir, n.step); this.moveSpr(n.spr, x, y, 160);
  }
  moveGroups() {
    for (const g of this.groups) {
      if (!g.alive) continue; const d = dist(g, this.st);
      if (d <= 1) { this.startCombat(g); return true; }
      if (d <= g.def.aggro && this.rand() < 0.8) {
        const opts = Object.values(DIRS).map(([dx, dy]) => [g.x + dx, g.y + dy]).filter(([x, y]) => !this.blocked(x, y) && !this.npcAt(x, y) && !this.deadAt(x, y) && !this.groups.some((o) => o !== g && o.alive && o.x === x && o.y === y)).sort((a, b) => dist({ x: a[0], y: a[1] }, this.st) - dist({ x: b[0], y: b[1] }, this.st));
        if (opts[0] && dist({ x: opts[0][0], y: opts[0][1] }, this.st) < d) { const [x, y] = opts[0]; const left = x < g.x; g.x = x; g.y = y; g.spr.setFlipX(g.lead.flip ? left : g.spr.flipX); this.moveSpr(g.spr, x, y, 160); if (dist(g, this.st) <= 1) { this.startCombat(g); return true; } }
      }
    }
    return false;
  }
  look(x, y) {
    const n = this.npcAt(x, y); if (n) return this.say(`THOU SEEST ${n.def.name}.`, COL.npc);
    const dd = this.deadAt(x, y); if (dd) return this.say(D.LOOKS[dd.id], COL.warn);
    const g = this.groupAt(x, y); if (g) return this.say(`THOU SEEST ${g.def.members.map((m) => D.MONSTERS[m].name).join(', ')}!`, COL.bad);
    const c = this.cellAt(x, y); if (!c) return this.say('NOTHING.', COL.dim);
    if (c.flags.has('sign')) return this.say(`"${D.SIGNS[`${x},${y}`] ?? 'A SIGN'}"`, COL.warn);
    this.say(`THOU SEEST ${LOOK[this.tname(c)] ?? this.tname(c).toUpperCase()}.`, COL.dim);
  }
  cmdExamine() {
    const st = this.st; let found = false;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      const x = st.x + dx, y = st.y + dy, s = D.SEARCH[`${x},${y}`]; if (!s) continue;
      found = true; if (s.flag === 'rag' && !st.flags.rag) this.sfx('pickup', 0.5); st.flags.rag = true; this.say(s.say, COL.good);
    }
    if (!found) this.say('THOU FINDEST NOTHING OF NOTE.', COL.dim);
    this.tick('SEARCH');
  }
  getAt(x, y) {
    const c = this.cellAt(x, y), key = `${x},${y}`;
    if (c?.flags.has('chest')) {
      const ch = D.CHESTS[key]; if (!ch) return this.say('EMPTY.', COL.dim);
      if (this.st.flags[`chest:${key}`]) return this.say('THE CHEST IS EMPTY.', COL.dim);
      this.st.flags[`chest:${key}`] = true; this.cells[y * this.map.w + x] = { ...c, base: c.base, top: this.frameOf('chestOpen') }; this.topSp[y * this.map.w + x].setFrame(this.frameOf('chestOpen'));
      this.st.gold += ch.gold ?? 0; if (ch.item === 'letter') this.st.flags.letter = true; this.sfx('chest', 0.5); this.say(ch.text, COL.good); this.say(`+${ch.gold} GOLD.`, COL.warn); this.refreshHud(); return;
    }
    if (c?.flags.has('door') && c.flags.has('solid') && !c.flags.has('gate')) { this.setChar(x, y, 'd'); this.sfx('open', 0.4); return this.say('OPENED.', COL.dim); }
    this.say('NOTHING TO GET.', COL.dim);
  }
  useHerb() {
    const st = this.st; if (st.herbs <= 0) return this.say('NO HERBS.', COL.dim);
    const m = st.party.filter((p) => !p.down || this.mode !== 'combat').sort((a, b) => a.hp / a.max - b.hp / b.max)[0]; if (!m || m.hp >= m.max) return this.say('NO ONE NEEDS HEALING.', COL.dim);
    st.herbs--; const heal = Math.min(m.max - m.hp, 20); m.hp += heal; m.down = false; this.sfx('heal', 0.5); this.say(`${m.name} IS HEALED FOR ${heal}.`, COL.good); this.refreshHud();
  }
  showParty() { for (const m of this.st.party) this.say(`${m.name.padEnd(8)} LV${m.lvl} XP${m.xp} HP${m.hp}/${m.max} ${m.def.ranged ? m.def.ranged.name : 'MELEE'}`, COL.npc); }
  showJournal() {
    const f = this.st.flags; this.say('-- JOURNAL --', COL.warn);
    if (!f.quest) return this.say('THE STABLES ARE SEALED. FIND MAYOR FINNIGAN IN THE NORTH-WEST HOUSE.', COL.normal);
    this.say(`${f.rag ? 'X' : '-'} SEARCH THE STABLES FOR CLUES (NORTH-EAST).`); this.say(`${f.witness ? 'X' : '-'} ASK SPARK ABOUT THAT NIGHT.`);
    this.say(`${f.chiefDead ? 'X' : '-'} FIND AND BEAT THE BANDITS IN THE NORTH-WEST FOREST.`); this.say(`${f.letter ? 'X' : '-'} TAKE THE LETTER FROM THEIR CHEST.`); this.say('THEN ASK MAYOR FINNIGAN ABOUT [PROOF].', COL.warn);
  }

  // ===== conversation =========================================================================================================
  startTalk(npc) {
    this.mode = 'talk'; this.keys.clear(); const def = npc.def, st = this.st;
    this.talk = { npc, input: '', learned: new Set(['NAME', 'JOB']), ctx: this.ctx() };
    this.say(`-- ${def.name} --`, COL.warn);
    const gr = typeof def.greeting === 'function' ? def.greeting(this.talk.ctx) : def.greeting; this.noteWords(gr); this.say(gr, COL.npc);
    // face each other
    const dx = st.x - npc.x, dy = st.y - npc.y; this.personFrame(npc.spr, def.sprite, Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? 'left' : 'right') : dy < 0 ? 'up' : 'down');
    this.sfx('click', 0.3); this.refreshHud();
  }
  noteWords(t) { for (const m of String(t).matchAll(/\[([^\]]+)\]/g)) this.talk.learned.add(m[1].toUpperCase()); }
  ctx() {
    const self = this, st = this.st;
    return {
      f: st.flags, set: (k, v) => { st.flags[k] = v; }, gold: () => st.gold, give: (n) => { st.gold += n; self.sfx(n < 0 ? 'coin' : 'pickup', 0.4); }, food: (n) => { st.food += n; }, herb: (n) => { st.herbs += n; },
      healAll: () => { for (const m of st.party) { m.hp = m.max; m.down = false; } self.sfx('heal', 0.5); },
      rest: () => { const day = Math.floor(st.min / 1440); st.min = (day + 1) * 1440 + 6 * 60; for (const m of st.party) { m.hp = m.max; m.down = false; } st.food = Math.max(0, st.food - 1); self.updateDaylight(true); self.sfx('heal', 0.5); },
      join: (id) => { if (st.party.some((m) => m.id === id) || st.party.length >= 4) return false; st.party.push(self.makeMember(id)); self.syncParty(); self.talk.npc.spr.setVisible(false); self.talk.npc.x = -99; self.sfx('level_up', 0.5); return true; },
      openGate: () => { for (const x of [40, 41]) self.setChar(x, 13, 'g'); self.sfx('open', 0.5); },
      win: () => { self.winAt = 0.9; },
    };
  }
  talkKey(e) {
    const k = e.key, t = this.talk;
    if (k === 'Enter') { const raw = t.input.trim().toUpperCase(); t.input = ''; if (!raw || D.BYE.includes(raw.slice(0, 4))) return this.endTalk(); this.say(`> ${raw}`, COL.good); this.reply(raw); }
    else if (k === 'Escape') this.endTalk();
    else if (k === 'Backspace') t.input = t.input.slice(0, -1);
    else if (k === 'Tab') { const w = [...t.learned].filter((x) => !['NAME', 'JOB'].includes(x) || true); t.i = ((t.i ?? -1) + 1) % w.length; t.input = w[t.i]; }
    else if (k.length === 1 && t.input.length < 24) t.input += k.toUpperCase();
    this.refreshPrompt();
  }
  reply(raw) {
    const t = this.talk, key = raw.split(/\s+/)[0].slice(0, 4), talk = t.npc.def.talk;
    const hit = Object.keys(talk).find((w) => w.slice(0, 4) === key);
    let out = hit ? talk[hit] : null; if (typeof out === 'function') out = out(t.ctx);
    if (!out) out = D.DEFAULT_REPLY[(this.rand() * D.DEFAULT_REPLY.length) | 0];
    this.noteWords(out); this.say(out, COL.npc); this.sfx('click', 0.2); this.refreshHud();
  }
  endTalk() { this.say('FAREWELL.', COL.npc); this.mode = 'explore'; this.talk = null; this.lock = 0.15; this.refreshHud(); }

  // ===== tactical combat ======================================================================================================
  startCombat(grp) {
    this.mode = 'combat'; this.keys.clear(); this.ask = null; this.cam.stopFollow(); this.sfx('alarm', 0.3);
    const st = this.st, base = this.cellAt(st.x, st.y).base, f = this.tileIdx, treeish = [f.grass1, f.grass2, f.grass3, f.forestfloor, f.path].includes(base);
    let ground = [f.grass1, f.grass2, f.forestfloor, f.cobble, f.sand, f.woodfloor, f.stonefloor, f.path].includes(base) ? base : f.grass1; if (grp.def.camp) ground = f.grass1;
    const near = [-2, -1, 0, 1, 2].reduce((n, dy) => n + [-2, -1, 0, 1, 2].filter((dx) => this.blocked(st.x + dx, st.y + dy)).length, 0);
    const cb = this.cb = { grp, cells: [], units: [], round: 1, over: false, busy: false, active: null, aim: false };
    this.worldLayer.setVisible(false); this.arenaLayer.setVisible(true);
    for (const s of this.arenaSprs ?? []) s.destroy(); this.arenaSprs = [];
    const put = (frame, x, y, depth) => { const s = this.ps.add.image(AX + x * TS, AY + y * TS, PATH.tiles, frame).setOrigin(0).setDepth(depth); this.arenaLayer.add(s); this.arenaSprs.push(s); return s; };
    const obst = treeish ? Math.min(0.2, 0.04 + near * 0.012) : 0.03;
    for (let y = 0; y < ARENA; y++) for (let x = 0; x < ARENA; x++) {
      put(ground === f.grass1 && this.rand() < 0.3 ? (this.rand() < 0.8 ? f.grass2 : f.grass3) : ground, x, y, 0); let b = false;
      if (y > 2 && y < 8 && x > 0 && x < ARENA - 1 && this.rand() < obst) { b = true; put(treeish ? [f.tree, f.pine, f.bush, f.rock][(this.rand() * 4) | 0] : [f.crate, f.barrel][(this.rand() * 2) | 0], x, y, 1); }
      cb.cells.push(b);
    }
    // frame the arena in trees at the edge so it feels enclosed
    const spawnP = [[5, 9], [3, 9], [7, 9], [5, 10]], spawnE = [[5, 1], [3, 1], [7, 1], [4, 2], [6, 2]];
    st.party.forEach((m, i) => { if (m.down) return; const [x, y] = spawnP[i]; cb.units.push(this.mkUnit('party', m, x, y)); });
    grp.def.members.forEach((id, i) => { const [x, y] = spawnE[i]; cb.units.push(this.mkUnit('enemy', { id, ...D.MONSTERS[id], max: D.MONSTERS[id].hp, hp: D.MONSTERS[id].hp }, x, y)); });
    for (const u of cb.units) { cb.cells[u.y * ARENA + u.x] = false; }
    this.cam.centerOn(AX + ARENA * 8, AY + ARENA * 8);
    this.say(`-- BATTLE: ${[...new Set(grp.def.members.map((m) => D.MONSTERS[m].name))].join(', ')} --`, COL.bad);
    this.cbAdvance(); this.refreshHud();
  }
  mkUnit(team, ref, x, y) {
    const u = { team, ref, x, y, name: ref.name ?? ref.def?.name, acted: false, hp: ref.hp, dead: false };
    let tex = PATH.folk, frame = 0;
    if (team === 'party') { this.personFrame({ setFrame: (n) => { frame = n; }, setFlipX: () => {} }, ref.def.sprite, 'up'); }
    else if (ref.folk) this.personFrame({ setFrame: (n) => { frame = n; }, setFlipX: () => {} }, ref.folk, 'down'); else { tex = PATH.beasts; frame = ref.frames[0]; }
    u.spr = this.ps.add.image(AX + x * TS, AY + y * TS, tex, frame).setOrigin(0).setDepth(10 + y); this.arenaLayer.add(u.spr); this.arenaSprs.push(u.spr);
    if (team === 'enemy') u.spr.setFlipX(!!ref.flip && false); return u;
  }
  face(u, dir) {
    if (u.team === 'party') this.personFrame(u.spr, u.ref.def.sprite, dir, u.stepc = (u.stepc ?? 0) + 1);
    else if (u.ref.folk) this.personFrame(u.spr, u.ref.folk, dir, u.stepc = (u.stepc ?? 0) + 1); else { u.spr.setFrame(u.ref.frames[(u.stepc = (u.stepc ?? 0) + 1) & 1]); if (dir === 'left' || dir === 'right') u.spr.setFlipX(dir === 'left'); }
  }
  unitAt(x, y) { return this.cb.units.find((u) => !u.dead && u.x === x && u.y === y); }
  cbFree(x, y) { return x >= 0 && y >= 0 && x < ARENA && y < ARENA && !this.cb.cells[y * ARENA + x] && !this.unitAt(x, y); }
  cbAdvance() {
    const cb = this.cb; if (cb.over) return;
    if (!cb.units.some((u) => u.team === 'enemy' && !u.dead)) return this.cbWin();
    if (!cb.units.some((u) => u.team === 'party' && !u.dead)) return this.cbLose();
    const next = cb.units.find((u) => u.team === 'party' && !u.dead && !u.acted);
    if (next) { cb.active = next; cb.aim = false; this.cursor?.destroy(); this.cursor = this.ps.add.image(next.spr.x + 8, next.spr.y + 8, PATH.fx, this.meta.fx.frames.cursor).setDepth(90); this.arenaLayer.add(this.cursor); this.ps.tweens.add({ targets: this.cursor, alpha: 0.35, yoyo: true, repeat: -1, duration: 350 }); this.refreshPrompt(); return; }
    cb.active = null; this.cursor?.destroy(); this.cursor = null; this.refreshPrompt(); this.enemyTurn();
  }
  combatKey(e) {
    const cb = this.cb, k = e.key; if (!cb || cb.busy || cb.over) { if (cb?.over && (k === 'r' || k === 'R') && this.mode === 'end') location.reload(); return; }
    const u = cb.active; if (!u) return;
    if (KEYDIR[k]) { if (cb.aim) { cb.aim = false; this.fire(u, KEYDIR[k]); } else this.combatDir(KEYDIR[k]); return; }
    if (e.repeat) return;
    const kl = k.toLowerCase();
    if (kl === 'f') { if (!u.ref.def.ranged) return this.say(`${u.name} HAS NO RANGED WEAPON.`, COL.dim); cb.aim = true; this.refreshPrompt(); }
    else if (kl === ' ') this.endAction(u);
    else if (kl === 'h') { this.useHerb(); this.endAction(u); }
    else if (kl === 'escape') { cb.aim = false; this.refreshPrompt(); }
  }
  combatDir(dir) {
    const cb = this.cb, u = cb.active; if (!u || cb.busy) return; const [dx, dy] = DIRS[dir], x = u.x + dx, y = u.y + dy; this.face(u, dir);
    const tgt = this.unitAt(x, y);
    if (tgt && tgt.team === 'enemy') { this.lock = 0.2; return this.attack(u, tgt, u.ref.def.melee, u.ref.def.hit, 'slash'); }
    if (tgt || x < 0 || y < 0 || x >= ARENA || y >= ARENA || cb.cells[y * ARENA + x]) { this.lock = 0.1; return; }
    u.x = x; u.y = y; this.ps.tweens.add({ targets: u.spr, x: AX + x * TS, y: AY + y * TS, duration: 90 }); u.spr.setDepth(10 + y); this.sfx('step_grass', 0.15); this.lock = 0.14; this.endAction(u, 120);
  }
  fire(u, dir) {
    const r = u.ref.def.ranged, [dx, dy] = DIRS[dir]; this.face(u, dir); this.sfx('shoot', 0.4, 1.1);
    let x = u.x, y = u.y, hit = null; for (let i = 1; i <= r.range; i++) { x += dx; y += dy; if (x < 0 || y < 0 || x >= ARENA || y >= ARENA || this.cb.cells[y * ARENA + x]) break; const t = this.unitAt(x, y); if (t) { hit = t; break; } }
    const ex = AX + x * TS + 8, ey = AY + y * TS + 8, s = this.ps.add.image(AX + u.x * TS + 8, AY + u.y * TS + 8, PATH.fx, this.meta.fx.frames.arrow).setDepth(80).setAngle({ right: 0, down: 90, left: 180, up: 270 }[dir]); this.arenaLayer.add(s);
    this.cb.busy = true; this.ps.tweens.add({ targets: s, x: ex, y: ey, duration: 60 + 30 * Math.abs(x - u.x + y - u.y), onComplete: () => { s.destroy(); this.cb.busy = false; if (hit && hit.team === 'enemy') this.attack(u, hit, r.dmg, u.ref.def.hit + 5, 'spark'); else { this.float('MISS', ex, ey, COL.dim); this.endAction(u); } } });
  }
  attack(a, d, dmg, hitPct, fx) {
    const cx = AX + d.x * TS + 8, cy = AY + d.y * TS + 8;
    if (a.team === 'party' && a.ref.def?.ranged == null && fx === 'slash') this.sfx('swing', 0.4); else if (a.team === 'enemy') this.sfx('swing', 0.3, 0.9);
    if (hits(this.rand, hitPct)) {
      const n = between(this.rand, dmg); d.hp -= n; if (d.team === 'party') d.ref.hp = d.hp; this.fxAt(fx, cx, cy, 240); this.fxAt('hit', cx, cy, 300); this.float(String(n), cx, cy - 4, d.team === 'party' ? COL.bad : '#ffffff'); this.sfx('hit', 0.45, 0.9 + this.rand() * 0.3);
      this.ps.tweens.add({ targets: d.spr, x: d.spr.x + (this.rand() < 0.5 ? -2 : 2), duration: 40, yoyo: true, repeat: 2 });
      if (d.hp <= 0) this.kill(d, a);
      else if (d.team === 'party' && a.ref.poison && this.rand() < 0.5) { d.ref.hp = Math.max(1, d.ref.hp - 1); d.hp = d.ref.hp; this.say(`${d.name} IS POISONED!`, COL.bad); }
    } else { this.float('MISS', cx, cy - 4, COL.dim); this.fxAt('miss', cx, cy, 300); }
    if (a.team === 'party') this.endAction(a, 260); this.refreshHud();
  }
  kill(d, by) {
    d.dead = true; d.hp = 0;
    if (d.team === 'party') { d.ref.hp = 0; d.ref.down = true; d.spr.setTint(0x777788).setAngle(90).setOrigin(0.5).setPosition(d.spr.x + 8, d.spr.y + 8); this.say(`${d.name} FALLS!`, COL.bad); this.sfx('death', 0.4, 1.1); }
    else { this.ps.tweens.add({ targets: d.spr, alpha: 0, duration: 300 }); this.sfx('death', 0.35, 1.4); this.say(`${d.name} IS SLAIN.`, COL.good); this.cb.xp = (this.cb.xp ?? 0) + d.ref.xp; this.cb.gold = (this.cb.gold ?? 0) + d.ref.gold; }
  }
  endAction(u, delay = 140) { u.acted = true; const cb = this.cb; cb.busy = true; this.ps.time.delayedCall(delay, () => { cb.busy = false; this.cbAdvance(); }); }
  enemyTurn() {
    const cb = this.cb, enemies = cb.units.filter((u) => u.team === 'enemy' && !u.dead), acts = [];
    for (const e of enemies) acts.push(() => this.enemyAct(e));
    cb.busy = true; let i = 0; const next = () => {
      if (cb.over) return; if (i >= acts.length) { for (const u of cb.units) u.acted = false; cb.round++; cb.busy = false; return this.cbAdvance(); }
      const f = acts[i++]; if (!f) return; f(); this.ps.time.delayedCall(260, next);
    }; this.ps.time.delayedCall(200, next);
  }
  enemyAct(e) {
    if (e.dead || this.cb.over) return; const cb = this.cb;
    for (let m = 0; m < (e.ref.speed ?? 1); m++) {
      const targets = cb.units.filter((u) => u.team === 'party' && !u.dead); if (!targets.length) return; const near = targets.sort((a, b) => dist(a, e) - dist(b, e))[0];
      if (dist(near, e) === 1) { this.face(e, near.x < e.x ? 'left' : near.x > e.x ? 'right' : near.y < e.y ? 'up' : 'down'); this.attack(e, near, e.ref.dmg, e.ref.hit, 'slash'); return; }
      const step = bfsStep(e, targets, (x, y) => this.cbFree(x, y), ARENA, ARENA); if (!step || !this.cbFree(step.x, step.y)) return;
      this.face(e, step.x < e.x ? 'left' : step.x > e.x ? 'right' : step.y < e.y ? 'up' : 'down'); e.x = step.x; e.y = step.y; this.ps.tweens.add({ targets: e.spr, x: AX + step.x * TS, y: AY + step.y * TS, duration: 110 }); e.spr.setDepth(10 + e.y);
    }
  }
  cbWin() {
    const cb = this.cb, st = this.st; cb.over = true; this.cursor?.destroy(); const xp = cb.xp ?? 0, gold = cb.gold ?? 0;
    st.gold += gold; const alive = st.party.filter((m) => !m.down), share = Math.ceil(xp / Math.max(1, alive.length));
    this.say(`VICTORY! +${xp} XP, +${gold} GOLD.`, COL.good); this.sfx('win', 0.5);
    for (const m of alive) { m.xp += share; const lv = levelOf(m.xp); if (lv > m.lvl) { m.lvl = lv; const add = hpBonus(lv) - hpBonus(lv - 1); m.max += add; m.hp = Math.min(m.max, m.hp + add); this.say(`${m.name} REACHES LEVEL ${lv}!`, COL.warn); this.sfx('level_up', 0.5); } }
    for (const m of st.party) if (m.down) { m.down = false; m.hp = 1; }
    if (cb.grp.def.members.includes('chief')) { st.flags.chiefDead = true; this.say('HOB THE RED IS DEAD. HIS BAND IS BROKEN. LOOT THE CHEST IN THE CAMP FOR PROOF.', COL.warn); }
    cb.grp.alive = false; cb.grp.spr.setVisible(false);
    this.ps.time.delayedCall(900, () => this.endCombat());
  }
  cbLose() {
    this.cb.over = true; this.mode = 'end'; this.sfx('lose', 0.6); this.say('THE PARTY HAS FALLEN...', COL.bad); this.game.audio.stopMusic?.({ fade: 1 }); this.refreshPrompt();
  }
  endCombat() {
    this.arenaLayer.setVisible(false); this.worldLayer.setVisible(true); for (const s of this.arenaSprs) s.destroy(); this.arenaSprs = []; this.cb = null; this.mode = 'explore';
    this.cam.startFollow(this.leader.spr, true, 0.25, 0.25); this.lock = 0.2; this.updateDaylight(); this.refreshHud();
  }

  // ===== ending ===============================================================================================================
  showEnding() {
    this.mode = 'end'; this.sfx('win', 0.7); this.game.audio.music('assets/audio/music/jingle_victory.mp3', { volume: 0.4 });
    this.hudLayer.add(this.ps.add.rectangle(VX, VY, VW, VH, 0x0a0812, 0.82).setOrigin(0));
    const t = (y, str, c, sc) => { const p = new PText(this.ps, this.font, { x: VX + VW / 2, y, text: str, color: c, scale: sc, origin: [0.5, 0], layer: this.hudLayer }); return p; };
    t(110, 'TRINSIC IS SAVED', COL.warn, 4); t(190, 'HOB THE RED IS DEAD AND THE LETTER', COL.normal, 2); t(212, 'NAMES THE HAND BEHIND THE MURDERS.', COL.normal, 2);
    t(264, 'END OF THE PROOF OF CONCEPT', COL.good, 2); t(300, 'MORE TOWNS: SEE GUIDE.MD', COL.dim, 2); this.refreshPrompt();
  }
}
