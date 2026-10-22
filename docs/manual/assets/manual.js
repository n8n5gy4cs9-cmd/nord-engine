// Manual runtime: dummies toggle, search, runnable ```nord-live``` snippets. No network, no frameworks.
const html = document.documentElement;
const LS = { get(k) { try { return localStorage.getItem(k); } catch { return null; } }, set(k, v) { try { localStorage.setItem(k, v); } catch { /* private mode */ } } };

// ---- For dummies toggle (persisted; default off)
const tog = document.getElementById('dummies-toggle');
const paint = () => { const on = html.classList.contains('dummies-on'); tog.setAttribute('aria-pressed', on); tog.querySelector('b').textContent = on ? 'on' : 'off'; };
tog.addEventListener('click', () => { html.classList.toggle('dummies-on'); LS.set('nord.manual.dummies', html.classList.contains('dummies-on') ? '1' : '0'); paint(); });
paint();

// ---- navigation and appearance
const headerSize = new ResizeObserver(() => html.style.setProperty('--header-height', document.querySelector('header').offsetHeight + 'px'));
headerSize.observe(document.querySelector('header'));
const menu = document.getElementById('nav-toggle');
menu.addEventListener('click', () => { const open = document.body.classList.toggle('nav-open'); menu.setAttribute('aria-expanded', String(open)); });
const themeButton = document.getElementById('theme-toggle');
themeButton.addEventListener('click', () => { html.dataset.theme = html.dataset.theme === 'light' ? 'dark' : 'light'; LS.set('nord.manual.theme', html.dataset.theme); themeButton.textContent = html.dataset.theme === 'light' ? 'Dark mode' : 'Light mode'; });
themeButton.textContent = html.dataset.theme === 'light' ? 'Dark mode' : 'Light mode';
async function copyCode(button, code) {
  try {
    if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(code);
    else { const area = document.createElement('textarea'); area.value = code; document.body.append(area); area.select(); if (!document.execCommand('copy')) throw new Error('copy'); area.remove(); }
    button.textContent = 'Copied!';
  } catch { button.textContent = 'Select to copy'; }
  setTimeout(() => { button.textContent = 'Copy'; }, 1800);
}

// ---- all examples use the existing offline CodeMirror bundle
const cm = window.NORD_CM ?? null;
const languages = { js: 'javascript', javascript: 'javascript', ts: 'javascript', json: 'json', html: 'html', css: 'css', rust: 'rust', toml: 'tomlLang', python: 'python', php: 'php', sql: 'sql', xml: 'xml', md: 'markdown', glsl: 'glsl' };
const highlightStyle = cm?.HighlightStyle.define([
  { tag: cm.tags.keyword, color: 'var(--purple)' }, { tag: [cm.tags.string, cm.tags.regexp], color: 'var(--good)' },
  { tag: [cm.tags.number, cm.tags.bool, cm.tags.null], color: 'var(--warn)' },
  { tag: cm.tags.comment, color: 'var(--muted)', fontStyle: 'italic' }, { tag: cm.tags.function(cm.tags.variableName), color: 'var(--accent)' },
  { tag: [cm.tags.typeName, cm.tags.className], color: 'var(--good)' }, { tag: cm.tags.propertyName, color: 'var(--fg)' }
]);
function codeWrap(frame, bar) {
  let on = LS.get('nord.manual.wrap') !== '0', view = null;
  const compartment = cm ? new cm.Compartment() : null;
  const button = document.createElement('button');
  const paint = () => { frame.classList.toggle('wrap-code', on); button.textContent = `Wrap: ${on ? 'on' : 'off'}`; button.setAttribute('aria-pressed', String(on)); };
  button.setAttribute('aria-label', 'Toggle code word wrap');
  button.onclick = () => { on = !on; LS.set('nord.manual.wrap', on ? '1' : '0'); if (view) view.dispatch({ effects: compartment.reconfigure(on ? cm.EditorView.lineWrapping : []) }); paint(); };
  bar.append(button); paint();
  return { extension: () => compartment.of(on ? cm.EditorView.lineWrapping : []), attach(editor) { view = editor; } };
}
const codeViews = new Map();
const observer = new IntersectionObserver(items => { for (const item of items) if (item.isIntersecting) { codeViews.get(item.target)?.(); codeViews.delete(item.target); observer.unobserve(item.target); } }, { rootMargin: '200px' });
for (const pre of document.querySelectorAll('pre.code')) {
  const code = pre.textContent, lang = pre.dataset.lang || 'text';
  const frame = document.createElement('div'); frame.className = 'code-frame';
  const bar = document.createElement('div'); bar.className = 'code-bar';
  const label = document.createElement('span'); label.textContent = lang;
  const copy = document.createElement('button'); copy.textContent = 'Copy'; copy.setAttribute('aria-label', 'Copy code example'); copy.onclick = () => copyCode(copy, code);
  bar.append(label, copy); pre.before(frame); frame.append(bar, pre);
  const wrap = codeWrap(frame, bar);
  const language = languages[lang] ? cm?.[languages[lang]]?.(lang === 'ts' ? { typescript: true } : {}) : ['bash', 'sh', 'shell'].includes(lang) ? cm?.legacy.shell() : lang === 'yaml' ? cm?.legacy.yaml() : null;
  if (cm && language) {
    const host = document.createElement('div'); pre.replaceWith(host);
    codeViews.set(host, () => { pre.remove(); const view = new cm.EditorView({ parent: host, doc: code, extensions: [wrap.extension(), cm.lineNumbers(), language, cm.syntaxHighlighting(highlightStyle), cm.EditorState.readOnly.of(true), cm.EditorView.editable.of(false), cm.EditorView.contentAttributes.of({ 'aria-label': `${lang} code example` })] }); wrap.attach(view); return view; });
    host.append(pre); observer.observe(host);
  }
}

