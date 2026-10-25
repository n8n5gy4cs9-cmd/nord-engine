---
title: T35 Prism Relay — code reactive GLSL game materials
section: Tutorials
order: 35
summary: Build a real 3D shader game from Crystal Relay: UV grids, moving scan waves, gameplay uniforms, live controls and GPU resource cleanup. Complete JavaScript and GLSL included.
---

Turn the Crystal Relay time trial into **Prism Relay**, a playable shader workshop. Platforms glow cyan when sprint energy is full, darken as it drains and turn red near the moving hazard. A grid and scanning wave animate across their surfaces. F changes grid density; G changes glow. The underlying game still has ordered gems, checkpoint lives, sprint energy, a timer, medals and saved best times.

This is real **GLSL running on the GPU**, connected to JavaScript gameplay state. You will reuse Nord's Babylon renderer instead of writing a WebGL renderer. Allow 90 minutes after T34. You need a WebGL-capable browser and the engine's bundled libraries. No downloaded textures, shader services or npm packages are used.

[Download the complete Prism Relay source project](assets/downloads/prism-relay-source.zip). Extract it to a writable folder and open its `nord.project.json` in Nord. For your own version copy your working T34 project and rename its project name/id. Keeping a separate copy protects the tested original.

<figure class="shot"><img src="assets/screenshots/ed-advanced-prism-relay.png" alt="Prism Relay with procedural cyan grid platforms and shader controls" loading="lazy"><figcaption>These platform surfaces come from GLSL arithmetic, not image textures. Gameplay sends energy and hazard proximity to the shader every update.</figcaption></figure>

## 1. Separate the two programs you are writing

Your **JavaScript** runs game logic once per update: read sprint energy, measure hazard distance and send a few numbers. The **vertex shader** transforms each vertex; the **fragment shader** calculates the colour of visible surface samples. The GPU executes the shader many times in parallel, so GLSL has no access to your JavaScript objects, scene search, UI or save slot.

The bridge is a **uniform**, a value JavaScript supplies to the material. A **varying** carries interpolated values from vertices to fragments. Here UV coordinates travel through a varying, while time, energy, danger, intensity and grid frequency are uniforms.

Create `scripts/prism-shaders.js` in your project folder, then open it in Nord's code editor. Export the vertex shader string:

```js
export const vertexSource = `
precision highp float;
attribute vec3 position;
attribute vec2 uv;
uniform mat4 worldViewProjection;
varying vec2 vUV;
void main() {
  vUV = uv;
  gl_Position = worldViewProjection * vec4(position, 1.0);
}`;
```

JavaScript backticks hold the GLSL source. `attribute` is geometry supplied by the engine. `worldViewProjection` combines object placement, camera view and perspective. Multiplying the local position by it produces the clip-space position the GPU expects.

**Important design choice:** this shader leaves vertex positions unchanged. The visible platform still matches its physics collider. Moving vertices for waves would require a deliberate collision policy; a beautiful surface that lies about landings makes a bad platform game.

## 2. Use UVs to repeat a procedural pattern

Add the fragmentSource export shown in the complete source. Its key grid calculation is:

**Excerpt** (from the fragment shader in `scripts/prism-shaders.js`):
```glsl
vec2 p = vUV * uFrequency;
vec2 cell = abs(fract(p) - 0.5);
float line = smoothstep(0.43, 0.49, max(cell.x, cell.y));
```

UVs normally range from zero to one across a mesh face. Multiplying by frequency creates repeated cells. `fract` keeps only the fractional part, resetting each cell to the same zero-to-one range. Subtracting 0.5 centres it; `abs` measures distance from that centre.

`max(cell.x, cell.y)` becomes large near either edge. `smoothstep` turns that distance into a soft grid line rather than an abrupt on/off threshold. Frequency controls cell count; it does not change platform size. Different box faces have their own UV islands, so seams are expected.

**Exercise:** predict what frequency 4, 8 and 16 will look like. Do not change every number at once. At high densities thin grid lines can shimmer at a distance; lower the frequency before blaming physics or camera motion.

## 3. Animate a wave without moving geometry

The shader adds a scanning brightness wave:

**Excerpt** (from the fragment shader in `scripts/prism-shaders.js`):
```glsl
float wave = 0.5 + 0.5 * sin((vUV.x + vUV.y) * 18.0 - uTime * 3.0);
```

Sine ranges from minus one to one. Multiplying and offsetting by 0.5 remaps it to zero through one. Adding UV components makes diagonal bands. The time term shifts those bands each frame. The spatial multiplier controls band density; the time multiplier controls speed.

Use the relay's elapsed gameplay clock for uTime. It stops during pause, so the effect freezes with the game. A wall-clock timestamp would keep the surfaces animating while the player is paused. Neither is universally wrong, but the chosen clock should match the intended behavior.

**Checkpoint:** after the material is attached, pause the game. Both the countdown and scanning wave should stop, then resume together.

## 4. Translate gameplay into colour

The complete fragment shader builds a cool colour from sprint energy and blends toward red as danger rises:

**Excerpt** (from the fragment shader in `scripts/prism-shaders.js`):
```glsl
vec3 cool = mix(vec3(0.04, 0.12, 0.22), vec3(0.1, 0.9, 1.0), uEnergy);
vec3 color = mix(cool, vec3(1.0, 0.12, 0.05), uDanger);
color *= 0.25 + line * uIntensity + wave * 0.25;
gl_FragColor = vec4(color, 1.0);
```

`vec3` holds red, green and blue. `mix(a,b,t)` interpolates: t=0 chooses a, t=1 chooses b. Keeping energy/danger in zero-to-one bounds makes the control predictable. Alpha 1 makes the surface opaque.

The whole course shares one material. That means **all platforms** react to the player's current danger level. This is an intentional global warning, not a per-platform distance field. For individual warnings you would need one material/uniform set per region or an instance-data approach.

This material is unlit: its brightness is calculated by this shader rather than Nord's normal PBR lighting. It does not acquire physical lighting simply because it is on a 3D object. Bloom may make bright areas glow, but it does not replace the shader calculation.

## 5. Create and attach the GPU material from Nord

Create `scripts/prism.js` and attach it to a new empty entity named **PrismFX**. Keep the relay controller on Player. The complete Prism script creates the material through the existing backend:

```js
const backend = this.game.backend;
this.material = new backend.B.ShaderMaterial('prism-relay', backend.scene,
  { vertexSource, fragmentSource }, {
    attributes: ['position', 'uv'],
    uniforms: ['worldViewProjection', 'uTime', 'uEnergy', 'uDanger',
      'uIntensity', 'uFrequency'],
  });
```

This is an explicit **Babylon escape hatch**. Nord has no general custom-GLSL material component, so we use its already-created Babylon scene and bundled Babylon API. This script belongs to the Babylon tier; do not attach it to a Phaser project.

Uniform names must match the shader exactly, including case. The shader strings are imported from your other project file. The script applies one shared material to Start and the entities named Plat0 through Plat6, preserving each mesh's original material for cleanup.

**Checkpoint:** save both files and the scene, Stop and Play. The landings show a grid. Console should contain no shader compilation error. If a platform is black or missing, inspect the first compiler error; a missing semicolon often causes many later messages.

## 6. Send live state and bind controls

Add actions to the existing `input.actions` object in nord.project.json:

