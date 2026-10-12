# Rust desktop notes
egui notes app using `nord_app_wasm::desktop` (files in app data, key-value settings, notifications, native dialogs, clipboard).
- Native: `cargo run` (opens a window; uses the same `nord-desktop` backend as the JS bridge; permissions from `desktop.permissions` are enforced).
- Web: `nord export . --target web-wasm-app` — the same code falls back to localStorage files / Notification API / `window.confirm`; native-only calls return `Error { code: "unsupported" }`.
