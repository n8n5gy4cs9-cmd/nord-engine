// First-person player: input, movement/collision (World.moveCircle + floorAt), weapons/ammo, view model. Used by the runtime and the editor's play-test.
import { STORY } from './level.js';
import { WEAPONS, AMMO, weaponDef } from './weapons.js';
import { Model } from './models.js';

const D2R = Math.PI / 180;
export const PLAYER = { radius: 0.34, height: 1.78, crouchHeight: 1.05, eye: 1.62, crouchEye: 0.95, walk: 4.6, sprint: 7.4, crouch: 2.3, jump: 7.6, gravity: 24, step: 0.46 };

/** Keyboard + mouse (+ pointer lock). Keys by KeyboardEvent.code, so layouts do not matter. */
export class Controls {
  constructor(canvas) {
    this.canvas = canvas; this.keys = new Set(); this.pressedQ = new Set(); this.mx = 0; this.my = 0; this.buttons = 0; this.wheel = 0; this.locked = false; this.enabled = true; this.sens = 0.0022;
    this.onLockChange = null; this.dragLook = false;
    const kd = (e) => { if (!this.enabled) return; if (!e.repeat) this.pressedQ.add(e.code); this.keys.add(e.code); if (['Space', 'ArrowUp', 'ArrowDown', 'Tab'].includes(e.code)) e.preventDefault(); };
    const ku = (e) => { this.keys.delete(e.code); };
    const mm = (e) => { if (typeof e.buttons === 'number') this.buttons = (e.buttons & 1) | ((e.buttons & 2) << 1) | ((e.buttons & 4) >> 1); /* self-heal a lost mouseup (pointer-lock hand-over in webviews) */ if (this.locked || (this.dragLook && (this.buttons & 6))) { this.mx += e.movementX || 0; this.my += e.movementY || 0; } };
    const md = (e) => { this.buttons |= 1 << e.button; if (!this.locked && this.enabled && !this.noLock) this.lock(); };
    const mu = (e) => { this.buttons &= ~(1 << e.button); };
    const wh = (e) => { if (this.enabled) this.wheel += Math.sign(e.deltaY); };
    const pl = () => { this.buttons = 0; this.locked = document.pointerLockElement === canvas; this.onLockChange?.(this.locked); };
    const cm = (e) => e.preventDefault();
    const blur = () => { this.keys.clear(); this.buttons = 0; };
    window.addEventListener('keydown', kd); window.addEventListener('keyup', ku); window.addEventListener('mousemove', mm); canvas.addEventListener('mousedown', md); window.addEventListener('mouseup', mu);
    canvas.addEventListener('wheel', wh, { passive: true }); document.addEventListener('pointerlockchange', pl); canvas.addEventListener('contextmenu', cm); window.addEventListener('blur', blur);
    this.off = () => { window.removeEventListener('keydown', kd); window.removeEventListener('keyup', ku); window.removeEventListener('mousemove', mm); canvas.removeEventListener('mousedown', md); window.removeEventListener('mouseup', mu); canvas.removeEventListener('wheel', wh); document.removeEventListener('pointerlockchange', pl); canvas.removeEventListener('contextmenu', cm); window.removeEventListener('blur', blur); };
  }
  /** Capture the mouse. Where pointer lock does not exist or is refused (some embedded webviews) fall back to "hold the RIGHT mouse button to look". */
  lock() {
    if (this.locked) return;
    const fallback = () => { if (!this.locked && !this.dragLook) { this.dragLook = true; this.onFallback?.(); } };
    try { if (!this.canvas.requestPointerLock) return fallback(); const p = this.canvas.requestPointerLock(); p?.catch?.(fallback); setTimeout(() => { if (!this.locked && this.enabled) fallback(); }, 600); } catch { fallback(); }
  }
  unlock() { try { document.exitPointerLock?.(); } catch { /* ignore */ } }
  down(...codes) { return codes.some((c) => this.keys.has(c)); }
  pressed(...codes) { return codes.some((c) => this.pressedQ.has(c)); }
  take() { const d = [this.mx, this.my]; this.mx = this.my = 0; return d; }
  endFrame() { this.pressedQ.clear(); this.wheel = 0; }
  get fire() { return !!(this.buttons & 1) || this.keys.has('KeyF') && false; }
}