**In the file** `nord.project.json`, inside `input.actions` (add these lines, keep the commas valid; the editor way is @ui[Project ▸ Input Manager]):
```json
"grid": ["KeyF"],
"glow": ["KeyG"]
```

Keep the other actions and valid commas. The full controller measures hazard proximity:

**Excerpt** (from `scripts/relay.js`):
```js
const distance = Math.hypot(...p.map((v, i) => v - h[i]));
const danger = Math.max(0, 1 - distance / 6);
this.material.setFloat('uDanger', danger);
```

At six units or farther the value is zero; at the hazard's centre it approaches one. JavaScript supplies one scalar, not a copy of the whole game object. `setFloat` updates a named uniform for future draws.

The final update sends all uniforms through Object.entries. This loops over name/value pairs, keeping the bridge easy to inspect. Pressed checks toggle F/G once per press; a down check would toggle repeatedly every frame while held.

Select PrismFX in Inspector to tune intensity and frequency. Stop/Play initializes attributes cleanly. Changing shader module strings while running may require Stop/Play because their imported module is a separate dependency; do not assume editing prism-shaders.js reruns the material constructor.

**Checkpoint:** F doubles grid density, G changes glow, Shift drains energy and visibly darkens the course, and approaching the hazard moves its colour toward red. None of these changes landing collision.

## 7. Dispose resources and preserve the gameplay loop

A shader material allocates GPU resources. On scene destruction, restore the original materials on meshes that still exist, dispose the custom material, and clear the custom help screen. The complete onDestroy does these jobs even if some start work was incomplete.

Do not dispose the original materials just because you temporarily replaced them: the normal component lifecycle owns them. Do not keep a new ShaderMaterial per frame either; construct once and update uniforms thereafter.

Play a full relay: ordered crystals, a checkpoint fall, sprint recharge, hazard damage, pause, win and retry. Test retry several times while watching Console. The visual layer must not create a second relay controller or interfere with its records.

## 8. Export, inspect and extend

From your project's parent folder:

**Terminal** (in the folder that contains your project folder):
```sh
nord check my-prism-relay
nord build my-prism-relay --out prism-web --zip
python3 -m http.server 8002 --directory prism-web
```

Open the exported copy, confirm the shader compiles there, then test F/G and sprint. The two imported shader strings are ordinary project JavaScript, so the folder export includes them with the rest of the script graph. There are no external texture requests.

If the export is black, compare Console messages with the editor run and verify you copied both modules. If glow is too strong, lower intensity before changing your entire post-process chain. If a new platform keeps its original material, give it the expected PlatN name or update the material-selection rule.

**Advanced challenges:** make a safe-area colour that depends on the next crystal; add an Inspector colour parameter using setVector3; replace the diagonal wave with radial rings using distance from UV centre. Keep the no-displacement contract until you explicitly implement matching collision.

## Complete source

Every custom JavaScript/GLSL line follows, along with the inherited relay game, helpers, full scene/project data and HTML. The [source archive](assets/downloads/prism-relay-source.zip) also contains binaries and licence. Start with T34 if the gameplay controller is unfamiliar; this tutorial adds a focused GPU layer to that complete game.

<!-- GENERATED GAME SOURCE: regenerate with node tools/build-code-workshops.mjs -->

### scripts/prism.js

```js
import { NordScript } from 'nord';
import { vertexSource, fragmentSource } from './prism-shaders.js';
export default class Prism extends NordScript {
  static attributes = {
    intensity: { type: 'number', default: 1.6, min: 0, max: 4 },
    frequency: { type: 'number', default: 8, min: 1, max: 32 },
  };
  start() {
    // Intentional Babylon escape hatch: Nord has no custom GLSL-material component.
    const backend = this.game.backend;
    this.material = new backend.B.ShaderMaterial('prism-relay', backend.scene,
      { vertexSource, fragmentSource }, {
        attributes: ['position', 'uv'],
        uniforms: ['worldViewProjection', 'uTime', 'uEnergy', 'uDanger', 'uIntensity', 'uFrequency'],
      });
    this.originals = [];
    for (const entity of this.scene.all()) {
      if (!/^Plat\d+$/.test(entity.name) && entity.name !== 'Start') continue;
      const mesh = entity.getComponent('mesh').mesh;
      this.originals.push([mesh, mesh.material]);
      mesh.material = this.material;
    }
    this.relay = this.scene.find('Player').scripts.find(s => 'energy' in s);
    this.ui.label('PRISM LAB: F = grid density | G = glow | Shift = sprint', {
      screen: 'prism', x: 12, y: 130, size: 16,
    });
    this.ui.show('prism');
  }
  update() {
    const r = this.relay, p = r.player.pos, h = r.hazard.pos;
    const distance = Math.hypot(...p.map((v, i) => v - h[i]));
    if (this.input.pressed('grid')) this.attrs.frequency = this.attrs.frequency === 8 ? 16 : 8;
    if (this.input.pressed('glow')) this.attrs.intensity = this.attrs.intensity === 1.6 ? 0.5 : 1.6;
    for (const [name, value] of Object.entries({
      uTime: r.elapsed, uEnergy: r.energy, uDanger: Math.max(0, 1 - distance / 6),
      uIntensity: this.attrs.intensity, uFrequency: this.attrs.frequency,
    })) this.material.setFloat(name, value);
  }
  onDestroy() {
    for (const [mesh, material] of this.originals ?? []) if (!mesh.isDisposed()) mesh.material = material;
    this.material?.dispose();
    this.ui.clear('prism');
  }
}
```

<details>
<summary>Complete index.html</summary>

```html
<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Prism Relay — GLSL workshop</title>
<style>html,body{margin:0;height:100%;background:#101418;overflow:hidden}#stage{position:relative;width:100vw;height:100vh}</style>
<script type="importmap">{"imports":{"nord":"/runtime/core/index.js"}}</script></head>
<body><div id="stage"></div>
<script src="/vendor/babylonjs/babylon.js"></script>
<script src="/vendor/babylonjs-loaders/babylonjs.loaders.min.js"></script>
<script src="/vendor/babylonjs-gui/babylon.gui.min.js"></script>
<script src="/vendor/havok/HavokPhysics_umd.js"></script>
<script type="module">
import { boot } from '/runtime/babylon/index.js';
try {
  const project = await (await fetch('nord.project.json')).json();
  await boot(project, { container: document.getElementById('stage'), preserveDrawingBuffer: true });
  window.__nord_ready = true;
} catch (e) { console.error(e); window.__nord_error = String(e); }
</script></body></html>
```

</details>

<details>
<summary>Complete nord.project.json</summary>

