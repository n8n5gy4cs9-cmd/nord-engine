// No-code "rules": WHEN something happens on an entity, DO an action on a target. Used by the editor (Rules section) and the runtime.
// rule = { when, event?, every?, do, target?, text?, value?, delay?, once? }     target = entity name, "#tag" for a group, a door name, "self" or "player".
export const WHENS = [
  { id: 'start', label: 'Level starts' },
  { id: 'used', label: 'Player uses it (E)' },
  { id: 'died', label: 'It is killed / destroyed' },
  { id: 'hurt', label: 'It takes damage' },
  { id: 'enter', label: 'Player enters its zone' },
  { id: 'exit', label: 'Player leaves its zone' },
  { id: 'touched', label: 'Player touches / picks it up' },
  { id: 'alert', label: 'Enemy notices the player' },
  { id: 'timer', label: 'Every N seconds', fields: ['every'] },
  { id: 'event', label: 'When event … is emitted', fields: ['event'] },
];

export const ACTIONS = [
  { id: 'open', label: 'Open door / thing', fields: ['target'], hint: 'Door name (set on the door piece) or an entity name' },
  { id: 'close', label: 'Close door', fields: ['target'] },
  { id: 'toggle', label: 'Toggle door / light', fields: ['target'] },
  { id: 'unlock', label: 'Unlock door', fields: ['target'] },
  { id: 'lock', label: 'Lock door (key colour)', fields: ['target', 'text'], hint: 'text = red | blue | yellow | green' },
  { id: 'message', label: 'Show message', fields: ['text', 'value'], hint: 'value = seconds' },
  { id: 'objective', label: 'Set objective', fields: ['text'] },
  { id: 'sound', label: 'Play sound', fields: ['text'], hint: 'e.g. alarm, door, pickup, explosion' },
  { id: 'emit', label: 'Emit event', fields: ['text'], hint: 'Other rules/scripts can listen for it' },
  { id: 'spawn', label: 'Spawn entity', fields: ['text', 'value', 'target'], hint: 'text = entity type (enemy_soldier), value = count, target = where (default: here)' },
  { id: 'show', label: 'Show entity', fields: ['target'] },
  { id: 'hide', label: 'Hide entity', fields: ['target'] },
  { id: 'enable', label: 'Enable entity (scripts on)', fields: ['target'] },
  { id: 'disable', label: 'Disable entity (scripts off)', fields: ['target'] },
  { id: 'destroy', label: 'Remove entity', fields: ['target'] },
  { id: 'kill', label: 'Kill entity', fields: ['target'] },
  { id: 'damage', label: 'Damage (target or player)', fields: ['target', 'value'] },
  { id: 'heal', label: 'Heal player', fields: ['value'] },
  { id: 'give', label: 'Give player item', fields: ['text', 'value'], hint: 'health, armor, score, ammo_bullets|shells|rockets|cells, weapon_shotgun…, key_red…' },
  { id: 'teleport', label: 'Teleport player to entity', fields: ['target'] },
  { id: 'checkpoint', label: 'Save checkpoint here', fields: [] },
  { id: 'light', label: 'Light on / off / toggle', fields: ['target', 'text'], hint: 'text = on | off | toggle' },
  { id: 'shake', label: 'Shake the camera', fields: ['value'] },
  { id: 'win', label: 'Complete the level', fields: ['text'], hint: 'text = optional next level file' },
  { id: 'lose', label: 'Game over', fields: ['text'] },
];

const ents = (g, ent, t) => (!t || t === 'self' ? [ent] : t === 'player' ? [g.player] : g.find(t));
const doors = (g, ent, t) => g.doorsNamed(t || ent.name);

