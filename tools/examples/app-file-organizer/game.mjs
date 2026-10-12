import { desktopAppSpec } from '../lib.mjs';
export default () => desktopAppSpec('app-file-organizer', 'File Organiser', 'fileorganizer', {
  cm: false, ux: true, marked: false,
  permissions: { fs: { roots: ['picked'], write: true }, dialogs: true, notifications: true },
  template: { id: 'desktop-file-organizer', title: 'Desktop app: file organiser', description: 'Pick a folder, sort files into folders by type/month with preview + undo, find duplicates (SHA-256), virtual table for 10k+ files.' },
  example: true,
});
