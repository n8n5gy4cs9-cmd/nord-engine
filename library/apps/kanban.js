// @nord {"id":"app.kanban","title":"Kanban board","category":"apps","tier":["html"],"tags":["kanban","drag-drop","board"],"description":"Three-column board (To do / Doing / Done) with HTML5 drag & drop, add/delete cards, persisted in localStorage."}
import { h, shell, store } from './_kit.js';

export function mount(root, { key = 'nord.kanban', columns = ['To do', 'Doing', 'Done'] } = {}) {
  const box = shell(root, 'Kanban'), db = store(key, { cards: [{ id: 1, col: 0, t: 'Try dragging me' }] }), wrap = h('div', { class: 'row', style: { alignItems: 'flex-start' } });
  let drag = null;
  function draw() {
    wrap.replaceChildren(...columns.map((name, ci) => {
      const col = h('div', { class: 'card grow', style: { minHeight: '200px' }, ondragover: (e) => e.preventDefault(), ondrop: () => { if (drag) { drag.col = ci; db.set(db.get()); draw(); } } }, h('b', {}, name));
      for (const c of db.get().cards.filter((x) => x.col === ci)) col.append(h('div', { class: 'card row', draggable: true, ondragstart: () => { drag = c; } }, h('span', { class: 'grow' }, c.t), h('button', { class: 'ghost', onclick: () => { db.get().cards = db.get().cards.filter((x) => x !== c); db.set(db.get()); draw(); } }, '✕')));
      const inp = h('input', { placeholder: '+ add card', style: { width: '100%' }, onkeydown: (e) => { if (e.key === 'Enter' && e.target.value.trim()) { db.get().cards.push({ id: Date.now(), col: ci, t: e.target.value.trim() }); db.set(db.get()); draw(); } } });
      col.append(inp); return col;
    }));
  }
  box.append(wrap); draw();
  return { destroy: () => root.replaceChildren() };
}
