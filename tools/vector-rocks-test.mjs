#!/usr/bin/env node
// Plays examples/vector-rocks in headless Chromium: boot, fly, shoot, split rocks, collect every power-up, die, game over, restart, hi-score.
// Writes docs/screenshots/vector-rocks-*.png.   usage: node tools/vector-rocks-test.mjs
import fs from 'node:fs';
import assert from 'node:assert/strict';
import { withPage, waitReady, ROOT } from './e2e-lib.mjs';

const OUT = `${ROOT}/docs/screenshots`;
const wait = (p, ms) => p.waitForTimeout(ms);
const ev = (p, fn, a) => p.evaluate(fn, a);
// Software rendering in headless Chromium makes the bloom layer and scanline overlay slow (the game clock crawls), so the test plays with both
// off and switches them on (with the game paused) only for the screenshots.
const look = (p, on) => ev(p, (on) => {
  const g = window.__nord;
  if (on) g.effects.addAll('scene', g.scene.settings.effects); else g.effects.clear('scene');
  for (const el of document.querySelectorAll('.nord-panel')) { if (on && el.dataset.bf) el.style.backdropFilter = el.dataset.bf; if (!on && el.style.backdropFilter) { el.dataset.bf = el.style.backdropFilter; el.style.backdropFilter = 'none'; } }
}, on);
const fxOff = (p) => look(p, false);
const shot = async (p, n) => {
  await ev(p, () => window.__nord.pause()); await look(p, true);
  await wait(p, 1200);
  await p.screenshot({ path: `${OUT}/vector-rocks-${n}.png` });
  await look(p, false); await ev(p, () => window.__nord.resume());
};
const count = (p, tag) => ev(p, (t) => window.__nord.scene.findByTag(t).length, tag);
const hold = async (p, k, ms) => { await p.keyboard.down(k); await wait(p, ms); await p.keyboard.up(k); };
const ship = (p) => ev(p, () => { const s = window.__nord.scene.find('Ship'); return { pos: [...s.pos], rot: s.rot[2], on: s.enabled }; });
const gameState = (p) => ev(p, () => { const G = window.__nord.scene.find('Game').scripts[0]; return { score: G.score, lives: G.lives, wave: G.wave, over: G.over }; });
const spawnPU = (p, type) => ev(p, async (t) => { const s = window.__nord.scene.find('Ship'); await window.__nord.scene.spawn(`prefabs/pu-${t}.prefab.json`, { pos: [s.pos[0], s.pos[1], 2] }); }, type);

