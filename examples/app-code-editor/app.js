// @nord {"id":"app.code-editor","title":"Code editor (desktop)","category":"apps","tier":["html"],"tags":["editor","code","codemirror","desktop","files"],"description":"A real code editor for Nord desktop apps: file tree, tabs, syntax highlighting (JS/TS/HTML/CSS/JSON/Markdown/Rust/GLSL/TOML), find & replace, multi-cursor, folding, autocomplete, go to line, quick open, themes, autosave, external-change detection, session restore. Uses window.nord.desktop (files, dialogs, menu) and the vendored CodeMirror 6 bundle; in a browser it runs on the virtual app-data files."}
import * as cm from './cm.bundle.js';
import desktop from './nord-desktop.js';

const D = desktop;
const LANGS = {
  js: ['JavaScript', () => cm.javascript()], mjs: ['JavaScript', () => cm.javascript()], cjs: ['JavaScript', () => cm.javascript()], jsx: ['JavaScript (JSX)', () => cm.javascript({ jsx: true })],
  ts: ['TypeScript', () => cm.javascript({ typescript: true })], tsx: ['TypeScript (TSX)', () => cm.javascript({ typescript: true, jsx: true })],
  html: ['HTML', () => cm.html()], htm: ['HTML', () => cm.html()], css: ['CSS', () => cm.css()], json: ['JSON', () => cm.json()], md: ['Markdown', () => cm.markdown()],
  rs: ['Rust', () => cm.rust()], glsl: ['GLSL', () => cm.glsl()], vert: ['GLSL', () => cm.glsl()], frag: ['GLSL', () => cm.glsl()], wgsl: ['WGSL', () => cm.glsl()], toml: ['TOML', () => cm.tomlLang()],
};
const extOf = (p) => (p.split('/').pop().split('.').pop() ?? '').toLowerCase();
const nameOf = (p) => p.split(/[\\/]/).pop().replace(/^appData:/, '');
const join = (a, b) => (a.endsWith('/') || a.endsWith(':') || a.endsWith('\\') ? a + b : a + '/' + b);
const parentOf = (p) => { const i = Math.max(p.lastIndexOf('/'), p.lastIndexOf('\\')); return i < 0 ? 'appData:' : p.slice(0, i) || '/'; };
const SKIP = new Set(['node_modules', '.git', 'target', 'dist', '.DS_Store', '.nord-cache']);

