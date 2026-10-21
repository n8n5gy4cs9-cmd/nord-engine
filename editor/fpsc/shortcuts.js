// Shared by the level editor and test iframe. Settings arrive from the whole editor.
export const DEFAULT_SHORTCUTS = {
  test: { key: 'F5', shift: false, command: false, alt: false },
  test_here: { key: 'F5', shift: true, command: false, alt: false },
  stop: { key: 'Escape', shift: true, command: false, alt: false },
};
const aliases = { Esc: 'Escape', Space: ' ', Spacebar: ' ', Period: '.', Comma: ',', ArrowUp: 'ArrowUp', Up: 'ArrowUp', Down: 'ArrowDown', Left: 'ArrowLeft', Right: 'ArrowRight', Backspace: 'Backspace' };
const keyValue = (key) => aliases[key] ?? key;
const validKey = (key) => typeof key === 'string' && (/^[a-z0-9]$/i.test(key) || /^F([1-9]|1[0-9]|2[0-9]|3[0-5])$/.test(key) || ['Escape', 'Enter', 'Tab', 'Space', ' ', 'Backspace', 'Delete', 'Insert', 'Home', 'End', 'PageUp', 'PageDown', 'Up', 'Down', 'Left', 'Right', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', '.', ',', '/', ';', "'", '[', ']', '\\', '-', '=', '`', 'Period', 'Comma', 'Esc'].includes(key));
export function normalizeShortcuts(value) {
  return Object.fromEntries(Object.entries(DEFAULT_SHORTCUTS).map(([action, fallback]) => {
    const b = value?.[action], key = typeof b?.key === 'string' ? b.key.trim() : '';
    return [action, validKey(key) ? { key, shift: b.shift === true, command: b.command === true, alt: b.alt === true } : { ...fallback }];
  }));
}
const codes = { '.': 'Period', ',': 'Comma', '/': 'Slash', ';': 'Semicolon', "'": 'Quote', '[': 'BracketLeft', ']': 'BracketRight', '\\': 'Backslash', '-': 'Minus', '=': 'Equal', '`': 'Backquote', ' ': 'Space' };
export function matchesShortcut(e, binding) {
  const key = keyValue(binding.key), code = /^[a-z]$/i.test(key) ? `Key${key.toUpperCase()}` : /^[0-9]$/.test(key) ? `Digit${key}` : codes[key] ?? key;
  return !e.repeat && (e.code === code || keyValue(e.key).toLowerCase() === key.toLowerCase()) &&
    !!e.shiftKey === binding.shift && !!(e.metaKey || e.ctrlKey) === binding.command && !!e.altKey === binding.alt;
}
export function shortcutLabel(b) {
  return [b.command && 'Cmd/Ctrl', b.alt && 'Alt', b.shift && 'Shift', b.key === 'Escape' ? 'Esc' : b.key].filter(Boolean).join('+');
}
