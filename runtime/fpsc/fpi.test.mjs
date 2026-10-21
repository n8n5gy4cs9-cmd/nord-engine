// Unit tests for the FPS Creator .fpi interpreter (runtime/fpsc/fpi.js) and importer (tools/fpsc-import-fpi.mjs).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { parseFpi, unsupported, makeFpiScript, UNIT } from './fpi.js';
import { convert, install, suggestAlias } from '../../tools/fpsc-import-fpi.mjs';

/** Minimal fake of the script context `c` the runtime passes to hooks. */
function fake(src, { px = 0, params = {} } = {}) {
  const log = [], ent = { x: 0, y: 0, z: 0, layer: 0, props: {}, def: {}, enemy: false, setModelVisible: (v) => log.push(['visible', v]), emit: (n) => log.push(['emit', n]), syncModel() {}, heal() {}, destroy: () => log.push(['destroy']), target: 'door1', hp: 1 };
  const player = { x: px, y: 0, z: 0, eyePos: [px, 1.2, 0], alive: true, keys: new Set(), heal: (n) => log.push(['heal', n]), hurt() {}, teleport() {} };
  const game = { time: 0, world: { los: () => true }, ents: [], doorsNamed: () => [], find: () => [], setDoor() {}, setLight() {}, give: (i, n) => { log.push(['give', i, n]); return true; } };
  const mod = makeFpiScript({ id: 'x', fpi: src });
  const c = { self: ent, game, player, s: {}, p: Object.fromEntries(Object.entries(mod.params).map(([k, d]) => [k, params[k] ?? d.default])), sound: (n) => log.push(['sound', n]), say: (t) => log.push(['say', t]), targets: () => [] };
  mod.start(c);
  const tick = (dt = 0.1) => { game.time += dt; mod.update(c, dt); };
  return { mod, c, log, tick, player, game };
}

test('fpi: parses conditions, actions, the one-colon form and comments', () => {
  const p = parseFpi(';c\ndesc = Door\n:state=0,plrdistwithin=120:state=4\n:state=4,state=0\n:state=1:sound=$0,incframe=0\n');
  assert.equal(p.desc, 'Door'); assert.equal(p.lines.length, 3);
  assert.deepEqual(p.lines[0].conds, [['state', '0'], ['plrdistwithin', '120']]); assert.deepEqual(p.lines[1].acts, [['state', '0']]);
});

test('fpi: unsupported() lists unknown commands but not ignored ones', () => {
  assert.deepEqual(unsupported(parseFpi(':state=0:coloff,hudreset,state=1')), []);
  assert.deepEqual(unsupported(parseFpi(':state=0,aicanshoot=1:aistop')), ['aicanshoot', 'aistop']);
});

test('fpi: a light script chain advances state; lines see the new state in the same update', () => {
  const { tick, c } = fake(':state=0:state=1\n:state=1:state=2\n');
  tick(); assert.equal(c.s.state, 2);
});

test('fpi: proximity door cycle (frame counter, sounds)', () => {
  const src = ':state=0,plrdistwithin=120:state=4\n:state=1:incframe=0\n:state=1,frameatend=0:state=2,coloff\n:state=2,plrdistfurther=120:state=3,sound=$1,colon\n:state=3:decframe=0\n:state=3,frameatstart=0:state=0,setframe=0\n:state=4,plrcanbeseen:state=1,setframe=0,sound=$0\n:state=4,state=0\n';
  const f = fake(src, { px: 100 * UNIT * 2, params: { anim: 0.5, s0: 'door', s1: 'door2' } });
  f.tick(); assert.equal(f.c.s.state, 0, 'far away: stays closed');
  f.player.x = 0; f.tick(); assert.equal(f.c.s.state, 1, 'player near and seen: door starts opening');
  for (let i = 0; i < 6; i++) f.tick(0.1); assert.equal(f.c.s.state, 2, 'fully open'); assert.ok(f.log.some((l) => l[0] === 'sound' && l[1] === 'door'));
  f.player.x = 50; f.tick(); assert.equal(f.c.s.state, 3); for (let i = 0; i < 6; i++) f.tick(0.1); assert.equal(f.c.s.state, 0, 'closed again'); assert.ok(f.log.some((l) => l[1] === 'door2'));
});