fs.mkdirSync(OUT, { recursive: true });
const { errors } = await withPage(`${ROOT}/examples/vector-rocks`, async (p) => {
  await waitReady(p); await p.click('canvas'); await fxOff(p); await wait(p, 3200);
  await shot(p, 'start');
  let g = await gameState(p);
  assert.equal(g.wave, 1, 'wave 1 started');
  assert.ok((await count(p, 'Rock')) >= 4, 'rocks in the sky');
  await ev(p, () => { window.__nord.scene.find('Ship').scripts[0].shieldLeft = 999; });   // rocks must not interrupt the flying lesson
  // fly: rotate and thrust
  const s0 = await ship(p);
  await hold(p, 'ArrowRight', 500);
  assert.ok((await ship(p)).rot > s0.rot + 30, 'turns right');
  await hold(p, 'ArrowUp', 800);
  const s1 = await ship(p);
  assert.ok(Math.hypot(s1.pos[0] - s0.pos[0], s1.pos[1] - s0.pos[1]) > 20, 'thrust moves the ship');
  // shoot a rock: park the nearest rock in front of the nose
  await ev(p, () => { const sc = window.__nord.scene, sh = sc.find('Ship'), r = sc.findByTag('Rock')[0]; const a = sh.rot[2] * Math.PI / 180; r.pos = [sh.pos[0] + Math.sin(a) * 120, sh.pos[1] - Math.cos(a) * 120, 1]; });
  const rocks0 = await count(p, 'Rock');
  await hold(p, 'Space', 250); await wait(p, 600);
  g = await gameState(p);
  assert.ok(g.score >= 20, `shot a rock (score ${g.score})`);
  assert.ok((await count(p, 'Rock')) >= rocks0, 'a large rock splits into two medium ones');
  await shot(p, 'fight');
  // power-ups (clear the sky first so a rock cannot kill the ship in the middle of the test)
  await ev(p, () => { for (const r of window.__nord.scene.findByTag('Rock')) r.destroy(); });
  await wait(p, 300);
  assert.equal((await ship(p)).on, true, 'ship alive');
  for (const t of ['shield', 'rapid', 'triple']) { await spawnPU(p, t); await wait(p, 400); }
  const ps = await ev(p, () => { const S = window.__nord.scene.find('Ship').scripts[0]; return [S.shieldLeft, S.rapidLeft, S.tripleLeft]; });
  assert.ok(ps.every((v) => v > 6), `all three timers running ${ps}`);
  await p.keyboard.down('Space'); await wait(p, 300); await shot(p, 'powered'); await p.keyboard.up('Space');
  // a staged picture for the tutorial: ship in the middle, rocks around it, a power-up drifting in, three shots in the air
  await ev(p, async () => {
    const sc = window.__nord.scene, S = sc.find('Ship');
    for (const r of sc.findByTag('Rock')) r.destroy();
    S.pos = [400, 330, 2]; S.rot = [0, 0, 35]; S.scripts[0].heading = 35; S.scripts[0].v.Set(0, 0);
    for (const [pf, x, y] of [['rock-large-0', 190, 190], ['rock-large-2', 640, 440], ['rock-medium-1', 590, 140], ['rock-medium-0', 220, 450], ['rock-small-1', 520, 250]]) { const e = await sc.spawn(`prefabs/${pf}.prefab.json`, { pos: [x, y, 1] }); e.scripts[0].velocity = { x: 0, y: 0 }; }
    await sc.spawn('prefabs/pu-nova.prefab.json', { pos: [330, 200, 2] });
  });
  await wait(p, 300);
  await ev(p, () => { const S = window.__nord.scene.find('Ship').scripts[0]; S.tripleLeft = 8; S.shieldLeft = 8; });
  await hold(p, 'Space', 160);
  await shot(p, 'showcase');
  // the effect comparison for the page: the same frozen frame with each monitor effect on its own
  const fxShot = async (name, effects, bloom) => {
    await ev(p, ([effects, bloom]) => {
      const g = window.__nord; g.pause(); g.effects.clear('scene'); if (effects.length) g.effects.addAll('scene', effects);
      for (const el of document.querySelectorAll('.nord-panel')) { if (el.dataset.bf === undefined && el.style.backdropFilter) el.dataset.bf = el.style.backdropFilter; if (el.dataset.bf) el.style.backdropFilter = bloom ? el.dataset.bf : 'none'; }
    }, [effects, bloom]);
    await wait(p, 1400);
    await p.screenshot({ path: `${OUT}/vector-rocks-fx-${name}.png`, clip: { x: 120, y: 60, width: 330, height: 260 } });
  };
  await fxShot('none', [], false);
  await fxShot('bloom', [], true);
  await fxShot('crt', [{ type: 'crt', intensity: 0.35 }], false);
  await fxShot('both', [{ type: 'crt', intensity: 0.35 }], true);
  await fxShot('vignette', [{ type: 'vignette', strength: 0.6, radius: 0.5 }], false);
  await fxShot('barrel', [{ type: 'barrel', amount: 0.5 }], false);
  await fxShot('glow', [{ type: 'glow', color: '#3dff7a', outerStrength: 6, innerStrength: 1 }], false);
  await look(p, false); await ev(p, () => window.__nord.resume());
  const before = (await gameState(p)).lives; await spawnPU(p, 'life'); await wait(p, 400);
  assert.equal((await gameState(p)).lives, before + 1, 'extra life');
  const rocksBefore = await count(p, 'Rock'); await spawnPU(p, 'nova'); await wait(p, 900);
  await shot(p, 'nova');
  // death: shield off, put a rock on the ship
  await ev(p, () => { const S = window.__nord.scene.find('Ship').scripts[0]; S.shieldLeft = 0; });
  await wait(p, 2500);
  const lives1 = (await gameState(p)).lives;
  await ev(p, async () => { const sc = window.__nord.scene, sh = sc.find('Ship'); await sc.spawn('prefabs/rock-small-0.prefab.json', { pos: [sh.pos[0], sh.pos[1], 1] }); });
  await wait(p, 600);
  assert.equal((await gameState(p)).lives, lives1 - 1, 'a rock kills the ship');
  assert.equal((await ship(p)).on, false, 'ship gone for a moment');
  await wait(p, 2200);
  assert.equal((await ship(p)).on, true, 'respawned');
  // game over
  for (let i = 0; i < 8 && !(await gameState(p)).over; i++) {
    await ev(p, () => { const S = window.__nord.scene.find('Ship').scripts[0]; S.shieldLeft = 0; S.safe = false; });
    await ev(p, async () => { const sc = window.__nord.scene, sh = sc.find('Ship'); await sc.spawn('prefabs/rock-small-0.prefab.json', { pos: [sh.pos[0], sh.pos[1], 1] }); });
    await wait(p, 3300);
  }
  assert.ok((await gameState(p)).over, 'game over');
  await shot(p, 'over');
  const hi = await ev(p, () => window.__nord.save.get('vectorrocks.hi', 0));
  assert.ok(hi >= 20, `hi-score saved (${hi})`);
  await p.keyboard.press('Enter'); await wait(p, 100); await hold(p, 'Enter', 120); await wait(p, 2500);
  g = await gameState(p);
  assert.ok(!g.over && g.lives === 3 && g.score === 0, 'restart resets the run');
});
const bad = [...new Set(errors)];
if (bad.length) { console.log('FAIL errors:\n' + bad.slice(0, 5).join('\n')); process.exit(1); }
console.log('ok   vector-rocks');
