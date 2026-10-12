# Bevy game (Nord)
Optional heavy Rust tier: a [Bevy](https://bevyengine.org) app (0.16, slim features, WebGL2). Edit `src/main.rs`.
Runs natively with `cargo run`; ▶ Play in the editor (or `nord build-rust` + `nord serve .`) and `nord export . --target web-wasm-app` run it in the browser.
Needs the wasm32 target and the `wasm-bindgen` CLI (same version as the crate in Cargo.lock). First build is slow (hundreds of crates) — later ones are incremental.
Not part of the Nord scene/scripting model: scenes, the inspector and `nord.*` APIs do not apply. See docs/RUST_TIER.md.
