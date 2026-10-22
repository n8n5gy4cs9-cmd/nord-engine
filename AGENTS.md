# AGENTS.md — start here (for any AI continuing Nord Engine)

Nord Engine = personal Rust-based game/app engine + editor that exports static HTML web games and a Mac app.
Owner: Crowelian. Credit: **Crowelian 2026 + Sonnet**. Keep it **pragmatic, not over-engineered**; **reuse/clone existing code**.

> **New session? Read `HANDOFF.md` first.**

## Read in this order
1. `task.md` — what is done / undone (generated; truth = `PRD.json`)
2. `docs/PRD.md` — goals, requirements, principles
3. `docs/ARCHITECTURE.md` + `docs/DECISIONS.md` — how it fits, why
4. Spec for the area you touch: `PROJECT_FORMAT.md`, `SCRIPTING_API.md`, `EXPORT_TARGETS.md`, `EDITOR_UI.md`, `LIBRARY_PLAN.md`, `MANUAL_PLAN.md`
5. `docs/UPSTREAM.md` + `THIRD_PARTY.md` before copying any external code
6. `ASSETS.md` before touching art/audio; `docs/KNOWN_ISSUES.md` for open bugs

## Rules
- **Always update tracking**: `node tools/tasks.mjs done <ID> [<ID>…]` (updates `PRD.json` + regenerates `task.md`), add a line to `docs/CHANGELOG.md`. New work not in the list → `node tools/tasks.mjs add <milestone> "<title>"`.
- Update the relevant `docs/*.md` when behaviour/specs change; record big choices as a new ADR in `docs/DECISIONS.md`.
- **Offline**: never reference CDNs. Add libs via `tools/vendor.mjs` (pinned + sha256) and `THIRD_PARTY.md`.
- Placeholder art/audio only via `tools/gen_assets.py` (re-runnable) or added manually + documented in `ASSETS.md`.
- Branch: **always commit and push to `main`** (owner instruction); commit small, descriptive messages; no PRs unless asked.
- Don't add frameworks/abstractions "just in case". Prefer deleting code.
- Verify before ticking: build/test/run (see `docs/TESTING.md`). Be honest in `KNOWN_ISSUES.md` about what is unverified (e.g. macOS-only parts).

## Environment notes (cloud sandbox)
Linux only; Rust 1.9x, Node 22, Python3+PIL/numpy, ffmpeg, Chromium via Playwright. `git clone` of GitHub works; npm + crates.io work.
macOS-only things (egui window + wry child webview, codesign, dmg) cannot be run here → must be verified by CI `macos-14` or the owner.

## Library versions (keep in sync)
Bundled versions as of **2026-10-22**. Source of truth: `vendor/VENDOR.json` (web libs), `Cargo.lock` / `crates/*/Cargo.toml` (Rust), `rustc --version`. **When you change any of these, update this table AND the "Part 3: The libraries Nord uses" tables in `docs/manual-src/how-nord-works.md` (plus the `Phaser`/`Babylon` mentions in `01-welcome.md`), then run `node tools/build-manual.mjs`.**

| Library | Version | Role |
|---|---|---|
| Phaser | 4.2.1 | 2D runtime |
| Babylon.js (+ loaders, gui, materials, post-process, procedural-textures, serializers) | 9.30.0 | 3D runtime |
| Havok (wasm) | 1.3.14 | 3D physics |
| PlayCanvas | 2.23.2 | optional 3D tier |
| macroquad | 0.4.16 | Rust game drawing |
| rapier2d | 0.22 | Rust game physics |
| eframe / egui | 0.31.1 | editor UI + Rust app tier |
| wry / tao | 0.50.5 / 0.33.0 | webview / window shell |
| CodeMirror | 6 | code editor |
| esbuild-wasm | 0.25.10 | export minify/bundle |
| marked | 18.1.0 | manual markdown |
| Lucide | 1.55.0 | icons |
| Fonts (fontsource) | 5.3.0 | bundled typefaces |
| Rust toolchain | 1.96.0 | build |

## Quick commands
```
node tools/tasks.mjs status            # progress by milestone
node tools/tasks.mjs next              # next undone tasks
node tools/vendor.mjs [--verify]       # (re)install vendored libs
tools/fetch-upstreams.sh [name…]       # shallow clones into third_party/
python3 tools/gen_assets.py            # regenerate all placeholder assets
cargo build --workspace
node tools/build-manual.mjs            # rebuild docs/manual (commit it); --check = verify only
```
