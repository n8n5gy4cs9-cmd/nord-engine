// @nord {"id":"app.dashboard","title":"Dashboard + charts","category":"apps","tier":["html"],"tags":["dashboard","charts","canvas"],"description":"KPI tiles plus tiny dependency-free canvas charts (line, bar, donut). Export lineChart/barChart/donutChart for reuse. mount(root, {data}) with {kpis:[{label,value,delta}], series:{labels,values}}."}
import { h, shell } from './_kit.js';

const col = (i) => ['#88c0d0', '#a3be8c', '#ebcb8b', '#b48ead', '#bf616a', '#d08770'][i % 6];
function setup(cv) { const dpr = devicePixelRatio || 1, w = cv.clientWidth || cv.width, hh = cv.clientHeight || cv.height; cv.width = w * dpr; cv.height = hh * dpr; const c = cv.getContext('2d'); c.scale(dpr, dpr); c.clearRect(0, 0, w, hh); c.fillStyle = c.strokeStyle = '#d8dee9'; c.font = '11px sans-serif'; return [c, w, hh]; }
export function lineChart(cv, labels, values, color = col(0)) {
  const [c, w, hh] = setup(cv), max = Math.max(...values, 1), min = Math.min(0, ...values), pad = 28, x = (i) => pad + (i * (w - pad - 8)) / Math.max(1, values.length - 1), y = (v) => hh - 20 - ((v - min) / (max - min || 1)) * (hh - 34);
  c.globalAlpha = 0.25; c.beginPath(); [0, 0.5, 1].forEach((t) => { c.moveTo(pad, y(min + (max - min) * t)); c.lineTo(w - 8, y(min + (max - min) * t)); }); c.stroke(); c.globalAlpha = 1;
  c.strokeStyle = color; c.lineWidth = 2; c.beginPath(); values.forEach((v, i) => (i ? c.lineTo(x(i), y(v)) : c.moveTo(x(i), y(v)))); c.stroke(); c.fillStyle = '#d8dee9'; labels.forEach((l, i) => i % Math.ceil(labels.length / 6) === 0 && c.fillText(l, x(i) - 8, hh - 5)); c.fillText(String(max), 2, 12);
}
export function barChart(cv, labels, values) {
  const [c, w, hh] = setup(cv), max = Math.max(...values, 1), bw = (w - 20) / values.length;
  values.forEach((v, i) => { c.fillStyle = col(i); const bh = (v / max) * (hh - 34); c.fillRect(10 + i * bw + 3, hh - 20 - bh, bw - 6, bh); c.fillStyle = '#d8dee9'; c.fillText(labels[i] ?? '', 10 + i * bw + 3, hh - 6); });
}
export function donutChart(cv, labels, values) {
  const [c, w, hh] = setup(cv), tot = values.reduce((a, b) => a + b, 0) || 1, r = Math.min(w, hh) / 2 - 6; let a = -Math.PI / 2;
  values.forEach((v, i) => { const s = (v / tot) * Math.PI * 2; c.beginPath(); c.arc(w / 2, hh / 2, r, a, a + s); c.arc(w / 2, hh / 2, r * 0.58, a + s, a, true); c.closePath(); c.fillStyle = col(i); c.fill(); a += s; });
}
export function mount(root, { data } = {}) {
  const d = data ?? { kpis: [{ label: 'Users', value: 1240, delta: 4.2 }, { label: 'Revenue', value: '€8.4k', delta: -1.1 }, { label: 'Uptime', value: '99.9%', delta: 0 }], series: { labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'], values: [12, 19, 14, 22, 30, 26, 35] } };
  const box = shell(root, 'Dashboard'), tiles = h('div', { class: 'row' }, ...d.kpis.map((k) => h('div', { class: 'card grow' }, h('div', { class: 'muted' }, k.label), h('div', { style: { fontSize: '26px', fontWeight: 700 } }, k.value), h('div', { style: { color: k.delta < 0 ? '#bf616a' : '#a3be8c' } }, `${k.delta > 0 ? '▲' : k.delta < 0 ? '▼' : '•'} ${Math.abs(k.delta)}%`))));
  const mk = () => h('canvas', { style: { width: '100%', height: '180px', display: 'block' } }), a = mk(), b = mk(), c = mk();
  box.append(tiles, h('div', { class: 'row', style: { alignItems: 'stretch' } }, h('div', { class: 'card grow' }, h('b', {}, 'Trend'), a), h('div', { class: 'card grow' }, h('b', {}, 'By day'), b), h('div', { class: 'card', style: { width: '200px' } }, h('b', {}, 'Share'), c)));
  const draw = () => { lineChart(a, d.series.labels, d.series.values); barChart(b, d.series.labels, d.series.values); donutChart(c, d.series.labels, d.series.values); };
  requestAnimationFrame(draw); const ro = new ResizeObserver(draw); ro.observe(root);
  return { update: (n) => { Object.assign(d, n); draw(); }, destroy: () => { ro.disconnect(); root.replaceChildren(); } };
}
