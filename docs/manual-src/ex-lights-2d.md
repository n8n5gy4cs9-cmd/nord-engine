---
title: 48 · 2D lights and shadows (URP 2D Lights)
section: Examples
order: 48
summary: Dark scenes with torches, flashlights and real shadows in 2D, three library scripts, plus asking "how lit is this spot?" for stealth.
---

**Goal:** a dark dungeon where the hero carries a lantern, braziers flicker, walls and crates cast shadows and enemies in the dark can hide. In Unity this is the URP **2D Renderer** with `Light2D` and `ShadowCaster2D`.

| Unity | Nord (library, category *fx*) |
|---|---|
| 2D Renderer + Global Light 2D | `light2d.js`, the lighting system. **One** per scene |
| Point / Spot Light 2D | `light2d-source.js` |
| Shadow Caster 2D | `light2d-occluder.js` |
| Sample the light level in code | `game.light2d.lightAt(x, y)` |

The 3D equivalent is the `light` component ([3D camera and light](ex-camera-3d.html)); the scripts here are for 2D projects only.

## Set it up
1. @ui[Library] tab ▸ *fx*: insert **2D lighting & shadows (system)** on an empty object, for example `Light2D`. Set `ambient` to the darkness colour (a dark blue like `#14172b` works well) and `shadows` on.
2. Insert **2D light source** on any object that should glow (a torch sprite, the hero). Set `color`, `radius`, `intensity`, `falloff`.
3. Insert **2D shadow caster** on walls, pillars and crates. The size comes from the sprite or collider; set `shape: circle` and `radius` for round things, and tick `static` on walls that never move (faster).
4. @ui[Play]. Sprites on layer 1 and above, and the HUD, stay bright.

The finished example is `examples/light2d` (Crypt of Embers): braziers, a flashlight cone, a hero lantern and shadow-casting pillars.

## Light source options
| Attribute | Meaning |
|---|---|
| `color`, `intensity`, `radius`, `falloff` | tint, strength, reach in world units, how fast it fades (higher = tighter glow) |
| `shadows`, `softness` | cast shadows or not (off is cheaper), edge blur |
| `angle`, `aim`, `direction`, `turn` | a cone instead of a circle (`angle` below 360): flashlight; `aim` can follow the pointer, the movement or the entity's rotation |
| `flicker`, `flickerSpeed` | fire and bad-bulb effects |
| `on`, `offset` | switched on/off, position relative to the object |

## Switch a light from a script

**File: `scripts/Lantern.js`** (new file, the whole file; attach it to the object that has `light2d-source.js`)
```js
import { MonoBehaviour, UnityInput as Input } from 'nord';
import LightSource2D from './light2d-source.js';

export default class Lantern extends MonoBehaviour {
  Start() { this.light = this.entity.getScript(LightSource2D); }
  Update() {
    if (!this.light) return;
    if (Input.GetKeyDown('KeyF')) this.light.on = !this.light.on;       // flashlight toggle
  }
  OnLowOil() { this.light.radius = 60; this.light.setColor('#ff5533'); }
}
```
Runtime fields: `on`, `intensity`, `radius`, `angle`, `color`, `setColor('#rrggbb')`.

## Stealth: is the player in the dark?

**File: `scripts/Stealth.js`** (the `import` line goes at the top of the file; the body goes inside `Update()` of the script on the player)
```js
import { light2d } from './light2d.js';

Update() {
  const p = this.entity.worldPos;
  const lit = light2d(this.game).lightAt(p[0], p[1]);        // 0 = dark, about 1 = fully lit, shadows respected
  this.hidden = lit < 0.15;
}
```
`light2d(game).sample(x, y)` also gives the direction towards the light (`dx`, `dy`), useful for "shadow creatures flee the light". The Crypt of Embers example hurts the hero when a shade stands in the dark and burns shades with the flashlight beam.

## Traps
* Only **one** `light2d.js` system per scene. Sources and occluders can start in any order.
* Many shadow-casting lights are expensive: give cheap decorative glows `shadows: false` (the oil flasks in the example do) and keep `static` on for walls.
* The lightmap is small (`scale` attribute): bigger `scale` means blockier light, smaller means smoother and slower.
* It lights the whole 2D world as a darkening layer. UI Designer screens and objects on layer 1+ are not darkened, put "always visible" things there.

Back to [Examples](examples.html), [Effects](effects-particles-timelines.html).
