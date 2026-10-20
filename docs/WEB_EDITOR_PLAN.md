# Plan: Nord Editor on the web (and on a Linux server)

**Goal:** one editor, four ways to run it — **macOS, Windows, Linux** (native, today) **and the web**: a browser tab on any OS, and a **self-hosted server** on Linux (a VPS, a home server, a Docker container) that several browsers can reach. Same UI, same project format, same exports.

Status: **implemented** (milestone M11; how it works: `WEB_EDITOR.md`, user guide: manual chapter 27). Differences from this plan: the project API pushes events over **SSE** instead of WebSocket; `RemoteFs` is a sync layer over an in-memory tree rather than a sync `Vfs` over HTTP; the browser build renders with eframe's **glow/WebGL2** backend. Native editor stays the primary target; the web build is additive (owner rule: nothing existing is removed).

## 1. Why this is feasible
The editor is egui (`crates/nord-editor`, eframe) — egui runs in the browser as WebAssembly (eframe's web backend, WebGL2 now / WebGPU where available). Three things stop a plain recompile today; each has a known answer:

| Native today | Problem in a browser | Answer |
|---|---|---|
| `std::fs` projects, `nord-core::io` | no disk | a **`Vfs` trait**: native FS, browser (OPFS/IndexedDB + File System Access API), or **remote** (HTTP/WebSocket to the server) |
| `wry` child webview for viewport/game/docs | not available in a browser | an **`<iframe>` overlay** positioned over a reserved egui rect (same trick as the native child webview); IPC via `postMessage` instead of wry IPC |
| `rfd` dialogs, `std::process` (cargo, ffmpeg, esbuild), `nord serve` | no processes, no ports | `rfd` already has a wasm async path; processes move **behind a `Host` trait**: local process (native), **server job** (web-server mode), or "not available" (static web) |

`nord-serve` (axum) already implements the dev server, live reload and the editor↔viewport `/api/*` bridge, so the server mode is mostly *reusing* it with a project API and auth, not new technology.

## 2. Deployment matrix
| | Native app | Web (static / PWA) | Web (server) |
|---|---|---|---|
| Where it runs | desktop | browser only, any static host | Linux server + any browser |
| Projects live in | local disk | browser storage (OPFS) or a picked folder (Chromium File System Access) + zip import/export | server workspace dir (per user) |
| Play / preview | wry webview + `nord serve` | iframe + **service worker** serving the project from the Vfs | iframe → server's `nord serve` |
| Export (web zip, single file) | `nord build` | in-browser (nord-core/export compiled to wasm: validate, copy, zip, single-file) | server `nord build` (full: minify, atlas, ffmpeg) |
| Rust/WASM tier, Mac/Win/Linux app bundles | yes | **no** (needs cargo/codesign) | cargo + wasm toolchain on server; Mac `.app` bundles only if the server is macOS |
| Multi-user | n/a | n/a | yes (accounts or one shared token) |
| Offline | yes | yes after first load (PWA) | needs the server |

## 3. Architecture
```
crates/nord-editor (egui UI, unchanged panels)
   │  uses only these traits
   ├─ Vfs      read/write/list/watch/rename/delete + thumbnails cache       NativeFs · BrowserFs(OPFS/FSA) · RemoteFs(HTTP+WS)
   ├─ Host     run build/export/serve, spawn jobs, stream log lines          LocalHost · ServerHost(jobs API) · NoHost
   ├─ Dialogs  open/save/pick folder, clipboard, notifications              rfd (native & wasm) · fallbacks
   └─ Viewport embed game/edit view/docs                                    WryViewport · IframeViewport
crates/nord-editor-web   wasm entry point (eframe web runner, index.html, PWA manifest, service worker)
crates/nord-editor-server  axum binary: serves the wasm editor + `/api/projects/*` + `/ws` + jobs + auth (builds on nord-serve)
```
* **Project API (server mode)**: `GET/PUT /api/p/{project}/file?path=` (atomic write = temp+rename, same as native), `GET /api/p/{project}/tree`, `POST …/rename|delete`, WebSocket `/ws/p/{project}` for file-change events (replaces the native file watcher) and job log streaming, `POST /api/p/{project}/jobs/{build|export|check-offline|thumbs}`.
* **Preview**: the iframe points at `/play/{project}/` (the existing dev-server routes: `/vendor`, `/runtime`, live reload, `/__edit`). In static mode a service worker answers the same URLs from the Vfs.
* **Collaboration** (later, optional): one writer lock per project + read-only viewers first; real-time multi-cursor editing is out of scope. Event sheets are JSON, so the existing undo `Command`s can be replayed over the WebSocket.
* **Offline guarantee** stays: the wasm editor, fonts and docs are vendored; no CDN, no telemetry.

## 4. Security (server mode)
The server runs project code (JS in the browser sandbox, but `nord build`/cargo run on the server). Rules: bind `127.0.0.1` by default; remote use goes behind a reverse proxy with TLS (documented nginx/Caddy snippets); auth = single admin token or users file (argon2); every path is canonicalised and jailed to the user's workspace (reuse `safePath`/`io` jail); jobs run as an unprivileged user, with CPU/RAM/time limits and (optionally) `bubblewrap`/container isolation; no shell strings, argv only; upload size limits; CSRF-safe (token header, SameSite cookies); desktop-bridge capabilities (`/__desktop`) are **off** in server mode. Never mount untrusted projects with the Rust tier unless sandboxed.

## 5. Phases (milestone M11)
| Phase | Deliverable | Verifiable by |
|---|---|---|
| W0 Spike | `cargo build --target wasm32-unknown-unknown -p nord-editor` shell renders in Chromium (egui hub + hierarchy with a hard-coded project); measure wasm size/start time; WebGL2 vs WebGPU | screenshot via Playwright; size budget (<25 MB wasm, <3 s start) |
| W1 Vfs/Host/Dialogs traits | `nord-core::io`, panels, autosave, asset browser, code editor go through `Vfs`; native behaviour unchanged | existing `cargo test -p nord-editor` + kittest suite green |
| W2 Browser build | `nord-editor-web`: hub, open/new project (OPFS), zip import/export, all panels except Viewport/Export | Playwright e2e: new project → add entity → save → reload → still there |
| W3 Iframe viewport | game view, 2D edit view, 3D edit view, console, docs viewer via iframe + `postMessage`; service worker serving the project | e2e: press Play, game canvas non-blank; select/move entity in edit viewport |
| W4 Server | `nord-editor-server`: static wasm + project API + WS + jobs; RemoteFs/ServerHost; token auth | integration tests (`reqwest`), e2e against a running server; path-traversal tests |
| W5 Server builds | export/zip/offline-check/thumbnails as jobs with log streaming; optional Rust-tier jobs | e2e: export from the browser, download zip, open it offline |
| W6 Accounts + packaging | users, per-user workspaces, quotas; `Dockerfile`, `docker-compose.yml`, systemd unit, nginx/Caddy examples, `nord-editor-server --help` | smoke test in container |
| W7 PWA + polish | installable, offline shell, File System Access folder mode, keyboard shortcuts that don't clash with the browser, touch/trackpad, HiDPI, clipboard | manual checklist + Lighthouse PWA |
| W8 CI + docs | CI builds the wasm editor + server, runs e2e; manual chapter "Run the editor in a browser / on a server"; known-issues entries | CI green, manual `--check` |

## 6. Risks
* **egui + wasm size/startup** — mitigate with `wasm-opt -Oz`, brotli, lazy-load syntect themes, split optional panels. Budget in W0; if too large, ship the server mode first (the browser still downloads the wasm once, cached).
* **Embedding DOM (iframe) over a canvas** — focus, z-order, HiDPI and scroll sync; egui must reserve the rect and JS positions the iframe each frame. Prototype in W0/W3 (the native wry viewport already solved the same problem; reuse its sizing logic).
* **File System Access API** only in Chromium — Firefox/Safari fall back to OPFS + zip import/export; documented.
* **Text input / IME / shortcuts** in egui-web (Cmd+P, Cmd+K collide with browser keys) — remap defaults for web, allow rebinding (already supported).
* **Long builds** — jobs are async with log streaming; cancel button; per-user concurrency limit.
* **Native-only crates** (`nord-desktop` native bridge, `wry`, `syntect` regex engine choice) must be feature-gated; use `fancy-regex` syntect on wasm.
* **Unverified here**: the sandbox is Linux with headless Chromium, so W0–W5 are verifiable in CI; macOS/Safari/Windows-Edge behaviour needs owner checks (recorded in `KNOWN_ISSUES.md`).

## 7. Decisions needed from the owner (defaults in bold)
1. Server auth: **single token + optional users file** vs full accounts first.
2. Static-web projects storage: **OPFS + zip** (all browsers) with optional folder mode (Chromium).
3. Rust-tier builds on the server: **opt-in, container-isolated** vs not supported.
4. Realtime co-editing: **no** (single writer lock) for v1.
