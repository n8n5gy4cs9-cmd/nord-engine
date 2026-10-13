// @nord {"id":"valout2.game","title":"Vallout 2: New Kerava","category":"games","tier":["2d"],"tags":["rpg","fallout","isometric","turn-based","comedy"],"description":"A comic Fallout-2-style RPG in alien-fallout Kerava, Finland. Classic turn-based and modern WASD+mouse control modes."}
// Vallout 2: New Kerava — controller. Owns global state (G), shared services (ctx) and screen flow. Crowelian 2026 + Sonnet.
import { NordScript } from 'nord';
import { PixelFont, PText } from './v/pixeltext.js';
import { Layer, COL, ascii } from './v/ui.js';
import { Hud } from './v/hud.js';
import { Area } from './v/play.js';
import './v/classic.js';
import './v/modern.js';
import { ITEMS, LOCS, QUESTS, START_ITEMS } from './v/data.js';
import { Screens } from './v/screens.js';
import * as R from './v/rules.js';

const A = (p) => `assets/${p}`;
const K = { ground: A('tiles/ground.png'), walls: A('tiles/walls.png'), props: A('sprites/props.png'), actors: A('sprites/actors.png'), boss: A('sprites/boss.png'), fx: A('sprites/fx.png'), items: A('ui/items.png'), ui: A('ui/ui.png'), font: A('ui/font.png') };
const SFX = ['click', 'step', 'hit', 'hit_goo', 'hurt', 'die_alien', 'die_human', 'gull', 'blob', 'levelup', 'win', 'lose', 'pickup', 'open', 'error', 'miss', 'combat', 'shoot_pistol', 'shoot_shotgun', 'shoot_rifle', 'ray', 'swing', 'kick', 'punch', 'whoosh', 'wallkick', 'heal', 'drink', 'confirm'];
const MUSIC = { title: A('audio/music/music_title.mp3'), explore: A('audio/music/music_wasteland.mp3'), combat: A('audio/music/music_combat.mp3') };
const SAVE_KEY = 'valout2';

