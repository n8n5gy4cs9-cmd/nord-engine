// @nord {"id":"app.notes","title":"Markdown notes","category":"apps","tier":["html"],"tags":["notes","markdown","editor"],"description":"Notes list with live Markdown preview (headings, bold, italic, code, lists, links; uses window.marked if loaded, else a tiny built-in renderer). Saved in localStorage."}
import { h, shell, store } from './_kit.js';

const esc = (s) => s.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c]);
export function md(src) {
  if (globalThis.marked) return globalThis.marked.parse(src);
  return esc(src).replace(/^### (.*)$/gm, '<h3>$1</h3>').replace(/^## (.*)$/gm, '<h2>$1</h2>').replace(/^# (.*)$/gm, '<h1>$1</h1>').replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/\*(.+?)\*/g, '<i>$1</i>').replace(/`([^`]+)`/g, '<code>$1</code>').replace(/^- (.*)$/gm, '<li>$1</li>').replace(/\[(.+?)\]\((https?:[^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>').replace(/\n{2,}/g, '<br><br>');
}
export function mount(root, { key = 'nord.notes' } = {}) {
  const box = shell(root, 'Notes'), db = store(key, [{ id: 1, text: '# Hello\nWrite **markdown** here.' }]); let cur = db.get()[0]?.id;
  const list = h('div', { style: { width: '160px' } }), ta = h('textarea', { class: 'grow', style: { minHeight: '260px', resize: 'none' } }), prev = h('div', { class: 'card grow' });
  const sel = () => db.get().find((n) => n.id === cur);
  ta.addEventListener('input', () => { const n = sel(); if (n) { n.text = ta.value; db.set(db.get()); prev.innerHTML = md(n.text); drawList(); } });
  const title = (n) => (n.text.split('\n')[0].replace(/^#+\s*/, '') || 'Untitled').slice(0, 24);
  function drawList() { list.replaceChildren(h('button', { onclick: () => { const n = { id: Date.now(), text: '# New note' }; db.set([n, ...db.get()]); cur = n.id; load(); } }, '+ New'), ...db.get().map((n) => h('div', { class: 'card', style: { cursor: 'pointer', outline: n.id === cur ? '2px solid var(--nord-accent,#88c0d0)' : 'none' }, onclick: () => { cur = n.id; load(); } }, title(n)))); }
  function load() { const n = sel(); ta.value = n?.text ?? ''; prev.innerHTML = md(ta.value); drawList(); }
  box.append(h('div', { class: 'row', style: { alignItems: 'stretch' } }, list, ta, prev)); load();
  return { destroy: () => root.replaceChildren() };
}
