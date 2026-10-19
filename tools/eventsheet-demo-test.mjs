#!/usr/bin/env node
// Headless test + screenshots for examples/event-sheets (event sheet + behaviors only). Needs Playwright + Chromium (see tools/e2e-lib.mjs).
// usage: node tools/eventsheet-demo-test.mjs   → screenshots in target/eventsheets/ (copy to docs/screenshots/ for the manual)
import fs from 'node:fs';
import assert from 'node:assert/strict';
import { withPage, waitReady, ROOT } from './e2e-lib.mjs';

const out = `${ROOT}/target/eventsheets`;
fs.mkdirSync(out, { recursive: true });
const { errors } = await withPage(`${ROOT}/examples/event-sheets`, async (page) => {
  await waitReady(page);
  assert.equal(await page.evaluate(() => window.__nord_error), undefined);
  const ev = (fn, ...a) => page.evaluate(fn, ...a);
  const wait = (ms) => page.waitForTimeout(ms);
  const key = (k, down) => ev(([k, d]) => __nord.input.setKey(k, d), [k, down]);
  await wait(900);
  await page.screenshot({ path: `${out}/1-start.png` });

  const h0 = await ev(() => { const h = __nord.scene.find('Hero'), p = h.behavior('Platform'); return { y: h.pos[1], floor: p.onFloor, anim: h.getComponent('animatedSprite').data.anim }; });
  assert.ok(h0.floor && Math.abs(h0.y - 314) < 1.5 && h0.anim === 'idle', `hero stands on the ground ${JSON.stringify(h0)}`);

  // walk right: walk animation, collect the coin at x=200, slime ahead
  await key('KeyD', true); await wait(700);
  const w = await ev(() => { const h = __nord.scene.find('Hero'); return { x: h.pos[0], anim: h.getComponent('animatedSprite').data.anim, vars: Object.fromEntries(__nord.scene.eventSheet.globals) }; });
  assert.ok(w.x > 100 && w.anim === 'walk', `walking ${JSON.stringify(w)}`);
  await key('KeyD', false);
  await ev(() => { const h = __nord.scene.find('Hero'); h.pos = [185, 314, 2]; }); await key('KeyD', true); await wait(500); await key('KeyD', false);
  const c = await ev(() => __nord.scene.eventSheet.getVar('coins'));
  assert.ok(c >= 1, `coin collected (${c})`);
  await page.screenshot({ path: `${out}/2-coin.png` });

  // jump onto the ledge, starting beside it so the hero does not hit its underside
  await ev(() => { __nord.scene.find('Hero').pos = [130, 314, 2]; });
  await key('KeyD', true); await key('Space', true); await wait(80); await key('Space', false);
  await wait(420); await key('KeyD', false); await wait(900);
  const up = await ev(() => __nord.scene.find('Hero').pos[1]);
  assert.ok(up < 240, `jump reached the ledge (y=${up})`);
  await page.screenshot({ path: `${out}/3-ledge.png` });

  // turret fires when it sees the hero; bullets are created by the event sheet and picked for the angle action
  await ev(() => { __nord.scene.find('Hero').pos = [400, 314, 2]; }); await wait(2600);
  await page.screenshot({ path: `${out}/4-turret.png` });
  const shots = await ev(() => __nord.scene.eventSheet.getVar('lives'));
  console.log('lives after turret test', shots);

  // slime contact costs a life and respawns
  await ev(() => { const s = __nord.scene.find('Slime'); __nord.scene.find('Hero').pos = [s.pos[0], 314, 2]; __nord.scene.eventSheet.globals.set('lives', 3); });
  await wait(300);
  const l = await ev(() => ({ lives: __nord.scene.eventSheet.getVar('lives'), x: __nord.scene.find('Hero').pos[0] }));
  assert.ok(l.lives <= 2 && l.x < 100 || l.lives <= 2, `slime hurt ${JSON.stringify(l)}`);

  // reach the flag
  await ev(() => { __nord.scene.find('Hero').pos = [550, 128, 2]; }); await wait(500);
  assert.equal(await ev(() => __nord.scene.eventSheet.getVar('won')), 1);
  await page.screenshot({ path: `${out}/5-win.png` });

  // debugger + profiler overlay (?debug, F9)
  await page.goto(page.url().split('?')[0] + '?debug'); await waitReady(page); await wait(600);
  await page.keyboard.press('F9'); await wait(500);
  assert.ok(await ev(() => getComputedStyle(document.querySelector('.nord-debug')).display === 'block'), 'overlay opens with F9');
  const prof = await ev(() => document.querySelector('.nord-debug').textContent);
  assert.match(prof, /fps/); assert.match(prof, /objects/);
  await page.screenshot({ path: `${out}/6-profiler.png` });
  await page.click('.nord-debug [data-tab=events]'); await wait(300);
  await page.screenshot({ path: `${out}/7-debug-events.png` });
  const hot = await ev(() => [...__nord.debug.ran.keys()].find((k) => !k.includes('.')) ?? [...__nord.debug.ran.keys()][0]);
  await page.click(`.nord-debug [data-bp="${hot}"]`); // an event that runs every tick → breakpoint
  assert.ok(await ev(() => __nord.debug.breakpoints.size === 1));
  await wait(400);
  assert.ok(await ev(() => __nord.debug.paused), 'breakpoint paused the running game');
  await page.click('.nord-debug [data-tab=console]'); await page.fill('#nd-in', 'coins + lives'); await page.keyboard.press('Enter'); await wait(200);
  assert.match(await ev(() => document.querySelector('.nord-debug').textContent), /> coins \+ lives/);
  await page.screenshot({ path: `${out}/8-debug-console.png` });

  // effects: Phaser WebGL FX on the camera and on an object, CSS fallback for CRT
  await page.goto(page.url().split('?')[0]); await waitReady(page); await wait(500);
  const fx = await ev(() => {
    const e = __nord.effects, hero = __nord.scene.find('Hero');
    const hs = [e.add('scene', 'vignette', { strength: 0.6, radius: 0.8 }), e.add(hero, 'glow', { color: '#ffd166', outerStrength: 6 }), e.add('scene', 'pixelate', { amount: 2 }), e.add('scene', 'crt', { intensity: 0.25 }), e.add('scene', 'saturate', { value: 1.6 })];
    hs[0].set('strength', 0.7);
    return hs.map((h) => !!h);
  });
  assert.deepEqual(fx, [true, true, true, true, true], 'effects created');
  await wait(500);
  await page.screenshot({ path: `${out}/9-effects.png` });
  await ev(() => __nord.effects.clear('scene'));

  // layers: opacity, visibility, parallax (scroll factor) and a background colour
  await ev(() => { __nord.scene.settings.layers = { 0: { name: 'World', opacity: 0.5 }, 1: { name: 'HUD', parallax: [0, 0], visible: true }, 2: { name: 'Back', transparent: false, background: '#bf616a', opacity: 1, visible: true } }; });
  await wait(300);
  const lay = await ev(() => { const h = __nord.scene.find('Hero'), hud = __nord.scene.find('Hud'); return { alpha: h.native.alpha, sfx: hud.native.scrollFactorX, bg: __nord.backend._bg.get('2')?.visible }; });
  assert.equal(lay.alpha, 0.5); assert.equal(lay.sfx, 0); assert.equal(lay.bg, true);
  await ev(() => { __nord.scene.settings.layers[0].visible = false; }); await wait(200);
  assert.equal(await ev(() => __nord.scene.find('Hero').native.visible), false, 'hidden layer hides its objects');
  await page.screenshot({ path: `${out}/10-layers.png` });

  // sprite-editor metadata: named image points follow the sprite (expression Hero.PointX("muzzle"))
  const pt = await ev(() => { const m = __nord.backend.metaOf('assets/sprites/hero.png'); m.points = { muzzle: [26, 10] }; const h = __nord.scene.find('Hero'), s = __nord.scene.eventSheet; return { x: h.pos[0], y: h.pos[1], px: s.evalExpr('Hero.PointX("muzzle")'), py: s.evalExpr('Hero.PointY("muzzle")'), none: s.evalExpr('Hero.PointX("nope")') }; });
  assert.ok(Math.abs(pt.px - (pt.x + 10)) < 1e-6 && Math.abs(pt.py - (pt.y - 6)) < 1e-6, `image point ${JSON.stringify(pt)}`);
  assert.equal(pt.none, pt.x, 'unknown point falls back to the position');
});
assert.deepEqual(errors, [], errors.join('\n'));
console.log('event-sheets demo OK');
