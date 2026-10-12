// @nord {"id":"app.todo","title":"Todo list","category":"apps","tier":["html"],"tags":["todo","list","storage"],"description":"Add, complete, filter and delete tasks; persists in localStorage. mount(root, {key}) renders into any element."}
import { h, shell, store } from './_kit.js';

export function mount(root, { key = 'nord.todo' } = {}) {
  const box = shell(root, 'Todo'), db = store(key, []); let filter = 'all';
  const input = h('input', { class: 'grow', placeholder: 'What needs doing?' }), list = h('div'), count = h('div', { class: 'muted' });
  const add = () => { const t = input.value.trim(); if (t) { db.set([...db.get(), { id: Date.now(), t, done: false }]); input.value = ''; draw(); } };
  input.addEventListener('keydown', (e) => e.key === 'Enter' && add());
  const tabs = h('div', { class: 'row' }, ...['all', 'active', 'done'].map((f) => h('button', { class: 'ghost', onclick: () => { filter = f; draw(); } }, f)));
  function draw() {
    list.replaceChildren(...db.get().filter((x) => filter === 'all' || (filter === 'done') === x.done).map((x) => h('div', { class: 'card row' },
      h('input', { type: 'checkbox', checked: x.done, onchange: (e) => { x.done = e.target.checked; db.set(db.get()); draw(); } }),
      h('span', { class: 'grow', style: { textDecoration: x.done ? 'line-through' : 'none', opacity: x.done ? 0.5 : 1 } }, x.t),
      h('button', { class: 'ghost', onclick: () => { db.set(db.get().filter((y) => y.id !== x.id)); draw(); } }, '✕'))));
    count.textContent = `${db.get().filter((x) => !x.done).length} left`;
  }
  box.append(h('div', { class: 'row' }, input, h('button', { onclick: add }, 'Add')), tabs, list, count); draw();
  return { destroy: () => root.replaceChildren() };
}
