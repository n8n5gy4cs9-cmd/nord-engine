// Scene-view conventions shared by the 2D Level and FPS Level editors (same as the main Scene view, editor/viewport/):
//   pan = middle / right drag, Alt+left drag, Space+left drag or the Hand tool (Q); wheel zooms about the cursor;
//   Ctrl/Cmd toggles snapping while held; Home fits everything, Shift+F frames the selection.
// Pure helpers so both editors (and node tests) use one definition.

/** True when this pointer-down should pan the 2D map instead of using the active tool. */
export function isPanGesture(e, { space = false, hand = false } = {}) {
  return e.button === 1 || e.button === 2 || (e.button === 0 && (space || hand || !!e.altKey));
}

/** Snapping state: the editor's Snap checkbox, inverted while Ctrl/Cmd is held (Unity). */
export function snapActive(enabled, e) {
  return !!enabled !== !!(e && (e.ctrlKey || e.metaKey));
}

/** Round to `step` when `on`; a step <= 0 never snaps. */
export function snapValue(v, step, on) {
  return on && step > 0 ? Math.round(v / step) * step : v;
}

/** Zoom a {x, y, zoom} screen-space view (x,y = screen offset of the origin) about pixel (px, py); returns the clamped zoom. */
export function zoomAbout(view, px, py, factor, min = 0.1, max = 6) {
  const z = Math.max(min, Math.min(max, view.zoom * factor));
  view.x = px - (px - view.x) * z / view.zoom;
  view.y = py - (py - view.y) * z / view.zoom;
  view.zoom = z;
  return z;
}

/** Common hotkeys: returns 'hand' (Q), 'frame' (Shift+F), 'fit' (Home) or null. Ignored while typing or with Ctrl/Cmd/Alt. */
export function viewHotkey(e) {
  if (e.ctrlKey || e.metaKey || e.altKey) return null;
  if (e.target?.matches?.('input,textarea,select') && e.target.type !== 'checkbox') return null;
  if (e.code === 'Home') return 'fit';
  if (e.code === 'KeyF' && e.shiftKey) return 'frame';
  if (e.code === 'KeyQ' && !e.shiftKey) return 'hand';
  return null;
}
