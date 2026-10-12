// @nord {"id":"app.markdown-editor","title":"Markdown editor (desktop)","category":"apps","tier":["html"],"tags":["markdown","editor","preview","codemirror","desktop"],"description":"Split-view Markdown editor: CodeMirror 6 on the left, live sanitised preview (vendored marked) on the right, open/save through native dialogs, export to standalone HTML, word/character count, synced scrolling, drag a .md file onto the window to open it."}
import * as cm from './cm.bundle.js';
import desktop from './nord-desktop.js';
import { followSystemTheme } from './_ux.js';

const D = desktop;
const CSS = `.me{font:14px system-ui;display:flex;flex-direction:column;height:100%;background:var(--bg);color:var(--fg)}:root{--bg:#fafafa;--fg:#24292f;--p:#f0f0f2;--b:#d0d4da}:root[data-theme=dark]{--bg:#1e2128;--fg:#d8dee9;--p:#252932;--b:#3a404d}.me *{box-sizing:border-box}
.me .bar{display:flex;gap:6px;padding:6px;background:var(--p);border-bottom:1px solid var(--b);align-items:center}.me button{font:inherit;color:inherit;background:transparent;border:1px solid var(--b);border-radius:6px;padding:3px 10px;cursor:pointer}.me .sp{flex:1}.me .main{flex:1;display:flex;min-height:0}.me .ed{flex:1;min-width:0;border-right:1px solid var(--b)}.me .ed .cm-editor{height:100%}
.me .pv{flex:1;overflow:auto;padding:16px 24px;line-height:1.6}.me .pv pre{background:var(--p);padding:10px;border-radius:6px;overflow:auto}.me .pv code{background:var(--p);padding:0 4px;border-radius:4px}.me .pv img{max-width:100%}.me .pv blockquote{border-left:3px solid var(--b);margin-left:0;padding-left:12px;color:#8a93a5}.me .pv table{border-collapse:collapse}.me .pv td,.me .pv th{border:1px solid var(--b);padding:4px 8px}.me .st{padding:2px 10px;background:var(--p);border-top:1px solid var(--b);font-size:12px;color:#8a93a5;display:flex;gap:14px}`;
const loadScript = (src) => new Promise((ok, no) => { const s = Object.assign(document.createElement('script'), { src, onload: ok, onerror: no }); document.head.append(s); });
/** marked output comes from a file we did not write: drop scripts, event handlers and javascript: URLs. */
export function sanitize(html) {
  const d = new DOMParser().parseFromString(html, 'text/html');
  d.querySelectorAll('script,style,iframe,object,embed,link,meta,form').forEach((n) => n.remove());
  d.querySelectorAll('*').forEach((n) => [...n.attributes].forEach((a) => { if (/^on/i.test(a.name) || (/^(href|src|xlink:href)$/i.test(a.name) && /^\s*(javascript|data:text\/html)/i.test(a.value))) n.removeAttribute(a.name); }));
  return d.body.innerHTML;
}

