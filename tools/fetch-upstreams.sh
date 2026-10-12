#!/usr/bin/env bash
# Shallow / sparse clone upstream repos into third_party/ (gitignored) for harvesting code.
# Usage: tools/fetch-upstreams.sh [name…]   (no args = all). Writes UPSTREAM.lock.json.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
TP="$ROOT/third_party"; mkdir -p "$TP"

# name|repo|sparse paths (space separated, empty = full shallow)
REPOS=(
"godot|godotengine/godot|doc/classes editor/icons platform/web LICENSE.txt COPYRIGHT.txt"
"godot-demo|godotengine/godot-demo-projects|2d 3d gui audio LICENSE.txt"
"playcanvas-engine|playcanvas/engine|build examples/src src/scene src/framework/components LICENSE"
"playcanvas-editor|playcanvas/editor|src LICENSE README.md"
"pcui|playcanvas/pcui|src dist styles LICENSE README.md package.json"
"macroquad|not-fl3/macroquad|"
"miniquad|not-fl3/miniquad|"
"bevy|bevyengine/bevy|examples LICENSE-MIT LICENSE-APACHE"
"raylib|raysan5/raylib|examples LICENSE"
"raylib-rs|raylib-rs/raylib-rs|samples showcase LICENSE"
"defold|defold/defold|editor/resources editor/src/clj/editor LICENSE.txt"
"egui|emilk/egui|examples crates/egui_demo_lib LICENSE-MIT LICENSE-APACHE"
"eframe-template|emilk/eframe_template|"
"phaser3-examples|phaserjs/examples|public/src"
"rapier|dimforge/rapier|examples2d examples3d LICENSE"
)

want=("$@")
wanted() { [ ${#want[@]} -eq 0 ] && return 0; for w in "${want[@]}"; do [ "$w" = "$1" ] && return 0; done; return 1; }

LOCK="$ROOT/UPSTREAM.lock.json"
echo '{' > "$LOCK.tmp"; first=1
for entry in "${REPOS[@]}"; do
  IFS='|' read -r name repo paths <<<"$entry"
  wanted "$name" || continue
  dir="$TP/$name"
  if [ ! -d "$dir/.git" ]; then
    echo "==> $name ($repo)"
    if [ -n "$paths" ]; then
      git clone -q --depth 1 --filter=blob:none --sparse "https://github.com/$repo.git" "$dir"
      (cd "$dir" && git sparse-checkout set --no-cone $paths >/dev/null 2>&1 || git sparse-checkout set $paths)
    else
      git clone -q --depth 1 "https://github.com/$repo.git" "$dir"
    fi
  fi
  sha=$(git -C "$dir" rev-parse HEAD)
  lic=$(ls "$dir" | grep -iE '^(LICENSE|COPYING|LICENCE)' | head -1 || true)
  licline=""; [ -n "$lic" ] && licline=$(head -3 "$dir/$lic" | tr '\n"' ' _' | cut -c1-80)
  [ $first -eq 0 ] && echo ',' >> "$LOCK.tmp"; first=0
  printf '  "%s": {"repo":"%s","sha":"%s","licenceFile":"%s","licenceHead":"%s"}' "$name" "$repo" "$sha" "$lic" "$licline" >> "$LOCK.tmp"
done
echo -e '\n}' >> "$LOCK.tmp"
# merge with existing lock when only some repos were fetched
if [ ${#want[@]} -gt 0 ] && [ -f "$LOCK" ]; then
  node -e 'const fs=require("fs");const a=JSON.parse(fs.readFileSync(process.argv[1]));const b=JSON.parse(fs.readFileSync(process.argv[2]));fs.writeFileSync(process.argv[1],JSON.stringify({...a,...b},null,2)+"\n")' "$LOCK" "$LOCK.tmp"
  rm "$LOCK.tmp"
else
  node -e 'const fs=require("fs");const b=JSON.parse(fs.readFileSync(process.argv[1]));fs.writeFileSync(process.argv[2],JSON.stringify(b,null,2)+"\n")' "$LOCK.tmp" "$LOCK"; rm "$LOCK.tmp"
fi
echo "done → $LOCK"; du -sh "$TP"/* 2>/dev/null
