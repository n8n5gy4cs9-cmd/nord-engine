// @nord {"id":"rpd.dungeon","title":"RetroPaxDungeons — game view","category":"games","tier":["2d"],"tags":["roguelike","turn-based","dungeon","shattered-pixel-dungeon"],"description":"Turn-based dungeon crawler view/controller for the RetroPaxDungeons example: renders the level (tiles, fog of war, sprites, minimap, HUD) with Phaser objects and feeds input to the pure rules in rpd/world.js."}
// RetroPaxDungeons — a one-level proof of concept in the spirit of Shattered Pixel Dungeon (GPL-3.0; source link in README.md and THIRD_PARTY.md).
// Rules/AI/level logic are ported from SPD (see rpd/*.js); all art is original, redrawn pixel art (tools/art/rpd). Crowelian 2026 + Sonnet.
import { NordScript } from 'nord';
import { World, SLEEPING, WANDERING, HUNTING } from './rpd/world.js';
import { T } from './rpd/levelgen.js';
import { findPath } from './rpd/pathfinder.js';
import { PixelFont, PText } from './rpd/pixeltext.js';
import { WEAPONS, ARMORS } from './rpd/items.js';

const TS = 16, ZOOM = 3, W = 960, H = 540, STEP = 0.11;
const A = (p) => `assets/${p}`;
const PATH = { tiles: A('tiles/dungeon.png'), hero: A('sprites/hero.png'), rat: A('sprites/rat.png'), albino: A('sprites/albino.png'), gnoll: A('sprites/gnoll.png'), crab: A('sprites/crab.png'), goo: A('sprites/goo.png'), items: A('sprites/items.png'), fx: A('sprites/fx.png'), ui: A('ui/ui.png'), font: A('ui/font.png') };
const SFX = (n) => `assets/audio/sfx/${n}.wav`;
const COLORS = { normal: '#d9d6e8', good: '#8be28b', bad: '#ff7a7a', warn: '#ffd36a' };
const hex = (s) => parseInt(s.slice(1), 16);
const ITEM_FRAME = (it) => (it.type === 'potion' ? `potion_${it.key}` : it.type === 'scroll' ? `scroll_${it.key}` : it.type === 'food' ? 'ration' : it.type === 'gold' ? 'gold' : it.key);

export default class Dungeon extends NordScript {
  static attributes = {
    seed: { type: 'int', default: 0, label: 'Level seed (0 = random; ?seed=N in the URL also works)' },
    heroLevel: { type: 'int', default: 7, min: 1, max: 20, label: 'Starting hero level' },
  };

  start() {
    this.ready = false;
    this.boot().catch((e) => this.game.reportError(e, this, 'boot'));
  }

  async boot() {
    const g = this.game, be = g.backend, ps = this.ps = be.scene;
    await g.preload(Object.values(PATH));
    const meta = {};
    for (const k of ['tiles', 'items', 'fx', 'ui']) meta[k] = await g.loader.meta(PATH[k]);
    this.meta = meta;
    this.font = new PixelFont(ps, PATH.font);
    this.worldLayer = ps.add.layer(); this.hudLayer = ps.add.layer();
    this.cam = ps.cameras.main; this.cam.setZoom(ZOOM); this.cam.ignore(this.hudLayer);
    this.uiCam = ps.cameras.add(0, 0, W, H); this.uiCam.ignore(this.worldLayer);
    this.floaters = []; this.cool = 0; this.path = null; this.clock = 0; this.endShown = 0;
    this.log = [];
    this.buildHud();
    this.newGame();
    window.__rpd = this;
    g.audio.music('assets/audio/music/music_adventure.mp3', { volume: 0.35 });
    this.ready = true;
  }

