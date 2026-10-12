---
title: T16 Rust/WASM game
section: Tutorials
order: 16
summary: A Rust-scripted 2D game running natively and in the browser.
---
**Project:** `nord new crab -t rust-2d-game` · finished: `examples/rust-platformer`.

1. `rustup target add wasm32-unknown-unknown`.
2. Open `src/main.rs`: scripts are structs implementing `Script`, registered by name. The scene JSON refers to them (`"scripts": [{ "path": "player" }]`).
3. Press **▶ Play** in the editor (it builds first) or `nord build-rust . && nord serve .`. Natively: `cargo run`.
4. Edit speed in `Registry::register("player", |a| … a.f32("speed", 130.0) …)`, rebuild, play.
5. Export: `nord export . --target web-wasm-game --optimize --zip`.

Reference: [Rust / WASM](rust-wasm.html). **Next:** [T17 Rust egui app](tut-t17-rust-egui-app.html).
