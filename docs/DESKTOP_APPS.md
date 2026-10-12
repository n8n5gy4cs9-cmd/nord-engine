# Desktop apps — design (M9-01)

Status: **implemented (M9)** with the defaults chosen below (owner can still veto: plain DOM UI, JSON store + optional SQLite, portable zip/tar.gz first). See ADR-020 in `DECISIONS.md`.

## What exists now
* Crate `crates/nord-desktop`: `caps` (manifest, audit, grants), `paths`, `fs` (scoped, atomic, polling watcher), `store` (+ `sqlite` feature, migrations), `services` (dialogs/notifications/clipboard/shell/secrets traits; `native` = rfd/notify-rust/arboard/opener, `keychain` = keyring, Headless for tests), `process` (+ `http`), `server` (static HTTP server), `lifecycle` (single instance, argv/deep links, autostart), `window` (menu/tray/window specs → `HostCommand`s), `bridge` (JSON dispatcher = the whole JS API).
* JS client `runtime/desktop/nord-desktop.js` (+ `.d.ts`): `ipc` / `http` / `web` transports. `nord serve` mounts `/__desktop/call` (needs the `x-nord` header; same permissions).
* Player shell `crates/nord-player` (`--features shell`): IPC, multi-window, native menu bar, tray, global shortcuts, drag & drop, single instance, window-state persistence, quit guard.
* Rust: `nord_app_wasm::desktop` (+ `ux`). Packaging: `nord bundle-mac` (+ file types/URL schemes), `nord bundle-portable --os windows|linux`, `docs/PACKAGING.md`.
* Editor: **Project ▸ Desktop app permissions…**; `nord-core` validates the manifest.
* Examples/templates: code editor, web server, notes, file organiser, clipboard manager, markdown editor (JS) and Rust notes.
* Verified on Linux (webkit2gtk under Xvfb, headless Chromium); macOS/Windows paths compile-checked or CI-only — see KNOWN_ISSUES.

## Goal
Build *real* desktop apps (notes, file organiser, clipboard manager, markdown editor…) from a Nord project, in either tier:
- **JS/web tier** — HTML/JS app (Phaser UI or plain DOM) running in a native window, calling `window.nord.desktop.*`.
- **Rust tier** — `nord-app-wasm` (eframe/egui) app calling a Rust `Desktop` API.

Same project, same export pipeline; the app runs in the browser too with graceful fallbacks.

