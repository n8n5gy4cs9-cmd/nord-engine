// ACEs = Actions / Conditions / Expressions. Registry key: plugin name ("System", "Keyboard", "Mouse", "Audio", "Functions", "LocalStorage")
// or "Object" for the generic ACEs every object type (entity name or tag) shares. Addons call registerPlugin()/registerObjectAces().
//   condition: { params?: [names], raw?: [names kept as text], instance?: true, trigger?: true, loop?: true, test(r, p, c) }
//     instance:true → test(r, inst, p) is called per picked instance (Construct picking: instances that fail are un-picked)
//     otherwise    → test(r, p, c) with c = { sol, cond, ev }; may mutate c.sol via r.pick(sol, type, list)
//   action: { params?, raw?, instance?: true, run(r, p) | run(r, inst, p) }; may return { wait: seconds } or { until: Promise, pick: fn }
//   expressions: { Name(r, args) }
import { overlaps, setOpacity } from '../behaviors/util.js';

const cmp = (a, op, b) => {
  switch (op) {
    case '=': case '==': return a == b; // eslint-disable-line eqeqeq
    case '!=': return a != b; // eslint-disable-line eqeqeq
    case '<': return a < b; case '<=': return a <= b; case '>': return a > b; case '>=': return a >= b;
  }
  throw new Error(`unknown comparison '${op}'`);
};
const KEYS = { left: 'ArrowLeft', right: 'ArrowRight', up: 'ArrowUp', down: 'ArrowDown', space: 'Space', enter: 'Enter', escape: 'Escape', esc: 'Escape', shift: 'ShiftLeft', ctrl: 'ControlLeft', tab: 'Tab' };
export const keyCode = (k) => {
  const s = String(k).replace(/^"(.*)"$/, '$1');
  if (/^[a-z]$/i.test(s)) return 'Key' + s.toUpperCase();
  if (/^\d$/.test(s)) return 'Digit' + s;
  return KEYS[s.toLowerCase()] ?? s;
};
const rad = Math.PI / 180;

export const plugins = new Map();
export const objectAces = { conditions: {}, actions: {}, expressions: {} };
/** Register or extend a plugin: registerPlugin('Gamepad', { conditions:{…}, actions:{…}, expressions:{…} }) */
export function registerPlugin(name, def) {
  const p = plugins.get(name) ?? { conditions: {}, actions: {}, expressions: {} };
  for (const k of ['conditions', 'actions', 'expressions']) Object.assign(p[k], def[k] ?? {});
  plugins.set(name, p);
}
export function registerObjectAces(def) { for (const k of ['conditions', 'actions', 'expressions']) Object.assign(objectAces[k], def[k] ?? {}); }

