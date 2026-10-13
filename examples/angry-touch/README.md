# Angry Touch (Rust/WASM + touch)
A slingshot-and-physics game in the Nord Rust runtime (macroquad + rapier2d). Knock out all the pigs with a limited number of birds; wood, stone and ice blocks take damage from impacts. 3 levels, score + leftover-bird bonus.

**Play:** drag the bird back and let go (mouse or finger) — or use the keyboard / on-screen pad: ←/→ angle, ↑/↓ power, **Space** fire, **R** restart, **Enter** next level.
**Touch:** the exporter inlines `runtime/touch/nord-touch.js` into the page and builds the pad + Fire/Next/Restart buttons from `input.actions` in `nord.project.json` — no game code for it. Dragging works natively (macroquad turns touches into mouse events).
Preview the pad on a desktop: add `?touch=1` to the URL.

Build/run: `nord build-rust examples/angry-touch && nord serve examples/angry-touch` · export: `nord export examples/angry-touch --target web-wasm-game`.

Original code and art (`python3 tools/gen_angry_touch_assets.py` regenerates the sprites; sounds are the shared `rust-asteroids` effects). It borrows only the *genre* of Angry Birds and Apple Flinger (GPL-3, gitlab.com/ar-/apple-flinger); no code, level data or art from either, and nothing from Rovio's game. The jooapa decompilation repo is just a script-decryption tool for the original game's files, so there was nothing to port from it.