export class Player {
  constructor(game) {
    this.game = game; this.world = game.world;
    Object.assign(this, { x: 0, y: 0, z: 0, layer: 0, yaw: 0, pitch: 0, vx: 0, vy: 0, vz: 0, onGround: true, crouching: false, eye: PLAYER.eye, height: PLAYER.height, radius: PLAYER.radius, bobT: 0, stepT: 0 });
    this.maxHp = 100; this.hp = 100; this.armor = 0; this.alive = true; this.keys = new Set(); this.flashlight = false;
    this.owned = new Set(); this.ammo = { bullets: 0, shells: 0, rockets: 0, cells: 0 }; this.mags = {}; this.cur = null; this.last = null;
    this.cool = 0; this.reload = 0; this.swap = 0; this.score = 0; this.kills = 0; this.time = 0; this.kick = 0; this.shots = 0; this.hits = 0; this.fell = 0; this.god = false; this.speedMul = 1;
    this.noclip = false;
  }
  get pos() { return [this.x, this.y, this.z]; }
  get eyePos() { return [this.x, this.y + this.eye, this.z]; }
  get mid() { return [this.x, this.y + this.height * 0.5, this.z]; }
  get dir() { return [Math.sin(this.yaw) * Math.cos(this.pitch), -Math.sin(this.pitch), Math.cos(this.yaw) * Math.cos(this.pitch)]; }
  get weapon() { return this.cur ? weaponDef(this.cur, this.game.bank) : null; }

  /** Place the player (spawn / checkpoint / teleport). rotDeg = yaw in degrees. */
  teleport(x, z, layer = this.layer, rotDeg = null) {
    this.x = x; this.z = z; this.layer = layer;
    const f = this.world.floorAt(x, z, layer * STORY + STORY - 0.05); this.y = f ? f.y : layer * STORY; this.vx = this.vz = this.vy = 0; this.onGround = true;
    if (rotDeg !== null) { this.yaw = rotDeg * D2R; this.pitch = 0; }
  }

  give(item, n) {
    const g = this.game;
    if (item === 'health') { if (this.hp >= this.maxHp) return false; this.hp = Math.min(this.maxHp, this.hp + n); return true; }
    if (item === 'armor') { if (this.armor >= 100) return false; this.armor = Math.min(100, this.armor + n); return true; }
    if (item === 'score') { this.score += n; return true; }
    if (item.startsWith('ammo_')) { const k = item.slice(5); if (!(k in this.ammo)) return false; if (this.ammo[k] >= AMMO[k].max) return false; this.ammo[k] = Math.min(AMMO[k].max, this.ammo[k] + n); return true; }
    if (item.startsWith('key_')) { const c = item.slice(4); if (this.keys.has(c)) return false; this.keys.add(c); return true; }
    if (item.startsWith('weapon_')) {
      const id = item.slice(7), w = weaponDef(id, g.bank); if (!w) return false;
      const had = this.owned.has(id); this.owned.add(id);
      if (w.ammo) { const add = n || (w.mag || 10); if (w.mag && !(id in this.mags)) { this.mags[id] = Math.min(w.mag, add); this.ammo[w.ammo] = Math.min(AMMO[w.ammo].max, this.ammo[w.ammo] + Math.max(0, add - this.mags[id])); } else this.ammo[w.ammo] = Math.min(AMMO[w.ammo].max, this.ammo[w.ammo] + add); }
      if (!had) { this.last = this.cur; this.select(id); return true; }
      return !!w.ammo;
    }
    return false;
  }
  select(id) { if (!this.owned.has(id) || id === this.cur) return; this.last = this.cur; this.cur = id; this.swap = 0.28; this.reload = 0; this.game.viewmodel?.set(this.cur); }
  cycle(dir) {
    const list = this.weaponList(); if (list.length < 2) return; let i = list.findIndex((w) => w.id === this.cur);
    this.select(list[(i + dir + list.length) % list.length].id);
  }
  weaponList() { return [...this.owned].map((id) => weaponDef(id, this.game.bank)).filter(Boolean).sort((a, b) => a.slot - b.slot); }
  /** Rounds currently available to fire. */
  magOf(w) { return !w.ammo ? Infinity : w.mag ? this.mags[w.id] ?? 0 : this.ammo[w.ammo]; }
  reserveOf(w) { return !w.ammo ? 0 : this.ammo[w.ammo]; }

