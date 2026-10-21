// Stand-alone play page. ?level=levels/x.fpsl.json[&base=/] loads from the project; or the editor posts {type:'fpsc-level', level, playtest} to it.
import { runLevel, loadBank, fetchLevel, normalize } from '/runtime/fpsc/index.js';

import { normalizeShortcuts, matchesShortcut } from './shortcuts.js';

let shortcuts = normalizeShortcuts();
window.addEventListener('keydown', (e) => {
  if (window.parent === window || !matchesShortcut(e, shortcuts.stop)) return;
  e.preventDefault(); e.stopImmediatePropagation();
  window.parent.postMessage({ type: 'fpsc-quit' }, location.origin);
}, true);
window.addEventListener('message', (e) => {
  if (e.source === window.parent && e.origin === location.origin && e.data?.type === 'fpsc-shortcuts') shortcuts = normalizeShortcuts(e.data.shortcuts);
});

const q = new URLSearchParams(location.search), base = q.get('base') || '/';
const canvas = document.getElementById('c'), stage = document.getElementById('stage'), errBox = document.getElementById('err');
const log = (lvl, msg) => { if (lvl === 'error') { errBox.style.display = 'block'; errBox.textContent += `${msg}\n`; } window.parent?.postMessage({ type: 'fpsc-log', level: lvl, msg: String(msg) }, '*'); };
window.addEventListener('error', (e) => log('error', e.message));
window.addEventListener('unhandledrejection', (e) => log('error', e.reason?.message ?? e.reason));

async function boot(level, playtest, bankOverride) {
  try {
    const bank = bankOverride ?? await loadBank(base);
    for (const w of bank.warns) log('warn', w);
    const run = await runLevel({ canvas, container: stage, level, bank, playtest, noLock: q.has('nolock'), autostart: q.has('autostart') || !!playtest?.autostart, preserve: q.has('shot'), onLog: log, onQuit: () => window.parent !== window ? window.parent.postMessage({ type: 'fpsc-quit' }, '*') : history.back(), onNext: (n) => { if (n) location.search = `?level=${encodeURIComponent(n)}&base=${encodeURIComponent(base)}`; } });
    window.__fpsc = run; window.__fpsc_ready = true;
  } catch (e) { console.error(e); log('error', e.stack ?? e.message); window.__fpsc_error = String(e); }
}

if (q.get('level')) boot(await fetchLevel(q.get('level'), base).catch((e) => { log('error', e.message); throw e; }), q.has('start') ? { x: +q.get('x'), z: +q.get('z'), layer: +q.get('layer') || 0, rot: +q.get('rot') || 0 } : null);
else {
  window.addEventListener('message', (e) => { const m = e.data; if (e.source !== window.parent || e.origin !== location.origin) return; if (m?.type === 'fpsc-level') { shortcuts = normalizeShortcuts(m.shortcuts); boot(normalize(m.level), m.playtest ?? null); } });
  window.parent?.postMessage({ type: 'fpsc-ready' }, '*');
}
