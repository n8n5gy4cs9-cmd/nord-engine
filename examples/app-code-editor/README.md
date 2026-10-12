# Nord Code Editor
A Nord **desktop app**: plain HTML + ES modules using `window.nord.desktop` (files, dialogs, menus, ...). Permissions are declared in `nord.project.json` → `desktop.permissions` (least privilege; see docs/DESKTOP_APPS.md).

- Develop: `nord serve .` (open the URL; the dev server provides the same desktop API with the same permission checks).
- Native window: `nord export . --target html`, then run the player: `nord-player <export folder>` (`nord bundle-mac` makes a .app).
- In a plain browser the app falls back to browser storage where it can.

Keys: Ctrl/Cmd+S save, +P quick open, +G go to line, +F find/replace, +D next occurrence (multi-cursor), +/ comment, +O open, +N new.