**File: `nord.project.json`** (the complete file, for comparison)
```json
{
  "format": 1,
  "name": "Prism Relay — GLSL workshop",
  "id": "com.crowelian.prismrelay",
  "type": "3d",
  "engineVersion": "0.1.0",
  "startScene": "scenes/main.scene.json",
  "display": {
    "width": 1280,
    "height": 720,
    "scale": "fit",
    "pixelArt": false,
    "background": "#2e3440"
  },
  "physics": {
    "engine": "havok",
    "gravity": [
      0,
      -9.81,
      0
    ]
  },
  "input": {
    "actions": {
      "left": [
        "KeyA",
        "ArrowLeft"
      ],
      "right": [
        "KeyD",
        "ArrowRight"
      ],
      "up": [
        "KeyW",
        "ArrowUp"
      ],
      "down": [
        "KeyS",
        "ArrowDown"
      ],
      "jump": [
        "Space"
      ],
      "fire": [
        "Space",
        "Mouse0"
      ],
      "interact": [
        "KeyE",
        "Enter"
      ],
      "camLeft": [
        "KeyQ"
      ],
      "camRight": [
        "KeyE"
      ],
      "sprint": [
        "ShiftLeft",
        "ShiftRight"
      ],
      "grid": [
        "KeyF"
      ],
      "glow": [
        "KeyG"
      ]
    }
  },
  "plugins": [
    "ui",
    "audio"
  ],
  "ui": {
    "skin": "cyber",
    "theme": "nord"
  }
}
```

</details>

<details>
<summary>Complete scenes/main.scene.json</summary>

