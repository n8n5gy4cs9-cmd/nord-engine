// @nord {"id":"app.file-organizer","title":"File organiser (desktop)","category":"apps","tier":["html"],"tags":["files","organise","duplicates","dialogs","desktop"],"description":"Pick a folder, see its files grouped by type in a virtualised table (handles 10k+ files), preview and apply 'sort into folders' by type or by month with full undo, and find duplicate files by size + SHA-256. Uses window.nord.desktop fs + dialogs; every change is previewed first."}
import desktop from './nord-desktop.js';
import { UndoStack, bindUndoKeys, mountVirtualList } from './_ux.js';

const D = desktop;
const CATS = { Images: 'png jpg jpeg gif webp svg bmp heic', Documents: 'pdf doc docx txt md rtf odt xls xlsx csv ppt pptx', Audio: 'mp3 wav ogg flac m4a', Video: 'mp4 mov mkv avi webm', Archives: 'zip tar gz 7z rar', Code: 'js ts rs py html css json toml sh c cpp h' };
const catOf = (name) => { const e = name.split('.').pop().toLowerCase(); return Object.entries(CATS).find(([, v]) => v.split(' ').includes(e))?.[0] ?? 'Other'; };
const fmt = (n) => (n < 1024 ? `${n} B` : n < 1 << 20 ? `${(n / 1024).toFixed(1)} KB` : `${(n / 1048576).toFixed(1)} MB`);
const CSS = `.fo{font:14px system-ui;background:#1e222a;color:#d8dee9;height:100%;display:flex;flex-direction:column;padding:12px;gap:8px}.fo *{box-sizing:border-box}.fo button,.fo select{font:inherit;color:inherit;background:#2b303b;border:1px solid #3a404d;border-radius:6px;padding:5px 10px;cursor:pointer}.fo button.pri{background:#88c0d0;color:#1e222a;border:0;font-weight:600}.fo button:disabled{opacity:.4}
.fo .row{display:flex;gap:8px;align-items:center;flex-wrap:wrap}.fo .grid{flex:1;min-height:0;border:1px solid #3a404d;border-radius:8px;overflow:hidden}.fo .r{display:flex;gap:10px;padding:0 10px;align-items:center;border-bottom:1px solid #0003;font-size:13px}.fo .r span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.fo .c1{flex:1}.fo .c2{width:90px}.fo .c3{width:100px;text-align:right}.fo .c4{width:150px;color:#8a93a5}
.fo .tag{padding:0 8px;border-radius:999px;background:#3b4252;font-size:12px}.fo .m{color:#8a93a5}`;

