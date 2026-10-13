#!/usr/bin/env node
// Vallout 2 audio: tiny synth (oscillators + noise + envelopes) → WAV sfx, looping music (WAV → mp3 via ffmpeg).
// Re-runnable: node tools/gen_audio.mjs → game/assets/audio/{sfx,music}. Replace any file by name (see game/assets.md).
import fs from 'node:fs'; import path from 'node:path'; import { execFileSync } from 'node:child_process'; import { fileURLToPath } from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'), OUT = path.join(ROOT, 'game/assets/audio'), SR = 22050;
fs.mkdirSync(`${OUT}/sfx`, { recursive: true }); fs.mkdirSync(`${OUT}/music`, { recursive: true });
let seed = 4242; const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296) * 2 - 1;
const W = { sine: (p) => Math.sin(p * 2 * Math.PI), square: (p) => (p % 1 < 0.5 ? 1 : -1), saw: (p) => 2 * (p % 1) - 1, tri: (p) => 4 * Math.abs((p % 1) - 0.5) - 1, noise: () => rnd() };
function tone(buf, t0, dur, freq, { shape = 'square', vol = 0.4, decay = 3, attack = 0.005, lp = 0, vib = 0 } = {}) {
  const n = Math.floor(dur * SR), s0 = Math.floor(t0 * SR); let ph = 0, last = 0;
  for (let i = 0; i < n && s0 + i < buf.length; i++) { const k = i / n, f = (Array.isArray(freq) ? freq[0] + (freq[1] - freq[0]) * k : freq) * (1 + vib * Math.sin(i / SR * 40)); ph += f / SR; let v = W[shape](ph); if (lp) { last += (v - last) * lp; v = last; } buf[s0 + i] += v * Math.min(1, i / (attack * SR)) * Math.exp(-decay * k) * vol; }
}
const mk = (s) => new Float32Array(Math.floor(s * SR));
function writeWav(file, buf, norm = 0.9) {
  let peak = 0; for (const v of buf) peak = Math.max(peak, Math.abs(v)); const g = peak > norm ? norm / peak : 1, b = Buffer.alloc(44 + buf.length * 2);
  b.write('RIFF', 0); b.writeUInt32LE(36 + buf.length * 2, 4); b.write('WAVEfmt ', 8); b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22); b.writeUInt32LE(SR, 24); b.writeUInt32LE(SR * 2, 28); b.writeUInt16LE(2, 32); b.writeUInt16LE(16, 34); b.write('data', 36); b.writeUInt32LE(buf.length * 2, 40);
  buf.forEach((v, i) => b.writeInt16LE(Math.max(-32767, Math.min(32767, Math.round(v * g * 32767))), 44 + i * 2)); fs.writeFileSync(file, b);
}
const S = {
  click: () => { const b = mk(0.06); tone(b, 0, 0.05, 1500, { vol: 0.3, decay: 10 }); return b; },
  step: () => { const b = mk(0.09); tone(b, 0, 0.08, 0, { shape: 'noise', vol: 0.5, decay: 14, lp: 0.12 }); return b; },
  hit: () => { const b = mk(0.22); tone(b, 0, 0.2, 0, { shape: 'noise', vol: 0.7, decay: 12, lp: 0.4 }); tone(b, 0, 0.15, [300, 90], { vol: 0.4, decay: 8 }); return b; },
  hit_goo: () => { const b = mk(0.3); tone(b, 0, 0.28, 0, { shape: 'noise', vol: 0.6, decay: 7, lp: 0.15 }); tone(b, 0, 0.25, [220, 70], { shape: 'sine', vol: 0.6, decay: 5 }); return b; },
  hurt: () => { const b = mk(0.3); tone(b, 0, 0.28, [260, 110], { shape: 'saw', vol: 0.5, decay: 4, lp: 0.3 }); tone(b, 0, 0.1, 0, { shape: 'noise', vol: 0.4, decay: 10, lp: 0.3 }); return b; },
  die_alien: () => { const b = mk(0.8); tone(b, 0, 0.75, [900, 80], { shape: 'tri', vol: 0.5, decay: 2.5 }); tone(b, 0.02, 0.7, [600, 60], { shape: 'saw', vol: 0.25, decay: 3, lp: 0.2 }); return b; },
  die_human: () => { const b = mk(0.6); tone(b, 0, 0.55, [500, 120], { shape: 'saw', vol: 0.5, decay: 3, lp: 0.3, vib: 0.03 }); return b; },
  gull: () => { const b = mk(0.5); tone(b, 0, 0.2, [1400, 900], { shape: 'saw', vol: 0.35, decay: 3, lp: 0.4 }); tone(b, 0.22, 0.25, [1200, 700], { shape: 'saw', vol: 0.35, decay: 3, lp: 0.4 }); return b; },
  blob: () => { const b = mk(0.35); tone(b, 0, 0.3, [140, 60], { shape: 'sine', vol: 0.7, decay: 4 }); tone(b, 0, 0.3, 0, { shape: 'noise', vol: 0.3, decay: 6, lp: 0.08 }); return b; },
  levelup: () => { const b = mk(0.8); [523, 659, 784, 1047].forEach((f, i) => tone(b, i * 0.1, 0.3, f, { shape: 'square', vol: 0.3, decay: 4 })); return b; },
  win: () => { const b = mk(1.1); [392, 523, 659, 784, 1047].forEach((f, i) => tone(b, i * 0.12, 0.5, f, { shape: 'tri', vol: 0.4, decay: 3 })); return b; },
  lose: () => { const b = mk(1.2); [392, 330, 262, 196].forEach((f, i) => tone(b, i * 0.25, 0.5, f, { shape: 'saw', vol: 0.3, decay: 3, lp: 0.3 })); return b; },
  pickup: () => { const b = mk(0.25); tone(b, 0, 0.08, 880, { vol: 0.3, decay: 5 }); tone(b, 0.07, 0.12, 1320, { vol: 0.3, decay: 5 }); return b; },
  open: () => { const b = mk(0.3); tone(b, 0, 0.25, [200, 380], { shape: 'saw', vol: 0.25, decay: 4, lp: 0.2 }); tone(b, 0, 0.06, 0, { shape: 'noise', vol: 0.4, decay: 12, lp: 0.3 }); return b; },
  error: () => { const b = mk(0.25); tone(b, 0, 0.2, [220, 160], { shape: 'square', vol: 0.3, decay: 3 }); return b; },
  miss: () => { const b = mk(0.2); tone(b, 0, 0.18, [900, 300], { shape: 'noise', vol: 0.25, decay: 8, lp: 0.5 }); return b; },
  combat: () => { const b = mk(0.8); [110, 110, 165].forEach((f, i) => tone(b, i * 0.14, 0.35, f, { shape: 'saw', vol: 0.4, decay: 3, lp: 0.2 })); tone(b, 0, 0.7, 0, { shape: 'noise', vol: 0.15, decay: 3, lp: 0.05 }); return b; },
  shoot_pistol: () => { const b = mk(0.3); tone(b, 0, 0.25, 0, { shape: 'noise', vol: 0.8, decay: 10 }); tone(b, 0, 0.1, [800, 120], { shape: 'saw', vol: 0.5, decay: 8 }); return b; },
  shoot_shotgun: () => { const b = mk(0.5); tone(b, 0, 0.45, 0, { shape: 'noise', vol: 0.95, decay: 6, lp: 0.5 }); tone(b, 0, 0.2, [180, 50], { shape: 'sine', vol: 0.8, decay: 6 }); return b; },
  shoot_rifle: () => { const b = mk(0.55); tone(b, 0, 0.5, 0, { shape: 'noise', vol: 0.85, decay: 7, lp: 0.35 }); tone(b, 0, 0.14, [1100, 90], { shape: 'saw', vol: 0.5, decay: 8 }); return b; },
  ray: () => { const b = mk(0.45); tone(b, 0, 0.4, [1800, 220], { shape: 'saw', vol: 0.4, decay: 4 }); tone(b, 0, 0.3, [900, 120], { shape: 'sine', vol: 0.45, decay: 3 }); return b; },
  swing: () => { const b = mk(0.22); tone(b, 0, 0.2, [600, 1500], { shape: 'noise', vol: 0.25, decay: 6, lp: 0.6 }); return b; },
  kick: () => { const b = mk(0.25); tone(b, 0, 0.22, [200, 60], { shape: 'sine', vol: 0.8, decay: 7 }); tone(b, 0, 0.1, 0, { shape: 'noise', vol: 0.4, decay: 12, lp: 0.3 }); return b; },
  punch: () => { const b = mk(0.2); tone(b, 0, 0.16, [260, 90], { shape: 'sine', vol: 0.7, decay: 8 }); tone(b, 0, 0.06, 0, { shape: 'noise', vol: 0.45, decay: 14, lp: 0.4 }); return b; },
  whoosh: () => { const b = mk(0.35); tone(b, 0, 0.32, [300, 1400], { shape: 'noise', vol: 0.3, decay: 3, lp: 0.3 }); return b; },
  wallkick: () => { const b = mk(0.35); tone(b, 0, 0.3, [140, 45], { shape: 'sine', vol: 0.9, decay: 6 }); tone(b, 0, 0.12, 0, { shape: 'noise', vol: 0.6, decay: 12, lp: 0.2 }); return b; },
  heal: () => { const b = mk(0.5); [660, 880, 1100].forEach((f, i) => tone(b, i * 0.07, 0.25, f, { shape: 'sine', vol: 0.3, decay: 4 })); return b; },
  drink: () => { const b = mk(0.5); for (let i = 0; i < 3; i++) tone(b, i * 0.12, 0.1, [300 + i * 40, 160], { shape: 'sine', vol: 0.4, decay: 5 }); tone(b, 0.3, 0.15, 0, { shape: 'noise', vol: 0.2, decay: 6, lp: 0.1 }); return b; },
  confirm: () => { const b = mk(0.2); tone(b, 0, 0.06, 700, { vol: 0.3, decay: 4 }); tone(b, 0.07, 0.1, 1050, { vol: 0.3, decay: 5 }); return b; },
};
for (const [n, f] of Object.entries(S)) writeWav(`${OUT}/sfx/${n}.wav`, f());