test('fpi: usable switch, activation of the target and held-key logic', () => {
  const src = ':state=10,plrdistwithin=100,plrusingaction=1:state=1,activateifused=1\n:state=1:state=2\n:state=2,plrusingaction=0:state=10\n:state=0:state=10\n';
  const f = fake(src); assert.equal(f.c.self.props.usable, true);
  f.tick(); assert.equal(f.c.s.state, 10);
  f.mod.use(f.c); f.tick(); assert.equal(f.c.s.state, 2);
  f.tick(0.5); assert.equal(f.c.s.state, 10, 'key released: back to ready');
});

test('fpi: pickup gives configured item once, hides the entity', () => {
  const f = fake(':state=0,cantake,plrdistwithin=80:state=1,playertake,plraddhealth=50,plrsound=$0', { params: { give: 'health', amount: 30, s0: 'pickup' } });
  f.tick(); assert.deepEqual(f.log.filter((l) => l[0] === 'give' || l[0] === 'heal'), [['give', 'health', 30], ['heal', 50]]);
  f.tick(); assert.equal(f.log.filter((l) => l[0] === 'give').length, 1);
});

test('fpi: variables, timer and activation events', () => {
  const f = fake(':state=0:timerstart,setvar=5,state=1\n:state=1,varequal=5,timergreater=300:incvar=1,state=2\n:state=2,activated=1:state=3\n');
  f.tick(0.1); assert.equal(f.c.s.state, 1); f.tick(0.1); assert.equal(f.c.s.state, 1); f.tick(0.2); assert.equal(f.c.s.state, 2); assert.equal(f.c.s.v, 6);
  f.mod.event(f.c, 'open'); f.tick(); assert.equal(f.c.s.state, 3);
});

test('importer: converts the supported scripts, skips AI ones with an alias hint, installs bank entries', () => {
  const src = fs.mkdtempSync(path.join(os.tmpdir(), 'fpi-src-')), prj = fs.mkdtempSync(path.join(os.tmpdir(), 'fpi-prj-'));
  fs.mkdirSync(path.join(src, 'people'));
  fs.writeFileSync(path.join(src, 'light1.fpi'), ';x\ndesc = Light Toggle\n:state=0:state=1\n:state=1,activated=0:state=2,lighton\n');
  fs.writeFileSync(path.join(src, 'people', 'shoot.fpi'), 'desc = Shoot\n:state=0,aicanshoot=1:useweapon\n');
  const res = convert(src); assert.equal(res.done.length, 1); assert.equal(res.skipped.length, 1); assert.equal(res.skipped[0].alias, 'ai-shooter');
  install(prj, res); install(prj, res);
  const bank = JSON.parse(fs.readFileSync(path.join(prj, 'fpsc/bank.json'), 'utf8'));
  assert.deepEqual(bank.scripts, ['fpsc/scripts/fpi-light1.js']);
  assert.match(fs.readFileSync(path.join(prj, 'fpsc/scripts/fpi-light1.js'), 'utf8'), /"fpi":/);
  assert.match(fs.readFileSync(path.join(prj, 'fpsc/fpi/IMPORT_REPORT.md'), 'utf8'), /1 imported, 1 skipped/);
  assert.equal(suggestAlias('snipe10'), 'ai-sniper');
});

test('bank: a data-only imported module becomes a runnable script via createBank', async () => {
  const { createBank } = await import('./bank.js');
  const mod = { default: { id: 'fpi-light1', title: 'Light', fpi: ':state=0:sound=$0,state=1\n' } };
  const b = await createBank({ scripts: ['fpsc/scripts/fpi-light1.js'] }, { importer: async () => mod });
  const s = b.script('fpi-light1'); assert.ok(s && typeof s.update === 'function' && s.params.s0 && s.custom);
});
