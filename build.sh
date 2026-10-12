#!/usr/bin/env bash
# Builds the full editor + everything it needs into ./dist  (gitignored):
#   dist/Nord Engine.app          macOS app bundle (+ optional .dmg)          <- implemented
#   dist/windows/                 Windows build                               <- planned, goes here (see TODO below)
#   dist/linux/                   Linux build                                 <- planned, goes here (see TODO below)
# Step 1 always regenerates the offline manual (node tools/build-manual.mjs) so docs/manual is fresh inside the bundle.
#
#   ./build.sh                 # native arch (Apple Silicon -> arm64), ad-hoc signed
#   ./build.sh --universal     # arm64 + x86_64 (rustup adds the missing target)
#   ./build.sh --dmg           # also create dist/Nord-Engine.dmg
#   ./build.sh --no-webview    # build without the embedded webview
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
    -h|--help) sed -n '2,17p' "$0"; exit 0 ;;
    *) echo "unknown option: $a" >&2; exit 2 ;;
  esac
done

# ---- step 1: generated docs (needs Node 18+) --------------------------------------------------------------------------
command -v node >/dev/null || { echo "node not found (needed for the manual: tools/build-manual.mjs). Install Node 18+." >&2; exit 1; }
echo "==> building the manual (node tools/build-manual.mjs)"
node tools/build-manual.mjs

OS="$(uname -s)"
# TODO(windows): on Windows (Git Bash/MSYS) or cross-built: cargo build --release -p nord-editor -p nord-cli -p nord-player,
#   assemble dist/windows/NordEngine/{nord-editor.exe,nord.exe,nord-player.exe,vendor,runtime,editor,docs,library,examples}, zip it
#   (and optionally an installer). WebView2 replaces WKWebView for the wry features. Not implemented yet.
# TODO(linux): cargo build --release (webkit2gtk + gtk dev packages for the `webview`/`shell` features), assemble dist/linux/nord-engine/
#   with the same resource folders, produce a .tar.gz (and optionally an AppImage). Not implemented yet.
if [ "$OS" != "Darwin" ] && [ "${NORD_BUILD_ALLOW_NON_MAC:-0}" != 1 ]; then
  echo "build.sh currently builds the macOS .app and must run on a Mac." >&2
  echo "Windows and Linux builds are planned (output: dist/windows/ and dist/linux/) but not implemented yet." >&2
  echo "(NORD_BUILD_ALLOW_NON_MAC=1 assembles the bundle layout elsewhere for testing; no signing/lipo.)" >&2
  exit 1
fi
command -v cargo >/dev/null || { echo "cargo not found. Install Rust: https://rustup.rs" >&2; exit 1; }

NAME="Nord Engine"
VERSION="$(sed -n 's/^version = "\(.*\)"/\1/p' Cargo.toml | head -1)"
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
for d in vendor runtime editor docs library examples; do
  [ -d "$d" ] && cp -R "$d" "$RES/"
done
find "$RES" \( -name '.nord-cache' -o -name 'dist' -o -name '.DS_Store' \) -prune -exec rm -rf {} + 2>/dev/null || true
# drop optional/large things the editor does not need at runtime
rm -rf "$RES/vendor/playcanvas" 2>/dev/null || true
[ -f assets/brand/icon.icns ] && cp assets/brand/icon.icns "$RES/AppIcon.icns"
cp LICENSE THIRD_PARTY.md "$RES/" 2>/dev/null || true

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
