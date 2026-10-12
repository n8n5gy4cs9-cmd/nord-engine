// @nord {"id":"noom.game","title":"Noom — game glue","category":"games","tier":["3d"],"tags":["fps","doom","dungeon"],"description":"Noom (Doom x Barony) first-person shooter proof of concept: input, 35 Hz sim loop, Babylon renderer, canvas HUD, sound. Rules live in noom/sim.js (ported from id Software's DOOM source, GPL-2.0)."}
// Noom — one level, Doom-style: ported monster AI/damage from DOOM (linuxdoom-1.10), Barony-flavoured dungeon, original redrawn art (tools/art/noom).
// Crowelian 2026 + Sonnet.
import { NordScript } from 'nord';
import { Sim, TIC, MOBS } from './noom/sim.js';
import { Renderer, EYE } from './noom/render.js';
import { Hud } from './noom/hud.js';

const A = (p) => `assets/${p}`;
const SFX = { shoot: ['shoot', 0.8, 0.9], swing: ['swing', 0.6, 1], hit: ['hit', 0.6, 0.9], hurt: ['hurt', 0.8, 1], death: ['death', 0.6, 1.2], explosion: ['explosion', 1, 1], explosion_small: ['explosion_small', 0.6, 1], pickup: ['pickup', 0.6, 1], powerup: ['powerup', 0.7, 1],
  open: ['open', 0.7, 0.8], close: ['close', 0.5, 0.8], fireball: ['magic', 0.7, 0.8], shoot_mob: ['laser', 0.4, 1.6], hurt_mob: ['hit', 0.5, 1.4], click: ['reload', 0.6, 1], error: ['error', 0.6, 1], win: ['win', 0.8, 1], step_stone: ['step_stone', 0.3, 1.4] };

