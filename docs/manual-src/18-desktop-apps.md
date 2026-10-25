---
title: Desktop apps
section: Manual
order: 18
summary: Real native apps — files, dialogs, notifications, tray, menus, storage, a local web server — from the same project, in JS or Rust.
---

Desktop apps can use native files, dialogs and windows through Nord’s desktop bridge. Begin with a desktop template, then enable only the capabilities your app needs.

::: dummies
A file picker can be cancelled. Check for a returned path before reading. Native permissions and browser support differ; a capability listed in the API still needs the proper desktop environment.
:::

A Nord project can be a **desktop app**, not just a game. Add a `desktop` block to `nord.project.json`, call `window.nord.desktop.*` from your JS (or `nord_app_wasm::desktop::Desktop` from Rust) and run it in the native player. Everything goes through one Rust backend, `nord-desktop`, which checks every call against your declared **permissions**.

::: dummies
Think of it as a phone-app permission list. Your app can only touch what you wrote in `desktop.permissions`. Nothing declared = it can only keep its own settings and files in its own folder and show dialogs.
:::

## Quick start
```nord-live
// the idea in miniature: every desktop call is a promise that either resolves or rejects with a code like "denied"
const granted = { store: true, notifications: false };
const call = async (area) => { if (!granted[area]) { const e = new Error(`permission '${area}' not granted`); e.code = 'denied'; throw e; } return 'ok'; };
console.log(await call('store'));
console.log(await call('notifications').catch((e) => e.code));
```

**File: your script, for example `scripts/Notes.js`** (the `import` at the top of the file, the calls inside methods)
```js
import desktop from './nord-desktop.js';          // also window.nord.desktop
await desktop.ready;
await desktop.fs.writeText('notes/a.md', '# hi');   // appData:notes/a.md (always allowed)
const picked = await desktop.dialog.open({ filters: [{ name: 'Markdown', extensions: ['md'] }] });
if (picked) console.log(await desktop.fs.readText(picked[0]));   // user-picked paths are readable
await desktop.notify('Done', 'Saved your note');                  // needs permissions.notifications
```
Develop with `nord serve .` (same API, same permission checks over HTTP), run natively with `nord export` + `nord-player <folder>`, ship with `nord bundle-mac` / `nord bundle-portable` ([Packaging](packaging.html)).

## Three transports, one API
| Where | Transport | What works |
|---|---|---|
| Native player (`nord-player`) | `ipc` (wry) → Rust | everything below |
| `nord serve` / editor Play | `http` → the same Rust bridge | everything (dialogs are native only if the dev machine has the `native` build; otherwise stubs) |
| Plain browser export | `web` fallbacks | store (localStorage), virtual app-data files, `Notification`, clipboard write, `confirm`/`alert`, file picker; the rest rejects with `unsupported` |

## Permissions (`desktop.permissions`)
Default = least privilege. Review/edit them in the editor: **Project ▸ Desktop app permissions…**.

**In the editor:** @ui[Project ▸ Desktop app permissions…], then tick what the app may do.

**In the file** `nord.project.json`, the window writes this block:
```json
"desktop": {
  "permissions": {
    "fs": { "roots": ["documents", "picked"], "write": true },
    "dialogs": true, "notifications": true, "clipboard": "write",
    "net": { "hosts": ["api.example.com"] }, "process": ["git"],
    "tray": true, "globalShortcuts": false, "windows": false, "server": false, "prompt": true
  },
  "singleInstance": true, "schemes": ["myapp"], "fileTypes": [{ "name": "Markdown", "ext": ["md"], "mime": "text/markdown" }]
}
```
* **Files:** paths are `appData:x` (or a bare relative path), `documents:`, `downloads:`, `temp:` (if granted) or an absolute path the user **picked in a dialog** (`picked`). `..`, symlink escapes, drive letters, `CON`/`NUL`, alternate streams are all denied; roots can't be deleted.
* **Prompts:** sensitive things (network host, running programs, clipboard read, global shortcuts, local servers, autostart) ask the user once (`prompt: true`), remembered in `grants.json`. Every call is written to `audit.log` in the app data folder.
* ⚠ This is an **application-level guard**, not an OS sandbox. It limits what the page/scripts can ask for; it does not contain a malicious native binary.

## API cheat sheet (`window.nord.desktop`)
| Area | Calls |
|---|---|
| `app` | `info() paths() permissions() launch() audit() quit() setQuitGuard() setAutostart()` |
| `fs` | `readText writeText append read write readJson writeJson list stat exists mkdir remove rename copy watch` |
| `dialog` | `open save folder recent message confirm` |
| `notify` | `notify(title, body)`, `.setBadge(text)`, `.setProgress(0..1)` |
| `clipboard` | `readText writeText readImage writeImage` |
| `store` / `secret` | `get set remove keys clear` · OS-keychain `get set delete` |
| `shell` | `openUrl openPath reveal` (http(s)/mailto only; paths must be in scope) |
| `process` / `http` | `run(program, args)` (allow-list, no shell) · `fetch(url)` (host allow-list) |
| `window` / `menu` / `tray` / `shortcut` | `open close setTitle setFullscreen setAlwaysOnTop` · `set context` · `set remove` · `register unregister` |
| `server` | `start({root, port, cors, spa, listing, liveReload, lan, cache}) stop list logs` |
| events | `on('menu' | 'tray' | 'drop' | 'open' | 'quit-requested' | 'shortcut:<id>', fn)` |

Full types: `runtime/desktop/nord-desktop.d.ts`. Helpers for real-app UX (undo stack, i18n/plurals/Intl formats, dark-mode follow, virtualised lists, pointer-based drag-reorder, roving keyboard focus): `library/apps/_ux.js`.

## Rust apps
```rust
use nord_app_wasm::{desktop::Desktop, serde_json::json};
let d = Desktop::new("com.me.notes", json!({ "fs": { "roots": ["picked"], "write": true }, "notifications": true }));
d.fs_write_text("notes/a.md", "# hi")?;        d.store_set("theme", json!("dark"))?;
if let Some(f) = d.pick_file()? { let text = d.fs_read_text(&f)?; }
d.notify("Saved", "a.md")?;
```
Native builds call the same backend (same permission checks); web builds fall back as in the table above and return `Error { code: "unsupported", … }` for the rest. Template: **Rust desktop app: notes**.

## Example apps (templates in the New-project dialog)
Code editor (CodeMirror: tabs, file tree, highlighting, find/replace, multi-cursor, quick open), local **web server** (live reload, SPA fallback, CORS, directory listing, request log), notes, file organiser, clipboard manager (tray + global shortcut), markdown editor (live preview).

::: tip
Native menus, tray, global shortcuts and the dock badge have had less testing on real Mac and Windows machines than on Linux. The Linux build (webkit2gtk) runs the full IPC test in CI. See `docs/KNOWN_ISSUES.md`.
:::
