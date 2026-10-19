// Behaviors (Construct-style): reusable components attached to an entity in scene JSON  `"behaviors": [{ "type": "Platform", "properties": { "maxSpeed": 330 } }]`.
// A behavior = class with `static attributes` (inspector properties, same schema as scripts) + tick(dt), plus ACEs for event sheets:
//   registerBehavior('Name', Class, { conditions:{id:{params,test(b,p,r)}}, actions:{id:{params,run(b,p,r)}}, expressions:{Name:(b,args,r)=>…} })
// Triggers (def.trigger) keep the event-sheet signature test(r,p,c); fire them with  b.fire('on-jump').
// JS scripts can use them too:  this.entity.behavior('Platform').vx
import { resolveAttributes } from '../script.js';

export const behaviors = new Map();

export class Behavior {
  constructor(entity, props, type) { this.entity = entity; this.props = props; this.type = type; this.enabled = true; }
  get scene() { return this.entity.scene; }
  get game() { return this.entity.scene.game; }
  tick(dt) {}
  /** Fire an event-sheet trigger ("On jump") for this entity. */
  fire(id) { this.scene.eventSheet?.fire(`Behavior.${this.type}.${id}`, { entity: this.entity }); }
}

export function registerBehavior(name, Class, aces = {}) {
  const wrap = (kind, fn) => (r, e, p) => { const b = e.behavior(name); return b ? fn(b, p, r) : kind === 'cond' ? false : undefined; };
  const def = { Class, conditions: {}, actions: {}, expressions: aces.expressions ?? {} };
  for (const [id, c] of Object.entries(aces.conditions ?? {})) def.conditions[id] = c.trigger ? c : { ...c, instance: true, test: wrap('cond', c.test) };
  for (const [id, a] of Object.entries(aces.actions ?? {})) def.actions[id] = { ...a, instance: true, run: wrap('act', a.run) };
  behaviors.set(name, def);
}

export function createBehavior(entity, type, given = {}, warn = console.warn) {
  const def = behaviors.get(type);
  if (!def) { warn(`[nord] unknown behavior '${type}'`); return null; }
  const { enabled, ...rest } = given;
  const props = resolveAttributes(def.Class, rest, warn);
  const b = new def.Class(entity, props, type);
  b.enabled = enabled !== false;
  b.init?.();
  return b;
}

export { resolveAttributes };
