// FPI interpreter: runs FPS Creator ".fpi" state-machine scripts as Nord scripts (docs/FPS_CREATOR.md §Importing FPS Creator scripts).
// A script line is `:conditions:actions`; every update the lines run top to bottom, a line fires when ALL its conditions hold.
// `state=N` as a condition tests the current state, as an action it changes it (later lines see the new state in the same update).
// Distances in .fpi files are FPS Creator units; 1 unit = UNIT metres.
import { canSee } from './ai.js';
import { inZone } from './behaviours/_util.js';

export const UNIT = 0.025;
const HUD_TEXT = { pressentertouse: 'Press E to use', lockeddoor: 'Locked - you need a key', pickedupammo: 'Picked up ammo', pickedupakey: 'Picked up a key', pickedupahealth: 'Picked up health', pickedupaweapon: 'Picked up a weapon' };
const hudText = (img) => { const b = String(img ?? '').split(/[\\/]/).pop().replace(/\.\w+$/, '').toLowerCase(); return HUD_TEXT[b] ?? b.replace(/([a-z])(?=[A-Z])/g, '$1 ').replace(/_/g, ' '); };
const soundName = (v, p) => { const m = /^\$(\d)$/.exec(v); const raw = m ? p[`s${m[1]}`] : v; return String(raw ?? '').split(/[\\/]/).pop().replace(/\.\w+$/, '').toLowerCase(); };

/** Parse .fpi source → { desc, lines: [{ conds:[[key,value]], acts:[[key,value]], src }] }. Never throws. */
export function parseFpi(src) {
  const out = { desc: '', lines: [] };
  const pair = (t) => { const i = t.indexOf('='); return i < 0 ? [t.trim().toLowerCase(), ''] : [t.slice(0, i).trim().toLowerCase(), t.slice(i + 1).trim()]; };
  const toks = (s) => s.split(',').map((t) => t.trim()).filter(Boolean).map(pair);
  for (const raw of String(src).split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith(';')) continue;
    if (!line.startsWith(':')) { const [k, v] = pair(line); if (k === 'desc') out.desc = v; continue; }
    const parts = line.slice(1).split(':');
    let conds, acts;
    if (parts.length >= 2) { conds = toks(parts[0]); acts = toks(parts.slice(1).join(':')); }
    else { const t = toks(parts[0]); conds = t.slice(0, 1); acts = t.slice(1); } // ":state=4,state=0" = condition, then actions
    out.lines.push({ conds, acts, src: line });
  }
  return out;
}

const num = (v, d = 0) => { const n = parseFloat(v); return Number.isFinite(n) ? n : d; };
const near = (c, ent, r) => Math.hypot(c.player.x - ent.x, c.player.z - ent.z) <= r * UNIT && Math.abs(c.player.y - ent.y) < 4;
const give = (c, s) => { const p = c.p; if (p.give) c.game.give(p.give, num(p.amount, 25)); if (p.message) c.say(p.message, 2); s.taken = true; c.self.setModelVisible(false); c.self.emit('touched'); };
const target = (c, on) => { const g = c.game, t = c.self.target; if (!t) return; for (const d of g.doorsNamed(t)) g.setDoor(d, on, { force: true }); for (const e of g.find(t)) {
    const fpi = e.scripts?.some((x) => x.mod?.program); // an imported script on the target reacts to the activation itself (e.g. fpi-light1: activated=1 -> off)
    if (e.light && !fpi) g.setLight(e, 'toggle'); // a plain Nord light: every press flips it
    e.emit(on ? 'open' : 'close');
  }
};
const anyEnemy = (c, ent, r) => c.game.ents.some((e) => e.enemy && e.alive && Math.hypot(e.x - ent.x, e.z - ent.z) <= r * UNIT);

