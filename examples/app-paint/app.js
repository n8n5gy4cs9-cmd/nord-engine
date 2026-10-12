// @nord {"id":"app.paint","title":"Paint","category":"apps","tier":["html"],"tags":["paint","canvas","drawing"],"description":"Canvas drawing: brush, eraser, size, colour, undo, clear and PNG download. Pointer events (mouse, pen, touch)."}
import { h, shell } from './_kit.js';

export function mount(root) {
  const box = shell(root, 'Paint'), cv = h('canvas', { width: 640, height: 400, style: { background: '#fff', borderRadius: '6px', touchAction: 'none', maxWidth: '100%' } }), c = cv.getContext('2d');
  let drawing = false, color = '#2e3440', size = 4, erase = false; const undo = [];
  const snap = () => { undo.push(c.getImageData(0, 0, cv.width, cv.height)); if (undo.length > 30) undo.shift(); };
  const pos = (e) => { const r = cv.getBoundingClientRect(); return [((e.clientX - r.left) / r.width) * cv.width, ((e.clientY - r.top) / r.height) * cv.height]; };
  cv.onpointerdown = (e) => { snap(); drawing = true; cv.setPointerCapture(e.pointerId); const [x, y] = pos(e); c.beginPath(); c.moveTo(x, y); c.lineCap = c.lineJoin = 'round'; c.lineWidth = size; c.strokeStyle = erase ? '#fff' : color; c.lineTo(x + 0.01, y); c.stroke(); };
  cv.onpointermove = (e) => { if (!drawing) return; const [x, y] = pos(e); c.lineTo(x, y); c.stroke(); };
  cv.onpointerup = () => { drawing = false; };
  const tools = h('div', { class: 'row' }, h('input', { type: 'color', value: color, oninput: (e) => { color = e.target.value; erase = false; } }), h('input', { type: 'range', min: 1, max: 40, value: size, oninput: (e) => { size = +e.target.value; } }),
    h('button', { class: 'ghost', onclick: () => { erase = !erase; } }, 'Eraser'), h('button', { class: 'ghost', onclick: () => undo.length && c.putImageData(undo.pop(), 0, 0) }, 'Undo'), h('button', { class: 'ghost', onclick: () => { snap(); c.clearRect(0, 0, cv.width, cv.height); } }, 'Clear'),
    h('button', { onclick: () => { const a = h('a', { href: cv.toDataURL('image/png'), download: 'paint.png' }); a.click(); } }, 'Save PNG'));
  box.append(tools, cv);
  return { destroy: () => root.replaceChildren() };
}
