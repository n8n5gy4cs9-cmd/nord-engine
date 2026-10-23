// In-page replacements for prompt() / confirm(): the native (wry) web view shows neither, so they would silently return null / false.
const overlay = (build) => new Promise((resolve) => {
  const back = document.createElement('div');
  back.style.cssText = 'position:fixed;inset:0;background:#0009;z-index:9999;display:flex;align-items:center;justify-content:center';
  const box = document.createElement('div');
  box.style.cssText = 'background:#232a33;color:#e5e9f0;border:1px solid #4c566a;border-radius:6px;padding:14px;min-width:300px;max-width:440px;font:13px system-ui,sans-serif;box-shadow:0 8px 30px #000a';
  back.appendChild(box); document.body.appendChild(back);
  const done = (v) => { back.remove(); resolve(v); };
  build(box, done);
  back.addEventListener('keydown', (e) => { if (e.key === 'Escape') { e.stopPropagation(); done(null); } });
});
const btn = (text, cls, on) => { const b = document.createElement('button'); b.textContent = text; b.style.cssText = 'margin-left:8px;padding:4px 12px;cursor:pointer'; if (cls) b.style.fontWeight = '700'; b.onclick = on; return b; };

/** Ask for a line of text; resolves to the string (Enter / OK) or null (Esc / Cancel). */
export function askText(title, value = '') {
  return overlay((box, done) => {
    const t = document.createElement('div'); t.textContent = title; t.style.marginBottom = '8px'; box.appendChild(t);
    const i = document.createElement('input'); i.value = value; i.style.cssText = 'width:100%;box-sizing:border-box;padding:5px'; box.appendChild(i);
    const row = document.createElement('div'); row.style.cssText = 'text-align:right;margin-top:10px'; box.appendChild(row);
    row.append(btn('Cancel', false, () => done(null)), btn('OK', true, () => done(i.value)));
    i.addEventListener('keydown', (e) => { if (e.key === 'Enter') done(i.value); });
    setTimeout(() => { i.focus(); i.select(); }, 0);
  });
}

/** Yes / No question; resolves to true or false. */
export function askYes(message, yes = 'OK') {
  return overlay((box, done) => {
    const t = document.createElement('div'); t.textContent = message; box.appendChild(t);
    const row = document.createElement('div'); row.style.cssText = 'text-align:right;margin-top:12px'; box.appendChild(row);
    const ok = btn(yes, true, () => done(true));
    row.append(btn('Cancel', false, () => done(false)), ok);
    setTimeout(() => ok.focus(), 0);
  }).then((v) => v === true);
}