**File: `scenes/main.scene.json`** (the complete file, for comparison)
```json
{
  "format": 1,
  "name": "main",
  "settings": {},
  "entities": [
    {
      "id": "eeeeee1h",
      "name": "Sun",
      "enabled": true,
      "tags": [],
      "layer": 0,
      "transform": {
        "pos": [
          0,
          10,
          0
        ],
        "rot": [
          50,
          -30,
          0
        ],
        "scale": [
          1,
          1,
          1
        ]
      },
      "components": [
        {
          "type": "light",
          "kind": "directional",
          "intensity": 1.4,
          "castShadows": true,
          "color": "#fff4e0"
        }
      ],
      "scripts": [],
      "children": [],
      "prefab": null
    },
    {
      "id": "eeeeee1i",
      "name": "Ambient",
      "enabled": true,
      "tags": [],
      "layer": 0,
      "transform": {
        "pos": [
          0,
          0,
          0
        ],
        "rot": [
          0,
          0,
          0
        ],
        "scale": [
          1,
          1,
          1
        ]
      },
      "components": [
        {
          "type": "light",
          "kind": "hemispheric",
          "intensity": 0.55,
          "color": "#b0c0ff"
        }
      ],
      "scripts": [],
      "children": [],
      "prefab": null
    },
    {
      "id": "eeeeee1j",
      "name": "Sky",
      "enabled": true,
      "tags": [],
      "layer": 0,
      "transform": {
        "pos": [
          0,
          0,
          0
        ],
        "rot": [
          0,
          0,
          0
        ],
        "scale": [
          1,
          1,
          1
        ]
      },
      "components": [
        {
          "type": "skybox",
          "path": "assets/skybox/sunset"
        }
      ],
      "scripts": [],
      "children": [],
      "prefab": null
    },
    {
      "id": "eeeeee1k",
      "name": "Ground",
      "enabled": true,
      "tags": [],
      "layer": 0,
      "transform": {
        "pos": [
          0,
          0,
          0
        ],
        "rot": [
          0,
          0,
          0
        ],
        "scale": [
          1,
          1,
          1
        ]
      },
      "components": [
        {
          "type": "mesh",
          "shape": "ground",
          "size": [
            120,
            0.2,
            120
          ]
        },
        {
          "type": "material",
          "texture": "assets/textures/sand.png",
          "uvScale": [
            30,
            30
          ],
          "roughness": 1
        }
      ],
      "scripts": [],
      "children": [],
      "prefab": null
    },
    {
      "id": "eeeeee1l",
      "name": "Start",
      "enabled": true,
      "tags": [],
      "layer": 0,
      "transform": {
        "pos": [
          0,
          0.25,
          0
        ],
        "rot": [
          0,
          0,
          0
        ],
        "scale": [
          1,
          1,
          1
        ]
      },
      "components": [
        {
          "type": "mesh",
          "shape": "box",
          "size": [
            6,
            0.5,
            6
          ]
        },
        {
          "type": "material",
          "texture": "assets/textures/stone.png",
          "uvScale": [
            3,
            3
          ],
          "roughness": 0.8,
          "metallic": 0
        },
        {
          "type": "rigidbody",
          "mode": "static",
          "mass": 1,
          "bounce": 0,
          "fixedRotation": false
        },
        {
          "type": "collider",
          "shape": "box",
          "size": [
            6,
            0.5,
            6
          ],
          "trigger": false
        }
      ],
      "scripts": [],
      "children": [],
      "prefab": null
    },
    {
      "id": "eeeeee1m",
      "name": "Plat0",
      "enabled": true,
      "tags": [],
      "layer": 0,
      "transform": {
        "pos": [
          0,
          0.25,
          6
        ],
        "rot": [
          0,
          0,
          0
        ],
        "scale": [
          1,
          1,
          1
        ]
      },
      "components": [
        {
          "type": "mesh",
          "shape": "box",
          "size": [
            3,
            0.5,
            3
          ]
        },
        {
          "type": "material",
          "texture": "assets/textures/checker.png",
          "uvScale": [
            1.5,
            1.5
          ],
          "roughness": 0.8,
          "metallic": 0
        },
        {
          "type": "rigidbody",
          "mode": "static",
          "mass": 1,
          "bounce": 0,
          "fixedRotation": false
        },
        {
          "type": "collider",
          "shape": "box",
          "size": [
            3,
            0.5,
            3
          ],
          "trigger": false
        }
      ],
      "scripts": [],
      "children": [],
      "prefab": null
    },
    {
      "id": "eeeeee1n",
      "name": "Plat1",
      "enabled": true,
      "tags": [],
      "layer": 0,
      "transform": {
        "pos": [
          4,
          0.9,
          10
        ],
        "rot": [
          0,
          0,
          0
        ],
        "scale": [
          1,
          1,
          1
        ]
      },
      "components": [
        {
          "type": "mesh",
          "shape": "box",
          "size": [
            3,
            0.5,
            3
          ]
        },
        {
          "type": "material",
          "texture": "assets/textures/checker.png",
          "uvScale": [
            1.5,
            1.5
          ],
          "roughness": 0.8,
          "metallic": 0
        },
        {
          "type": "rigidbody",
          "mode": "static",
          "mass": 1,
          "bounce": 0,
          "fixedRotation": false
        },
        {
          "type": "collider",
          "shape": "box",
          "size": [
            3,
            0.5,
            3
          ],
          "trigger": false
        }
      ],
      "scripts": [],
      "children": [],
      "prefab": null
    },
    {
      "id": "eeeeee1o",
      "name": "Plat2",
      "enabled": true,
      "tags": [],
      "layer": 0,
      "transform": {
        "pos": [
          8,
          1.6,
          14
        ],
        "rot": [
          0,
          0,
          0
        ],
        "scale": [
          1,
          1,
          1
        ]
      },
      "components": [
        {
          "type": "mesh",
          "shape": "box",
          "size": [
            3,
            0.5,
            3
          ]
        },
        {
          "type": "material",
          "texture": "assets/textures/checker.png",
          "uvScale": [
            1.5,
            1.5
          ],
          "roughness": 0.8,
          "metallic": 0
        },
        {
          "type": "rigidbody",
          "mode": "static",
          "mass": 1,
          "bounce": 0,
          "fixedRotation": false
        },
        {
          "type": "collider",
          "shape": "box",
          "size": [
            3,
            0.5,
            3
          ],
          "trigger": false
        }
      ],
      "scripts": [],
      "children": [],
      "prefab": null
    },
    {
      "id": "eeeeee1p",
      "name": "Plat3",
      "enabled": true,
      "tags": [],
      "layer": 0,
      "transform": {
        "pos": [
          3,
          2.4,
          18
        ],
        "rot": [
          0,
          0,
          0
        ],
        "scale": [
          1,
          1,
          1
        ]
      },
      "components": [
        {
          "type": "mesh",
          "shape": "box",
          "size": [
            3,
            0.5,
            3
          ]
        },
        {
          "type": "material",
          "texture": "assets/textures/checker.png",
          "uvScale": [
            1.5,
            1.5
          ],
          "roughness": 0.8,
          "metallic": 0
        },
        {
          "type": "rigidbody",
          "mode": "static",
          "mass": 1,
          "bounce": 0,
          "fixedRotation": false
        },
        {
          "type": "collider",
          "shape": "box",
          "size": [
            3,
            0.5,
            3
          ],
          "trigger": false
        }
      ],
      "scripts": [],
      "children": [],
      "prefab": null
    },
    {
      "id": "eeeeee1q",
      "name": "Plat4",
      "enabled": true,
      "tags": [],
      "layer": 0,
      "transform": {
        "pos": [
          -2,
          3.2,
          22
        ],
        "rot": [
          0,
          0,
          0
        ],
        "scale": [
          1,
          1,
          1
        ]
      },
      "components": [
        {
          "type": "mesh",
          "shape": "box",
          "size": [
            3,
            0.5,
            3
          ]
        },
        {
          "type": "material",
          "texture": "assets/textures/checker.png",
          "uvScale": [
            1.5,
            1.5
          ],
          "roughness": 0.8,
          "metallic": 0
        },
        {
          "type": "rigidbody",
          "mode": "static",
          "mass": 1,
          "bounce": 0,
          "fixedRotation": false
        },
        {
          "type": "collider",
          "shape": "box",
          "size": [
            3,
            0.5,
            3
          ],
          "trigger": false
        }
      ],
      "scripts": [],
      "children": [],
      "prefab": null
    },
    {
      "id": "eeeeee1r",
      "name": "Plat5",
      "enabled": true,
      "tags": [],
      "layer": 0,
      "transform": {
        "pos": [
          -7,
          3.9,
          25
        ],
        "rot": [
          0,
          0,
          0
        ],
        "scale": [
          1,
          1,
          1
        ]
      },
      "components": [
        {
          "type": "mesh",
          "shape": "box",
          "size": [
            3,
            0.5,
            3
          ]
        },
        {
          "type": "material",
          "texture": "assets/textures/checker.png",
          "uvScale": [
            1.5,
            1.5
          ],
          "roughness": 0.8,
          "metallic": 0
        },
        {
          "type": "rigidbody",
          "mode": "static",
          "mass": 1,
          "bounce": 0,
          "fixedRotation": false
        },
        {
          "type": "collider",
          "shape": "box",
          "size": [
            3,
            0.5,
            3
          ],
          "trigger": false
        }
      ],
      "scripts": [],
      "children": [],
      "prefab": null
    },
    {
      "id": "eeeeee1s",
      "name": "Plat6",
      "enabled": true,
      "tags": [],
      "layer": 0,
      "transform": {
        "pos": [
          -12,
          4.6,
          29
        ],
        "rot": [
          0,
          0,
          0
        ],
        "scale": [
          1,
          1,
          1
        ]
      },
      "components": [
        {
          "type": "mesh",
          "shape": "box",
          "size": [
            4,
            0.5,
            4
          ]
        },
        {
          "type": "material",
          "texture": "assets/textures/checker.png",
          "uvScale": [
            2,
            2
          ],
          "roughness": 0.8,
          "metallic": 0
        },
        {
          "type": "rigidbody",
          "mode": "static",
          "mass": 1,
          "bounce": 0,
          "fixedRotation": false
        },
        {
          "type": "collider",
          "shape": "box",
          "size": [
            4,
            0.5,
            4
          ],
          "trigger": false
        }
      ],
      "scripts": [],
      "children": [],
      "prefab": null
    },
    {
      "id": "eeeeee1t",
      "name": "Mover",
      "enabled": true,
      "tags": [],
      "layer": 0,
      "transform": {
        "pos": [
          14,
          2.4,
          22
        ],
        "rot": [
          0,
          0,
          0
        ],
        "scale": [
          1,
          1,
          1
        ]
      },
      "components": [
        {
          "type": "mesh",
          "shape": "box",
          "size": [
            3,
            0.5,
            3
          ]
        },
        {
          "type": "material",
          "color": "#88c0d0",
          "roughness": 0.8,
          "metallic": 0
        },
        {
          "type": "rigidbody",
          "mode": "kinematic",
          "mass": 1,
          "bounce": 0,
          "fixedRotation": false
        },
        {
          "type": "collider",
          "shape": "box",
          "size": [
            3,
            0.5,
            3
          ],
          "trigger": false
        }
      ],
      "scripts": [
        {
          "path": "scripts/physics-moving-platform.js",
          "attributes": {
            "offset": [
              0,
              0,
              8
            ],
            "period": 5,
            "carryTag": "player"
          }
        }
      ],
      "children": [],
      "prefab": null
    },
    {
      "id": "eeeeee1u",
      "name": "Gem0",
      "enabled": true,
      "tags": [
        "gem"
      ],
      "layer": 0,
      "transform": {
        "pos": [
          0,
          1.45,
          6
        ],
        "rot": [
          0,
          0,
          0
        ],
        "scale": [
          1,
          1,
          1
        ]
      },
      "components": [
        {
          "type": "mesh",
          "shape": "sphere",
          "size": [
            0.5,
            0.5,
            0.5
          ]
        },
        {
          "type": "material",
          "color": "#ebcb8b",
          "metallic": 0.6,
          "roughness": 0.3,
          "emissive": "#6b5a20"
        },
        {
          "type": "rigidbody",
          "mode": "static"
        },
        {
          "type": "collider",
          "shape": "sphere",
          "radius": 0.5,
          "trigger": true
        }
      ],
      "scripts": [
        {
          "path": "scripts/spin.js",
          "attributes": {
            "speed": 120,
            "axis": "y"
          }
        }
      ],
      "children": [],
      "prefab": null
    },
    {
      "id": "eeeeee1v",
      "name": "Gem1",
      "enabled": true,
      "tags": [
        "gem"
      ],
      "layer": 0,
      "transform": {
        "pos": [
          4,
          2.1,
          10
        ],
        "rot": [
          0,
          0,
          0
        ],
        "scale": [
          1,
          1,
          1
        ]
      },
      "components": [
        {
          "type": "mesh",
          "shape": "sphere",
          "size": [
            0.5,
            0.5,
            0.5
          ]
        },
        {
          "type": "material",
          "color": "#ebcb8b",
          "metallic": 0.6,
          "roughness": 0.3,
          "emissive": "#6b5a20"
        },
        {
          "type": "rigidbody",
          "mode": "static"
        },
        {
          "type": "collider",
          "shape": "sphere",
          "radius": 0.5,
          "trigger": true
        }
      ],
      "scripts": [
        {
          "path": "scripts/spin.js",
          "attributes": {
            "speed": 120,
            "axis": "y"
          }
        }
      ],
      "children": [],
      "prefab": null
    },
    {
      "id": "eeeeee1w",
      "name": "Gem2",
      "enabled": true,
      "tags": [
        "gem"
      ],
      "layer": 0,
      "transform": {
        "pos": [
          8,
          2.8,
          14
        ],
        "rot": [
          0,
          0,
          0
        ],
        "scale": [
          1,
          1,
          1
        ]
      },
      "components": [
        {
          "type": "mesh",
          "shape": "sphere",
          "size": [
            0.5,
            0.5,
            0.5
          ]
        },
        {
          "type": "material",
          "color": "#ebcb8b",
          "metallic": 0.6,
          "roughness": 0.3,
          "emissive": "#6b5a20"
        },
        {
          "type": "rigidbody",
          "mode": "static"
        },
        {
          "type": "collider",
          "shape": "sphere",
          "radius": 0.5,
          "trigger": true
        }
      ],
      "scripts": [
        {
          "path": "scripts/spin.js",
          "attributes": {
            "speed": 120,
            "axis": "y"
          }
        }
      ],
      "children": [],
      "prefab": null
    },
    {
      "id": "eeeeee1x",
      "name": "Gem3",
      "enabled": true,
      "tags": [
        "gem"
      ],
      "layer": 0,
      "transform": {
        "pos": [
          3,
          3.5999999999999996,
          18
        ],
        "rot": [
          0,
          0,
          0
        ],
        "scale": [
          1,
          1,
          1
        ]
      },
      "components": [
        {
          "type": "mesh",
          "shape": "sphere",
          "size": [
            0.5,
            0.5,
            0.5
          ]
        },
        {
          "type": "material",
          "color": "#ebcb8b",
          "metallic": 0.6,
          "roughness": 0.3,
          "emissive": "#6b5a20"
        },
        {
          "type": "rigidbody",
          "mode": "static"
        },
        {
          "type": "collider",
          "shape": "sphere",
          "radius": 0.5,
          "trigger": true
        }
      ],
      "scripts": [
        {
          "path": "scripts/spin.js",
          "attributes": {
            "speed": 120,
            "axis": "y"
          }
        }
      ],
      "children": [],
      "prefab": null
    },
    {
      "id": "eeeeee1y",
      "name": "Gem4",
      "enabled": true,
      "tags": [
        "gem"
      ],
      "layer": 0,
      "transform": {
        "pos": [
          -2,
          4.4,
          22
        ],
        "rot": [
          0,
          0,
          0
        ],
        "scale": [
          1,
          1,
          1
        ]
      },
      "components": [
        {
          "type": "mesh",
          "shape": "sphere",
          "size": [
            0.5,
            0.5,
            0.5
          ]
        },
        {
          "type": "material",
          "color": "#ebcb8b",
          "metallic": 0.6,
          "roughness": 0.3,
          "emissive": "#6b5a20"
        },
        {
          "type": "rigidbody",
          "mode": "static"
        },
        {
          "type": "collider",
          "shape": "sphere",
          "radius": 0.5,
          "trigger": true
        }
      ],
      "scripts": [
        {
          "path": "scripts/spin.js",
          "attributes": {
            "speed": 120,
            "axis": "y"
          }
        }
      ],
      "children": [],
      "prefab": null
    },
    {
      "id": "eeeeee1z",
      "name": "Gem5",
      "enabled": true,
      "tags": [
        "gem"
      ],
      "layer": 0,
      "transform": {
        "pos": [
          -7,
          5.1,
          25
        ],
        "rot": [
          0,
          0,
          0
        ],
        "scale": [
          1,
          1,
          1
        ]
      },
      "components": [
        {
          "type": "mesh",
          "shape": "sphere",
          "size": [
            0.5,
            0.5,
            0.5
          ]
        },
        {
          "type": "material",
          "color": "#ebcb8b",
          "metallic": 0.6,
          "roughness": 0.3,
          "emissive": "#6b5a20"
        },
        {
          "type": "rigidbody",
          "mode": "static"
        },
        {
          "type": "collider",
          "shape": "sphere",
          "radius": 0.5,
          "trigger": true
        }
      ],
      "scripts": [
        {
          "path": "scripts/spin.js",
          "attributes": {
            "speed": 120,
            "axis": "y"
          }
        }
      ],
      "children": [],
      "prefab": null
    },
    {
      "id": "eeeeee20",
      "name": "Gem6",
      "enabled": true,
      "tags": [
        "gem"
      ],
      "layer": 0,
      "transform": {
        "pos": [
          -12,
          5.8,
          29
        ],
        "rot": [
          0,
          0,
          0
        ],
        "scale": [
          1,
          1,
          1
        ]
      },
      "components": [
        {
          "type": "mesh",
          "shape": "sphere",
          "size": [
            0.5,
            0.5,
            0.5
          ]
        },
        {
          "type": "material",
          "color": "#ebcb8b",
          "metallic": 0.6,
          "roughness": 0.3,
          "emissive": "#6b5a20"
        },
        {
          "type": "rigidbody",
          "mode": "static"
        },
        {
          "type": "collider",
          "shape": "sphere",
          "radius": 0.5,
          "trigger": true
        }
      ],
      "scripts": [
        {
          "path": "scripts/spin.js",
          "attributes": {
            "speed": 120,
            "axis": "y"
          }
        }
      ],
      "children": [],
      "prefab": null
    },
    {
      "id": "eeeeee21",
      "name": "Player",
      "enabled": true,
      "tags": [
        "player"
      ],
      "layer": 0,
      "transform": {
        "pos": [
          0,
          1.5,
          0
        ],
        "rot": [
          0,
          0,
          0
        ],
        "scale": [
          1,
          1,
          1
        ]
      },
      "components": [
        {
          "type": "mesh",
          "shape": "capsule",
          "size": [
            0.8,
            1.6,
            0.8
          ]
        },
        {
          "type": "material",
          "color": "#a3be8c"
        },
        {
          "type": "rigidbody",
          "mode": "dynamic",
          "mass": 1,
          "fixedRotation": true,
          "drag": 0
        },
        {
          "type": "collider",
          "shape": "capsule",
          "size": [
            0.8,
            1.6,
            0.8
          ]
        }
      ],
      "scripts": [
        {
          "path": "scripts/platformer3d.js",
          "attributes": {
            "speed": 6,
            "jumpSpeed": 8.5
          }
        },
        {
          "path": "scripts/util-sfx.js",
          "attributes": {}
        },
        {
          "path": "scripts/relay.js",
          "attributes": {}
        }
      ],
      "children": [],
      "prefab": null
    },
    {
      "id": "eeeeee22",
      "name": "Camera",
      "enabled": true,
      "tags": [],
      "layer": 0,
      "transform": {
        "pos": [
          0,
          5,
          -8
        ],
        "rot": [
          20,
          0,
          0
        ],
        "scale": [
          1,
          1,
          1
        ]
      },
      "components": [
        {
          "type": "camera",
          "fov": 60
        },
        {
          "type": "postProcess",
          "fxaa": true,
          "bloom": true,
          "vignette": 0.3,
          "tonemap": true
        }
      ],
      "scripts": [
        {
          "path": "scripts/camera-follow3d.js",
          "attributes": {
            "target": "Player",
            "offset": [
              0,
              5,
              -8
            ],
            "smoothing": 4
          }
        }
      ],
      "children": [],
      "prefab": null
    },
    {
      "id": "eeeeee23",
      "name": "Hazard",
      "enabled": true,
      "tags": [],
      "layer": 0,
      "transform": {
        "pos": [
          3,
          3.3,
          18
        ],
        "rot": [
          0,
          0,
          0
        ],
        "scale": [
          1,
          1,
          1
        ]
      },
      "components": [
        {
          "type": "mesh",
          "shape": "sphere",
          "size": [
            0.8,
            0.8,
            0.8
          ]
        },
        {
          "type": "material",
          "color": "#ff4433",
          "emissive": "#aa1100"
        }
      ],
      "scripts": [],
      "children": [],
      "prefab": null
    },
    {
      "id": "eeeeee24",
      "name": "PrismFX",
      "enabled": true,
      "tags": [],
      "layer": 0,
      "transform": {
        "pos": [
          0,
          0,
          0
        ],
        "rot": [
          0,
          0,
          0
        ],
        "scale": [
          1,
          1,
          1
        ]
      },
      "components": [],
      "scripts": [
        {
          "path": "scripts/prism.js",
          "attributes": {}
        }
      ],
      "children": [],
      "prefab": null
    }
  ]
}
```

