import { desktopAppSpec } from '../lib.mjs';
export default () => desktopAppSpec('app-web-server', 'Nord Web Server', 'webserver', {
  permissions: { fs: { roots: ['picked'], write: false }, dialogs: true, server: true, notifications: true, clipboard: 'write' },
  template: { id: 'desktop-web-server', title: 'Desktop app: local web server', description: 'Serve a folder over HTTP: live reload, SPA fallback, CORS, directory listing, request log + graph — window.nord.desktop.server.' },
  example: true,
});
