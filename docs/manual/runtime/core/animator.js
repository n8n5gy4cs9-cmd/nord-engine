// Animator controller: Unity-style state machine for 2D sprite animation (cloned behaviour of UnityEngine Animator /
// AnimatorController: parameters Float/Int/Bool/Trigger, conditions If/IfNot/Greater/Less/Equals/NotEqual, Any State,
// has-exit-time transitions, triggers consumed by the transition that fires). No blending: sprites switch clips.
// File format (`anim/<name>.animator.json`, edited by the Animator tab): see docs/ANIMATOR.md.

export const PARAM_TYPES = ['float', 'int', 'bool', 'trigger'];
export const MODES = ['if', 'ifNot', 'greater', 'less', 'equals', 'notEqual'];
/** Condition modes that make sense per parameter type (Unity shows the same restriction in its Inspector). */
export const MODES_FOR = { bool: ['if', 'ifNot'], trigger: ['if'], int: ['greater', 'less', 'equals', 'notEqual'], float: ['greater', 'less'] };
export const ANY = '*';

/** Problems in a controller definition (empty = fine). */
export function validateController(def) {
  const bad = [];
  const params = new Map((def?.parameters ?? []).map((p) => [p.name, p]));
  const states = new Set((def?.states ?? []).map((s) => s.name));
  if (!states.size) bad.push('no states');
  if (def?.default && !states.has(def.default)) bad.push(`default state '${def.default}' does not exist`);
  for (const [i, t] of (def?.transitions ?? []).entries()) {
    const tag = `transition ${i + 1} (${t.from} -> ${t.to})`;
    if (t.from !== ANY && !states.has(t.from)) bad.push(`${tag}: unknown from-state`);
    if (!states.has(t.to)) bad.push(`${tag}: unknown to-state`);
    if (!t.hasExitTime && !(t.conditions ?? []).length) bad.push(`${tag}: no exit time and no conditions, it can never fire`);
    for (const c of t.conditions ?? []) {
      const p = params.get(c.param);
      if (!p) bad.push(`${tag}: unknown parameter '${c.param}'`);
      else if (!(MODES_FOR[p.type] ?? []).includes(c.mode)) bad.push(`${tag}: '${c.mode}' does not work on ${p.type} '${p.name}'`);
    }
  }
  return bad;
}

export class AnimatorController {
  /** @param {object} def controller JSON  @param {(state:string, anim:string)=>void} [onState] called when a state is entered */
  constructor(def, onState = () => {}) {
    this.def = def; this.onState = onState;
    this.states = new Map(def.states.map((s) => [s.name, s]));
    this.params = Object.fromEntries((def.parameters ?? []).map((p) => [p.name, p.type === 'trigger' ? false : (p.default ?? (p.type === 'bool' ? false : 0))]));
    this.types = Object.fromEntries((def.parameters ?? []).map((p) => [p.name, p.type]));
    this.state = null; this.time = 0; this.speed = 1;
    this.enter(def.default && this.states.has(def.default) ? def.default : def.states[0].name);
  }

  enter(name) {
    const s = this.states.get(name); if (!s) return;
    this.state = name; this.time = 0; this.speed = s.speed ?? 1;
    this.onState(name, s.anim ?? name, s);
  }

  has(name) { return name in this.params; }
  get(name) { return this.params[name]; }
  set(name, value) {
    const t = this.types[name]; if (!t) return;
    this.params[name] = t === 'bool' || t === 'trigger' ? !!value : t === 'int' ? Math.trunc(Number(value) || 0) : Number(value) || 0;
  }
  setTrigger(name) { if (this.types[name] === 'trigger') this.params[name] = true; }
  resetTrigger(name) { if (this.types[name] === 'trigger') this.params[name] = false; }
  /** Jump to a state without any transition (Unity `Animator.Play`). */
  play(name) { if (this.states.has(name)) this.enter(name); }

  check(c) {
    const v = this.params[c.param], x = c.value ?? 0;
    switch (c.mode) {
      case 'if': return !!v;
      case 'ifNot': return !v;
      case 'greater': return v > x;
      case 'less': return v < x;
      case 'equals': return v === x;
      case 'notEqual': return v !== x;
      default: return false;
    }
  }

  /** Normalised time in the current state (1 = one clip length; keeps counting while a clip loops, like Unity). */
  normalized() { const len = this.states.get(this.state)?.length || this.lengthHint || 1; return this.time / len; }

  /** Advance by `dt` seconds. Returns the name of the entered state when a transition fired, else null. */
  update(dt) {
    this.time += dt * this.speed;
    const norm = this.normalized();
    // Any State transitions are checked first (Unity gives them priority over the state's own transitions).
    const ordered = [...(this.def.transitions ?? []).filter((t) => t.from === ANY), ...(this.def.transitions ?? []).filter((t) => t.from !== ANY)];
    for (const t of ordered) {
      if (t.from !== ANY && t.from !== this.state) continue;
      if (t.from === ANY && t.to === this.state && !t.canTransitionToSelf) continue;
      if (!t.hasExitTime && !(t.conditions ?? []).length) continue;
      if (t.hasExitTime && norm < (t.exitTime ?? 1)) continue;
      if (!(t.conditions ?? []).every((c) => this.check(c))) continue;
      for (const c of t.conditions ?? []) if (this.types[c.param] === 'trigger') this.params[c.param] = false;
      this.enter(t.to);
      return t.to;
    }
    return null;
  }
}
