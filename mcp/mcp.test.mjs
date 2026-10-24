// node --test mcp/   — drives the real server over stdio like an MCP client.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const server = path.join(root, 'mcp/nord-mcp.mjs');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'nordmcp-'));
const proj = path.join(tmp, 'game');

function client(dir = proj, args = []) {
  const p = spawn('node', [server, '--project', dir, ...args], { stdio: ['pipe', 'pipe', 'inherit'], env: { ...process.env, NORD_BIN: nord ?? '' } });
  let buf = ''; const waiting = new Map(); let id = 0;
  p.stdout.on('data', (d) => { buf += d; let i; while ((i = buf.indexOf('\n')) >= 0) { const m = JSON.parse(buf.slice(0, i)); buf = buf.slice(i + 1); waiting.get(m.id)?.(m); } });
  const rpc = (method, params) => new Promise((res) => { const i = ++id; waiting.set(i, res); p.stdin.write(JSON.stringify({ jsonrpc: '2.0', id: i, method, params }) + '\n'); });
  const call = async (name, args = {}) => { const r = (await rpc('tools/call', { name, arguments: args })).result; return { ...r, text: r.content.filter((c) => c.type === 'text').map((c) => c.text).join('\n') }; };
  return { rpc, call, close: () => p.kill() };
}
var nord = ['target/debug/nord', 'target/release/nord'].map((f) => path.join(root, f)).find((f) => fs.existsSync(f));

test('protocol: initialize, tools, resources, prompts', async () => {
  const c = client();
  const init = (await c.rpc('initialize', { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 't', version: '1' } })).result;
  assert.equal(init.serverInfo.name, 'nord');
  const names = (await c.rpc('tools/list', {})).result.tools.map((t) => t.name);
  for (const n of ['nord_guide', 'scene_add_entity', 'check_project', 'modeler_primitive', 'modeler_preview', 'modeler_save']) assert.ok(names.includes(n), n);
  assert.ok((await c.rpc('resources/list', {})).result.resources.length > 10);
  assert.ok((await c.rpc('prompts/get', { name: 'make-a-game', arguments: { idea: 'pong' } })).result.messages[0].content.text.includes('pong'));
  const g = await c.call('nord_guide', {}); assert.match(g.text, /The loop/);
  const s = await c.call('nord_guide', { topic: 'scripting' }); assert.match(s.text, /NordScript/);
  assert.match((await c.call('nord_guide', { topic: 'ex-game-manager' })).text, /GameManager/);
  assert.equal((await c.call('nord_guide', { topic: 'nonsense' })).text.startsWith('Unknown topic'), true);
  c.close();
});

test('unity conversion tools read a Unity project', async () => {
  const c = client();
  const fx = path.join(root, 'mcp/fixtures/unity-sample');
  const scan = JSON.parse((await c.call('unity_scan', { path: fx })).text);
  assert.equal(scan.unityVersion, '2022.3.10f1');
  assert.deepEqual(scan.buildScenes, ['Assets/Scenes/Main.unity']);
  assert.ok(scan.tags.includes('Coin') && scan.layers['6'] === 'Ground' && scan.inputAxes.includes('Jump'));
  const pl = scan.scripts.find((s) => s.file.endsWith('Player.cs'));
  assert.deepEqual(pl.fields.map((f) => f.name), ['speed', 'jumpForce', 'maxHealth', 'coinPrefab', 'jumpSfx']);
  assert.ok(pl.lifecycle.includes('Awake') && pl.lifecycle.includes('Update') && pl.coroutines.includes('Flash') && pl.apis.includes('physics'));
  assert.ok(scan.hints.some((h) => /Cinemachine/.test(h)));
  const sc = JSON.parse((await c.call('unity_scene_to_nord', { unityProject: fx, file: 'Assets/Scenes/Main.unity' })).text);
  const player = sc.entities.find((e) => e.name === 'Player');
  assert.deepEqual(player.transform.pos, [200, -100, 0]);
  assert.equal(player.scripts[0].path, 'scripts/player.js'); assert.equal(player.scripts[0].attributes.speed, 6);
  assert.equal(player.children[0].name, 'Weapon'); assert.equal(player.children[0].enabled, false);
  assert.ok(player.components.some((x) => x.type === 'sprite') && player.components.some((x) => x.type === 'rigidbody'));
  assert.ok(sc.todo.some((t) => /Coin\.prefab/.test(t)));
  const out = JSON.parse((await c.call('unity_cs_outline', { source: 'public class A : MonoBehaviour { public int hp = 3; void Start(){} }' })).text);
  assert.equal(out.fields[0].name, 'hp');
  assert.match((await c.call('nord_guide', { topic: 'unity-conversion' })).text, /Unity/);
  c.close();
});