// ---- music ------------------------------------------------------------------------------------------------------------------
const hz = (m) => 440 * 2 ** ((m - 69) / 12);
function music(name, bpm, bars, make) {
  const beat = 60 / bpm, len = bars * 4 * beat, b = mk(len); make(b, beat); writeWav(`${OUT}/music/${name}.wav`, b, 0.8);
  const wav = `${OUT}/music/${name}.wav`; execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', wav, '-codec:a', 'libmp3lame', '-b:a', '80k', `${OUT}/music/${name}.mp3`]); fs.unlinkSync(wav);
}
const CH = { Am: [57, 60, 64], F: [53, 57, 60], C: [48, 52, 55], G: [55, 59, 62], E: [52, 56, 59], Dm: [50, 53, 57] };
music('music_title', 72, 8, (b, beat) => {
  const prog = ['Am', 'F', 'C', 'G', 'Am', 'F', 'E', 'Am'], lead = [76, 74, 72, 74, 76, 79, 76, 72, 72, 74, 72, 69, 71, 74, 71, 67, 76, 77, 76, 72, 74, 72, 69, 67, 68, 71, 68, 64, 69, 72, 76, 81];
  prog.forEach((c, bar) => { const t0 = bar * 4 * beat; CH[c].forEach((m) => tone(b, t0, 4 * beat, hz(m - 12), { shape: 'saw', vol: 0.07, decay: 0.6, attack: 0.3, lp: 0.08 })); tone(b, t0, 4 * beat, hz(CH[c][0] - 24), { shape: 'sine', vol: 0.3, decay: 0.8, attack: 0.05 });
    for (let i = 0; i < 8; i++) tone(b, t0 + i * beat / 2, beat * 0.5, hz(CH[c][i % 3] + 12), { shape: 'square', vol: 0.07, decay: 4, lp: 0.3 });
    for (let i = 0; i < 4; i++) tone(b, t0 + i * beat, beat * 0.95, hz(lead[bar * 4 + i]), { shape: 'tri', vol: 0.22, decay: 2, vib: 0.004 }); });
});
music('music_wasteland', 58, 8, (b, beat) => {
  const pent = [57, 60, 62, 64, 67, 69]; let s = 7;
  tone(b, 0, b.length / SR, hz(33), { shape: 'sine', vol: 0.25, decay: 0, attack: 1 }); tone(b, 0, b.length / SR, hz(40), { shape: 'sine', vol: 0.1, decay: 0, attack: 1 });
  tone(b, 0, b.length / SR, 0, { shape: 'noise', vol: 0.025, decay: 0, lp: 0.02, attack: 2 });
  for (let i = 0; i < 16; i++) { s = (s * 1103515245 + 12345) & 0x7fffffff; const m = pent[s % pent.length], t = i * 2 * beat * 0.5 + (s % 5) * 0.2; tone(b, t, 2.5, hz(m + (s % 3 ? 0 : 12)), { shape: 'sine', vol: 0.18, decay: 2.2, attack: 0.01 }); tone(b, t + 0.01, 2, hz(m + 7), { shape: 'tri', vol: 0.05, decay: 3 }); }
  for (let bar = 0; bar < 8; bar += 2) CH[['Am', 'F', 'C', 'Dm'][bar / 2]].forEach((m) => tone(b, bar * 4 * beat, 8 * beat, hz(m - 12), { shape: 'saw', vol: 0.03, decay: 0.5, attack: 1.5, lp: 0.05 }));
});
music('music_combat', 138, 8, (b, beat) => {
  const roots = [45, 45, 41, 43, 45, 45, 41, 40];
  for (let bar = 0; bar < 8; bar++) { const t0 = bar * 4 * beat, r = roots[bar];
    for (let i = 0; i < 8; i++) tone(b, t0 + i * beat / 2, beat * 0.45, hz(r + (i % 4 === 3 ? 12 : 0)), { shape: 'saw', vol: 0.2, decay: 4, lp: 0.2 });
    for (let i = 0; i < 4; i++) { tone(b, t0 + i * beat, 0.15, [150, 45], { shape: 'sine', vol: 0.7, decay: 6 }); if (i % 2) tone(b, t0 + i * beat, 0.14, 0, { shape: 'noise', vol: 0.3, decay: 9, lp: 0.5 }); }
    for (let i = 0; i < 8; i++) tone(b, t0 + i * beat / 2 + beat / 4, 0.03, 0, { shape: 'noise', vol: 0.08, decay: 12, lp: 0.9 });
    if (bar % 2 === 1) for (let i = 0; i < 4; i++) tone(b, t0 + i * beat / 2 + 2 * beat, beat * 0.4, hz(r + 24 + [0, 3, 7, 10][i]), { shape: 'square', vol: 0.09, decay: 3 }); }
});
console.log('audio done');
