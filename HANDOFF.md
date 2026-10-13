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

## NEXT SESSIONS — M8 (start here)
Prompt: *"Read HANDOFF.md and do M8"*. Branch rule: owner says `main`; if the harness forces a session branch, push that branch and tell the owner (or merge to main at the end).
After each task: `node tools/tasks.mjs done ID`, CHANGELOG line, relevant docs; if you touched runtime JSDoc, `schema.rs`, CLI docs, library, templates or `docs/*.md`, run `node tools/build-manual.mjs` and commit `docs/manual/`.

**M9 Desktop apps is DONE** (16/16; see `docs/DESKTOP_APPS.md`, `docs/PACKAGING.md`, ADR-020). Owner-only verification left: macOS/Windows native shell parts (RISK-010).

**M8 remaining:** M8-02/M8-09 Windows (`build.sh` on Windows + CI `windows-latest`, never run → watch the CI result, fix), M8-04 perf pass (viewport fps, startup time, export size — measure first), M8-05 dockable panels (optional) + light theme, M8-06/07 optional (Bevy template/PlayCanvas tier; TypeScript in the native code editor), M8-08 bug-bash all examples + KNOWN_ISSUES cleanup (`node tools/smoke-examples.mjs`, `node tools/e2e.mjs`). Open from earlier (owner/macOS needed): M3-07, M3-25, M4-08/09/11.
Reminders: environment now has `libwebkit2gtk-4.1-dev libgtk-3-dev libayatana-appindicator3-dev libxdo-dev xvfb` only if you `apt-get install` them (not persistent) — without them `cargo build -p nord-player --features shell` and the `desktop-player-ipc` e2e suite are skipped.

## Current status (update every session)
- **2026-10-12 Example games Forgotten Wars + Automies (M6-23/24):** from `tools/examples/{forgotten,automies}/` (never edit `examples/` by hand). Forgotten Wars: pure rules `scripts/fw/{data,rules,ai}.js` (`node tools/fw-sim.mjs` = AI vs AI), view `scripts/forgotten.js`, art `node tools/pixelart.mjs forgotten`, map `assets/maps/crossing.map`. Automies: REDRIVER2 handling port `scripts/am/car.js`, world `scripts/am/sim.js` (`node tools/am-sim.mjs` = handling numbers, `--mission` = bot plays), view `scripts/automies.js`, models `node tools/gen_automies_models.mjs`, Kenney files `tools/fetch-automies-assets.sh`, art `node tools/pixelart.mjs automies`, map `haven.map`. Both have `assets.md` + `GUIDE.md`; screenshots `docs/screenshots/{forgotten,automies}-*.png`. Honest limits in KNOWN_ISSUES (headless-verified only; P2 gamepad unverified on hardware).
- **2026-10-12 Example games Altimu 5.7 + Harrison's Command (M6-21/22):** two new examples from `tools/examples/{altimu,harrison}/` (never edit `examples/` by hand). Altimu art: `node tools/pixelart.mjs altimu`; map is the text file `tools/examples/altimu/assets/maps/trinsic.map`. Harrison: models `node tools/gen_harrison_models.mjs`, art `node tools/pixelart.mjs harrison`, sim `scripts/hc/sim.js` (node-testable). Both have `assets.md` + `GUIDE.md`; screenshots in `docs/screenshots/`. Honest limits in KNOWN_ISSUES (not tile-exact U7 map; gamepad P2 unverified on hardware).
- **2026-10-12 M8-19 Assets layout:** folder tree retains its dragged width; file/folder icons and cached thumbnails paint without moving the grid cursor. Regressions cover divider dragging, aligned/wrapped rows at three sizes and loaded thumbnails. Workspace tests (existing hub query run separately), Clippy/manual checks and signed macOS build pass. Native Assets pointer interaction remains unverified (BUG-009).
- **2026-10-12 M8-18 editor uplift:** neutral editor-only Graphite default (old Nord defaults migrate once), polished hub/toolbar/docks, accessible controls, searchable examples and bundled starters; Export and dialog-over-webview visibility repaired, theme changes in Play restore correctly. Play tint preserved. Workspace tests/Clippy/manual checks and signed macOS bundle pass; native Noom Play/Stop, tint, Settings/Export and viewport bounds checked. Inspector no longer mutates on selection. Verification recorded in docs/KNOWN_ISSUES.md.
- **2026-10-12 editor storage documentation:** editor-tour manual lists saved example copies, settings/history/layout and project caches for macOS, Windows and Linux, including the actual Windows `HOME`/working-directory behavior and `NORD_CONFIG_DIR` override. Owner requested stopping further app builds/tests; this follow-up changes documentation only.
- **2026-10-12 M8-16 / BUG-001:** USE CACHED CONTENT defaults OFF; hub examples/tutorials open current engine/bundle files and old saved-copy Recent/launch paths resolve to them. ON opts into saved copies for testing. Default webviews use temporary storage. See EDITOR_UI.md / ADR-022; no need to delete old copies to see the redraws.
- **2026-10-12 RetroPaxDungeons redraw (M6-20):** eleven image sheets refreshed with original retro dungeon art. Reviewed raster masters and prompts in `tools/art/rpd/redrawn/`; hand-drawn effects/font in `tools/art/rpd/details.mjs` (font shared with Noom). Re-pack with `node tools/pixelart.mjs rpd --preview` and `node tools/gen_examples.mjs retropaxdungeons`.
- **2026-10-12 Noom art redraw (M6-19):** all ten sprites/texture/HUD/font sheets replaced with original Barony/Doom-inspired art. Offline raster masters and prompts in `tools/art/noom/redrawn/`; run `node tools/pixelart.mjs noom --preview` then `node tools/gen_examples.mjs noom`. Existing game layouts preserved.
- **M0 + M1 + M2 done.** Work happens on the session branch the cloud harness designates (merge to `main` when convenient). Session 2026-10-12 pushed M9 + fixes to `claude/quirky-heisenberg-8oh4vg`.
- **M3 editor implemented** (`crates/nord-editor`, `crates/nord-serve`, `editor/viewport/`, `library/`) — 23 of 25 tasks done; see `docs/EDITOR_UI.md` ("Implemented (M3)")
  and ADR-014..018. **Open:** M3-07 (wry embedding must be *run* on macOS — checklist in KNOWN_ISSUES RISK-001a; CI only compiles it),
  M3-14 (multi-cursor → M3-24), M3-25 (owner verification). Owner scripts: `./run.sh`, `./build.sh`.
