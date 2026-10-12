# Changelog
Newest first. One line per notable change. Credit: Crowelian 2026 + Sonnet.

## Unreleased
- M0: planning docs, PRD.json, task.md, task tool, AI handoff guide.
- Editor switched to native egui (ADR-013), Tauri dropped; main is the only branch.
- M0: vendored Phaser 4.2.1, Babylon 9.30.0 (+Havok), PlayCanvas 2.23.2, CodeMirror, marked, fonts, Lucide (vendor/VENDOR.json).
- M0: generated brand (logo, splash, icons), textures, skyboxes, particles, sprites, tileset, UI kit, 47 sfx, 7 music tracks, manual art; ASSETS.md.
- M0: cargo workspace skeleton (nord-core, nord-cli).
- Added HANDOFF.md (new-session prompt + standing orders).
- M1-01..04: `nord-core` project/scene/prefab model (serde, unknown export keys preserved), hand-written JSON schemas, asset index (sha256 + `.meta.json` sidecars), thumbnails (images + WAV/ffmpeg waveforms, sha-keyed cache), validation (dup ids, missing refs).
- M1-05..09: `nord` CLI: `new` (html/2d/3d/wasm-* templates), `doctor`, `thumbs`, `check`, `serve` (axum; project + `/vendor` + `/runtime` mounts, SSE live reload via mtime poll, `/api/{project,assets,validate,thumb}`), `check-offline` (+ allowlist), `vendor --verify`.
- M1-10: GitHub Actions CI (fmt, clippy, test, tasks check, vendor verify) on ubuntu + macos-14.
- M1-11: crash-safe writes (tmp+fsync+rename), project lock, recent-projects store (`$NORD_CONFIG_DIR`).
- M2-01..06: `runtime/core` (ES modules, engine-agnostic): Entity tree + component registry, NordScript lifecycle (init→start→fixed/update/late, error isolation), typed attributes, events, Scheduler (timers/tweens/easing), Rng, Pool, action Input (+gamepad, DOM wiring, virtual joystick), Loader (progress, safe paths, `__NORD_FILES__` for file://), Scene/prefab loader with overrides (index-patch semantics), scene switching, versioned Save slots. 13 `node --test` tests.
