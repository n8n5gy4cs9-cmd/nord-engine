// Image layers for the Modeler texture view: add PNG/JPG/WebP pictures, move / resize / rotate / flip / crop / duplicate them on the
// texture, then they are merged ("baked") into the ONE texture of the model. Layers are working objects: only the merged texture is
// saved, so ten pictures never mean ten files in the model. Pictures are shrunk to <= 512 px on import and the result can be
// colour-reduced, so the texture stays small.
const MAX_SRC = 512, MAX_LAYERS = 64;
const el = (tag, props = {}, parent) => { const e = Object.assign(document.createElement(tag), props); parent?.append(e); return e; };
const num = (v, d = 0) => (Number.isFinite(+v) ? +v : d);

export function initLayers(api) {
  const { texCanvas, tctx, root } = api;
  const ui = root.querySelector('#layers'), over = root.querySelector('#layerui');
  let layers = [], sel = null, base = null, drag = null, seq = 1;
  const cur = () => layers.find((l) => l.id === sel) ?? null;
  const copyCanvas = (c) => { const n = el('canvas'); n.width = c.width; n.height = c.height; n.getContext('2d').drawImage(c, 0, 0); return n; };
  const shrink = (im) => { const k = Math.min(1, MAX_SRC / Math.max(im.width, im.height)), c = el('canvas'); c.width = Math.max(1, Math.round(im.width * k)); c.height = Math.max(1, Math.round(im.height * k)); const x = c.getContext('2d'); x.imageSmoothingQuality = 'high'; x.drawImage(im, 0, 0, c.width, c.height); return c; };

  function compose() {
    if (!base) return;
    tctx.clearRect(0, 0, texCanvas.width, texCanvas.height);
    tctx.drawImage(base, 0, 0);
    for (const l of layers) {
      if (!l.vis) continue;
      tctx.save(); tctx.translate(l.cx, l.cy); tctx.rotate((l.rot * Math.PI) / 180); tctx.scale(l.fx ? -1 : 1, l.fy ? -1 : 1); tctx.globalAlpha = l.alpha; tctx.imageSmoothingEnabled = l.smooth;
      tctx.drawImage(l.src, l.cl, l.ct, Math.max(1, l.src.width - l.cl - l.cr), Math.max(1, l.src.height - l.ct - l.cb), -l.w / 2, -l.h / 2, l.w, l.h);
      tctx.restore();
    }
    api.touch();
    drawUi();
  }
  function bake(quiet) {
    if (!layers.length) return false;
    compose(); layers = []; sel = null; base = null; api.commit(); renderPanel(); drawUi();
    if (!quiet) api.status('Layers merged into the texture.');
    return true;
  }
  function reset() { layers = []; sel = null; base = null; renderPanel(); drawUi(); }

  // ---------- add ----------
  async function addImage(blob, name = 'picture') {
    if (layers.length >= MAX_LAYERS) throw Error(`At most ${MAX_LAYERS} layers: merge some first.`);
    const bmp = await createImageBitmap(blob), src = shrink(bmp);
    api.checkpoint(); api.ensureTexture();
    if (!base) base = copyCanvas(texCanvas);
    const fit = Math.min(1, (texCanvas.width * 0.6) / src.width, (texCanvas.height * 0.6) / src.height), w = Math.max(1, Math.round(src.width * fit)), h = Math.max(1, Math.round(src.height * fit));
    const l = { id: seq++, name, src, cx: texCanvas.width / 2, cy: texCanvas.height / 2, w, h, rot: 0, fx: false, fy: false, alpha: 1, vis: true, smooth: false, cl: 0, ct: 0, cr: 0, cb: 0 };
    layers.push(l); sel = l.id; compose(); renderPanel();
    api.status(`Added "${name}" (${src.width}×${src.height}${src.width !== bmp.width ? `, shrunk from ${bmp.width}×${bmp.height}` : ''}). Drag it, use the corner handles to resize, the round handle to rotate.`);
  }
  async function addFiles(files) { for (const f of files) { if (!/^image\//.test(f.type)) continue; if (f.size > 12 * 1024 * 1024) throw Error(`${f.name}: pictures over 12 MB are not accepted.`); await addImage(f, f.name.replace(/\.[^.]+$/, '')); } }

  // ---------- geometry ----------
  const toLocal = (l, x, y) => { const a = (-l.rot * Math.PI) / 180, dx = x - l.cx, dy = y - l.cy; let lx = dx * Math.cos(a) - dy * Math.sin(a), ly = dx * Math.sin(a) + dy * Math.cos(a); return [lx, ly]; };
  const hit = (l, x, y) => { const [lx, ly] = toLocal(l, x, y); return Math.abs(lx) <= l.w / 2 && Math.abs(ly) <= l.h / 2; };
  const handleR = () => Math.max(2.5, texCanvas.width / 64);
  function handleAt(l, x, y) {
    const [lx, ly] = toLocal(l, x, y), r = handleR() * 1.6;
    const rotY = -l.h / 2 - handleR() * 4;
    if (Math.hypot(lx, ly - rotY) <= r) return 'rot';
    for (const [sx, sy, n] of [[-1, -1, 'tl'], [1, -1, 'tr'], [1, 1, 'br'], [-1, 1, 'bl']]) if (Math.hypot(lx - (sx * l.w) / 2, ly - (sy * l.h) / 2) <= r) return n;
    return null;
  }
  const pos = (e) => { const r = texCanvas.getBoundingClientRect(); return [((e.clientX - r.left) / r.width) * texCanvas.width, ((e.clientY - r.top) / r.height) * texCanvas.height]; };

  // ---------- pointer (called by the texture view when the Layer tool is active) ----------
  function pointerDown(e) {
    const [x, y] = pos(e); let l = cur(), h = l ? handleAt(l, x, y) : null;
    if (!h) { l = [...layers].reverse().find((q) => q.vis && hit(q, x, y)) ?? null; sel = l?.id ?? null; renderPanel(); drawUi(); if (!l) return false; }
    api.checkpoint();
    drag = { mode: h ?? 'move', l, x0: x, y0: y, cx: l.cx, cy: l.cy, w: l.w, h: l.h, rot: l.rot, d0: Math.hypot(x - l.cx, y - l.cy) || 1, shift: e.shiftKey };
    return true;
  }
  function pointerMove(e) {
    if (!drag) { const [x, y] = pos(e), l = cur(); texCanvas.style.cursor = l && handleAt(l, x, y) ? 'nwse-resize' : [...layers].some((q) => q.vis && hit(q, x, y)) ? 'move' : 'default'; return; }
    const [x, y] = pos(e), l = drag.l;
    if (drag.mode === 'move') { l.cx = Math.round((drag.cx + x - drag.x0) * 2) / 2; l.cy = Math.round((drag.cy + y - drag.y0) * 2) / 2; }
    else if (drag.mode === 'rot') { let a = (Math.atan2(y - l.cy, x - l.cx) * 180) / Math.PI + 90; if (e.shiftKey) a = Math.round(a / 15) * 15; l.rot = Math.round(a * 10) / 10; }
    else if (e.shiftKey) { const [lx, ly] = toLocal(l, x, y); l.w = Math.max(1, Math.round(Math.abs(lx) * 2)); l.h = Math.max(1, Math.round(Math.abs(ly) * 2)); } // Shift = free stretch
    else { const k = Math.max(0.02, Math.hypot(x - l.cx, y - l.cy) / drag.d0); l.w = Math.max(1, Math.round(drag.w * k)); l.h = Math.max(1, Math.round(drag.h * k)); }
    compose(); syncProps();
  }
  function pointerUp() { if (!drag) return; drag = null; api.commit(); }
  texCanvas.addEventListener('dragover', (e) => e.preventDefault());
  texCanvas.addEventListener('drop', (e) => { e.preventDefault(); addFiles([...e.dataTransfer.files]).catch((x) => api.status(x.message)); });
  window.addEventListener('paste', (e) => { if (!api.texViewVisible() || /INPUT|TEXTAREA/.test(document.activeElement?.tagName ?? '')) return; const fs = [...(e.clipboardData?.files ?? [])]; if (fs.length) { e.preventDefault(); addFiles(fs).catch((x) => api.status(x.message)); } });
  window.addEventListener('keydown', (e) => {
    const l = cur(); if (!l || !api.texViewVisible() || /INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName ?? '')) return;
    const step = e.shiftKey ? 8 : 1;
    if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); remove(); }
    else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'd') { e.preventDefault(); duplicate(); }
    else if (e.key.startsWith('Arrow')) { e.preventDefault(); l.cx += { ArrowLeft: -step, ArrowRight: step }[e.key] ?? 0; l.cy += { ArrowUp: -step, ArrowDown: step }[e.key] ?? 0; compose(); syncProps(); api.commit(); }
  });

  // ---------- operations ----------
  function duplicate() { const l = cur(); if (!l) return; api.checkpoint(); const c = { ...l, id: seq++, name: l.name + ' copy', src: copyCanvas(l.src), cx: l.cx + 4, cy: l.cy + 4 }; layers.splice(layers.indexOf(l) + 1, 0, c); sel = c.id; compose(); renderPanel(); api.commit(); }
  function remove() { const l = cur(); if (!l) return; api.checkpoint(); layers.splice(layers.indexOf(l), 1); sel = layers.at(-1)?.id ?? null; if (!layers.length) { bake(true); } else compose(); renderPanel(); api.commit(); }
  function order(d) { const l = cur(); if (!l) return; const i = layers.indexOf(l), j = d === 'front' ? layers.length - 1 : d === 'back' ? 0 : Math.max(0, Math.min(layers.length - 1, i + d)); layers.splice(i, 1); layers.splice(j, 0, l); compose(); renderPanel(); }
  function fitTo(rect) { const l = cur(); if (!l || !rect) return; api.checkpoint(); l.rot = 0; l.cx = rect.x + rect.w / 2; l.cy = rect.y + rect.h / 2; l.w = Math.max(1, Math.round(rect.w)); l.h = Math.max(1, Math.round(rect.h)); compose(); syncProps(); api.commit(); }
  function trim() { const l = cur(); if (!l) return; const { width: w, height: h } = l.src, d = l.src.getContext('2d').getImageData(0, 0, w, h).data; let x0 = w, y0 = h, x1 = -1, y1 = -1; for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (d[(y * w + x) * 4 + 3] > 8) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); } if (x1 < 0) throw Error('The picture is fully transparent.'); api.checkpoint(); const n = el('canvas'); n.width = x1 - x0 + 1; n.height = y1 - y0 + 1; n.getContext('2d').drawImage(l.src, x0, y0, n.width, n.height, 0, 0, n.width, n.height); const k = l.w / (l.src.width - l.cl - l.cr); l.src = n; l.cl = l.ct = l.cr = l.cb = 0; l.w = Math.max(1, Math.round(n.width * k)); l.h = Math.max(1, Math.round(n.height * k)); compose(); renderPanel(); api.commit(); }
  function removeColour(hex, tol) { const l = cur(); if (!l) return; api.checkpoint(); const c = l.src.getContext('2d'), img = c.getImageData(0, 0, l.src.width, l.src.height), d = img.data, [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)); for (let i = 0; i < d.length; i += 4) if (Math.hypot(d[i] - r, d[i + 1] - g, d[i + 2] - b) <= tol) d[i + 3] = 0; c.putImageData(img, 0, 0); compose(); api.commit(); }
  function shrinkLayer() { const l = cur(); if (!l) return; // resample the picture to the size it has on the texture: smaller data, same look
    const w = Math.max(1, Math.round(l.w)), h = Math.max(1, Math.round(l.h)); if (w >= l.src.width && h >= l.src.height) return; api.checkpoint(); const n = el('canvas'); n.width = w; n.height = h; const x = n.getContext('2d'); x.imageSmoothingQuality = 'high'; x.drawImage(l.src, l.cl, l.ct, l.src.width - l.cl - l.cr, l.src.height - l.ct - l.cb, 0, 0, w, h); l.src = n; l.cl = l.ct = l.cr = l.cb = 0; compose(); renderPanel(); api.commit(); }

  /** Resize the whole texture; base pixels and layers scale with it. */
  function resizeTexture(size) {
    if (size === texCanvas.width) return; api.checkpoint(); api.ensureTexture(); const k = size / texCanvas.width, old = base ?? copyCanvas(texCanvas);
    texCanvas.width = size; texCanvas.height = size; tctx.imageSmoothingEnabled = false; tctx.clearRect(0, 0, size, size); tctx.drawImage(old, 0, 0, size, size);
    if (layers.length) { base = copyCanvas(texCanvas); for (const l of layers) { l.cx *= k; l.cy *= k; l.w *= k; l.h *= k; } compose(); } else base = null;
    api.commit(); api.status(`Texture is now ${size}×${size}.`);
  }
  /** Reduce colours (fewer bits per channel) so the PNG compresses much better. bits: 8 = off. */
  function quantize(bits) {
    if (bits >= 8) return; const levels = (1 << bits) - 1, img = tctx.getImageData(0, 0, texCanvas.width, texCanvas.height), d = img.data;
    for (let i = 0; i < d.length; i += 4) { if (!d[i + 3]) continue; for (let c = 0; c < 3; c++) d[i + c] = Math.round((Math.round((d[i + c] / 255) * levels) / levels) * 255); }
    tctx.putImageData(img, 0, 0);
  }

  // ---------- selection / handles drawing ----------
  function drawUi() {
    const c = over.getContext('2d'); c.clearRect(0, 0, over.width, over.height);
    const l = cur(); if (!l || !api.texViewVisible()) return;
    const k = over.width / texCanvas.width, r = handleR() * k;
    c.save(); c.translate(l.cx * k, l.cy * k); c.rotate((l.rot * Math.PI) / 180);
    c.strokeStyle = '#e7ff65'; c.lineWidth = 1.5; c.setLineDash([6, 4]); c.strokeRect((-l.w / 2) * k, (-l.h / 2) * k, l.w * k, l.h * k); c.setLineDash([]);
    c.fillStyle = '#e7ff65'; for (const [sx, sy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) c.fillRect((sx * l.w * k) / 2 - r / 2, (sy * l.h * k) / 2 - r / 2, r, r);
    const ry = (-l.h / 2) * k - r * 4; c.beginPath(); c.moveTo(0, (-l.h / 2) * k); c.lineTo(0, ry); c.stroke(); c.beginPath(); c.arc(0, ry, r * 0.7, 0, Math.PI * 2); c.fill();
    c.restore();
  }

  // ---------- panel ----------
  function renderPanel() {
    ui.textContent = '';
    const bar = el('div', { className: 'bar' }, ui);
    const add = el('button', { textContent: '+ Add pictures…', title: 'PNG, JPG or WebP; several at once. You can also drop files on the texture or paste with Ctrl/Cmd+V.' }, bar); add.onclick = () => root.querySelector('#layerfiles').click();
    const proj = el('button', { textContent: '+ From project…', title: 'Pictures of the project (models/ folder)' }, bar); proj.onclick = () => api.pickProjectPng().then((b) => b && addImage(b.blob, b.name)).catch((x) => api.status(x.message));
    el('button', { textContent: `Merge ${layers.length || ''} layers into texture`, disabled: !layers.length, title: 'Flatten the layers into the one texture (also happens when you paint or save)' }, bar).onclick = () => bake();
    const size = el('select', { id: 'texsize2', title: 'Texture size: all layers are merged into this one square picture' }, bar);
    for (const s of [16, 32, 64, 128, 256, 512, 1024]) el('option', { value: s, textContent: `${s}×${s}`, selected: s === texCanvas.width }, size);
    size.onchange = () => resizeTexture(+size.value);
    const comp = el('select', { id: 'texcomp', title: 'Fewer colours = smaller PNG (applied when saving)' }, bar);
    for (const [v, t] of [[8, 'Full colour'], [6, 'Compress: light (6 bit)'], [5, 'Compress: medium (5 bit)'], [4, 'Compress: strong (4 bit)']]) el('option', { value: v, textContent: t, selected: v === api.compression() }, comp);
    comp.onchange = () => api.setCompression(+comp.value);
    el('span', { id: 'texinfo', className: 'hint' }, bar);
    const list = el('div', { className: 'layerlist' }, ui);
    if (!layers.length) el('p', { className: 'hint', textContent: 'No picture layers. Add PNG / JPG pictures (several at once), arrange them with the Layer tool, and they are merged into the single texture of the model.' }, list);
    [...layers].reverse().forEach((l) => {
      const row = el('div', { className: 'layerrow' + (l.id === sel ? ' on' : '') }, list);
      const t = el('canvas', { width: 28, height: 28 }, row); const x = t.getContext('2d'), k = Math.min(28 / l.src.width, 28 / l.src.height); x.drawImage(l.src, 0, 0, l.src.width * k, l.src.height * k);
      el('span', { textContent: l.name }, row);
      const eye = el('button', { textContent: l.vis ? 'Hide' : 'Show' }, row); eye.onclick = (e) => { e.stopPropagation(); l.vis = !l.vis; compose(); renderPanel(); api.commit(); };
      row.onclick = () => { sel = l.id; renderPanel(); drawUi(); };
    });
    const l = cur(); if (!l) { api.refreshInfo(); return; }
    const p = el('div', { className: 'layerprops' }, ui);
    const lockLb = el('label', {}, p), lock = el('input', { type: 'checkbox', checked: true }, lockLb); lockLb.append(' keep proportions');
    const field = (label, key, min, max, step = 1) => { const lb = el('label', { textContent: label + ' ' }, p); const i = el('input', { type: 'number', value: l[key], step, style: 'width:68px' }, lb); if (min !== undefined) i.min = min; if (max !== undefined) i.max = max; i.dataset.key = key; i.oninput = () => { const v = num(i.value, l[key]); if (key === 'alpha') l.alpha = Math.max(0, Math.min(1, v / 100)); else if (key === 'w' && lock.checked) { const k = Math.max(1, v) / l.w; l.w = Math.max(1, v); l.h = Math.max(1, Math.round(l.h * k)); } else if (key === 'h' && lock.checked) { const k = Math.max(1, v) / l.h; l.h = Math.max(1, v); l.w = Math.max(1, Math.round(l.w * k)); } else l[key] = v; compose(); syncProps(); }; i.onchange = () => api.commit(); return i; };
    field('X', 'cx', undefined, undefined, 0.5); field('Y', 'cy', undefined, undefined, 0.5); field('Width', 'w', 1); field('Height', 'h', 1); field('Rotate °', 'rot', -360, 360, 1); field('Opacity %', 'alpha', 0, 100, 5).value = Math.round(l.alpha * 100);
    for (const [txt, key] of [['Flip horizontal', 'fx'], ['Flip vertical', 'fy'], ['Smooth (off = crisp pixels)', 'smooth']]) { const lb = el('label', {}, p), c = el('input', { type: 'checkbox', checked: l[key] }, lb); lb.append(' ' + txt); c.onchange = () => { l[key] = c.checked; compose(); api.commit(); }; }
    el('div', { className: 'hint', textContent: 'Cut (crop) the picture, in picture pixels:' }, p);
    for (const [txt, key] of [['Left', 'cl'], ['Top', 'ct'], ['Right', 'cr'], ['Bottom', 'cb']]) field('Cut ' + txt, key, 0, 4096);
    const b = el('div', { className: 'bar' }, p), btn = (t, f, tip = '') => { const e = el('button', { textContent: t, title: tip }, b); e.onclick = () => { try { f(); } catch (x) { api.status(x.message); } }; };
    btn('Duplicate', duplicate, 'Ctrl/Cmd+D'); btn('Delete', remove, 'Delete key'); btn('Forward', () => order(1)); btn('Backward', () => order(-1)); btn('To front', () => order('front')); btn('To back', () => order('back'));
    btn('Center', () => fitTo({ x: l.cx - l.w / 2 + (texCanvas.width / 2 - l.cx), y: l.cy - l.h / 2 + (texCanvas.height / 2 - l.cy), w: l.w, h: l.h }));
    btn('Fill texture', () => fitTo({ x: 0, y: 0, w: texCanvas.width, h: texCanvas.height }), 'Stretch over the whole texture');
    btn('Fit to selected faces', () => { const r = api.uvBounds(); if (!r) throw Error('Select faces first (3D or UV tab): the picture is placed exactly over their UV area.'); fitTo(r); }, 'Place the picture on the UV area of the selected faces');
    btn('Original size', () => { l.w = l.src.width - l.cl - l.cr; l.h = l.src.height - l.ct - l.cb; compose(); syncProps(); api.commit(); });
    btn('Trim transparent', trim, 'Cut away empty edges'); btn('Shrink data', shrinkLayer, 'Resample the picture to its size on the texture');
    const rc = el('label', { textContent: 'Remove colour tolerance ' }, p), tol = el('input', { type: 'number', value: 40, min: 0, max: 255, style: 'width:56px' }, rc); btn('Remove painted colour', () => removeColour(api.color(), num(tol.value, 40)), 'Makes the colour of the Texture colour box transparent in this picture');
    api.refreshInfo();
  }
  function syncProps() { const l = cur(); if (!l) return; ui.querySelectorAll('.layerprops input[data-key]').forEach((i) => { if (document.activeElement !== i) i.value = i.dataset.key === 'alpha' ? Math.round(l.alpha * 100) : Math.round(l[i.dataset.key] * 10) / 10; }); }

  root.querySelector('#layerfiles').onchange = (e) => { addFiles([...e.target.files]).catch((x) => api.status(x.message)); e.target.value = ''; };
  renderPanel();
  return { pointerDown, pointerMove, pointerUp, bake, reset, quantize, count: () => layers.length, redraw: () => { renderPanel(); drawUi(); }, drawOverlay: drawUi, addFiles, resizeTexture };
}