  // ===== game lifecycle =====================================================================================================
  newGame(seed) {
    seed ??= this.attrs.seed || Number(new URLSearchParams(location.search).get('seed')) || undefined;
    this.clearLevel();
    const w = this.w = new World({ seed, heroLevel: this.attrs.heroLevel });
    this.path = null; this.endShown = 0; this.cool = 0.3; this.log = []; this.pendingEnd = null;
    this.tiles = new Array(w.w * w.h).fill(null); this.tileState = new Int8Array(w.w * w.h).fill(-1);
    this.itemSprites = new Map(); this.mobVis = new Map();
    this.buildTiles(); this.buildItems();
    this.heroVis = this.makeVis(w.hero, PATH.hero);
    for (const m of w.mobs) this.makeVis(m, PATH[m.type]);
    this.cam.startFollow(this.heroVis.spr, true, 0.12, 0.12); this.cam.setFollowOffset(0, -30);
    const [hx, hy] = this.cellPx(w.hero.pos); this.cam.centerOn(hx, hy);
    this.overlay.forEach((o) => o.setVisible(false));
    for (const line of ['ARROWS/WASD MOVE - Q E Z C DIAGONAL - SPACE REST', '1-8 USE ITEM - CLICK TO TRAVEL - R NEW GAME']) this.say(line, 'warn');
    this.handle(w.drain());
    this.refreshFog(true); this.refreshHud();
  }
  clearLevel() {
    for (const t of this.tiles ?? []) t?.destroy();
    for (const s of this.itemSprites?.values() ?? []) s.destroy();
    for (const v of [this.heroVis, ...(this.mobVis?.values() ?? [])]) { v?.spr.destroy(); v?.zzz?.destroy(); }
    for (const f of this.floaters) f.pt.destroy();
    this.floaters = []; this.ps?.tweens.killAll(); this.cam?.stopFollow();
  }
  restart() { this.newGame(); }
  onDestroy() {
    this.clearLevel();
    this.worldLayer?.destroy(); this.hudLayer?.destroy();
    if (this.uiCam) this.ps.cameras.remove(this.uiCam);
    delete window.__rpd;
  }