  hurt(amount, src = null) {
    if (!this.alive || this.god || amount <= 0) return;
    let a = amount;
    if (this.armor > 0) { const ab = Math.min(this.armor, a * 0.5); this.armor -= ab; a -= ab * 0.9; }
    this.hp -= a; this.game.hud.hurt(); this.game.sound('hurt', null); this.game.fx.shake = Math.max(this.game.fx.shake, Math.min(0.6, amount / 60));
    this.game.bus.emit('player.hurt', { amount, src });
    if (this.hp <= 0) { this.hp = 0; this.alive = false; this.game.onPlayerDied(src); }
  }
  heal(n) { this.hp = Math.min(this.maxHp, this.hp + n); }

  /** Mouse look (once per frame). */
  look(ctl) { if (!this.alive) return; const [mx, my] = ctl.take(); this.yaw += mx * ctl.sens; this.pitch = Math.max(-1.5, Math.min(1.5, this.pitch + my * ctl.sens)); }

  update(dt, ctl) {
    const w = this.world;
    if (!this.alive) return;
    this.time += dt;
    // crouch
    const want = ctl.down('KeyC', 'ControlLeft') && !this.noclip;
    const stand = this.height >= PLAYER.height - 0.01;
    if (want && !this.crouching) { this.crouching = true; }
    else if (!want && this.crouching && w.ceilingAt(this.x, this.z, this.y) > this.y + PLAYER.height + 0.05) this.crouching = false;
    const th = this.crouching ? PLAYER.crouchHeight : PLAYER.height, te = this.crouching ? PLAYER.crouchEye : PLAYER.eye;
    this.height += (th - this.height) * Math.min(1, dt * 12); this.eye += (te - this.eye) * Math.min(1, dt * 12); void stand;
    // wish direction
    const f = (ctl.down('KeyW', 'ArrowUp') ? 1 : 0) - (ctl.down('KeyS', 'ArrowDown') ? 1 : 0), s = (ctl.down('KeyD', 'ArrowRight') ? 1 : 0) - (ctl.down('KeyA', 'ArrowLeft') ? 1 : 0);
    const sn = Math.sin(this.yaw), cs = Math.cos(this.yaw);
    let wx = sn * f + cs * s, wz = cs * f - sn * s; const wl = Math.hypot(wx, wz); if (wl > 1) { wx /= wl; wz /= wl; }
    const sprint = ctl.down('ShiftLeft', 'ShiftRight') && f > 0 && !this.crouching;
    const speed = (this.crouching ? PLAYER.crouch : sprint ? PLAYER.sprint : PLAYER.walk) * this.speedMul;
    const acc = this.onGround ? 14 : 3.5;
    this.vx += (wx * speed - this.vx) * Math.min(1, acc * dt); this.vz += (wz * speed - this.vz) * Math.min(1, acc * dt);
    // jump / gravity
    if (this.noclip) { this.vy = ((ctl.down('Space') ? 1 : 0) - (ctl.down('KeyC') ? 1 : 0)) * 8; this.y += this.vy * dt; this.x += this.vx * dt; this.z += this.vz * dt; return; }
    if (ctl.down('Space') && this.onGround && !this.crouching) { this.vy = PLAYER.jump; this.onGround = false; this.game.sound('jump', null); }
    if (!this.onGround) this.vy -= PLAYER.gravity * dt;
    // horizontal move with collision
    const hh = this.height;
    const m = w.moveCircle(this.x, this.z, this.y, hh, this.radius, this.vx * dt, this.vz * dt);
    this.x = m.x; this.z = m.z;
    if (m.hit) { const mv = Math.hypot(m.x - (this.x - this.vx * dt), m.z - (this.z - this.vz * dt)); void mv; }
    // vertical: floor / ceiling
    this.y += this.vy * dt;
    const fl = w.floorAt(this.x, this.z, this.y + PLAYER.step);
    if (fl && this.vy <= 0 && this.y <= fl.y + 0.001) {
      if (!this.onGround && this.vy < -9) { this.game.sound('land', null); if (this.vy < -15) this.hurt((-this.vy - 15) * 5, null); this.fell = this.vy; }
      this.y = fl.y; this.vy = 0; this.onGround = true; this.layer = fl.layer;
    } else if (fl && this.onGround && this.vy <= 0 && this.y - fl.y < 0.55) { this.y = fl.y; this.layer = fl.layer; }  // walk down steps without hopping
    else if (this.onGround || this.vy !== 0) { this.onGround = false; }
    if (!fl && this.onGround) this.onGround = false;
    const ce = w.ceilingAt(this.x, this.z, this.y + 0.3);
    if (this.y + hh > ce) { this.y = ce - hh; if (this.vy > 0) this.vy = 0; }
    if (this.y < -25) { this.hurt(9999, null); this.game.fellOut = true; }
    // footsteps + bob
    const sp = Math.hypot(this.vx, this.vz);
    if (this.onGround && sp > 0.5) { this.bobT += dt * sp * 1.5; this.stepT -= dt * sp; if (this.stepT <= 0) { this.stepT = 3.2; this.game.sound('step', null, { volume: 0.7 }); } }
    this.speed = sp;
  }
}

