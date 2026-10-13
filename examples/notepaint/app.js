import { h } from './_kit.js';
import { openNotebook, newDocument, download, readDocument } from './store.js';
import { createDrawing } from './drawing.js';

const TOOLS = ['pencil', 'brush', 'eraser', 'fill', 'line', 'rectangle', 'ellipse', 'picker'];
const PALETTE = ['#253949', '#267e72', '#f08b62', '#f2c86b', '#9c84bb', '#4a8db7', '#ffffff'];
const icon = index => h('span', { class: 'np-sprite', 'aria-hidden': true, style: { backgroundPosition: `${index % 4 * 100 / 3}% ${Math.floor(index / 4) * 100 / 3}%` } });
const button = (label, index, onClick, primary = false) => h('button', { class: 'np-button' + (primary ? ' primary' : ''), onclick: onClick, title: label }, icon(index), label);
const filename = title => (title.trim().replace(/[<>:"/\\|?*\x00-\x1f]/g, '-').slice(0, 80) || 'Untitled');

export async function mount(root) {
  const style = h('link', { rel: 'stylesheet', href: new URL('style.css', import.meta.url).href }); document.head.append(style);
  let db, documents = [], current, timer, toastTimer, queue = Promise.resolve(), loading = true, disposed = false;
  let activeTool = 'brush', activeColor = PALETTE[0], activeSize = 7;
  const status = h('span', { class: 'np-status', role: 'status', 'aria-live': 'polite' }, 'Opening your notebook…');
  const message = text => { toast.textContent = text; toast.hidden = false; clearTimeout(toastTimer); toastTimer = setTimeout(() => { toast.hidden = true; }, 4200); };
  const title = h('input', { class: 'np-title', maxlength: 120, 'aria-label': 'Document title' });
  const note = h('textarea', { class: 'np-text', spellcheck: true, placeholder: 'An idea, a shopping list, a story…', 'aria-label': 'Note text' });
  const count = h('small', {}, '0 words');
  const canvas = h('canvas', { class: 'np-canvas', width: 960, height: 640, tabindex: 0, 'aria-label': 'Drawing canvas. Choose a tool, then draw with mouse, pen or touch.' });
  const search = h('input', { class: 'np-search', type: 'search', placeholder: 'Find a note…', 'aria-label': 'Search documents' });
  const list = h('div', { class: 'np-docs' });
  const undo = button('Undo', 12, () => drawing.undo()), redo = button('Redo', 13, () => drawing.redo()); undo.disabled = redo.disabled = true;
  const color = h('input', { type: 'color', value: activeColor, 'aria-label': 'Ink colour' });
  const size = h('input', { type: 'range', min: 1, max: 40, value: activeSize, 'aria-label': 'Brush size' });
  const sizeText = h('span', {}, '7 px');
  const toast = h('div', { class: 'np-toast', hidden: true, role: 'status' });
  const importFile = h('input', { type: 'file', accept: '.json,.txt,.md,image/png,image/jpeg,image/webp', hidden: true });
  const help = h('dialog', { class: 'np-help' }, h('h2', {}, 'A notebook, with room to draw.'),
    h('p', {}, 'Every document holds a plain-text note and a 960 × 640 drawing. Both are saved together in this browser. No account or internet connection is needed.'),
    h('ul', {}, h('li', {}, 'Choose a document on the left, or make a new one. Rename it above the two pages.'), h('li', {}, 'Choose a drawing tool. Drag for lines and shapes; click for fill or colour picker. Eraser paints white.'), h('li', {}, 'Undo/Redo applies to the drawing. When typing, your browser handles text undo.'), h('li', {}, 'Export document saves a .notepaint.json file containing text AND drawing. TXT and PNG save the individual parts.'), h('li', {}, 'Import a document to add it to your notebook. Text imports become new notes; image imports replace the active drawing after confirmation.'), h('li', {}, 'Browser data is local to this address. Export files before clearing browser data or moving to another computer.')),
    button('Back to my notebook', 15, () => help.close()));
  const drawing = createDrawing(canvas, info => {
    if (info.color) { activeColor = info.color; color.value = activeColor; setTool('brush'); message('Colour picked. Brush is ready.'); return; }
    undo.disabled = !info.undo; redo.disabled = !info.redo; schedule();
  });
  const toolButtons = TOOLS.map((tool, index) => h('button', { class: 'np-tool', title: tool[0].toUpperCase() + tool.slice(1), 'aria-label': tool, 'aria-pressed': tool === activeTool, onclick: () => setTool(tool) }, icon(index + 4)));
  function setTool(tool) { activeTool = tool; drawing.settings({ tool, color: activeColor, size: activeSize }); toolButtons.forEach((b, i) => { b.classList.toggle('active', TOOLS[i] === tool); b.setAttribute('aria-pressed', String(TOOLS[i] === tool)); }); }
  function drawList() {
    const term = search.value.toLowerCase();
    list.replaceChildren(...documents.filter(d => (d.title + ' ' + d.text).toLowerCase().includes(term)).sort((a, b) => b.updatedAt - a.updatedAt).map(d => h('button', { class: 'np-doc' + (d.id === current?.id ? ' active' : ''), 'aria-current': d.id === current?.id ? 'true' : 'false', onclick: () => select(d) }, h('strong', {}, d.title || 'Untitled'), h('small', {}, d.text.replace(/\s+/g, ' ').slice(0, 35) || 'A fresh page, just for you'))));
    if (!list.children.length) list.append(h('small', {}, 'No matching documents.'));
  }
  function capture() { if (!current || loading) return null; current.title = title.value || 'Untitled'; current.text = note.value; current.image = drawing.png(); current.updatedAt = Date.now(); return { ...current }; }
  function persist() {
    clearTimeout(timer); timer = null; const doc = capture(); if (!doc) return queue;
    status.textContent = 'Saving…'; status.className = 'np-status';
    queue = queue.catch(() => {}).then(() => db.put(doc)).then(() => { if (!disposed && current?.id === doc.id) status.textContent = db.memory ? 'Session only — export to keep' : 'Saved on this device'; }).catch(error => { status.className = 'np-error'; status.textContent = 'Save failed — export your work'; message('Could not save: ' + error.message); });
    drawList(); return queue;
  }
  function schedule() {
    if (loading) return; status.textContent = 'Unsaved changes…'; clearTimeout(timer); timer = setTimeout(persist, 450);
    count.textContent = `${note.value.trim().split(/\s+/).filter(Boolean).length} words · ${note.value.length} characters`;
  }
  async function select(doc) {
    if (loading) return; await persist(); if (disposed) return;
    loading = true; workspace.inert = true; current = doc; title.value = doc.title; note.value = doc.text;
    try { await drawing.load(doc.image); } catch { message('This drawing could not be opened. Your note is still available.'); drawing.load(''); }
    loading = false; workspace.inert = false; undo.disabled = redo.disabled = true; count.textContent = `${note.value.trim().split(/\s+/).filter(Boolean).length} words · ${note.value.length} characters`; drawList();
  }
  async function add(doc) { await persist(); documents.push(doc); try { await db.put({ ...doc }); } catch (error) { message('Could not save locally. Export this document to keep it: ' + error.message); } await select(doc); }
  const newButton = button('New document', 0, () => add(newDocument()), true);
  const duplicate = button('Duplicate', 0, async () => { await persist(); if (current) await add({ ...current, id: newDocument().id, title: current.title + ' copy', updatedAt: Date.now() }); });
  const remove = button('Delete', 14, async () => {
    if (!current || !confirm(`Delete “${current.title}” and its drawing? This cannot be undone.`)) return;
    try {
      await persist(); const id = current.id; await db.remove(id);
      documents = documents.filter(d => d.id !== id); current = null;
      if (!documents.length) { const doc = newDocument(); documents.push(doc); await db.put(doc); }
      await select(documents[0]);
    } catch (error) { message('Could not delete: ' + error.message); }
  });
  const exportDocument = () => { capture(); if (current) { download(filename(current.title) + '.notepaint.json', JSON.stringify({ format: 'notepaint', version: 1, document: current }, null, 2), 'application/json'); message('Document exported: text and drawing together.'); } };
  const header = h('header', { class: 'np-header' }, h('div', { class: 'np-brand' }, icon(15), h('div', {}, h('b', {}, 'notepaint'), h('small', {}, 'Little ideas. Big colours.'))), button('Import', 1, () => importFile.click()), button('Export document', 2, exportDocument, true), button('TXT', 3, () => download(filename(current?.title || 'Note') + '.txt', note.value, 'text/plain;charset=utf-8')), button('PNG', 3, () => canvas.toBlob(blob => blob && download(filename(current?.title || 'Drawing') + '.png', blob, 'image/png'))), button('Help', 15, () => help.showModal()));
  const swatches = h('div', { class: 'np-swatches' }, ...PALETTE.map(value => h('button', { title: value, 'aria-label': 'Use colour ' + value, style: { background: value }, onclick: () => { activeColor = value; color.value = value; drawing.settings({ color: value }); } })));
  const workspace = h('main', { class: 'np-workspace' }, h('div', { class: 'np-title-row' }, title, h('span', { class: 'np-tag' }, 'ONE IDEA · TWO PAGES')),
    h('div', { class: 'np-editors' }, h('section', { class: 'np-note' }, h('div', { class: 'np-panel-head' }, icon(0), 'The words', count), note),
      h('section', { class: 'np-paint' }, h('div', { class: 'np-panel-head' }, icon(5), 'The picture', h('small', {}, '960 × 640 · mouse, pen or touch')), h('div', { class: 'np-tools' }, toolButtons, undo, redo, button('Clear', 14, () => { if (confirm('Clear this drawing? You can undo it.')) drawing.clear(); })), h('div', { class: 'np-options' }, 'Ink', color, 'Size', size, sizeText, swatches), h('div', { class: 'np-canvas-wrap' }, canvas))));
  const app = h('div', { class: 'np-app' }, header, h('div', { class: 'np-body' }, h('aside', { class: 'np-sidebar' }, h('h2', {}, 'Your notebook'), newButton, search, list, h('div', { class: 'np-sidebar-actions' }, duplicate, remove)), workspace), h('footer', { class: 'np-footer' }, status, h('span', {}, 'Cmd/Ctrl+S export · drawing undo: Cmd/Ctrl+Z · Crowelian 2026 + Sonnet')), importFile, help, toast);
  root.replaceChildren(app); workspace.inert = true; newButton.disabled = true;
  title.addEventListener('input', schedule); note.addEventListener('input', schedule); search.addEventListener('input', drawList);
  color.addEventListener('input', () => { activeColor = color.value; drawing.settings({ color: activeColor }); });
  size.addEventListener('input', () => { activeSize = Number(size.value); sizeText.textContent = activeSize + ' px'; drawing.settings({ size: activeSize }); });
  importFile.addEventListener('change', async () => {
    const file = importFile.files[0]; importFile.value = ''; if (!file) return;
    try {
      if (file.size > 16000000) throw new Error('Choose a file under 16 MB.');
      if (file.type.startsWith('image/')) {
        if (!confirm('Replace the current drawing with this image? You can undo the change.')) return;
        const url = URL.createObjectURL(file); try { await drawing.load(url, true); } finally { URL.revokeObjectURL(url); } await persist();
      } else if (file.name.endsWith('.json')) await add(readDocument(JSON.parse(await file.text())));
      else { const doc = newDocument(file.name.replace(/\.[^.]+$/, '')); doc.text = await file.text(); await add(doc); }
      message('Imported. Your existing documents are kept.');
    } catch (error) { message(error.message); }
  });
  const keydown = event => {
    if (loading || !(event.ctrlKey || event.metaKey)) return;
    if (event.key.toLowerCase() === 's') { event.preventDefault(); persist(); exportDocument(); }
    if (event.key.toLowerCase() === 'z' && !['TEXTAREA', 'INPUT'].includes(document.activeElement.tagName)) { event.preventDefault(); event.shiftKey ? drawing.redo() : drawing.undo(); }
    if (event.key.toLowerCase() === 'y' && !['TEXTAREA', 'INPUT'].includes(document.activeElement.tagName)) { event.preventDefault(); drawing.redo(); }
  };
  const saveBeforeLeaving = event => { if (timer) { event.preventDefault(); event.returnValue = ''; persist(); } };
  const visibility = () => { if (document.hidden) persist(); };
  document.addEventListener('keydown', keydown); window.addEventListener('beforeunload', saveBeforeLeaving); document.addEventListener('visibilitychange', visibility);
  try { db = await openNotebook(); documents = await db.all(); }
  catch { const memory = new Map(); db = { memory: true, put: async doc => memory.set(doc.id, doc), remove: async id => memory.delete(id), close() {} }; message('Browser storage is unavailable. Export documents to keep your work.'); }
  if (!documents.length) { const doc = newDocument('A little room for ideas'); doc.text = 'Welcome to notepaint.\n\nWrite on the left. Draw on the right.\n\nTry a brush, a colour, and a little doodle.\n\nYour words and picture stay together. Export a document to take them with you.'; documents.push(doc); await db.put(doc); }
  loading = false; await select(documents[0]); newButton.disabled = false; setTool('brush'); status.textContent = db.memory ? 'Session only — export to keep' : 'Saved on this device';
  return { destroy() { persist(); disposed = true; clearTimeout(timer); clearTimeout(toastTimer); document.removeEventListener('keydown', keydown); window.removeEventListener('beforeunload', saveBeforeLeaving); document.removeEventListener('visibilitychange', visibility); drawing.destroy(); queue.finally(() => db.close()); style.remove(); root.replaceChildren(); } };
}
