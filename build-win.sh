#!/usr/bin/env bash
# Windows x64 editor + CLI + WebView2 player, complete offline resources, zipped guide.
# ./build-win.sh          macOS/Linux: MinGW cross-build; Windows Git Bash: MSVC
# ./build-win.sh gnu      explicitly use MinGW (rustup target add x86_64-pc-windows-gnu)
# ./build-win.sh msvc     Windows with Visual Studio C++ build tools + Windows SDK
set -euo pipefail
cd "$(dirname "$0")"
export COPYFILE_DISABLE=1
case "${1:-}" in
  -h|--help) sed -n '2,5p' "$0"; exit 0 ;;
  '') case "$(uname -s)" in MINGW*|MSYS*|CYGWIN*) ABI=msvc ;; *) ABI=gnu ;; esac ;;
  gnu|msvc) ABI="$1" ;;
  *) echo "usage: $0 [gnu|msvc]" >&2; exit 2 ;;
esac
[ "$#" -le 1 ] || { echo "usage: $0 [gnu|msvc]" >&2; exit 2; }
TARGET="x86_64-pc-windows-$ABI"
for tool in cargo rustup node; do
  command -v "$tool" >/dev/null || { echo "missing $tool" >&2; exit 1; }
done
PYTHON=python3
command -v "$PYTHON" >/dev/null || PYTHON=python
"$PYTHON" -c 'import sys; assert sys.version_info >= (3, 8)' || { echo "Install Python 3.8+ for packaging" >&2; exit 1; }
rustup target list --installed | grep -qx "$TARGET" || { echo "Run: rustup target add $TARGET" >&2; exit 1; }
if [ "$ABI" = gnu ]; then
  command -v x86_64-w64-mingw32-gcc >/dev/null || { echo "Install mingw-w64 (macOS: brew install mingw-w64)" >&2; exit 1; }
  export CARGO_TARGET_X86_64_PC_WINDOWS_GNU_LINKER=x86_64-w64-mingw32-gcc
else
  # Portable MSVC releases should not depend on a separate VC++ redistributable.
  export CARGO_TARGET_X86_64_PC_WINDOWS_MSVC_RUSTFLAGS="${CARGO_TARGET_X86_64_PC_WINDOWS_MSVC_RUSTFLAGS:-} -C target-feature=+crt-static"
fi
node tools/build-manual.mjs
cargo build --release --locked --target "$TARGET" -p nord-editor -p nord-cli -p nord-player --features nord-editor/webview,nord-player/shell
"$PYTHON" tools/package-windows.py "${CARGO_TARGET_DIR:-target}/$TARGET/release" "$ABI"