/** First-person weapon: built from the weapon's `view` parts, parented to the camera, with bob/recoil/swap animation. */
export class ViewModel {
  constructor(game) { this.game = game; this.models = new Map(); this.cur = null; this.kick = 0; this.t = 0; this.flashT = 0; this.muzzle = null; }
  set(id) {
    if (this.cur) this.cur.root.setEnabled(false);
    const w = weaponDef(id, this.game.bank); if (!w) { this.cur = null; return; }
    let m = this.models.get(id);
    if (!m) {
      const g = this.game, B = g.B, h = w.view.hand ?? (w.type === 'melee' ? [0, -0.02, -0.02] : [0, -0.1, 0.03]);
      const hands = w.view.hands === false ? [] : [{ shape: 'box', s: [0.075, 0.09, 0.11], p: h, c: '#d6a77f' }, { shape: 'box', s: [0.1, 0.1, 0.5], p: [h[0] + 0.02, h[1] - 0.07, h[2] - 0.3], r: [0.3, 0, 0], c: '#4a5a3c' }];
      const spec = { kind: 'parts', parts: [...w.view.parts, ...hands, { shape: 'box', s: [0.1, 0.1, 0.05], p: [0, 0.01, (w.view.muzzle ?? 0.85)], c: '#fff2a0', e: true, a: 0.9 }] };
      m = new Model(B, g.scene, spec, { name: `vm-${id}` }); m.root.parent = g.camera; m.root.position.set(...w.view.pos);
      for (const me of m.meshes) { me.renderingGroupId = 1; me.isPickable = false; }
      m.muzzle = m.meshes[m.meshes.length - 1]; m.muzzle.setEnabled(false);
      this.models.set(id, m);
    }
    this.cur = m; m.root.setEnabled(true);
  }
  fire() { this.kick = 1; this.flashT = 0.05; if (this.cur?.muzzle) this.cur.muzzle.setEnabled(true); }
  update(dt, p) {
    const m = this.cur; if (!m) return;
    const w = p.weapon; if (!w) return;
    this.t += dt; this.kick = Math.max(0, this.kick - dt * 8);
    if (this.flashT > 0 && (this.flashT -= dt) <= 0) m.muzzle?.setEnabled(false);
    const bob = p.onGround ? Math.min(1, p.speed / 5) : 0, bt = p.bobT;
    const swap = Math.max(0, p.swap) / 0.28, rel = p.reload > 0 ? Math.sin(Math.min(1, 1 - p.reload / (w.reload || 1)) * Math.PI) : 0;
    const [bx, by, bz] = w.view.pos;
    m.root.position.set(bx + Math.sin(bt * 0.5) * 0.012 * bob, by + Math.abs(Math.cos(bt * 0.5)) * 0.01 * bob - swap * 0.4 - rel * 0.25 + Math.sin(this.t * 1.6) * 0.002, bz - this.kick * (w.recoil ?? 0.05) * 2.2);
    m.root.rotation.set(-this.kick * (w.recoil ?? 0.05) * 3 + rel * 0.7, -0.03 * bob * Math.sin(bt * 0.5), 0);
    if (w.type === 'melee' && this.kick > 0) m.root.rotation.set(-this.kick * 0.9, -this.kick * 0.5, this.kick * 0.5);
  }
  dispose() { for (const m of this.models.values()) m.dispose(); this.models.clear(); }
}