// ---- search (index is a plain script so it works from file:// and the editor webview)
const q = document.getElementById('q'), res = document.getElementById('results');
let idx = null;
const manualRoot = window.NORD_MANUAL_ROOT ?? '';
const script = src => new Promise(ok => { const s = document.createElement('script'); s.src = manualRoot + src; s.onload = () => ok(true); s.onerror = () => ok(false); document.head.append(s); });
const loadIdx = () => idx ?? (idx = (async () => {
  if (!await script('assets/search-manifest.js')) return [];
  await Promise.all((window.NORD_SEARCH_FILES ?? []).map(script));
  return Object.values(window.NORD_SEARCH_PARTS ?? {}).flat();
})());
const esc = (s) => s.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
q.addEventListener('input', async () => {
  const query = q.value;
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (!terms.length) { res.hidden = true; return; }
  const hits = [];
  for (const p of await loadIdx()) {
    const t = p.t.toLowerCase(), x = p.x.toLowerCase();
    let score = 0;
    for (const w of terms) { const a = t.includes(w) ? 10 + (t.startsWith(w) ? 5 : 0) : 0, b = x.includes(w) ? 1 : 0; if (!a && !b) { score = 0; break; } score += a + b; }
    if (score) hits.push([score + (p.s === 'Engine docs' ? 0 : 4), p]);
  }
  if (q.value !== query) return;
  hits.sort((a, b) => b[0] - a[0]);
  res.innerHTML = hits.slice(0, 12).map(([, p]) => { const i = p.x.toLowerCase().indexOf(terms[0]); const snip = i >= 0 ? p.x.slice(Math.max(0, i - 40), i + 100) : p.x.slice(0, 100); return `<a href="${manualRoot + p.f}"><b>${esc(p.t)}</b> <small>${p.s}</small><small>${esc(snip)}…</small></a>`; }).join('') || '<a>No results</a>';
  res.hidden = false;
});
document.addEventListener('click', (e) => { if (!res.contains(e.target) && e.target !== q) res.hidden = true; });
document.addEventListener('keydown', (e) => { if (e.key === '/' && document.activeElement === document.body) { e.preventDefault(); q.focus(); } if (e.key === 'Escape') { res.hidden = true; q.blur(); } });

