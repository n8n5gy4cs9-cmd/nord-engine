#!/usr/bin/env bash
# Re-fetch optional CC0 asset packs into assets/packs/ (see ASSETS.md). Pinned by commit.
set -euo pipefail
cd "$(dirname "$0")/.."
T=$(mktemp -d); trap 'rm -rf "$T"' EXIT
git clone -q https://github.com/KenneyNL/Starter-Kit-3D-Platformer "$T/k"
git -C "$T/k" checkout -q 3fa8a04b1c01ab23db43123d4ce814a34c3fc7f0
D=assets/packs/kenney-platformer-3d; mkdir -p $D
cp -r "$T/k/models" "$T/k/sounds" "$T/k/sprites" $D/
find $D -name '*.import' -delete