/** Conditions: (ctx, value) → boolean. ctx = { c, s, e, dt }. */
const CONDS = {
  state: ({ s }, v) => s.state === num(v),
  plrdistwithin: ({ c, e }, v) => near(c, e, num(v)),
  plrdistfurther: ({ c, e }, v) => !near(c, e, num(v)),
  plrhigher: ({ c, e }, v) => c.player.y - e.y > num(v) * UNIT,
  plrusingaction: ({ c, s }, v) => (c.game.time - s.useT < 0.2) === (num(v, 1) !== 0),
  plrwithinzone: ({ c, e }, v) => inZone(e, c.player) === (num(v, 1) !== 0),
  anywithinzone: ({ c, e }, v) => (inZone(e, c.player) || c.game.ents.some((x) => x.enemy && x.alive && inZone(e, x))) === (num(v, 1) !== 0),
  anywithin: ({ c, e }, v) => near(c, e, num(v, 75)) || anyEnemy(c, e, num(v, 75)),
  anyfurther: ({ c, e }, v) => !near(c, e, num(v, 75)) && !anyEnemy(c, e, num(v, 75)),
  activated: ({ s }, v) => s.activated === num(v, 1),
  varequal: ({ s }, v) => s.v === num(v), varnotequal: ({ s }, v) => s.v !== num(v), varless: ({ s }, v) => s.v < num(v), vargreater: ({ s }, v) => s.v > num(v),
  timergreater: ({ c, s }, v) => (c.game.time - s.timer) * 1000 > num(v),
  random: ({ }, v) => Math.random() * Math.max(1, num(v, 1)) < 1,
  frameatend: ({ s }) => s.frame >= 1, frameatstart: ({ s }) => s.frame <= 0,
  cantake: ({ s }) => !s.taken,
  plrhaskey: ({ c }, v) => (c.player.keys.size > 0) === (num(v, 1) !== 0),
  plrcanbeseen: ({ c, e }) => canSee(c.game, e, c.player, 40, 360),
  alphafadeequal: ({ s }, v) => Math.round(s.alpha) === num(v),
  playerassociated: ({ s }) => s.assoc,
  scancodekeypressed: ({ }, v) => num(v) === 0, // key codes are not mapped: "=0" (no key) is true, anything else never
  raycastup: ({ s, e }, v) => { const h = num(String(v).split(/\s+/)[1]) * UNIT; return s.dir >= 0 ? e.y - s.y0 >= h - 0.05 : e.y - s.y0 <= h + 0.05; },
};

/** Actions: (ctx, value) → void. */
const ACTS = {
  state: ({ s }, v) => { s.state = num(v); },
  sound: ({ c, e }, v) => c.sound(soundName(v, c.p)), plrsound: ({ c }, v) => c.sound(soundName(v, c.p)), loopsound: ({ c }, v) => { c.sound(soundName(v, c.p)); },
  hudimagefine: ({ s }, v) => { s.hudImg = v; }, hudname: ({ s }, v) => { s.hudName = v; if (s.hudImg) s.huds[v] = hudText(s.hudImg); },
  hudshow: ({ c, s }, v) => { const t = s.huds[v]; if (t && c.game.time - s.lastHud > 0.5) { s.lastHud = c.game.time; c.say(t, 1.2); } },
  activate: ({ c, s }, v) => { if (v === '') target(c, true); else s.activated = num(v); },
  activateifused: ({ c }, v) => target(c, num(v, 1) !== 0),
  activateallinzone: ({ c }, v) => target(c, num(v, 1) !== 0),
  playertake: (x) => give(x.c, x.s),
  plraddhealth: ({ c }, v) => c.player.heal(num(v)), addhealth: ({ e }, v) => e.heal(num(v)),
  plrsubhealth: ({ c, e }, v) => c.player.hurt(num(v), e, 'script'), subhealth: ({ e }, v) => e.hurt(num(v), null, 'script'), sethealth: ({ e }, v) => { e.hp = num(v); },
  plrmoveto: ({ c }, v) => { const t = c.game.find(v)[0]; if (t) c.player.teleport(t.x, t.z, t.layer, t.rot); },
  plrmoveifused: ({ c }) => { const t = c.targets()[0]; if (t) c.player.teleport(t.x, t.z, t.layer, t.rot); },
  lighton: ({ c, e }) => c.game.setLight(e, 'on'), lightoff: ({ c, e }) => c.game.setLight(e, 'off'),
  moveup: ({ c, s, e, dt }, v) => { const d = num(v) * UNIT * 60 * dt; s.dir = Math.sign(d) || s.dir; e.y += d; e.syncModel(); if (s.assoc) c.player.y += d; },
  associateplayer: ({ s }) => { s.assoc = true; }, unassociateplayer: ({ s }) => { s.assoc = false; },
  timerstart: ({ c, s }) => { s.timer = c.game.time; },
  setvar: ({ s }, v) => { const [a, b] = v.split(/\s+/); if (b === undefined) s.v = num(a); else s.vars[a] = num(b); },
  incvar: ({ s }, v) => { s.v += num(v, 1); }, decvar: ({ s }, v) => { s.v -= num(v, 1); }, dimvar: ({ s }, v) => { s.vars[v] ??= 0; },
  setframe: ({ s }, v) => { s.frame = Math.max(0, Math.min(1, num(v))); },
  incframe: ({ s, c, dt }) => { s.frame = Math.min(1, s.frame + dt / c.p.anim); },
  decframe: ({ s, c, dt }) => { s.frame = Math.max(0, s.frame - dt / c.p.anim); },
  setalphafade: ({ s }, v) => { s.alpha = num(v); }, incalphafade: ({ s, dt }, v) => { s.alpha = Math.min(100, s.alpha + num(v, 1) * dt * 60); },
  spinrate: ({ s }, v) => { s.spin = num(v); }, floatrate: ({ s }, v) => { s.float = num(v); },
  destroy: ({ e }) => e.destroy(), spawnon: ({ e }) => e.setModelVisible(true), spawnoff: ({ e }) => e.setModelVisible(false),
};
// Parsed and accepted, but nothing to do in Nord (visual/engine-only features); they are counted in the report, not warned about at runtime.
export const IGNORED = new Set(['hudreset', 'hudx', 'hudy', 'hudmake', 'hudhide', 'hudfadeout', 'coloff', 'colon', 'animate', 'alttexture', 'rundecal', 'decalphafade', 'runfpidefault', 'lightintensity', 'stopsound', 'music', 'musicoverride', 'nogravity', 'newjumpheight', 'headshot', 'floorlogic', 'norotate', 'playerdrop', 'video', 'globalvar', 'localvar']);

