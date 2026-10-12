// @nord {"id":"app.kanban","title":"Kanban board","category":"apps","tier":["html"],"tags":["kanban","drag-drop","board"],"description":"Three-column board (To do / Doing / Done) with pointer-based drag & drop (works in webviews), add/delete cards, persisted in localStorage."}
import { h, shell, store } from './_kit.js';

export function mount(root, { key = 'nord.kanban', columns = ['To do', 'Doing', 'Done'] } = {}) {
  const box = shell(root, 'Kanban'), db = store(key, { cards: [{ id: 1, col: 0, t: 'Try dragging me' }] }), wrap = h('div', { class: 'row', style: { alignItems: 'flex-start' } });
  // pointer-events drag (HTML5 draggable is unreliable in embedded webviews): press a card, move, release over a column
  let cols = [];
  function startDrag(e, c, el) {
    if (e.button || e.target.closest('button')) return;
    const r = el.getBoundingClientRect(), ox = e.clientX - r.left, oy = e.clientY - r.top;
    let ghost = null, over = -1;
    const colAt = (x, y) => cols.findIndex((k) => { const b = k.getBoundingClientRect(); return x >= b.left && x <= b.right && y >= b.top && y <= b.bottom; });
    const move = (m) => {
      if (!ghost && Math.hypot(m.clientX - e.clientX, m.clientY - e.clientY) < 4) return;
      if (!ghost) { ghost = el.cloneNode(true); Object.assign(ghost.style, { position: 'fixed', width: r.width + 'px', pointerEvents: 'none', opacity: '.85', zIndex: 9999 }); document.body.append(ghost); el.style.opacity = '.35'; }
      ghost.style.left = m.clientX - ox + 'px'; ghost.style.top = m.clientY - oy + 'px';
      const i = colAt(m.clientX, m.clientY); if (i !== over) { if (cols[over]) cols[over].style.outline = ''; if (cols[i]) cols[i].style.outline = '2px solid #88c0d0'; over = i; }
    };
    const up = (u) => {
      removeEventListener('pointermove', move); removeEventListener('pointerup', up); removeEventListener('pointercancel', up);
      ghost?.remove(); if (cols[over]) cols[over].style.outline = '';
      const i = colAt(u.clientX, u.clientY);
      if (ghost && i >= 0) { c.col = i; db.set(db.get()); }
      draw();
    };
    addEventListener('pointermove', move); addEventListener('pointerup', up); addEventListener('pointercancel', up);
    e.preventDefault();
  }
  function draw() {
    cols = [];
    wrap.replaceChildren(...columns.map((name, ci) => {
      const col = h('div', { class: 'card grow', style: { minHeight: '200px' } }, h('b', {}, name)); cols.push(col);
      for (const c of db.get().cards.filter((x) => x.col === ci)) { const el = h('div', { class: 'card row', style: { cursor: 'grab', userSelect: 'none', touchAction: 'none' } }, h('span', { class: 'grow' }, c.t), h('button', { class: 'ghost', onclick: () => { db.get().cards = db.get().cards.filter((x) => x !== c); db.set(db.get()); draw(); } }, '✕')); el.addEventListener('pointerdown', (e) => startDrag(e, c, el)); col.append(el); }
      const inp = h('input', { placeholder: '+ add card', style: { width: '100%' }, onkeydown: (e) => { if (e.key === 'Enter' && e.target.value.trim()) { db.get().cards.push({ id: Date.now(), col: ci, t: e.target.value.trim() }); db.set(db.get()); draw(); } } });
      col.append(inp); return col;
    }));
  }
  box.append(wrap); draw();
  return { destroy: () => root.replaceChildren() };
}
