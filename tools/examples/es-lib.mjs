// Shared helpers for the event-sheet starter templates (tools/examples/es-*/game.mjs).
import { E, rect, circle, text, project } from './lib.mjs';
export { E, rect, circle, text, project };
export const C = (object, id, params, extra) => ({ object, id, params, ...extra });
export const A = (object, id, params, extra) => ({ object, id, params, ...extra });
export const sys = (id, params) => C('System', id, params);
export const EV = (conditions, actions, children, extra) => ({ type: 'event', conditions, actions, ...(children ? { children } : {}), ...extra });
export const setv = (variable, value) => A('System', 'set-var', { variable, value });
export const addv = (variable, value) => A('System', 'add-to-var', { variable, value });
export const V = (name, value = 0, valueType = typeof value === 'string' ? 'string' : 'number') => ({ type: 'variable', name, valueType, value });
export const group = (title, children) => ({ type: 'group', title, active: true, children });
export const comment = (t) => ({ type: 'comment', text: t });
/** entity with behaviours + instance vars on top of a lib helper result */
export const with_ = (ent, extra) => ({ ...ent, ...extra });
export const prefab = (name, comps, behaviors = [], tags = []) => ({ id: `pf${name.toLowerCase().slice(0, 6).padEnd(6, '0')}`, name, enabled: true, tags, layer: 0, transform: { pos: [0, 0, 3], rot: [0, 0, 0], scale: [1, 1, 1] }, components: comps, scripts: [], behaviors, children: [], prefab: null });
export const sqr = (w, h, tint) => ({ type: 'sprite', texture: 'assets/sprites/square.png', size: [w, h], tint });
export const cir = (d, tint) => ({ type: 'sprite', texture: 'assets/sprites/circle.png', size: [d, d], tint });
export const col = (w, h) => ({ type: 'collider', shape: 'box', size: [w, h] });
export const SHARED_ASSETS = [{ from: 'assets/particles/square.png', to: 'assets/sprites/square.png' }, { from: 'assets/particles/circle.png', to: 'assets/sprites/circle.png' }];