## Decision: shell = reuse `nord-player` (wry+tao); Rust apps run native egui — both on one backend crate
| Option | Verdict |
|---|---|
| A. Extend `nord-player` (wry webview + tao window) with an IPC bridge | **Chosen for JS apps.** Already built, already bundles `.app`; WebView2 / WKWebView / WebKitGTK per OS. Adds IPC + a few tao features (menus, tray, multi-window) |
| B. Rust apps as *native* eframe (not wasm in a webview) | **Chosen for Rust apps.** `nord-app-wasm::launch` already runs native; add the `Desktop` services to `Ctx`. No webview, no IPC |
| C. Tauri | Rejected (ADR-013: we own the shell; Tauri adds a framework and a JS API we don't control) |
| D. Everything in the webview, Rust app as wasm inside it | Rejected: slower, needs IPC for every call, loses native text input/IME |

So: **one Rust crate `nord-desktop` holds all services** (fs, dialogs, notifications, clipboard, store, paths, shell-open, windows/tray/menu helpers where toolkit-independent). The JS bridge (in `nord-player`) and the Rust API (in `nord-app-wasm`) are two thin front-ends over it. No logic is duplicated; permission checks live in the crate, so both tiers are equally sandboxed.

```
JS app  --window.nord.desktop.fs.read()--> wry ipc_handler --> Bridge(dispatch+caps) --\
                                                                                        >-- nord-desktop services
Rust app --desktop.fs().read()-------------------------------> (same Caps check)    --/
Web build (no shell): JS shim / cfg(wasm) impl falls back to File System Access API, Notification API, IndexedDB/localStorage; unsupported calls return a typed `Unsupported` error.
```

### Bridge protocol (JS)
- Page → host: `window.ipc.postMessage(JSON {id, method:"fs.read", params})`; host → page: `evaluate_script("__nord_reply(id, ok, payload)")`. Promise-based wrapper in `runtime/desktop/nord-desktop.js` (injected via `with_initialization_script`; same file used in the editor's Play, where calls go through `nord-serve` HTTP instead — ADR-014 style — with the same capability checks, so dev ≈ exported).
- Events host → page (file watch, menu click, tray click, deep link, drop): `nord.desktop.on("menu", fn)`.
- Only pages loaded from `nord://game/` may call the bridge (origin check); remote URLs never get it.
- Binary data is base64 (small) or via `nord://` blob URLs for large reads (decide in M9-10).

## Capability model (least privilege)
`nord.project.json`:
```json
"desktop": { "permissions": {
  "fs": { "roots": ["appData", "documents", "picked"], "write": true },
  "dialogs": true, "notifications": true, "clipboard": "write",
  "net": { "hosts": ["api.example.com"] }, "process": [], "tray": true, "globalShortcuts": false } }
```
- Default = **nothing** except appData storage and dialogs. Everything else must be declared; the export bakes the manifest into `nord.json`; the host never widens it at runtime.
- `fs` roots are symbolic: `appData` (per-app dir), `documents`, `downloads`, `temp`, `picked` (paths the user chose through an Open/Save dialog this run or persisted as bookmarks). No arbitrary absolute paths from the app.
- Path rules (implemented once in `nord-desktop::fs`): canonicalise → must be inside a granted root → reject `..`, symlink escapes, Windows device names/UNC/ADS; tests for each (M9-16).
- Sensitive grants (`process`, `net`, `globalShortcuts`, `clipboard: read`) ask on first use (native confirm dialog), remembered per app; audit log in appData (`audit.log`); editor shows/reviews them (M9-12).
- macOS: App Sandbox is optional; when signed with sandbox entitlement, `picked` uses security-scoped bookmarks (M9-03). Unsandboxed ad-hoc builds (default) rely on our own caps only — **our caps are not an OS sandbox**; documented honestly (the app's own code is trusted, the page content is the thing constrained).

## What real apps need — checklist (→ task)
| Need | Task | Tier support |
|---|---|---|
| Read/write/list/watch files, user-picked folders | M9-03 | JS, Rust |
| Open/save/folder/message dialogs, recent files | M9-04 | JS, Rust |
| Notifications, dock/taskbar badge + progress | M9-05 | JS, Rust |
| Settings, key-value + structured store, secrets in keychain | M9-06 | JS, Rust |
| Clipboard, drag&drop, file associations, deep links, single instance | M9-07 | JS, Rust |
| Multi-window, menu bar, context menu, tray, global shortcuts, window state | M9-08 | JS (tao); Rust (eframe viewports + `tray-icon`/`muda`) |
| Timers/threads, HTTP, process spawn allow-list, quit confirm, autostart | M9-09 | JS, Rust |
| Typed API (`d.ts`), docs, same in dev & export | M9-10/11 | — |
| Permission manifest, prompts, editor UI | M9-12 | — |
| Packaging mac/win/linux, icons, versions, optional updater | M9-13 | — |
| IME, hi-DPI, dark-mode follow, keyboard nav, i18n, undo helpers | M9-14 | — |
| Templates/examples | M9-15 | — |
| Tests + CI matrix | M9-16 | — |

## Crate/library picks (all permissive, pinned in M9-02)
`rfd` (dialogs), `notify-rust` or platform calls (notifications), `arboard` (clipboard), `directories` (paths), `notify` (fs watch), `rusqlite` bundled (structured store; sled rejected — unmaintained), `keyring` (secrets), `muda` + `tray-icon` (menus/tray, work with tao and winit), `global-hotkey`, `single-instance`-style lock via a localhost/lockfile (own ~40 lines), `opener` (open URL/file), `ureq` (HTTP). Each is logged in `THIRD_PARTY.md` when added. `nord-desktop` features gate heavy deps so `cargo build --workspace` still works on bare Linux CI.

## Platform reality
- Sandbox is Linux: **only compiles + unit-tests** the fs/caps/store/protocol logic and the JS bridge in headless Chromium against a mock host. macOS/Windows backends, tray, menus, notifications, wry IPC, packaging are verified by CI (`macos-14`, `windows-latest`, `ubuntu`) or the owner — recorded in `KNOWN_ISSUES.md` as each lands.
- Wayland has no global shortcuts/tray guarantees; Linux support is best-effort and documented as such.

## Non-goals
Mobile; auto-update server (strategy doc only, opt-in later); full OS sandbox profiles; Electron-style node integration; remote content with bridge access.

## Open questions for the owner (defaults in bold)
1. JS apps: Phaser-UI or **plain DOM** as the recommended UI for non-game apps? (templates will show DOM; the bridge is UI-agnostic)
2. Structured store: **SQLite** (rusqlite bundled; one C dep) vs pure-Rust sled/redb.
3. Windows installer: **portable zip first**, MSI/NSIS later; Linux **tar.gz + AppImage**.
4. OK that our caps are not an OS sandbox in v1 (**yes**, documented)?
