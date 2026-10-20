// Tiny DOM helpers + a schema → form builder (entity properties and script parameters share the same schema vocabulary).
import { SOUND_NAMES } from '/runtime/fpsc/audio.js';

export function el(tag, attrs = {}, ...kids) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs ?? {})) {
    if (v === undefined || v === null || v === false) continue;
    if (k === 'class') e.className = v; else if (k === 'style' && typeof v === 'object') Object.assign(e.style, v);
    else if (k.startsWith('on') && typeof v === 'function') e.addEventListener(k.slice(2), v);
    else if (k === 'value') e.value = v; else if (k === 'checked') e.checked = !!v; else if (k === 'html') e.innerHTML = v; else e.setAttribute(k, v === true ? '' : v);
  }
  for (const k of kids.flat()) if (k !== null && k !== undefined && k !== false) e.append(k.nodeType ? k : document.createTextNode(String(k)));
  return e;
}

export const KEYS = ['', 'red', 'blue', 'yellow', 'green'];
export const WEAPON_IDS = ['knife', 'pistol', 'shotgun', 'rifle', 'rocket', 'plasma'];

/**
 * schema: { key: { type, label, default, min, max, step, options, hint } }.  values: current overrides object (only changed keys are stored).
 * onChange(key, value|undefined) — undefined means "back to default" (the key is removed by the caller).
 * ctx: { targets: ()=>string[] (names for datalists), sounds: ()=>string[] }
 */
export function buildForm(schema, values, onChange, ctx = {}) {
  const root = el('div');
  const dl = `dl-${Math.random().toString(36).slice(2, 7)}`;
  root.append(el('datalist', { id: `${dl}-t` }, ...(ctx.targets?.() ?? []).map((n) => el('option', { value: n }))), el('datalist', { id: `${dl}-s` }, ...[...SOUND_NAMES, ...(ctx.sounds?.() ?? [])].map((n) => el('option', { value: n }))));
  for (const [key, def] of Object.entries(schema ?? {})) {
    if (def.hidden) continue;
    const has = values && key in values, cur = has ? values[key] : def.default;
    const set = (v) => { onChange(key, v); };
    let input;
    const num = (isInt) => el('input', { type: 'number', value: cur ?? 0, min: def.min, max: def.max, step: def.step ?? (isInt ? 1 : 'any'), onchange: (e) => { let v = parseFloat(e.target.value); if (Number.isNaN(v)) v = def.default; if (def.min != null) v = Math.max(def.min, v); if (def.max != null) v = Math.min(def.max, v); set(isInt ? Math.round(v) : v); } });
    switch (def.type) {
      case 'number': case 'int': input = num(def.type === 'int'); break;
      case 'bool': input = el('input', { type: 'checkbox', checked: !!cur, onchange: (e) => set(e.target.checked) }); break;
      case 'color': input = el('input', { type: 'color', value: /^#[0-9a-f]{6}$/i.test(cur) ? cur : '#ffffff', oninput: (e) => set(e.target.value) }); break;
      case 'enum': input = el('select', { onchange: (e) => set(e.target.value) }, ...(def.options ?? []).map((o) => el('option', { value: o, selected: o === cur }, o === '' ? '(none)' : o))); break;
      case 'text': input = el('textarea', { value: cur ?? '', onchange: (e) => set(e.target.value) }); break;
      case 'sound': input = el('input', { type: 'text', list: `${dl}-s`, value: cur ?? '', onchange: (e) => set(e.target.value) }); break;
      case 'key': input = el('select', { onchange: (e) => set(e.target.value) }, ...KEYS.map((o) => el('option', { value: o, selected: o === (cur ?? '') }, o || '(none)'))); break;
      case 'target': input = el('input', { type: 'text', list: `${dl}-t`, value: cur ?? '', onchange: (e) => set(e.target.value) }); break;
      default: input = el('input', { type: 'text', value: cur ?? '', title: def.hint ?? '', onchange: (e) => set(e.target.value) });
    }
    const row = el('div', { class: 'row' }, el('label', { title: def.hint ?? def.label ?? key }, def.label ?? key), input);
    if (has) row.append(el('button', { class: 'hint', title: `Reset to default (${JSON.stringify(def.default)})`, onclick: () => set(undefined) }, '↺'));
    if (def.type === 'text') { row.style.alignItems = 'flex-start'; }
    root.append(row);
    if (def.hint && def.type !== 'bool' && def.type !== 'enum') row.title = def.hint;
  }
  return root;
}

export const hexOf = (n) => n; // placeholder for future colour tools
export const debounce = (fn, ms) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };
export function toast(msg, ms = 2200) { const m = document.getElementById('st-msg'); if (!m) return; m.textContent = msg; clearTimeout(toast.t); toast.t = setTimeout(() => { m.textContent = ''; }, ms); }

export function modal(title, bodyNodes, buttons = [{ label: 'Close', primary: true }]) {
  return new Promise((resolve) => {
    const box = document.getElementById('modal-box'), wrap = document.getElementById('modal');
    box.innerHTML = ''; box.append(el('h2', {}, title), ...[].concat(bodyNodes));
    const row = el('div', { class: 'mrow' });
    for (const b of buttons) row.append(el('button', { class: b.primary ? 'primary' : b.danger ? 'danger' : '', onclick: () => { wrap.classList.add('hidden'); resolve(b.value ?? b.label); } }, b.label));
    box.append(row); wrap.classList.remove('hidden');
    const first = box.querySelector('input,select,textarea'); if (first) first.focus();
  });
}
