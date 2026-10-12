# HANDOFF.md — read this first, then keep working

**Prompt for a new session:** *"Read HANDOFF.md and continue."* That is enough. Do not ask what to do — follow this file.

Project: **Nord Engine** — personal Rust game/app engine + native egui editor, exports static HTML web games
(Phaser 2D / Babylon 3D / Rust-WASM) and a Mac app. Owner: Crowelian. Credit: **Crowelian 2026 + Sonnet**.

## How to work (standing orders)
1. **Do not stop after one task.** Work through `node tools/tasks.mjs next` in order, task after task, until the owner's
   request is satisfied. If the owner names how many/which tasks, do exactly that many/those — then keep going only if told "continue".
   With no instruction beyond "continue": keep going through the milestone until it is done or you are genuinely blocked.
2. **Commit and push to `main` only** (owner instruction). Small commits, descriptive messages, push after each task or logical group.
   No PRs, no other branches unless asked.
3. **After every task:** `node tools/tasks.mjs done <ID>` (updates `PRD.json` + regenerates `task.md`), add a line to
   `docs/CHANGELOG.md`, update the relevant `docs/*.md`/`ASSETS.md` if behaviour or assets changed, and update the
   **Current status** section below. Use `node tools/tasks.mjs add <M#> "title"` for new work.
4. **Verify before ticking** (see `docs/TESTING.md`): build, test, run. Be honest in `docs/KNOWN_ISSUES.md` about anything unverified
   (macOS-only things cannot run in the Linux sandbox).
5. **Reuse, don't reinvent; don't over-engineer.** Vendor/clone proven code (`docs/UPSTREAM.md`, `tools/fetch-upstreams.sh`), log
   attribution in `THIRD_PARTY.md`. Offline only — no CDNs (`node tools/vendor.mjs` for new libs).
6. Decisions already made are final unless the owner reverses them: see `docs/DECISIONS.md` (native egui editor, no Tauri; wry webview for
   viewport/preview; Phaser+Babylon+Rust-WASM tiers; PRD.json is the task source of truth).
7. Ask the owner only when truly blocked on a decision that is theirs; otherwise pick the sensible default and note it.

## Read order for context
`task.md` → `docs/PRD.md` → `docs/ARCHITECTURE.md` → `docs/DECISIONS.md` → the spec for your area
(`PROJECT_FORMAT.md`, `SCRIPTING_API.md`, `EXPORT_TARGETS.md`, `EDITOR_UI.md`, `LIBRARY_PLAN.md`, `MANUAL_PLAN.md`) → `AGENTS.md`.

## Environment (cloud sandbox)
Linux; Rust 1.97 + wasm32 target, Node 22, Python3 (+PIL/numpy), ffmpeg, Chromium (Playwright at /opt/pw-browsers). GitHub clone, npm,
crates.io work. No macOS/display → egui GUI and wry webview are tested via `egui_kittest`, headless Chromium and macOS CI, or by the owner.

## Quick commands
```
node tools/tasks.mjs status | next [n] | done ID.. | start ID.. | add M# "title" | check
node tools/vendor.mjs [--verify]        # vendored libs (vendor/VENDOR.json)
tools/fetch-upstreams.sh [name..]       # shallow clones → third_party/ (gitignored, re-fetch each session if needed)
python3 tools/gen_assets.py [step]      # regenerate placeholder assets + ASSETS.md inventory
cargo build --workspace && cargo test --workspace && cargo clippy --workspace -- -D warnings
```

## Current status (update every session)
- **M0 done** (plans, upstream fetch, vendoring, placeholder assets, workspace skeleton: `nord-core`, `nord-cli`).
- **Next: M1 Foundation** — start at M1-01 (`nord-core` project/scene structs per `docs/PROJECT_FORMAT.md`), then CLI `new/serve/thumbs/check-offline`,
  dev server (axum, SSE reload), CI. Then M2 JS runtimes, M3 editor (spike M3-07 first: wry webview in egui), M4 export, M5 Rust/WASM,
  M6 library/examples, M7 docs, M8 polish.
- Vendored: Phaser 4.2.1, Babylon 9.30.0 (+Havok 1.3.14), PlayCanvas 2.23.2 (optional), CodeMirror bundle, marked, fonts, Lucide.
- Known risks: `docs/KNOWN_ISSUES.md`.
