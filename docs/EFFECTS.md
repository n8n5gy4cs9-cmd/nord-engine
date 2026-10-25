# Effects (M10-19)
Runtime: `runtime/core/effects.js` (registry, `game.effects`, CSS fallback) + `runtime/phaser/effects.js` (Phaser 4 `filters.internal`). Tests: `core.test.mjs` (handles, scene change), `tools/eventsheet-demo-test.mjs` (real WebGL).

| type | parameters (defaults) | scene | object | other tiers |
|---|---|---|---|---|
| blur | x 2, y 2, strength 1 | ✔ | ✔ | CSS |
| glow | color, outerStrength 4, innerStrength 0 | ✔ | ✔ | – |
| pixelate | amount 4 | ✔ | ✔ | – |
| vignette | x, y, radius 0.5, strength 0.5 | ✔ | ✔ | CSS overlay |
| barrel | amount 0.4 | ✔ | ✔ | – |
| brightness / contrast / saturate | value | ✔ | ✔ | CSS |
| hue | degrees | ✔ | ✔ | CSS |
| grayscale / sepia / negative | value | ✔ | ✔ | CSS |
| crt | intensity 0.4 | CSS overlay (any tier) | – | CSS overlay |

Use: `"settings": { "effects": [ { "type": "vignette", "strength": 0.6 }, { "type": "crt" } ] }` in a scene, `"effects": [ { "type": "glow", "color": "#ffd166" } ]` on an entity, `game.effects.add(entityOrScene, 'blur', { x: 4 })` (returns a handle with `set`, `setEnabled`, `remove`), or event sheet *Effects → Add effect / Set parameter / Remove / Clear* and the object actions *Add effect*, *Set effect parameter*.
Scene effects are cleared on scene change. Not done: per-layer effects (layers are plain numbers), animated wave/distort, bloom/shine/outline (Phaser 4 has no built-ins; glow covers outline), effect editor in the inspector, Babylon 3D post-process mapping (use `fx-postfx3d` library script).


## Shadertoy effect (0.3.0)
`game.effects.add('scene', 'shadertoy', { file: 'assets/shaders/crt.glsl', channels: [{ type: 'screen' }], mix: 1 })`: a shader written for shadertoy.com runs over the finished game picture (`iChannel0` = the game canvas). Implemented in `runtime/core/shadertoy.js` (`registerEffect`), Phaser `postrender` / Babylon `onAfterRenderObservable`. Scene level only. Manual page *Shadertoy*.
