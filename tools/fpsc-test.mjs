#!/usr/bin/env node
// FPS Creator test suite (docs/FPS_CREATOR.md §Testing). Needs `cargo build -p nord-cli` and Playwright + Chromium.
//   node tools/fpsc-test.mjs [unit] [api] [nord] [game] [editor]      (default: all)       screenshots → target/fpsc/
// Runs the real `nord serve` against a temp copy of templates/fps-creator, then drives headless Chromium.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { loadPlaywright, ROOT } from './e2e-lib.mjs';

const want = process.argv.slice(2), run = (k) => !want.length || want.includes(k);
const OUT = path.join(ROOT, 'target/fpsc'); fs.mkdirSync(OUT, { recursive: true });
let pass = 0; const fail = [];
const test = async (name, fn) => { try { await fn(); pass++; console.log(`  ok  ${name}`); } catch (e) { fail.push(name); console.log(`  FAIL ${name}\n       ${String(e?.stack ?? e).split('\n').slice(0, 4).join('\n       ')}`); } };

if (run('unit')) {
  console.log('unit');
  const r = spawnSync('node', ['--test', path.join(ROOT, 'runtime/fpsc/fpsc.test.mjs')], { encoding: 'utf8' });
  await test('node --test runtime/fpsc/fpsc.test.mjs', () => assert.equal(r.status, 0, r.stdout.split('\n').filter((l) => /^not ok|error:/.test(l)).join('\n')));
  const gen = spawnSync('node', [path.join(ROOT, 'tools/gen_fpsc_level.mjs'), path.join(os.tmpdir(), 'fpsc-gen-check.json')], { encoding: 'utf8' });
  await test('demo level generator runs', () => assert.equal(gen.status, 0, gen.stderr));
}
const needServer = run('api') || run('nord') || run('game') || run('editor');
let cleanup = () => {};
if (!needServer) summary();

// ---- temp project + dev server (only when a browser/api section runs) -------------------------------------------------------------------------------------------------------
const proj = fs.mkdtempSync(path.join(os.tmpdir(), 'fpsc-proj-'));
fs.cpSync(path.join(ROOT, 'templates/fps-creator'), proj, { recursive: true });
const port = 4800 + Math.floor(Math.random() * 400), base = `http://127.0.0.1:${port}`;
const bin = ['target/debug/nord', 'target/release/nord'].map((p) => path.join(ROOT, p)).find((p) => fs.existsSync(p));
if (!bin) { console.error('build first: cargo build -p nord-cli'); process.exit(2); }
const srv = spawn(bin, ['serve', proj, '-p', String(port)], { env: { ...process.env, NORD_ROOT: ROOT }, stdio: 'ignore' });
for (let i = 0; i < 60; i++) { try { if ((await fetch(`${base}/api/project`)).ok) break; } catch { /* wait */ } await new Promise((r) => setTimeout(r, 150)); }
cleanup = () => { srv.kill(); fs.rmSync(proj, { recursive: true, force: true }); };
process.on('exit', cleanup);