test('modeler: build, texture, preview, save GLB, reopen GLB', async () => {
  fs.mkdirSync(proj, { recursive: true }); fs.writeFileSync(path.join(proj, 'nord.project.json'), '{"format":1,"name":"t","type":"3d","startScene":"scenes/main.scene.json"}');
  const c = client();
  assert.ok(!(await c.call('modeler_new', { name: 'crate' })).isError);
  await c.call('modeler_primitive', { name: 'crate', kind: 'cube', size: [1, 1, 1] });
  const ex = await c.call('modeler_extrude', { name: 'crate', faces: '+y', distance: 0.2, inset: 0.2 });
  assert.match(ex.text, /Extruded 1 faces/);
  await c.call('modeler_texture_new', { name: 'crate', size: 32, color: '#8a5a2b' });
  await c.call('modeler_texture_paint', { name: 'crate', ops: [{ shape: 'rect', x0: 0, y0: 0, x1: 1, y1: 0.1, color: '#ff0000' }, { shape: 'noise', color: '#8a5a2b', seed: 3 }] });
  const pv = await c.call('modeler_preview', { name: 'crate', views: ['iso', 'front'], size: 200 });
  assert.equal(pv.content.filter((x) => x.type === 'image').length, 2);
  const png = Buffer.from(pv.content.find((x) => x.type === 'image').data, 'base64'); assert.equal(png.readUInt32BE(0), 0x89504e47);
  assert.match((await c.call('modeler_save', { name: 'crate' })).text, /models\/crate\.glb/);
  for (const f of ['crate.glb', 'crate.mesh.json', 'crate.png']) assert.ok(fs.existsSync(path.join(proj, 'models', f)), f);
  const glb = fs.readFileSync(path.join(proj, 'models/crate.glb')); assert.equal(glb.readUInt32LE(0), 0x46546c67); assert.equal(glb.readUInt32LE(8), glb.length);
  const re = await c.call('modeler_open', { file: 'models/crate.glb', name: 'again' });
  assert.match(re.text, /texture 32x32/); assert.match(re.text, /faces/);
  assert.ok((await c.call('modeler_mirror', { name: 'again', axis: 'x' })).text.includes('Mirrored'));
  assert.equal((await c.call('modeler_transform', { name: 'nope', op: 'translate', value: [0, 1, 0] })).isError, true);
  assert.equal((await c.call('modeler_texture_paint', { name: 'again', ops: [{ shape: 'bad', color: '#fff' }] })).isError, true);
  c.close();
});

test('project: files jailed, scenes edited, check passes', { skip: !nord && 'build the CLI first: cargo build -p nord-cli' }, async () => {
  const dir = path.join(tmp, 'g2');
  const r = spawnSync(nord, ['new', dir, '-t', '2d'], { encoding: 'utf8' }); assert.equal(r.status, 0, r.stderr);
  const k = client(dir);
  try {
  assert.match((await k.call('project_info')).text, /startScene/);
  assert.match((await k.call('library_list', { query: 'console' })).text, /prefab\.dev-console/);
  assert.match((await k.call('library_add', { id: 'prefab.dev-console' })).text, /scripts\/dev-console\.js/);
  assert.match((await k.call('scene_add_entity', { name: 'Dev Console', prefab: { path: 'prefabs/dev-console.prefab.json' } })).text, /Added/);
  await k.call('write_file', { path: 'assets/sprites/square.png', encoding: 'base64', content: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==' });
  assert.equal((await k.call('read_file', { path: '../../etc/passwd' })).isError, true);
  assert.equal((await k.call('write_file', { path: '.git/x', content: 'a' })).isError, true);
  assert.equal((await k.call('write_file', { path: 'scripts/bad.json', content: '{oops' })).isError, true);
  await k.call('write_file', { path: 'scripts/mover.js', content: "import { NordScript } from 'nord';\nexport default class Mover extends NordScript { update(dt) { this.entity.pos = [this.entity.pos[0] + 10 * dt, this.entity.pos[1], 0]; } }\n" });
  const add = await k.call('scene_add_entity', { name: 'Mover', pos: [100, 100, 0], components: [{ type: 'sprite', texture: 'assets/sprites/square.png', size: [20, 20] }], scripts: [{ path: 'scripts/mover.js' }] });
  assert.match(add.text, /Added "Mover"/);
  assert.equal((await k.call('scene_add_entity', { name: 'X', components: [{ type: 'nonsense' }] })).isError, true);
  assert.match((await k.call('scene_get')).text, /Mover/);
  assert.match((await k.call('component_schema', { kind: 'model' })).text, /path:asset\(model\)/);
  const chk = await k.call('check_project'); assert.doesNotMatch(chk.text, /error/i, chk.text);
  } finally { k.close(); }
});

test('docs/MCP.md is generated from the tools and up to date', () => {
  const before = fs.readFileSync(path.join(root, 'docs/MCP.md'), 'utf8');
  spawnSync('node', [server, '--docs'], { encoding: 'utf8' });
  const after = fs.readFileSync(path.join(root, 'docs/MCP.md'), 'utf8');
  assert.equal(after, before, 'docs/MCP.md was stale: run `node mcp/nord-mcp.mjs --docs` and commit it');
  for (const m of after.matchAll(/### `(\w+)`/g)) assert.ok(m[1]);
});
