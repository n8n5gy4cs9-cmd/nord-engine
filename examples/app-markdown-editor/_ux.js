// Real-app UX helpers for Nord desktop apps (M9-14). Plain ES module, no dependencies, works in browsers and the native player.
//   undo:      UndoStack            — snapshot/command history with coalescing (Ctrl/Cmd+Z via bindUndoKeys)
//   i18n:      createI18n           — locale detection, message tables with {placeholders} and plurals, Intl number/date/relative formatting
//   theme:     followSystemTheme    — keeps data-theme in sync with prefers-color-scheme (dark mode follow)
//   lists:     virtualRange / mountVirtualList (10k+ rows), enableDragReorder (pointer-based; HTML5 DnD is unreliable in webviews)
//   keyboard:  rovingFocus          — arrow-key navigation for lists/toolbars/tables with proper tabindex + aria
//   text input / IME: use native <input>/<textarea>/contenteditable (the webview handles IME composition); isComposing() guards shortcuts.

export class UndoStack {
  /** @param {number} limit max entries */
  constructor(limit = 200) { this.limit = limit; this.past = []; this.future = []; this.last = 0; }
  /** push a command {undo(), redo()}; commands with the same `key` within `coalesceMs` merge (typing, dragging a slider) */
  push(cmd, { key = null, coalesceMs = 600, now = Date.now() } = {}) {
    const top = this.past[this.past.length - 1];
    if (key && top && top.key === key && now - this.last < coalesceMs) { top.redo = cmd.redo; } else { this.past.push({ ...cmd, key }); if (this.past.length > this.limit) this.past.shift(); }
    this.last = now; this.future.length = 0;
  }
  get canUndo() { return this.past.length > 0; }
  get canRedo() { return this.future.length > 0; }
  undo() { const c = this.past.pop(); if (!c) return false; c.undo(); this.future.push(c); this.last = 0; return true; }
  redo() { const c = this.future.pop(); if (!c) return false; c.redo(); this.past.push(c); this.last = 0; return true; }
  clear() { this.past = []; this.future = []; }
}
export const isComposing = (e) => e.isComposing || e.keyCode === 229;
/** Ctrl/Cmd+Z, Shift+Ctrl/Cmd+Z, Ctrl+Y — skipped while typing in an input (the browser has its own text undo) unless `inInputs`. */
export function bindUndoKeys(stack, target = window, { inInputs = false } = {}) {
  const f = (e) => {
    if (isComposing(e) || !(e.metaKey || e.ctrlKey) || e.altKey) return;
    if (!inInputs && /^(INPUT|TEXTAREA|SELECT)$/.test(e.target?.tagName ?? '') || e.target?.isContentEditable) return;
    const k = e.key.toLowerCase();
    if (k === 'z' && !e.shiftKey) { if (stack.undo()) e.preventDefault(); } else if ((k === 'z' && e.shiftKey) || k === 'y') { if (stack.redo()) e.preventDefault(); }
  };
  target.addEventListener('keydown', f); return () => target.removeEventListener('keydown', f);
}

// ---- i18n ----
export function createI18n(tables, { locale = (typeof navigator !== 'undefined' && navigator.language) || 'en', fallback = 'en' } = {}) {
  const pick = (l) => (tables[l] ? l : tables[l.split('-')[0]] ? l.split('-')[0] : fallback);
  let cur = pick(locale);
  const fmt = (s, vars) => s.replace(/\{(\w+)\}/g, (_, k) => (vars?.[k] ?? `{${k}}`));
  const api = {
    get locale() { return cur; }, set locale(l) { cur = pick(l); },
    /** t('files', {n: 3}) with table entry `{one: '{n} file', other: '{n} files'}` (Intl.PluralRules categories) or a plain string */
    t(key, vars) {
      const e = tables[cur]?.[key] ?? tables[fallback]?.[key] ?? key;
      if (typeof e === 'string') return fmt(e, vars);
      const cat = new Intl.PluralRules(cur).select(vars?.n ?? 0);
      return fmt(e[cat] ?? e.other ?? key, vars);
    },
    number: (n, o) => new Intl.NumberFormat(cur, o).format(n),
    date: (d, o = { dateStyle: 'medium', timeStyle: 'short' }) => new Intl.DateTimeFormat(cur, o).format(d),
    relative(ms) { const r = new Intl.RelativeTimeFormat(cur, { numeric: 'auto' }), s = Math.round(ms / 1000), a = Math.abs(s); return a < 60 ? r.format(s, 'second') : a < 3600 ? r.format(Math.round(s / 60), 'minute') : a < 86400 ? r.format(Math.round(s / 3600), 'hour') : r.format(Math.round(s / 86400), 'day'); },
    bytes: (n) => (n < 1024 ? `${api.number(n)} B` : n < 1 << 20 ? `${api.number(n / 1024, { maximumFractionDigits: 1 })} KB` : `${api.number(n / 1048576, { maximumFractionDigits: 1 })} MB`),
    dir: () => (/^(ar|he|fa|ur)/.test(cur) ? 'rtl' : 'ltr'),
  };
  return api;
}

// ---- dark mode follow ----
export function followSystemTheme(root = document.documentElement, onChange) {
  const mq = window.matchMedia('(prefers-color-scheme: dark)');
  const apply = () => { root.dataset.theme = mq.matches ? 'dark' : 'light'; root.style.colorScheme = root.dataset.theme; onChange?.(root.dataset.theme); };
  apply(); mq.addEventListener('change', apply); return () => mq.removeEventListener('change', apply);
}

