// @nord {"id":"app.json-viewer","title":"JSON / CSV viewer","category":"apps","tier":["html"],"tags":["json","csv","viewer","tree"],"description":"Paste or open a JSON or CSV file: JSON renders as a collapsible tree, CSV as a sortable table. mount(root, {text})."}
import { h, shell } from './_kit.js';

export function parseCsv(t) { const rows = []; let r = [], f = '', q = false; for (let i = 0; i < t.length; i++) { const c = t[i]; if (q) { if (c === '"' && t[i + 1] === '"') { f += '"'; i++; } else if (c === '"') q = false; else f += c; } else if (c === '"') q = true; else if (c === ',') { r.push(f); f = ''; } else if (c === '\n' || c === '\r') { if (c === '\r' && t[i + 1] === '\n') i++; r.push(f); rows.push(r); r = []; f = ''; } else f += c; } if (f || r.length) { r.push(f); rows.push(r); } return rows; }
const node = (k, v, open = false) => {
  if (v && typeof v === 'object') { const d = h('details', { open }, h('summary', {}, `${k}`, h('span', { class: 'muted' }, Array.isArray(v) ? ` [${v.length}]` : ` {${Object.keys(v).length}}`))); d.style.marginLeft = '14px'; for (const [kk, vv] of Object.entries(v)) d.append(node(kk, vv)); return d; }
  return h('div', { style: { marginLeft: '14px' } }, `${k}: `, h('span', { style: { color: typeof v === 'string' ? '#a3be8c' : '#ebcb8b' } }, JSON.stringify(v)));
};
export function mount(root, { text = '{"hello":"world","list":[1,2,{"a":true}]}' } = {}) {
  const box = shell(root, 'JSON / CSV viewer'), ta = h('textarea', { style: { width: '100%', height: '120px' } }, text), out = h('div', { class: 'card' }), err = h('div', { style: { color: '#bf616a' } });
  const render = () => {
    err.textContent = ''; out.replaceChildren(); const t = ta.value.trim();
    try { out.append(node('root', JSON.parse(t), true)); } catch (e) {
      if (t.includes(',') && t.includes('\n')) { const rows = parseCsv(t), sort = { i: -1, dir: 1 }; const draw = () => { const body = rows.slice(1).sort((a, b) => (sort.i < 0 ? 0 : (a[sort.i] > b[sort.i] ? 1 : -1) * sort.dir)); out.replaceChildren(h('table', { style: { borderCollapse: 'collapse', width: '100%' } }, h('tr', {}, ...rows[0].map((c, i) => h('th', { style: { textAlign: 'left', cursor: 'pointer', borderBottom: '1px solid #4c566a' }, onclick: () => { sort.dir = sort.i === i ? -sort.dir : 1; sort.i = i; draw(); } }, c))), ...body.map((r) => h('tr', {}, ...r.map((c) => h('td', { style: { padding: '2px 8px' } }, c)))))); }; draw(); } else err.textContent = e.message;
    }
  };
  const file = h('input', { type: 'file', accept: '.json,.csv,.txt', onchange: async (e) => { ta.value = await e.target.files[0].text(); render(); } });
  ta.addEventListener('input', render); box.append(file, ta, err, out); render();
  return { destroy: () => root.replaceChildren() };
}
