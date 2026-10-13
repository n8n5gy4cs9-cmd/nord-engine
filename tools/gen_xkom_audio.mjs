#!/usr/bin/env node
// X-KOM 2026 / Red Front audio: tiny synth (oscillators + noise + envelopes) → WAV sfx + looping music (ffmpeg → mp3).
// Re-runnable: node tools/gen_xkom_audio.mjs   →  tools/examples/xkom/assets/audio/{sfx,music}   (documented in assets.md; replace any file by name)
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { ROOT } from './examples/lib.mjs';

const SR = 22050, OUT = path.join(ROOT, 'tools/examples/xkom/assets/audio');
fs.mkdirSync(`${OUT}/sfx`, { recursive: true }); fs.mkdirSync(`${OUT}/music`, { recursive: true });
let seed = 12345; const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296) * 2 - 1;
const wave = { sine: (p) => Math.sin(p * 2 * Math.PI), square: (p) => (p % 1 < 0.5 ? 1 : -1), saw: (p) => 2 * (p % 1) - 1, tri: (p) => 4 * Math.abs((p % 1) - 0.5) - 1, noise: () => rnd() };
/** tone: freq (Hz or [from,to]) · dur s · shape · vol · decay curve */
function tone(buf, t0, dur, freq, { shape = 'square', vol = 0.4, decay = 3, attack = 0.005, lp = 0 } = {}) {
  const n = Math.floor(dur * SR), s0 = Math.floor(t0 * SR); let ph = 0, last = 0;
  for (let i = 0; i < n && s0 + i < buf.length; i++) {
    const k = i / n, f = Array.isArray(freq) ? freq[0] + (freq[1] - freq[0]) * k : freq; ph += f / SR;
    let v = wave[shape](ph); if (lp) { last += (v - last) * lp; v = last; }
    const env = Math.min(1, i / (attack * SR)) * Math.exp(-decay * k);
    buf[s0 + i] += v * env * vol;
  }
}
const mk = (secs) => new Float32Array(Math.floor(secs * SR));
function wav(name, buf, dir = 'sfx', base = OUT) {
  let peak = 0; for (const v of buf) peak = Math.max(peak, Math.abs(v)); const g = peak > 0.95 ? 0.95 / peak : 1;
  const b = Buffer.alloc(44 + buf.length * 2); b.write('RIFF', 0); b.writeUInt32LE(36 + buf.length * 2, 4); b.write('WAVEfmt ', 8); b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22);
  b.writeUInt32LE(SR, 24); b.writeUInt32LE(SR * 2, 28); b.writeUInt16LE(2, 32); b.writeUInt16LE(16, 34); b.write('data', 36); b.writeUInt32LE(buf.length * 2, 40);
  buf.forEach((v, i) => b.writeInt16LE(Math.max(-32767, Math.min(32767, Math.round(v * g * 32767))), 44 + i * 2));
  const f = path.join(base, dir, name + '.wav'); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, b); return f;
}
const S = {
  rifle: () => { const b = mk(0.35); tone(b, 0, 0.3, 0, { shape: 'noise', vol: 0.8, decay: 9 }); tone(b, 0, 0.12, [900, 120], { shape: 'saw', vol: 0.5, decay: 8 }); return b; },
  plasma: () => { const b = mk(0.5); tone(b, 0, 0.45, [1800, 200], { shape: 'saw', vol: 0.5, decay: 4 }); tone(b, 0, 0.3, [900, 100], { shape: 'sine', vol: 0.5, decay: 3 }); return b; },
  explosion: () => { const b = mk(1.1); tone(b, 0, 1.0, 0, { shape: 'noise', vol: 0.9, decay: 3.5, lp: 0.12 }); tone(b, 0, 0.6, [120, 30], { shape: 'sine', vol: 0.9, decay: 3 }); return b; },
  hit: () => { const b = mk(0.25); tone(b, 0, 0.2, 0, { shape: 'noise', vol: 0.7, decay: 12, lp: 0.4 }); tone(b, 0, 0.15, [300, 90], { shape: 'square', vol: 0.4, decay: 8 }); return b; },
  die_human: () => { const b = mk(0.6); tone(b, 0, 0.55, [500, 120], { shape: 'saw', vol: 0.5, decay: 3, lp: 0.3 }); return b; },
  die_alien: () => { const b = mk(0.8); tone(b, 0, 0.75, [900, 80], { shape: 'tri', vol: 0.5, decay: 2.5 }); tone(b, 0.02, 0.7, [600, 60], { shape: 'saw', vol: 0.25, decay: 3, lp: 0.2 }); return b; },
  step: () => { const b = mk(0.1); tone(b, 0, 0.08, 0, { shape: 'noise', vol: 0.5, decay: 14, lp: 0.15 }); return b; },
  click: () => { const b = mk(0.08); tone(b, 0, 0.06, 1400, { shape: 'square', vol: 0.3, decay: 10 }); return b; },
  select: () => { const b = mk(0.15); tone(b, 0, 0.05, 700, { vol: 0.3, decay: 4 }); tone(b, 0.06, 0.08, 1050, { vol: 0.3, decay: 5 }); return b; },
  endturn: () => { const b = mk(0.5); [440, 330, 220].forEach((f, i) => tone(b, i * 0.12, 0.2, f, { shape: 'tri', vol: 0.45, decay: 4 })); return b; },
  alarm: () => { const b = mk(2.4); for (let i = 0; i < 4; i++) tone(b, i * 0.6, 0.55, [500, 1000], { shape: 'saw', vol: 0.4, decay: 0.6, lp: 0.35 }); return b; },
  ack: () => { const b = mk(0.2); tone(b, 0, 0.07, 520, { vol: 0.3, decay: 3 }); tone(b, 0.08, 0.1, 780, { vol: 0.3, decay: 5 }); return b; },
  built: () => { const b = mk(0.8); [523, 659, 784, 1047].forEach((f, i) => tone(b, i * 0.1, 0.3, f, { shape: 'tri', vol: 0.4, decay: 3 })); return b; },
  cannon: () => { const b = mk(0.6); tone(b, 0, 0.5, 0, { shape: 'noise', vol: 0.7, decay: 6, lp: 0.2 }); tone(b, 0, 0.4, [220, 50], { shape: 'sine', vol: 0.9, decay: 5 }); return b; },
  rocket: () => { const b = mk(0.8); tone(b, 0, 0.8, 0, { shape: 'noise', vol: 0.5, decay: 2.5, lp: 0.35 }); tone(b, 0, 0.5, [300, 900], { shape: 'saw', vol: 0.2, decay: 3, lp: 0.3 }); return b; },
  spit: () => { const b = mk(0.35); tone(b, 0, 0.3, [300, 1400], { shape: 'sine', vol: 0.5, decay: 4 }); tone(b, 0, 0.2, 0, { shape: 'noise', vol: 0.3, decay: 8, lp: 0.5 }); return b; },
  ore: () => { const b = mk(0.2); tone(b, 0, 0.15, [1600, 1000], { shape: 'sine', vol: 0.3, decay: 6 }); return b; },
  confirm: () => { const b = mk(0.3); tone(b, 0, 0.1, 660, { shape: 'tri', vol: 0.4, decay: 3 }); tone(b, 0.1, 0.16, 990, { shape: 'tri', vol: 0.4, decay: 4 }); return b; },
  error: () => { const b = mk(0.25); tone(b, 0, 0.2, [200, 140], { shape: 'square', vol: 0.3, decay: 4 }); return b; },
  victory: () => { const b = mk(2); [523, 659, 784, 1047, 784, 1047, 1319].forEach((f, i) => tone(b, i * 0.2, 0.35, f, { shape: 'square', vol: 0.3, decay: 2, lp: 0.4 })); return b; },
  defeat: () => { const b = mk(2); [392, 349, 311, 262].forEach((f, i) => tone(b, i * 0.45, 0.6, f, { shape: 'saw', vol: 0.3, decay: 2, lp: 0.2 })); return b; },
};
for (const [n, f] of Object.entries(S)) wav(n, f());

