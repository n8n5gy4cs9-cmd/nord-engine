import { desktopAppSpec } from '../lib.mjs';
export default () => desktopAppSpec('app-code-editor', 'Nord Code Editor', 'codeeditor', {
  cm: true, singleInstance: true,
  permissions: { fs: { roots: ['picked', 'documents'], write: true }, dialogs: true },
  template: { id: 'desktop-code-editor', title: 'Desktop app: code editor', description: 'Tabs, file tree, syntax highlighting (JS/TS/HTML/CSS/JSON/MD/Rust/GLSL/TOML), find & replace, multi-cursor, quick open — CodeMirror 6 + window.nord.desktop.' },
  example: true,
  note: '\nKeys: Ctrl/Cmd+S save, +P quick open, +G go to line, +F find/replace, +D next occurrence (multi-cursor), +/ comment, +O open, +N new.\n',
});