// ---- runnable snippets: CodeMirror (vendored) editor + sandboxed iframe running the real core runtime
const lives = document.querySelectorAll('.live');
if (lives.length) {
  const core = new URL(manualRoot + 'runtime/core/index.js', location.href).href;
  for (const box of lives) {
    const pre = box.querySelector('.live-src'), code = pre.textContent;
    const bar = document.createElement('div'); bar.className = 'live-bar';
    bar.innerHTML = '<button>▶ Run</button><button class="ghost">Copy</button>';
    const wrap = codeWrap(box, bar);
    let get;
    if (cm) {
      const host = document.createElement('div'); pre.replaceWith(host);
      const view = new cm.EditorView({ parent: host, doc: code, extensions: [wrap.extension(), cm.lineNumbers(), cm.history(), cm.drawSelection(), cm.bracketMatching(), cm.closeBrackets(), cm.keymap.of([...cm.defaultKeymap, ...cm.historyKeymap, ...cm.closeBracketsKeymap, cm.indentWithTab]), cm.javascript(), cm.syntaxHighlighting(highlightStyle), cm.EditorView.theme({ '&': { fontSize: '13px' } })] });
      wrap.attach(view); get = () => view.state.doc.toString();
    } else { const ta = document.createElement('textarea'); ta.value = code; ta.rows = code.split('\n').length + 1; ta.style.cssText = 'width:100%;font:13px monospace;background:var(--code);color:var(--fg);border:0;padding:12px'; pre.replaceWith(ta); get = () => ta.value; }
    const hint = document.createElement('span'); hint.className = 'muted'; hint.textContent = 'Core runtime + log()'; bar.append(hint);
    const out = document.createElement('pre'); out.className = 'live-out'; out.textContent = '(output)';
    box.append(bar, out);
    bar.children[1].onclick = () => copyCode(bar.children[1], get());
    bar.children[0].onclick = () => {
      if (location.protocol === 'file:') { out.textContent = 'To run this example, open Docs in the Nord editor or serve this manual with a local web server. Reading, search and highlighting work here offline.'; return; }
      out.textContent = '';
      const f = document.createElement('iframe'); f.hidden = true; f.sandbox = 'allow-scripts allow-same-origin';
      const onMsg = (e) => { if (e.source !== f.contentWindow) return; const s = document.createElement('span'); if (e.data.err) s.className = 'err'; s.textContent = e.data.line + '\n'; out.append(s); if (e.data.done) { removeEventListener('message', onMsg); f.remove(); } };
      addEventListener('message', onMsg);
      const src = `import * as nord from ${JSON.stringify(core)};
const send=(line,err,done)=>parent.postMessage({line,err,done},'*');
const fmt=(a)=>a.map(x=>typeof x==='string'?x:JSON.stringify(x)).join(' ');
const log=(...a)=>send(fmt(a));
console.log=log; console.warn=log; console.error=(...a)=>send(fmt(a),true);
try{ await (async()=>{ ${get()}
})(); send('— done',false,true); }catch(e){ send(String(e&&e.stack||e),true,true); }`;
      f.srcdoc = `<script type="module">${src.replace(/<\/script>/g, '<\\/script>')}<\/script>`;
      document.body.append(f);
    };
  }
}

(function(){document.querySelectorAll('.flow').forEach(function(f){var n=f.querySelectorAll('.node');n.forEach(function(el){el.tabIndex=0;el.addEventListener('click',function(){n.forEach(function(o){o.classList.toggle('on',o===el&&!o.classList.contains('on'))})})})})})();
(function(){var g=document.querySelector('.tgrid');if(!g)return;var cards=[].slice.call(g.children),q=document.querySelector('.tsearch'),cnt=document.querySelector('.tcount'),empty=document.querySelector('.tempty'),f='all',l='all';
function run(){var s=q.value.trim().toLowerCase(),n=0;cards.forEach(function(c){var ok=(f==='all'||c.dataset.tags.split(' ').indexOf(f)>-1)&&(l==='all'||c.dataset.level===l)&&(!s||s.split(/\s+/).every(function(w){return c.dataset.q.indexOf(w)>-1}));c.hidden=!ok;if(ok)n++});cnt.textContent=n+' of '+cards.length+' tutorials';empty.hidden=n>0}
function bind(sel,attr,set){document.querySelectorAll(sel).forEach(function(b){b.addEventListener('click',function(){document.querySelectorAll(sel).forEach(function(o){o.classList.toggle('on',o===b)});set(b.dataset[attr]);run()})})}
bind('.tf','f',function(v){f=v});bind('.tl','l',function(v){l=v});q.addEventListener('input',run);run()})();
