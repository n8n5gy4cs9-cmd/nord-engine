# Testing & verification

| Layer | How | When |
|---|---|---|
| Rust crates | `cargo test --workspace` , `cargo clippy --workspace -- -D warnings`, `cargo fmt --check` | every Rust change |
| Wasm build | `cargo build -p nord-runtime-wasm --target wasm32-unknown-unknown` | M5+ |
| Runtime JS | `node --test runtime/**/*.test.mjs` (core is engine-agnostic → unit-testable) | M2+ |
| Runtimes + viewport JS in browser | Playwright (chromium at `/opt/pw-browsers`) screenshots + console-error assertions: `node tools/e2e.mjs` (incl. `/__edit`) | M2+ |
| Editor UI (egui) | `cargo test -p nord-editor` — unit tests + `tests/ui.rs` (egui_kittest, headless: panels, undo, inspector, code-editor typing, palette, autosave recovery, anim/tile editors). Real-window smoke: `xvfb-run -a -s "-screen 0 2000x1300x24" target/debug/nord-editor <project>` + `import -window root x.png` (needs libxkbcommon-x11, mesa; software GL) | M3+ |
| Edit viewport / log bridge | `node tools/e2e.mjs edit-viewport-2d edit-viewport-3d game-log-bridge` (uses the real `nord serve`; build `cargo build -p nord-cli` first) | M3+ |
| Examples smoke | `node tools/smoke-examples.mjs` builds each example, loads in headless Chromium for 3 s, asserts no console errors + non-blank canvas | M6 |
| Offline guarantee | `nord check-offline dist/` ; headless run with network blocked (`route.abort` for non-localhost) | every export |
| Vendor integrity | `node tools/vendor.mjs --verify` (sha256 vs VENDOR.json) | CI |
| Task consistency | `node tools/tasks.mjs check` | CI |
| Native / mac | GitHub Actions `macos-14` builds `nord-editor`, `nord-player`; manual smoke on M1 Max | M3+ |

Sandbox limits (Linux cloud container): no macOS, no display/WKWebView. egui renders headless via kittest; viewport JS tested in Chromium; the rest via macOS CI.

Bug workflow: reproduce → add to `docs/KNOWN_ISSUES.md` (ID BUG-nnn) → fix → regression test/example → tick in `task.md` → `CHANGELOG.md`.
