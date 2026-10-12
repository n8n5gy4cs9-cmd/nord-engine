import { desktopAppSpec } from '../lib.mjs';
export default () => desktopAppSpec('app-clipboard-manager', 'Clipboard Manager', 'clipboardmanager', {
  cm: false, ux: true, marked: false,
  permissions: { clipboard: 'read', tray: true, globalShortcuts: true, notifications: true, prompt: false },
  template: { id: 'desktop-clipboard-manager', title: 'Desktop app: clipboard manager', description: 'Clipboard history with search/pin, tray icon + menu, global shortcut Ctrl+Alt+V, badge count.' },
  example: true,
});
