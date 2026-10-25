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
├─ anim/*.animator.json         # Animator controllers (docs/ANIMATOR.md)
├─ models/*.mesh.json|glb|obj   # 3D Modeler output (docs/MODELER.md)
├─ profiles/profile-N.json      # saved profiler recordings (docs/PROFILER.md)
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
      "static": false,                  // Inspector Static flag (omitted when false): does not move at runtime, `entity.isStatic`
      "locked": false,                  // editor only (omitted when false): not pickable in the Scene view
      "hier": {"bg": "#e25850", "text": "#ffffff", "bold": true}, // editor only, optional: Hierarchy row look (right-click ▸ Hierarchy style)
      "hidden": false,                  // editor only (omitted when false): not drawn in the Scene view
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
A component with `"componentEnabled": false` is skipped by the runtime (Inspector checkbox). Prefab `overrides` may patch the root's
`components / scripts / behaviors / effects / layer` and, for entities inside the prefab, `{"children": {"<index>": {…same keys…, "children": {…}}}}`
(numeric keys patch arrays by index, as everywhere in overrides).
Image import settings live in `<image>.meta.json`: `filter`, `wrap`, `ppu` (sprites are drawn at size ÷ ppu), `pivot` (`center|topLeft|top|…`, or the sprite editor's pixel `origin`),
`maxSize` (px, downscaled at load). Model `.meta.json`: `scale`, `materials: { "<material name in the file>": "<mat.json>" }`.
Units: 2D = pixels, y down; 3D = metres, y up, left-handed (Babylon default). Rotation = degrees (Euler XYZ).

## Built-in components (v1)
`sprite, animatedSprite, text, tilemap, particles, camera, light, mesh (primitive), model (glTF), material,
rigidbody, collider, audioSource, audioListener, uiPanel/uiButton/uiLabel/uiImage/uiBar, trigger, path, spawner`.
Each component has a JSON schema `{ type, fields:[{name,type,default,min,max,enum,label}] }` in
`runtime/core/components/*.schema.json`; the **inspector is generated from schemas** (same for script `attributes`).
Optional attribute keys: `label`, `default`, `min`/`max`, `options` (enum), `assetType`, `description`/`tooltip` (Inspector tooltip). Attribute types: `number, int, bool, string, color, vec2, vec3, enum, entity, asset(image|audio|model|json|prefab), curve, array<T>`.

### Signal connections (`connections`)
`"connections": [{ "event": "pressed", "target": "<entity id, empty = itself>", "method": "open" }]` on an entity: when it emits `event`, the runtime calls `method(data)` on the target's scripts (Inspector ▸ Signals).

## New components (2026-10-23)
`animator` `{ controller: 'anim/x.animator.json', params? }` (state machine for `animatedSprite` or `model`, docs/ANIMATOR.md), `netSync` `{ rate, rot, scale, vars[], interpolate, smoothing, id }` (multiplayer sync, docs/MULTIPLAYER.md).

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


## `quality` (optional, 3D)
`{ "level": "low|medium|high|ultra", "shadows": "off|hard|soft", "shadowResolution": 1024, "maxLights": 8, "antialiasing": true, "renderScale": 1, "postProcessing": true }`. `level` is a preset; the other keys override single values. Edited in Project ▸ Quality and lighting. Scene settings `ambient` (colour) and `ambientIntensity` (0 = off) are the environment light.


## Components added in 0.3.0
`rigidbody` gains `freezePositionX/Y/Z`, `freezeRotationX/Y/Z` (2D uses `freezeRotationZ`; a 2D body without the key keeps its rotation fixed), `interpolation` (`none|interpolate|extrapolate`), `collisionDetection` (`discrete|continuous|continuousDynamic|continuousSpeculative`), `friction`, `angularDrag`. `collider.shape` adds `capsule|polygon|edge|composite|cylinder` with `points` (`[[x, y]…]`), `direction`, `usedByComposite`, `edgeRadius`. `sprite` / `animatedSprite` gain `maskInteraction`. New components: `joint` (`kind`, `connectedBody`, `anchor`, `connectedAnchor`, limits, motor, spring fields), `lineRenderer`, `trailRenderer`, `spriteMask`, `spriteShape`, `shadertoy` (`file` / `code`, `channels`, `buffers`, `size`, `resolutionScale`, …). `nord.project.json` ▸ `input` gains `axes` and `smoothAxes`. Field lists: manual pages *Components*, generated from `crates/nord-editor/src/schema.rs`.
