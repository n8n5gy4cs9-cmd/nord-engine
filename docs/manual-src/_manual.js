// Manual runtime: dummies toggle, search, runnable ```nord-live``` snippets. No network, no frameworks.
const html = document.documentElement;
const LS = { get(k) { try { return localStorage.getItem(k); } catch { return null; } }, set(k, v) { try { localStorage.setItem(k, v); } catch { /* private mode */ } } };

// ---- For dummies toggle (persisted; default off)
const tog = document.getElementById('dummies-toggle');
const paint = () => { const on = html.classList.contains('dummies-on'); tog.setAttribute('aria-pressed', on); tog.querySelector('b').textContent = on ? 'on' : 'off'; };
tog.addEventListener('click', () => { html.classList.toggle('dummies-on'); LS.set('nord.manual.dummies', html.classList.contains('dummies-on') ? '1' : '0'); paint(); });
paint();

// ---- search (index is a plain script so it works from file:// and the editor webview)
const q = document.getElementById('q'), res = document.getElementById('results');
let idx = null;
const loadIdx = () => idx ?? (idx = new Promise((ok) => { const s = document.createElement('script'); s.src = 'assets/search-index.js'; s.onload = () => ok(window.NORD_SEARCH); s.onerror = () => ok([]); document.head.append(s); }));
const esc = (s) => s.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
q.addEventListener('input', async () => {
  const terms = q.value.toLowerCase().split(/\s+/).filter(Boolean);
  if (!terms.length) { res.hidden = true; return; }
  const hits = [];
  for (const p of await loadIdx()) {
    const t = p.t.toLowerCase(), x = p.x.toLowerCase();
    let score = 0;
    for (const w of terms) { const a = t.includes(w) ? 10 + (t.startsWith(w) ? 5 : 0) : 0, b = x.includes(w) ? 1 : 0; if (!a && !b) { score = 0; break; } score += a + b; }
    if (score) hits.push([score, p]);
  }
  hits.sort((a, b) => b[0] - a[0]);
  res.innerHTML = hits.slice(0, 12).map(([, p]) => { const i = p.x.toLowerCase().indexOf(terms[0]); const snip = i >= 0 ? p.x.slice(Math.max(0, i - 40), i + 100) : p.x.slice(0, 100); return `<a href="${p.f}"><b>${esc(p.t)}</b> <small>${p.s}</small><small>${esc(snip)}…</small></a>`; }).join('') || '<a>No results</a>';
  res.hidden = false;
});
document.addEventListener('click', (e) => { if (!res.contains(e.target) && e.target !== q) res.hidden = true; });
document.addEventListener('keydown', (e) => { if (e.key === '/' && document.activeElement === document.body) { e.preventDefault(); q.focus(); } if (e.key === 'Escape') { res.hidden = true; q.blur(); } });

// ---- runnable snippets: CodeMirror (vendored) editor + sandboxed iframe running the real core runtime
const lives = document.querySelectorAll('.live');
if (lives.length) {
  let cm = null;
  try { cm = await import('./cm.bundle.js'); } catch { /* fall back to a textarea */ }
  const core = new URL('runtime/core/index.js', location.href).href;
  for (const box of lives) {
    const pre = box.querySelector('.live-src'), code = pre.textContent;
    let get;
    if (cm) {
      const host = document.createElement('div'); pre.replaceWith(host);
      const view = new cm.EditorView({ parent: host, doc: code, extensions: [cm.lineNumbers(), cm.history(), cm.drawSelection(), cm.bracketMatching(), cm.closeBrackets(), cm.keymap.of([...cm.defaultKeymap, ...cm.historyKeymap, ...cm.closeBracketsKeymap, cm.indentWithTab]), cm.javascript(), cm.oneDark, cm.EditorView.theme({ '&': { fontSize: '13px' } })] });
      get = () => view.state.doc.toString();
    } else { const ta = document.createElement('textarea'); ta.value = code; ta.rows = code.split('\n').length + 1; ta.style.cssText = 'width:100%;font:13px monospace;background:var(--code);color:var(--fg);border:0;padding:12px'; pre.replaceWith(ta); get = () => ta.value; }
    const bar = document.createElement('div'); bar.className = 'live-bar';
    bar.innerHTML = '<button>▶ Run</button><button class="ghost">Copy</button><span class="muted">Runs in a sandbox with <code>nord</code> (the core runtime) and <code>log()</code></span>';
    const out = document.createElement('pre'); out.className = 'live-out'; out.textContent = '(output)';
    box.append(bar, out);
    bar.children[1].onclick = () => navigator.clipboard?.writeText(get());
    bar.children[0].onclick = () => {
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
