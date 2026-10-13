// @nord {"id":"xkom.game","title":"X-KOM 2026 — campaign","category":"games","tier":["2d"],"tags":["strategy","xcom","rts","red-alert","turn-based","procedural"],"description":"X-COM-style campaign: geoscape, procedural isometric turn-based missions (time units, reaction fire, fog of war) — and when alien presence hits 100%, a Red Alert-style RTS operation to destroy the alien hive. Gather intel, research Elerium, raid the source and destroy the final Hive."}
// X-KOM 2026 — campaign controller (title, geoscape, mission flow, endings). Crowelian 2026 + Sonnet. See GUIDE.md and assets.md.
// Tactical rules: xk/tactical.js (OpenXcom ideas) · view xk/tacview.js · RTS rules: xk/rts.js (OpenRA/Red Alert ideas) · view xk/rtsview.js.
import { XkBase, VW, VH, COL, UI } from './xk/base.js';
import { TacView } from './xk/tacview.js';
import { RtsView } from './xk/rtsview.js';
import { InterceptView } from './xk/intercept.js';
import { Help, XKOM_PAGES } from './xk/help.js';
import { newSquad, newRookie } from './xk/tactical.js';
import { TECHS, newResearch, status as techStatus, start as startTech, advance as advanceTech, mods as techMods, tech } from './xk/research.js';
import { GeoView } from './xk/geoview.js';
import { touchToStart } from 'nord';
import { DevConsole } from './xk/devconsole.js';
import { initWorld, resolveContact, advanceClock, DAY_SECONDS, phase, snapshot, validSave } from './xk/campaign.js';

import { PauseMenu } from './xk/pause.js';
import { MUSIC_CONFIG } from './music-config.js';

const PATH = {
  tground: 'assets/tactical/ground.png', tobjects: 'assets/tactical/objects.png', tunits: 'assets/tactical/units.png', tui: 'assets/tactical/ui.png', tfx: 'assets/tactical/fx.png',
  rterrain: 'assets/rts/terrain.png', runits: 'assets/rts/units.png', rui: 'assets/rts/ui.png', rfx: 'assets/rts/fx.png',
  b_fact: 'assets/rts/b_fact.png', b_powr: 'assets/rts/b_powr.png', b_barr: 'assets/rts/b_barr.png', b_weap: 'assets/rts/b_weap.png', b_proc: 'assets/rts/b_proc.png', b_gun: 'assets/rts/b_gun.png',
  b_hive: 'assets/rts/b_hive.png', b_brood: 'assets/rts/b_brood.png', b_tower: 'assets/rts/b_tower.png',
  jet: 'assets/air/jet.png', dart: 'assets/air/dart.png', turret: 'assets/air/turret.png', pickups: 'assets/air/pickups.png', island: 'assets/air/island.png', saucer: 'assets/air/saucer.png', drone: 'assets/air/drone.png', shots: 'assets/air/shots.png', cloud: 'assets/air/cloud.png', sea: 'assets/air/sea.png',
  world: 'assets/geo/world.png', title: 'assets/ui/title.png', gicons: 'assets/geo/icons.png', font: 'assets/ui/font.png', map: 'assets/geo/world.map',
};
const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

export default class XKom extends XkBase {
  static attributes = {
    seed: { type: 'int', default: 0, label: 'Campaign seed (0 = random)' },
    goal: { type: 'int', default: 40, min: 5, max: 200, label: 'Alien intel (kills) needed to locate source' },
    presence: { type: 'int', default: 62, min: 0, max: 99, label: 'Starting alien presence % (100% = hive strike RTS operation)' },
  };
  start() { this.ready = false; this.boot().catch((e) => this.game.reportError(e, this, 'boot')); }