registerPlugin('System', {
  conditions: {
    'every-tick': { test: () => true },
    'on-start-of-layout': { trigger: true, test: () => true },
    'on-end-of-layout': { trigger: true, test: () => true },
    'compare-two-values': { params: ['first', 'comparison', 'second'], raw: ['comparison'], test: (r, p) => cmp(p.first, p.comparison, p.second) },
    'compare-variable': { params: ['variable', 'comparison', 'value'], raw: ['variable', 'comparison'], test: (r, p) => cmp(r.getVar(p.variable), p.comparison, p.value) },
    'compare-boolean-variable': { params: ['variable'], raw: ['variable'], test: (r, p) => !!r.getVar(p.variable) },
    'every-x-seconds': {
      params: ['seconds'],
      test(r, p, { ev }) {
        ev._every ??= { next: r.time + p.seconds };
        if (r.time < ev._every.next) return false;
        ev._every.next += p.seconds; if (ev._every.next < r.time) ev._every.next = r.time + p.seconds;
        return true;
      },
    },
    'trigger-once-while-true': {
      test(r, p, { ev }) {
        const was = ev._onceTick === r.tickCount - 1; // reached last tick too → still "true", not a new trigger
        ev._onceTick = r.tickCount;
        return !was;
      },
    },
    else: { test: () => true }, // handled by the runner (chain state)
    'is-group-active': { params: ['group'], raw: ['group'], test: (r, p) => r.groups.get(p.group)?.active !== false },
    'for-each': { params: ['object'], raw: ['object'], loop: true, items: (r, p, sol) => r.picked(p.object, sol).map((e) => [[p.object, [e]]]) },
    repeat: { params: ['count'], loop: true, items: (r, p) => Array.from({ length: Math.max(0, Math.floor(p.count)) }, (_, i) => [[null, i]]) },
    for: { params: ['name', 'start', 'end'], raw: ['name'], loop: true, items: (r, p) => { const a = []; for (let i = p.start; i <= p.end; i++) a.push([[null, i, p.name]]); return a; } },
    while: { params: ['condition'], loop: true, items: null, whileExpr: true },
    'pick-all': { params: ['object'], raw: ['object'], test: (r, p, { sol }) => { r.pick(sol, p.object, r.all(p.object)); return true; } },
    'pick-nth-instance': { params: ['object', 'index'], raw: ['object'], test: (r, p, { sol }) => { const e = r.picked(p.object, sol)[Math.floor(p.index)]; if (!e) return false; r.pick(sol, p.object, [e]); return true; } },
    'pick-random-instance': { params: ['object'], raw: ['object'], test: (r, p, { sol }) => { const l = r.picked(p.object, sol); if (!l.length) return false; r.pick(sol, p.object, [l[Math.floor(r.game.rng.next() * l.length)]]); return true; } },
    'pick-by-comparison': {
      params: ['object', 'expression', 'comparison', 'value'], raw: ['object', 'expression', 'comparison'], lazy: ['expression'],
      test(r, p, { sol }) {
        const l = r.picked(p.object, sol).filter((e) => cmp(r.withCur(p.object, e, () => r.evalExpr(p.expression)), p.comparison, p.value));
        r.pick(sol, p.object, l); return l.length > 0;
      },
    },
    'pick-by-evaluate': {
      params: ['object', 'expression'], raw: ['object', 'expression'],
      test(r, p, { sol }) { const l = r.picked(p.object, sol).filter((e) => r.withCur(p.object, e, () => r.evalExpr(p.expression))); r.pick(sol, p.object, l); return l.length > 0; },
    },
  },
  actions: {
    'set-var': { params: ['variable', 'value'], raw: ['variable'], run: (r, p) => r.setVar(p.variable, p.value) },
    'add-to-var': { params: ['variable', 'value'], raw: ['variable'], run: (r, p) => { const v = r.getVar(p.variable); r.setVar(p.variable, typeof v === 'string' ? v + p.value : v + p.value); } },
    'subtract-from-var': { params: ['variable', 'value'], raw: ['variable'], run: (r, p) => r.setVar(p.variable, r.getVar(p.variable) - p.value) },
    'toggle-boolean-var': { params: ['variable'], raw: ['variable'], run: (r, p) => r.setVar(p.variable, !r.getVar(p.variable)) },
    'create-object': {
      params: ['object', 'layer', 'x', 'y'], raw: ['object', 'layer'],
      run(r, p) {
        const type = p.object, peers = r.containerPeers(type), names = [type, ...peers];
        const until = Promise.all(names.map((n) => r.scene.spawn(r.prefabFor(n), { pos: [p.x, p.y, 0], name: n })));
        return {
          until,
          pick: (list) => {
            list.forEach((e) => { e._peers = list.filter((o) => o !== e); });
            return list.map((e, i) => [names[i], [e]]);
          },
        };
      },
    },
    'go-to-layout': { params: ['layout'], run: (r, p) => { const path = /\.json$/.test(p.layout) ? p.layout : `scenes/${p.layout}.scene.json`; r.game.loadScene(path); } },
    'restart-layout': { run: (r) => { r.game.restart(); } },
    'set-time-scale': { params: ['scale'], run: (r, p) => { r.game.timeScale = p.scale; } },
    wait: { params: ['seconds'], run: (r, p) => ({ wait: p.seconds }) },
    'set-group-active': { params: ['group', 'state'], raw: ['group', 'state'], run: (r, p) => { const g = r.groups.get(p.group); if (g) g.active = p.state === 'toggle' ? !g.active : p.state === 'activated'; } },
    log: { params: ['message'], run: (r, p) => console.log('[events]', p.message) },
  },
  expressions: {
    dt: (r) => r.dt, time: (r) => r.time, tickcount: (r) => r.tickCount, loopindex: (r, a) => r.loopIndex(a[0]),
    timescale: (r) => r.game.timeScale, pi: () => Math.PI,
    layoutwidth: (r) => r.game.project.display?.width ?? 0, layoutheight: (r) => r.game.project.display?.height ?? 0,
    windowwidth: (r) => r.game.project.display?.width ?? 0, windowheight: (r) => r.game.project.display?.height ?? 0,
  },
});