export const RUN = {
  open: (g, e, r) => { for (const d of doors(g, e, r.target)) g.setDoor(d, true, { force: true }); for (const x of g.find(r.target).filter((x) => x.call)) x.emit('open'); },
  close: (g, e, r) => { for (const d of doors(g, e, r.target)) g.setDoor(d, false); },
  toggle: (g, e, r) => { for (const d of doors(g, e, r.target)) g.setDoor(d, d.target < 0.5, { force: true }); for (const x of g.find(r.target)) if (x.def.light) g.setLight(x, 'toggle'); },
  unlock: (g, e, r) => { for (const d of doors(g, e, r.target)) d.locked = null; },
  lock: (g, e, r) => { for (const d of doors(g, e, r.target)) { d.locked = r.text || 'red'; g.setDoor(d, false); } },
  message: (g, e, r) => g.say(r.text || '', +r.value || 3),
  objective: (g, e, r) => g.objective(r.text || ''),
  sound: (g, e, r) => g.sound(r.text || 'beep', e),
  emit: (g, e, r) => g.bus.emit(r.text || 'event', { from: e }),
  spawn: (g, e, r) => { const at = r.target ? g.find(r.target)[0] ?? e : e; for (let i = 0; i < (+r.value || 1); i++) g.spawn(r.text, at.x + (i ? (Math.random() - 0.5) * 2 : 0), at.z + (i ? (Math.random() - 0.5) * 2 : 0), at.layer, {}); },
  show: (g, e, r) => { for (const x of ents(g, e, r.target)) x.setModelVisible?.(true); },
  hide: (g, e, r) => { for (const x of ents(g, e, r.target)) x.setModelVisible?.(false); },
  enable: (g, e, r) => { for (const x of ents(g, e, r.target)) { x.enabled = true; x.setModelVisible?.(true); } },
  disable: (g, e, r) => { for (const x of ents(g, e, r.target)) { x.enabled = false; } },
  destroy: (g, e, r) => { for (const x of ents(g, e, r.target)) x.destroy?.(); },
  kill: (g, e, r) => { for (const x of ents(g, e, r.target)) x === g.player ? g.player.hurt(9999, e) : x.die?.(e); },
  damage: (g, e, r) => { for (const x of ents(g, e, r.target || 'player')) x.hurt?.(+r.value || 10, e, 'script'); },
  heal: (g, e, r) => g.player.heal(+r.value || 25),
  give: (g, e, r) => g.give(r.text || 'health', +r.value || 0),
  teleport: (g, e, r) => { const t = g.find(r.target)[0]; if (t) g.player.teleport(t.x, t.z, t.layer, t.rot); },
  checkpoint: (g, e) => g.saveCheckpoint(e),
  light: (g, e, r) => { for (const x of ents(g, e, r.target)) g.setLight(x, r.text || 'toggle'); },
  shake: (g, e, r) => { g.fx.shake = Math.max(g.fx.shake, +r.value || 0.5); },
  win: (g, e, r) => g.win(r.text),
  lose: (g, e, r) => g.lose(r.text),
};

/** Wire an entity's rules to the bus. `startQueue` receives rules to fire after the level has been fully spawned. */
export function installRules(g, ent) {
  for (const r of ent.rules ?? []) {
    if (!RUN[r.do]) { g.warn(`rule on "${ent.name || ent.type}": unknown action "${r.do}"`); continue; }
    let used = false;
    const fire = (data) => {
      if (r.once && used) return; used = true;
      const run = () => { if (!ent.destroyed || r.when === 'died') { try { RUN[r.do](g, ent, r, data); } catch (e) { g.scriptError({ id: `rule:${r.do}`, ent }, 'rule', e); } } };
      if (+r.delay > 0) g.after(+r.delay, run); else run();
    };
    switch (r.when) {
      case 'start': g.onStart(() => fire()); break;
      case 'timer': { const every = Math.max(0.1, +r.every || 5); g.onStart(() => { g.every(every, () => { if (ent.enabled && !ent.destroyed) fire(); }); }); break; }
      case 'event': if (r.event) g.bus.on(r.event, (d) => { if (ent.enabled) fire(d); }); break;
      default: g.bus.on(`${ent.id}.${r.when}`, (d) => { if (ent.enabled || r.when === 'died') fire(d); });
    }
  }
}