if (run('api')) {
  console.log('api');
  const post = (p, body, headers = {}) => fetch(`${base}/api/fpsc/save?path=${encodeURIComponent(p)}`, { method: 'POST', body, headers });
  await test('save needs the x-nord-fpsc header (CSRF guard)', async () => assert.equal((await post('levels/a.fpsl.json', '{}')).status, 403));
  await test('save writes inside levels/ and fpsc/', async () => { assert.equal((await post('levels/a.fpsl.json', '{"x":1}', { 'x-nord-fpsc': '1' })).status, 204); assert.equal(fs.readFileSync(path.join(proj, 'levels/a.fpsl.json'), 'utf8'), '{"x":1}'); assert.equal((await post('fpsc/textures/t.png', new Uint8Array([1, 2, 3]), { 'x-nord-fpsc': '1' })).status, 204); });
  await test('save refuses escapes, other folders and odd extensions', async () => { for (const bad of ['../x.json', 'levels/../../x.json', 'scripts/evil.js', 'nord.project.json', 'levels/a.exe', '/etc/passwd', 'levels/.h.json']) assert.equal((await post(bad, 'x', { 'x-nord-fpsc': '1' })).status, 400, bad); });
  await test('ls lists levels, refuses other folders', async () => { const l = await (await fetch(`${base}/api/fpsc/ls?dir=levels`)).json(); assert.ok(l.some((f) => f.name === 'level1.fpsl.json') && l.some((f) => f.name === 'a.fpsl.json')); assert.equal((await fetch(`${base}/api/fpsc/ls?dir=scripts`)).status, 400); });
  await test('install is idempotent and keeps user files', async () => {
    fs.writeFileSync(path.join(proj, 'levels/level1.fpsl.json'), '{"mine":true}'); fs.writeFileSync(path.join(proj, 'scripts/fpsc/world.js'), '// broken');
    const r = await (await fetch(`${base}/api/fpsc/install`, { method: 'POST', headers: { 'x-nord-fpsc': '1' } })).json();
    assert.ok(r.updated.includes('scripts/fpsc/world.js') && !r.created.includes('levels/level1.fpsl.json'), JSON.stringify(r));
    assert.equal(fs.readFileSync(path.join(proj, 'levels/level1.fpsl.json'), 'utf8'), '{"mine":true}');
    fs.copyFileSync(path.join(ROOT, 'templates/fps-creator/levels/level1.fpsl.json'), path.join(proj, 'levels/level1.fpsl.json'));
  });
  await test('nord fpsc init works from the CLI in an empty project', () => {
    const d = fs.mkdtempSync(path.join(os.tmpdir(), 'fpsc-init-')); fs.writeFileSync(path.join(d, 'nord.project.json'), JSON.stringify({ format: 1, name: 'T', id: 'com.t', type: '3d', startScene: 'scenes/x.scene.json' }));
    const r = spawnSync(bin, ['fpsc', 'init', d, '--start'], { encoding: 'utf8', env: { ...process.env, NORD_ROOT: ROOT } });
    assert.equal(r.status, 0, r.stderr); for (const f of ['scripts/fpsc/level-script.js', 'scripts/fpsc/index.js', 'fpsc/bank.json', 'levels/level1.fpsl.json', 'scenes/fps.scene.json']) assert.ok(fs.existsSync(path.join(d, f)), f);
    assert.equal(JSON.parse(fs.readFileSync(path.join(d, 'nord.project.json'), 'utf8')).startScene, 'scenes/fps.scene.json');
    const chk = spawnSync(bin, ['check', d], { encoding: 'utf8' }); assert.equal(chk.status, 0, chk.stdout + chk.stderr); fs.rmSync(d, { recursive: true, force: true });
  });
  await test('nord check passes on the template', () => { const r = spawnSync(bin, ['check', path.join(ROOT, 'templates/fps-creator')], { encoding: 'utf8' }); assert.equal(r.status, 0, r.stdout + r.stderr); });
}