export async function mount(root) {
  await D.ready;
  document.head.append(Object.assign(document.createElement('style'), { textContent: CSS }));
  await loadScript('./marked.umd.js');
  const el = (t, c, p = {}, ...k) => { const e = Object.assign(document.createElement(t), p); if (c) e.className = c; e.append(...k.flat().filter((x) => x != null)); return e; };
  let path = null, saved = '', view;
  const theme = new cm.Compartment(), pv = el('div', 'pv'), host = el('div', 'ed'), st = el('div', 'st'), title = el('span', 'sp', { textContent: 'Untitled.md' });
  const btn = (t, f) => el('button', '', { textContent: t, onclick: f });
  root.replaceChildren(el('div', 'me', {}, el('div', 'bar', {}, btn('New', () => load(null, '')), btn('Open…', open), btn('Save', save), btn('Save as…', () => save(true)), btn('Export HTML…', exportHtml), title), el('div', 'main', {}, host, pv), st));
  const render = () => { const t = view.state.doc.toString(); pv.innerHTML = sanitize(window.marked.parse(t)); const w = (t.match(/\S+/g) ?? []).length; st.textContent = ''; st.append(el('span', '', { textContent: `${w} words` }), el('span', '', { textContent: `${t.length} chars` }), el('span', '', { textContent: `${view.state.doc.lines} lines` }), el('span', '', { textContent: t === saved ? 'saved' : 'modified' })); title.textContent = (path ? path.split(/[\\/]/).pop() : 'Untitled.md') + (t === saved ? '' : ' ●'); };
  view = new cm.EditorView({ parent: host, state: cm.EditorState.create({ doc: '', extensions: [cm.lineNumbers(), cm.history(), cm.drawSelection(), cm.highlightActiveLine(), cm.bracketMatching(), cm.closeBrackets(), cm.markdown(), cm.syntaxHighlighting(cm.defaultHighlightStyle, { fallback: true }), cm.EditorView.lineWrapping, theme.of(document.documentElement.dataset.theme === 'dark' ? cm.oneDark : []), cm.keymap.of([{ key: 'Mod-s', run: () => { save(); return true; }, preventDefault: true }, { key: 'Mod-o', run: () => { open(); return true; }, preventDefault: true }, ...cm.closeBracketsKeymap, ...cm.defaultKeymap, ...cm.historyKeymap, ...cm.searchKeymap, cm.indentWithTab]), cm.EditorView.updateListener.of((u) => { if (u.docChanged) render(); })] }) });
  followSystemTheme(document.documentElement, (t) => view?.dispatch({ effects: theme.reconfigure(t === 'dark' ? cm.oneDark : []) }));
  view.scrollDOM.addEventListener('scroll', () => { const s = view.scrollDOM; pv.scrollTop = (s.scrollTop / Math.max(1, s.scrollHeight - s.clientHeight)) * (pv.scrollHeight - pv.clientHeight); });
  function load(p, text) { path = p; saved = text; view.setState(view.state.update({ changes: { from: 0, to: view.state.doc.length, insert: text } }).state); render(); }
  async function open() { const r = await D.dialog.open({ filters: [{ name: 'Markdown', extensions: ['md', 'markdown', 'txt'] }] }); if (r?.[0]) load(r[0], await D.fs.readText(r[0])); }
  async function save(as) { const t = view.state.doc.toString(); if (!path || as) { const p = await D.dialog.save({ fileName: path?.split(/[\\/]/).pop() ?? 'untitled.md', filters: [{ name: 'Markdown', extensions: ['md'] }] }); if (!p) return; path = p; } await D.fs.writeText(path, t); saved = t; render(); }
  async function exportHtml() { const p = await D.dialog.save({ fileName: (path?.split(/[\\/]/).pop() ?? 'document').replace(/\.\w+$/, '') + '.html', filters: [{ name: 'HTML', extensions: ['html'] }] }); if (p) await D.fs.writeText(p, `<!doctype html><meta charset=utf-8><title>${title.textContent}</title><body style="font:16px/1.6 system-ui;max-width:48rem;margin:2rem auto;padding:0 1rem">${pv.innerHTML}`); }
  D.on('drop', async ({ paths }) => { if (paths?.[0]) load(paths[0], await D.fs.readText(paths[0])); });
  D.on('open', async ({ files }) => { if (files?.[0]) load(files[0], await D.fs.readText(files[0])); });
  D.app.launch().then(async (l) => { if (l.files?.[0]) load(l.files[0], await D.fs.readText(l.files[0])); }).catch(() => { });
  load(null, '# Hello\n\nWrite **Markdown** here — the preview updates as you type.\n\n- [x] open / save with native dialogs\n- [x] export to HTML\n\n```js\nconsole.log("hi");\n```\n');
  return { destroy: () => root.replaceChildren(), sanitize };
}