// ---- virtualised lists/tables ----
/** Which rows to render: {start, end, offset (px above first rendered row), total (px height)} — pure, unit-tested. */
export function virtualRange(count, rowH, scrollTop, viewH, overscan = 6) {
  const start = Math.max(0, Math.floor(scrollTop / rowH) - overscan), end = Math.min(count, Math.ceil((scrollTop + viewH) / rowH) + overscan);
  return { start, end, offset: start * rowH, total: count * rowH };
}
/** Fixed-row-height virtual list. renderRow(i) → Element. Returns { update(count), scrollTo(i), destroy() }. */
export function mountVirtualList(host, { count, rowHeight = 28, renderRow, className = '' }) {
  const view = Object.assign(document.createElement('div'), { className, role: 'list', style: 'overflow:auto;height:100%;position:relative' }), spacer = document.createElement('div'), win = document.createElement('div');
  win.style.cssText = 'position:absolute;left:0;right:0;top:0'; spacer.append(win); view.append(spacer); host.append(view);
  let n = count, raf = 0;
  const draw = () => { raf = 0; const r = virtualRange(n, rowHeight, view.scrollTop, view.clientHeight); spacer.style.height = r.total + 'px'; win.style.transform = `translateY(${r.offset}px)`; win.replaceChildren(...Array.from({ length: r.end - r.start }, (_, k) => { const e = renderRow(r.start + k); e.style.height = rowHeight + 'px'; e.setAttribute('role', 'listitem'); return e; })); };
  const sched = () => { if (!raf) raf = requestAnimationFrame(draw); };
  view.addEventListener('scroll', sched); const ro = new ResizeObserver(sched); ro.observe(view); draw();
  return { update(c) { n = c; draw(); }, scrollTo(i) { view.scrollTop = i * rowHeight; }, destroy() { ro.disconnect(); view.remove(); } };
}

// ---- drag to reorder ----
/** Pointer-based reorder for the direct children of `list`; calls onReorder(from, to). Handle = element matching `handle` (default: whole item). */
export function enableDragReorder(list, onReorder, { handle = null, itemSelector = ':scope > *' } = {}) {
  const down = (e) => {
    if (e.button) return;
    const items = [...list.querySelectorAll(itemSelector)], item = items.find((it) => it.contains(e.target));
    if (!item || (handle && !e.target.closest(handle)) || e.target.closest('button,input,select,textarea,a')) return;
    const from = items.indexOf(item), r = item.getBoundingClientRect(), oy = e.clientY - r.top; let ghost = null, to = from;
    const move = (m) => {
      if (!ghost && Math.abs(m.clientY - e.clientY) < 4) return;
      if (!ghost) { ghost = item.cloneNode(true); Object.assign(ghost.style, { position: 'fixed', width: r.width + 'px', left: r.left + 'px', pointerEvents: 'none', opacity: '.8', zIndex: 9999 }); document.body.append(ghost); item.style.opacity = '.3'; }
      ghost.style.top = m.clientY - oy + 'px';
      to = items.findIndex((it) => { const b = it.getBoundingClientRect(); return m.clientY < b.top + b.height / 2; }); if (to < 0) to = items.length - 1; else if (to > from) to -= 1;
    };
    const up = () => { removeEventListener('pointermove', move); removeEventListener('pointerup', up); ghost?.remove(); item.style.opacity = ''; if (ghost && to !== from) onReorder(from, to); };
    addEventListener('pointermove', move); addEventListener('pointerup', up); e.preventDefault();
  };
  list.addEventListener('pointerdown', down); return () => list.removeEventListener('pointerdown', down);
}
export const moveItem = (arr, from, to) => { const a = arr.slice(); a.splice(to, 0, a.splice(from, 1)[0]); return a; };

// ---- keyboard navigation ----
/** Roving tabindex: arrows (and Home/End) move focus among `itemSelector` children; Enter/Space click the focused item. */
export function rovingFocus(container, itemSelector, { horizontal = false } = {}) {
  const items = () => [...container.querySelectorAll(itemSelector)];
  const set = (i) => { items().forEach((it, k) => { it.tabIndex = k === i ? 0 : -1; }); items()[i]?.focus(); };
  const f = (e) => {
    if (isComposing(e)) return;
    const its = items(), cur = its.indexOf(document.activeElement); if (cur < 0) return;
    const [prev, next] = horizontal ? ['ArrowLeft', 'ArrowRight'] : ['ArrowUp', 'ArrowDown'];
    const to = e.key === next ? Math.min(its.length - 1, cur + 1) : e.key === prev ? Math.max(0, cur - 1) : e.key === 'Home' ? 0 : e.key === 'End' ? its.length - 1 : -1;
    if (to >= 0) { e.preventDefault(); set(to); } else if ((e.key === 'Enter' || e.key === ' ') && !/^(BUTTON|A|INPUT)$/.test(its[cur].tagName)) { e.preventDefault(); its[cur].click(); }
  };
  container.addEventListener('keydown', f); items().forEach((it, k) => { it.tabIndex = k === 0 ? 0 : -1; });
  return { focus: set, destroy: () => container.removeEventListener('keydown', f) };
}
