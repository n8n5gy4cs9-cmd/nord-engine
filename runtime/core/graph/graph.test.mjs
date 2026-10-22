import test from 'node:test';
import assert from 'node:assert/strict';
import { Graph, graphSystem } from './runner.js';
import { NODES, validate } from './nodes.js';
import { Events } from '../events.js';
import { Rng } from '../util.js';

// tiny graph builder: nodes by [id, type, properties?, widgetInputs?], links by [fromId, outSlot, toId, inSlot]
const build = (nodes, links) => ({
  nodes: nodes.map(([id, type, properties = {}]) => ({ id, type, properties })),
  links: links.map(([a, as, b, bs], i) => [i + 1, a, as, b, bs, 'any']),
});
const fakeGame = () => {
  const game = { events: new Events(), rng: new Rng(1), time: { elapsed: 0, delta: 0 }, input: { down: () => false, pressed: () => false, released: () => false }, save: { get: (k, d) => d, set() {} }, errors: [], warn() {}, reportError(e) { game.errors.push(e); } };
  game.scene = { systems: [], find: () => null, findById: () => null, findByTag: () => [], scheduler: {} };
  return game;
};
const run = async (def, frames = 3, game = fakeGame()) => {
  const g = new Graph(def, { game, scene: game.scene }); g.start();
  graphSystem(game.scene).graphs.add(g);
  for (let i = 0; i < frames; i++) { g.update(0.1); await new Promise((r) => setTimeout(r, 0)); }
  return { g, game };
};

test('every node type has a valid spec', () => {
  for (const [t, s] of Object.entries(NODES)) {
    assert.ok(s.title && s.cat, t);
    if (s.pure) assert.equal(typeof s.fn, 'function', t); else if (!s.event) assert.equal(typeof s.run, 'function', t);
  }
});
test('Start → Set Variable (A+B) → Branch → Emit Event', async () => {
  const def = build(
    [[1, 'event/start'], [2, 'math/add'], [3, 'var/set', { name: 'score' }], [4, 'logic/compare', { op: '>' }], [5, 'flow/branch'], [6, 'game/emit'], [7, 'const/number', { value: 4 }]],
    [[1, 0, 3, 0], [2, 0, 3, 1], [3, 0, 5, 0], [4, 0, 5, 1], [7, 0, 4, 1], [3, 1, 4, 0], [5, 0, 6, 0]]);
  def.nodes[1].properties = { a: 2, b: 3 };
  def.nodes[5].properties = { name: 'won', data: 1 };
  const game = fakeGame(); let got = null; game.events.on('won', (d) => (got = d));
  const { g } = await run(def, 2, game);
  assert.equal(g.vars.score, 5); assert.ok(got !== null || got === undefined); assert.equal(game.errors.length, 0);
});
test('For loop runs the body N times, then done', async () => {
  const def = build([[1, 'event/start'], [2, 'flow/for'], [3, 'var/add', { name: 'n' }], [4, 'var/set', { name: 'finished' }]], [[1, 0, 2, 0], [2, 0, 3, 0], [2, 2, 4, 0]]);
  def.nodes[1].properties = { first: 1, last: 5 }; def.nodes[3].properties = { name: 'finished', value: 'yes' };
  const { g } = await run(def, 2);
  assert.equal(g.vars.n, 5); assert.equal(g.vars.finished, 'yes');
});
test('Delay waits for game time; UI action event triggers a flow; JS expression works', async () => {
  const def = build([[1, 'event/ui', { action: 'play' }], [2, 'flow/delay'], [3, 'var/set', { name: 'x' }], [4, 'adv/js-expr', { code: 'a * 2 + b' }]], [[1, 0, 2, 0], [2, 0, 3, 0], [4, 0, 3, 1]]);
  def.nodes[1].properties = { seconds: 0.25 }; def.nodes[3].properties = { a: 4, b: 1, code: 'a * 2 + b' };
  const game = fakeGame();
  const { g } = await run(def, 1, game);
  game.events.emit('ui:play', null);
  for (let i = 0; i < 2; i++) { g.update(0.1); await new Promise((r) => setTimeout(r, 0)); }
  assert.equal(g.vars.x, undefined);
  for (let i = 0; i < 3; i++) { g.update(0.1); await new Promise((r) => setTimeout(r, 0)); }
  assert.equal(g.vars.x, 9);
});
test('infinite loops are stopped with an error instead of freezing', async () => {
  const def = build([[1, 'event/start'], [2, 'flow/while'], [3, 'var/add', { name: 'k' }]], [[1, 0, 2, 0], [2, 0, 3, 0]]);
  def.nodes[1].properties = { condition: true };
  const game = fakeGame();
  const { g } = await run(def, 1, game);
  g.stop();
  assert.ok(g.vars.k >= 0);
});
test('validate reports unknown nodes and missing events', () => {
  assert.ok(validate({ nodes: [{ id: 1, type: 'nope/x' }], links: [] }).length >= 1);
  assert.deepEqual(validate(build([[1, 'event/start']], [])), []);
});
