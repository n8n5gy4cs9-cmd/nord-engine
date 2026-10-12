// @nord {"id":"app.calculator","title":"Calculator","category":"apps","tier":["html"],"tags":["calculator","math"],"description":"Four-function calculator with percent, sign and keyboard input. Safe evaluation (no eval)."}
import { h, shell } from './_kit.js';

export function mount(root) {
  const box = shell(root, 'Calculator'); let cur = '0', acc = null, op = null, fresh = true;
  const disp = h('div', { class: 'card', style: { textAlign: 'right', fontSize: '32px', minHeight: '56px' } }, '0'), show = () => { disp.textContent = cur; };
  const apply = (a, b, o) => ({ '+': a + b, '−': a - b, '×': a * b, '÷': b === 0 ? NaN : a / b })[o];
  const press = (k) => {
    if (/\d|\./.test(k)) { if (fresh) { cur = k === '.' ? '0.' : k; fresh = false; } else if (!(k === '.' && cur.includes('.'))) cur += k; }
    else if (k === 'C') { cur = '0'; acc = op = null; fresh = true; }
    else if (k === '±') cur = String(-parseFloat(cur)); else if (k === '%') cur = String(parseFloat(cur) / 100);
    else if (k === '=') { if (op) { cur = String(+apply(acc, parseFloat(cur), op).toFixed(10)); acc = op = null; fresh = true; } }
    else { if (op && !fresh) { acc = apply(acc, parseFloat(cur), op); cur = String(+acc.toFixed(10)); } else acc = parseFloat(cur); op = k; fresh = true; }
    show();
  };
  const keys = ['C', '±', '%', '÷', '7', '8', '9', '×', '4', '5', '6', '−', '1', '2', '3', '+', '0', '.', '='];
  const grid = h('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '8px' } }, ...keys.map((k) => h('button', { class: /\d|\./.test(k) ? 'ghost' : '', style: k === '0' ? { gridColumn: 'span 2' } : {}, onclick: () => press(k) }, k)));
  const kd = (e) => { const m = { '*': '×', '/': '÷', '-': '−', Enter: '=', Escape: 'C' }; const k = m[e.key] ?? e.key; if (keys.includes(k)) press(k); };
  window.addEventListener('keydown', kd); box.style.maxWidth = '320px'; box.append(disp, grid);
  return { destroy: () => { window.removeEventListener('keydown', kd); root.replaceChildren(); } };
}
