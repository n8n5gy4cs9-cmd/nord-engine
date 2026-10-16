# Build Nord Engine for Windows

From macOS/Linux, run `./build-win.sh`. This uses the same x64 MinGW approach as
NordCraft, NordBound and nordSoldPow. One-time setup on macOS:

```sh
brew install mingw-w64
rustup target add x86_64-pc-windows-gnu
./build-win.sh
```

Linux: install `mingw-w64`, Rust/rustup, Node 18+ and Python 3.8+, then add the
same Rust target. On Windows, install Rust's MSVC toolchain, Visual Studio C++
build tools with Windows SDK, Git Bash, Node and Python, then run:

```sh
rustup target add x86_64-pc-windows-msvc
./build-win.sh msvc
```

`./build.sh` on Windows also selects this MSVC build. Mac `./build.sh` keeps its
existing app/signing/DMG flow. `CARGO_TARGET_DIR` is respected by build-win.sh.

Output: `dist/windows/NordEngine/` and `dist/windows/NordEngine-<version>-windows.zip`.
The build enables the editor's embedded webview and the player's native shell.
Extract the whole release before launching `NordEngine.cmd` or `nord-editor.exe`.
Windows 10/11 x64 needs Microsoft Edge WebView2 Runtime installed. The editor has
an Open in browser fallback if embedding fails; the exported player needs WebView2.

The folder includes editor/CLI/player, all examples and original assets, templates,
library, all vendored runtime tiers (including PlayCanvas), shared assets, Rust
runtime sources and export helpers. The x64 WebView2 loader is included beside the EXEs and follows Windows game/app exports.
MinGW support DLLs are copied when imported. MSVC builds link the C runtime statically.
Every copied resource is SHA-256 compared with its source; both ZIPs are CRC-checked.
Finder `._*` files, caches and build outputs are excluded.

The entire offline guide is **`docs/manual.zip`**, with no loose HTML tree. The Docs
tab serves its pages, search scripts, fonts and images directly from the ZIP through
the loopback server, without extracting thousands of files. To read independently,
extract that ZIP and open its `index.html`; live module examples need a local server.

JS/HTML projects need no Rust/Node tools to play or export normally. Rust examples
need Rust plus `wasm32-unknown-unknown`; egui apps also need the matching wasm-bindgen
CLI. Minify/single-file exports require Node. These are developer build prerequisites,
not missing assets. The included source tree preserves path dependencies for Rust
examples and templates. See `RUST_TIER.md`.

Engine resources are found beside the executable before the launch working directory
(`NORD_ROOT` remains an explicit override). Settings and cached example copies go to
`%APPDATA%\NordEngine`, or `NORD_CONFIG_DIR` when set. Older Windows settings may be
copied from `%HOME%\.config\nord` into that folder. macOS/Linux paths are unchanged.

Windows release CI builds with MSVC, exercises the packaged CLI from outside the
checkout, exports an included example and uploads the ZIP. The normal CI matrix
also runs Rust tests on Windows. A successful cross-build does not verify actual
WebView2 startup, graphics/audio/input, menus, tray or file dialogs: those still need
a real Windows session. See `KNOWN_ISSUES.md` for verification results.