  async boot() {
    this.musicConfig = MUSIC_CONFIG;
    await this.initBase(PATH); this.land = [];
    const rows = (await this.game.loader.text(PATH.map)).split('---\n')[1].trim().split('\n'); rows.forEach((r, y) => [...r].forEach((c, x) => { if (c === 'g' || c === 'd') this.land.push([x, y]); }));
    this.tac = new TacView(this); this.rts = new RtsView(this); this.air = new InterceptView(this); this.geo = new GeoView(this); this.help = new Help(this, XKOM_PAGES); this.mode = 'title';
    const q = new URLSearchParams(location.search); this.q = q;
    this.onKey = (e) => this.keyEv(e, true); this.onKeyUp = (e) => this.keyEv(e, false);
    this.onMove = (p) => this.ptrEv(p, 'move'); this.onDown = (p) => this.ptrEv(p, 'down'); this.onUp = (p) => this.ptrEv(p, 'up');
    window.addEventListener('keydown', this.onKey); window.addEventListener('keyup', this.onKeyUp);
    const ps = this.ps; ps.input.on('pointermove', this.onMove); ps.input.on('pointerdown', this.onDown); ps.input.on('pointerup', this.onUp); ps.input.mouse?.disableContextMenu?.();
    window.__xk = this; this.screenRevision = 0; this.newCampaign(); this.ready = true;
    const st = q.get('start'); if (st === 'geo') this.geoscape(); else if (st === 'base') this.baseScreen(); else if (st === 'air') this.intercept(this.makeSites()[0]); else if (st === 'tac') this.deploy(this.makeSites()[0]); else if (st === 'rts') this.startRts(); else this.titleScreen();
    if (!st) this.startGate = touchToStart(this.game, { title: 'X-KOM 2026', label: 'TOUCH / CLICK TO ENABLE AUDIO' });
    this.dev = new DevConsole(this); this.pause = new PauseMenu(this);
    this.onHide = () => { if (document.hidden) this.saveCampaign(); }; this.onPageHide = () => this.saveCampaign();
    document.addEventListener('visibilitychange', this.onHide); window.addEventListener('pagehide', this.onPageHide);
  }
  onDestroy() { document.removeEventListener('visibilitychange', this.onHide); window.removeEventListener('pagehide', this.onPageHide); this.pause?.destroy(); this.startGate?.destroy(); this.dev?.destroy(); window.removeEventListener('keydown', this.onKey); window.removeEventListener('keyup', this.onKeyUp); this.ps?.input?.off('pointermove', this.onMove); this.ps?.input?.off('pointerdown', this.onDown); this.ps?.input?.off('pointerup', this.onUp); delete window.__xk; }
  update(dt) { if (!this.ready || this.pause?.open || this.help.open || this.dev?.open || this.startGate?.active || document.hidden) return; const d = Math.min(dt > 1 ? dt / 1000 : dt, 0.1); if (this.mode === 'tac') this.tac.update(d); else if (this.mode === 'rts') this.rts.update(d); else if (this.mode === 'air') this.air.update(d); else if (this.mode === 'geo' || this.mode === 'base') this.advanceCampaign(d); }
  advanceCampaign(seconds, force = false) {
    if (!['geo', 'base'].includes(this.mode)) return;
    if (this.C.presence >= 100) { this.alertThenRts(); return; }
    const paused = this.C.clockPaused; if (force) this.C.clockPaused = false; const r = advanceClock(this.C, seconds, this.seed); this.C.clockPaused = paused;
    if (r.days) { const completed = advanceTech(this.C.R, r.days); if (completed) this.sfx('built', 0.4); if (r.events.length) this.sfx('alarm', 0.25); this.news = r.events.at(-1) ?? (completed ? `RESEARCH COMPLETE: ${completed.name}` : 'NEW DAY: ALIEN ACTIVITY CONTINUES');
      if (this.C.presence >= 100) { this.alertThenRts(); return; } this.mode === 'geo' ? this.geoscape() : this.baseScreen(r.events.length ? this.news.slice(0, 38) : ''); }
    this.refreshClock(); if (r.days) this.saveCampaign();
  }
  refreshClock() { this.clockText?.setText(`${this.C.clockPaused ? 'PAUSED' : Math.ceil(DAY_SECONDS - this.C.clockSeconds) + 's'}  LOST ${this.C.towns.filter(t => t.occupied).length}/6`, this.C.clockPaused ? COL.gold : COL.dim); }