export async function mount(root) {
  await D.ready;
  document.head.append(Object.assign(document.createElement('style'), { textContent: CSS }));
  const el = (t, c, p = {}, ...k) => { const e = Object.assign(document.createElement(t), p); if (c) e.className = c; e.append(...k.flat().filter((x) => x != null)); return e; };
  let dir = null, files = [], rows = [], mode = 'files', plan = [];
  const undo = new UndoStack(50); bindUndoKeys(undo);
  const info = el('span', 'm'), gridHost = el('div', 'grid'), by = el('select', '', {}, ['type', 'month'].map((v) => el('option', '', { value: v, textContent: 'by ' + v })));
  const btn = (t, f, c = '') => el('button', c, { textContent: t, onclick: f });
  const applyBtn = btn('Apply plan', apply, 'pri'), undoBtn = btn('Undo', () => { undo.undo(); scan(); });
  root.replaceChildren(el('div', 'fo', {}, el('div', 'row', {}, btn('Choose folder…', choose, 'pri'), btn('Rescan', scan), btn('Preview sort', preview), by, applyBtn, undoBtn, btn('Find duplicates', dupes), info), gridHost));
  const grid = mountVirtualList(gridHost, { count: 0, rowHeight: 28, renderRow: (i) => { const r = rows[i]; return el('div', 'r', {}, el('span', 'c1', { textContent: r.name, title: r.path }), el('span', 'c2', {}, el('span', 'tag', { textContent: r.cat })), el('span', 'c3', { textContent: fmt(r.size) }), el('span', 'c4', { textContent: r.note ?? new Date(r.modified).toLocaleDateString() })); } });
  applyBtn.disabled = true;
  async function choose() { const d = await D.dialog.folder({ title: 'Folder to organise' }); if (d) { dir = d; await scan(); } }
  async function walk(d, out, depth = 0) { for (const e of await D.fs.list(d).catch(() => [])) { const p = d.replace(/[\\/]$/, '') + '/' + e.name; if (e.isDir) { if (depth < 4 && !e.name.startsWith('.')) await walk(p, out, depth + 1); } else if (!e.name.startsWith('.')) out.push({ name: e.name, path: p, size: e.size, modified: e.modified, cat: catOf(e.name) }); } return out; }
  async function scan() { if (!dir) return; mode = 'files'; plan = []; applyBtn.disabled = true; info.textContent = 'Scanning…'; files = await walk(dir, []); rows = files; grid.update(rows.length); const by = {}; files.forEach((f) => (by[f.cat] = (by[f.cat] ?? 0) + 1)); info.textContent = `${files.length} files — ` + Object.entries(by).map(([k, v]) => `${k} ${v}`).join(' · '); undoBtn.disabled = !undo.canUndo; }
  const target = (f) => (by.value === 'type' ? f.cat : new Date(f.modified).toISOString().slice(0, 7));
  function preview() {
    if (!dir) return; plan = files.filter((f) => f.path.slice(0, dir.length + 1 + target(f).length) !== dir.replace(/[\\/]$/, '') + '/' + target(f)).map((f) => ({ ...f, to: `${dir.replace(/[\\/]$/, '')}/${target(f)}/${f.name}` }));
    rows = plan.map((p) => ({ ...p, note: '→ ' + p.to.slice(dir.length + 1) })); mode = 'plan'; grid.update(rows.length); info.textContent = `${plan.length} files would move (nothing changed yet)`; applyBtn.disabled = !plan.length;
  }
  async function apply() {
    if (!plan.length || !(await D.dialog.confirm(`Move ${plan.length} files into subfolders of ${dir}?`))) return;
    const done = []; for (const p of plan) { if (await D.fs.exists(p.to)) continue; try { await D.fs.rename(p.path, p.to); done.push(p); } catch { /* skip */ } }
    undo.push({ undo: async () => { for (const p of done.reverse()) await D.fs.rename(p.to, p.path).catch(() => { }); }, redo: () => { } }); D.notify('Organised', `${done.length} files moved`).catch(() => { }); await scan();
  }
  async function hash(path) { const b = await D.fs.read(path), h = await crypto.subtle.digest('SHA-256', b); return [...new Uint8Array(h)].map((x) => x.toString(16).padStart(2, '0')).join(''); }
  async function dupes() {
    if (!dir) return; info.textContent = 'Hashing…'; const bySize = new Map(); files.filter((f) => f.size > 0 && f.size < 200e6).forEach((f) => bySize.set(f.size, [...(bySize.get(f.size) ?? []), f]));
    const groups = new Map(); for (const g of bySize.values()) if (g.length > 1) for (const f of g) { const h = await hash(f.path).catch(() => null); if (h) groups.set(h, [...(groups.get(h) ?? []), f]); }
    rows = [...groups.values()].filter((g) => g.length > 1).flatMap((g) => g.map((f, i) => ({ ...f, note: i ? 'duplicate' : 'original' }))); mode = 'dupes'; grid.update(rows.length);
    const waste = [...groups.values()].filter((g) => g.length > 1).reduce((a, g) => a + g[0].size * (g.length - 1), 0); info.textContent = `${rows.filter((r) => r.note === 'duplicate').length} duplicates, ${fmt(waste)} reclaimable`;
    if (rows.some((r) => r.note === 'duplicate') && (await D.dialog.confirm('Delete the duplicates (keeps one original per group)?'))) { for (const r of rows.filter((r) => r.note === 'duplicate')) await D.fs.remove(r.path).catch(() => { }); await scan(); }
  }
  return { destroy: () => { grid.destroy(); root.replaceChildren(); } };
}
