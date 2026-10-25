---
title: T23 2D lights and real shadows
section: Tutorials
order: 23
summary: Make any 2D scene dark, add torches and a flashlight that cast real shadows, tune darkness / light force / shadow softness, and use the light in gameplay. Includes a copy-paste kit.
---
**Example:** `examples/light2d/` — *Crypt of Embers*. A dark crypt lit only by what you carry: light four braziers, burn the shades with your beam, hide behind pillars. Everything is built from three reusable library scripts you can drop into **any 2D project**.

## 1. Copy-paste kit (2 minutes)
1. Copy these three files from `library/scripts/` into your project's `scripts/` folder (or insert them from the editor **Library** panel: *2D lighting & shadows*, *2D light source*, *2D shadow caster*).
2. Add this entity to your scene (one per scene; any name, any position). It makes the scene dark:

**In the file** `scenes/main.scene.json` (the entity list; add it, or build it with the editor: @ui[Hierarchy ▸ + Create ▸ Empty] and @ui[Inspector ▸ + Add script ▸ scripts/light2d.js]):
```json
{ "name": "Light2D", "transform": { "pos": [0, 0, 0] },
  "scripts": [{ "path": "scripts/light2d.js", "attributes": { "ambient": "#14172b", "force": 1, "shadowStrength": 1, "softness": 1 } }] }
```

3. Add a light to anything: put the script on a torch, the player, a lamp…

**In the file** a torch entity's `scripts` list in `scenes/main.scene.json` (editor: @ui[Inspector ▸ + Add script ▸ scripts/light2d-source.js]):
```json
{ "path": "scripts/light2d-source.js", "attributes": { "color": "#ffb25a", "radius": 200, "intensity": 1, "flicker": 0.25, "softness": 4 } }
```

4. Make walls, crates and pillars cast shadows (size comes from the sprite or collider):

**In the file** a wall entity's `scripts` list in `scenes/main.scene.json` (editor: @ui[Inspector ▸ + Add script ▸ scripts/light2d-occluder.js]):
```json
{ "path": "scripts/light2d-occluder.js", "attributes": {} }
```
Use `"shape": "circle", "radius": 22` for round things.

That is all. Press **Play**: the scene is dark, lights glow and the occluders throw shadows. Anything on **layer 1 or higher**, and the whole HUD, is drawn above the darkness.

### The three files
::: example-code library/scripts/light2d.js js
::: example-code library/scripts/light2d-source.js js
::: example-code library/scripts/light2d-occluder.js js

## 2. The dials: how dark, how bright, how soft
All dials live on the `light2d.js` entity and can be changed in the inspector **or at runtime**.

| Dial | Meaning |
| --- | --- |
| `ambient` | Colour of unlit areas. `#000000` pitch black, `#14172b` crypt, `#ffffff` no darkness (day). Tint it blue for night, orange for dusk. |
| `force` | Light force: multiplies every light's brightness (0 = lights off, 1 = normal, up to 4). |
| `shadowStrength` | 1 = black shadows, 0.5 = shadows half-lit by their light, 0 = shadows invisible. |
| `softness` | Multiplies every light's own `softness`. 0 = razor hard shadows, 1 = as authored, 3 = very soft. |
| `scale` | Lightmap resolution: 0.5 (default) is cheap and soft, 1 is sharper. |
| `softShadows` | Samples for soft edges (1–8). More = smoother, slightly slower. |

Per light (`light2d-source.js`): `color`, `intensity`, `radius`, `falloff` (1 linear, higher = tighter glow), `shadows`, `softness`, `angle` (360 = point light, 50 = flashlight cone), `aim` (`fixed`, `pointer`, `move`), `flicker`, `on`.

Change them from a script:

**File: your script, for example `scripts/Dials.js`** (inside `update(dt)`)
```js
const sys = [...this.scene.all()].flatMap((e) => e.scripts).find((s) => s.setLook);
sys.setLook({ force: 1.6, shadowStrength: 0.7, softness: 2, ambient: '#2b2f52' }); // darker/lighter scene at will
sys.toggleShadows();
const lamp = this.scene.find('Lamp').scripts.find((s) => s.isLight2D);
lamp.intensity = 2; lamp.radius = 260; lamp.setColor('#8fb8ff'); lamp.on = false;
```
In Crypt of Embers hold `[` `]` (force), `;` `'` (shadow strength), `,` `.` (softness), press `B` for darkness and `L` for shadows on/off, `H` for the live stats panel.

## 3. Build it step by step
1. **Dark crypt.** One `Light2D` entity, `ambient` very dark. The floor is a single big sprite.
2. **Walls.** Each wall is one entity with a static collider and `light2d-occluder.js`; brick sprites are children. One occluder per wall keeps shadows cheap.
3. **The hero's light.** Two child entities of the hero: `Halo` (point light) and `Beam` (`angle: 54`, `aim: "pointer"`, `turn` speed limit for smooth swinging). `lantern.js` turns the beam on while you hold fire and drains oil.
4. **Braziers.** A small flickering light that `brazier.js` boosts when lit (it just changes `radius` and `intensity` on the light script).
5. **Gameplay from light.** `game.light2d.lightAt(x, y)` returns how lit a world point is, with line of sight, so walls block it. `shade.js` burns when the level is high and chases in the dark. `sample(x, y)` also gives the direction to the light.

::: example-code examples/light2d/scripts/lantern.js js
::: example-code examples/light2d/scripts/shade.js js

::: tip
The shadow shape is computed once per light and only recomputed when that light or an occluder nearby moves, so many static torches cost almost nothing. Mark moving crates `"static": false` on the occluder.
:::

## 4. Performance checklist
- Prefer a few big lights over many small ones; a light off-screen is skipped.
- Lights with `shadows: false` (pickup glints) are just a gradient.
- Lower `softShadows` or raise `scale` softness only if the lightmap time in the Light Lab (`H`) gets high; a typical scene is about 1 ms.

## 5. Try next
Swap the ambient to `#7a86b8` for a moonlit yard, give a lamp `angle: 90` and `aim: "fixed"` as a spotlight on a rotating entity, or animate `force` for lightning with `this.tween`.