  // ---- campaign state ---------------------------------------------------------------------------------------------------------------------------------
  newCampaign() {
    this.seed = this.attrs.seed || Number(this.q.get('seed')) || ((Math.random() * 1e9) | 0);
    this.C = { squad: newSquad(this.seed, 6), presence: this.attrs.presence, kills: 0, missions: 0, lost: 0, day: 3, rtsDone: 0, over: false, sourceSecured: false, victory: false, funds: 3000, R: newResearch() }; this.news = 'WELCOME, COMMANDER. OPEN THE BASE [B] TO START RESEARCH.';
    initWorld(this.C, this.land, this.seed); this.finalOperation = false; this.checkpoint = null;
  }
  savedCampaign() { try { const s = this.game.save.get('campaign', null); return validSave(s) && !s.C.over ? s : null; } catch { return null; } }
  campaignSaveData() {
    if (this.mode === 'title') return null; // Opening/closing the title must never replace an existing war.
    const strategic = ['geo', 'base', 'end'].includes(this.mode);
    const s = strategic ? snapshot(this.C, this.seed, this.attrs.goal, this.news) : this.checkpoint;
    return s && validSave(s) ? s : null;
  }
  saveCampaign() {
    const s = this.campaignSaveData(); if (!s) return false;
    try { this.game.save.set('campaign', s); return true; } catch { return false; }
  }
  importCampaign(raw) {
    const file = JSON.parse(raw), s = file?.checkpoint;
    if (file?.game !== 'xkom' || !validSave(s) || s.C.over) throw new Error('Not a supported X-KOM campaign checkpoint.');
    this.game.save.set('campaign', s); // Persist before replacing the running campaign.
    return this.loadCampaign();
  }
  checkpointCampaign() { this.checkpoint = snapshot(this.C, this.seed, this.attrs.goal, this.news); this.saveCampaign(); }
  leaveMission() {
    this.screenRevision++; this.tac.destroy(); if (this.rts.objs) this.rts.destroy(); if (this.air.objs) this.air.destroy(); this.help.close(); this.finalOperation = false;
  }
  loadCampaign() {
    const s = this.savedCampaign(); if (!s) return false;
    this.leaveMission(); this.seed = s.seed; this.attrs.goal = s.goal; this.C = structuredClone(s.C); this.news = s.news || 'CAMPAIGN RESTORED AT HQ'; this.checkpoint = null; this.geoscape(); return true;
  }
  beginCampaign() { this.newCampaign(); this.geoscape(); this.saveCampaign(); }
  continueCampaign() { if (!this.loadCampaign()) this.beginCampaign(); }
  launchFinale() {
    const stage = phase(this.C, this.attrs.goal);
    if (stage === 'SOURCE RAID') this.deploy({ id: 'source', final: true, seed: this.seed + 444, aliens: Math.min(20, 12 + Math.floor(this.C.missions / 3)), relief: 0 });
    else if (stage === 'FINAL ASSAULT') this.startRts(true);
  }
  clearScreen() { this.clockText = null; this.panTween?.stop(); for (const o of this.screenObjs ?? []) o.destroy?.(); this.screenObjs = []; this.hud.removeAll(true); }
  keep(o) { this.screenObjs.push(o); return o; }

