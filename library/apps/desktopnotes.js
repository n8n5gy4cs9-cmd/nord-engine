// @nord {"id":"app.desktop-notes","title":"Notes (desktop)","category":"apps","tier":["html"],"tags":["notes","files","store","notifications","desktop","i18n"],"description":"Markdown notes as real files in the app data folder: search, drag-to-reorder pinned order, autosave, import/export through native dialogs, reminders via system notifications, dark-mode follow and en/de UI. Uses window.nord.desktop (fs, store, dialog, notify) and the _ux helpers."}
import desktop from './nord-desktop.js';
import { createI18n, followSystemTheme, enableDragReorder, moveItem, UndoStack, bindUndoKeys } from './_ux.js';

const D = desktop;
const L = createI18n({
  en: { title: 'Notes', new: 'New note', search: 'Search…', del: 'Delete', export: 'Export…', import: 'Import…', remind: 'Remind me', untitled: 'Untitled', count: { one: '{n} note', other: '{n} notes' }, saved: 'Saved', confirmDel: 'Delete “{t}”?', reminded: 'Reminder in {m} min', undo: 'Undo' },
  de: { title: 'Notizen', new: 'Neue Notiz', search: 'Suchen…', del: 'Löschen', export: 'Exportieren…', import: 'Importieren…', remind: 'Erinnere mich', untitled: 'Ohne Titel', count: { one: '{n} Notiz', other: '{n} Notizen' }, saved: 'Gespeichert', confirmDel: '„{t}“ löschen?', reminded: 'Erinnerung in {m} Min.', undo: 'Rückgängig' },
});
const CSS = `.dn{--bg:#fafafa;--p:#f0f0f2;--fg:#24292f;--m:#6b7280;--a:#0969da;--b:#d0d4da;display:flex;height:100%;font:14px/1.45 system-ui,sans-serif;background:var(--bg);color:var(--fg)}
:root[data-theme=dark] .dn{--bg:#1e2128;--p:#252932;--fg:#d8dee9;--m:#8a93a5;--a:#88c0d0;--b:#3a404d}.dn *{box-sizing:border-box}
.dn aside{width:260px;background:var(--p);border-right:1px solid var(--b);display:flex;flex-direction:column}.dn .top{padding:8px;display:flex;gap:6px;flex-wrap:wrap}.dn input,.dn textarea,.dn button,.dn select{font:inherit;color:inherit;background:var(--bg);border:1px solid var(--b);border-radius:6px;padding:4px 8px}
.dn button{cursor:pointer}.dn button.pri{background:var(--a);color:var(--bg);border:0;font-weight:600}.dn .list{flex:1;overflow:auto}.dn .it{padding:6px 10px;border-bottom:1px solid var(--b);cursor:pointer}.dn .it.on{background:var(--bg);box-shadow:inset 3px 0 var(--a)}.dn .it small{display:block;color:var(--m);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.dn main{flex:1;display:flex;flex-direction:column;min-width:0}.dn textarea{flex:1;border:0;border-radius:0;padding:14px;resize:none;outline:0;font:15px/1.6 ui-monospace,Menlo,Consolas,monospace}.dn .bar{display:flex;gap:6px;padding:8px;border-bottom:1px solid var(--b);align-items:center;flex-wrap:wrap}.dn .sp{flex:1}.dn .m{color:var(--m);font-size:12px}`;