/** Which keys of a parsed script this interpreter cannot honour (for the importer report). */
export function unsupported(prog) {
  const bad = new Set();
  for (const l of prog.lines) {
    for (const [k] of l.conds) if (!(k in CONDS)) bad.add(k);
    for (const [k] of l.acts) if (!(k in ACTS) && !IGNORED.has(k)) bad.add(k);
  }
  return [...bad].sort();
}

// Which parameters a script needs (the Inspector only shows those): sounds when `$n` appears, pickup fields with `playertake`, frames with *frame.
const USES = {
  anim: (t) => /frame/.test(t), s0: (t) => t.includes('$0'), s1: (t) => t.includes('$1'), s2: (t) => t.includes('$2'), s3: (t) => t.includes('$3'),
  give: (t) => /playertake/.test(t), amount: (t) => /playertake/.test(t), message: (t) => /playertake/.test(t),
};

/** Turn `{ id, title, desc, fpi: "<source>" }` (the shape the importer writes) into a normal Nord script. */
export function makeFpiScript(def) {
  const prog = parseFpi(def.fpi);
  return {
    ...def, cat: def.cat ?? 'FPI', desc: def.desc || prog.desc || 'Imported FPS Creator script', fpi: def.fpi, program: prog,
    params: Object.fromEntries(Object.entries({
      anim: { type: 'number', label: 'Animation time (s)', default: 1, min: 0.1, max: 20, hint: 'FPS Creator model animations are not imported; frame counters run over this time' },
      s0: { type: 'string', label: 'Sound $0', default: '', hint: 'sound name for $0 (e.g. pickup, door)' }, s1: { type: 'string', label: 'Sound $1', default: '' },
      s2: { type: 'string', label: 'Sound $2', default: '' }, s3: { type: 'string', label: 'Sound $3', default: '' },
      give: { type: 'string', label: 'Pickup gives', default: '', hint: 'health, armor, ammo_bullets, weapon_shotgun, key_red … used by "playertake"' },
      amount: { type: 'number', label: 'Pickup amount', default: 25 }, message: { type: 'string', label: 'Pickup message', default: '' },
      ...(def.params ?? {}),
    }).filter(([k]) => !(k in USES) || USES[k](def.fpi))),
    start(c) {
      const s = c.s, e = c.self;
      Object.assign(s, { state: 0, v: 0, vars: {}, huds: {}, frame: 0, timer: c.game.time, activated: 0, assoc: false, taken: false, useT: -9, alpha: 100, dir: 0, y0: e.y, lastHud: -9, t: Math.random() * 6, spin: 0, float: 0, bad: new Set() });
      if (prog.lines.some((l) => l.conds.some(([k]) => k === 'plrusingaction'))) { e.props.usable = true; e.def = { ...e.def, usable: true }; }
    },
    use(c) { c.s.useT = c.game.time; },
    event(c, name) { if (name === 'open' || name === 'activate') c.s.activated = 1; else if (name === 'close') c.s.activated = 0; },
    update(c, dt) {
      const s = c.s, e = c.self, ctx = { c, s, e, dt };
      for (const l of prog.lines) {
        let ok = true;
        for (const [k, v] of l.conds) { const f = CONDS[k]; if (!f) { ok = false; break; } if (!f(ctx, v)) { ok = false; break; } }
        if (!ok) continue;
        for (const [k, v] of l.acts) { const f = ACTS[k]; if (f) f(ctx, v); }
      }
      if (e.model && !s.taken && (s.spin || s.float)) { s.t += dt; if (s.spin) e.model.inner.rotation.y = s.t * s.spin * 0.6; if (s.float) e.model.inner.position.y = 0.18 + Math.sin(s.t * s.float * 0.3) * 0.07; }
    },
  };
}
