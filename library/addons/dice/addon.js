// Sample Nord addon — shows every extension point. Install with:  nord addon install library/addons/dice --project .
export function register(nord) {
  const { registerPlugin, registerBehavior, registerEffect, Behavior } = nord;

  // 1. A plugin: new conditions / actions / expressions in event sheets (object name "Dice").
  registerPlugin('Dice', {
    conditions: {
      'on-rolled': { params: ['sides'], trigger: true, test: (r, p) => r.firing.data.sides === p.sides },
      'last-roll-is': { params: ['value'], test: (r, p) => r.game.diceLast === p.value },
    },
    actions: {
      roll: { params: ['sides'], run: (r, p) => { r.game.diceLast = 1 + Math.floor(r.game.rng.next() * p.sides); r.fire('Dice.on-rolled', { sides: p.sides }); } },
    },
    expressions: {
      Roll: (r, [sides = 6]) => 1 + Math.floor(r.game.rng.next() * sides),
      Last: (r) => r.game.diceLast ?? 0,
    },
  });

  // 2. A behavior: attach with  "behaviors": [{ "type": "Wobble", "properties": { "amount": 6 } }]  (shows up in event sheets as Wobble ▸ …)
  class Wobble extends Behavior {
    static attributes = { amount: { type: 'number', default: 4 }, speed: { type: 'number', default: 8 } };
    tick(dt) { this.t = (this.t ?? 0) + dt * this.props.speed; const e = this.entity; this.base ??= e.rot[2] ?? 0; e.rot = [e.rot[0], e.rot[1], this.base + Math.sin(this.t) * this.props.amount]; }
  }
  registerBehavior('Wobble', Wobble, {
    conditions: { 'is-wobbling': { test: (b) => b.enabled } },
    actions: { 'set-amount': { params: ['amount'], run: (b, p) => { b.props.amount = p.amount; } } },
    expressions: { Amount: (b) => b.props.amount },
  });

  // 3. An effect: usable as { "type": "warm" } in scene/entity effect lists. css = scene-wide on every renderer.
  registerEffect('warm', { defaults: { value: 0.6 }, css: (p) => `sepia(${p.value}) saturate(1.3)` });
}