export async function mount(root) {
  await D.ready;
  document.head.append(Object.assign(document.createElement('style'), { textContent: CSS }));
  followSystemTheme();
  const savedLocale = await D.store.get('locale', null); if (savedLocale) L.locale = savedLocale;
  const el = (t, c, p = {}, ...k) => { const e = Object.assign(document.createElement(t), p); if (c) e.className = c; e.append(...k.flat().filter((x) => x != null)); return e; };
  let order = await D.store.get('order', []), notes = [], cur = null, filter = '', saveT;
  const file = (id) => `notes/${id}.md`;
  const titleOf = (t) => (t.split('\n').find((l) => l.trim()) ?? '').replace(/^#+\s*/, '').slice(0, 60) || L.t('untitled');
  async function load() {
    notes = [];
    for (const e of (await D.fs.list('notes').catch(() => [])).filter((e) => e.name.endsWith('.md'))) { const id = e.name.slice(0, -3); notes.push({ id, text: await D.fs.readText(file(id)), modified: e.modified }); }
    notes.sort((a, b) => { const ia = order.indexOf(a.id), ib = order.indexOf(b.id); return (ia < 0 ? 1e9 : ia) - (ib < 0 ? 1e9 : ib) || b.modified - a.modified; });
  }
  const undo = new UndoStack(); bindUndoKeys(undo);
  const search = el('input', '', { placeholder: L.t('search'), oninput: () => { filter = search.value.toLowerCase(); drawList(); } });
  const list = el('div', 'list'), count = el('span', 'm'), ta = el('textarea', '', { oninput: onType, spellcheck: true }), status = el('span', 'm'), mins = el('select', '', {}, [1, 5, 15, 60].map((m) => el('option', '', { value: m, textContent: `${m} min` })));
  const newBtn = el('button', 'pri', { textContent: L.t('new'), onclick: newNote });
  const lang = el('select', '', { onchange: async () => { await D.store.set('locale', lang.value); location.reload(); } }, ['en', 'de'].map((l) => el('option', '', { value: l, textContent: l, selected: l === L.locale })));
  const bar = el('div', 'bar', {}, el('button', '', { textContent: L.t('export'), onclick: exportNote }), el('button', '', { textContent: L.t('import'), onclick: importNote }), el('button', '', { textContent: L.t('del'), onclick: delNote }), el('span', 'sp'), el('span', 'm', { textContent: L.t('remind') }), mins, el('button', '', { textContent: '⏰', onclick: remind }), status);
  root.replaceChildren(el('div', 'dn', {}, el('aside', '', {}, el('div', 'top', {}, newBtn, search, lang), list, el('div', 'top', {}, count)), el('main', '', {}, bar, ta)));
  function drawList() {
    const shown = notes.filter((n) => !filter || n.text.toLowerCase().includes(filter));
    list.replaceChildren(...shown.map((n) => { const d = el('div', 'it' + (n === cur ? ' on' : ''), { onclick: () => select(n) }, el('b', '', { textContent: titleOf(n.text) }), el('small', '', { textContent: n.text.split('\n').slice(1).join(' ').trim().slice(0, 80) || '—' })); d.dataset.id = n.id; return d; }));
    count.textContent = L.t('count', { n: notes.length });
  }
  enableDragReorder(list, async (from, to) => { const ids = [...list.children].map((c) => c.dataset.id); order = moveItem(ids, from, to); await D.store.set('order', order); await load(); drawList(); });
  function select(n) { cur = n; ta.value = n?.text ?? ''; ta.disabled = !n; drawList(); if (n) ta.focus(); }
  async function newNote() { const id = Date.now().toString(36); await D.fs.writeText(file(id), '# \n\n'); order.unshift(id); await D.store.set('order', order); await load(); select(notes.find((n) => n.id === id)); ta.setSelectionRange(2, 2); }
  function onType() {
    if (!cur) return; const prev = cur.text, now = ta.value; cur.text = now;
    undo.push({ undo: () => { cur.text = prev; ta.value = prev; }, redo: () => { cur.text = now; ta.value = now; } }, { key: cur.id });
    clearTimeout(saveT); saveT = setTimeout(async () => { await D.fs.writeText(file(cur.id), cur.text); status.textContent = L.t('saved'); drawList(); setTimeout(() => (status.textContent = ''), 1500); }, 500);
  }
  async function delNote() { if (!cur || !(await D.dialog.confirm(L.t('confirmDel', { t: titleOf(cur.text) })))) return; await D.fs.remove(file(cur.id)); order = order.filter((i) => i !== cur.id); await D.store.set('order', order); await load(); select(notes[0] ?? null); }
  async function exportNote() { if (!cur) return; const p = await D.dialog.save({ fileName: titleOf(cur.text).replace(/[^\w\- ]+/g, '') + '.md', filters: [{ name: 'Markdown', extensions: ['md'] }] }); if (p) await D.fs.writeText(p, cur.text); }
  async function importNote() { const r = await D.dialog.open({ multiple: true, filters: [{ name: 'Text', extensions: ['md', 'txt'] }] }); for (const p of r ?? []) { const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 5); await D.fs.writeText(file(id), await D.fs.readText(p)); order.unshift(id); } await D.store.set('order', order); await load(); drawList(); }
  function remind() { if (!cur) return; const m = +mins.value, t = titleOf(cur.text); setTimeout(() => D.notify(t, cur?.text.slice(0, 100) ?? '').catch(() => { }), m * 60000); status.textContent = L.t('reminded', { m }); }
  await load(); select(notes[0] ?? null);
  if (!notes.length) await newNote();
  return { destroy: () => root.replaceChildren(), get notes() { return notes; } };
}