// ---- music: a step sequencer (bass + lead + drums) -------------------------------------------------------------------
const N = (m) => 440 * 2 ** ((m - 69) / 12);
function song({ bpm, bars, bass, lead, drums = false, pad = false, leadShape = 'square', vol = 1, loop = false }) {
  const step = 60 / bpm / 4, steps = bars * 16, b = mk(steps * step + (loop ? 0 : 0.5));
  for (let i = 0; i < steps; i++) {
    const t = i * step, bn = bass[i % bass.length], ln = lead[i % lead.length];
    if (bn) tone(b, t, step * 1.8, N(bn), { shape: 'saw', vol: 0.22 * vol, decay: 1.5, lp: 0.12 });
    if (ln) tone(b, t, step * 1.5, N(ln), { shape: leadShape, vol: 0.14 * vol, decay: 2.2, lp: 0.3 });
    if (pad && i % 16 === 0) for (const m of pad) tone(b, t, step * 16, N(m), { shape: 'sine', vol: 0.09 * vol, decay: 0.6, attack: 0.4 });
    if (drums) { if (i % 4 === 0) tone(b, t, 0.15, [150, 45], { shape: 'sine', vol: 0.5, decay: 6 }); if (i % 8 === 4) tone(b, t, 0.12, 0, { shape: 'noise', vol: 0.3, decay: 9, lp: 0.5 }); if (i % 2 === 1) tone(b, t, 0.04, 0, { shape: 'noise', vol: 0.08, decay: 12, lp: 0.9 }); }
  }
  if (loop) { const fade = Math.floor(SR * 0.02); for (let i = 0; i < fade; i++) { b[i] *= i / fade; b[b.length - 1 - i] *= i / fade; } }
  return b;
}
const _ = 0;
// Keep Red Front's original music independent of X-KOM's three user-replaceable slots.
const redfront = song({ bpm: 128, bars: 8, bass: [38, 38, _, 38, 38, _, 41, _, 36, 36, _, 36, 36, _, 43, _, 34, 34, _, 34, 34, _, 41, _, 33, 33, _, 33, 40, _, 38, _], lead: [62, _, 65, 62, _, 69, _, 65, 60, _, 64, 60, _, 67, _, 64, 58, _, 62, 58, _, 65, _, 62, 57, _, 61, 64, _, 69, _, _], drums: true, leadShape: 'square' });
const songs = {
  music_title: song({ bpm: 90, bars: 16, loop: true, bass: [33, _, _, 45, _, _, 40, _, 33, _, _, 45, _, 40, _, _, 29, _, _, 41, _, _, 36, _, 29, _, _, 41, _, 36, _, _, 31, _, _, 43, _, _, 38, _, 31, _, _, 43, _, 38, _, _, 28, _, _, 40, _, _, 35, _, 28, _, 35, _, 40, _, _, _], lead: [69, _, _, _, 72, _, _, _, 76, _, _, 74, 72, _, 69, _, 65, _, _, _, 69, _, _, _, 72, _, _, 69, 65, _, _, _, 67, _, _, _, 71, _, _, _, 74, _, 76, _, 74, _, 71, _, 64, _, _, _, 68, _, _, _, 71, _, 74, _, 76, _, _, _], drums: true, pad: [45, 48, 52], leadShape: 'tri' }),
  music_base: song({ bpm: 72, bars: 16, loop: true, bass: [45, _, _, _, _, _, _, _, 41, _, _, _, _, _, _, _, 43, _, _, _, _, _, _, _, 40, _, _, _, _, _, _, _], lead: [_, _, 69, _, _, _, 72, _, _, _, 76, _, _, _, 72, _, _, _, 65, _, _, _, 69, _, _, _, 72, _, _, _, 69, _, _, _, 67, _, _, _, 71, _, _, _, 74, _, _, _, 71, _, _, _, 64, _, _, _, 68, _, _, _, 71, _, _, _, _, _], pad: [57, 60, 64], leadShape: 'sine', vol: 0.85 }),
  music_game: song({ bpm: 112, bars: 16, loop: true, bass: [38, _, 38, 50, _, 38, 41, _, 38, _, 38, 50, _, 41, 38, _, 36, _, 36, 48, _, 36, 39, _, 36, _, 36, 48, _, 39, 36, _, 34, _, 34, 46, _, 34, 38, _, 34, _, 34, 46, _, 38, 34, _, 33, _, 33, 45, _, 33, 37, _, 33, _, 37, _, 40, _, 38, _], lead: [62, _, _, 65, _, _, 69, _, _, _, 65, _, 64, _, _, _, 60, _, _, 63, _, _, 67, _, _, _, 63, _, 62, _, _, _, 58, _, _, 62, _, _, 65, _, _, _, 62, _, 60, _, _, _, 57, _, _, 61, _, _, 64, _, _, _, 67, _, 69, _, _, _], drums: true, pad: [50, 53, 57], leadShape: 'tri' }),
};
for (const [n, buf] of Object.entries(songs)) {
  const f = wav(n, buf, 'music'); execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', f, '-b:a', '64k', f.replace('.wav', '.mp3')]); fs.unlinkSync(f);
}
const rf = wav('music_rts', redfront, 'music', path.join(ROOT, 'tools/examples/redfront/assets/audio'));
execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', rf, '-b:a', '64k', rf.replace('.wav', '.mp3')]); fs.unlinkSync(rf);
console.log('audio ->', OUT);
