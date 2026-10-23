#!/usr/bin/env node
// Headless test: Graph editor "Make subgraph" + live flow highlight. Builds Start → A → B → C, moves A+B into a subgraph file, checks the
// rewired main graph, runs original and converted graphs with the real runner (same result), and flashes a node from a trace message.
import { spawn } from 'node:child_process';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { loadPlaywright, ROOT } from './e2e-lib.mjs';
import { Graph, graphSystem } from '../runtime/core/graph/runner.js';
import { Events } from '../runtime/core/events.js';
import { Rng } from '../runtime/core/util.js';

const proj = fs.mkdtempSync(path.join(os.tmpdir(), 'nord-subgraph-'));
fs.cpSync(`${ROOT}/examples/event-sheets`, proj, { recursive: true });
const port = 6100 + Math.floor(Math.random() * 90);
const srv = spawn('cargo', ['run', '-q', '-p', 'nord-cli', '--', 'serve', proj, '--port', String(port)], { env: { ...process.env, NORD_ROOT: ROOT }, stdio: 'ignore' });
const base = `http://127.0.0.1:${port}`;
for (let i = 0; i < 120; i++) { try { if ((await fetch(base + '/api/project')).ok) break; } catch { /* starting */ } await new Promise((r) => setTimeout(r, 500)); }
const { chromium } = loadPlaywright();
const browser = await chromium.launch();
const fake = () => { const game = { events: new Events(), rng: new Rng(1), time: { elapsed: 0, delta: 0 }, input: { down: () => false, pressed: () => false, released: () => false }, save: { get: (k, d) => d, set() {} }, errors: [], reportError(e) { this.errors.push(e); }, warn() {} }; game.scene = { systems: [], find: () => null, findById: () => null, findByTag: () => [], scheduler: {} }; return game; };
async function runGraph(def, files = {}) {
  const game = fake(); game.loadJSON = async (p) => files[p];
  const g = new Graph(def, { game, scene: game.scene }); g.start(); graphSystem(game.scene).graphs.add(g);
  for (let i = 0; i < 3; i++) { g.update(0.1); await new Promise((r) => setTimeout(r, 0)); }
  assert.equal(game.errors.length, 0, String(game.errors[0]));
  return g.vars;
}
try {
  const page = await (await browser.newContext({ viewport: { width: 1300, height: 800 } })).newPage();
  const errors = []; page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(`${base}/editor/graph/index.html`);
  await page.waitForFunction(() => window.__graph?.graph);
  await page.evaluate(() => {
    const { graph } = window.__graph, LG = window.LiteGraph; graph.clear();
    const mk = (type, x, y, props = {}) => { const n = LG.createNode(type); n.pos = [x, y]; graph.add(n); Object.assign(n.properties, props); n.widgets?.forEach((w) => { if (w.name in props) w.value = props[w.name]; }); return n; };
    const link = (a, o, b, i) => a.connect(a.outputs.findIndex((x) => x.name === o), b, b.inputs.findIndex((x) => x.name === i));
    const s = mk('event/start', 0, 0), m = mk('math/add', 0, 200, { a: 2, b: 3 }), A = mk('var/set', 300, 0, { name: 'x' }), B = mk('var/set', 600, 0, { name: 'y' }), C = mk('var/set', 900, 0, { name: 'z' });
    link(s, 'then', A, 'exec'); link(m, 'result', A, 'value'); link(A, 'then', B, 'exec'); link(A, 'value', B, 'value'); link(B, 'then', C, 'exec'); link(B, 'value', C, 'value');
    window.__ids = { s: s.id, m: m.id, A: A.id, B: B.id, C: C.id };
    window.__graph.canvas.selected_nodes = { [A.id]: A, [B.id]: B };
  });
  const original = await page.evaluate(() => window.__graph.graph.serialize());
  const varsBefore = await runGraph(original);
  assert.equal(varsBefore.z, 5);
  await page.evaluate(() => { document.querySelector('#file').value = 'graphs/t.graph.json'; return window.__graph.makeSubgraph(); });
  await page.waitForTimeout(500);
  console.log('status:', await page.evaluate(() => document.querySelector('#status').textContent));
  const converted = await page.evaluate(() => window.__graph.graph.serialize());
  const sub = JSON.parse(fs.readFileSync(path.join(proj, 'graphs/t-sub1.graph.json'), 'utf8'));
  assert.ok(sub.nodes.some((n) => n.type === 'flow/return') && sub.nodes.some((n) => n.type === 'var/get') && sub.nodes.some((n) => n.type === 'event/start'), 'subgraph has Start, Get Variable a, Return');
  assert.deepEqual(converted.nodes.map((n) => n.type).sort(), ['event/start', 'flow/call-graph', 'math/add', 'var/set'], 'A and B were replaced by one call node');
  const varsAfter = await runGraph(converted, { 'graphs/t-sub1.graph.json': sub });
  assert.equal(varsAfter.z, 5, `converted graph gives the same result: ${JSON.stringify(varsAfter)}`);
  // live highlight: a trace message flashes the node
  const id = converted.nodes.find((n) => n.type === 'var/set').id;
  await page.evaluate((id) => { window.__graph.onTrace({ 'graphs/t-sub1.graph.json': [id] }); }, id);
  await page.evaluate(() => { document.querySelector('#file').value = 'graphs/t-sub1.graph.json'; });
  await page.evaluate((id) => window.__graph.onTrace({ 'graphs/t-sub1.graph.json': [id] }), id);
  const col = await page.evaluate((id) => window.__graph.graph.getNodeById(id).bgcolor, id);
  assert.equal(col, '#1f5c40', 'traced node flashes green');
  // heartbeat reaches the server and the game-side poll sees it
  await page.waitForTimeout(300);
  const wanted = await (await fetch(`${base}/api/graph-trace`)).json();
  assert.equal(wanted.wanted, true, 'an open Graph editor asks the game for traces');
  assert.deepEqual(errors, []);
  console.log('ok: subgraph extraction keeps behaviour, trace flash, heartbeat');
} finally { await browser.close(); srv.kill(); fs.rmSync(proj, { recursive: true, force: true }); }
