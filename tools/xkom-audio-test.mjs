// Real WebAudio decoding/playback and scene routing, including title autoplay unlock and persistent base/game loops.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import { withPage, waitReady, ROOT } from './e2e-lib.mjs';
const dir = process.argv[2] ?? `${ROOT}/examples/xkom`;
assert.deepEqual(fs.readdirSync(`${dir}/assets/audio/music`).sort(), ['music_base.mp3', 'music_game.mp3', 'music_title.mp3']);
const { errors, result } = await withPage(dir, async page => {
  await waitReady(page); await page.waitForFunction(() => window.__xk?.mode === 'title');
  const track = async name => {
    await page.waitForFunction(n => { const a = window.__nord.audio; return a.musicPath === `assets/audio/music/music_${n}.mp3` && a._music?.src?.buffer && a.ctx.state === 'running'; }, name);
    const r = await page.evaluate(() => { const m = window.__nord.audio._music, data = m.src.buffer.getChannelData(0); let peak = 0; for (let i = 0; i < data.length; i += 97) peak = Math.max(peak, Math.abs(data[i])); return { loop: m.src.loop, seconds: m.src.buffer.duration, peak }; });
    assert.equal(r.loop, true); assert.ok(r.seconds > 20); assert.ok(r.peak > 0.05); return r;
  };
  await page.keyboard.press('m'); await track('title'); assert.equal(await page.evaluate(() => window.__xk.mode), 'title');
  await page.screenshot({ path: `${ROOT}/docs/screenshots/xkom-title.png` });
  await page.keyboard.press('Enter'); await track('base'); await page.evaluate(() => { window.__baseAudioSource = window.__nord.audio._music.src; });
  await page.keyboard.press('b'); await page.waitForFunction(() => window.__xk.mode === 'base'); await track('base');
  assert.equal(await page.evaluate(() => window.__nord.audio._music.src === window.__baseAudioSource), true);
  await page.keyboard.press('Escape'); await page.keyboard.press('1'); await page.waitForFunction(() => window.__xk.mode === 'air'); await track('game');
  await page.evaluate(() => { window.__gameAudioSource = window.__nord.audio._music.src; });
  await page.keyboard.press('Enter'); await page.waitForFunction(() => window.__xk.air.phase === 'air'); await track('game');
  await page.keyboard.press('Escape'); await page.waitForFunction(() => window.__xk.mode === 'tac'); await track('game');
  assert.equal(await page.evaluate(() => window.__nord.audio._music.src === window.__gameAudioSource), true);
  await page.evaluate(() => { window.__xk.tac.destroy(); window.__xk.startRts(); }); await track('game');
  await page.evaluate(() => { window.__xk.rts.destroy(); window.__xk.ending(true); }); await track('base');
  const sfx = fs.readdirSync(`${dir}/assets/audio/sfx`).filter(f => f.endsWith('.wav')).sort(); assert.equal(sfx.length, 21);
  const decoded = await page.evaluate(async names => { const a = window.__nord.audio, out = []; for (const n of names) { const b = await a.load(`assets/audio/sfx/${n}`); out.push({ name: n, seconds: b?.duration ?? 0 }); } return out; }, sfx);
  for (const f of decoded) assert.ok(f.seconds > 0, `${f.name} decodes`);
  return await page.evaluate(() => window.__nord.errors.map(e => e.err?.message));
}, { path: '/?seed=42', viewport: { width: 960, height: 600 } });
assert.deepEqual(errors, []); assert.deepEqual(result, []);
console.log('PASS: exactly 3 music files; audible looping WebAudio buffers; title unlock; title/base/game scene routing; no loop restart inside each role; all 21 SFX decode.');