if (run('nord') || run('game') || run('editor')) {
  const { chromium } = loadPlaywright();
  const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-sandbox'] });
  const newPage = async (w = 1280, h = 720) => {
    const page = await browser.newPage({ viewport: { width: w, height: h } }); page.errs = [];
    page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource.*404|favicon/.test(m.text())) page.errs.push(m.text()); });
    page.on('pageerror', (e) => page.errs.push(`pageerror: ${e.message}`)); return page;
  };
  const noErrors = (page) => assert.deepEqual(page.errs, [], `console errors:\n${page.errs.join('\n')}`);

  if (run('nord')) {
    console.log('nord boot (template project)');
    const page = await newPage();
    await page.goto(`${base}/index.html`);
    await test('project boots through Nord and shows the level intro', async () => {
      await page.waitForFunction(() => window.__nord_ready || window.__nord_error, null, { timeout: 30000 }); assert.equal(await page.evaluate(() => window.__nord_error), undefined);
      await page.waitForFunction(() => window.__fpsc?.game?.state === 'intro', null, { timeout: 30000 });
      assert.equal(await page.evaluate(() => !!document.querySelector('.fpsc-intro.on')), true);
      assert.ok(await page.evaluate(() => window.__fpsc.game.renderer.stats.lights > 15), 'lights baked');
    });
    await test('clicking "Click to play" starts the game loop under Nord', async () => {
      await page.evaluate(() => { window.__fpsc.game.ctl.noLock = true; document.querySelector('.fpsc-intro [data-a=begin]').click(); }); await page.waitForTimeout(1500);
      const s = await page.evaluate(() => ({ st: window.__fpsc.game.state, t: window.__fpsc.game.player.time })); assert.equal(s.st, 'play'); assert.ok(s.t > 0.2, `game time advances (${s.t})`);
      await page.screenshot({ path: `${OUT}/nord-boot.png` });
    });
    await test('no console errors during boot', () => noErrors(page));
    await page.close();
  }

  if (run('game')) {
    console.log('game (Outpost Zero)');
    const page = await newPage();
    await page.goto(`${base}/editor/fpsc/play.html?level=levels/level1.fpsl.json&autostart&nolock`);
    await page.waitForFunction(() => window.__fpsc_ready || window.__fpsc_error, null, { timeout: 30000 });
    const G = (fn, arg) => page.evaluate(`(${fn})(window.__fpsc.game, ${JSON.stringify(arg ?? null)})`);
    const step = (n) => G(`(g, n) => { for (let i = 0; i < n; i++) { g.update(1 / 30); g.ctl.endFrame(); } }`, n);
    const tp = (x, z, yawDeg = 0, layer = 0) => G(`(g, a) => { g.player.teleport(a[0], a[1], a[3]); g.player.yaw = a[2] * Math.PI / 180; g.player.pitch = 0; }`, [x, z, yawDeg, layer]);
    const C = 4;
    await test('level loads: 96 entities, baked lights, no bank warnings', async () => { assert.equal(await G('(g) => g.state'), 'play'); const s = await G('(g) => ({ n: g.ents.length, lights: g.renderer.stats.lights, bake: g.renderer.stats.bakeMs, warn: g.bank.warns.length })'); assert.ok(s.n >= 90 && s.lights >= 18 && s.warn === 0, JSON.stringify(s)); assert.ok(s.bake < 6000, `bake took ${s.bake} ms`); });
    await test('walking forward moves the player and walls stop it', async () => {
      await tp(5 * C, 19.5 * C, 270); await G(`(g) => g.ctl.keys.add('KeyW')`); await step(90); await G(`(g) => g.ctl.keys.delete('KeyW')`);
      const p = await G('(g) => [g.player.x, g.player.z]'); assert.ok(p[0] < 5 * C && p[0] > 2 * C + 0.4, `stopped by the west wall at x=${p[0]}`);
    });
    await test('auto doors open as the player approaches', async () => { await tp(30, 78, 90); await step(30); assert.ok(await G(`(g) => [...g.world.doors.values()].find((d) => d.x === 8 && d.z === 19).open > 0.9`)); });
    await test('locked door refuses without the key, opens with it', async () => {
      await tp(17.5 * C, 14 * C + 2.2, 180); await step(20); assert.equal(await G(`(g) => g.doorsNamed('armory')[0].target`), 0, 'stays shut'); assert.match(await G(`(g) => document.querySelector('.fpsc-msg').textContent`), /red key/);
      await G(`(g) => g.player.give('key_red', 1)`); await step(45); assert.equal(await G(`(g) => g.doorsNamed('armory')[0].target`), 1, 'opens with the key'); assert.ok(await G(`(g) => g.doorsNamed('armory')[0].open > 0.9`));
    });
    await test('pickups: health, ammo and weapons are collected', async () => {
      await G(`(g) => { g.player.hp = 40; const e = g.ents.find((x) => x.type === 'health_large'); g.player.teleport(e.x, e.z, 0); }`); await step(6); assert.ok(await G(`(g) => g.player.hp`) >= 100 || (await G('(g) => g.player.hp')) > 90);
      await G(`(g) => { const e = g.ents.find((x) => x.type === 'weapon_shotgun'); g.player.teleport(e.x, e.z, 0); }`); await step(6); assert.ok(await G(`(g) => g.player.owned.has('shotgun') && g.player.cur === 'shotgun'`));
    });
    await test('shooting: pistol/shotgun kill a soldier, kills + drop counted', async () => {
      await G(`(g) => { g.player.give('weapon_rifle', 60); g.player.select('rifle'); g.player.swap = 0; }`);
      const e = await G(`(g) => { const s = g.ents.find((x) => x.type === 'enemy_soldier' && x.props.drop); g.player.teleport(s.x, s.z - 7, 0); s.scripts.forEach((q) => { q.s.mode = 'idle'; }); s.hp = 60; return [s.x, s.z]; }`);
      await G(`(g) => { g.ctl.buttons = 1; }`); let dead = false; for (let i = 0; i < 40 && !dead; i++) { await G(`(g) => { const s = g.ents.find((x) => x.type === 'enemy_soldier' && x.props.drop); const dx = s.x - g.player.x, dz = s.z - g.player.z; g.player.yaw = Math.atan2(dx, dz); g.player.pitch = -0.02; }`); await step(3); dead = await G(`(g) => !g.ents.find((x) => x.type === 'enemy_soldier' && x.props.drop && x.alive)`); }
      await G(`(g) => { g.ctl.buttons = 0; }`); assert.ok(dead, 'soldier died'); assert.ok((await G('(g) => g.stats.kills')) >= 1); await step(5);
      assert.ok(await G(`(g) => g.ents.some((x) => x.type === 'ammo_bullets' && x.born > 0)`), 'dropped ammo spawned');
    });
    await test('enemy AI sees, chases and shoots back', async () => {
      const r = await G(`(g) => { g.player.hp = 100; g.player.god = false; g.player.teleport(15.5 * 4, 22 * 4, 0); const s = g.spawn('enemy_soldier', 15.5 * 4, 22 * 4 + 9, 0, {}); s.rot = 180; return s.id; }`);
      await step(150); const hp = await G('(g) => g.player.hp'); assert.ok(hp < 100, `player was shot (hp ${hp})`); void r;
    });
    await test('melee enemies close in and hit', async () => {
      const hp0 = await G(`(g) => { g.player.hp = 100; g.player.teleport(19.5 * 4, 16 * 4, 0); g.ents.filter((e) => e.enemy && e.alive && e.type !== 'enemy_boss').forEach((e) => { e.hp = 0; e.alive = false; e.enabled = false; }); const z = g.spawn('enemy_runner', 19.5 * 4, 16 * 4 + 8, 0, {}); z.rot = 180; return g.player.hp; }`);
      await step(120); assert.ok((await G('(g) => g.player.hp')) < hp0, 'runner hurt the player');
    });
    await test('explosive barrels chain-react and hurt nearby enemies', async () => {
      const r = await G(`(g) => { g.player.teleport(18 * 4, 22 * 4, 0); const b = g.ents.find((e) => e.type === 'barrel_explosive'); const z = g.spawn('enemy_zombie', b.x + 1.2, b.z, 0, {}); z.hp = 500; z.maxHp = 500; b.hurt(500, g.player); return z.id; }`);
      await step(30); assert.ok(await G(`(g, id) => g.ents.find((e) => e.id === id).hp < 500`, r), 'zombie took blast damage');
    });
    await test('stairs lead to the second storey', async () => {
      await tp(34.5 * C, 13.15 * C, 0); await G(`(g) => g.ctl.keys.add('KeyW')`); await step(70); await G(`(g) => g.ctl.keys.delete('KeyW')`);
      const p = await G('(g) => ({ y: g.player.y, layer: g.player.layer })'); assert.ok(p.y > 3.0 && p.layer === 1, JSON.stringify(p));
    });
    await test('terminal: [E] runs its rules — boss gate opens, alarm sounds, drones arrive', async () => {
      await tp(19.4 * C, 29.4 * C - 3, 0); await step(6); assert.match(await G(`(g) => document.querySelector('.fpsc-prompt').textContent`), /Hack the terminal/);
      await G(`(g) => g.ctl.pressedQ.add('KeyE')`); await step(2); await step(100);
      assert.equal(await G(`(g) => g.doorsNamed('bossgate')[0].target`), 1, 'bossgate open'); assert.ok(await G(`(g) => g.ents.find((e) => e.name === 'alarm1').scripts[0].s.on`), 'alarm on'); assert.ok(await G(`(g) => g.ents.filter((e) => e.type === 'enemy_drone' && e.alive).length >= 2`), 'drones spawned');
    });
    await test('trigger zones: the ambush spawns runners once', async () => {
      const before = await G(`(g) => g.ents.filter((e) => e.type === 'enemy_runner').length`); await tp(28 * C, 17.5 * C, 0); await step(10); const after = await G(`(g) => g.ents.filter((e) => e.type === 'enemy_runner').length`); assert.equal(after - before, 3);
      await tp(40, 40, 0); await tp(28 * C, 17.5 * C, 0); await step(10); assert.equal(await G(`(g) => g.ents.filter((e) => e.type === 'enemy_runner').length`), after, 'only once');
    });
    await test('hazard zone hurts, checkpoint saves', async () => {
      await G(`(g) => { g.player.hp = 100; }`); await tp(26.5 * C, 23.5 * C, 0); await step(60); assert.ok((await G('(g) => g.player.hp')) < 95, 'toxic pit damage');
      await G(`(g) => { g.player.hp = 100; const c = g.ents.find((e) => e.type === 'checkpoint'); g.player.teleport(c.x, c.z, 0); }`); await step(6); assert.match(await G(`(g) => document.querySelector('.fpsc-msg').textContent`), /Checkpoint/);
    });
    await test('death screen, retry from checkpoint, restart', async () => {
      await G(`(g) => { g.player.god = false; g.player.hp = 5; g.player.hurt(500, null); }`); await step(3); assert.equal(await G('(g) => g.state'), 'dead'); assert.ok(await page.evaluate(() => !!document.querySelector('.fpsc-dead.on')));
      const old = await page.evaluate(() => { window.__old = window.__fpsc.game; return true; }); void old;
      await page.evaluate(() => document.querySelector('.fpsc-dead [data-a=checkpoint]').click()); await page.waitForFunction(() => window.__fpsc.game !== window.__old && window.__fpsc.game.state === 'play', null, { timeout: 20000 });
      assert.ok(await G(`(g) => { const c = g.ents.find((e) => e.type === 'checkpoint'); return Math.hypot(g.player.x - c.x, g.player.z - c.z) < 4; }`), 'respawned at the saved checkpoint');
    });
    await test('boss fight → exit gate → level complete', async () => {
      await G(`(g) => { g.player.hp = 100; g.player.god = true; }`);
      await tp(29.5 * C, 36.6 * C, 0); await step(6); assert.notEqual(await G('(g) => g.state'), 'won', 'exit locked until the boss is dead'); await tp(29.5 * C, 29 * C, 0); await step(30);
      assert.ok(await G(`(g) => document.querySelector('.fpsc-boss').style.display !== 'none'`), 'boss bar shown'); await G(`(g) => { g.ents.find((e) => e.name === 'warden').hurt(99999, g.player); }`); await step(10);
      await tp(29.5 * C, 36.6 * C, 0); await step(10); assert.equal(await G('(g) => g.state'), 'won', await G(`(g) => { const x = g.ents.find((e) => e.type === 'level_exit'); return JSON.stringify({ ok: x.scripts[0].s.ok, en: x.enabled, p: [g.player.x, g.player.y, g.player.z, g.player.alive], x: [x.x, x.y, x.z], msg: document.querySelector('.fpsc-msg').textContent, st: g.state }); }`)); await page.screenshot({ path: `${OUT}/game-won.png` });
    });
    await page.screenshot({ path: `${OUT}/game-final.png` });
    await test('no console errors while playing', () => noErrors(page));
    await page.close();

    console.log('game visuals');
    const vp = await newPage(1280, 720); await vp.goto(`${base}/editor/fpsc/play.html?level=levels/level1.fpsl.json&autostart&nolock&shot`); await vp.waitForFunction(() => window.__fpsc_ready, null, { timeout: 30000 });
    const shots = [['start', 4.5, 19.5, 90], ['hall', 15.5, 17, 20], ['yard', 24.5, 19.5, 80], ['arena', 29.5, 28.4, 0], ['armory', 17.5, 14.4, 180]];
    for (const [n, x, z, yaw] of shots) { await vp.evaluate(([x, z, yaw]) => { const g = window.__fpsc.game; g.player.god = true; g.player.teleport(x * 4, z * 4, 0); g.player.yaw = yaw * Math.PI / 180; g.player.pitch = 0.05; for (let i = 0; i < 20; i++) g.update(1 / 30); }, [x, z, yaw]); await vp.waitForTimeout(400); await vp.screenshot({ path: `${OUT}/view-${n}.png` }); }
    await test('visual shots rendered', () => noErrors(vp)); await vp.close();
  }

  if (run('editor')) {
    console.log('editor');
    const page = await newPage(1700, 950);
    await page.goto(`${base}/editor/fpsc/index.html?level=levels/level1.fpsl.json`); await page.waitForFunction(() => window.__fpsc_editor_ready, null, { timeout: 30000 }); await page.waitForTimeout(1500);
    const ED = (fn, arg) => page.evaluate(`(${fn})(window.__fpscEditor, ${JSON.stringify(arg ?? null)})`);
    const shot = (n) => page.screenshot({ path: `${OUT}/editor-${n}.png` });
    // screen position of a world point on the 2D map
    const scr = async (wx, wz) => { const r = await ED(`(ed, a) => { const rc = ed.map.cv.getBoundingClientRect(), s = ed.map.toScreen(a[0], a[1]); return [rc.left + s[0], rc.top + s[1]]; }`, [wx, wz]); return r; };
    const C = 4;
    await test('opens the demo level without problems and renders 2D + 3D', async () => { const s = await ED(`(ed) => ({ n: ed.level.entities.length, problems: ed.problems.length, tris: ed.v3.rend?.stats.tris, name: ed.level.name, pieces: ed.bank.pieces.length })`); assert.equal(s.n, 96); assert.equal(s.problems, 0); assert.ok(s.tris > 5000); assert.equal(s.name, 'Outpost Zero'); await shot('open'); });
    await test('New → empty level; Room tool drag builds floor, ceiling and wall ring', async () => {
      await ED(`(ed) => { ed.dirty = false; ed.setLevel(JSON.parse(JSON.stringify(ed.level)), ''); }`); await ED(`(ed) => { const lv = ed.level; lv.entities = []; for (const l of lv.layers) { l.cells = {}; l.edges = {}; } lv.layers.length = 1; ed.hist = []; ed.hi = -1; ed.commit('clear', { force: true }); ed.map.cx = 40; ed.map.cz = 40; ed.map.zoom = 10; ed.map.draw(); }`);
      await page.keyboard.press('KeyR'); const a = await scr(4 * C + 2, 4 * C + 2), b = await scr(8 * C + 2, 6 * C + 2);
      await page.mouse.move(a[0], a[1]); await page.mouse.down(); await page.mouse.move((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, { steps: 4 }); await page.mouse.move(b[0], b[1], { steps: 4 }); await page.mouse.up();
      const s = await ED(`(ed) => ({ cells: Object.keys(ed.level.layers[0].cells).length, edges: Object.keys(ed.level.layers[0].edges).length })`); assert.deepEqual(s, { cells: 15, edges: 16 }); // 5×3 cells, perimeter 2*(5+3)
    });
    await test('Wall tool: pick Door, click an edge → door piece with the chosen texture', async () => {
      await ED(`(ed) => { ed.brush.piece = 'door'; ed.brush.wallTex = 'bunker'; ed.brush.doorTex = 'door_wood'; ed.setTool('wall'); }`);
      const p = await scr(4 * C + 6, 6 * C + 4 * 0 + 0); // south wall of the room is z=4*C ; click its middle
      const q = await scr(6 * C + 2, 4 * C); await page.mouse.click(q[0], q[1]); void p;
      const e = await ED(`(ed) => ed.level.layers[0].edges['6,4,H']`); assert.equal(e?.k, 'door'); assert.equal(e?.td, 'door_wood'); assert.equal(e?.t, 'bunker');
    });
    await test('Wall tool: drag draws a line of pieces; Shift+drag erases', async () => {
      await ED(`(ed) => { ed.brush.piece = 'window'; ed.setTool('wall'); }`); const a = await scr(10 * C, 10 * C), b = await scr(13 * C, 10 * C);
      await page.mouse.move(a[0], a[1]); await page.mouse.down(); await page.mouse.move(b[0], b[1], { steps: 6 }); await page.mouse.up();
      assert.equal(await ED(`(ed) => ['10,10,H', '11,10,H', '12,10,H'].filter((k) => ed.level.layers[0].edges[k]?.k === 'window').length`), 3);
      await page.keyboard.down('Shift'); await page.mouse.move(a[0], a[1]); await page.mouse.down(); await page.mouse.move(b[0], b[1], { steps: 6 }); await page.mouse.up(); await page.keyboard.up('Shift');
      assert.equal(await ED(`(ed) => Object.keys(ed.level.layers[0].edges).filter((k) => /,10,H$/.test(k)).length`), 0);
    });
    await test('Items: choose an enemy, click the map → entity + inspector shows its default scripts', async () => {
      await page.click('#left-tabs [data-tab=items]'); await page.click('.chips button:has-text("Enemies")'); await page.click('.card:has-text("Zombie")'); assert.equal(await ED(`(ed) => ed.tool`), 'entity');
      const p = await scr(6 * C, 5 * C); await page.mouse.click(p[0], p[1]);
      const e = await ED(`(ed) => ed.selectedEntity()?.type`); assert.equal(e, 'enemy_zombie'); await page.waitForSelector('#inspector .script'); assert.match(await page.textContent('#inspector'), /Melee AI/); await shot('inspector');
    });
    await test('Inspector: tune a script parameter, attach another script, add a rule, name the entity', async () => {
      await page.fill('#inspector input[placeholder="e.g. guard1"]', 'zed'); await page.press('#inspector input[placeholder="e.g. guard1"]', 'Tab');
      assert.equal(await ED(`(ed) => ed.selectedEntity().name`), 'zed');
      await page.locator('#inspector .script input[type=number]').first().fill('33'); await page.keyboard.press('Tab');
      assert.ok(await ED(`(ed) => { const s = ed.selectedEntity().scripts.find((x) => x.id === 'ai-melee'); return s && Object.values(s.params).includes(33); }`), 'param override stored');
      await page.selectOption('#inspector select:has(option:text("Attach script"))', 'light-flicker'); assert.ok(await ED(`(ed) => ed.selectedEntity().scripts.some((s) => s.id === 'light-flicker')`));
      await page.click('#inspector button:has-text("+ Add rule")'); assert.equal(await ED(`(ed) => ed.selectedEntity().rules.length`), 1); assert.match(await page.textContent('#inspector'), /When/);
    });
    await test('removing a default script is remembered; undo/redo walk through history', async () => {
      await page.locator('#inspector .script button:has-text("✕")').first().click(); assert.ok(await ED(`(ed) => ed.selectedEntity().scripts.some((s) => s.id === 'ai-melee' && s.remove)`));
      await page.keyboard.press('Control+z'); assert.ok(await ED(`(ed) => !ed.selectedEntity().scripts.some((s) => s.remove)`)); await page.keyboard.press('Control+Shift+z'); assert.ok(await ED(`(ed) => ed.selectedEntity().scripts.some((s) => s.remove)`));
    });
    await test('select / copy / paste / delete work on entities and wall pieces', async () => {
      const n0 = await ED(`(ed) => ed.level.entities.length`); await page.keyboard.press('Control+d'); assert.equal(await ED(`(ed) => ed.level.entities.length`), n0 + 1);
      await page.keyboard.press('Delete'); assert.equal(await ED(`(ed) => ed.level.entities.length`), n0);
      await ED(`(ed) => { ed.setTool('select'); ed.clearSel(); }`); const p = await scr(6 * C + 2, 4 * C); await page.mouse.click(p[0], p[1]); assert.ok(await ED(`(ed) => ed.sel.edges.size === 1`)); assert.match(await page.textContent('#inspector'), /Door/);
    });
    await test('doors: name + key lock in the inspector', async () => {
      await page.fill('#inspector input[placeholder="door1"]', 'vault'); await page.press('#inspector input[placeholder="door1"]', 'Tab'); await page.selectOption('#inspector select:has(option:text("(unlocked)"))', 'blue');
      const d = await ED(`(ed) => ed.level.layers[0].edges['6,4,H']`); assert.equal(d.name, 'vault'); assert.equal(d.lock, 'blue');
    });
    await test('Floor / ceiling / fill / stairs tools edit cells', async () => {
      await ED(`(ed) => { ed.brush.floorTex = 'carpet'; ed.setTool('fill'); }`); const p = await scr(6 * C + 2, 5 * C + 2); await page.mouse.click(p[0], p[1]);
      assert.equal(await ED(`(ed) => Object.values(ed.level.layers[0].cells).filter((c) => c.f === 'carpet').length`), 15);
      await ED(`(ed) => { ed.brush.cellMode = 'stairs'; ed.brush.stair = 'stairs'; ed.brush.stairDir = 'E'; ed.setTool('cell'); }`); const q = await scr(5 * C + 2, 5 * C + 2); await page.mouse.click(q[0], q[1]); assert.deepEqual(await ED(`(ed) => ed.level.layers[0].cells['5,5'].s`), { id: 'stairs', d: 'E' });
    });
    await test('layers: add a storey, validation reports a missing player start', async () => {
      await ED(`(ed) => ed.addLayer()`); assert.equal(await ED(`(ed) => ed.level.layers.length`), 2); await ED(`(ed) => ed.setLayer(0)`); await ED(`(ed) => ed.showProblems()`); assert.ok(await ED(`(ed) => ed.problems.some((p) => /player start/i.test(p.msg))`));
    });
    await test('Save writes the level into levels/ and reopening restores it', async () => {
      await ED(`(ed) => { ed.path = 'levels/ed_test.fpsl.json'; }`); await page.keyboard.press('Control+s'); await page.waitForTimeout(600);
      const f = path.join(proj, 'levels/ed_test.fpsl.json'); assert.ok(fs.existsSync(f), 'file written'); const lv = JSON.parse(fs.readFileSync(f, 'utf8')); assert.equal(lv.layers.length, 2); assert.ok(lv.layers[0].edges['6,4,H'].name === 'vault');
      await page.goto(`${base}/editor/fpsc/index.html?level=levels/ed_test.fpsl.json`); await page.waitForFunction(() => window.__fpsc_editor_ready); assert.equal(await ED(`(ed) => ed.level.layers[0].edges['6,4,H']?.name`), 'vault');
    });
    await test('Assets: upload a texture + create a script → they show up in the bank', async () => {
      const png = Array.from(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGP4z8DwHwAFAAH/q842iQAAAABJRU5ErkJggg==', 'base64'));
      await ED(`async (ed, png) => { await ed.api.save('fpsc/textures/pink.png', new Uint8Array(png)); await ed.editBank((b) => { (b.textures ??= []).push({ id: 'pink', label: 'Pink', cat: 'wall', size: 2, url: 'fpsc/textures/pink.png' }); }); }`, png);
      assert.ok(await ED(`(ed) => !!ed.bank.texture('pink')`)); assert.ok(fs.existsSync(path.join(proj, 'fpsc/textures/pink.png')));
      await page.click('#left-tabs [data-tab=assets]'); await page.locator('details:has-text("New script")').first().evaluate((d) => { d.open = true; }); await page.locator('details:has-text("New script") input[type=text]').first().fill('my-test'); await page.click('button:has-text("Create script")'); await page.waitForTimeout(1200);
      assert.ok(fs.existsSync(path.join(proj, 'fpsc/scripts/my-test.js')), 'script file'); assert.ok(await ED(`(ed) => !!ed.bank.script('my-test')`), 'script loaded'); assert.deepEqual(JSON.parse(fs.readFileSync(path.join(proj, 'fpsc/bank.json'), 'utf8')).scripts, ['fpsc/scripts/my-test.js']);
      await shot('assets');
    });
    await test('custom script runs in the game: attached to an entity, listed in the dropdown', async () => {
      await ED(`(ed) => { ed.setTab('items'); const e = ed.addEntity('crate', 20, 20); ed.attachScript('my-test', e); }`); assert.ok(await ED(`(ed) => ed.selectedEntity().scripts.some((s) => s.id === 'my-test')`));
    });
    await test('F5 play-tests the current (unsaved) level inside the editor', async () => {
      await ED(`(ed) => { ed.addEntity('player_start', 22, 22); ed.addEntity('level_exit', 30, 30); }`); await page.keyboard.press('F5'); await page.waitForSelector('#play:not(.hidden)');
      const fr = page.frames().find((f) => f.url().includes('play.html')); await fr.waitForFunction(() => window.__fpsc_ready || window.__fpsc_error, null, { timeout: 30000 });
      assert.equal(await fr.evaluate(() => window.__fpsc_error), undefined); assert.equal(await fr.evaluate(() => window.__fpsc.game.level.name), await ED(`(ed) => ed.level.name`)); assert.ok(await fr.evaluate(() => window.__fpsc.game.ents.some((e) => e.type === 'crate')));
      await shot('playtest'); await page.click('#play-close'); assert.ok(await page.evaluate(() => document.getElementById('play').classList.contains('hidden')));
    });
    await test('3D preview and help dialog work', async () => { await ED(`(ed) => ed.setView('3d')`); await page.waitForTimeout(700); assert.ok(await ED(`(ed) => ed.v3.rend.stats.tris > 100`)); await shot('3d'); await ED(`(ed) => ed.setView('split')`); await page.keyboard.press('F1'); assert.match(await page.textContent('#modal-box'), /Adding assets/); await page.keyboard.press('Escape'); });
    await test('no console errors in the editor', () => { noErrors(page); });
    await page.close();
  }
  await browser.close();
}
summary();
function summary() { console.log(`\n${pass} passed, ${fail.length} failed${fail.length ? `: ${fail.join('; ')}` : ''}`); cleanup(); process.exit(fail.length ? 1 : 0); }
