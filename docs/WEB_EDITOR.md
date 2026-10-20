# Web editor — how it works (M11)

User-facing guide: manual chapter 27 (*Run the editor in a browser or on a server*). Plan and decisions: `WEB_EDITOR_PLAN.md`, ADR-021 in `DECISIONS.md`. **The desktop editor is unchanged**: every web difference is behind `cfg(target_arch = "wasm32")` or a target-specific dependency in `Cargo.toml`; native builds compile the same code as before.

## Pieces
| Piece | Where | Role |
|---|---|---|
| `nord_core::vfs` | `crates/nord-core/src/vfs.rs` | `Vfs` trait + `NativeFs` (`std::fs`, desktop default) + `MemFs` (browser default); free functions mirror `std::fs`, `PathExt::v_exists/v_is_dir/v_is_file`; `set_backend`. `nord-core`, `nord-editor` and `nord-export`'s web pipeline use it. Desktop packaging modules (`mac`, `portable`, `rust`, `addon`) keep `std::fs`. |
| `platform` | `crates/nord-editor/src/platform.rs` | seam for native dialogs, dev server, threads/`Host` (`LocalHost`, `NoHost`), shortcut modifiers, clipboard |
| `web` | `crates/nord-editor/src/web.rs` (+ `web/store.js`) | browser glue: IndexedDB persistence of the `MemFs`, zip import/download, iframe panes, the web `Hub`, engine files on demand, server sync |
| `nord-editor-web` | `crates/nord-editor-web` | wasm entry (`start`, `read_project_file`), `www/` (index.html with login prompt, PWA manifest, **service worker**) |
| `nord-editor-server` | `crates/nord-editor-server` | axum server: static editor, project API, jobs, auth |
| `tools/build-web-editor.sh` | | builds `dist/web-editor` (wasm-bindgen, optional wasm-opt/brotli, engine runtime + `engine/manifest.json`) |

## Play and the edit viewport
The game and the 2D/3D edit view run in `<iframe>`s placed over the egui rect (same idea as the native wry child webview; `viewport/webview.rs`). Their URLs are `play/…` below the editor page; the **service worker** (`www/sw.js`) answers them like `nord serve`: `/vendor`, `/runtime`, `/editor` from `engine/`, project files from the wasm editor over a MessageChannel (it reads its `Vfs`), `edit.html` for `play/__edit`, the game's console forwarded by an injected script. The edit viewport (`editor/viewport/edit.js`, only with `?web=1`) uses `postMessage` instead of SSE/POST; the web `Hub` turns those into the same `inbox`/`logs`/`edit_tx` the native code already reads. Rendering uses eframe's **glow (WebGL2)** backend (the desktop keeps wgpu).

## Storage
* Browser: `MemFs` mirrored to IndexedDB (`nord-editor`/`files`), only files whose revision changed, every 1.5 s. `/engine`, `/tmp`, `…/dist/` are never persisted.
* Server: the page pulls a project into the `MemFs` on open and pushes changed files with `PUT /api/p/<project>/file?path=`; unsaved uploads are retried; a project made in the browser is created on first save (`POST /api/projects`).

## Server API (all under `/api`, cookie session or `Authorization: Bearer <token>`, `x-nord: 1` on non-GET)
`GET ping` · `POST login {token | user,password}` · `POST logout` · `GET/POST projects` · `DELETE p/<p>` (needs `x-nord-confirm: <p>`) · `GET p/<p>/tree` · `GET/PUT/DELETE p/<p>/file?path=` · `POST p/<p>/rename {from,to}` · `GET/POST/DELETE p/<p>/lock` · `GET p/<p>/events` (SSE: file changes, job logs) · `GET p/<p>/download.zip` · `POST p/<p>/jobs/{export|check-offline|thumbs}` → `{job}` · `GET p/<p>/jobs/<id>/status?since=N` · `DELETE p/<p>/jobs/<id>` (cancel) · `GET p/<p>/jobs/<id>/download`.

## Tests
`cargo test -p nord-editor-server` (11: jail, symlinks, CSRF, isolation, lock, quota, jobs, cancel/timeout) · `node tools/web-editor-test.mjs` (browser-only: create → IndexedDB → reload → play → export) · `node tools/web-server-test.mjs` (real server: login → sync → reopen → play → server export). Build first: `tools/build-web-editor.sh`, `cargo build -p nord-editor-server -p nord-cli`. CI job `web-editor`.
