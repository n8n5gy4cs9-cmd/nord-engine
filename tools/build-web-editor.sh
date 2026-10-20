#!/usr/bin/env bash
# Build the browser editor into dist/web-editor (static files; serve over http(s) — wasm needs a server, not file://).
# Needs: rustup target wasm32-unknown-unknown, wasm-bindgen-cli matching Cargo.lock (cargo install wasm-bindgen-cli --version X).
# Optional: wasm-opt (binaryen) and brotli for smaller output. The desktop build is not touched.
set -euo pipefail
cd "$(dirname "$0")/.."
OUT=dist/web-editor
cargo build -p nord-editor-web --target wasm32-unknown-unknown --release
rm -rf "$OUT" && mkdir -p "$OUT/pkg"
wasm-bindgen --target web --no-typescript --out-dir "$OUT/pkg" target/wasm32-unknown-unknown/release/nord_editor_web.wasm
cp crates/nord-editor-web/www/* "$OUT/"
# engine runtime for the Play / edit iframes (served by the service worker under <scope>engine/)
mkdir -p "$OUT/engine" && cp -R vendor runtime editor "$OUT/engine/"
if command -v wasm-opt >/dev/null; then wasm-opt -Oz -o "$OUT/pkg/o.wasm" "$OUT/pkg/nord_editor_web_bg.wasm" && mv "$OUT/pkg/o.wasm" "$OUT/pkg/nord_editor_web_bg.wasm"; fi
if command -v brotli >/dev/null; then brotli -f -k "$OUT/pkg/nord_editor_web_bg.wasm"; fi
ls -la "$OUT/pkg"
echo "serve with:  python3 -m http.server -d $OUT 8090"