</details>

<details>
<summary>Complete scripts/camera-follow3d.js</summary>

**File: `scripts/camera-follow3d.js`** (the complete file, for comparison)
```js
// @nord {"id":"camera.follow3d","title":"Camera follow (3D rig)","category":"camera","tier":["3d"],"tags":["camera","follow","chase"],"description":"Chase camera for 3D: keeps an offset from a target entity (by name), smoothing position. Put on a camera entity (non-orbit) — it looks at the target."}
import { NordScript } from 'nord';

export default class CameraFollow3D extends NordScript {
  static attributes = { target: { type: 'string', default: 'Player' }, offset: { type: 'vec3', default: [0, 4, -8] }, smoothing: { type: 'number', default: 5, min: 0 } };
  start() { this.t = this.scene.find(this.attrs.target); }
  lateUpdate(dt) {
    if (!this.t || this.t.destroyed) return;
    const a = this.attrs, tp = this.t.worldPos, p = this.entity.pos, k = Math.min(1, a.smoothing * dt || 1);
    const want = [tp[0] + a.offset[0], tp[1] + a.offset[1], tp[2] + a.offset[2]];
    const np = p.map((v, i) => v + (want[i] - v) * k);
    this.entity.pos = np;
    const d = [tp[0] - np[0], tp[1] - np[1], tp[2] - np[2]];
    this.entity.rot = [(-Math.atan2(d[1], Math.hypot(d[0], d[2])) * 180) / Math.PI, (Math.atan2(d[0], d[2]) * 180) / Math.PI, 0];
  }
}
```

