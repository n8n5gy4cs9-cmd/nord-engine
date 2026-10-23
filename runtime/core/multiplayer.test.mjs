import test from 'node:test';
import assert from 'node:assert/strict';
import { Game, Multiplayer, MemoryStorage, registerComponent } from './index.js';
import { registerCoreComponents } from './components.js';

const files = {
  'prefabs/ship.prefab.json': { format: 1, root: { name: 'Ship', transform: { pos: [0, 0, 0] }, components: [{ type: 'netSync', rate: 60, vars: ['hp'] }] } },
  s: { name: 's', entities: [{ id: 'pl', name: 'Placed', transform: { pos: [1, 2, 0] }, components: [{ type: 'netSync', rate: 60 }] }] },
};
const mk = async () => {
  const g = new Game({ id: 'x', startScene: 's' }, { fetchJSON: async (p) => structuredClone(files[p]), importScript: async () => ({}), storage: new MemoryStorage(), onError: (e) => { throw e; } });
  registerCoreComponents(g); await g.loadScene('s'); return g;
};
const tick = async (...gs) => { for (let i = 0; i < 3; i++) { await new Promise((r) => setTimeout(r, 5)); for (const g of gs) g.tick(1 / 60 + 0.001); } };
const pair = async () => { const a = await mk(), b = await mk(); Multiplayer.link(a.net, b.net); return [a, b]; };

test('messages: broadcast reaches the guest; internal __ messages stay hidden; old API intact', async () => {
  const [a, b] = await pair(); const got = [];
  b.net.on('message', (m) => got.push(m));
  a.net.send('hi', { n: 1 }); a.net.send('__secret', 1);
  await tick(a, b);
  assert.deepEqual(got.map((m) => [m.name, m.data.n, m.from]), [['hi', 1, a.net.id]]);
  assert.equal(b.net.hostId, a.net.id); assert.equal(a.net.peers.length, 1); assert.equal(b.net.peers[0], a.net.id);
});

test('a guest message is relayed by the host to the other guests, direct messages are routed to one peer', async () => {
  const a = await mk(), b = await mk(), c = await mk(); Multiplayer.link(a.net, b.net); Multiplayer.link(a.net, c.net);
  const gotC = [], gotB = []; c.net.on('message', (m) => gotC.push(m.name)); b.net.on('message', (m) => gotB.push(m.name));
  b.net.send('fromB'); a.net.send('onlyC', 1, { to: c.net.id });
  await tick(a, b, c);
  assert.deepEqual(gotC.sort(), ['fromB', 'onlyC']); assert.deepEqual(gotB, []);
});

test('rpc: any/host modes, local flag, unknown handler', async () => {
  const [a, b] = await pair(); const log = [];
  b.net.rpc('damage', (args, ctx) => log.push(['damage', args.n, ctx.isHost]));
  b.net.rpc('hostOnly', () => log.push(['hostOnly']), { from: 'host' });
  a.net.rpc('hostOnly', () => log.push(['A hostOnly']), { from: 'host' });
  a.net.call('damage', { n: 5 }); a.net.call('hostOnly');
  b.net.call('hostOnly'); // guest -> host: host handler requires the host as caller, so it is ignored
  const warns = []; a.warn = (m) => warns.push(m); a.net.game.warn = (m) => warns.push(m);
  await tick(a, b);
  assert.deepEqual(log, [['damage', 5, true], ['hostOnly']]);
  assert.ok(warns.some((w) => /only the host/.test(w)));
});

test('spawner: host spawns on every peer, late joiner gets the existing ones, owner leaving removes its entities', async () => {
  const a = await mk(), b = await mk(); Multiplayer.link(a.net, b.net);
  const e = await a.net.spawn('prefabs/ship.prefab.json', { pos: [3, 0, 0], owner: b.net.id });
  await tick(a, b);
  const mirror = [...b.net.spawned.values()][0];
  assert.ok(mirror && mirror.netOwner === b.net.id && mirror.pos[0] === 3, 'guest has a mirror of the host-spawned entity');
  assert.equal(await b.net.spawn('prefabs/ship.prefab.json'), null); // guests ask the host
  await tick(a, b); assert.equal(a.net.spawned.size, 2); assert.equal(b.net.spawned.size, 2);
  const c = await mk(); Multiplayer.link(a.net, c.net); await tick(a, b, c);
  assert.equal(c.net.spawned.size, 2, 'late joiner receives the entities that already exist');
  const left = []; a.net.on('leave', (m) => left.push(m.id));
  a.net.conns.get(b.net.id).ch.close(); // b drops: everything b owned goes away on the host and on c
  await tick(a, b, c);
  assert.deepEqual(left, [b.net.id]); assert.equal(a.net.spawned.size, 0); assert.equal(c.net.spawned.size, 0); assert.ok(e.destroyed);
});

test('netSync: the owner moves an entity, the other peer follows it; vars travel along', async () => {
  const [a, b] = await pair();
  const e = await a.net.spawn('prefabs/ship.prefab.json', { pos: [0, 0, 0], owner: a.net.id }); await tick(a, b);
  e.pos = [10, 4, 0]; e.vars.hp = 7;
  for (let i = 0; i < 20; i++) await tick(a, b);
  const m = [...b.net.spawned.values()][0];
  assert.ok(Math.abs(m.pos[0] - 10) < 0.5 && Math.abs(m.pos[1] - 4) < 0.5, `mirror moved to ${m.pos}`);
  assert.equal(m.vars.hp, 7);
  const placed = b.scene.find('Placed'); assert.ok(placed); // placed entity: owned by the host, so b does not send
  placed.pos = [99, 99, 0]; await tick(a, b); await tick(a, b);
  assert.ok(Math.abs(a.scene.find('Placed').pos[0] - 1) < 1e-6, 'a guest cannot move a host-owned entity');
});

test('stats count traffic and ping works; the simulator drops and delays', async () => {
  const [a, b] = await pair();
  a.net.simulate({ loss: 1 }); a.net.send('x'); a.net.send('y');
  assert.equal(a.net.stats().dropped, 2); assert.equal(a.net.stats().msgsOut, 0);
  a.net.simulate({ latency: 30 }); const got = []; b.net.on('message', (m) => got.push(performance.now()));
  const t0 = performance.now(); a.net.send('z'); await new Promise((r) => setTimeout(r, 80));
  assert.equal(got.length, 1); assert.ok(got[0] - t0 >= 25, 'latency applied');
  a.net.simulate({}); a.net.stats(); assert.ok(a.net.stats().bytesOut > 0 && b.net.stats().bytesIn > 0);
  a.net.send('__ping', { t: performance.now() }, { to: b.net.id }); await tick(a, b);
  assert.ok(a.net.stats().pingMs !== null && a.net.stats().pingMs >= 0);
});
