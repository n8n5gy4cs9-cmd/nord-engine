// FpsGame — runs one FPS Creator level in an existing Babylon scene: world, renderer, player, entities+scripts, doors, projectiles, HUD, level flow.
// Not tied to Nord's scene system: the Nord wrapper (level-script.js) and the editor play-test (editor/fpsc/play.html) both create one of these.
import { CELL, STORY, normalize, startOf } from './level.js';
import { World } from './world.js';
import { LevelRenderer, hex } from './render.js';
import { Controls, Player, ViewModel, PLAYER } from './player.js';
import { Ent, ScriptInst, Bus } from './entity.js';
import { Model, modelSpec } from './models.js';
import { Fx } from './fx.js';
import { Hud } from './hud.js';
import { Sfx } from './audio.js';
import { weaponDef, AMMO } from './weapons.js';
import { installRules } from './actions.js';
import { resolveScripts } from './bank.js';

const D2R = Math.PI / 180;
const persist = new Map(); // level name → checkpoint snapshot (survives restart in the same page)

/** Vertical cylinder vs ray → nearest t in [0,maxT] or null. */
export function rayCylinder(o, d, cx, cz, r, y0, y1, maxT) {
  const ox = o[0] - cx, oz = o[2] - cz, a = d[0] * d[0] + d[2] * d[2];
  let best = null;
  const consider = (t) => { if (t >= 0 && t <= maxT && (best === null || t < best)) best = t; };
  if (a > 1e-9) {
    const b = 2 * (ox * d[0] + oz * d[2]), c = ox * ox + oz * oz - r * r, disc = b * b - 4 * a * c;
    if (disc >= 0) { const s = Math.sqrt(disc); for (const t of [(-b - s) / (2 * a), (-b + s) / (2 * a)]) { const y = o[1] + d[1] * t; if (y >= y0 && y <= y1) { consider(t); break; } } }
  }
  if (Math.abs(d[1]) > 1e-9) for (const py of [y0, y1]) { const t = (py - o[1]) / d[1], x = ox + d[0] * t, z = oz + d[2] * t; if (x * x + z * z <= r * r) consider(t); }
  return best;
}

export class FpsGame {
  /** opts: { B, scene, canvas, container, level, bank, playtest?:{x,z,layer,rot}, autostart, onWin, onNext, onQuit, onLog, noLock, bake } */
  constructor(opts) {
    this.opts = opts; this.B = opts.B; this.scene = opts.scene; this.canvas = opts.canvas; this.container = opts.container ?? document.body;
    this.bank = opts.bank; this.level = normalize(structuredClone(opts.level));
    this.bus = new Bus(); this.sfx = opts.sfx ?? new Sfx(); this.time = 0; this.paused = true; this.state = 'loading'; this.ents = []; this.solids = []; this.projectiles = []; this.timers = []; this.startQ = [];
    this.fellOut = false; this.stats = { kills: 0, total: 0 }; this.errors = new Set(); this.rebake = 0; this.cpTimer = 0;
  }

  // ---- lifecycle ------------------------------------------------------------------------------------------------------------
  async start() {
    const B = this.B, scene = this.scene, lv = this.level, o = this.opts;
    this.world = new World(lv, { piece: (i) => this.bank.piece(i), cellPiece: (i) => this.bank.cellPiece(i), stair: (i) => this.bank.stair(i) });
    this.renderer = new LevelRenderer(B, scene, this.world, lv, this.bank, { occlude: o.bake !== false });
    this.fx = new Fx(B, scene);
    this.hud = new Hud(this.container);
    this.camera = new B.UniversalCamera('fpsc-cam', new B.Vector3(0, 2, 0), scene);
    this.camera.inputs.clear(); this.camera.minZ = 0.04; this.camera.maxZ = 600; this.camera.fov = 1.25; this.camera.rotationQuaternion = null; scene.activeCamera = this.camera;
    scene.setRenderingAutoClearDepthStencil(1, true, true, false);
    this.ctl = new Controls(this.canvas); this.ctl.noLock = !!o.noLock; this.ctl.onFallback = () => this.say('Mouse capture unavailable here — hold the RIGHT mouse button to look around.', 5);
    this.ctl.onLockChange = (l) => { if (!l && this.state === 'play') this.pause(true); };
    this.player = new Player(this); this.viewmodel = new ViewModel(this);
    this.sfx.setCustomSources(this.bank.sounds);
    this.#spawnAll();
    for (const e of this.ents) installRules(this, e);
    this.#collectLights();
    this.renderer.build(this.staticLights);
    this.#initPlayer();
    this.hud.on('resume', () => this.pause(false)); this.hud.on('restart', () => this.restart()); this.hud.on('checkpoint', () => this.restart({ checkpoint: true }));
    this.hud.on('quit', () => o.onQuit?.()); this.hud.on('next', () => o.onNext?.(this.nextLevel)); this.hud.on('begin', () => this.begin());
    this.hud.objective(lv.settings.objective || '');
    this.stats.total = this.ents.filter((e) => e.enemy && !e.props.optional).length;
    this.minimapOn = true; this.mmT = 0; this.lightT = 0; this.promptT = 0;
    for (const e of [...this.ents]) e.call('start');
    for (const f of this.startQ) { try { f(); } catch (e) { console.error(e); } } this.startQ = [];
    this.state = 'intro';
    this.hud.screen('intro', true, { title: lv.name, text: lv.settings.intro || 'Find the exit.' });
    if (o.autostart) this.begin();
    return this.renderer.stats;
  }

