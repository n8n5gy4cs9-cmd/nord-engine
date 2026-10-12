# Rust JSON tool (egui)
An `eframe` app on `nord-app-wasm`: edit JSON, see a collapsible tree, format/minify/sort keys, filter, drop a .json file onto the window.
Native: `cargo run`. Web: `nord build-rust . && nord serve .`; export: `nord export . --target web-wasm-app` (needs the `wasm-bindgen` CLI matching Cargo.lock).
