// Extends the engine's library/apps/paint.js pointer-coordinate and snapshot approach.
export function createDrawing(canvas, changed) {
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  const undo = [], redo = [];
  let tool = 'brush', color = '#253949', size = 7, active = null, revision = 0;
  const image = () => ctx.getImageData(0, 0, canvas.width, canvas.height);
  const pos = event => {
    const r = canvas.getBoundingClientRect();
    return { x: Math.max(0, Math.min(canvas.width - 1, (event.clientX - r.left) * canvas.width / r.width)), y: Math.max(0, Math.min(canvas.height - 1, (event.clientY - r.top) * canvas.height / r.height)) };
  };
  const blank = () => { ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, canvas.width, canvas.height); };
  const checkpoint = () => { undo.push(image()); if (undo.length > 20) undo.shift(); redo.length = 0; };
  const finish = () => { revision++; changed({ undo: undo.length, redo: redo.length }); };
  const stroke = (a, b, pressure = 1) => {
    ctx.strokeStyle = tool === 'eraser' ? '#ffffff' : color; ctx.fillStyle = ctx.strokeStyle;
    ctx.lineWidth = (tool === 'pencil' ? 2 : size) * (pressure || 1); ctx.lineCap = ctx.lineJoin = 'round';
    ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x + 0.01, b.y); ctx.stroke();
  };
  function fill(point) {
    const img = image(), pixels = img.data, w = canvas.width, h = canvas.height;
    const start = Math.floor(point.y) * w + Math.floor(point.x), at = start * 4;
    const target = Array.from(pixels.slice(at, at + 4));
    const next = [parseInt(color.slice(1, 3), 16), parseInt(color.slice(3, 5), 16), parseInt(color.slice(5, 7), 16), 255];
    if (target.every((v, i) => v === next[i])) return;
    const queue = new Uint32Array(w * h), seen = new Uint8Array(w * h); let head = 0, tail = 1;
    queue[0] = start; seen[start] = 1;
    const push = p => { if (!seen[p]) { seen[p] = 1; queue[tail++] = p; } };
    while (head < tail) {
      const p = queue[head++], i = p * 4;
      if (!target.every((v, k) => pixels[i + k] === v)) continue;
      next.forEach((v, k) => { pixels[i + k] = v; });
      const x = p % w, y = Math.floor(p / w);
      if (x > 0) push(p - 1); if (x < w - 1) push(p + 1); if (y > 0) push(p - w); if (y < h - 1) push(p + w);
    }
    ctx.putImageData(img, 0, 0);
  }
  const down = event => {
    if (event.button !== 0 || active) return; event.preventDefault(); const p = pos(event);
    if (tool === 'picker') { const pixel = ctx.getImageData(Math.floor(p.x), Math.floor(p.y), 1, 1).data; color = '#' + [...pixel.slice(0, 3)].map(n => n.toString(16).padStart(2, '0')).join(''); changed({ color }); return; }
    checkpoint();
    if (tool === 'fill') { fill(p); finish(); return; }
    canvas.setPointerCapture(event.pointerId); active = { id: event.pointerId, start: p, previous: p, before: undo.at(-1) };
    if (['brush', 'pencil', 'eraser'].includes(tool)) stroke(p, p, event.pointerType === 'pen' ? event.pressure : 1);
  };
  const move = event => {
    if (!active || event.pointerId !== active.id) return; const p = pos(event);
    if (['brush', 'pencil', 'eraser'].includes(tool)) { stroke(active.previous, p, event.pointerType === 'pen' ? event.pressure : 1); active.previous = p; return; }
    ctx.putImageData(active.before, 0, 0); ctx.strokeStyle = color; ctx.lineWidth = size; ctx.lineCap = 'round';
    const a = active.start; ctx.beginPath();
    if (tool === 'line') { ctx.moveTo(a.x, a.y); ctx.lineTo(p.x, p.y); }
    if (tool === 'rectangle') ctx.rect(a.x, a.y, p.x - a.x, p.y - a.y);
    if (tool === 'ellipse') ctx.ellipse((a.x + p.x) / 2, (a.y + p.y) / 2, Math.abs(p.x - a.x) / 2, Math.abs(p.y - a.y) / 2, 0, 0, Math.PI * 2);
    ctx.stroke();
  };
  const up = event => { if (active?.id !== event.pointerId) return; active = null; finish(); };
  const cancel = () => { if (!active) return; ctx.putImageData(active.before, 0, 0); undo.pop(); active = null; };
  canvas.addEventListener('pointerdown', down); canvas.addEventListener('pointermove', move); canvas.addEventListener('pointerup', up); canvas.addEventListener('pointercancel', cancel);
  blank();
  return {
    settings(o) { cancel(); tool = o.tool ?? tool; color = o.color ?? color; size = o.size ?? size; },
    undo() { cancel(); if (undo.length) { redo.push(image()); ctx.putImageData(undo.pop(), 0, 0); finish(); } },
    redo() { cancel(); if (redo.length) { undo.push(image()); ctx.putImageData(redo.pop(), 0, 0); finish(); } },
    clear() { cancel(); checkpoint(); blank(); finish(); },
    png() { return canvas.toDataURL('image/png'); },
    async load(url, remember = false) {
      cancel(); const token = ++revision;
      if (!remember) { undo.length = 0; redo.length = 0; }
      if (!url) { blank(); return; }
      const picture = new Image(); picture.src = url; await picture.decode();
      if (token !== revision) return;
      if (remember) checkpoint(); blank();
      const scale = Math.min(canvas.width / picture.width, canvas.height / picture.height);
      ctx.drawImage(picture, (canvas.width - picture.width * scale) / 2, (canvas.height - picture.height * scale) / 2, picture.width * scale, picture.height * scale);
      if (remember) finish();
    },
    destroy() { canvas.removeEventListener('pointerdown', down); canvas.removeEventListener('pointermove', move); canvas.removeEventListener('pointerup', up); canvas.removeEventListener('pointercancel', cancel); },
  };
}
