# Project & scene format (v1 draft — implement in `nord-core`, schema in `crates/nord-core/schema/`)

All files are UTF-8 JSON, pretty-printed (2 spaces), stable key order, trailing newline.

## Project folder
```
my-game/
├─ nord.project.json
├─ scenes/main.scene.json
├─ prefabs/player.prefab.json
├─ scripts/player.js            # JS scripts (ES modules); or src/ for Rust tiers
├─ assets/…                     # images, audio, models, fonts, tilemaps
├─ .nord-cache/                 # thumbs, import cache (gitignored)
└─ dist/                        # build output (gitignored)
```

## nord.project.json
```json
{
  "format": 1,
  "name": "My Game",
  "id": "com.crowelian.mygame",
  "type": "2d",                       // 2d | 3d | wasm-game | wasm-app | html
  "engineVersion": "0.1.0",
  "startScene": "scenes/main.scene.json",
  "display": { "width": 1280, "height": 720, "scale": "fit", "pixelArt": false, "background": "#101418" },
  "physics": { "engine": "arcade", "gravity": [0, 980, 0] },   // arcade|matter|havok|rapier|none
  "input": { "actions": { "jump": ["Space", "Gamepad0"], "left": ["KeyA","ArrowLeft"] } },
  "plugins": ["ui", "audio"],         // optional nord.js modules to include
  "export": { "web": { "singleFile": false, "minify": true }, "mac": { "bundleId": "com.crowelian.mygame", "icon": "assets/icon.png" } }
}
```

## Scene (`*.scene.json`)
```json
{
  "format": 1,
  "name": "main",
  "settings": { "ambient": "#222233", "skybox": null, "gravity": null },
  "entities": [
    {
      "id": "k3j9x0a1",                // unique 8-char base36
      "name": "Player",
      "enabled": true,
      "tags": ["player"],
      "layer": 0,
      "transform": { "pos": [100, 300, 0], "rot": [0, 0, 0], "scale": [1, 1, 1] },
      "components": [
        { "type": "sprite", "texture": "assets/sprites/player.png", "frame": 0, "tint": "#ffffff", "flipX": false },
        { "type": "rigidbody", "mode": "dynamic", "mass": 1, "drag": 0.1 },
        { "type": "collider", "shape": "box", "size": [16, 24], "trigger": false }
      ],
      "scripts": [
        { "path": "scripts/player.js", "attributes": { "speed": 220, "jumpForce": 520 } }
      ],
      "behaviors": [ { "type": "Platform", "properties": { "maxSpeed": 330 } } ],   // optional, see docs/BEHAVIORS.md
      "vars": { "hp": 3 },                                                           // optional instance variables (event sheets)
      "children": [],
      "prefab": null                    // or { "path": "prefabs/x.prefab.json", "overrides": {…} }
    }
  ]
}
```
Units: 2D = pixels, y down; 3D = metres, y up, left-handed (Babylon default). Rotation = degrees (Euler XYZ).

## Built-in components (v1)
`sprite, animatedSprite, text, tilemap, particles, camera, light, mesh (primitive), model (glTF), material,
rigidbody, collider, audioSource, audioListener, uiPanel/uiButton/uiLabel/uiImage/uiBar, trigger, path, spawner`.
Each component has a JSON schema `{ type, fields:[{name,type,default,min,max,enum,label}] }` in
`runtime/core/components/*.schema.json`; the **inspector is generated from schemas** (same for script `attributes`).
Attribute types: `number, int, bool, string, color, vec2, vec3, enum, entity, asset(image|audio|model|json|prefab), curve, array<T>`.

## Prefab
Same as a scene with a single root entity: `{ "format":1, "root": {entity…} }`.

## Asset metadata
Sidecar `assets/foo.png.meta.json` only when non-default: `{ "type":"spritesheet","frameWidth":32,"frameHeight":32,
"anims":{"walk":{"frames":[0,3],"fps":10,"loop":true}}, "filter":"nearest", "tags":["character"] }`.

## Library index (`library/INDEX.json`)
`[{ "id":"controller.platformer2d", "title":"…", "category":"controllers", "tags":[], "tier":["2d"], "file":"…",
"description":"…", "attributes":[…], "requires":["physics.arcade"], "demo":"examples/…", "source":"original|<upstream>" }]`

## 2D Level Creator authoring files

`levels/*.level2d.json` uses `format: "nord-level2d/1"`: `name`, `mode` (`platform/topdown`), `physics` (`arcade/matter`), map `width/height/tileSize`, `gravity/background`, ordered `layers` (id/name/visible/locked/parallax/opacity and sparse `"x,y"` tiles), `entities` (sprite ID, transform/body fields, tags, scripts), custom image definitions and level-local variants. Save compiles this to ordinary `scenes/*.scene.json` and copies referenced assets. Authoring is not round-tripped from a modified scene. See `LEVEL_CREATOR_2D.md`; normal scene/runtime/export format is unchanged.

2D authoring files may include `items: [{id,title,entity}]`, persistent project item definitions. Placement clones the definition with a new instance ID, location and active layer. These definitions do not create runtime objects until placed. Older files derive defaults from existing entities on editor load.
