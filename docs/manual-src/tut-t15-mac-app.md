---
title: T15 Mac app
section: Tutorials
order: 15
summary: Wrap a build into a double-clickable .app and .dmg.
---
Requires macOS and the prebuilt player (`nord-player`, built in CI or with `cargo build -p nord-player --features shell`).

1. Set `export.mac.bundleId` and an icon in `nord.project.json` (a 1024 px PNG).
2. `nord bundle-mac my-game --name "My Game" --icon icon.png --dmg -o ~/Desktop`.
3. Open the `.app`. The window size, fullscreen (Cmd+Ctrl+F) and persistent storage come from the project/player.
4. The bundle is ad-hoc signed; for distribution to other Macs you will need your own Developer ID signing and notarisation.

::: warn
The macOS shell has been verified only through CI so far (see [Known issues](known-issues.html)); tell us if the webview misbehaves.
:::
**Next:** [T16 Rust/WASM game](tut-t16-rust-game.html).
