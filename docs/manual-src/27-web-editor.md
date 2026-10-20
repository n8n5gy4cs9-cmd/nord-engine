---
title: Run the editor in a browser or on a server
section: Manual
order: 27
summary: The same Nord editor in a browser tab (no install, projects stay in your browser) or on your own Linux server for you and your team.
---

The Nord editor you know from the desktop also runs as a web page. Nothing in the desktop app changes: the web editor is an additional way to run the same editor, with the same project format, the same panels and the same exports.

## Two ways to use it
| | **Browser only** | **Your own server** |
|---|---|---|
| What you need | any static web host (or `python3 -m http.server`) | one machine that runs `nord-editor-server` |
| Where projects live | in your browser (IndexedDB), plus zip import / download | on the server, one folder per user |
| Export | in the browser: web zip | on the server: full pipeline (minify, single file, optimise, event-sheet compile) |
| Several people | no (one browser) | yes, each with their own workspace |
| Works offline | yes, after the first load | needs the server |

## Browser only
1. Build it once: `tools/build-web-editor.sh` (needs `rustup target add wasm32-unknown-unknown` and `cargo install wasm-bindgen-cli`, the version printed by the script's error if they differ). The result is the folder `dist/web-editor` — a normal static site (about 10 MB of wasm, 2.7 MB brotli-compressed, plus the engine runtime).
2. Serve that folder over `http://localhost` or `https://` (service workers and the wasm file need a server; `file://` does not work), for example `python3 -m http.server -d dist/web-editor 8090`.
3. Open it. You get the project hub: **Create project** makes a project in your browser (folder `/projects`). It is saved automatically, so reloading the page keeps it.

**Open project…** imports a `.zip` of a project; **File ▸ Download project (.zip)** gives you a project back. Use these to move projects between the web and the desktop editor. Browser storage can be cleared by the browser — download a zip to keep a safe copy.

**Play** and the 2D / 3D scene view run inside the page. **Export…** builds a zip of your game in the browser. Differences from the desktop: no minify, single-file, asset optimising or event-sheet compile (these need Node or ffmpeg — use the server mode or the desktop app), no Rust/WASM projects, no macOS/Windows app bundles, no phone preview.

### Shortcuts in the browser
Browsers keep some shortcuts (`Cmd/Ctrl+P` print, `+K` search, `+1…4` tabs, `+R` reload). In the web editor quick open, the command palette, tab switching and play use **Alt** instead: `Alt+P`, `Alt+K`, `Alt+1…4`, `Alt+R`. The Settings window lists the current keys.

## On your own server
`nord-editor-server` serves the web editor and keeps projects in plain folders: `<workspace>/<user>/<project>`.

```bash
cargo build --release -p nord-editor-server -p nord-cli
tools/build-web-editor.sh
./target/release/nord-editor-server --workspace ./nord-workspace --web dist/web-editor --engine .
```
It listens on `127.0.0.1:8787` and prints a random **login token**. Open the address, enter the token when asked, and the hub lists the projects on the server. Opening one downloads its files into the page; every save sends only the changed files back. **Export…** runs on the server and the zip downloads when it is done; the log lines appear in the Console.

### Several people and passwords
Use a users file instead of the token: one line per person, `name:hash`.
```bash
printf '%s' 'a long password' | nord-editor-server hash-password      # prints the hash
nord-editor-server --users ./users ...
```
Each user gets their own workspace and a size limit (`--quota-mb`). Only one session at a time may change a project (the first one to open it); others get a notice and see it read-only, and the lock frees itself a minute after the page is closed. Real-time co-editing is not part of this version.

### Put it on the internet safely
The server binds to loopback by default. For remote use run it behind **nginx or Caddy with HTTPS** (ready-made `deploy/web-editor/nginx.conf` and `Caddyfile`), start it with `--secure-cookies`, and never use `--no-auth` (the server refuses it on non-loopback addresses anyway). What the server does to protect you: every path is checked against the user's workspace (no `..`, no absolute paths, symlinks are not followed), writes are atomic, state-changing requests need a custom header on top of SameSite=Strict cookies, failed logins are throttled, export jobs run as the server's own unprivileged user with a time limit (`--job-timeout`) and a per-user parallel limit, and the desktop-app bridge does not exist on the server. **Rust/WASM projects are not built on the server** unless you start it with `--allow-rust-jobs`; that runs the project's own build scripts, so only do it inside a container.

Packaging: `deploy/web-editor/Dockerfile` + `docker-compose.yml` (container limits, read-only root) and a hardened `nord-editor.service` for systemd. Back up the workspace folder (it is plain files — rsync, restic or snapshots).

## When something does not work
- *Blank page / "could not start":* the browser needs WebGL2 (every current browser has it).
- *Play stays empty:* the service worker could not register. It needs `https://` or `http://localhost`; private windows of some browsers block it.
- *"Engine files are not available":* the page was served without `engine/` (rebuild with `tools/build-web-editor.sh`).
- *"Another session is editing this project":* close the other tab, wait a minute, reopen.