  // ---- title ------------------------------------------------------------------------------------------------------------------------------------------------
  titleScreen() {
    this.clearScreen(); this.mode = 'title'; this.camCenter(VW / 2, VH / 2); const h = this;
    h.keep(h.img('title', 0, 0, 0, 0, [0, 0], true));
    h.keep(h.text(14, 63, 'X-KOM', '#eff3dd', { scale: 4, hud: true, depth: 6 }));
    h.keep(h.text(17, 94, 'EARTH DEFENCE  /  2026', COL.blue, { hud: true, depth: 6 }));
    h.keep(h.text(17, 111, 'COMMAND THE RESISTANCE', COL.dim, { hud: true, depth: 6 }));
    h.keep(h.panel(16, 166, 152, 17, 0x354761, { depth: 4 }));
    h.keep(h.label(16, 166, 152, 17, this.savedCampaign() ? 'CONTINUE  [ENTER]' : 'BEGIN CAMPAIGN  [ENTER]'));
    h.keep(h.text(17, 190, 'CROWELIAN 2026 + SONNET', COL.dim, { scale: 0.85, hud: true, depth: 6 }));
    h.keep(h.text(310, 190, 'F1  FIELD MANUAL', COL.dim, { origin: [1, 0], scale: 0.85, hud: true, depth: 6 }));
    if (this.savedCampaign()) { h.keep(h.panel(16, 144, 152, 17, 0x253249, { depth: 4 })); h.keep(h.label(16, 144, 152, 17, 'NEW CAMPAIGN  [N]', COL.dim)); }
    this.music('music_title', 0.25, { offset: this.musicConfig.titleStartSeconds });
  }