registerPlugin('Functions', {
  actions: {
    call: { params: ['name'], raw: ['name'], rest: true, run: (r, p) => { r.callFunction(p.name, p.args); } },
    'set-return-value': { params: ['value'], run: (r, p) => { const f = r.frames.at(-1); if (f) f.ret = p.value; } },
  },
});

registerPlugin('Keyboard', {
  conditions: {
    'on-key-pressed': { params: ['key'], raw: ['key'], trigger: true, test: (r, p) => r.firing.data.down && r.firing.data.code === keyCode(p.key) },
    'on-key-released': { params: ['key'], raw: ['key'], trigger: true, test: (r, p) => !r.firing.data.down && r.firing.data.code === keyCode(p.key) },
    'key-is-down': { params: ['key'], raw: ['key'], test: (r, p) => r.game.input.key(keyCode(p.key)) },
  },
});
registerPlugin('Input', { // Nord extension: project input actions (jump, left, …)
  conditions: {
    'on-action-pressed': { params: ['action'], raw: ['action'], trigger: true, test: (r, p) => r.firing.data.action === p.action },
    'action-is-down': { params: ['action'], raw: ['action'], test: (r, p) => r.game.input.down(p.action) },
  },
  expressions: { Axis: (r, a) => r.game.input.axis(a[0], a[1]) },
});
registerPlugin('Mouse', {
  conditions: {
    'on-click': { trigger: true, test: (r) => r.firing.data.down },
    'on-release': { trigger: true, test: (r) => !r.firing.data.down },
    'button-is-down': { test: (r) => r.game.input.pointer.down },
  },
  expressions: { X: (r) => r.game.input.pointer.worldX, Y: (r) => r.game.input.pointer.worldY },
});
registerPlugin('Events', { // the game's global event bus: uiButton "event", scripts' game.events.emit, your own signals
  conditions: { 'on-event': { params: ['name'], raw: ['name'], trigger: true, test: (r, p) => r.firing.data.name === p.name } },
  actions: { emit: { params: ['name'], raw: ['name'], run: (r, p) => { r.game.events.emit(p.name, undefined); } } },
});
registerPlugin('Timeline', {
  conditions: {
    'on-finished': { params: ['timeline'], raw: ['timeline'], trigger: true, test: (r, p) => r.firing.data.timeline === p.timeline },
    'on-event': { params: ['timeline', 'name'], raw: ['timeline', 'name'], trigger: true, test: (r, p) => r.firing.data.timeline === p.timeline && r.firing.data.name === p.name },
    'is-playing': { params: ['timeline'], raw: ['timeline'], test: (r, p) => !!r.scene.timelines?.isPlaying(p.timeline) },
  },
  actions: {
    play: { params: ['timeline'], raw: ['timeline'], run: (r, p) => { r.scene.timelines?.play(p.timeline); } },
    pause: { params: ['timeline'], raw: ['timeline'], run: (r, p) => { r.scene.timelines?.pause(p.timeline); } },
    resume: { params: ['timeline'], raw: ['timeline'], run: (r, p) => { r.scene.timelines?.resume(p.timeline); } },
    stop: { params: ['timeline'], raw: ['timeline'], run: (r, p) => { r.scene.timelines?.stop(p.timeline); } },
    'set-time': { params: ['timeline', 'time'], raw: ['timeline'], run: (r, p) => { r.scene.timelines?.seek(p.timeline, p.time); } },
  },
  expressions: { Time: (r, a) => r.scene.timelines?.time(a[0]) ?? 0, Progress: (r, a) => r.scene.timelines?.progress(a[0]) ?? 0 },
});
registerPlugin('Multiplayer', { // WebRTC peer-to-peer, signalling via `nord serve` (see multiplayer.js)
  conditions: {
    'on-connected': { trigger: true, test: () => true },
    'on-peer-joined': { trigger: true, test: () => true },
    'on-peer-left': { trigger: true, test: () => true },
    'on-message': { params: ['name'], raw: ['name'], trigger: true, test: (r, p) => r.firing.data.name === p.name },
    'is-host': { test: (r) => r.game.net.isHost },
    'is-connected': { test: (r) => r.game.net.connected },
  },
  actions: {
    host: { params: ['room'], run: (r, p) => ({ until: r.game.net.host(String(p.room)) }) },
    join: { params: ['room'], run: (r, p) => ({ until: r.game.net.join(String(p.room)).catch((e) => r.game.reportError(e, { constructor: { name: 'Multiplayer' } }, 'join')) }) },
    send: { params: ['name', 'value'], run: (r, p) => { r.game.net.send(String(p.name), p.value); } },
    leave: { run: (r) => ({ until: r.game.net.leave() }) },
  },
  expressions: { Last: (r) => r.game.net.last.data, LastFrom: (r) => r.game.net.last.from, LastName: (r) => r.game.net.last.name, PeerCount: (r) => r.game.net.peers.length, Id: (r) => r.game.net.id, IsHost: (r) => (r.game.net.isHost ? 1 : 0) },
});
registerPlugin('Effects', { // scene-wide (camera) effects; per-object ones are object ACEs
  actions: {
    'add-effect': { params: ['type'], raw: ['type'], run: (r, p) => { r.game.effects.add('scene', p.type); } },
    'set-parameter': { params: ['type', 'parameter', 'value'], raw: ['type', 'parameter'], run: (r, p) => { r.game.effects.find('scene', p.type)?.set(p.parameter, p.value); } },
    'set-enabled': { params: ['type', 'state'], raw: ['type', 'state'], run: (r, p) => { r.game.effects.find('scene', p.type)?.setEnabled(p.state === 'enabled'); } },
    'remove-effect': { params: ['type'], raw: ['type'], run: (r, p) => { r.game.effects.find('scene', p.type)?.remove(); } },
    'clear-effects': { run: (r) => { r.game.effects.clear('scene'); } },
  },
});
registerPlugin('Localisation', {
  actions: { 'set-language': { params: ['language'], run: (r, p) => { r.game.i18n.setLanguage(p.language); } } },
  conditions: { 'language-is': { params: ['language'], test: (r, p) => r.game.i18n.language === p.language } },
  expressions: { Text: (r, a) => r.game.i18n.t(a[0], Object.fromEntries((a.slice(1)).map((v, i) => [String(i), v]))), Language: (r) => r.game.i18n.language },
});
registerPlugin('Accessibility', {
  actions: {
    'set-color-blind-mode': { params: ['mode'], raw: ['mode'], run: (r, p) => { r.game.a11y.setColorBlind(p.mode); } },
    'set-ui-scale': { params: ['scale'], run: (r, p) => { r.game.a11y.setUiScale(p.scale); } },
  },
  expressions: { UIScale: (r) => r.game.a11y.uiScale },
});
registerPlugin('Touch', { // pointer events cover touch too, so a tap is a click
  conditions: {
    'on-tap': { trigger: true, test: (r) => r.firing.data.down },
    'on-touch-end': { trigger: true, test: (r) => !r.firing.data.down },
    'is-touching': { test: (r) => r.game.input.pointer.down },
  },
  expressions: { X: (r) => r.game.input.pointer.worldX, Y: (r) => r.game.input.pointer.worldY },
});
const pad = (i = 0) => globalThis.navigator?.getGamepads?.()?.[Math.floor(i)] ?? null;
registerPlugin('Gamepad', {
  conditions: {
    'is-connected': { params: ['index'], test: (r, p) => !!pad(p.index)?.connected },
    'button-is-down': { params: ['index', 'button'], test: (r, p) => !!pad(p.index)?.buttons?.[Math.floor(p.button)]?.pressed },
  },
  expressions: {
    Axis: (r, a) => pad(a[0])?.axes?.[Math.floor(a[1] ?? 0)] ?? 0,
    ButtonValue: (r, a) => pad(a[0])?.buttons?.[Math.floor(a[1] ?? 0)]?.value ?? 0,
  },
});
registerPlugin('Audio', {
  actions: {
    play: { params: ['file', 'loop'], run: (r, p) => { r.game.audio?.play(p.file, { loop: p.loop === 'looping' || p.loop === true }); } },
    'play-music': { params: ['file'], run: (r, p) => { r.game.audio?.music(p.file); } },
    'stop-music': { run: (r) => { r.game.audio?.stopMusic(); } },
    'set-volume': { params: ['bus', 'volume'], raw: ['bus'], run: (r, p) => { r.game.audio?.volume(p.bus, p.volume); } },
  },
});
registerPlugin('LocalStorage', {
  actions: { 'set-item': { params: ['key', 'value'], run: (r, p) => r.game.save.set(p.key, p.value) } },
  conditions: { 'has-item': { params: ['key'], test: (r, p) => r.game.save.get(p.key, undefined) !== undefined } },
  expressions: { ItemValue: (r, a) => r.game.save.get(a[0], '') },
});

