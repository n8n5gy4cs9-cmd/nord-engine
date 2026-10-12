#!/usr/bin/env bash
# Builds the full editor + everything it needs into ./dist  (gitignored):
#   dist/Nord Engine.app          macOS app bundle (+ optional .dmg)          <- implemented
#   dist/windows/NordEngine/ (+ .zip)       Windows build (run from Git Bash/MSYS on Windows)   <- implemented, CI-built, unverified by owner
#   dist/linux/nord-engine/ (+ .tar.gz)     Linux build                                         <- implemented
# Step 1 always regenerates the offline manual (node tools/build-manual.mjs) so docs/manual is fresh inside the bundle.
#
#   ./build.sh                 # native arch (Apple Silicon -> arm64), ad-hoc signed
#   ./build.sh --universal     # arm64 + x86_64 (rustup adds the missing target)
#   ./build.sh --dmg           # also create dist/Nord-Engine.dmg
#   ./build.sh --no-webview    # build without the embedded webview / player shell
#   (Windows/Linux: same script, output goes to dist/windows or dist/linux; the editor there uses the Open-in-browser viewport)
#   ./build.sh --open          # launch the app afterwards
#
# The bundle is self-contained: Contents/Resources holds vendor/, runtime/, editor/, docs/, library/, examples/
# (the editor finds them via nord_serve::engine_root()). Offline: nothing is downloaded at runtime.
# Signing is ad-hoc (`codesign -s -`): fine for your own Mac. First launch of a downloaded copy: right-click -> Open.
set -euo pipefail
cd "$(dirname "$0")"

UNIVERSAL=0; DMG=0; WEBVIEW=1; OPEN=0
for a in "$@"; do
  case "$a" in
    --universal) UNIVERSAL=1 ;;
    --dmg) DMG=1 ;;
    --no-webview) WEBVIEW=0 ;;
    --open) OPEN=1 ;;
    -h|--help) sed -n '2,19p' "$0"; exit 0 ;;
    *) echo "unknown option: $a" >&2; exit 2 ;;
  esac
done

# ---- step 1: generated docs (needs Node 18+) --------------------------------------------------------------------------
command -v node >/dev/null || { echo "node not found (needed for the manual: tools/build-manual.mjs). Install Node 18+." >&2; exit 1; }
echo "==> building the manual (node tools/build-manual.mjs)"
node tools/build-manual.mjs

OS="$(uname -s)"
command -v cargo >/dev/null || { echo "cargo not found. Install Rust: https://rustup.rs" >&2; exit 1; }
VERSION="$(sed -n 's/^version = "\(.*\)"/\1/p' Cargo.toml | head -1)"

# copy the resource folders the editor/player find via nord_serve::engine_root()
copy_resources() { # $1 = destination dir
  local RES="$1"; mkdir -p "$RES"
  for d in vendor runtime editor docs library examples templates; do
    [ -d "$d" ] && cp -R "$d" "$RES/"
  done
  find "$RES" \( -name '.nord-cache' -o -name 'dist' -o -name '.DS_Store' \) -prune -exec rm -rf {} + 2>/dev/null || true
  # drop optional/large things the editor does not need at runtime
  rm -rf "$RES/vendor/playcanvas" 2>/dev/null || true
  cp LICENSE THIRD_PARTY.md "$RES/" 2>/dev/null || true
}

# ---- Windows / Linux (portable folder + archive). No codesign/notarisation; see docs/PACKAGING.md ----------------------
if [ "$OS" != "Darwin" ]; then
  case "$OS" in
    MINGW*|MSYS*|CYGWIN*) PLAT=windows; EXE=.exe; OUTDIR="dist/windows/NordEngine" ;;
    Linux) PLAT=linux; EXE=; OUTDIR="dist/linux/nord-engine" ;;
    *) echo "unsupported OS: $OS" >&2; exit 1 ;;
  esac
  # the player shell (wry+tao): WebView2 on Windows (always available), webkit2gtk-4.1 on Linux (only if installed)
  PSHELL=""
  if [ "$WEBVIEW" = 1 ]; then
    if [ "$PLAT" = windows ]; then PSHELL="--features shell"
    elif command -v pkg-config >/dev/null && pkg-config --exists webkit2gtk-4.1 gtk+-3.0 2>/dev/null; then PSHELL="--features shell"
    else echo "note: webkit2gtk-4.1/gtk3 dev packages not found -> nord-player built without its window shell"; fi
  fi
  echo "==> cargo build --release (nord-editor, nord-cli, nord-player $PSHELL)"
  cargo build --release -p nord-editor -p nord-cli
  # shellcheck disable=SC2086
  cargo build --release -p nord-player $PSHELL
  rm -rf "$OUTDIR"; mkdir -p "$OUTDIR"
  for b in nord-editor nord nord-player; do cp "target/release/$b$EXE" "$OUTDIR/"; done
  echo "==> assembling resources"
  copy_resources "$OUTDIR"
  [ -f assets/brand/logo-256.png ] && cp assets/brand/logo-256.png "$OUTDIR/icon.png"; [ -f assets/brand/icon.ico ] && cp assets/brand/icon.ico "$OUTDIR/icon.ico"
  if [ "$PLAT" = windows ]; then
    printf '@echo off\r\nstart "" "%%~dp0nord-editor.exe" %%*\r\n' > "$OUTDIR/NordEngine.cmd"
    ARCHIVE="dist/windows/NordEngine-$VERSION-windows.zip"; rm -f "$ARCHIVE"
    if command -v zip >/dev/null; then (cd dist/windows && zip -qr "$(basename "$ARCHIVE")" NordEngine)
    else powershell -NoProfile -Command "Compress-Archive -Path '$OUTDIR' -DestinationPath '$ARCHIVE'"; fi
  else
    cat > "$OUTDIR/nord-engine.desktop" <<DESK
