// @nord {"id":"app.clipboard-manager","title":"Clipboard manager (desktop)","category":"apps","tier":["html"],"tags":["clipboard","tray","global-shortcut","history","desktop"],"description":"Keeps a searchable history of copied text (pin, dedupe, clear), puts any entry back on the clipboard with one click, adds a tray icon + menu, and a global shortcut (Ctrl+Alt+V) that cycles through the history. Needs permissions clipboard:'read', tray, globalShortcuts, notifications."}
import desktop from './nord-desktop.js';

const D = desktop;
const CSS = `.cb{font:14px system-ui;background:#1e222a;color:#d8dee9;height:100%;display:flex;flex-direction:column;padding:12px;gap:8px}.cb *{box-sizing:border-box}.cb input,.cb button{font:inherit;color:inherit;background:#2b303b;border:1px solid #3a404d;border-radius:6px;padding:5px 10px}.cb button{cursor:pointer}
.cb .list{flex:1;overflow:auto}.cb .it{background:#272c36;border:1px solid #3a404d;border-radius:8px;padding:8px 10px;margin-bottom:6px;cursor:pointer;white-space:pre-wrap;word-break:break-word;max-height:5.5em;overflow:hidden;position:relative}.cb .it:hover{border-color:#88c0d0}.cb .it.pin{border-left:3px solid #ebcb8b}.cb .it small{position:absolute;right:8px;top:4px;color:#8a93a5}.cb .row{display:flex;gap:8px;align-items:center}.cb .m{color:#8a93a5;font-size:12px}`;

export async function mount(root) {
  await D.ready;
  document.head.append(Object.assign(document.createElement('style'), { textContent: CSS }));
  const el = (t, c, p = {}, ...k) => { const e = Object.assign(document.createElement(t), p); if (c) e.className = c; e.append(...k.flat().filter((x) => x != null)); return e; };
  let hist = await D.store.get('history', []), filter = '', last = null, cycle = 0;
  const q = el('input', '', { placeholder: 'Search history…', style: 'flex:1', oninput: () => { filter = q.value.toLowerCase(); draw(); } }), list = el('div', 'list'), info = el('span', 'm');
  const clear = el('button', '', { textContent: 'Clear unpinned', onclick: async () => { hist = hist.filter((h) => h.pin); await save(); draw(); } });
  root.replaceChildren(el('div', 'cb', {}, el('div', 'row', {}, q, clear), el('div', 'm', { textContent: 'Click an entry to copy it again · right-click to pin · Ctrl+Alt+V cycles the history (global)' }), list, info));
  const save = () => D.store.set('history', hist.slice(0, 300));
  function draw() {
    const shown = hist.filter((h) => !filter || h.text.toLowerCase().includes(filter));
    list.replaceChildren(...shown.map((h) => el('div', 'it' + (h.pin ? ' pin' : ''), { title: new Date(h.ts).toLocaleString(), onclick: async () => { last = h.text; await D.clipboard.writeText(h.text); }, oncontextmenu: async (e) => { e.preventDefault(); h.pin = !h.pin; await save(); draw(); } }, el('small', '', { textContent: h.text.length + ' chars' }), h.text.slice(0, 400))));
    info.textContent = `${hist.length} entries`; D.notify.setBadge(hist.length ? hist.length : null).catch(() => { });
  }
  async function poll() {
    try { const t = await D.clipboard.readText(); if (t && t !== last && t.trim()) { last = t; hist = [{ text: t, ts: Date.now(), pin: hist.find((h) => h.text === t)?.pin }, ...hist.filter((h) => h.text !== t)]; await save(); draw(); } } catch { /* clipboard busy or not permitted */ }
  }
  const timer = setInterval(poll, 1000); poll();
  await D.tray.set({ tooltip: 'Clipboard manager', items: [{ id: 'show', label: 'Show history' }, { id: 'clear', label: 'Clear unpinned' }, { separator: true }, { id: 'quit', label: 'Quit' }] }).catch(() => { });
  D.on('tray', () => D.notify('Clipboard', `${hist.length} entries`).catch(() => { }));
  D.on('menu', async ({ id }) => { if (id === 'clear') { hist = hist.filter((h) => h.pin); await save(); draw(); } else if (id === 'quit') D.app.quit(); });
  await D.shortcut.register('cycle', 'Ctrl+Alt+V', async () => { if (!hist.length) return; cycle = (cycle + 1) % hist.length; last = hist[cycle].text; await D.clipboard.writeText(last); D.notify('Clipboard', last.slice(0, 80)).catch(() => { }); }).catch(() => { });
  draw();
  return { destroy: () => { clearInterval(timer); D.tray.remove().catch(() => { }); root.replaceChildren(); } };
}
