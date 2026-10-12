import { desktopAppSpec } from '../lib.mjs';
export default () => desktopAppSpec('app-markdown-editor', 'Markdown Editor', 'markdowneditor', {
  cm: true, ux: true, marked: true,
  singleInstance: true,
  fileTypes: [{ name: 'Markdown', ext: ['md', 'markdown'], mime: 'text/markdown' }],
  permissions: { fs: { roots: ['picked', 'documents'], write: true }, dialogs: true },
  template: { id: 'desktop-markdown-editor', title: 'Desktop app: markdown editor', description: 'Split view CodeMirror + live sanitised preview (marked), open/save/export HTML, drag-drop, file association for .md.' },
  example: true,
});