const angle = (e) => e.rot[2] ?? 0;
/** World position of a named image point from the sprite editor (<image>.meta.json "points"), following position, scale, flip and rotation. */
function imagePoint(e, name) {
  const c = e.getComponent('sprite') ?? e.getComponent('animatedSprite'), b = e.scene.game.backend;
  const m = c && b?.metaOf?.(c.data.texture), pt = m?.points?.[name];
  if (!pt) return null;
  const [fw, fh] = b.frameSize(c.data.texture), o = m.origin ?? [fw / 2, fh / 2];
  const kx = c.data.size ? c.data.size[0] / fw : 1, ky = c.data.size ? c.data.size[1] / fh : 1;
  const lx = (pt[0] - o[0]) * kx * e.scale[0] * (c.data.flipX ? -1 : 1), ly = (pt[1] - o[1]) * ky * e.scale[1] * (c.data.flipY ? -1 : 1);
  const a = angle(e) * rad;
  return [e.pos[0] + lx * Math.cos(a) - ly * Math.sin(a), e.pos[1] + lx * Math.sin(a) + ly * Math.cos(a)];
}
registerObjectAces({
  conditions: {
    'compare-x': { params: ['comparison', 'value'], raw: ['comparison'], instance: true, test: (r, e, p) => cmp(e.pos[0], p.comparison, p.value) },
    'compare-y': { params: ['comparison', 'value'], raw: ['comparison'], instance: true, test: (r, e, p) => cmp(e.pos[1], p.comparison, p.value) },
    'compare-angle': { params: ['comparison', 'value'], raw: ['comparison'], instance: true, test: (r, e, p) => cmp(angle(e), p.comparison, p.value) },
    'compare-instance-var': { params: ['variable', 'comparison', 'value'], raw: ['variable', 'comparison'], instance: true, test: (r, e, p) => cmp(e.vars[p.variable], p.comparison, p.value) },
    'is-boolean-instance-var-set': { params: ['variable'], raw: ['variable'], instance: true, test: (r, e, p) => !!e.vars[p.variable] },
    'is-overlapping-at-offset': { params: ['object', 'dx', 'dy'], raw: ['object'], instance: true, test: (r, e, p) => { const o = [...e.pos]; e.pos = [o[0] + p.dx, o[1] + p.dy, o[2]]; const hit = r.picked(p.object, r.solView).some((b) => b !== e && overlaps(e, b)); e.pos = o; return hit; } },
    'is-visible': { instance: true, test: (r, e) => e.enabled },
    'on-created': { trigger: true, test: (r, p, { sol, cond }) => { const e = r.firing.data.entity; if (!r.matches(e, cond.object)) return false; r.pick(sol, cond.object, [e]); return true; } },
    'on-destroyed': { trigger: true, test: (r, p, { sol, cond }) => { const e = r.firing.data.entity; if (!r.matches(e, cond.object)) return false; r.pick(sol, cond.object, [e]); return true; } },
    'on-collision': {
      params: ['object'], raw: ['object'], trigger: true,
      test(r, p, { sol, cond }) {
        const { a, b } = r.firing.data;
        const [x, y] = r.matches(a, cond.object) && r.matches(b, p.object) ? [a, b] : r.matches(b, cond.object) && r.matches(a, p.object) ? [b, a] : [null, null];
        if (!x) return false;
        r.pick(sol, cond.object, [x]); r.pick(sol, p.object, [y]); return true;
      },
    },
    'is-overlapping': {
      params: ['object'], raw: ['object'],
      test(r, p, { sol, cond }) { // boxes from the `collider` component (see behaviors/util.js bbox)
        const B = r.picked(p.object, sol);
        const hits = new Set(), hitB = new Set();
        for (const a of r.picked(cond.object, sol)) for (const b of B) if (b !== a && overlaps(a, b)) { hits.add(a); hitB.add(b); }
        r.pick(sol, cond.object, [...hits]);
        if (p.object !== cond.object) r.pick(sol, p.object, [...hitB]);
        return hits.size > 0;
      },
    },
  },
  actions: {
    'set-position': { params: ['x', 'y'], instance: true, run: (r, e, p) => { e.pos = [p.x, p.y, e.pos[2]]; } },
    'set-x': { params: ['x'], instance: true, run: (r, e, p) => { e.pos = [p.x, e.pos[1], e.pos[2]]; } },
    'set-y': { params: ['y'], instance: true, run: (r, e, p) => { e.pos = [e.pos[0], p.y, e.pos[2]]; } },
    'set-angle': { params: ['angle'], instance: true, run: (r, e, p) => { e.rot = [e.rot[0], e.rot[1], p.angle]; } },
    'rotate-clockwise': { params: ['degrees'], instance: true, run: (r, e, p) => { e.rot = [e.rot[0], e.rot[1], angle(e) + p.degrees]; } },
    'rotate-counter-clockwise': { params: ['degrees'], instance: true, run: (r, e, p) => { e.rot = [e.rot[0], e.rot[1], angle(e) - p.degrees]; } },
    'move-forward': { params: ['distance'], instance: true, run: (r, e, p) => { const a = angle(e) * rad; e.pos = [e.pos[0] + Math.cos(a) * p.distance, e.pos[1] + Math.sin(a) * p.distance, e.pos[2]]; } },
    'move-at-angle': { params: ['angle', 'distance'], instance: true, run: (r, e, p) => { const a = p.angle * rad; e.pos = [e.pos[0] + Math.cos(a) * p.distance, e.pos[1] + Math.sin(a) * p.distance, e.pos[2]]; } },
    'set-size': { params: ['width', 'height'], instance: true, run: (r, e, p) => { e.scale = [p.width, p.height, e.scale[2]]; } },
    'set-visible': { params: ['visibility'], raw: ['visibility'], instance: true, run: (r, e, p) => { e.enabled = p.visibility === 'visible'; } },
    'set-instance-var': { params: ['variable', 'value'], raw: ['variable'], instance: true, run: (r, e, p) => { e.vars[p.variable] = p.value; } },
    'add-to-instance-var': { params: ['variable', 'value'], raw: ['variable'], instance: true, run: (r, e, p) => { e.vars[p.variable] = (e.vars[p.variable] ?? 0) + p.value; } },
    'subtract-from-instance-var': { params: ['variable', 'value'], raw: ['variable'], instance: true, run: (r, e, p) => { e.vars[p.variable] = (e.vars[p.variable] ?? 0) - p.value; } },
    'toggle-boolean-instance-var': { params: ['variable'], raw: ['variable'], instance: true, run: (r, e, p) => { e.vars[p.variable] = !e.vars[p.variable]; } },
    'set-animation': { params: ['animation'], instance: true, run: (r, e, p) => { if (e.getComponent('animatedSprite') && e.getComponent('animatedSprite').data.anim !== p.animation) e.set('animatedSprite', 'anim', p.animation); } },
    'set-mirrored': { params: ['mirrored'], instance: true, run: (r, e, p) => { e.set(e.getComponent('animatedSprite') ? 'animatedSprite' : 'sprite', 'flipX', !!p.mirrored); } },
    'set-opacity': { params: ['opacity'], instance: true, run: (r, e, p) => { setOpacity(e, p.opacity / 100); } },
    'set-text': { params: ['text'], instance: true, run: (r, e, p) => { const t = ['text', 'uiLabel', 'uiButton', 'spriteFont'].find((c) => e.getComponent(c)); if (t) e.set(t, 'text', String(p.text)); } },
    'add-effect': { params: ['type'], raw: ['type'], instance: true, run: (r, e, p) => { r.game.effects.add(e, p.type); } },
    'set-effect-parameter': { params: ['type', 'parameter', 'value'], raw: ['type', 'parameter'], instance: true, run: (r, e, p) => { r.game.effects.find(e, p.type)?.set(p.parameter, p.value); } },
    'remove-effect': { params: ['type'], raw: ['type'], instance: true, run: (r, e, p) => { r.game.effects.find(e, p.type)?.remove(); } },
    'canvas-clear': { instance: true, run: (r, e) => { e.getComponent('drawingCanvas')?.api.clear(); } },
    'canvas-fill': { params: ['color'], instance: true, run: (r, e, p) => { e.getComponent('drawingCanvas')?.api.fill(p.color); } },
    'canvas-draw-rect': { params: ['x', 'y', 'width', 'height', 'color'], instance: true, run: (r, e, p) => { e.getComponent('drawingCanvas')?.api.rect(p.x, p.y, p.width, p.height, p.color); } },
    'canvas-draw-circle': { params: ['x', 'y', 'radius', 'color'], instance: true, run: (r, e, p) => { e.getComponent('drawingCanvas')?.api.circle(p.x, p.y, p.radius, p.color); } },
    'canvas-draw-line': { params: ['x1', 'y1', 'x2', 'y2', 'color', 'width'], instance: true, run: (r, e, p) => { e.getComponent('drawingCanvas')?.api.line(p.x1, p.y1, p.x2, p.y2, p.color, p.width); } },
    'video-play': { params: ['loop'], instance: true, run: (r, e, p) => { e.getComponent('video')?.api.play(p.loop === 'looping' || p.loop === true); } },
    'video-pause': { instance: true, run: (r, e) => { e.getComponent('video')?.api.pause(); } },
    'video-resume': { instance: true, run: (r, e) => { e.getComponent('video')?.api.resume(); } },
    'video-stop': { instance: true, run: (r, e) => { e.getComponent('video')?.api.stop(); } },
    'video-seek': { params: ['time'], instance: true, run: (r, e, p) => { e.getComponent('video')?.api.seek(p.time); } },
    destroy: { instance: true, run: (r, e) => { e.destroy(); } },
  },
  expressions: {
    PointX: (e, [n]) => imagePoint(e, n)?.[0] ?? e.pos[0], PointY: (e, [n]) => imagePoint(e, n)?.[1] ?? e.pos[1],
    X: (e) => e.pos[0], Y: (e) => e.pos[1], Angle: (e) => angle(e), Width: (e) => e.scale[0], Height: (e) => e.scale[1], UID: (e) => e.id, Name: (e) => e.name,
  },
});
export { cmp };
