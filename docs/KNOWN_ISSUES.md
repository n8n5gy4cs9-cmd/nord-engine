# Known issues & bug log

Format: `BUG-nnn [open|fixed] title — repro / notes`. Unverified-but-plausible risks are listed under "Unverified".

## Open
_(none yet)_

## Unverified / risks
- RISK-001 egui + wry child-webview embedding on macOS (z-order, keyboard focus, egui popups over the webview, HiDPI sizing) cannot be tested in the Linux sandbox; verify on macOS CI / M1 Max. Spike first (M3-07).
- RISK-002 Babylon Havok needs wasm served with `application/wasm`; some static hosts misconfigure → provide JS fallback (cannon-es) or inline base64 in single-file mode.
- RISK-003 `file://` loading blocks `fetch`/ES modules in browsers → single-file/file-safe export mode required (EXPORT_TARGETS).
- RISK-004 Vendored Babylon (and Phaser banner comments) contain default CDN/asset URLs (e.g. `cdn.babylonjs.com`, `assets.babylonjs.com`) used only when a feature is left unconfigured (VR button, blue-noise, loaders' default asset roots). `nord check-offline` flags them, so it is a gate for **project/build output** (M4 must set Babylon `Tools.*Url`/disable those paths and allowlist the rest), not for `vendor/`.
- M1 verified on Linux only: `nord serve` (incl. SSE reload endpoint wiring, HTML injection), `new`, `check`, `thumbs`, `check-offline`, `vendor --verify`. CI macos-14 job is untested until first push runs. SSE reload was not exercised in a real browser yet (M2 e2e). `rustup` wasm32 target is not installed in this sandbox (needed from M5).
