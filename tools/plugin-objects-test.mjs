#!/usr/bin/env node
// Headless test of the rendering plugin objects (tiledBackground, ninePatch, spriteFont, drawingCanvas, video). Screenshot: target/plugin-objects.png
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { withPage, waitReady, ROOT } from './e2e-lib.mjs';

const dir = `${ROOT}/target/plugin-objects-project`;
fs.rmSync(dir, { recursive: true, force: true });
fs.cpSync(`${ROOT}/examples/event-sheets`, dir, { recursive: true });
fs.rmSync(`${dir}/events`, { recursive: true, force: true });
fs.mkdirSync(`${dir}/assets/video`, { recursive: true });
execFileSync('ffmpeg', ['-v', 'error', '-y', '-f', 'lavfi', '-i', 'testsrc=size=160x90:rate=15', '-t', '2', '-c:v', 'libvpx', '-b:v', '200k', `${dir}/assets/video/test.webm`]);
fs.copyFileSync(`${ROOT}/assets/sprites/tileset_platformer.png`, `${dir}/assets/sprites/tileset_platformer.png`);
const hm = JSON.parse(fs.readFileSync(`${dir}/assets/sprites/hero.png.meta.json`, 'utf8')); hm.origin = [8, 16]; hm.anims.pp = { frames: [0, 1, 2], fps: 10, pingPong: true, frameDurations: [1, 3, 1] }; hm.anims.rt = { frames: [0, 1, 2, 3], fps: 10, repeatTo: 2 }; hm.frameProps = { 1: { event: 'stepped' } }; fs.writeFileSync(`${dir}/assets/sprites/hero.png.meta.json`, JSON.stringify(hm));
const sceneFile = `${dir}/scenes/main.scene.json`;
const scene = JSON.parse(fs.readFileSync(sceneFile, 'utf8'));
delete scene.settings.eventSheet;
const ent = (name, x, y, components) => ({ id: name.toLowerCase().padEnd(8, '0').slice(0, 8), name, enabled: true, tags: [], layer: 0, transform: { pos: [x, y, 20], rot: [0, 0, 0], scale: [1, 1, 1] }, components, scripts: [], children: [], prefab: null });
scene.entities = [
  ent('Tiles', 320, 60, [{ type: 'tiledBackground', texture: 'assets/sprites/tileset_platformer.png', size: [300, 80], scroll: [40, 0] }]),
  ent('Panel', 120, 200, [{ type: 'ninePatch', texture: 'assets/sprites/items/crate.png', size: [180, 70], slice: [8, 8, 8, 8], tint: '#88c0d0' }]),
  ent('Font', 500, 200, [{ type: 'spriteFont', texture: 'assets/sprites/tileset_platformer.png', frameSize: [16, 16], chars: 'ABCDEFGH', text: 'ABBA', spacing: 2, scale: 1.5 }]),
  ent('Paint', 320, 300, [{ type: 'drawingCanvas', size: [120, 60], color: '#2e3440' }]),
  ent('Pivot', 300, 250, [{ type: 'animatedSprite', texture: 'assets/sprites/hero.png', anim: 'idle' }]),
  ent('Anim', 100, 120, [{ type: 'animatedSprite', texture: 'assets/sprites/hero.png', anim: 'pp' }]),
  ent('Movie', 560, 60, [{ type: 'video', src: 'assets/video/test.webm', size: [160, 90], loop: true, muted: true }]),
];
fs.writeFileSync(sceneFile, JSON.stringify(scene));

const { errors } = await withPage(dir, async (page) => {
  await waitReady(page);
  assert.equal(await page.evaluate(() => window.__nord_error), undefined);
  const ev = (f, ...a) => page.evaluate(f, ...a);
  const x0 = await ev(() => __nord.scene.find('Tiles').getComponent('tiledBackground').obj.tilePositionX);
  await page.waitForTimeout(600);
  assert.ok((await ev(() => __nord.scene.find('Tiles').getComponent('tiledBackground').obj.tilePositionX)) > x0 + 10, 'tiled background scrolls');
  const og = await ev(() => { const o = __nord.scene.find('Pivot').getComponent('animatedSprite').obj; return [o.originX, o.originY]; });
  assert.deepEqual(og, [0.25, 0.5], 'sprite origin comes from the editor metadata');
  const an = await ev(() => { const a = __nord.backend.scene.anims; const pp = a.get('assets/sprites/hero.png:pp'), rt = a.get('assets/sprites/hero.png:rt'); return { yoyo: pp.yoyo, durs: pp.frames.map((f) => Math.round(f.duration)), loopAnim: a.exists('assets/sprites/hero.png:rt:loop'), rtRepeat: rt.repeat, loopLen: a.get('assets/sprites/hero.png:rt:loop')?.frames.length }; });
  assert.deepEqual(an, { yoyo: true, durs: [0, 200, 0], loopAnim: true, rtRepeat: 0, loopLen: 2 }, JSON.stringify(an));
  const stepped = await ev(() => new Promise((res) => { __nord.events.on('stepped', () => res(true)); setTimeout(() => res(false), 1500); }));
  assert.ok(stepped, 'per-frame event fires');
  assert.equal(await ev(() => __nord.scene.find('Font').getComponent('spriteFont').count), 4, 'sprite font lays out 4 glyphs');
  await ev(() => __nord.scene.find('Font').set('spriteFont', 'text', 'HAB'));
  assert.equal(await ev(() => __nord.scene.find('Font').getComponent('spriteFont').count), 3, 'text change relayouts');
  await ev(() => { const a = __nord.scene.find('Paint').getComponent('drawingCanvas').api; a.rect(10, 10, 40, 20, '#bf616a'); a.circle(80, 30, 15, '#a3be8c'); a.line(0, 59, 119, 0, '#ebcb8b', 3); });
  await ev(() => { const s = __nord.scene.find('Panel').getComponent('ninePatch'); s.entity.set('ninePatch', 'size', [220, 50]); });
  await page.waitForTimeout(800);
  const vt = await ev(() => { const v = __nord.scene.find('Movie').getComponent('video').api; return { time: v.time, playing: v.playing }; });
  assert.ok(vt.playing || vt.time > 0, `video plays (${JSON.stringify(vt)})`);
  await page.screenshot({ path: `${ROOT}/target/plugin-objects.png` });
});
assert.deepEqual(errors, [], errors.join('\n'));
console.log('plugin objects OK');