const CSS = `
.ce{--bg:#1e2128;--panel:#252932;--panel2:#2c313c;--fg:#d8dee9;--mut:#8a93a5;--acc:#88c0d0;--bd:#3a404d;--sel:#3b4252;--dirty:#ebcb8b;--err:#bf616a;
 display:flex;flex-direction:column;height:100%;font:13px/1.4 system-ui,sans-serif;background:var(--bg);color:var(--fg);position:relative}
.ce[data-theme=light]{--bg:#fafafa;--panel:#f0f0f2;--panel2:#e6e7ea;--fg:#24292f;--mut:#6b7280;--acc:#0969da;--bd:#d0d4da;--sel:#dbe7f7;--dirty:#b7791f;--err:#cf222e}
.ce *{box-sizing:border-box}.ce button{font:inherit;color:inherit;background:transparent;border:1px solid transparent;border-radius:5px;padding:3px 8px;cursor:pointer}
.ce button:hover{background:var(--panel2)}.ce button:disabled{opacity:.4;cursor:default}
.ce .bar{display:flex;gap:2px;align-items:center;padding:4px 6px;background:var(--panel);border-bottom:1px solid var(--bd);flex-wrap:wrap}
.ce .bar .sp{flex:1}.ce .bar select{max-width:140px}.ce select,.ce input{font:inherit;color:inherit;background:var(--panel2);border:1px solid var(--bd);border-radius:5px;padding:2px 6px}
.ce .main{display:flex;flex:1;min-height:0}.ce .side{width:230px;min-width:120px;overflow:auto;background:var(--panel);border-right:1px solid var(--bd);padding:4px 0}
.ce .side .hd{padding:4px 10px;color:var(--mut);font-size:11px;text-transform:uppercase;letter-spacing:.06em;display:flex;align-items:center;gap:6px}
.ce .tree div.it{display:flex;align-items:center;gap:4px;padding:1px 8px;cursor:pointer;white-space:nowrap;user-select:none}
.ce .tree div.it:hover{background:var(--panel2)}.ce .tree div.it.cur{background:var(--sel)}.ce .tree .acts{margin-left:auto;display:none}.ce .tree div.it:hover .acts{display:flex}
.ce .tree .acts button{padding:0 4px;font-size:11px}.ce .ico{width:14px;text-align:center;color:var(--mut)}
.ce .work{flex:1;display:flex;flex-direction:column;min-width:0}.ce .tabs{display:flex;overflow-x:auto;background:var(--panel);border-bottom:1px solid var(--bd);min-height:30px}
.ce .tab{display:flex;align-items:center;gap:6px;padding:5px 10px;border-right:1px solid var(--bd);cursor:pointer;white-space:nowrap;color:var(--mut)}
.ce .tab.on{background:var(--bg);color:var(--fg);box-shadow:inset 0 2px var(--acc)}.ce .tab .x{opacity:.5;padding:0 3px;border-radius:3px}.ce .tab .x:hover{opacity:1;background:var(--panel2)}
.ce .tab .dot{color:var(--dirty)}.ce .tab .cf{color:var(--err)}
.ce .ed{flex:1;min-height:0;position:relative}.ce .ed .cm-editor{height:100%}.ce .ed .cm-scroller{font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace}
.ce .empty{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;color:var(--mut)}
.ce .status{display:flex;gap:14px;padding:3px 10px;background:var(--panel);border-top:1px solid var(--bd);color:var(--mut);font-size:12px}
.ce .status .sp{flex:1}.ce .modal{position:absolute;inset:0;background:#0008;display:flex;align-items:flex-start;justify-content:center;padding-top:70px;z-index:20}
.ce .box{width:min(520px,92%);background:var(--panel);border:1px solid var(--bd);border-radius:8px;padding:10px;box-shadow:0 10px 40px #0008}
.ce .box input{width:100%;padding:6px 8px}.ce .box .lst{max-height:300px;overflow:auto;margin-top:6px}.ce .box .li{padding:3px 8px;border-radius:4px;cursor:pointer;display:flex;gap:8px}
.ce .box .li.on{background:var(--sel)}.ce .box .li small{color:var(--mut);margin-left:auto}.ce .banner{padding:4px 10px;background:var(--dirty);color:#000;font-size:12px}`;

