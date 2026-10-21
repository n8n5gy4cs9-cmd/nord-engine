# Orbital Salvage
T37 advanced Rust/WASM coding workshop. WASD flies; Space dashes (two-second cooldown and brief shield); collect ten gold cores, avoid bouncing rocks, preserve three hull points and beat sixty seconds. Cores add two seconds. P pauses, R restarts. Pure deterministic rules live in src/sim.rs; macroquad drawing/input in src/main.rs. No imported art/audio.

In the engine checkout: `nord build-rust examples/rust-salvage` then `nord serve examples/rust-salvage`. Export: `nord build examples/rust-salvage --target web-wasm-game`. Outside the checkout change nord-runtime-wasm's Cargo.toml path to your absolute engine crates/nord-runtime-wasm directory. See T37 for full setup.