  // ===== level visuals ======================================================================================================
  cellPx(c) { return [(c % this.w.w) * TS + TS / 2, ((c / this.w.w) | 0) * TS + TS - 1]; }
  tileFrame(c) {
    const w = this.w, t = w.terrain[c], f = this.meta.tiles.tiles;
    switch (t) {
      case T.FLOOR: return [f.floor1, f.floor2, f.floor3, f.floorBones][w.deco[c]] ?? f.floor1;
      case T.GRASS: return f.grass;
      case T.WATER: return ((c % w.w) + ((c / w.w) | 0)) & 1 ? f.water2 : f.water1;
      case T.DOOR: return f.doorClosed;
      case T.OPEN_DOOR: return f.doorOpen;
      case T.UP: return f.stairsUp;
      case T.DOWN: return f.stairsDown;
      case T.WALL: {
        const below = c + w.w, bt = w.terrain[below];
        const faces = below < w.terrain.length && bt !== T.WALL && bt !== T.VOID && bt !== T.UP && bt !== T.DOWN;
        if (!faces) return f.wallTop;
        return w.deco[c] === 1 ? f.wallMoss : w.deco[c] === 2 ? f.wallTorch : f.wallFace;
      }
      default: return f.void;
    }
  }
  buildTiles() {
    const w = this.w, key = PATH.tiles;
    const near = (c) => { for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const n = c + dy * w.w + dx; if (n >= 0 && n < w.terrain.length && w.terrain[n] !== T.WALL && w.terrain[n] !== T.VOID) return true; } return false; };
    for (let c = 0; c < w.terrain.length; c++) {
      if (w.terrain[c] === T.WALL && !near(c)) continue; // solid rock nobody can ever see
      const img = this.ps.add.image((c % w.w) * TS, ((c / w.w) | 0) * TS, key, this.tileFrame(c)).setOrigin(0, 0).setVisible(false).setDepth(0);
      this.worldLayer.add(img); this.tiles[c] = img;
    }
  }
  buildItems() { for (const [c, it] of this.w.items) this.addItemSprite(c, it); }
  addItemSprite(c, it) {
    const [x, y] = this.cellPx(c);
    const img = this.ps.add.image(x, y, PATH.items, this.meta.items.items[ITEM_FRAME(it)]).setOrigin(0.5, 1).setDepth(5).setVisible(false);
    this.worldLayer.add(img); this.itemSprites.set(c, img);
  }
  makeVis(actor, key) {
    const [x, y] = this.cellPx(actor.pos);
    const spr = this.ps.add.sprite(x, y, key, 0).setOrigin(0.5, actor.isGoo ? 0.875 : 1).setDepth(10);
    spr.play(`${key}:idle`); this.worldLayer.add(spr);
    const v = { actor, key, spr, lock: 0, face: 1 };
    if (actor.isHero) { this.heroVis = v; } else this.mobVis.set(actor.id, v);
    return v;
  }
  visOf(id) { return id === 'hero' ? this.heroVis : this.mobVis.get(id); }
  /** show/hide + shade tiles, items and monsters according to what the hero sees / remembers */
  refreshFog(force = false) {
    const w = this.w, hx = w.hero.pos % w.w, hy = (w.hero.pos / w.w) | 0;
    for (let c = 0; c < this.tiles.length; c++) {
      const t = this.tiles[c]; if (!t) continue;
      const s = w.fov[c] ? 2 : w.visited[c] ? 1 : 0;
      if (s === 2) {
        const d = Math.hypot((c % w.w) - hx, ((c / w.w) | 0) - hy), l = Math.max(0.5, 1 - (d / 10) ** 2 * 0.6), r = Math.round(255 * l), b = Math.round(Math.min(255, 255 * l * 1.04));
        t.setVisible(true).setTint((r << 16) | (r << 8) | b); this.tileState[c] = 2;
      } else if (s !== this.tileState[c] || force) { t.setVisible(s === 1).setTint(0x4a4a66); this.tileState[c] = s; }
    }
    for (const [c, img] of this.itemSprites) img.setVisible(!!w.visited[c]).setTint(w.fov[c] ? 0xffffff : 0x6a6a88);
    this.syncMobs();
    this.drawMinimap();
  }
  syncMobs() {
    const w = this.w;
    for (const [id, v] of this.mobVis) {
      const m = v.actor, vis = m.hp > 0 && !!w.fov[m.pos];
      v.spr.setVisible(vis || v.dying);
      if (m.hp > 0 && m.state === SLEEPING && vis) { if (!v.zzz) { v.zzz = this.ps.add.image(0, 0, PATH.fx, this.meta.fx.fx.zzz).setOrigin(0.5, 1).setDepth(30); this.worldLayer.add(v.zzz); } v.zzz.setVisible(true); } else v.zzz?.setVisible(false);
    }
    if (this.w.state === 'play') this.heroVis.spr.setVisible(true);
  }

  // ===== events → visuals ===================================================================================================
  say(text, kind = 'normal') {
    // the log is 50 characters wide (6x2 px glyphs next to the quickslots): wrap on word boundaries, newest line last
    const lines = []; let cur = '';
    for (const word of String(text).split(' ')) { if ((cur + ' ' + word).trim().length > 50) { lines.push(cur); cur = `  ${word}`; } else cur = (cur ? cur + ' ' : '') + word; }
    lines.push(cur);
    for (const l of lines) this.log.push({ text: l, kind });
    while (this.log.length > 6) this.log.shift();
    this.logDirty = true; this.logT = 6;
  }
  sfx(n, volume = 0.6, rate = 1) { this.game.audio.play(SFX(n), { volume, rate }); }
  float(text, cell, color, { dy = 0, life = 0.9, scale = 2 } = {}) {
    const [x, y] = this.cellPx(cell);
    const pt = new PText(this.ps, this.font, { text, color, scale, origin: [0.5, 1], layer: this.hudLayer }); pt.setDepth(100);
    this.floaters.push({ pt, wx: x, wy: y - 14 + dy, t: 0, life });
  }
  handle(events) {
    const w = this.w;
    for (const e of events) {
      switch (e.t) {
        case 'msg': this.say(e.text, e.kind); break;
        case 'move': {
          const v = this.visOf(e.id); if (!v) break;
          const [x, y] = this.cellPx(e.to), [fx] = this.cellPx(e.from);
          if (x !== fx) { v.face = x > fx ? 1 : -1; v.spr.setFlipX(v.face < 0); }
          const seen = e.id === 'hero' || w.fov[e.to] || w.fov[e.from];
          if (seen) { this.ps.tweens.add({ targets: v.spr, x, y, duration: e.id === 'hero' ? 90 : 100, ease: 'Linear' }); if (e.id === 'hero') { this.walk(v); this.sfx('step_stone', 0.12, 0.9 + Math.random() * 0.3); } }
          else v.spr.setPosition(x, y);
          break;
        }
        case 'teleport': { const v = this.heroVis, [x, y] = this.cellPx(e.to); v.spr.setPosition(x, y); this.cam.flash(250, 180, 120, 255); this.sfx('teleport', 0.6); this.path = null; break; }
        case 'attack': {
          const v = this.visOf(e.id), t = this.visOf(e.target); if (!v || !t) break;
          const dx = Math.sign(t.spr.x - v.spr.x); if (dx) { v.face = dx; v.spr.setFlipX(dx < 0); }
          v.spr.play(`${v.key}:attack`); v.lock = 0.25;
          const bx = v.spr.x, by = v.spr.y; this.ps.tweens.add({ targets: v.spr, x: bx + Math.sign(t.spr.x - bx) * 5, y: by + Math.sign(t.spr.y - by) * 3, duration: 70, yoyo: true });
          this.sfx(e.hit ? 'hit' : 'swing', e.id === 'hero' ? 0.5 : 0.45, e.hit ? 0.9 + Math.random() * 0.3 : 1);
          if (e.hit && e.id === 'hero') this.slash(t);
          if (!e.hit) this.float('MISS', t.actor.pos, '#b9b9d6', { life: 0.6, scale: 1 });
          if (e.pumped) this.cam.shake(180, 0.006);
          break;
        }
        case 'damage': {
          const v = this.visOf(e.id); if (!v) break;
          this.float(`-${e.amount}`, v.actor.pos, e.id === 'hero' ? '#ff6a6a' : '#ffffff');
          v.spr.setTint(0xffffff).setTintMode(Phaser.TintModes.FILL); this.ps.time.delayedCall(70, () => { if (v.spr.scene) v.spr.setTintMode(Phaser.TintModes.MULTIPLY).clearTint(); });
          if (e.id === 'hero') { this.cam.shake(120, Math.min(0.012, 0.002 + e.amount * 0.0006)); this.sfx('hurt', 0.5); this.hurtFlash = 0.35; }
          break;
        }
        case 'heal': { if (e.id === 'hero') { this.float(e.amount ? `+${e.amount}` : 'YUM', w.hero.pos, '#7dff8f'); this.sfx('heal', 0.5); } break; }
        case 'die': {
          const v = this.visOf(e.id); if (!v) break;
          v.dying = true; v.spr.play(`${v.key}:dead`); v.spr.setDepth(6); v.zzz?.setVisible(false);
          this.ps.tweens.add({ targets: v.spr, alpha: 0, delay: 700, duration: 500, onComplete: () => { v.spr.destroy(); v.zzz?.destroy(); this.mobVis.delete(e.id); } });
          this.sfx('death', 0.4, 1.3);
          break;
        }
        case 'drop': this.addItemSprite(e.pos, e.item); break;
        case 'pickup': { const s = this.itemSprites.get(e.pos); if (s) { this.itemSprites.delete(e.pos); this.ps.tweens.add({ targets: s, y: s.y - 8, alpha: 0, duration: 200, onComplete: () => s.destroy() }); } this.sfx(e.item.type === 'gold' ? 'coin' : 'pickup', 0.5); if (e.item.type === 'gold') this.float(`+${e.item.qty}`, w.hero.pos, '#ffe36a'); break; }
        case 'door': { const t = this.tiles[e.pos]; if (t) t.setFrame(this.tileFrame(e.pos)); this.sfx(e.open ? 'open' : 'close', 0.25); break; }
        case 'alert': { const v = this.visOf(e.id); if (v && w.fov[v.actor.pos]) this.marker(v, 'excl'); break; }
        case 'lost': { const v = this.visOf(e.id); if (v && w.fov[v.actor.pos]) this.marker(v, 'quest'); break; }
        case 'pump': { const v = this.visOf(e.id); if (v) { v.spr.play(`${v.key}:pump`); v.pumped = true; } this.sfx('magic', 0.5, 0.6); break; }
        case 'enrage': { const v = this.visOf(e.id); v?.spr.setTint(0xff9a9a); this.cam.shake(300, 0.008); break; }
        case 'levelup': this.float('LEVEL UP!', w.hero.pos, '#ffe36a', { dy: -10, life: 1.4 }); this.sfx('level_up', 0.6); break;
        case 'seal': this.cam.flash(300, 80, 255, 120); this.cam.shake(400, 0.006); this.sfx('bell', 0.5, 0.6); this.game.audio.music('assets/audio/music/music_boss.mp3', { volume: 0.4 }); break;
        case 'unseal': this.game.audio.music('assets/audio/music/music_adventure.mp3', { volume: 0.35 }); break;
        case 'end': this.pendingEnd = e.state; this.endAt = this.clock + 0.9; if (e.state === 'dead') { this.heroVis.spr.play(`${PATH.hero}:dead`); this.heroVis.lock = 99; this.sfx('lose', 0.6); } else { this.sfx('win', 0.7); } this.game.audio.stopMusic({ fade: 1 }); break;
        default: break;
      }
    }
  }
  walk(v) { v.spr.play(`${v.key}:walk`, true); v.lock = Math.max(v.lock, 0.18); }
  slash(t) {
    const img = this.ps.add.image(t.spr.x, t.spr.y - 7, PATH.fx, this.meta.fx.fx[Math.random() < 0.5 ? 'slash1' : 'slash2']).setDepth(40).setTint(0xfff2c0);
    this.worldLayer.add(img); this.ps.tweens.add({ targets: img, alpha: 0, scale: 1.4, duration: 220, onComplete: () => img.destroy() });
  }
  marker(v, name) {
    const img = this.ps.add.image(v.spr.x, v.spr.y - (v.actor.isGoo ? 26 : 14), PATH.fx, this.meta.fx.fx[name]).setOrigin(0.5, 1).setDepth(50);
    this.worldLayer.add(img); this.ps.tweens.add({ targets: img, y: img.y - 6, alpha: 0, delay: 350, duration: 450, onComplete: () => img.destroy() });
  }

  // ===== HUD =================================================================================================================
  txt(o) { return new PText(this.ps, this.font, { ...o, layer: this.hudLayer }); }
  gfx() { const g = this.ps.add.graphics(); this.hudLayer.add(g); return g; }
  buildHud() {
    const ps = this.ps, ui = this.meta.ui.ui;
    this.hudGfx = this.gfx(); this.hudGfx.setDepth(1);
    this.heart = ps.add.image(10, 8, PATH.ui, ui.heart).setOrigin(0, 0).setScale(2).setDepth(3); this.hudLayer.add(this.heart);
    this.hpText = this.txt({ x: 52, y: 10, text: '', scale: 2 }); this.hpText.setDepth(3);
    this.statText = this.txt({ x: 12, y: 40, text: '', scale: 1, color: '#c9c6e0' }); this.statText.setDepth(3);
    this.statText2 = this.txt({ x: 12, y: 52, text: '', scale: 1, color: '#c9c6e0' }); this.statText2.setDepth(3);
    this.logTexts = Array.from({ length: 6 }, (_, i) => this.txt({ x: 10, y: H - 20 - i * 15, text: '', scale: 2, origin: [0, 1] }).setDepth(3));
    this.bossText = this.txt({ x: W / 2, y: 12, text: 'GOO', scale: 2, color: '#a5f0a8', origin: [0.5, 0] }).setDepth(3);
    this.tipText = this.txt({ x: W - 10, y: H - 62, text: '', scale: 1, origin: [1, 1], color: '#e9e6f8' }).setDepth(4);
    this.slots = Array.from({ length: 8 }, (_, i) => {
      const x = W - 8 - (8 - i) * 38, y = H - 48;
      const bg = ps.add.image(x, y, PATH.ui, ui.slot).setOrigin(0, 0).setScale(2).setDepth(2); this.hudLayer.add(bg);
      const ic = ps.add.image(x + 3, y + 3, PATH.items, 0).setOrigin(0, 0).setScale(1.75).setDepth(3).setVisible(false); this.hudLayer.add(ic);
      const qty = this.txt({ x: x + 33, y: y + 25, text: '', scale: 1, origin: [1, 0] }).setDepth(4);
      const key = this.txt({ x: x + 4, y: y + 3, text: String(i + 1), scale: 1, color: '#8d89ad' }).setDepth(4);
      return { x, y, bg, ic, qty, key };
    });
    // minimap
    this.mini = ps.textures.createCanvas('rpd-mini', 64, 40);
    this.miniImg = ps.add.image(W - 8, 8, 'rpd-mini').setOrigin(1, 0).setScale(3).setDepth(3).setAlpha(0.92); this.hudLayer.add(this.miniImg);
    // overlays (end screens)
    const dim = this.gfx(); dim.fillStyle(0x07050c, 0.72).fillRect(0, 0, W, H).setDepth(20).setVisible(false);
    this.endTitle = this.txt({ x: W / 2, y: 150, text: '', scale: 6, origin: [0.5, 0] }).setDepth(21);
    this.endLines = [0, 1, 2, 3].map((i) => this.txt({ x: W / 2, y: 250 + i * 26, text: '', scale: 2, origin: [0.5, 0], color: '#d9d6e8' }).setDepth(21));
    this.endHint = this.txt({ x: W / 2, y: 400, text: 'PRESS R OR CLICK TO PLAY AGAIN', scale: 2, origin: [0.5, 0], color: '#ffd36a' }).setDepth(21);
    this.hurt = this.gfx(); this.hurt.setDepth(15);
    this.overlay = [dim, this.endTitle.img, ...this.endLines.map((l) => l.img), this.endHint.img];
    this.overlay.forEach((o) => o.setVisible(false));
  }
  refreshHud() {
    const w = this.w, h = w.hero, g = this.hudGfx; g.clear();
    // panels
    g.fillStyle(0x0d0a14, 0.78).fillRect(4, 4, 214, 64).lineStyle(2, 0x524b68, 1).strokeRect(5, 5, 212, 62);
    g.fillStyle(0x2a1620, 1).fillRect(50, 26, 160, 8).fillStyle(h.hp / h.ht > 0.33 ? 0xc9453a : 0xff2a2a, 1).fillRect(50, 26, Math.round(160 * h.hp / h.ht), 8);
    g.fillStyle(0xffffff, 0.22).fillRect(50, 26, Math.round(160 * h.hp / h.ht), 2);
    g.fillStyle(0x1e1a2e, 1).fillRect(50, 36, 160, 3).fillStyle(0xe6c34a, 1).fillRect(50, 36, Math.round(160 * h.exp / h.maxExp()), 3);
    this.hpText.setText(`HP ${h.hp}/${h.ht}`);
    this.statText.setText(`LV ${h.lvl}  STR ${h.str}  GOLD ${h.gold}`);
    const hunger = h.hunger >= 450 ? 'STARVING' : h.hunger >= 300 ? 'HUNGRY' : 'FED';
    this.statText2.setText(`DEPTH 5  TURN ${Math.floor(w.turn)}  ${hunger}${h.haste > 0 ? '  HASTE' : ''}${h.shadows > 0 ? '  SHADOWS' : ''}${h.ooze > 0 ? '  OOZE' : ''}`, hunger === 'FED' ? '#c9c6e0' : '#ffd36a');
    // boss bar
    const goo = w.goo, showBoss = goo.hp > 0 && goo.state !== SLEEPING;
    this.bossText.setVisible(showBoss);
    if (showBoss) { const bw = 300, x = W / 2 - bw / 2; g.fillStyle(0x0d0a14, 0.85).fillRect(x - 3, 26, bw + 6, 12).fillStyle(0x16301f, 1).fillRect(x, 29, bw, 6).fillStyle(goo.enraged() ? 0xff5a3a : 0x58c26a, 1).fillRect(x, 29, Math.round(bw * goo.hp / goo.ht), 6); }
    // log
    for (let i = 0; i < this.logTexts.length; i++) { const L = this.log[this.log.length - 1 - i]; const t = this.logTexts[i]; if (L) t.setText(L.text, COLORS[L.kind] ?? COLORS.normal).setVisible(true); else t.setVisible(false); }
    // quickslots
    const ui = this.meta.ui.ui;
    this.slots.forEach((s, i) => {
      const it = h.inv[i]; s.bg.setFrame(this.hover === i ? ui.slotSel : ui.slot);
      if (it) { s.ic.setFrame(this.meta.items.items[ITEM_FRAME(it)]).setVisible(true); s.qty.setText(it.qty > 1 ? String(it.qty) : '').setVisible(true); } else { s.ic.setVisible(false); s.qty.setVisible(false); }
    });
    // equipped line
    this.tipText.setText(this.tip ?? `${WEAPONS[h.weapon].name.toUpperCase()}  ${WEAPONS[h.weapon].min}-${WEAPONS[h.weapon].max}   ${ARMORS[h.armor].name.toUpperCase()}`);
  }
  drawMinimap() {
    const w = this.w, ctx = this.mini.getContext(), img = ctx.createImageData(64, 40);
    const put = (x, y, r, g, b) => { const i = (y * 64 + x) * 4; img.data[i] = r; img.data[i + 1] = g; img.data[i + 2] = b; img.data[i + 3] = 255; };
    for (let i = 0; i < 64 * 40; i++) { img.data[i * 4 + 3] = 150; }
    for (let c = 0; c < w.terrain.length; c++) {
      if (!w.visited[c]) continue; const x = c % w.w, y = (c / w.w) | 0, t = w.terrain[c];
      if (t === T.WALL) { if (w.terrain[c + w.w] !== T.WALL && w.terrain[c + w.w] !== undefined) put(x, y, 70, 66, 96); continue; }
      const col = t === T.WATER ? [60, 120, 180] : t === T.GRASS ? [60, 110, 70] : t === T.DOOR || t === T.OPEN_DOOR ? [160, 110, 60] : t === T.UP || t === T.DOWN ? [230, 195, 74] : [120, 114, 150];
      put(x, y, ...col);
    }
    for (const m of w.mobs) if (m.hp > 0 && w.fov[m.pos]) put(m.pos % w.w, (m.pos / w.w) | 0, 255, 90, 90);
    put(w.hero.pos % w.w, (w.hero.pos / w.w) | 0, 255, 255, 255);
    ctx.putImageData(img, 0, 0); this.mini.refresh();
  }
  showEnd(state) {
    const w = this.w, h = w.hero, won = state === 'won';
    this.overlay.forEach((o) => o.setVisible(true));
    this.endTitle.setText(won ? 'VICTORY!' : 'YOU DIED', won ? '#ffe36a' : '#ff6a6a');
    const best = this.save.get('bestWin', null);
    const score = h.gold + w.kills * 10 + (won ? 500 : 0);
    if (won && (best == null || score > best)) this.save.set('bestWin', score);
    this.endLines[0].setText(won ? 'THE GOO IS SLAIN. THE SEWERS ARE CLEARED.' : w.endCause.toUpperCase());
    this.endLines[1].setText(`TURNS ${Math.floor(w.turn)}   KILLS ${w.kills}   GOLD ${h.gold}   LEVEL ${h.lvl}`);
    this.endLines[2].setText(`SCORE ${score}${won ? `   BEST ${Math.max(score, best ?? 0)}` : ''}`, '#ffe36a');
    this.endLines[3].setText(`SEED ${w.seed}`, '#8d89ad');
  }

  // ===== per-frame ===========================================================================================================
  update(dt) {
    if (!this.ready) return;
    this.clock += dt;
    this.animate(dt);
    const w = this.w, inp = this.input;
    if (this.pendingEnd && this.clock >= this.endAt) { this.showEnd(this.pendingEnd); this.pendingEnd = null; this.endShown = this.clock; }
    if (w.state !== 'play') { if (this.endShown && this.clock - this.endShown > 0.8 && (inp.pressed('restart') || inp.pressed('click') || inp.pressed('rest'))) this.restart(); return; }
    if (inp.pressed('restart')) { this.restart(); return; }
    this.cool -= dt;
    this.pointerHover();
    if (this.cool > 0) return;
    for (let i = 1; i <= 8; i++) if (inp.pressed(`use${i}`)) { this.act({ type: 'use', index: i - 1 }); return; }
    let dx = inp.axis('left', 'right'), dy = inp.axis('up', 'down');
    if (inp.down('ul')) { dx = -1; dy = -1; } else if (inp.down('ur')) { dx = 1; dy = -1; } else if (inp.down('dl')) { dx = -1; dy = 1; } else if (inp.down('dr')) { dx = 1; dy = 1; }
    if (dx || dy) { this.path = null; this.act({ type: 'move', dx, dy }); return; }
    if (inp.down('rest')) { this.path = null; this.act({ type: 'rest' }); return; }
    if (inp.pressed('click')) { this.click(); }
    if (this.path?.length) this.travelStep();
  }
  act(cmd) {
    const w = this.w, hp0 = w.hero.hp;
    const ok = w.heroAct(cmd);
    if (!ok) { this.cool = 0.06; return false; }
    this.cool = cmd.type === 'move' && !w.mobAt(w.hero.pos) ? STEP : 0.16;
    this.handle(w.drain()); this.refreshFog(); this.refreshHud();
    if (w.hero.hp < hp0) this.path = null;
    return true;
  }
  click() {
    const p = this.input.pointer, w = this.w;
    const si = this.slots.findIndex((s) => p.x >= s.x && p.x < s.x + 36 && p.y >= s.y && p.y < s.y + 36);
    if (si >= 0) { if (w.hero.inv[si]) this.act({ type: 'use', index: si }); return; }
    const wp = this.cam.getWorldPoint(p.x, p.y), cx = Math.floor(wp.x / TS), cy = Math.floor(wp.y / TS);
    if (cx < 0 || cy < 0 || cx >= w.w || cy >= w.h) return;
    const target = cy * w.w + cx;
    if (!w.visited[target] || target === w.hero.pos) { if (target === w.hero.pos) this.act({ type: 'rest' }); return; }
    const m = w.mobAt(target);
    const path = findPath(w.w, w.h, w.hero.pos, target, (i) => (w.passable(i) && w.visited[i]) || i === w.downCell);
    if (!path?.length) { this.say('You cannot get there.', 'warn'); return; }
    this.path = path; this.seen = new Set(w.mobs.filter((x) => x.hp > 0 && w.fov[x.pos]).map((x) => x.id)); if (m) this.path.attack = true;
  }
  travelStep() {
    const w = this.w, h = w.hero, next = this.path[0];
    const visible = w.mobs.filter((m) => m.hp > 0 && w.fov[m.pos]);
    if (visible.some((m) => !this.seen.has(m.id) || m.state === HUNTING)) { this.path = null; return; } // something showed up: stop, like SPD
    const x = h.pos % w.w, y = (h.pos / w.w) | 0;
    this.path.shift();
    this.act({ type: 'move', dx: Math.sign((next % w.w) - x), dy: Math.sign(((next / w.w) | 0) - y) });
    if (w.hero.pos !== next && !w.mobAt(next)) this.path = null;
  }
  pointerHover() {
    const p = this.input.pointer, h = this.w.hero;
    const si = this.slots.findIndex((s) => p.x >= s.x && p.x < s.x + 36 && p.y >= s.y && p.y < s.y + 36);
    const tip = si >= 0 && h.inv[si] ? `${this.w.itemName(h.inv[si]).toUpperCase()}: ${this.w.itemDesc(h.inv[si]).toUpperCase()}` : null;
    if (si !== this.hover || tip !== this.tip) { this.hover = si; this.tip = tip; this.refreshHud(); }
  }
  animate(dt) {
    const w = this.w;
    // idle/walk anim resets
    for (const v of [this.heroVis, ...this.mobVis.values()]) {
      if (!v || v.spr.scene === undefined || v.dying) continue;
      v.spr.setDepth(10 + v.spr.y / 1000);
      if (v.lock > 0) { v.lock -= dt; if (v.lock <= 0 && v.actor.hp > 0) v.spr.play(v.pumped && v.actor.pumped > 0 ? `${v.key}:pump` : `${v.key}:idle`, true); }
      if (v.pumped && v.actor.pumped === 0 && v.lock <= 0) { v.pumped = false; v.spr.play(`${v.key}:idle`, true); }
      if (v.zzz?.visible) v.zzz.setPosition(v.spr.x + 5, v.spr.y - (v.actor.isGoo ? 26 : 14) + Math.sin(this.clock * 3 + v.spr.x) * 1.5);
    }
    // water shimmer
    if (Math.floor(this.clock * 2) !== this.waterTick) {
      this.waterTick = Math.floor(this.clock * 2); const f = this.meta.tiles.tiles;
      for (let c = 0; c < this.tiles.length; c++) if (this.tiles[c] && w.terrain[c] === T.WATER && this.tileState[c] > 0) this.tiles[c].setFrame(((c % w.w) + ((c / w.w) | 0) + this.waterTick) & 1 ? f.water2 : f.water1);
    }
    // floating numbers (screen space)
    for (let i = this.floaters.length - 1; i >= 0; i--) {
      const f = this.floaters[i]; f.t += dt;
      const k = f.t / f.life, sx = (f.wx - this.cam.midPoint.x) * ZOOM + W / 2, sy = (f.wy - this.cam.midPoint.y) * ZOOM + H / 2 - k * 28;
      f.pt.setPosition(Math.round(sx), Math.round(sy)).setAlpha(k < 0.7 ? 1 : 1 - (k - 0.7) / 0.3);
      if (k >= 1) { f.pt.destroy(); this.floaters.splice(i, 1); }
    }
    if (this.logT !== undefined && this.logDirty) { this.logDirty = false; this.refreshHud(); }
    // damage vignette
    if (this.hurtFlash > 0) { this.hurtFlash -= dt; this.hurt.clear().fillStyle(0xff0000, Math.max(0, this.hurtFlash) * 0.5).fillRect(0, 0, W, H); } else if (this.hurtFlash !== undefined) { this.hurt.clear(); this.hurtFlash = undefined; }
  }
}