export async function mount(root) {
  await D.ready;
  const web = D.transport === 'web';
  root.replaceChildren();
  const style = Object.assign(document.createElement('style'), { textContent: CSS });
  const el = (tag, cls, props = {}, ...kids) => { const e = Object.assign(document.createElement(tag), props); if (cls) e.className = cls; e.append(...kids.flat().filter((k) => k != null)); return e; };
  const ui = el('div', 'ce');
  root.append(style, ui);

  // ---- settings & state ----
  const settings = { theme: 'dark', fontSize: 14, wrap: false, autosave: false, tabSize: 2, ...(await D.store.get('settings', {})) };
  const saveSettings = () => D.store.set('settings', settings);
  let rootDir = web ? 'appData:' : null, files = [], tabs = [], active = null, untitled = 0, watchOff = null;
  const expanded = new Set(), listings = new Map();

  // ---- DOM ----
  const bar = el('div', 'bar'), side = el('div', 'side'), tree = el('div', 'tree'), tabbar = el('div', 'tabs'), host = el('div', 'ed'), status = el('div', 'status');
  const empty = el('div', 'empty', {}, el('div', '', { textContent: '⌨  Nord Code Editor', style: 'font-size:20px' }), el('div', '', { textContent: web ? 'Browser mode — files live in this page’s storage. Use New or Open.' : 'Open a file or a folder to start.' }));
  host.append(empty);
  const work = el('div', 'work', {}, tabbar, host);
  const banner = el('div', 'banner', { hidden: true });
  ui.append(bar, banner, el('div', 'main', {}, side, work), status);
  side.append(el('div', 'hd', {}, el('span', '', { textContent: 'Explorer' })), tree);

  const btn = (label, title, fn) => el('button', '', { textContent: label, title, onclick: fn });
  const langSel = el('select', '', { title: 'Language', onchange: () => { if (active) { active.lang = langSel.value; applyLang(active); } } }, [...new Set(Object.values(LANGS).map((l) => l[0]))].map((n) => el('option', '', { value: n, textContent: n })), el('option', '', { value: 'Plain text', textContent: 'Plain text' }));
  bar.append(btn('New', 'New file (Ctrl/Cmd+N)', () => cmds.new()), btn('Open…', 'Open file(s) (Ctrl/Cmd+O)', () => cmds.open()), btn('Folder…', 'Open folder', () => cmds.openFolder()),
    btn('Save', 'Save (Ctrl/Cmd+S)', () => cmds.save()), btn('Save as…', 'Save as', () => cmds.saveAs()), el('span', '', { textContent: '│', style: 'color:var(--bd)' }),
    btn('Find', 'Find & replace (Ctrl/Cmd+F)', () => cmds.find()), btn('Go to…', 'Go to line (Ctrl/Cmd+G)', () => cmds.gotoLine()), btn('Quick open', 'Quick open (Ctrl/Cmd+P)', () => cmds.quickOpen()),
    btn('Format JSON', 'Pretty-print JSON', () => cmds.formatJson()), el('span', 'sp'), langSel,
    btn('A−', 'Smaller text', () => cmds.zoom(-1)), btn('A+', 'Larger text', () => cmds.zoom(1)), btn('Wrap', 'Toggle word wrap', () => cmds.wrap()), btn('Auto-save', 'Toggle auto-save', () => cmds.autosave()), btn('◐', 'Toggle theme', () => cmds.theme()));
  const sPos = el('span'), sLang = el('span'), sSel = el('span'), sInfo = el('span'), sMsg = el('span', 'sp');
  status.append(sMsg, sSel, sPos, sInfo, sLang);
  const flash = (t) => { sMsg.textContent = t; clearTimeout(flash.t); flash.t = setTimeout(() => (sMsg.textContent = ''), 4000); };

  // ---- modal helpers (window.prompt/confirm are unavailable in webviews) ----
  function modal(build) {
    return new Promise((done) => {
      const back = el('div', 'modal'), box = el('div', 'box');
      const close = (v) => { back.remove(); view?.focus(); done(v); };
      back.onmousedown = (e) => { if (e.target === back) close(null); };
      box.onkeydown = (e) => { if (e.key === 'Escape') close(null); };
      back.append(box); ui.append(back); build(box, close);
    });
  }
  const askText = (title, value = '') => modal((box, close) => {
    const i = el('input', '', { value, placeholder: title, onkeydown: (e) => { if (e.key === 'Enter') close(i.value.trim() || null); } });
    box.append(el('div', '', { textContent: title, style: 'margin-bottom:6px;color:var(--mut)' }), i); setTimeout(() => { i.focus(); i.select(); }, 0);
  });
  const pick = (title, items, getLabel, getHint) => modal((box, close) => {
    let q = '', sel = 0, shown = [];
    const i = el('input', '', { placeholder: title }), lst = el('div', 'lst');
    const score = (s, q) => { s = s.toLowerCase(); let k = 0, sc = 0; for (const ch of q) { const j = s.indexOf(ch, k); if (j < 0) return -1; sc += j - k; k = j + 1; } return 1000 - sc - s.length * 0.1; };
    const draw = () => {
      shown = (q ? items.map((it) => [score(getLabel(it), q.toLowerCase()), it]).filter((x) => x[0] >= 0).sort((a, b) => b[0] - a[0]).map((x) => x[1]) : items).slice(0, 60);
      sel = Math.min(sel, Math.max(0, shown.length - 1));
      lst.replaceChildren(...shown.map((it, n) => el('div', 'li' + (n === sel ? ' on' : ''), { onclick: () => close(it) }, el('span', '', { textContent: getLabel(it) }), el('small', '', { textContent: getHint?.(it) ?? '' }))));
      lst.querySelector('.on')?.scrollIntoView({ block: 'nearest' });
    };
    i.oninput = () => { q = i.value; sel = 0; draw(); };
    i.onkeydown = (e) => { if (e.key === 'ArrowDown') { sel = Math.min(sel + 1, shown.length - 1); draw(); e.preventDefault(); } else if (e.key === 'ArrowUp') { sel = Math.max(sel - 1, 0); draw(); e.preventDefault(); } else if (e.key === 'Enter') close(shown[sel] ?? null); };
    box.append(i, lst); draw(); setTimeout(() => i.focus(), 0);
  });
  const confirmBox = (text) => D.dialog.confirm(text, { title: 'Code editor' });

  // ---- CodeMirror ----
  const comp = { lang: new cm.Compartment(), theme: new cm.Compartment(), wrap: new cm.Compartment(), indent: new cm.Compartment() };
  const lightTheme = [cm.syntaxHighlighting(cm.defaultHighlightStyle, { fallback: true })];
  const themeExt = () => [settings.theme === 'dark' ? cm.oneDark : lightTheme, cm.EditorView.theme({ '&': { fontSize: settings.fontSize + 'px', height: '100%' }, '.cm-content': { caretColor: settings.theme === 'dark' ? '#fff' : '#000' } })];
  const langExt = (name) => { const e = Object.values(LANGS).find((l) => l[0] === name); return e ? e[1]() : []; };
  const dirtyOf = (t) => t.state.doc.length !== t.saved.length || t.state.doc.toString() !== t.saved;

  const run = (fn) => () => { fn(); return true; };
  const keys = cm.keymap.of([
    { key: 'Mod-s', run: run(() => cmds.save()), preventDefault: true }, { key: 'Mod-Shift-s', run: run(() => cmds.saveAs()), preventDefault: true },
    { key: 'Mod-g', run: run(() => cmds.gotoLine()), preventDefault: true }, { key: 'Mod-p', run: run(() => cmds.quickOpen()), preventDefault: true },
    { key: 'Mod-o', run: run(() => cmds.open()), preventDefault: true }, { key: 'Mod-n', run: run(() => cmds.new()), preventDefault: true }, { key: 'Mod-w', run: run(() => cmds.closeTab()), preventDefault: true },
    { key: 'Mod-d', run: cm.selectNextOccurrence, preventDefault: true }, { key: 'Mod-/', run: cm.toggleComment }, { key: 'Mod-=', run: run(() => cmds.zoom(1)) }, { key: 'Mod--', run: run(() => cmds.zoom(-1)) },
    cm.indentWithTab, ...cm.closeBracketsKeymap, ...cm.defaultKeymap, ...cm.searchKeymap, ...cm.historyKeymap, ...cm.foldKeymap, ...cm.completionKeymap,
  ]);
  const baseExts = () => [
    cm.lineNumbers(), cm.highlightActiveLineGutter(), cm.highlightSpecialChars(), cm.history(), cm.foldGutter(), cm.drawSelection(), cm.dropCursor(), cm.EditorState.allowMultipleSelections.of(true),
    cm.indentOnInput(), cm.bracketMatching(), cm.closeBrackets(), cm.autocompletion(), cm.rectangularSelection(), cm.crosshairCursor(), cm.highlightActiveLine(), cm.highlightSelectionMatches(), keys,
    comp.theme.of(themeExt()), comp.wrap.of(settings.wrap ? cm.EditorView.lineWrapping : []), comp.indent.of(cm.indentUnit.of(' '.repeat(settings.tabSize))),
    cm.EditorState.tabSize.of(settings.tabSize),
    cm.EditorView.updateListener.of((u) => { if (u.docChanged) onChange(); if (u.docChanged || u.selectionSet) updateStatus(); }),
  ];
  const makeState = (t, text) => cm.EditorState.create({ doc: text, extensions: [baseExts(), comp.lang.of(langExt(t.lang))] });
  let view = new cm.EditorView({ parent: host, state: cm.EditorState.create({ doc: '' }) });
  view.dom.style.display = 'none';
  host.append(view.dom);

  // ---- tabs ----
  const langFor = (path) => LANGS[extOf(path)]?.[0] ?? 'Plain text';
  function applyLang(t) { if (t === active) view.dispatch({ effects: comp.lang.reconfigure(langExt(t.lang)) }); else t.state = t.state.update({ effects: comp.lang.reconfigure(langExt(t.lang)) }).state; updateStatus(); }
  function addTab(path, text) {
    const t = { path, name: path ? nameOf(path) : `Untitled-${++untitled}`, saved: text, lang: langFor(path ?? ''), state: null, conflict: false };
    t.state = makeState(t, text); tabs.push(t); return t;
  }
  function show(t) {
    if (active && active !== t) active.state = view.state;
    active = t;
    if (t) { view.setState(t.state); view.dom.style.display = ''; empty.style.display = 'none'; view.focus(); langSel.value = t.lang; } else { view.dom.style.display = 'none'; empty.style.display = ''; }
    drawTabs(); drawTree(); updateStatus(); persistSession();
  }
  function drawTabs() {
    tabbar.replaceChildren(...tabs.map((t) => {
      const dirty = t === active ? dirtyOf({ state: view.state, saved: t.saved }) : dirtyOf(t);
      t.dirty = dirty;
      return el('div', 'tab' + (t === active ? ' on' : ''), { title: t.path ?? 'unsaved', onclick: () => show(t), onauxclick: (e) => { if (e.button === 1) closeTab(t); } },
        t.conflict ? el('span', 'cf', { textContent: '⚠', title: 'Changed on disk' }) : null, el('span', '', { textContent: t.name }), dirty ? el('span', 'dot', { textContent: '●' }) : null,
        el('span', 'x', { textContent: '×', onclick: (e) => { e.stopPropagation(); closeTab(t); } }));
    }));
    document.title = (active ? `${active.dirty ? '● ' : ''}${active.name} — ` : '') + 'Code Editor';
  }
  async function closeTab(t = active) {
    if (!t) return;
    if (t === active) t.state = view.state;
    if (dirtyOf(t) && !(await confirmBox(`Discard unsaved changes to ${t.name}?`))) return;
    const i = tabs.indexOf(t); tabs.splice(i, 1);
    if (t === active) { active = null; show(tabs[Math.min(i, tabs.length - 1)] ?? null); } else drawTabs();
  }
  function updateStatus() {
    if (!active) { sPos.textContent = sSel.textContent = sInfo.textContent = sLang.textContent = ''; return; }
    const s = view.state, h = s.selection.main, ln = s.doc.lineAt(h.head);
    sPos.textContent = `Ln ${ln.number}, Col ${h.head - ln.from + 1}`;
    sSel.textContent = s.selection.ranges.length > 1 ? `${s.selection.ranges.length} cursors` : h.empty ? '' : `${Math.abs(h.to - h.from)} selected`;
    sInfo.textContent = `${s.doc.lines} lines · Spaces: ${settings.tabSize} · UTF-8 · ${s.doc.toString().includes('\r\n') ? 'CRLF' : 'LF'}`;
    sLang.textContent = active.lang; drawTabs();
  }
  let autoT;
  function onChange() {
    drawTabs();
    if (settings.autosave && active?.path) { clearTimeout(autoT); autoT = setTimeout(() => cmds.save(), 900); }
  }

  // ---- files ----
  async function openPath(path, { quiet } = {}) {
    const ex = tabs.find((t) => t.path === path);
    if (ex) return show(ex);
    try {
      const st = await D.fs.stat(path);
      if (st.size > 5_000_000 && !(await confirmBox(`${nameOf(path)} is ${(st.size / 1e6).toFixed(1)} MB. Open anyway?`))) return;
      const text = await D.fs.readText(path);
      show(addTab(path, text));
      rememberRecent(path);
    } catch (e) { if (!quiet) { D.dialog.message(`Cannot open ${nameOf(path)}: ${e.message}`, { level: 'error' }); } }
  }
  const rememberRecent = async (p) => { const r = (await D.store.get('recent', [])).filter((x) => x !== p); r.unshift(p); D.store.set('recent', r.slice(0, 15)); };
  async function saveTab(t, path) {
    if (t === active) t.state = view.state;
    const target = path ?? t.path;
    const text = t.state.doc.toString();
    try {
      await D.fs.writeText(target, text);
      t.path = target; t.name = nameOf(target); t.saved = text; t.conflict = false;
      const nl = langFor(target); if (nl !== t.lang && t.lang === langFor(t.path ?? '')) { t.lang = nl; }
      flash(`Saved ${t.name}`); drawTabs(); drawTree(); rememberRecent(target); persistSession(); return true;
    } catch (e) { D.dialog.message(`Save failed: ${e.message}`, { level: 'error' }); return false; }
  }
  async function walk(dir, out = [], depth = 0) {
    if (out.length > 5000 || depth > 8) return out;
    let list = []; try { list = await D.fs.list(dir); } catch { return out; }
    for (const e of list) { if (SKIP.has(e.name) || e.name.startsWith('.')) continue; const p = join(dir, e.name); if (e.isDir) await walk(p, out, depth + 1); else out.push(p); }
    return out;
  }
  async function loadDir(dir) { try { listings.set(dir, (await D.fs.list(dir)).filter((e) => !SKIP.has(e.name))); } catch { listings.set(dir, []); } }
  async function setRoot(dir) {
    rootDir = dir; expanded.clear(); expanded.add(dir); listings.clear(); await loadDir(dir); drawTree();
    files = []; walk(dir).then((f) => { files = f; });
    watchOff?.(); watchOff = null;
    if (!web) try { watchOff = await D.fs.watch(dir, onFsEvent, { recursive: true, interval: 1500 }); } catch { /* no watch permission */ }
    persistSession();
  }
  async function onFsEvent(e) {
    const abs = e.path;
    const t = tabs.find((x) => x.path === abs || (x.path && abs.endsWith(x.path)));
    if (t && e.kind === 'modified') {
      try {
        const text = await D.fs.readText(t.path);
        if (text === t.saved) return;
        if (!(t === active ? dirtyOf({ state: view.state, saved: t.saved }) : dirtyOf(t))) { t.saved = text; t.state = makeState(t, text); if (t === active) view.setState(t.state); flash(`${t.name} reloaded (changed on disk)`); }
        else { t.conflict = true; }
        drawTabs();
      } catch { /* deleted meanwhile */ }
    }
    const dir = parentOf(abs); if (listings.has(dir)) { await loadDir(dir); drawTree(); }
    files = [];
  }

  function drawTree() {
    if (!rootDir) { tree.replaceChildren(el('div', '', { textContent: web ? '' : 'No folder open', style: 'padding:6px 12px;color:var(--mut)' }), web ? null : btn('Open folder…', '', () => cmds.openFolder())); return; }
    const rows = [];
    const rec = (dir, depth) => {
      for (const e of listings.get(dir) ?? []) {
        const p = join(dir, e.name), open = expanded.has(p);
        rows.push(el('div', 'it' + (active?.path === p ? ' cur' : ''), { style: `padding-left:${8 + depth * 14}px`, title: p,
          onclick: async () => { if (e.isDir) { if (open) expanded.delete(p); else { expanded.add(p); if (!listings.has(p)) await loadDir(p); } drawTree(); } else openPath(p); } },
          el('span', 'ico', { textContent: e.isDir ? (open ? '▾' : '▸') : '·' }), el('span', '', { textContent: e.name }),
          el('span', 'acts', {}, ...(e.isDir ? [el('button', '', { textContent: '＋', title: 'New file here', onclick: (ev) => { ev.stopPropagation(); cmds.newIn(p); } })] : []),
            el('button', '', { textContent: '✎', title: 'Rename', onclick: (ev) => { ev.stopPropagation(); cmds.rename(p, e.isDir); } }), el('button', '', { textContent: '🗑', title: 'Delete', onclick: (ev) => { ev.stopPropagation(); cmds.remove(p, e.isDir); } }))));
        if (e.isDir && open) rec(p, depth + 1);
      }
    };
    rows.push(el('div', 'it', { style: 'font-weight:600', title: rootDir }, el('span', 'ico', { textContent: '▾' }), el('span', '', { textContent: nameOf(rootDir) || rootDir }),
      el('span', 'acts', {}, el('button', '', { textContent: '＋', title: 'New file', onclick: () => cmds.newIn(rootDir) }), el('button', '', { textContent: '⟳', title: 'Refresh', onclick: () => refresh() }))));
    rec(rootDir, 1);
    tree.replaceChildren(...rows);
  }
  async function refresh() { if (!rootDir) return; for (const d of [...listings.keys()]) await loadDir(d); drawTree(); files = []; walk(rootDir).then((f) => { files = f; }); }

  // ---- commands ----
  const FILTERS = [{ name: 'Code', extensions: Object.keys(LANGS).concat(['txt', 'yml', 'yaml', 'xml', 'svg', 'sh', 'py', 'lock']) }];
  const cmds = {
    async new() { show(addTab(null, '')); },
    async newIn(dir) {
      const n = await askText('New file name', ''); if (!n) return;
      const p = join(dir, n); try { if (await D.fs.exists(p)) return D.dialog.message(`${n} already exists`, { level: 'warning' }); await D.fs.writeText(p, ''); await loadDir(dir); expanded.add(dir); openPath(p); } catch (e) { D.dialog.message(e.message, { level: 'error' }); }
    },
    async open() { const r = await D.dialog.open({ multiple: true, title: 'Open file' }); if (r) for (const p of r) await openPath(p); },
    async openFolder() { if (web) return D.dialog.message('Folders need the desktop app.'); const d = await D.dialog.folder({ title: 'Open folder' }); if (d) await setRoot(d); },
    async save() { if (!active) return; return active.path ? saveTab(active) : cmds.saveAs(); },
    async saveAs() { if (!active) return; const p = await D.dialog.save({ title: 'Save as', fileName: active.name }); return p ? saveTab(active, p) : false; },
    find() { view.focus(); cm.openSearchPanel(view); },
    async gotoLine() { if (!active) return; const v = await askText(`Go to line (1–${view.state.doc.lines})`); const n = parseInt(v ?? '', 10); if (n > 0) { const ln = view.state.doc.line(Math.min(n, view.state.doc.lines)); view.dispatch({ selection: { anchor: ln.from }, effects: cm.EditorView.scrollIntoView(ln.from, { y: 'center' }) }); view.focus(); } },
    async quickOpen() {
      if (!rootDir) return D.dialog.message('Open a folder first.');
      if (!files.length) files = await walk(rootDir);
      const f = await pick('Go to file…', files, (p) => nameOf(p), (p) => p.replace(rootDir, '').replace(/^[\\/]/, '')); if (f) openPath(f);
    },
    formatJson() { if (!active) return; try { const t = JSON.stringify(JSON.parse(view.state.doc.toString()), null, settings.tabSize); view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: t + '\n' } }); } catch (e) { flash('Not valid JSON: ' + e.message); } },
    zoom(d) { settings.fontSize = Math.max(9, Math.min(32, settings.fontSize + d)); applySettings(); },
    wrap() { settings.wrap = !settings.wrap; applySettings(); flash(`Word wrap ${settings.wrap ? 'on' : 'off'}`); },
    autosave() { settings.autosave = !settings.autosave; saveSettings(); flash(`Auto-save ${settings.autosave ? 'on' : 'off'}`); },
    theme() { settings.theme = settings.theme === 'dark' ? 'light' : 'dark'; applySettings(); },
    closeTab() { return closeTab(); },
    async rename(p, isDir) { const n = await askText('Rename to', nameOf(p)); if (!n || n === nameOf(p)) return; const to = join(parentOf(p), n); try { await D.fs.rename(p, to); const t = tabs.find((x) => x.path === p); if (t) { t.path = to; t.name = n; t.lang = langFor(to); applyLang(t); } await refresh(); } catch (e) { D.dialog.message(e.message, { level: 'error' }); } },
    async remove(p, isDir) { if (!(await confirmBox(`Delete ${nameOf(p)}${isDir ? ' and everything in it' : ''}?`))) return; try { await D.fs.remove(p, { recursive: isDir }); const t = tabs.find((x) => x.path === p); if (t) { t.saved = '\u0000'; await closeTab(t); } await refresh(); } catch (e) { D.dialog.message(e.message, { level: 'error' }); } },
  };
  function applySettings() {
    const eff = [comp.theme.reconfigure(themeExt()), comp.wrap.reconfigure(settings.wrap ? cm.EditorView.lineWrapping : []), comp.indent.reconfigure(cm.indentUnit.of(' '.repeat(settings.tabSize)))];
    if (active) view.dispatch({ effects: eff });
    for (const t of tabs) if (t !== active) t.state = t.state.update({ effects: eff }).state;
    ui.dataset.theme = settings.theme; saveSettings();
  }
  ui.dataset.theme = settings.theme;

  // ---- session, menu, drop, quit ----
  function persistSession() { D.store.set('session', { root: web ? null : rootDir, tabs: tabs.filter((t) => t.path).map((t) => t.path), active: active?.path ?? null }).catch(() => { }); }
  if (!web) {
    const item = (id, label, accelerator) => ({ id, label, accelerator });
    D.menu.set([
      { label: 'File', items: [item('new', 'New', 'Cmd+N'), item('open', 'Open…', 'Cmd+O'), item('openFolder', 'Open Folder…', 'Cmd+Shift+O'), { separator: true }, item('save', 'Save', 'Cmd+S'), item('saveAs', 'Save As…', 'Cmd+Shift+S'), item('closeTab', 'Close Tab', 'Cmd+W'), { separator: true }, { role: 'quit' }] },
      { label: 'Edit', items: [{ role: 'undo' }, { role: 'redo' }, { separator: true }, { role: 'cut' }, { role: 'copy' }, { role: 'paste' }, { role: 'selectAll' }, { separator: true }, item('find', 'Find & Replace', 'Cmd+F'), item('gotoLine', 'Go to Line…', 'Cmd+G'), item('quickOpen', 'Quick Open…', 'Cmd+P')] },
      { label: 'View', items: [item('zoomIn', 'Zoom In', 'Cmd+='), item('zoomOut', 'Zoom Out', 'Cmd+-'), item('wrap', 'Toggle Word Wrap'), item('theme', 'Toggle Theme'), { role: 'fullscreen' }] },
    ]).catch(() => { });
    let last = ['', 0];
    D.on('menu', ({ id }) => { const now = Date.now(); if (last[0] === id && now - last[1] < 200) return; last = [id, now]; (id === 'zoomIn' ? () => cmds.zoom(1) : id === 'zoomOut' ? () => cmds.zoom(-1) : cmds[id])?.(); });
    D.on('open', async ({ files: fs }) => { for (const p of fs ?? []) await openPath(p); });
    D.app.launch().then(async (l) => { for (const p of l.files ?? []) await openPath(p); }).catch(() => { });
    D.app.setQuitGuard(true).catch(() => { });
    D.on('quit-requested', async () => { const dirty = tabs.filter((t) => (t === active ? dirtyOf({ state: view.state, saved: t.saved }) : dirtyOf(t))); if (!dirty.length || (await confirmBox(`${dirty.length} file(s) have unsaved changes. Quit anyway?`))) D.app.setQuitGuard(false).then(() => D.app.quit()); });
  }
  D.on('drop', async ({ files: fs, paths }) => { for (const p of paths ?? []) await openPath(p); if (!paths && fs) for (const f of fs) { const p = join('appData:', 'dropped/' + f.name); await D.fs.writeText(p, await f.text()); await openPath(p); } });
  window.addEventListener('beforeunload', (e) => { if (web && tabs.some((t) => dirtyOf(t))) e.preventDefault(); });

  // ---- restore ----
  const ses = await D.store.get('session', null); // read before setRoot() persists an empty session
  if (web) { await loadDir('appData:'); await setRoot('appData:'); }
  if (ses && !web && ses.root) { try { await setRoot(ses.root); } catch { /* folder gone */ } }
  for (const p of ses?.tabs ?? []) await openPath(p, { quiet: true });
  const want = tabs.find((t) => t.path === ses?.active); if (want) show(want); else if (!tabs.length) { drawTree(); }
  if (web && !tabs.length) { await D.fs.writeText('welcome.md', '# Welcome\n\nThis is the Nord code editor running in a browser.\n\n- **Ctrl/Cmd+S** save · **Ctrl/Cmd+P** quick open · **Ctrl/Cmd+G** go to line\n- **Ctrl/Cmd+D** select next occurrence (multi-cursor) · **Ctrl/Cmd+/** comment\n\n```js\nconst answer = 6 * 7;\nconsole.log(`The answer is ${answer}`);\n```\n').catch(() => { }); await refresh(); await openPath('appData:welcome.md'); }

  return { destroy: () => { watchOff?.(); root.replaceChildren(); }, openPath, get tabs() { return tabs; }, get view() { return view; } };
}