</details>

<details>
<summary>Complete scripts/mk.js</summary>

**File: `scripts/mk.js`** (the complete file, for comparison)
```js
// Tiny helpers to spawn coloured rectangles / circles / text at runtime (placeholder art). Generated by tools/gen_examples.mjs.
const base = (name, x, y, z, tags, comps) => ({ name, tags: tags ?? [], transform: { pos: [x, y, z ?? 0], rot: [0, 0, 0], scale: [1, 1, 1] }, components: comps, scripts: [], children: [] });
export const rectData = (name, x, y, w, h, color, o = {}) => base(name, x, y, o.z, o.tags, [{ type: 'sprite', texture: 'assets/sprites/square.png', size: [w, h], tint: color, alpha: o.alpha ?? 1 }]);
export const circleData = (name, x, y, d, color, o = {}) => base(name, x, y, o.z, o.tags, [{ type: 'sprite', texture: 'assets/sprites/circle.png', size: [d, d], tint: color, alpha: o.alpha ?? 1 }]);
export const textData = (name, x, y, t, o = {}) => base(name, x, y, o.z ?? 50, o.tags, [{ type: 'text', text: t, size: o.size ?? 20, color: o.color ?? '#eceff4' }]);
export const rect = (scene, ...a) => scene.spawnData(rectData(...a));
export const circle = (scene, ...a) => scene.spawnData(circleData(...a));
export const label = (scene, ...a) => scene.spawnData(textData(...a));
export const aabb = (a, b) => Math.abs(a.pos[0] - b.pos[0]) * 2 < a.w + b.w && Math.abs(a.pos[1] - b.pos[1]) * 2 < a.h + b.h;
```

</details>

<details>
<summary>Complete scripts/physics-moving-platform.js</summary>

**File: `scripts/physics-moving-platform.js`** (the complete file, for comparison)
```js
// @nord {"id":"physics.moving-platform","title":"Moving platform","category":"physics","tier":["2d","3d"],"tags":["platform","path","carry"],"description":"Moves back and forth between its start and start+offset (sine or linear). Riders (anything standing on it with a rigidbody) are carried by applying the platform's delta."}
import { NordScript } from 'nord';

export default class MovingPlatform extends NordScript {
  static attributes = { offset: { type: 'vec3', default: [120, 0, 0] }, period: { type: 'number', default: 4, min: 0.1 }, mode: { type: 'enum', options: ['sine', 'pingpong'], default: 'sine' }, carryTag: { type: 'string', default: 'player' } };
  start() { this.o = [...this.entity.pos]; this.t = 0; this.prev = [...this.o]; }
  fixedUpdate(dt) {
    const a = this.attrs; this.t += dt / a.period;
    const f = a.mode === 'sine' ? (1 - Math.cos(this.t * Math.PI * 2)) / 2 : 1 - Math.abs(((this.t * 2) % 2) - 1);
    const np = this.o.map((v, i) => v + a.offset[i] * f), d = np.map((v, i) => v - this.prev[i]);
    this.entity.pos = np; this.prev = np;
    for (const r of this.scene.findByTag(a.carryTag)) {
      const dx = r.pos[0] - np[0], top = this.entity.getComponent('collider')?.data.size ?? [64, 16];
      if (Math.abs(dx) < top[0] / 2 && this.physics.isGrounded(r)) r.pos = r.pos.map((v, i) => v + d[i]);
    }
  }
}
```

</details>

<details>
<summary>Complete scripts/pickup.js</summary>

