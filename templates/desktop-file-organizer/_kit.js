// Shared helpers for the app kits (not a library item). Tiny DOM builder + themed base CSS using the Nord UI variables.
export const css = `.nk{font:15px/1.4 var(--nord-font-ui,Inter,system-ui,sans-serif);color:var(--nord-fg,#eceff4);background:var(--nord-bg,#2e3440);padding:16px;box-sizing:border-box;height:100%;overflow:auto}
.nk *{box-sizing:border-box}.nk h2{margin:0 0 12px;font-size:20px}.nk button,.nk input,.nk select,.nk textarea{font:inherit;color:inherit;background:var(--nord-panel,#3b4252);border:1px solid var(--nord-border,#4c566a);border-radius:6px;padding:6px 10px}
.nk button{cursor:pointer;background:var(--nord-accent,#88c0d0);color:var(--nord-bg,#2e3440);border:0;font-weight:600}.nk button.ghost{background:transparent;color:inherit;border:1px solid var(--nord-border,#4c566a)}
.nk .row{display:flex;gap:8px;align-items:center;margin-bottom:8px}.nk .card{background:var(--nord-panel,#3b4252);border:1px solid var(--nord-border,#4c566a);border-radius:8px;padding:10px;margin-bottom:8px}
.nk .grow{flex:1}.nk .muted{opacity:.6}`;
let injected = false;
export function h(tag, props = {}, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props ?? {})) { if (k.startsWith('on')) el.addEventListener(k.slice(2), v); else if (k === 'class') el.className = v; else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v); else if (v !== false && v != null) el.setAttribute(k, v === true ? '' : v); }
  el.append(...kids.flat().filter((x) => x != null && x !== false));
  return el;
}
export function shell(root, title) {
  if (!injected) { document.head.append(h('style', {}, css)); injected = true; }
  root.replaceChildren(); const box = h('div', { class: 'nk' }, h('h2', {}, title)); root.append(box); return box;
}
export const store = (key, init) => { let v = init; try { v = JSON.parse(localStorage.getItem(key)) ?? init; } catch {} return { get: () => v, set: (n) => { v = n; try { localStorage.setItem(key, JSON.stringify(v)); } catch {} } }; };