export default class Valout extends NordScript {
  start() { this.boot().catch((e) => { console.error(e); this.game.reportError(e, this, 'boot'); }); }
  async boot() {
    const g = this.game, ps = this.ps = g.backend.scene;
    await g.preload(Object.values(K));
    const meta = {}; for (const k of Object.keys(K)) meta[k] = await g.loader.meta(K[k]);
    const fr = {}; for (const k of ['ground', 'walls', 'props', 'fx', 'items', 'ui']) fr[k] = meta[k].frames;
    const font = new PixelFont(ps, K.font);
    let mode = 'classic'; try { mode = localStorage.getItem('valout2.mode') === 'modern' ? 'modern' : 'classic'; } catch { /* ignore */ }
    const self = this, keys = {};
    const ctx = this.ctx = {
      ps, font, K, fr, meta, keys, G: null, area: null, hud: null, modal: 0, game: g, self,
      get mode() { return mode; },
      setMode(m) { mode = m; try { localStorage.setItem('valout2.mode', m); } catch { /* ignore */ } ctx.area?.onModeChange(m); ctx.hud?.refresh(); },
      sfx: (n, v = 0.6, r = 1) => { if (SFX.includes(n)) g.audio.play(A(`audio/sfx/${n}.wav`), { volume: v, rate: r }); },
      music: (n) => g.audio.music(MUSIC[n], { fade: 0.8, volume: 0.55 }),
      makeText: (x, y, str, color, depth = 100, origin = [0.5, 0.5], fixed = false) => { const t = new PText(ps, font, { x, y, text: ascii(str), color, scale: 1, origin }); t.setDepth(depth); if (fixed) t.img.setScrollFactor(0); return t; },
      itemFrame: (icon) => fr.items[icon] ?? 0,
      count: (id) => ctx.G.inv.find((i) => i.id === id)?.n ?? 0,
      give(id, n = 1) { const it = ctx.G.inv.find((i) => i.id === id); if (it) it.n += n; else ctx.G.inv.push({ id, n }); ctx.hud?.refresh(); },
      take(id, n = 1) { const it = ctx.G.inv.find((i) => i.id === id); if (!it) return false; it.n -= n; if (it.n <= 0) ctx.G.inv.splice(ctx.G.inv.indexOf(it), 1); ctx.hud?.refresh(); return true; },
      setCursor(f) { if (f < 0) { cursor.setVisible(false); return; } cursor.setVisible(true).setFrame(f).setOrigin(f === 0 ? 0 : 0.5); },
      setHint(t, c = COL.amber) { hintStr = t; hintCol = c; },
      setQuest(id, n) { const q = ctx.G.quests; if ((q[id] ?? 0) >= n) return; q[id] = n; const Q = QUESTS[id], last = Math.max(...Object.keys(Q.steps).map(Number)); ctx.area?.say(n >= last ? `Quest completed: ${Q.title}` : `Quest updated: ${Q.title}`, COL.amber); ctx.sfx(n >= last ? 'levelup' : 'confirm', 0.5); if (n >= last && Q.xp) { const up = R.addXp(ctx.G.char, Q.xp); ctx.area?.say(`You gain ${Q.xp} experience points.`, COL.amber); if (up) ctx.area?.say(`You have reached level ${ctx.G.char.lvl}!`, COL.amber); } ctx.hud?.refresh(); },
      equip(id) {
        const it = ITEMS[id], c = ctx.G.char, a = ctx.area;
        if (a?.combat && ctx.mode === 'classic') { if (!a.playerTurnOn || a.player.ap < 2) return a.say('Not enough action points (2 AP).', COL.dim); a.player.ap -= 2; }
        if (it.type === 'weapon') { c.weapon = id; ctx.G.modeIdx = 0; } else if (it.type === 'armor') c.armor = id; ctx.sfx('click', 0.5); a?.say(`You equip the ${it.name}.`, COL.dim); ctx.hud?.refresh(a?.player?.ap ?? 0, R.derived(c.S).ap); a?.hudRefresh();
      },
      useItem(id) {
        const it = ITEMS[id], c = ctx.G.char, a = ctx.area; if (it.type !== 'aid' || !ctx.count(id)) return false;
        if (a?.combat && ctx.mode === 'classic') { if (!a.playerTurnOn || a.player.ap < 2) { a.say('Not enough action points (2 AP).', COL.dim); return false; } a.player.ap -= 2; }
        const h = R.healAmount(c, it); c.hp = Math.min(c.maxHp, c.hp + h); ctx.take(id, 1); if (it.drunk) c.drunk = 12; ctx.sfx(it.drunk ? 'drink' : 'heal', 0.6);
        a?.say(`You use the ${it.name}. +${h} hit points.${it.drunk ? ' You feel... Finnish.' : ''}`, COL.green); a?.float?.(a.player, `+${h}`, COL.green); a?.hudRefresh(); return true;
      },
      quickHeal() { const c = ctx.G.char, a = ctx.inv(); const aid = a.filter((i) => ITEMS[i.id].type === 'aid'); if (!aid.length) return ctx.area?.say('Nothing to heal with.', COL.dim); const need = c.maxHp - c.hp; aid.sort((x, y) => (need > 14 ? -1 : 1) * (ITEMS[x.id].heal[1] - ITEMS[y.id].heal[1])); ctx.useItem(aid[0].id); },
      inv: () => ctx.G.inv,
      flag: (k) => !!ctx.G.flags[k],
      cond(n) { if (n.startsWith('has_')) return ctx.count(n.slice(4)) > 0; if (n === 'kossu_has') return ctx.count('kossu') > 0 && ctx.G.quests.kossu === 1; return !!ctx.G.flags[n]; },
      weight: () => R.weightOf(ctx.G.inv),
      save() { try { const G = ctx.G; g.save.set(SAVE_KEY, JSON.stringify({ ...G, log: G.log.slice(-25), loc: ctx.here })); ctx.area?.say('Game saved.', COL.amber); return true; } catch (e) { console.warn(e); return false; } },
      hasSave: () => { try { return !!g.save.get(SAVE_KEY); } catch { return false; } },
      load() { try { const raw = g.save.get(SAVE_KEY); if (!raw) return false; const G = JSON.parse(raw); self.screens.resume(G); return true; } catch (e) { console.warn(e); return false; } },
      newGame: () => ({ char: null, inv: START_ITEMS.map(([id, n]) => ({ id, n })), flags: {}, quests: { kill: 1 }, kills: 0, time: 9 * 60, areas: {}, log: [], modeIdx: 0, visited: ['asema'] }),
      bindArea(a) { ctx.area = a; }, unbindArea(a) { if (ctx.area === a) ctx.area = null; },
    };
    ctx.here = 'asema';
    // cursor + hint
    const cursor = ps.add.image(0, 0, K.ui, 0).setDepth(20000).setScrollFactor(0); g.backend.canvas?.style && (g.backend.canvas.style.cursor = 'none'); ps.game.canvas.style.cursor = 'none';
    let hintStr = '', hintCol = COL.amber; const hintT = new PText(ps, font, { x: 0, y: 0, text: ' ', color: COL.amber, scale: 1, origin: [0, 0] }); hintT.setDepth(19999); hintT.img.setScrollFactor(0);
    this.screens = new Screens(ctx); ctx.openDialog = (n) => this.screens.dialog(n); ctx.openInventory = () => this.screens.inventory(); ctx.openChar = () => this.screens.character(); ctx.openNokia = () => this.screens.nokia(); ctx.openOptions = () => this.screens.options(); ctx.openWorld = () => this.screens.world();
    ctx.leaveArea = () => this.screens.leaveArea(); ctx.endGame = (k) => this.screens.ending(k);
    // input
    const kd = (e) => { keys[e.code] = true; if (['Tab', 'Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'F10', 'F5', 'F9'].includes(e.code)) e.preventDefault(); this.screens.key(e); };
    const ku = (e) => { keys[e.code] = false; }; window.addEventListener('keydown', kd); window.addEventListener('keyup', ku); window.addEventListener('blur', () => { for (const k in keys) keys[k] = false; });
    this.off = () => { window.removeEventListener('keydown', kd); window.removeEventListener('keyup', ku); };
    ps.events.on('update', (t, ms) => {
      const dt = Math.min(0.05, ms / 1000), p = ps.input.activePointer;
      cursor.setPosition(p.x, p.y);
      if (hintStr) { hintT.setText(hintStr, hintCol).setVisible(true).setPosition(Math.min(p.x + 14, 630 - hintT.width), Math.min(p.y + 12, 470)); } else hintT.setVisible(false);
      if (ctx.area && !ctx.modal) { ctx.G.time += dt / 2; ctx.area.update(dt); }
      else if (ctx.area) ctx.area.update(0.0001);
      this.screens.tick?.(dt);
    });
    window.__valout = this; this.ready = true; window.__nord_ready = true;
    this.screens.title();
  }
  onDestroy() { this.off?.(); delete window.__valout; }
}