  begin() {
    this.sfx.unlock(); this.hud.screen('intro', false); this.state = 'play'; this.paused = false;
    if (!this.ctl.noLock) this.ctl.lock();
    if (this.level.settings.music) this.sfx.playMusic(this.level.settings.music, 0.35);
    this.bus.emit('level.start', {});
  }
  pause(on) {
    if (this.state !== 'play' && !(this.state === 'paused' && !on)) return;
    this.paused = on; this.state = on ? 'paused' : 'play'; this.hud.screen('pause', on);
    if (on) this.ctl.unlock(); else { this.sfx.unlock(); if (!this.ctl.noLock) this.ctl.lock(); }
  }
  restart(o = {}) { this.opts.onRestart?.(o); }
  dispose() {
    this.state = 'disposed'; this.ctl?.off?.(); this.ctl?.unlock(); this.sfx.stopMusic?.();
    for (const e of [...this.ents]) e.destroy(); this.viewmodel?.dispose(); this.renderer?.dispose(); this.fx?.clear(); this.hud?.dispose();
    for (const p of this.projectiles) p.mesh?.dispose(); this.camera?.dispose(); this.bus.clear();
  }

  // ---- spawning ---------------------------------------------------------------------------------------------------------------
  #spawnAll() { for (const d of this.level.entities) if (d.type !== 'player_start') this.#make(d); }
  #make(d) {
    const def = this.bank.entity(d.type);
    if (!def) { this.warn(`unknown entity type "${d.type}" (skipped)`); return null; }
    const layer = d.layer | 0, base = this.world.floorAt(d.x, d.z, layer * STORY + STORY - 0.05);
    const fy = base ? base.y : layer * STORY;
    const e = new Ent(this, d, def, d.x, fy + (def.elev ?? 0) + (+d.y || 0), d.z);
    e.hit = def.hit ?? (!!def.enemy || !!def.solid || e.maxHp > 0);
    e.float = 0; e.baseY = fy;
    if (def.model && !(e.props.hidden === true && def.zone)) {
      const spec = modelSpec(e.props.model || def.model, this.bank);
      e.model = new Model(this.B, this.scene, spec, { name: e.name || d.type, scale: +e.props.scale || 1 });
      e.model.root.position.set(e.x, e.y, e.z); e.model.root.rotation.y = e.rot * D2R;
      if (def.height == null && e.model.height) e.height = e.model.height;
      if (e.props.hidden) e.setModelVisible(false);
    }
    if (def.zone) { e.zone = { w: +e.props.w || 4, d: +e.props.d || 4, h: +e.props.h || 3 }; }
    if (def.light) e.light = { on: e.props.on !== false, color: hex(e.props.color || def.light.color), intensity: +(e.props.intensity ?? def.light.intensity), range: +(e.props.range ?? def.light.range), base: +(e.props.intensity ?? def.light.intensity), y: e.y + (def.light.y ?? 0.5) };
    for (const s of resolveScripts(def, d, this.bank)) {
      const mod = this.bank.script(s.id); if (!mod) { this.warn(`script "${s.id}" on ${d.type} not found`); continue; }
      const si = new ScriptInst(e, mod, s.params); si.enabled = s.off !== true; e.scripts.push(si);
    }
    this.ents.push(e); if (def.solid || def.enemy) this.solids.push(e);
    return e;
  }
  /** Spawn at runtime (scripts: game.spawn('enemy_zombie', x, z, layer, { health: 50 })). */
  spawn(type, x, z, layer = 0, props = {}, extra = {}) {
    const e = this.#make({ type, x, z, layer, rot: extra.rot ?? Math.random() * 360, props, name: extra.name ?? '', tag: extra.tag ?? '', rules: [], scripts: extra.scripts ?? [], id: `s${(this._sp = (this._sp ?? 0) + 1)}` });
    if (!e) return null;
    installRules(this, e); this.#startEnt(e);
    if (e.enemy) this.stats.total++;
    return e;
  }
  #startEnt(e) { e.call('start'); }
  removeEnt(e) { const i = this.ents.indexOf(e); if (i >= 0) this.ents.splice(i, 1); const j = this.solids.indexOf(e); if (j >= 0) this.solids.splice(j, 1); }

  find(q) {
    if (!q) return []; if (typeof q === 'object') return [q];
    if (q[0] === '#') return this.ents.filter((e) => !e.destroyed && e.tags.has(q.slice(1)));
    return this.ents.filter((e) => !e.destroyed && (e.name === q || e.id === q));
  }
  doorsNamed(name) { if (!name) return []; return [...this.world.doors.values()].filter((d) => d.name === name || (name[0] === '#' && d.piece.tag === name.slice(1))); }

  #collectLights() {
    this.staticLights = []; this.dynLights = [];
    const referenced = new Set(); for (const e of this.ents) { if (e.target) referenced.add(e.target); for (const r of e.rules) if (r.target) referenced.add(r.target); }
    for (const e of this.ents) {
      if (!e.light) continue;
      const dyn = e.light.dynamic || e.def.light.dynamic || e.props.dynamic || (e.name && referenced.has(e.name)) || [...e.tags].some((t) => referenced.has(`#${t}`)) || e.scripts.some((s) => s.mod.dynamicLight);
      e.light.dynamic = !!dyn;
      if (dyn) this.dynLights.push(e);
      else if (e.light.on) this.staticLights.push({ x: e.x, y: e.light.y, z: e.z, color: e.light.color, intensity: e.light.intensity, range: e.light.range });
    }
  }
  setLight(e, mode) {
    if (!e.light) return; const on = mode === 'on' ? true : mode === 'off' ? false : mode === 'toggle' ? !e.light.on : e.light.on;
    if (/^#?[0-9a-f]{6}$/i.test(mode)) { e.light.color = hex(mode); e.light.on = true; } else e.light.on = on;
    if (!e.light.dynamic) { this.rebake = 0.3; e.light.dynamic = true; }
  }

  #initPlayer() {
    const lv = this.level, p = this.player, st = this.opts.playtest ?? startOf(lv), prop = (lv.entities.find((e) => e.type === 'player_start')?.props) ?? {};
    const cp = persist.get(lv.name);
    p.maxHp = +prop.health || 100; p.hp = p.maxHp; p.armor = +prop.armor || 0;
    const loadout = String(prop.weapons ?? 'knife,pistol').split(',').map((s) => s.trim()).filter(Boolean);
    for (const w of loadout) p.give(`weapon_${w}`, 0);
    p.ammo.bullets = +(prop.bullets ?? 48); p.ammo.shells = +(prop.shells ?? 0); p.ammo.rockets = +(prop.rockets ?? 0); p.ammo.cells = +(prop.cells ?? 0);
    for (const id of p.owned) { const w = weaponDef(id, this.bank); if (w?.mag && !(id in p.mags)) { const take = Math.min(w.mag, p.ammo[w.ammo]); p.mags[id] = take; p.ammo[w.ammo] -= take; } }
    const best = p.weaponList().filter((w) => w.id !== 'knife').pop() ?? p.weaponList()[0]; p.cur = null; if (best) { p.owned.add(best.id); p.select(best.id); p.swap = 0; }
    if (this.opts.useCheckpoint && cp) { Object.assign(p, { hp: cp.hp, armor: cp.armor, ammo: { ...cp.ammo }, mags: { ...cp.mags }, owned: new Set(cp.owned), keys: new Set(cp.keys), score: cp.score }); if (cp.cur) { p.cur = null; p.select(cp.cur); p.swap = 0; } p.teleport(cp.x, cp.z, cp.layer, cp.rot); }
    else { p.teleport(st.x, st.z, st.layer | 0, st.rot ?? 0); if (!this.opts.playtest) persist.delete(lv.name); }
    if (this.opts.playtest?.noclip) p.noclip = true;
  }
  saveCheckpoint(src) {
    const p = this.player; persist.set(this.level.name, { x: p.x, z: p.z, layer: p.layer, rot: p.yaw / D2R, hp: Math.max(p.hp, 40), armor: p.armor, ammo: { ...p.ammo }, mags: { ...p.mags }, owned: [...p.owned], cur: p.cur, keys: [...p.keys], score: p.score });
    this.say('Checkpoint saved', 2); this.sound('checkpoint', null);
  }

  // ---- services for scripts ---------------------------------------------------------------------------------------------------
  after(sec, fn) { const t = { t: sec, fn, every: 0 }; this.timers.push(t); return t; }
  every(sec, fn) { const t = { t: sec, fn, every: sec }; this.timers.push(t); return t; }
  onStart(fn) { if (this.state === 'loading') this.startQ.push(fn); else fn(); }
  say(text, secs = 3) { this.hud?.message(text, secs); }
  objective(text) { this.hud?.objective(text); this.opts.onObjective?.(text); }
  sound(name, at = null, o) { this.sfx.play(name, at ? (at.eyePos ? { x: at.x, y: at.y, z: at.z } : { x: at.x, y: at.y ?? 0, z: at.z }) : null, o); }
  warn(msg) { console.warn('[fpsc]', msg); this.opts.onLog?.('warn', msg); }
  scriptError(s, hook, e) { const k = `${s.id}.${hook}:${e?.message}`; if (this.errors.has(k)) return; this.errors.add(k); console.error(`[fpsc] script "${s.id}" on "${s.ent?.name || s.ent?.type}" (${hook}):`, e); this.opts.onLog?.('error', `script "${s.id}" ${hook}: ${e?.message ?? e}`); }
  give(item, n) { const ok = this.player.give(item, n); if (ok) { this.hud.pickup(item.startsWith('health') ? '#ff4d4d' : item.startsWith('armor') ? '#4aa0ff' : '#ffd23a'); } return ok; }
  noise(pos, radius, src = null) { for (const e of this.ents) if (e.enemy && e.alive && e.enabled) { const d = Math.hypot(e.x - pos[0], e.z - pos[2]); if (d <= radius) e.call('heard', pos, src, d); } }
  win(next) { if (this.state !== 'play') return; this.state = 'won'; this.nextLevel = next || this.level.settings.next || ''; this.ctl.unlock(); this.sound('win', null); const p = this.player, t = Math.floor(p.time);
    this.hud.screen('won', true, { stats: `Kills ${this.stats.kills}/${this.stats.total}\nScore ${p.score}\nTime ${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}` });
    this.hud.root.querySelector('[data-a="next"]').style.display = this.nextLevel && this.opts.onNext ? '' : 'none';
    this.bus.emit('level.won', { stats: { ...this.stats, score: p.score, time: t } }); this.opts.onWin?.({ next: this.nextLevel, stats: this.stats }); }
  lose(msg) { this.player.hurt(9999, null); this.loseMsg = msg; }
  onPlayerDied(src) {
    if (this.state !== 'play') return; this.state = 'dead'; this.ctl.unlock(); this.sound('die', null); this.sound('lose', null);
    this.hud.screen('dead', true, { why: this.loseMsg || (this.fellOut ? 'You fell into the void.' : src?.def?.label ? `Killed by ${src.def.label}` : '') });
    this.hud.root.querySelector('[data-a="checkpoint"]').style.display = persist.has(this.level.name) ? '' : 'none';
    this.bus.emit('player.died', {});
  }
  onKilled(ent, src) {
    if (ent.enemy && src === this.player) { this.player.kills++; this.stats.kills++; }
    if (src === this.player || !src) this.player.score += +ent.props.score || +ent.def.score || 0;
    if (ent.props.drop) { const a = this.spawn(ent.props.drop, ent.x + (Math.random() - 0.5), ent.z + (Math.random() - 0.5), ent.layer, {}); void a; }
    this.bus.emit('entity.killed', { ent, src });
  }

  // ---- doors ------------------------------------------------------------------------------------------------------------------
  doorCenter(d) { return d.o === 'H' ? [d.x * CELL + CELL / 2, d.z * CELL] : [d.x * CELL, d.z * CELL + CELL / 2]; }
  /** Request open/close. Locked doors need `force` or the key; returns false if refused. */
  setDoor(d, open, { force = false, by = null } = {}) {
    if (open && d.locked && !force) {
      if (by === this.player && this.player.keys.has(d.locked)) { d.locked = null; this.say(`Unlocked with the ${d.piece.lock || 'key'}`, 2); }
      else { if (by === this.player && this.time - (d.denied ?? -9) > 1.5) { d.denied = this.time; this.say(`This door needs the ${d.locked} key`, 2.5); this.sound('locked', { x: this.doorCenter(d)[0], y: 1.5, z: this.doorCenter(d)[1] }); } return false; }
    }
    d.target = open ? 1 : 0; d.hold = open ? (d.piece.close ?? 4) : 0; return true;
  }
  #updateDoors(dt) {
    const p = this.player, near = (d, who, r) => { const c = this.doorCenter(d); return Math.hypot(who.x - c[0], who.z - c[1]) < r; };
    this.doorT = (this.doorT ?? 0) - dt;
    const think = this.doorT <= 0; if (think) this.doorT = 0.12;
    for (const d of this.world.doors.values()) {
      const base = d.layer * STORY;
      if (think && (d.auto || d.open > 0.05)) {
        const pn = p.alive && Math.abs(p.y - base) < STORY && near(d, p, d.o === 'H' ? 2.7 : 2.7);
        const en = this.ents.some((e) => e.enemy && e.alive && e.enabled && e.def.opensDoors !== false && Math.abs(e.y - base) < STORY && near(d, e, 2.2));
        if (d.auto && !d.secret && (pn || en)) { if (d.target < 1 && (!d.locked || (pn && !en))) this.setDoor(d, true, { by: pn ? p : null }); }
        else if (d.open > 0.05 && d.target > 0 && (d.hold -= 0.12) <= 0 && !near(d, p, 1.4) && !this.ents.some((e) => e.alive && e.enemy && near(d, e, 1.1))) d.target = 0;
      }
      if (d.open !== d.target) {
        const was = d.open, dir = Math.sign(d.target - d.open);
        d.open = Math.max(0, Math.min(1, d.open + dir * dt * d.speed * 0.6));
        this.renderer.updateDoor(d);
        if (was === 0 && d.open > 0) { const c = this.doorCenter(d); this.sound('door', { x: c[0], y: base + 1.5, z: c[1] }); if (d.name) this.bus.emit(`${d.name}.opened`); }
        if (d.open === 0 && was > 0 && d.name) this.bus.emit(`${d.name}.closed`);
      }
    }
  }

  // ---- combat -----------------------------------------------------------------------------------------------------------------
  /** Fire a ray. src = Ent|player (never hit). Returns { kind:'ent'|'wall'|'player'|null, ent?, point, normal? } */
  hitscan(origin, dir, range, dmg, src, o = {}) {
    const wall = this.world.ray(origin[0], origin[1], origin[2], dir[0], dir[1], dir[2], range, 'bullet'), maxT = wall ? wall.t : range;
    let best = null, kind = null;
    for (const e of this.ents) {
      if (e === src || !e.hit || !e.alive || !e.enabled || e.destroyed || (o.skip && o.skip(e))) continue;
      const t = rayCylinder(origin, dir, e.x, e.z, e.radius, e.y, e.y + e.height, maxT);
      if (t !== null && (best === null || t < best.t)) best = { t, ent: e };
    }
    if (src !== this.player && this.player.alive && !this.player.god) {
      const p = this.player, t = rayCylinder(origin, dir, p.x, p.z, p.radius, p.y, p.y + p.height, best ? best.t : maxT);
      if (t !== null) { best = { t, player: true }; }
    }
    let point;
    if (best) { point = [origin[0] + dir[0] * best.t, origin[1] + dir[1] * best.t, origin[2] + dir[2] * best.t]; kind = best.player ? 'player' : 'ent'; }
    else if (wall) { point = [wall.x, wall.y, wall.z]; kind = 'wall'; }
    else point = [origin[0] + dir[0] * range, origin[1] + dir[1] * range, origin[2] + dir[2] * range];
    if (o.tracer) this.fx.tracer(o.muzzle ?? origin, point, o.tracer);
    if (kind === 'ent') {
      const e = best.ent; let d = dmg; if (point[1] > e.y + e.height * 0.82 && e.enemy && !o.noHead) { d *= 1.8; o.head = true; }
      if (src === this.player) this.player.hits++;
      if (e.def.blood === null) this.fx.spark(point, 6, [0, 1, 0]); else this.fx.blood(point, e.def.blood ?? '#b01818');
      e.hurt(d, src, 'bullet'); if (e.def.blood !== undefined || e.hit) this.sound('hit', e, { volume: 0.6 });
      return { kind, ent: e, point };
    }
    if (kind === 'player') { this.player.hurt(dmg, src); this.fx.blood(point); return { kind, point }; }
    if (kind === 'wall') { const n = Math.abs(wall.nx) + Math.abs(wall.nz) > 0 ? [wall.nx, 0, wall.nz] : [0, 1, 0]; this.fx.spark(point, 5, n); this.fx.decal(point, n); this.sound('impact', { x: point[0], y: point[1], z: point[2] }, { volume: 0.5, minGap: 0.05 }); return { kind, point, normal: n }; }
    return { kind: null, point };
  }

  /** Enemy hitscan at the player with spread by accuracy 0..1 (higher = better). */
  enemyShot(e, { dmg = 8, accuracy = 0.6, range = 40, tracer = '#ffb36b', sfx = 'rifle', muzzle = 0.5, pellets = 1, origin = null } = {}) {
    const p = this.player, o = e.eye, fwd = e.dir; const org = origin ?? [o[0] + fwd[0] * muzzle, o[1] - 0.1, o[2] + fwd[1] * muzzle];
    const tgt = [p.x, p.y + p.height * 0.55, p.z], d = Math.hypot(tgt[0] - org[0], tgt[2] - org[2]);
    for (let i = 0; i < pellets; i++) {
      const sp = (1 - accuracy) * 0.16 * Math.min(1.4, 0.4 + d / 18);
      const dir = norm([tgt[0] - org[0] + (Math.random() - 0.5) * sp * d * 2, tgt[1] - org[1] + (Math.random() - 0.5) * sp * d * 1.2, tgt[2] - org[2] + (Math.random() - 0.5) * sp * d * 2]);
      this.hitscan(org, dir, range, dmg, e, { tracer, muzzle: org });
    }
    this.sound(sfx, e); this.fx.flash(org, tracer, 5, 0.06, 1.0);
  }

  fireProjectile(src, org, dir, o = {}) {
    const B = this.B, mesh = B.MeshBuilder.CreateSphere('proj', { diameter: 1, segments: 6 }, this.scene); mesh.scaling.setAll(o.size ?? 0.15); mesh.material = this.fx.mat(o.color ?? '#ff9a3a'); mesh.isPickable = false;
    const sp = o.speed ?? 18, pr = { x: org[0], y: org[1], z: org[2], vx: dir[0] * sp, vy: dir[1] * sp, vz: dir[2] * sp, src, dmg: o.dmg ?? 10, splash: o.splash ?? 0, mesh, o, life: o.life ?? 6, g: o.gravity ?? 0, size: o.size ?? 0.15 };
    this.projectiles.push(pr); if (o.sfx) this.sound(o.sfx, { x: org[0], y: org[1], z: org[2] }); return pr;
  }
  #updateProjectiles(dt) {
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i]; p.life -= dt; p.vy -= p.g * dt;
      const dx = p.vx * dt, dy = p.vy * dt, dz = p.vz * dt, L = Math.hypot(dx, dy, dz) || 1e-6;
      const wall = this.world.ray(p.x, p.y, p.z, dx, dy, dz, L + 0.05, 'bullet');
      let hit = null;
      if (wall) hit = { at: [wall.x, wall.y, wall.z], n: [wall.nx, 0, wall.nz] };
      const steps = Math.max(1, Math.ceil(L / 0.4));
      for (let s = 1; s <= steps && !hit; s++) {
        const x = p.x + dx * (s / steps), y = p.y + dy * (s / steps), z = p.z + dz * (s / steps);
        for (const e of this.ents) { if (e === p.src || !e.hit || !e.alive || !e.enabled) continue; if (Math.hypot(e.x - x, e.z - z) < e.radius + p.size && y > e.y && y < e.y + e.height) { hit = { at: [x, y, z], ent: e }; break; } }
        const pl = this.player; if (!hit && p.src !== pl && pl.alive && Math.hypot(pl.x - x, pl.z - z) < pl.radius + p.size && y > pl.y && y < pl.y + pl.height) hit = { at: [x, y, z], player: true };
      }
      if (hit || p.life <= 0) {
        const at = hit ? hit.at : [p.x, p.y, p.z];
        if (p.splash > 0) this.explode(at, p.splash, p.dmg, p.src, { sfx: p.o.explodeSfx });
        else if (hit?.ent) hit.ent.hurt(p.dmg, p.src, 'projectile'); else if (hit?.player) this.player.hurt(p.dmg, p.src);
        else if (hit) { this.fx.spark(at, 6, hit.n ?? [0, 1, 0]); }
        if (!p.splash && hit) this.fx.flash(at, p.o.color ?? '#ffb040', 4, 0.12, 1);
        p.mesh.dispose(); this.projectiles.splice(i, 1); continue;
      }
      p.x += dx; p.y += dy; p.z += dz; p.mesh.position.set(p.x, p.y, p.z);
      if (p.o.light) this.fx.flash([p.x, p.y, p.z], p.o.color ?? '#ffb040', p.o.light, 0.05, 1.1);
      if (p.o.trail && Math.random() < 0.7) this.fx.burst([p.x, p.y, p.z], { n: 1, color: p.o.trail, speed: 0.3, life: 0.5, size: 0.14, gravity: -0.3 });
    }
  }
  explode(at, radius, dmg, src, o = {}) {
    this.fx.explosion(at, radius); this.sound(o.sfx ?? 'explosion', { x: at[0], y: at[1], z: at[2] }, { range: 90 }); this.noise(at, 45, src);
    const org = [at[0], at[1] + 0.15, at[2]];
    for (const e of [...this.ents]) {
      if (!e.hit || !e.alive || !e.enabled || e === o.skip) continue;
      const d = Math.hypot(e.x - at[0], e.y + e.height * 0.5 - at[1], e.z - at[2]) - e.radius; if (d > radius) continue;
      if (!this.world.los(org, [e.x, e.y + e.height * 0.5, e.z])) continue;
      e.hurt(dmg * (1 - Math.max(0, d) / radius * 0.8), src, 'explosion');
    }
    const p = this.player, pd = Math.hypot(p.x - at[0], p.y + p.height * 0.5 - at[1], p.z - at[2]) - p.radius;
    if (p.alive && pd < radius && this.world.los(org, [p.x, p.y + p.height * 0.5, p.z])) p.hurt(dmg * (1 - Math.max(0, pd) / radius * 0.8) * (src === p ? 0.5 : 1), src);
  }

  // ---- player combat + interaction -------------------------------------------------------------------------------------------
  #playerWeapons(dt) {
    const p = this.player, ctl = this.ctl; p.cool -= dt; p.swap -= dt;
    for (let n = 1; n <= 9; n++) if (ctl.pressed(`Digit${n}`)) { const w = p.weaponList().find((x) => x.slot === n); if (w) p.select(w.id); }
    if (ctl.wheel) p.cycle(ctl.wheel); if (ctl.pressed('KeyQ') && p.last) p.select(p.last);
    const w = p.weapon; if (!w) return;
    if (p.reload > 0) { p.reload -= dt; if (p.reload <= 0) { const need = w.mag - (p.mags[w.id] ?? 0), take = Math.min(need, p.ammo[w.ammo]); p.mags[w.id] = (p.mags[w.id] ?? 0) + take; p.ammo[w.ammo] -= take; } return; }
    if (ctl.pressed('KeyR') && w.mag && (p.mags[w.id] ?? 0) < w.mag && p.ammo[w.ammo] > 0) { p.reload = w.reload || 1.2; this.sound('reload', null); return; }
    const want = ctl.buttons & 1, edge = want && !p._was; p._was = want;
    if (!want || p.cool > 0 || p.swap > 0 || (!w.auto && !edge)) return;
    if (w.ammo && p.magOf(w) <= 0) { if (edge) { this.sound('empty', null); if (w.mag && p.ammo[w.ammo] > 0) { p.reload = w.reload || 1.2; this.sound('reload', null); } } p.cool = 0.2; return; }
    this.#playerFire(w);
  }
  #playerFire(w) {
    const p = this.player, cam = this.camera; p.cool = w.rate; p.shots++;
    if (w.ammo) { if (w.mag) p.mags[w.id]--; else p.ammo[w.ammo]--; }
    this.viewmodel.fire(); this.sound(w.sfx, null, { volume: w.type === 'melee' ? 0.7 : 1 }); if (!w.silent) this.noise(p.eyePos, w.type === 'melee' ? 6 : 28, p);
    const o = p.eyePos, d = p.dir, right = [Math.cos(p.yaw), 0, -Math.sin(p.yaw)];
    if (w.flash) this.fx.flash([o[0] + d[0] * 0.8, o[1] + d[1] * 0.8, o[2] + d[2] * 0.8], w.tracer ?? '#ffcc66', 7, 0.07, w.flash);
    this.fx.shake = Math.max(this.fx.shake, w.shake ?? 0.07); p.kick = w.recoil ?? 0.04; p.pitch -= (w.recoil ?? 0.04) * 0.5 * (0.6 + Math.random() * 0.8);
    if (w.type === 'melee') { const r = this.hitscan(o, d, w.range, w.dmg, p, { noHead: true }); if (r.kind === 'ent') this.sound(w.hitSfx ?? 'punch', r.ent); return; }
    if (w.type === 'projectile') { const org = [o[0] + d[0] * 0.5 + right[0] * 0.2, o[1] + d[1] * 0.5 - 0.15, o[2] + d[2] * 0.5 + right[2] * 0.2]; this.fireProjectile(p, org, d, { ...w.projectile, dmg: w.dmg, splash: w.splash }); return; }
    const muzzle = [o[0] + d[0] * 0.7 + right[0] * 0.22, o[1] + d[1] * 0.7 - 0.2, o[2] + d[2] * 0.7 + right[2] * 0.22];
    for (let i = 0; i < (w.pellets ?? 1); i++) {
      const s = (w.spread ?? 0.01) * (p.speed > 1 ? 1.6 : 1) * (p.crouching ? 0.6 : 1);
      const dir = norm([d[0] + (Math.random() - 0.5) * s * 2, d[1] + (Math.random() - 0.5) * s * 2, d[2] + (Math.random() - 0.5) * s * 2]);
      this.hitscan(o, dir, w.range ?? 80, w.dmg, p, { tracer: i < 3 ? w.tracer : null, muzzle });
    }
  }
  #interact() {
    const p = this.player, o = p.eyePos, d = p.dir; let target = null, text = null;
    const hit = this.world.ray(o[0], o[1], o[2], d[0], d[1], d[2], 2.9, 'move');
    if (hit?.c.door) {
      const dr = hit.c.door; target = { door: dr };
      text = dr.secret ? null : dr.locked ? `Locked – needs the ${dr.locked} key` : dr.target > 0.5 ? '[E] Close door' : '[E] Open door';
    }
    if (!target) {
      let bestD = 2.7;
      for (const e of this.ents) {
        if (!e.alive || !e.enabled || !(e.def.usable || e.props.usable)) continue;
        const dx = e.x - p.x, dz = e.z - p.z, dist = Math.hypot(dx, dz) - e.radius; if (dist > bestD) continue;
        const ang = Math.abs(((Math.atan2(dx, dz) - p.yaw + Math.PI * 3) % (Math.PI * 2)) - Math.PI); if (ang > 0.7 && dist > 0.8) continue;
        if (Math.abs(e.y - p.y) > 2.2) continue; target = { ent: e }; bestD = dist; text = `[E] ${e.props.prompt || e.def.prompt || 'Use'}`;
      }
    }
    this.hud.prompt(text); this.target = target;
    if (target && this.ctl.pressed('KeyE')) {
      if (target.door) { const dr = target.door; this.setDoor(dr, dr.target < 0.5, { by: p }); }
      else { target.ent.call('use', p); target.ent.emit('used', { by: p }); }
    }
  }

  // ---- frame ------------------------------------------------------------------------------------------------------------------
  /** Advance the game by dt seconds (call once per frame, before rendering). */
  update(dt) {
    dt = Math.min(dt, 0.05);
    if (this.state === 'disposed') return;
    this.hud.tick(dt);
    if (this.state === 'play' && !this.paused) {
      this.time += dt; const p = this.player;
      if (this.ctl.pressed('Escape') && !this.ctl.locked) this.pause(true);
      if (this.ctl.pressed('KeyM')) { this.minimapOn = !this.minimapOn; this.hud.mini.style.display = this.minimapOn ? '' : 'none'; }
      if (this.ctl.pressed('KeyF')) p.flashlight = !p.flashlight;
      p.look(this.ctl);
      const steps = Math.ceil(dt / 0.017);
      for (let i = 0; i < steps; i++) p.update(dt / steps, this.ctl);
      this.#pushOutOfSolids();
      this.#playerWeapons(dt); this.#interact();
      for (const e of [...this.ents]) if (e.enabled && !e.destroyed) { e.call('update', dt); }
      this.#updateTimers(dt); this.#updateProjectiles(dt);
      const lim = this.level.settings.timeLimit; if (lim > 0 && p.time > lim) this.lose('Out of time.');
      if (this.rebake > 0 && (this.rebake -= dt) <= 0) { this.#collectLights(); this.renderer.build(this.staticLights); }
    } else if (this.state === 'won' || this.state === 'dead') { this.#updateTimers(dt); for (const e of this.ents) if (e.enabled) e.call('idle', dt); }
    this.#updateDoors(this.state === 'play' ? dt : 0);
    this.fx.update(dt); this.#sync(dt);
  }
  #pushOutOfSolids() {
    const p = this.player;
    for (const o of this.solids) {
      if (!o.alive || o.destroyed || o.def.enemy && !o.def.pushPlayer && false) continue;
      if (o.y > p.y + p.height || o.y + o.height < p.y + 0.3) continue;
      const dx = p.x - o.x, dz = p.z - o.z, d = Math.hypot(dx, dz), min = p.radius + o.radius;
      if (d < min && d > 1e-4) { const k = (min - d); const m = this.world.moveCircle(p.x, p.z, p.y, p.height, p.radius, (dx / d) * k, (dz / d) * k); p.x = m.x; p.z = m.z; }
    }
  }
  #updateTimers(dt) {
    for (let i = this.timers.length - 1; i >= 0; i--) { const t = this.timers[i]; if (t.dead) { this.timers.splice(i, 1); continue; } t.t -= dt; if (t.t <= 0) { try { t.fn(); } catch (e) { console.error(e); } if (t.every) t.t += t.every; else this.timers.splice(i, 1); } }
  }
  #sync(dt) {
    const p = this.player, cam = this.camera, sh = this.fx.shake, r = this.renderer;
    const bob = p.onGround ? Math.sin(p.bobT) * 0.035 * Math.min(1, (p.speed ?? 0) / 4) : 0;
    cam.position.set(p.x + (Math.random() - 0.5) * sh * 0.05, p.y + p.eye + bob + (Math.random() - 0.5) * sh * 0.05, p.z);
    cam.rotation.set(p.pitch + (Math.random() - 0.5) * sh * 0.02, p.yaw, (Math.random() - 0.5) * sh * 0.01);
    this.sfx.listener = { x: p.x, y: p.y, z: p.z, yaw: p.yaw };
    this.viewmodel.update(dt, p);
    // dynamic lights: transient fx + nearest dynamic level lights + flashlight
    const dl = [];
    if (p.flashlight && p.alive) { const d = p.dir; dl.push({ x: p.x + d[0] * 2, y: p.y + p.eye + d[1] * 2, z: p.z + d[2] * 2, color: [1, 0.96, 0.85], range: 16, intensity: 1.2 }); }
    dl.push(...this.fx.dynamicLights());
    const cand = []; for (const e of this.dynLights) { if (!e.light.on || e.destroyed) continue; const d = Math.hypot(e.x - p.x, e.z - p.z); if (d < e.light.range + 22) cand.push([d, e]); }
    cand.sort((a, b) => a[0] - b[0]);
    for (const [, e] of cand) { if (dl.length >= 8) break; dl.push({ x: e.x, y: e.light.y, z: e.z, color: e.light.color, range: e.light.range, intensity: e.light.intensity }); }
    r.setDynamicLights(dl);
    // model lighting
    this.lightT -= dt;
    if (this.lightT <= 0) { this.lightT = 0.12; for (const e of this.ents) if (e.model && e.visible) e.model.light(r.lightAt(e.x, e.y + e.height * 0.5, e.z), 0.12); }
    for (const e of this.ents) if (e.model) { e.model.root.position.set(e.x, e.y + (e.float ?? 0), e.z); e.model.root.rotation.y = e.rot * D2R; if (e.model.flashT > 0) e.model.light(r.lightAt(e.x, e.y + e.height * 0.5, e.z), dt); }
    // HUD
    const w = p.weapon, t = Math.floor(p.time);
    this.hud.update({ hp: p.hp, maxHp: p.maxHp, armor: p.armor, weapon: w, mag: w ? p.magOf(w) : 0, reserve: w ? p.reserveOf(w) : 0, weapons: p.weaponList(), weaponsKey: [...p.owned].join(',') + p.cur, keys: [...p.keys], kills: this.stats.kills, totalKills: this.stats.total, score: p.score, time: `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}` });
    this.mmT -= dt; if (this.mmT <= 0 && this.minimapOn) { this.mmT = 0.15; this.#minimap(); }
  }
  #minimap() {
    const c = this.hud.mctx, W = 150, p = this.player, S = 3.2, ly = this.level.layers[Math.min(p.layer, this.level.layers.length - 1)];
    c.clearRect(0, 0, W, W); c.save(); c.translate(W / 2, W / 2); c.rotate(p.yaw); // heading-up map
    c.scale(1, -1);
    const px = (x, z) => [(x - p.x) * S, (z - p.z) * S];
    c.strokeStyle = '#9ec3ff'; c.lineWidth = 1.5; c.beginPath();
    for (const k of Object.keys(ly.edges)) { const [x, z, o] = k.split(','); const piece = ly.edges[k]; if (!this.bank.piece(piece.k)?.parts.some((q) => q.opaque !== false)) continue; const X = +x * CELL, Z = +z * CELL; const a = o === 'H' ? px(X, Z) : px(X, Z), b = o === 'H' ? px(X + CELL, Z) : px(X, Z + CELL); if (Math.abs(a[0]) > 90 && Math.abs(b[0]) > 90 || Math.abs(a[1]) > 90 && Math.abs(b[1]) > 90) continue; c.moveTo(a[0], a[1]); c.lineTo(b[0], b[1]); }
    c.stroke();
    for (const e of this.ents) { if (!e.alive || e.destroyed || e.layer !== p.layer) continue; const q = px(e.x, e.z); if (Math.abs(q[0]) > 72 || Math.abs(q[1]) > 72) continue; const col = e.enemy ? '#ff4d4d' : e.def.cat === 'Pickups' ? '#6dff9b' : e.type === 'level_exit' ? '#ffd23a' : null; if (!col) continue; c.fillStyle = col; c.fillRect(q[0] - 1.5, q[1] - 1.5, 3, 3); }
    c.restore(); c.fillStyle = '#fff'; c.beginPath(); c.moveTo(W / 2, W / 2 - 5); c.lineTo(W / 2 - 4, W / 2 + 4); c.lineTo(W / 2 + 4, W / 2 + 4); c.fill();
  }
}

const norm = (v) => { const l = Math.hypot(...v) || 1; return [v[0] / l, v[1] / l, v[2] / l]; };
export { PLAYER, AMMO };