- How to test the editor in this sandbox: `cargo test -p nord-editor` (kittest), `node tools/e2e.mjs edit-viewport-2d edit-viewport-3d game-log-bridge`
  (needs `cargo build -p nord-cli`), real-window smoke under Xvfb (see docs/TESTING.md; `apt-get install libxkbcommon-x11-0 mesa-vulkan-drivers libegl1`).
- Skins/themes: `assets/themes/themes.json` → `node tools/gen_themes.mjs` → `runtime/core/themes.js`; editor reads the JSON directly; TTFs via `tools/woff2_to_ttf.py`.
- **M4 export done except M4-08 shell run + M4-09 macOS CI run (see KNOWN_ISSUES RISK-006) and M4-05 atlas (M4-11):** `nord build/export/bundle-mac`, `nord-export`, `nord-player`, Project→Export… dialog, docs/HOSTING.md, e2e `export-*`.
- ~~Next: M4 export~~ (`nord build/export`, mac player + `nord-player`), reusing `nord-serve`/`engine_root` for assets. Docs tasks M7-11/12 (complete Nord-format API docs +
  manual with "for dummies" toggle boxes) are owner requests — don't drop them; the editor's Docs tab already embeds `docs/manual/index.html` (served at `/__docs/`) once it exists.
- **M5 Rust/WASM done** (crates `nord-runtime-wasm`, `nord-app-wasm`, excluded from the main workspace; docs/RUST_TIER.md, ADR-019). **M6 library done** (M6-17: Kenney 3D kit pack in `assets/packs/`; 2D packs blocked, see KNOWN_ISSUES). ~125 library items (`node tools/build-library-index.mjs`), 15 2D + 4 3D + 8 app + 6 Rust examples,
  17 starter templates — all generated from `tools/examples/<id>/` by `node tools/gen_examples.mjs` (never edit `examples/`/`templates/` JS projects by hand;
  Rust examples/templates are hand-written). Smoke: `node tools/smoke-examples.mjs [id…]`; Rust: `node tools/e2e.mjs rust-platformer …`.
- **M9 Desktop apps done** (`crates/nord-desktop`, `runtime/desktop/`, player shell, `nord bundle-portable`, Rust `nord_app_wasm::desktop`, 6 JS example/template apps + Rust notes, e2e `desktop-*`, `tools/player-smoke.mjs`). Editor: status bar + play-mode tint (Settings → PLAYMODE-COLOR), Project ▸ Desktop app permissions….
- **M7 docs done**: `node tools/build-manual.mjs` (sources `docs/manual-src/`, output `docs/manual/` is committed; `--check` in CI). Re-run + commit after changing runtime JSDoc, `schema.rs`, CLI docs, library, templates or `docs/*.md`. Desktop-apps chapter (`18-desktop-apps.md`) is written.
- Next: see **NEXT SESSIONS** above.
- Vendored: Phaser 4.2.1, Babylon 9.30.0 (+Havok 1.3.14), PlayCanvas 2.23.2 (optional), CodeMirror bundle, marked, fonts, Lucide.
- Known risks: `docs/KNOWN_ISSUES.md`.
