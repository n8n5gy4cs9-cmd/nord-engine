# Testing & verification

| Layer | How | When |
|---|---|---|
| Rust crates | `cargo test --workspace` , `cargo clippy --workspace -- -D warnings`, `cargo fmt --check` | every Rust change |
| Wasm build | `cargo build -p nord-runtime-wasm --target wasm32-unknown-unknown` | M5+ |
| Runtime JS | `node --test runtime/**/*.test.mjs` (core is engine-agnostic → unit-testable) | M2+ |
| Editor / runtimes in browser | Playwright (chromium at `/opt/pw-browsers`) screenshots + console-error assertions: `node tools/e2e.mjs` | M2+ |
| Examples smoke | `node tools/smoke-examples.mjs` builds each example, loads in headless Chromium for 3 s, asserts no console errors + non-blank canvas | M6 |
| Offline guarantee | `nord check-offline dist/` ; headless run with network blocked (`route.abort` for non-localhost) | every export |
| Vendor integrity | `node tools/vendor.mjs --verify` (sha256 vs VENDOR.json) | CI |
| Task consistency | `node tools/tasks.mjs check` | CI |
| Tauri / mac | GitHub Actions `macos-14` builds `nord-editor`, `nord-player`; manual smoke on M1 Max | M3+ |

Sandbox limits (Linux cloud container): no macOS, no WKWebView, no Tauri GUI. Use browser-served editor + CI for the rest.

Bug workflow: reproduce → add to `docs/KNOWN_ISSUES.md` (ID BUG-nnn) → fix → regression test/example → tick in `task.md` → `CHANGELOG.md`.