[Desktop Entry]
Type=Application
Name=Nord Engine
Exec=nord-editor
Icon=icon
Categories=Development;
DESK
    ARCHIVE="dist/linux/nord-engine-$VERSION-linux-$(uname -m).tar.gz"; rm -f "$ARCHIVE"
    tar -C dist/linux -czf "$ARCHIVE" nord-engine
  fi
  echo; echo "Built: $OUTDIR  (v$VERSION)"; echo "Archive: $ARCHIVE"
  exit 0
fi

NAME="Nord Engine"
OUT="dist/$NAME.app"
FEATURES=""; FEATURES_PLAYER=""
if [ "$OS" = "Darwin" ] && [ "$WEBVIEW" = 1 ]; then FEATURES="--features webview"; FEATURES_PLAYER="--features shell"; fi

build() { # $1 = target triple or empty
  local t=()
  [ -n "$1" ] && t=(--target "$1")
  echo "==> cargo build --release ${t[*]:-} (nord-editor, nord-cli)"
  # shellcheck disable=SC2086
  cargo build --release ${t[@]+"${t[@]}"} -p nord-editor $FEATURES
  cargo build --release ${t[@]+"${t[@]}"} -p nord-cli
  # the game player shell (wry+tao window) used by `nord bundle-mac`; needs WKWebView so macOS only
  cargo build --release ${t[@]+"${t[@]}"} -p nord-player $FEATURES_PLAYER
}

bin_path() { # $1 = bin name, $2 = triple or empty
  if [ -n "$2" ]; then echo "target/$2/release/$1"; else echo "target/release/$1"; fi
}

rm -rf "$OUT"
mkdir -p "$OUT/Contents/MacOS" "$OUT/Contents/Resources"

if [ "$UNIVERSAL" = 1 ] && [ "$OS" = "Darwin" ]; then
  for t in aarch64-apple-darwin x86_64-apple-darwin; do rustup target add "$t" >/dev/null; build "$t"; done
  for b in nord-editor nord nord-player; do
    lipo -create "$(bin_path $b aarch64-apple-darwin)" "$(bin_path $b x86_64-apple-darwin)" -output "$OUT/Contents/MacOS/$b"
  done
else
  build ""
  for b in nord-editor nord nord-player; do cp "$(bin_path $b '')" "$OUT/Contents/MacOS/$b"; done
fi

echo "==> assembling resources"
RES="$OUT/Contents/Resources"
copy_resources "$RES"
[ -f assets/brand/icon.icns ] && cp assets/brand/icon.icns "$RES/AppIcon.icns"
cat > "$OUT/Contents/Info.plist" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>CFBundleName</key><string>$NAME</string>
  <key>CFBundleDisplayName</key><string>$NAME</string>
  <key>CFBundleIdentifier</key><string>com.crowelian.nord-engine</string>
  <key>CFBundleExecutable</key><string>nord-editor</string>
  <key>CFBundleIconFile</key><string>AppIcon</string>
  <key>CFBundlePackageType</key><string>APPL</string>
  <key>CFBundleShortVersionString</key><string>$VERSION</string>
  <key>CFBundleVersion</key><string>$VERSION</string>
  <key>LSMinimumSystemVersion</key><string>11.0</string>
  <key>NSHighResolutionCapable</key><true/>
  <key>NSHumanReadableCopyright</key><string>Crowelian 2026 + Sonnet</string>
  <key>NSAppTransportSecurity</key><dict><key>NSAllowsLocalNetworking</key><true/></dict>
</dict></plist>
PLIST

if [ "$OS" = "Darwin" ]; then
  echo "==> ad-hoc codesign"
  codesign --force --deep --sign - "$OUT"
  codesign --verify --deep --strict "$OUT" && echo "signature OK"
fi

if [ "$DMG" = 1 ] && [ "$OS" = "Darwin" ]; then
  echo "==> dmg"
  rm -f dist/Nord-Engine.dmg
  hdiutil create -volname "$NAME" -srcfolder "$OUT" -ov -format UDZO dist/Nord-Engine.dmg >/dev/null
  echo "dist/Nord-Engine.dmg"
fi

echo
echo "Built: $OUT  (v$VERSION)"
[ "$OS" = "Darwin" ] && echo "Run:   open \"$OUT\"   (or: \"$OUT/Contents/MacOS/nord-editor\" to see logs)"
[ "$OPEN" = 1 ] && [ "$OS" = "Darwin" ] && open "$OUT"
exit 0
