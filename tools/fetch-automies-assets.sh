#!/usr/bin/env bash
# Copies the Kenney (MIT, https://github.com/KenneyNL) Starter-Kit models and sounds that Automies uses into tools/examples/automies/assets/.
# Clones the kits shallowly into third_party/ first if they are not there (third_party is gitignored). Re-runnable.
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p third_party
for kit in Starter-Kit-City-Builder Starter-Kit-Racing; do [ -d "third_party/$kit/.git" ] || git clone -q --depth 1 "https://github.com/KenneyNL/$kit" "third_party/$kit"; done
A=tools/examples/automies/assets
C=$A/models/kenney/city; R=$A/models/kenney/racing; S=$A/audio/kenney
mkdir -p "$C/Textures" "$R/Textures" "$S"
for m in road-straight road-straight-lightposts road-corner road-split road-intersection pavement pavement-fountain grass grass-trees grass-trees-tall building-small-a building-small-b building-small-c building-small-d building-garage; do cp "third_party/Starter-Kit-City-Builder/models/$m.glb" "$C/"; done
cp third_party/Starter-Kit-City-Builder/models/Textures/colormap.png "$C/Textures/"
for m in vehicle-truck-red vehicle-truck-green vehicle-truck-purple vehicle-truck-yellow; do cp "third_party/Starter-Kit-Racing/models/$m.glb" "$R/"; done
cp third_party/Starter-Kit-Racing/models/Textures/colormap.png "$R/Textures/"
cp third_party/Starter-Kit-Racing/audio/{engine,skid,impact}.ogg "$S/"
cp third_party/Starter-Kit-City-Builder/sounds/ambience.ogg "$S/ambience.ogg"
cp third_party/Starter-Kit-City-Builder/LICENSE.md "$A/models/kenney/LICENSE-kenney-city.md"; cp third_party/Starter-Kit-Racing/LICENSE "$A/models/kenney/LICENSE-kenney-racing.txt"
echo "ok: $(find $A/models/kenney $S -type f | wc -l) files"