export default class Noom extends NordScript {
  start() {
    this.ready = false; this.mode = 'title'; this.acc = 0; this.clock = 0; this.yaw = 0; this.lock = 0;
    this.boot().catch((e) => this.game.reportError(e, this, 'boot'));
  }
  async boot() {
    const g = this.game, be = g.backend, B = be.B, scene = be.scene, L = g.loader;
    const img = (p) => new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error(`failed to load ${p}`)); i.src = L.url(p); });
    const names = { walls: A('textures/walls.png'), surfaces: A('textures/surfaces.png'), skeleton: A('sprites/skeleton.png'), goblin: A('sprites/goblin.png'), imp: A('sprites/imp.png'), baron: A('sprites/baron.png'), props: A('sprites/props.png'), weapons: A('sprites/weapons.png'), hud: A('ui/hud.png'), font: A('ui/font.png') };
    const imgs = {}; await Promise.all(Object.entries(names).map(async ([k, p]) => { imgs[k] = await img(p); }));
    const meta = {}; for (const k of ['skeleton', 'goblin', 'imp', 'baron', 'props', 'weapons', 'hud']) meta[k] = await L.json(`${names[k]}.meta.json`);
    this.assets = { walls: L.url(names.walls), surfaces: L.url(names.surfaces), sprites: Object.fromEntries(['skeleton', 'goblin', 'imp', 'baron', 'props'].map((k) => [k, L.url(names[k])])), meta, size: Object.fromEntries(['skeleton', 'goblin', 'imp', 'baron', 'props'].map((k) => [k, [imgs[k].width, imgs[k].height]])) };
    this.B = B; this.bscene = scene;
    // HUD canvas
    const stage = document.getElementById('stage') ?? document.body;
    const c = this.canvas = document.createElement('canvas');
    c.style.cssText = 'position:absolute;left:0;top:0;width:100%;height:100%;image-rendering:pixelated;pointer-events:none;z-index:5';
    stage.appendChild(c);
    this.hud = new Hud(c, { hud: imgs.hud, weapons: imgs.weapons, font: imgs.font, props: imgs.props }, meta);
    this.hud.resize(); this.onResize = () => this.hud.resize(); window.addEventListener('resize', this.onResize);
    this.keyDown = (e) => { if (e.code === 'Escape' && this.mode === 'play') this.mode = 'pause'; if (e.code === 'Tab') e.preventDefault(); };
    window.addEventListener('keydown', this.keyDown);
    this.camEntity = this.entity.find('Camera');
    this.newGame();
    g.audio.preload(Object.values(SFX).map(([n]) => `assets/audio/sfx/${n}.wav`));
    window.__noom = this;
    this.ready = true;
  }
  newGame() {
    this.renderer?.dispose();
    this.sim = new Sim(); const p = this.sim.player;
    this.yaw = p.a; this.renderer = new Renderer(this.B, this.bscene, this.sim, this.assets);
    this.bossAwake = false; this.deadT = 0; this.lock = 0.35;
    this.game.audio.music('assets/audio/music/music_action.mp3', { volume: 0.3 });
  }

  update(dt) {
    if (!this.ready) return;
    const sim = this.sim, p = sim.player, inp = this.input, hud = this.hud;
    this.clock += dt; this.lock -= dt; hud.tick(dt);
    // ---- mode changes
    if (this.mode === 'title' && this.lock < 0 && (inp.pressed('fire') || inp.pressed('use'))) { this.mode = 'play'; this.lock = 0.3; }
    if (this.mode === 'pause' && inp.pressed('fire')) { this.mode = 'play'; this.lock = 0.3; }
    if ((sim.state === 'dead' || sim.state === 'exit') && this.lock < 0 && (inp.pressed('restart') || inp.pressed('fire') || inp.pressed('use'))) { this.newGame(); this.mode = 'play'; }
    if (inp.pressed('restart') && this.mode === 'play') { this.newGame(); this.mode = 'play'; }
    if (inp.pressed('map')) this.automap = !this.automap;
    // ---- player input + sim
    const live = this.mode === 'play' && sim.state === 'play';
    if (live) {
      const mm = window.nordMouse?.consume?.();
      let turn = (mm ? mm.dx * 0.0026 : 0) + inp.axis('turnL', 'turnR') * 2.5 * dt;
      p.a += turn; const input = { fwd: inp.axis('back', 'fwd'), strafe: inp.axis('left', 'right'), turn: 0, run: inp.down('run'), fire: this.lock < 0 && inp.down('fire'), use: inp.pressed('use'), weapon: inp.pressed('w1') ? 1 : inp.pressed('w2') ? 2 : null };
      sim.updatePlayer(dt, input);
      this.acc += dt;
      for (let n = 0; this.acc >= TIC && n < 5; n++, this.acc -= TIC) sim.ticker();
      if (this.acc > TIC * 5) this.acc = 0;
    } else if (sim.state === 'dead') { this.acc += dt; for (let n = 0; this.acc >= TIC && n < 5; n++, this.acc -= TIC) sim.ticker(); this.deadT += dt; }
    // ---- events
    for (const e of sim.drain()) {
      if (e.t === 'msg') hud.message(e.text);
      else if (e.t === 'sfx') this.sound(e);
      else if (e.t === 'dead') { this.game.audio.stopMusic({ fade: 0.5 }); this.lock = 1.0; }
      else if (e.t === 'exit') { this.mode = 'play'; this.lock = 1.2; this.game.audio.stopMusic({ fade: 1 }); }
      else if (e.t === 'boom') this.shake = 0.35;
      else if (e.t === 'hurt') this.shake = Math.max(this.shake ?? 0, Math.min(0.4, e.dmg / 40));
    }
    const baron = sim.mobjs.find((m) => m.type === 'baron' && !m.dead);
    if (baron && !this.bossAwake && baron.st !== 'stand') { this.bossAwake = true; this.game.audio.music('assets/audio/music/music_boss.mp3', { volume: 0.4 }); }
    // ---- camera
    const yaw = p.a + Math.PI / 2, bob = Math.sin(p.bob) * 0.018 * Math.min(1, p.moving);
    this.shake = Math.max(0, (this.shake ?? 0) - dt * 1.5);
    let eye = EYE + bob; if (p.dead) eye = Math.max(0.15, EYE - this.deadT * 0.8);
    const sx = (Math.random() - 0.5) * this.shake * 0.05, sy = (Math.random() - 0.5) * this.shake * 0.05;
    this.entity.pos = [p.x + sx, eye + sy, -p.y];
    this.entity.rot = [0, (yaw * 180) / Math.PI, p.dead ? Math.min(40, this.deadT * 60) : 0];
    this.renderer.update(this.acc / TIC, this.clock);
    hud.frame(sim, { state: this.mode === 'title' ? 'title' : sim.state === 'dead' ? 'dead' : sim.state === 'exit' ? 'exit' : this.mode === 'pause' ? 'pause' : 'play', ready: true, automap: this.automap && sim.state === 'play', boss: this.bossAwake && baron ? baron : null });
  }
  sound(e) {
    const m = SFX[e.n]; if (!m) return;
    const p = this.sim.player, dx = e.x - p.x, dy = e.y - p.y, d = Math.hypot(dx, dy);
    const vol = Math.max(0, 1 - d / 22) * m[1]; if (vol < 0.02) return;
    const rel = Math.atan2(dy, dx) - p.a, pan = Math.sin(rel);
    this.game.audio.play(`assets/audio/sfx/${m[0]}.wav`, { volume: vol, rate: m[2] * (0.95 + Math.random() * 0.1), pan });
  }
  onDestroy() { window.removeEventListener('resize', this.onResize); window.removeEventListener('keydown', this.keyDown); this.canvas?.remove(); this.renderer?.dispose(); delete window.__noom; }
}
