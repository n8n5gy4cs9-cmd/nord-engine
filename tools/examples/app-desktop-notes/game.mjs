import { desktopAppSpec } from '../lib.mjs';
export default () => desktopAppSpec('app-desktop-notes', 'Desktop Notes', 'desktopnotes', {
  cm: false, ux: true, marked: false,
  singleInstance: true,
  schemes: ['nordnotes'],
  permissions: { fs: { roots: [], write: true }, dialogs: true, notifications: true },
  template: { id: 'desktop-notes', title: 'Desktop app: notes', description: 'Notes as files in the app data folder: search, reorder, autosave, import/export dialogs, reminders (notifications), dark-mode follow, en/de.' },
  example: true,
});