**File: `scripts/pickup.js`** (the complete file, for comparison)
```js
// @nord {"id":"gameplay.pickup","title":"Pickups & power-ups","category":"gameplay","tier":["2d","3d"],"tags":["coin","pickup","powerup","game-ready"],"requires":["trigger"],"description":"Put on collectible entities: when the player touches it, emits a global event (default 'score' + value), or applies a power-up (heal / speed / shield via entity events), plays a sound and disappears with a pop tween. Magnetises toward the player when close."}
import { NordScript } from 'nord';

export default class Pickup extends NordScript {
  static attributes = { kind: { type: 'enum', options: ['score', 'heal', 'speed', 'shield', 'xp', 'custom'], default: 'score' }, value: { type: 'number', default: 10 }, duration: { type: 'number', default: 5 }, event: { type: 'string', default: '', label: 'Custom global event' }, sfx: { type: 'asset', assetType: 'audio', default: '' }, tag: { type: 'string', default: 'player' }, magnet: { type: 'number', default: 0, label: 'Magnet radius' }, bob: { type: 'number', default: 3 } };
  start() { this.y0 = this.entity.pos[1]; this.t = this.rng.range(0, 6); this.taken = false; }
  update(dt) {
    const a = this.attrs, e = this.entity; this.t += dt;
    const p = a.magnet && this.scene.findByTag(a.tag)[0];
    if (p && Math.hypot(p.pos[0] - e.pos[0], p.pos[1] - e.pos[1]) < a.magnet) { const dx = p.pos[0] - e.pos[0], dy = p.pos[1] - e.pos[1], d = Math.hypot(dx, dy) || 1; e.pos = [e.pos[0] + (dx / d) * 220 * dt, e.pos[1] + (dy / d) * 220 * dt, e.pos[2]]; this.y0 = e.pos[1]; }
    else if (a.bob) e.pos = [e.pos[0], this.y0 + Math.sin(this.t * 4) * a.bob, e.pos[2]];
  }
  onTriggerEnter(o) {
    if (this.taken || !o.hasTag(this.attrs.tag)) return; this.taken = true; const a = this.attrs;
    if (a.kind === 'score') this.events.emit('score', a.value); else if (a.kind === 'xp') this.events.emit('xp', a.value); else if (a.kind === 'heal') o.emit('heal', { amount: a.value });
    else if (a.kind === 'speed') o.emit('apply', { type: 'haste', duration: a.duration, power: 1 }); else if (a.kind === 'shield') o.emit('shield', a.duration);
    else if (a.event) this.events.emit(a.event, o);
    if (a.sfx) this.audio.play(a.sfx); this.events.emit('pickup', { kind: a.kind, value: a.value });
    const s = { k: 1 }; this.tween(s, { k: 1.6 }, { duration: 0.12, onUpdate: () => { this.entity.scale = [s.k, s.k, s.k]; }, onComplete: () => this.entity.destroy() });
  }
}
```

</details>

<details>
<summary>Complete scripts/platformer3d.js</summary>

**File: `scripts/platformer3d.js`** (the complete file, for comparison)
```js
// @nord {"id":"controller3d.platformer","title":"3D platformer","category":"controllers","tier":["3d"],"tags":["platformer","jump","coyote"],"requires":["rigidbody","collider"],"description":"World-axis movement (works with a fixed or follow camera looking down +z): coyote time, jump buffer, variable jump height, double jump."}
import { NordScript } from 'nord';

export default class Platformer3D extends NordScript {
  static attributes = {
    speed: { type: 'number', default: 5, min: 0 }, jumpSpeed: { type: 'number', default: 8, min: 0 },
    coyote: { type: 'number', default: 0.1, min: 0 }, buffer: { type: 'number', default: 0.12, min: 0 },
    doubleJump: { type: 'bool', default: true }, cut: { type: 'number', default: 0.5, min: 0, max: 1 },
  };
  start() { this.ct = 0; this.bt = 0; this.air = 0; }
  fixedUpdate(dt) {
    const a = this.attrs, e = this.entity, g = this.physics.isGrounded(e);
    const [mx, mz] = this.input.vec('left', 'right', 'down', 'up');
    this.physics.setVelocity(e, mx * a.speed, null, mz * a.speed);
    if (mx || mz) e.rot = [0, (Math.atan2(mx, mz) * 180) / Math.PI, 0];
    this.ct = g ? a.coyote : this.ct - dt; if (g) this.air = 0;
    this.bt = this.input.pressed('jump') ? a.buffer : this.bt - dt;
    const vy = this.physics.velocity(e)[1];
    if (this.bt > 0 && (this.ct > 0 || (a.doubleJump && this.air === 1))) {
      if (this.ct <= 0) this.air = 2; else this.air = 1;
      this.physics.setVelocity(e, null, a.jumpSpeed, null); this.bt = 0; this.ct = 0;
    } else if (!g && vy > 0 && this.input.released('jump')) this.physics.setVelocity(e, null, vy * a.cut, null);
  }
}
```

</details>

<details>
<summary>Complete scripts/prism-shaders.js</summary>

**File: `scripts/prism-shaders.js`** (the complete file, for comparison)
```js
// Original GLSL. Position stays unchanged so rendered landings match colliders.
export const vertexSource = `
precision highp float;
attribute vec3 position;
attribute vec2 uv;
uniform mat4 worldViewProjection;
varying vec2 vUV;
void main() {
  vUV = uv;
  gl_Position = worldViewProjection * vec4(position, 1.0);
}`;
export const fragmentSource = `
precision highp float;
varying vec2 vUV;
uniform float uTime;
uniform float uEnergy;
uniform float uDanger;
uniform float uIntensity;
uniform float uFrequency;
void main() {
  vec2 p = vUV * uFrequency;
  vec2 cell = abs(fract(p) - 0.5);
  float line = smoothstep(0.43, 0.49, max(cell.x, cell.y));
  float wave = 0.5 + 0.5 * sin((vUV.x + vUV.y) * 18.0 - uTime * 3.0);
  vec3 cool = mix(vec3(0.04, 0.12, 0.22), vec3(0.1, 0.9, 1.0), uEnergy);
  vec3 color = mix(cool, vec3(1.0, 0.12, 0.05), uDanger);
  color *= 0.25 + line * uIntensity + wave * 0.25;
  gl_FragColor = vec4(color, 1.0);
}`;
```

</details>

<details>
<summary>Complete scripts/relay.js</summary>

