/**
 * Optional web audio entry gate. Consumes the first pointer/key gesture and its release,
 * unlocks game.audio, and leaves the game's current screen untouched. No gate is installed
 * until a game explicitly calls this helper. destroy() removes all UI/listeners.
 */
export function touchToStart(game, { parent = globalThis.document?.body, title = 'READY', label = 'TOUCH OR CLICK TO START AUDIO' } = {}) {
  if (!parent?.ownerDocument) return { active: false, destroy() {} };
  const doc = parent.ownerDocument, win = doc.defaultView, el = doc.createElement('div');
  el.dataset.nordStartGate = ''; el.setAttribute('role', 'button'); el.setAttribute('aria-label', label); el.tabIndex = 0;
  el.style.cssText = 'position:fixed;inset:0;z-index:10000;display:grid;place-content:center;text-align:center;background:rgba(3,8,15,.94);color:#c9e9d4;font:14px/2 ui-monospace,monospace;letter-spacing:2px;touch-action:none;user-select:none;cursor:pointer';
  const heading = doc.createElement('strong'), caption = doc.createElement('span'); heading.textContent = title; caption.textContent = label; caption.style.maxWidth = '85vw'; el.append(heading, caption); parent.append(el);
  const types = ['pointerdown', 'pointerup', 'pointercancel', 'touchstart', 'touchend', 'touchcancel', 'click', 'keydown', 'keyup'];
  let active = true, key = null, pointer = null, released = false, timer = null;
  const remove = () => { for (const type of types) win.removeEventListener(type, consume, true); if (timer) win.clearTimeout(timer); el.remove(); };
  const block = e => { if (e.cancelable) e.preventDefault(); e.stopImmediatePropagation(); };
  function consume(e) {
    if (active) {
      if (e.type === 'keydown' && (e.repeat || e.ctrlKey || e.metaKey || e.altKey)) return;
      block(e);
      if (!['pointerdown', 'touchstart', 'keydown'].includes(e.type)) return;
      active = false; key = e.type === 'keydown' ? e.code : null; pointer = e.type === 'keydown' ? null : e.pointerId ?? 'touch';
      el.remove(); game.input?.held?.clear(); game.audio?.unlock();
      return;
    }
    // A distinct new gesture is normal game input, even if a browser omitted the first release/click.
    if (e.type === 'pointerdown' || (e.type === 'touchstart' && released) || (e.type === 'keydown' && (e.code !== key || !e.repeat))) { remove(); return; }
    if ((key && ['keyup', 'keydown'].includes(e.type) && e.code === key) || (pointer !== null && ['pointerup', 'pointercancel', 'touchstart', 'touchend', 'touchcancel', 'click'].includes(e.type))) {
      block(e);
      if (['click', 'pointercancel', 'touchcancel'].includes(e.type)) remove();
      else if (e.type === 'keyup') timer = win.setTimeout(remove, 0);
      else if (e.type === 'pointerup' || e.type === 'touchend') { released = true; game.audio?.unlock(); if (timer) win.clearTimeout(timer); timer = win.setTimeout(remove, 500); }
    }
  }
  for (const type of types) win.addEventListener(type, consume, { capture: true, passive: false });
  return { get active() { return active; }, destroy() { active = false; remove(); } };
}
