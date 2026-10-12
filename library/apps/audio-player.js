// @nord {"id":"app.audio-player","title":"Audio player + visualiser","category":"apps","tier":["html"],"tags":["audio","music","visualizer","analyser"],"description":"Playlist player with play/pause, seek, volume and a WebAudio frequency-bar visualiser. mount(root,{tracks:[{title,src}]})."}
import { h, shell } from './_kit.js';

export function mount(root, { tracks = [] } = {}) {
  const box = shell(root, 'Audio player'), audio = new Audio(); audio.crossOrigin = 'anonymous'; let i = 0, ctx, an;
  const cv = h('canvas', { width: 480, height: 120, style: { width: '100%', height: '120px', borderRadius: '6px', background: '#232831' } }), title = h('div', { class: 'card' }, '—'), seek = h('input', { type: 'range', min: 0, max: 1000, value: 0, class: 'grow' }), list = h('div');
  const load = (n) => { i = (n + tracks.length) % tracks.length; audio.src = tracks[i]?.src ?? ''; title.textContent = tracks[i]?.title ?? '—'; [...list.children].forEach((c, k) => (c.style.outline = k === i ? '2px solid var(--nord-accent,#88c0d0)' : 'none')); };
  const play = async () => { if (!ctx) { ctx = new AudioContext(); an = ctx.createAnalyser(); an.fftSize = 128; ctx.createMediaElementSource(audio).connect(an); an.connect(ctx.destination); } await ctx.resume(); audio.paused ? audio.play() : audio.pause(); };
  seek.oninput = () => { if (audio.duration) audio.currentTime = (seek.value / 1000) * audio.duration; }; audio.ontimeupdate = () => { if (audio.duration) seek.value = (audio.currentTime / audio.duration) * 1000; }; audio.onended = () => { load(i + 1); play(); };
  list.append(...tracks.map((t, k) => h('div', { class: 'card', style: { cursor: 'pointer' }, onclick: () => { load(k); audio.play(); } }, t.title)));
  box.append(title, cv, h('div', { class: 'row' }, h('button', { class: 'ghost', onclick: () => load(i - 1) }, '⏮'), h('button', { onclick: play }, '▶/⏸'), h('button', { class: 'ghost', onclick: () => load(i + 1) }, '⏭'), seek, h('input', { type: 'range', min: 0, max: 1, step: 0.05, value: 1, oninput: (e) => { audio.volume = +e.target.value; } })), list); load(0);
  let raf; const g = cv.getContext('2d'), data = new Uint8Array(64);
  const loop = () => { raf = requestAnimationFrame(loop); g.clearRect(0, 0, cv.width, cv.height); if (!an) return; an.getByteFrequencyData(data); const bw = cv.width / data.length; data.forEach((v, k) => { g.fillStyle = `hsl(${190 + k * 2},60%,${40 + v / 6}%)`; const bh = (v / 255) * cv.height; g.fillRect(k * bw + 1, cv.height - bh, bw - 2, bh); }); }; loop();
  return { destroy: () => { cancelAnimationFrame(raf); audio.pause(); ctx?.close(); root.replaceChildren(); } };
}