**File: `scripts/relay.js`** (the complete file, for comparison)
```js
import { NordScript } from 'nord';

export default class CrystalRelay extends NordScript {
  static attributes = {
    seconds: { type: 'number', default: 100, min: 10 },
    lives: { type: 'int', default: 3, min: 1 },
    speed: { type: 'number', default: 6, min: 1 },
    sprintSpeed: { type: 'number', default: 10, min: 1 },
  };

  start() {
    this.player = this.entity;
    this.controller = this.player.scripts.find(s => 'jumpSpeed' in s.attrs);
    this.gems = this.scene.findByTag('gem').sort((a, b) => a.name.localeCompare(b.name));
    this.hazard = this.scene.find('Hazard');
    this.spawn = [...this.player.pos];
    this.next = 0;
    this.elapsed = 0;
    this.remaining = this.attrs.seconds;
    this.lives = this.attrs.lives;
    this.energy = 1;
    this.safeTime = 0;
    this.ended = false;
    this.best = this.save.get('crystal-relay.best', null);
    this.notice = 'Follow the large crystal. Hold Shift to sprint.';
    this.hud = this.ui.label('', { screen: 'relay', x: 12, y: 8, size: 16, style: { whiteSpace: 'pre-wrap', maxWidth: '95%' } });
    this.ui.button('Pause', () => this.pause(), { screen: 'relay', x: 12, y: 85 });
    this.ui.show('relay');
    this.draw();
  }

  update(dt) {
    if (this.ended) return;
    this.elapsed += dt;
    this.remaining = Math.max(0, this.remaining - dt);
    this.safeTime = Math.max(0, this.safeTime - dt);
    const sprint = this.input.down('sprint') && this.energy > 0;
    this.controller.attrs.speed = sprint ? this.attrs.sprintSpeed : this.attrs.speed;
    this.energy = Math.max(0, Math.min(1, this.energy + (sprint ? -0.45 : 0.25) * dt));
    // Move a red hazard across the middle landing in world units.
    this.hazard.pos = [3 + Math.sin(this.elapsed * 1.5) * 2, 3.3, 18];
    const p = this.player.pos;
    const distance = (a, b) => Math.hypot(...a.map((v, i) => v - b[i]));
    if (p[1] < -5 || (this.safeTime === 0 && distance(p, this.hazard.pos) < 0.9)) {
      this.respawn();
      if (this.ended) return;
    }
    // Only the next crystal can be collected; later crystals remain in the scene.
    const gem = this.gems[this.next];
    if (gem) {
      gem.scale = [1.4, 1.4, 1.4];
      if (distance(this.player.pos, gem.pos) < 1.25) this.collect(gem);
    }
    if (!this.ended && this.remaining === 0) this.finish(false, 'Time ran out');
    this.draw();
  }

  collect(gem) {
    gem.destroy();
    const platform = this.scene.find('Plat' + this.next);
    this.spawn = [platform.pos[0], platform.pos[1] + 1.5, platform.pos[2]];
    this.next++;
    this.remaining += 6;
    this.energy = 1;
    this.notice = 'Checkpoint saved. +6 seconds and full sprint energy!';
    this.audio.play('assets/audio/sfx/coin.wav');
    if (this.next === this.gems.length) this.finish(true, 'Relay complete');
  }

  respawn() {
    this.lives--;
    if (this.lives <= 0) { this.finish(false, 'No lives left'); return; }
    this.physics.teleport(this.player, ...this.spawn);
    this.physics.setVelocity(this.player, 0, 0, 0);
    this.safeTime = 2;
    this.energy = 1;
    this.notice = 'Back at your last crystal. Two seconds of hazard protection.';
  }

  draw() {
    this.hud.set(`Crystal ${this.next}/${this.gems.length} | Time ${Math.ceil(this.remaining)} | ` +
      `Lives ${this.lives} | Sprint ${Math.round(this.energy * 100)}%\n` +
      `Best ${this.best === null ? '—' : this.best.toFixed(1) + 's'} | ${this.notice}`);
  }

  pause() {
    if (this.ended || this.game.paused) return;
    this.ui.show('relay-menu');
    this.game.pause();
    this.ui.menu('relay-menu', [
      { text: 'Resume relay', onClick: () => { this.ui.clear('relay-menu'); this.game.resume(); } },
      { text: 'Restart', onClick: () => this.restart() },
    ], { x: 20, y: 150 });
  }

  finish(won, title) {
    if (this.ended) return;
    this.ended = true;
    if (won) {
      this.best = this.best === null ? this.elapsed : Math.min(this.best, this.elapsed);
      this.save.set('crystal-relay.best', this.best);
      const medal = this.elapsed < 45 ? 'Gold' : this.elapsed < 70 ? 'Silver' : 'Bronze';
      title += ` — ${medal}, ${this.elapsed.toFixed(1)}s`;
    }
    this.draw();
    this.ui.clear('relay-menu');
    this.ui.label(title, { screen: 'relay-menu', x: 20, y: 130, size: 30 });
    this.ui.menu('relay-menu', [{ text: 'Try again', onClick: () => this.restart() }], { x: 20, y: 180 });
    this.ui.show('relay-menu');
    this.game.pause();
  }

  restart() { this.game.resume(); this.game.restart(); }

  onDestroy() {
    this.controller.attrs.speed = this.attrs.speed;
    this.ui.clear('relay');
    this.ui.clear('relay-menu');
    this.game.resume();
  }
}
```

</details>

<details>
<summary>Complete scripts/spin.js</summary>

**File: `scripts/spin.js`** (the complete file, for comparison)
```js
// @nord {"id": "util.spin", "title": "Spin", "category": "utilities", "tier": ["2d", "3d"], "tags": ["rotate", "simple"], "description": "Rotates the entity continuously around one axis.", "requires": []}
// Spin — rotates the entity continuously. Works in 2D (z axis) and 3D (y axis).
import { NordScript } from 'nord';

export default class Spin extends NordScript {
  static attributes = {
    speed: { type: 'number', default: 90, label: 'Degrees / second' },
    axis: { type: 'enum', options: ['x', 'y', 'z'], default: 'z' },
  };

  update(dt) {
    const r = [...this.entity.rot];
    r[{ x: 0, y: 1, z: 2 }[this.attrs.axis]] += this.attrs.speed * dt;
    this.entity.rot = r;
  }
}
```

</details>

<details>
<summary>Complete scripts/util-sfx.js</summary>

**File: `scripts/util-sfx.js`** (the complete file, for comparison)
```js
// @nord {"id":"util.sfx-synth","title":"Procedural sfx (jsfxr-style)","category":"utilities","tier":["any"],"tags":["audio","sfx","synth","retro"],"description":"Generates retro sound effects with WebAudio, no files needed: sfx(game,'coin'|'jump'|'hit'|'laser'|'explosion'|'powerup'). Listens to global events 'sfx' (name). import { sfx } from './util-sfx.js' for direct use."}
import { NordScript } from 'nord';

const P = { coin: { w: 'square', f: [880, 1760], d: 0.18, v: 0.25 }, jump: { w: 'square', f: [260, 620], d: 0.2, v: 0.25 }, hit: { w: 'sawtooth', f: [220, 60], d: 0.18, v: 0.3 }, laser: { w: 'sawtooth', f: [1400, 200], d: 0.25, v: 0.2 }, powerup: { w: 'triangle', f: [300, 1200], d: 0.4, v: 0.3 }, explosion: { w: 'noise', f: [800, 40], d: 0.6, v: 0.4 } };
let ctx;
export function sfx(name, vol = 1) {
  const p = P[name]; if (!p) return; ctx ??= new (window.AudioContext || window.webkitAudioContext)(); const t = ctx.currentTime, g = ctx.createGain(); g.gain.setValueAtTime(p.v * vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + p.d); g.connect(ctx.destination);
  let src;
  if (p.w === 'noise') { const b = ctx.createBuffer(1, ctx.sampleRate * p.d, ctx.sampleRate), d = b.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length); src = ctx.createBufferSource(); src.buffer = b; const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.setValueAtTime(p.f[0], t); f.frequency.exponentialRampToValueAtTime(p.f[1], t + p.d); src.connect(f); f.connect(g); }
  else { src = ctx.createOscillator(); src.type = p.w; src.frequency.setValueAtTime(p.f[0], t); src.frequency.exponentialRampToValueAtTime(p.f[1], t + p.d); src.connect(g); }
  src.start(t); src.stop(t + p.d);
}

export default class SfxSynth extends NordScript {
  static attributes = { volume: { type: 'number', default: 1, min: 0, max: 1 }, map: { type: 'string', default: '{"pickup":"coin","jump":"jump","hit":"hit","explosion":"explosion","enemy:shoot":"laser"}', label: 'JSON global-event → sfx name' } };
  start() { this.offs = [this.events.on('sfx', (n) => sfx(n, this.attrs.volume)), ...Object.entries(JSON.parse(this.attrs.map)).map(([ev, n]) => this.events.on(ev, () => sfx(n, this.attrs.volume)))]; }
  onDestroy() { this.offs.forEach((o) => o()); }
}
```

</details>
