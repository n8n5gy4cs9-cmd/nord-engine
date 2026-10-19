# Testing & verification

| Layer | How | When |
|---|---|---|
| Rust crates | `cargo test --workspace` , `cargo clippy --workspace -- -D warnings`, `cargo fmt --check` | every Rust change |
| Wasm build | `cargo check --manifest-path crates/nord-runtime-wasm/Cargo.toml --target wasm32-unknown-unknown`; examples: `node tools/e2e.mjs rust-platformer rust-physics-toys` (exports + runs them in Chromium) | M5+ |
| Runtime JS | `node --test runtime/**/*.test.mjs` (core is engine-agnostic → unit-testable) | M2+ |
| Runtimes + viewport JS in browser | Playwright (chromium at `/opt/pw-browsers`) screenshots + console-error assertions: `node tools/e2e.mjs` (incl. `/__edit`) | M2+ |
| Editor UI (egui) | `cargo test -p nord-editor` — unit tests + `tests/ui.rs` (egui_kittest, headless: panels, undo, inspector, code-editor typing, palette, autosave recovery, anim/tile editors). Real-window smoke: `xvfb-run -a -s "-screen 0 2000x1300x24" target/debug/nord-editor <project>` + `import -window root x.png` (needs libxkbcommon-x11, mesa; software GL) | M3+ |
| Edit viewport / log bridge | `node tools/e2e.mjs edit-viewport-2d edit-viewport-3d game-log-bridge` (uses the real `nord serve`; build `cargo build -p nord-cli` first) | M3+ |
| X-KOM audio | `node tools/xkom-audio-test.mjs [export-directory]`: exactly 3 music files, real WebAudio decode/loop/unlock, nonzero offsets for every role, quick configured fade-in, uninterrupted radar/shooter and base playback, tactical/RTS restart at configured offsets, all 21 SFX | M6 |
| X-KOM campaign/save | `node tools/xkom-campaign-test.mjs`; `node tools/xkom-campaign-view-test.mjs`; `node tools/xkom-save-test.mjs [export-directory]` (Continue, paused Save/Load mid-walk, two-stage finale, RTS names/costs); `node tools/xkom-start-gate-test.mjs [export-directory]` (trusted mouse/touch/key first activation) | M6 |
| X-KOM/Red Front keyboard | `node tools/xkom-keys-test.mjs [xkom\|redfront] [export-directory]`: held/released WASD and arrows, uppercase keys, diagonal scroll, Q attack-move/X stop, cleared held keys in overlays, globe rotation | M6 |
| X-KOM/Red Front edge scroll | `node tools/xkom-edge-test.mjs [xkom\|redfront] [export-directory]`; `XK_EDGE_WIDE=1` for fullscreen/letterbox bounds. Real mouse, map/sidebar boundary, HUD exclusion, outside-canvas stop and overlays. | M6 |
| X-KOM layout/portable saves | `node tools/xkom-layout-test.mjs` (rendered glyph centers, font size, tactical bar bounds); `node tools/xkom-portable-save-test.mjs` (real JSON download/upload, rejected files preserve campaign, reload, combat HQ checkpoint) | M6 |
| X-KOM map variation | `node tools/xkom-map-test.mjs`: 128-seed deterministic sweep, four layouts, clear/connected tactical deployments, in-bounds/nonoverlapping RTS footprints, base/ore reachability and production; `node tools/xkom-map-view-test.mjs [export-directory]`: four rendered terrain overviews and varied RTS deployment cameras | M6 |
| X-KOM views | `node tools/xkom-view-test.mjs` (terrain/walk/camera); `node tools/xkom-ui-test.mjs [export-directory]` (globe/HQ, text, input and repeated interceptions); `node tools/xk-shots.mjs xkom` (all screens) | M6 |
| Midnight Sun Tour | `node tools/midnight-sun-test.mjs [frames] [seed]` (reward accounting, reachable runner, seven road legs, three management days, artist routing, visitor queues/purchases/closing, live construction, cheats); `node tools/midnight-sun-view-test.mjs [export-directory]` (keyboard, UI/console/pause, checkpoint round trip, manager/AI, six real artist audio decodes; network blocked) | M6 |
| Examples smoke | `node tools/smoke-examples.mjs` builds each example, loads in headless Chromium for 3 s, asserts no console errors + non-blank canvas | M6 |
| Vallout art/menus | `node tools/vallout-art-test.mjs [export-directory]`: native PNG dimensions, all 132 nonempty poses, distinct walks, stable standing height, bottom-aligned corpses, panel text bounds, real volume buttons and wrapped modern controls; external requests blocked. `node tools/vallout-shots.mjs` captures twenty screens/areas; `node tools/vallout-smoke.mjs` verifies gameplay. | M6 |
| Offline guarantee | `nord check-offline dist/` ; headless run with network blocked (`route.abort` for non-localhost) | every export |
| Vendor integrity | `node tools/vendor.mjs --verify` (sha256 vs VENDOR.json) | CI |
| Task consistency | `node tools/tasks.mjs check` | CI |
| Manual | `node tools/build-manual.mjs --check` (links, anchors, offline, runs `nord-live` snippets) — in CI | M7 |
| Windows packaging | `./build-win.sh` cross-builds all three EXEs, compares all bundled resources by SHA-256 and CRC-checks both archives; Windows release CI also builds with MSVC and runs the packaged CLI outside the checkout | Windows release |
| Native / mac | GitHub Actions `macos-14` builds `nord-editor`, `nord-player`; manual smoke on M1 Max | M3+ |

Sandbox limits (Linux cloud container): no macOS, no display/WKWebView. egui renders headless via kittest; viewport JS tested in Chromium; the rest via macOS CI.

Bug workflow: reproduce → add to `docs/KNOWN_ISSUES.md` (ID BUG-nnn) → fix → regression test/example → tick in `task.md` → `CHANGELOG.md`.
