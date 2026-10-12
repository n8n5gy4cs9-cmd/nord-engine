---
title: T17 Rust egui app
section: Tutorials
order: 17
summary: A tool/app with egui that runs natively and on the web.
---
**Project:** `nord new tool -t rust-egui-app` · finished: `examples/rust-json-tool` (JSON editor with tree, formatter, drag-and-drop).

1. The app type is `wasm-app`; `src/main.rs` implements `eframe::App` and calls `nord_app_wasm::launch`.
2. Native: `cargo run`. Web: `nord build-rust . && nord serve .`.
3. Export: `nord export . --target web-wasm-app` — needs the `wasm-bindgen` CLI at the version in `Cargo.lock`.
4. For plain-DOM apps without Rust, use the JS app kit instead (`library/apps/_kit.js`, templates `ui-app`).

::: tip
Native file dialogs, notifications and storage: use `nord_app_wasm::desktop::Desktop` — see [Desktop apps](desktop-apps.html) and the template **Rust desktop app: notes**.
:::
**Next:** [T18 Writing library snippets](tut-t18-library-snippets.html).