  // ---- geoscape ---------------------------------------------------------------------------------------------------------------------------------------------
  makeSites() {
    return this.C.contacts;
  }
  mulberry(a) { return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  geoscape() {
    this.tac.destroy?.(); this.clearScreen(); this.mode = 'geo'; this.camCenter(VW / 2, VH / 2); const h = this, C = this.C; this.sites = this.makeSites();
    this.geo.start(this.sites); h.keep(h.panel(232, 0, 88, 200, 0x253249, { depth: 1 })); h.keep(h.panel(0, 176, 232, 24, UI.dark, { raised: false, depth: 1 }));
    this.geoLabel = h.keep(h.text(5, 4, this.geo.region ? 'HQ REGIONAL MAP  Z = GLOBE' : 'GEOSCAPE  ARROWS ROTATE', COL.dim, { hud: true, depth: 6 }));
    this.clockText = h.keep(h.text(5, 14, '', COL.dim, { hud: true, depth: 6, scale: 0.9 })); this.refreshClock();
    h.keep(h.text(276, 6, 'EARTH DEFENCE', COL.blue, { origin: [0.5, 0], hud: true, depth: 6 }));
    this.geoBtns = [];
    const button = (id, x, y, w, label) => { h.keep(h.panel(x, y, w, 14, 0x455a73, { depth: 2 })); h.keep(h.label(x, y, w, 14, label)); this.geoBtns.push({ id, x, y, w, h: 14 }); };
    button('base', 236, 20, 80, 'BASE  [B]'); button('hq', 236, 36, 80, 'HQ / GLOBE  [Z]');
    button('in', 236, 52, 38, 'ZOOM +'); button('out', 278, 52, 38, 'ZOOM -');
    button('left', 236, 68, 38, '< WEST'); button('right', 278, 68, 38, 'EAST >');
    const stage = phase(C, this.attrs.goal);
    if (['SOURCE RAID', 'FINAL ASSAULT'].includes(stage)) button('final', 5, 154, 216, stage + '  [F]');
    else h.keep(h.text(5, 159, 'OBJECTIVE: ' + stage, COL.gold, { hud: true, depth: 6 }));
    this.baseBtn = this.geoBtns[0]; h.keep(h.text(236, 87, 'ALIEN CONTACTS', COL.gold, { hud: true, depth: 6 }));
    this.sites.forEach((site, i) => { const y = 98 + i * 25; h.keep(h.panel(236, y, 80, 23, UI.panel, { depth: 2 }));
      h.keep(h.text(240, y + 7, String(i + 1) + ' ' + site.name, COL.text, { origin: [0, 0.5], hud: true, depth: 6, scale: 0.9 }));
      h.keep(h.text(240, y + 16, site.aliens + ' ALIENS  ' + (site.expires - C.idleDays) + 'D LEFT', COL.alien, { origin: [0, 0.5], hud: true, depth: 6, scale: 0.85 })); site.rect = { x: 236, y, w: 80, h: 23 }; });
    const d = C.day, date = String(((d - 1) % 28) + 1).padStart(2, '0') + ' ' + MONTHS[Math.floor((d - 1) / 28) % 12] + ' 2026';
    h.keep(h.text(5, 181, date + '   $' + C.funds + '   INTEL ' + C.kills + '/' + this.attrs.goal, COL.text, { hud: true, depth: 6 }));
    h.keep(h.text(5, 192, (this.news ?? '').slice(0, 50), COL.amber, { hud: true, depth: 6, scale: 0.8 }));
    h.keep(h.text(236, 177, 'THREAT ' + C.presence + '%', C.presence >= 80 ? COL.bad : COL.gold, { hud: true, depth: 6 }));
    h.keep(h.panel(236, 187, 80, 8, UI.dark, { raised: false, depth: 2 })); h.keep(h.rect(238, 189, 76 * Math.min(1, C.presence / 100), 4, C.presence >= 80 ? 0xe03020 : 0xa89030, 1, true, 3));
    this.music('music_base', 0.25, { offset: this.musicConfig.baseStartSeconds });
  }

  // ---- base (research, facilities, roster) ---------------------------------------------------------------------------------------------------------------
  baseScreen(msg = '') {
    this.clearScreen(); this.mode = 'base'; if (this.blinkT) this.blinkT.remove(); this.camCenter(VW / 2, VH / 2); const h = this, C = this.C, R = C.R; this.techRects = [];
    h.keep(h.rect(0, 0, VW, VH, 0x14122e, 1)); h.keep(h.text(6, 2, 'X-KOM BASE', COL.blue, { hud: true, depth: 6, scale: 2 })); h.keep(h.text(VW - 4, 6, `FUNDS $${C.funds}`, COL.gold, { origin: [1, 0], hud: true, depth: 6 }));
    // facility grid (5x5 cells of 24px): L lift · Q quarters · R lab · W workshop · A radar · S stores · H hangar (2x2)
    const FAC = [['LFT', 0, 0, 1, 1, 0x3a4a6a], ['QTR', 1, 0, 1, 1, 0x3a6a4a], ['LAB', 2, 0, 1, 1, R.active ? 0x7a5aa0 : 0x5a4a80], ['WRK', 3, 0, 1, 1, 0x6a5a3a], ['RDR', 4, 0, 1, 1, 0x3a6a7a], ['STR', 0, 1, 1, 1, 0x5a5a62], ['HANGAR', 1, 2, 2, 2, 0x4a5a8a], ['GUN', 4, 2, 1, 1, 0x8a4a3a], ['GUN', 0, 2, 1, 1, 0x8a4a3a]];
    h.keep(h.panel(3, 21, 126, 126, UI.dark, { raised: false, depth: 1 })); for (const [n, cx, cy, w, hh, col] of FAC) { h.keep(h.panel(6 + cx * 24, 24 + cy * 24, w * 24 - 2, hh * 24 - 2, col, { depth: 2 })); h.keep(h.label(6 + cx * 24, 24 + cy * 24, w * 24 - 2, hh * 24 - 2, n)); }
    h.keep(h.text(6, 150, 'SOLDIERS', COL.gold, { hud: true, depth: 6 })); C.squad.forEach((m, i) => h.keep(h.text(6 + (i % 2) * 64, 160 + ((i / 2) | 0) * 9, `${m.name.toUpperCase().slice(0, 8)} K${m.kills}`, COL.text, { hud: true, depth: 6 })));
    h.keep(h.text(138, 22, 'RESEARCH', COL.gold, { hud: true, depth: 6 })); h.keep(h.text(VW - 4, 22, '(CLICK A PROJECT)', COL.dim, { origin: [1, 0], hud: true, depth: 6 }));
    TECHS.forEach((t, i) => { const y = 31 + i * 20, st = techStatus(R, t), col = { DONE: 0x2c6a3a, ACTIVE: 0x7a56b0, READY: UI.face, LOCKED: 0x30304a }[st];
      h.keep(h.panel(138, y, 180, 19, col, { depth: 2 })); h.keep(h.text(141, y + 5.5, t.name, st === 'LOCKED' ? COL.dim : COL.text, { origin: [0, 0.5], hud: true, depth: 6 })); h.keep(h.text(315, y + 5.5, st === 'ACTIVE' ? `${R.progress}/${t.days} DAYS` : st === 'DONE' ? 'DONE' : `${t.days}D $${t.cost}`, st === 'DONE' ? COL.good : st === 'ACTIVE' ? COL.amber : COL.gold, { origin: [1, 0.5], hud: true, depth: 6 }));
      h.keep(h.text(141, y + 13.5, t.info, COL.dim, { origin: [0, 0.5], hud: true, depth: 6 })); this.techRects.push({ id: t.id, x: 138, y, w: 180, h: 19 }); });
    if (R.active) { const t = tech(R.active); h.keep(h.rect(138, 174, 180, 6, 0x000000, 1)); h.keep(h.rect(139, 175, 178 * R.progress / t.days, 4, 0xa070e0, 1)); if (!msg) h.keep(h.text(138, 183, `ACTIVE: ${t.name}`.slice(0, 26), COL.amber, { hud: true, depth: 6 })); } else if (!msg) h.keep(h.text(138, 180, 'LAB IDLE', COL.dim, { hud: true, depth: 6 }));
    if (msg) h.keep(h.text(138, 183, msg.slice(0, 32), COL.bad, { scale: 0.85, hud: true, depth: 6 })); h.keep(h.panel(262, 183, 56, 13, UI.face, { depth: 2 })); h.keep(h.label(262, 183, 56, 13, 'BACK [B]')); this.backBtn = { x: 262, y: 184, w: 56, h: 12 };
    this.clockText = h.keep(h.text(6, 190, '', COL.dim, { hud: true, depth: 6, scale: 0.85 })); this.refreshClock(); this.music('music_base', 0.2, { offset: this.musicConfig.baseStartSeconds });
  }
  pickTech(id) { const f = { v: this.C.funds }, err = startTech(this.C.R, f, id); if (err) { this.sfx('error', 0.4); return this.baseScreen(err); } this.C.funds = f.v; this.sfx('confirm', 0.5); this.news = `RESEARCH STARTED: ${tech(id).name}`; this.baseScreen(); this.saveCampaign(); }

  // ---- missions ---------------------------------------------------------------------------------------------------------------------------------------------
  /** pick a site → interception (radar anim, optional shooter, D skips; P/ESC pauses) → ground mission */
  intercept(site) {
    this.checkpointCampaign(); this.clearScreen(); this.mode = 'air'; if (this.blinkT) this.blinkT.remove(); this.camCenter(VW / 2, VH / 2);
    this.air.start({ site, onEnd: (r) => { this.air.destroy(); if (r.downed) { site.aliens = Math.max(2, site.aliens - r.downed); this.C.funds += r.downed * 300; } else if (r.crashed) this.C.funds = Math.max(0, this.C.funds - 500); this.deploy(site); } });
  }
  deploy(site) {
    this.checkpointCampaign(); this.clearScreen(); this.mode = 'tac'; if (this.blinkT) this.blinkT.remove(); this.site = site; this.sfx('alarm', 0.3);
    this.tac.start({ squad: this.C.squad, seed: site.seed, aliens: site.aliens, mods: techMods(this.C.R), onEnd: (r) => this.tacDone(r) });
    if (site.final) this.tac.msg('SOURCE RAID: SECURE INVASION COORDINATES', COL.gold);
  }
  tacDone(r) {
    const C = this.C, site = this.site; this.tac.destroy(); C.missions++; C.day += 3; C.kills += r.kills; C.lost += r.dead; C.funds += r.kills * 100 + (r.win ? 500 : 0); this.research(3);
    C.squad = r.survivors.filter(Boolean); while (C.squad.length < 6) C.squad.push(newRookie(this.mulberry(this.seed + C.missions * 31 + C.squad.length), C.lost + C.squad.length));
    if (r.win) { C.presence -= site.relief; for (const m of C.squad) m.missions++; } else C.presence += 20;
    C.presence += 4; C.presence = Math.max(0, C.presence); if (site.final) { C.sourceSecured = r.win; this.news = r.win ? 'SOURCE SECURED: LAUNCH FINAL ASSAULT [F]' : 'SOURCE RAID FAILED: REGROUP AND RETRY [F]'; } else resolveContact(C, site, r.win, this.seed);
    this.afterEvent();
  }
  research(days) { const t = advanceTech(this.C.R, days); this.news = t ? `RESEARCH COMPLETE: ${t.name} - ${t.info}` : (this.C.R.active ? `RESEARCHING ${tech(this.C.R.active).name} ${this.C.R.progress}/${tech(this.C.R.active).days} DAYS` : 'LAB IDLE - CHOOSE A PROJECT IN THE BASE [B]'); if (t) this.sfx('built', 0.5); }
  afterEvent() {
    const C = this.C; this.mode = 'geo'; this.saveCampaign();
    if (C.presence >= 100) return this.alertThenRts(); this.geoscape();
  }
  async alertThenRts() {
    this.checkpointCampaign(); this.clearScreen(); this.mode = 'alert'; const h = this; h.keep(h.rect(0, 0, VW, VH, 0x300808, 1)); this.music('music_game', 0.25, { offset: this.musicConfig.rtsStartSeconds }); this.sfx('alarm', 0.6); this.ps.sound?.stopAll?.();
    const T = (s, y, c, sc = 1) => h.keep(h.text(VW / 2, y, s, c, { origin: [0.5, 0], scale: sc, hud: true, depth: 6 }));
    T('ALIEN PRESENCE 100%', 40, COL.bad, 3); T('THE HIVE IS AWAKE.', 80, COL.text, 2); T('OPERATION: HIVE STRIKE', 104, COL.gold, 1); T('DEPLOY THE BASE FORCE - DESTROY THE ALIEN HIVE', 122, COL.alien);
    const revision = this.screenRevision; await this.wait(2600); if (revision === this.screenRevision && this.mode === 'alert') this.startRts();
  }
  startRts(final = false) {
    this.checkpointCampaign(); this.finalOperation = final; this.clearScreen(); this.mode = 'rts'; this.rts.start({ mode: 'xkom', music: 'music_game', seed: this.seed + 99 + this.C.rtsDone, bonus: Math.min(4, Math.floor(this.C.squad.length / 2)), mods: techMods(this.C.R), diff: 1 + this.C.rtsDone * 0.2 + (final ? 0.5 : 0),
      briefing: final ? 'FINAL ASSAULT: DESTROY THE SOURCE HIVE' : 'DESTROY THE ALIEN HIVE', winText: 'HIVE DESTROYED', loseText: 'BASE OVERRUN', onEnd: (r) => this.rtsDone(r) });
  }
  rtsDone(r) {
    this.rts.destroy(); const C = this.C; C.rtsDone++;
    if (!r.win) return this.ending(false);
    C.kills += r.kills; C.funds += 2000 + r.kills * 50; C.presence = 20; C.day += 5; this.research(5); if (this.finalOperation) return this.ending(true); this.afterEvent();
  }

  // ---- endings --------------------------------------------------------------------------------------------------------------------------------------------------
  ending(win) {
    this.clearScreen(); this.mode = 'end'; this.C.over = true; this.C.victory = win; this.saveCampaign(); const h = this, C = this.C; h.keep(h.rect(0, 0, VW, VH, win ? 0x081830 : 0x280808, 1)); h.keep(h.img('world', 0, 0, 20, 0, [0, 0], true)).setAlpha(0.3);
    const T = (s, y, c, sc = 1) => h.keep(h.text(VW / 2, y, s, c, { origin: [0.5, 0], scale: sc, hud: true, depth: 6 }));
    if (win) { T('EARTH IS SAFE', 30, COL.good, 4); T('THE ALIEN THREAT IS BROKEN', 72, COL.text); } else { T('EARTH HAS FALLEN', 30, COL.bad, 4); T('YOUR BASE WAS OVERRUN BY THE HIVE', 72, COL.text); }
    T(`ALIENS KILLED ${C.kills}   MISSIONS ${C.missions}   SOLDIERS LOST ${C.lost}`, 96, COL.gold); T(`HIVE OPERATIONS ${C.rtsDone}   TECHS ${C.R.done.length}/${TECHS.length}`, 108, COL.alien);
    T('PRESS ENTER TO PLAY AGAIN', 150, COL.gold); this.sfx(win ? 'victory' : 'defeat', 0.5); this.music('music_base', 0.2, { offset: this.musicConfig.baseStartSeconds });
  }

  // ---- input routing --------------------------------------------------------------------------------------------------------------------------------------------
  keyEv(e, down) {
    if (!this.ready || this.pause?.open || this.dev?.open || this.startGate?.active || e.ctrlKey || e.metaKey || e.altKey) return; const k = e.key;
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' ', 'Tab'].includes(k)) e.preventDefault();
    if (down && this.mode !== 'end' && this.help.key(e)) return; if (this.help.open) return;
    if (this.mode === 'rts') { if (this.rts.over && down) this.rts.doneKey?.(e); else this.rts.key(e, down); return; }
    if (this.mode === 'air') return this.air.key(e, down);
    if (!down) return;
    if (this.mode === 'title') { if (k === 'Enter' || k === ' ') this.continueCampaign(); else if (k === 'n' || k === 'N') this.beginCampaign(); }
    else if (this.mode === 'base') { if (k === 'b' || k === 'B' || k === 'Escape') this.geoscape(); else if (/^[1-7]$/.test(k)) this.pickTech(TECHS[+k - 1].id); }
    else if (this.mode === 'geo') { if (k === 'b' || k === 'B') this.baseScreen(); else if (/^[1-3]$/.test(k)) this.intercept(this.sites[+k - 1]); else if (k === 'f' || k === 'F') this.launchFinale(); else if (k === 'r' || k === 'R') { this.C.presence = 100; this.alertThenRts(); } else { const id = { z: 'hq', Z: 'hq', g: 'globe', G: 'globe', ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down', '+': 'in', '=': 'in', '-': 'out' }[k]; if (id) this.geo.action(id); } }
    else if (this.mode === 'tac') { if (this.tac.over) this.tac.doneKey?.(e); else this.tac.key(e); }
    else if (this.mode === 'end') { if (k === 'Enter') { this.newCampaign(); this.titleScreen(); } }
  }
  ptrEv(p, type) {
    if (!this.ready || this.pause?.open || this.dev?.open || this.startGate?.active) return; const [, , lx, ly] = this.ptr(p);
    if (this.help.pointer(type)) return;
    if (this.mode === 'rts') return this.rts.pointer(p, type);
    if (this.mode === 'air') return this.air.pointer(p, type);
    if (type === 'move') { if (this.mode === 'tac') this.tac.pointer(p, false); return; }
    if (type !== 'down') return;
    if (this.mode === 'title') { if (ly >= 144 && ly < 161 && lx >= 16 && lx < 168 && this.savedCampaign()) this.beginCampaign(); else this.continueCampaign(); this.sfx('confirm', 0.5); }
    else if (this.mode === 'base') { const hit = (r) => lx >= r.x && lx < r.x + r.w && ly >= r.y && ly < r.y + r.h; if (hit(this.backBtn)) { this.sfx('click', 0.4); this.geoscape(); } else { const t = this.techRects.find(hit); if (t) this.pickTech(t.id); } }
    else if (this.mode === 'geo') { const button = this.geoBtns.find(q => lx >= q.x && lx < q.x + q.w && ly >= q.y && ly < q.y + q.h); if (button) { this.sfx('click', 0.3); return button.id === 'base' ? this.baseScreen() : button.id === 'final' ? this.launchFinale() : this.geo.action(button.id); }
      const site = this.sites.find(s => lx >= s.rect.x && lx < s.rect.x + s.rect.w && ly >= s.rect.y && ly < s.rect.y + s.rect.h) ?? this.geo.hit(lx, ly); if (site) { this.sfx('confirm', 0.5); this.intercept(site); } }
    else if (this.mode === 'tac') this.tac.pointer(p, true);
    else if (this.mode === 'end') { this.newCampaign(); this.titleScreen(); }
  }
}
