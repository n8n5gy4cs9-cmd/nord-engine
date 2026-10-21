---
title: T39 Vector Patrol — code a retro 3D rail shooter
section: Tutorials
order: 39
summary: Original Blocksmith ships, combat, boss, vertex snapping, palette dithering, ground dots and local MP3 audio; full code and assets.
---


Build an original one-level rail shooter with low-poly ships, moving ground dots, enemy waves, lasers, gates, health pickups, a roll shield, a carrier boss, two music tracks and saved scores. Then switch between a clean renderer and a 320-pixel retro shader. This is a playable Nord project with complete JavaScript, models, sound and music, not a cartridge emulator.

**Download:** [Complete Vector Patrol project and source](assets/downloads/vector-patrol-source.zip). Unzip it into a writable folder. In Nord choose **Open Project**, select its `nord.project.json`, and press **Play**. Work on a copy so you can compare your edits with the supplied solution. The project uses Nord's **3D** tier. All four GLBs and their editable Blocksmith source projects are included; creating models is optional.

![Vector Patrol in flight](assets/screenshots/ed-retro-vector-flight.png)

## 1. Play the finished level and find its code

Click **Launch patrol** to unlock browser audio. WASD or arrows steer; Space/J fires; Shift activates a short roll shield with a three-second cooldown. C switches retro/clean rendering. P or **Pause / Resume** pauses; the Restart button reloads the scene. Reach the carrier at 65 seconds and destroy it before 110 seconds. A collision costs hull, green pickups restore hull, and passing a gate rewards accurate flying. A successful run saves the best score in browser storage.

In Hierarchy select **FlightGame**. Its Script component attaches `scripts/flight.js`. Open that file in Nord's code editor; use the Console to investigate script errors. The Camera looks along positive Z. Fighter, Drone0…Drone13, Carrier and Gate0…Gate2 are ordinary model entities. Select one to inspect its GLB path, transform and imported colours. The gameplay controller moves these reusable entities rather than loading a new model per shot.

The main files divide concrete responsibilities:

| File | What you learn |
| --- | --- |
| `scripts/sim.js` | Plain JavaScript state, movement, collision, cooldowns and the boss |
| `scripts/flight.js` | NordScript lifecycle, actions, UI, save data, pause and restart |
| `scripts/view.js` | Reusable model and primitive pools, materials and cleanup |
| `scripts/retro-shader.js` | Vertex snapping, palette quantization and ordered dithering |
| `scripts/retro-audio.js` | Local file decoding, voices, music crossfades and disposal |
| `scripts/audio-config.js` | Music and SFX file paths |
| `scenes/main.scene.json` | Camera, four kinds of model and controller attachment |

**Learning check:** change the title label in `flight.js`, stop Play and start again. If the old text remains, verify you edited the opened project's file. Reopening Play loads a new script module; the in-game Restart recreates script instances but intentionally keeps imported modules cached.

## 2. Start with a simulation you can reason about

`newFlight()` returns a fresh state object. It owns hull, score, elapsed time, ship coordinates, cooldowns, bullets, enemies, pickups and boss state. `tick(state, input, dt)` advances that object and returns named sound events. It does not know about Babylon, DOM labels or audio buffers.

```js
const state = newFlight();
const events = tick(state, { x: 1, y: 0, fire: true, roll: false }, 1 / 60);
```

Open `sim.js` alongside this guide. Follow the player clamp first: the fighter moves inside a bounded rectangle, while the world travels toward it on Z. Movement uses seconds, not frames. Hold fire to emit shots at the configured interval; every bullet has its own Z coordinate and lifetime. Pooling belongs to the view, while damage belongs to the simulation.

Find the roll cooldown and shield duration. They are different timers: you cannot chain invulnerability continuously. Change the duration modestly, replay, then restore it. Notice that collisions test coordinates and radii; this rail shooter uses no physics engine. A fast arcade game does not need Havok merely because it is rendered in 3D.

## 3. Build enemy waves, gates and the carrier

Enemies spawn ahead of the player and move toward the camera. Their fire timer emits hostile shots. A hit removes hull unless the shield is active; a player bullet consumes an enemy hit point and awards score when the enemy dies. Discard expired bullets and objects behind the player so arrays remain bounded.

At 65 seconds the simulation enables a carrier with 48 hit points. It approaches the combat zone, moves across the flight corridor and fires a spread. Its defeat awards the victory bonus exactly once. The 110-second deadline prevents an endless stalled fight. On loss or victory, movement and scoring stop; the HUD remains visible for the result.

**Learning check:** temporarily lower the carrier's starting hit points to test victory, then restore 48. Temporarily set hull low to test failure. Exercise both results before judging the game finished. Do not submit scores from a rendered label: the simulation owns them.

![Carrier encounter and retro ground dots](assets/screenshots/ed-retro-vector-boss.png)

## 4. Connect the simulation to Nord

The controller extends `NordScript` and creates its state and view in `start()`:

```js
import { NordScript } from 'nord';
import { newFlight, tick } from './sim.js';

// Inside your controller:
start() {
  this.state = newFlight();
}
update(dt) {
  const [x, y] = this.input.vec('left', 'right', 'down', 'up');
  tick(this.state, { x, y, fire: this.input.down('fire'),
    roll: this.input.pressed('roll') }, dt);
}
```

This excerpt shows the connection; keep the complete supplied controller for UI, audio, rendering and saving. Project action bindings live in `nord.project.json`, so you can add another key without changing combat code. `pressed()` means one transition; `down()` means every held frame.

The view receives state and updates native model transforms. It reuses model entities and small bullet/health meshes. Ground dots form a wrapping pool along the flight corridor; their motion communicates speed even over a plain floor. Canyon cones supply landmarks and make the narrow flight rectangle readable.

Nord destroys scene entities and invokes `onDestroy()` on restart. The controller disposes its custom materials, meshes, audio and window listeners, and clears its UI screens. This matters: custom native objects and event listeners are resources you created, so your script must release them.

## 5. Use the supplied Blocksmith models, or edit your own

`assets/models/` contains fighter, drone, carrier and gate GLBs. The matching `.blocksmith.json` files contain editable Blocksmith scenes. `assets/models/previews/` contains front, side, rear and angled renders so you can compare orientation before replacing a mesh.

These are original models assembled from cube, cone and cylinder primitives through Blocksmith's actual MCP server. The installed server was tested with the requested Blocksmith executable, server script and runtime file; it exported the four GLBs and rendered four views of each. No MCP repair was required. The original games' models or ROM data are not part of this project.

To replace a ship: open its supplied Blocksmith JSON, edit the blocks, export GLB, and save it at the same `assets/models/fighter.glb` path. Keep the model centred and check its forward direction. Stop and restart Play to reload the asset. If you change units, adjust the model's scene scale and the corresponding scale in `view.js`; collision sizes remain explicit simulation values, not automatic mesh bounds.

For maintainers inside the Nord repository, `node tools/build-retro-models.mjs` rebuilds the four originals using the installed Blocksmith stdio MCP. It refuses to use a nonempty active scene. It adds its own temporary blocks, exports, then removes those blocks. Tutorial readers do not need this tool or Blocksmith installed to play the supplied project.

## 6. Understand the retro shader

Open `retro-shader.js`. The vertex shader first transforms a position into clip space. In retro mode it divides XY by W, quantizes to a grid, and multiplies by W again before assigning the final clip position. Quantization produces the small position jumps associated with low-resolution vertex precision.

```glsl
vec2 ndc = clip.xy / clip.w;
ndc = floor(ndc * snapGrid + 0.5) / snapGrid;
clip.xy = ndc * clip.w;
```

This is the principle; read the complete file below for the actual uniforms and implementation. Avoid quantizing world positions: doing so changes apparent object geometry as well as projected precision. Keep the W division to work in projected screen coordinates.

The fragment shader uses simple normal lighting, a small colour palette and a 2×2 ordered dither. `view.js` also reduces render resolution to about 320 pixels across and uses nearest-neighbour presentation. C toggles these effects together for a direct comparison. Ground dots are geometry, not noise sampled from a texture.

This combines a low-poly rail-shooter look with optional PS1-inspired vertex jitter. It is not an emulation of either console. It does not claim affine texture mapping: the supplied models use flat colours. A textured extension would need a deliberate texture-coordinate interpolation strategy, its own shader changes and new visual tests.

**Learning check:** change the palette quantization strength, then compare clean/retro mode while a drone crosses the screen. Stronger quantization should affect colour bands; changing the snap grid should affect vertex motion. Test them separately so you can see which parameter causes each effect.

## 7. Add your own MP3 music and sound effects

The project already ships original music (`vector-flight.mp3`, `vector-boss.mp3`) and local laser, explosion, crash, shield, checkpoint and victory sounds. Click Launch before expecting audio: browsers require a user gesture to unlock playback.

To use your own files, create `assets/audio/` inside this project if necessary, then copy in your MP3s. For example:

```text
vector-patrol/
  assets/audio/my-flight.mp3
  assets/audio/my-boss.mp3
  assets/audio/my-laser.mp3
  scripts/audio-config.js
```

Open `scripts/audio-config.js`. Keep the complete SFX key list and replace the desired paths:

```js
export const AUDIO = {
  music: ['assets/audio/my-flight.mp3', 'assets/audio/my-boss.mp3'],
  sfx: {
    laser: 'assets/audio/my-laser.mp3',
    explosion: 'assets/audio/explosion.mp3',
    crash: 'assets/audio/crash.mp3',
    shield: 'assets/audio/shield.mp3',
    checkpoint: 'assets/audio/checkpoint.mp3',
    win: 'assets/audio/win.mp3'
  }
};
```

Use exact case and project-relative paths, not absolute disk paths. Stop Play and start it again after replacing audio, because decoded buffers are cached during a run. Use the Console and HUD audio error text to diagnose missing files. A useful first test is to replace only the laser, launch and fire once, then change the music.

The helper decodes each path once, creates bounded sound voices, loops music and crossfades when the carrier arrives. Pause suspends the audio context; Resume resumes it. Restart disposes the old helper. MP3 encoder padding can produce a small loop seam; use a carefully trimmed WAV or OGG and change the extension in the config when seamless loops matter. Use recordings you own or have permission to distribute.

## 8. Make Restart a real scene reset

The button calls `this.game.restart()`. Nord reloads the current saved scene, constructs fresh entities and script instances, cancels the old scene's scheduled work, clears held/virtual input, resets the game clock and time scale, and resumes even if you were paused. The promise resolves after the new scene starts.

```js
await this.game.restart();
// This old controller has been destroyed. Do not continue changing its state here.
```

Use the promise from a persistent app controller when you need the returned fresh scene. A scene script can simply call it and return. Saved best scores survive because restart does not erase Save storage. By default even Persist entities reset; opt in with `restart({ preservePersistent: true })` when that is your intended rule. Module-level variables and outside servers are not scene state: keep run state in your script or `newFlight()`.

## 9. Export and verify the whole game

Use Nord's HTML export and serve the output over HTTP. The exporter includes the local models, MP3s and runtime. Test launch, firing, damage, rolling, pickups, pause, both shader modes, boss victory, loss and restart from a paused run. Restart twice to detect duplicated sounds, labels or listeners. Verify best score survives a page reload.

The original source study is recorded in the repository's `docs/RESEARCH_GAME_TUTORIALS.md`, including pinned OutRun and StarFoxSNESRecomp source paths. This project contains original code and original Nord/Blocksmith assets, with no ROM requirement.

## Complete project source

The download contains all binary assets and licences as well as the following complete text files. The guide's code blocks use the manual's local CodeMirror viewer with Copy and Wrap controls. Read a section, edit its matching project file, then compare against this complete implementation.

<!-- GENERATED GAME SOURCE: regenerate with node tools/build-code-workshops.mjs -->

### scripts/flight.js

```js
import { NordScript } from 'nord';
import { newFlight, tick } from './sim.js';
import { FlightView } from './view.js';
import { RetroAudio } from './retro-audio.js';
import { AUDIO } from './audio-config.js';
export default class Flight extends NordScript {
  start() {
    this.state = newFlight();
    this.started = false;
    this.paused = false;
    this.bossMusic = false;
    this.sound = new RetroAudio(AUDIO);
    this.view = new FlightView(this);
    this.best = this.save.get('vector-patrol.best', 0);
    this.hud = this.ui.label('', {
      screen: 'flight',
      x: 12,
      y: 8,
      size: 18,
      style: { whiteSpace: 'pre-wrap', maxWidth: '95%' },
    });
    this.ui.show('flight');
    this.ui.menu(
      'flight-menu',
      [
        { text: 'Launch patrol', onClick: () => this.launch() },
        { text: 'Mute / Unmute', onClick: () => this.sound.mute() },
      ],
      { x: 24, y: 170 },
    );
    this.ui.label(
      [
        'VECTOR PATROL',
        'One canyon. Enemy waves. A carrier at 65 seconds.',
        'WASD/arrows steer · Space/J fire · Shift roll shield',
        'C retro/clean · P pause · clear the carrier before 110s',
      ].join('\n'),
      { screen: 'flight-menu', x: 24, y: 52, size: 19 },
    );
    this.ui.show('flight-menu');
    this.pauseButton = this.ui.button('Pause / Resume', () => this.togglePause(), {
      screen: 'flight',
      x: 12,
      y: 65,
    });
    this.ui.button(
      'Restart',
      () => {
        this.game.restart();
      },
      { screen: 'flight', x: 180, y: 65 },
    );
    this.key = (e) => {
      if (e.code === 'KeyP' && !e.repeat) this.togglePause();
    };
    window.addEventListener('keydown', this.key);
    this.blur = () => {
      if (this.started && !this.paused && !this.state.won && !this.state.lost)
        this.togglePause();
    };
    window.addEventListener('blur', this.blur);
    this.draw();
  }
  async launch() {
    if (this.started) return;
    this.started = true;
    this.ui.clear('flight-menu');
    try {
      await this.sound.unlock();
      await this.sound.music(0);
    } catch (e) {
      this.sound.problem = e.message;
    }
  }
  togglePause() {
    if (!this.started || this.state.won || this.state.lost) return;
    this.paused = !this.paused;
    if (this.paused) {
      this.game.pause();
      this.sound.suspend();
      this.ui.label('PAUSED — P or Pause / Resume continues', {
        screen: 'flight-menu',
        x: 24,
        y: 170,
        size: 24,
      });
      this.ui.show('flight-menu');
    } else {
      this.ui.clear('flight-menu');
      this.game.resume();
      this.sound.resume();
    }
  }
  update(dt) {
    if (this.input.pressed('retro')) this.view.setRetro(!this.view.retro);
    if (this.started) {
      const [x, y] = this.input.vec('left', 'right', 'down', 'up');
      const events = tick(
        this.state,
        { x, y, fire: this.input.down('fire'), roll: this.input.pressed('roll') },
        dt,
      );
      for (const name of events)
        this.sound.play(name, { volume: name === 'laser' ? 0.16 : 0.5 });
      if (this.state.boss && !this.bossMusic) {
        this.bossMusic = true;
        this.sound.music(1);
      }
      if ((this.state.won || this.state.lost) && !this.finished) {
        this.finished = true;
        if (this.state.won) {
          this.best = Math.max(this.best, this.state.score);
          this.save.set('vector-patrol.best', this.best);
        }
        this.ui.label(
          this.state.won ? 'SECTOR CLEAR!' : 'PATROL LOST — Restart to retry',
          { screen: 'flight-menu', x: 24, y: 160, size: 32 },
        );
        this.ui.show('flight-menu');
      }
    }
    this.view.draw(this.state);
    this.draw();
  }
  draw() {
    const s = this.state;
    const hull = `HULL ${s.hp}  SCORE ${s.score}  TIME ${s.time.toFixed(1)}`;
    const roll = `ROLL ${s.roll.toFixed(1)}  BEST ${this.best}`;
    const target = s.boss ? 'CARRIER ' + s.bossHP + '/48' : 'Reach carrier at 65s';
    const mode = this.view.retro ? 'RETRO 320px + vertex snap' : 'CLEAN';
    const audio = this.sound.problem ? ' · Audio: ' + this.sound.problem : '';
    this.hud.set(`${hull}  ${roll}\n${target} · ${mode}${audio}`);
  }
  onDestroy() {
    window.removeEventListener('keydown', this.key);
    window.removeEventListener('blur', this.blur);
    this.view?.dispose();
    this.sound?.dispose();
    this.ui.clear('flight');
    this.ui.clear('flight-menu');
    this.game.resume();
  }
}
```

<details>
<summary>Complete assets/models/carrier.blocksmith.json</summary>

```json
{
  "version": 2,
  "projectId": "b4db28ad-c210-4dc2-8aa9-59b25e00ff92",
  "name": "Untitled project",
  "blocks": [
    {
      "visible": true,
      "locked": false,
      "group": null,
      "id": "nord-carrier-0",
      "assetId": "primitive:cube",
      "name": "Armoured spine",
      "position": [
        0,
        0,
        0
      ],
      "rotation": [
        0,
        0,
        0
      ],
      "scale": [
        2,
        1,
        6
      ],
      "color": "#626785",
      "metalness": 0,
      "roughness": 1,
      "texture": null
    },
    {
      "visible": true,
      "locked": false,
      "group": null,
      "id": "nord-carrier-1",
      "assetId": "primitive:cube",
      "name": "Bridge",
      "position": [
        0,
        0.85,
        1
      ],
      "rotation": [
        0,
        0,
        0
      ],
      "scale": [
        1.2,
        0.7,
        2
      ],
      "color": "#e0bd6b",
      "metalness": 0,
      "roughness": 1,
      "texture": null
    },
    {
      "visible": true,
      "locked": false,
      "group": null,
      "id": "nord-carrier-2",
      "assetId": "primitive:cube",
      "name": "Armour pod",
      "position": [
        -2.3,
        0,
        0
      ],
      "rotation": [
        0,
        0,
        0
      ],
      "scale": [
        2,
        1.5,
        4
      ],
      "color": "#45556d",
      "metalness": 0,
      "roughness": 1,
      "texture": null
    },
    {
      "visible": true,
      "locked": false,
      "group": null,
      "id": "nord-carrier-3",
      "assetId": "primitive:cube",
      "name": "Reactor",
      "position": [
        -2.3,
        0.1,
        -2.1
      ],
      "rotation": [
        0,
        0,
        0
      ],
      "scale": [
        1.2,
        0.7,
        0.2
      ],
      "color": "#ed5f4e",
      "metalness": 0,
      "roughness": 1,
      "texture": null
    },
    {
      "visible": true,
      "locked": false,
      "group": null,
      "id": "nord-carrier-4",
      "assetId": "primitive:cube",
      "name": "Armour pod",
      "position": [
        2.3,
        0,
        0
      ],
      "rotation": [
        0,
        0,
        0
      ],
      "scale": [
        2,
        1.5,
        4
      ],
      "color": "#45556d",
      "metalness": 0,
      "roughness": 1,
      "texture": null
    },
    {
      "visible": true,
      "locked": false,
      "group": null,
      "id": "nord-carrier-5",
      "assetId": "primitive:cube",
      "name": "Reactor",
      "position": [
        2.3,
        0.1,
        -2.1
      ],
      "rotation": [
        0,
        0,
        0
      ],
      "scale": [
        1.2,
        0.7,
        0.2
      ],
      "color": "#ed5f4e",
      "metalness": 0,
      "roughness": 1,
      "texture": null
    },
    {
      "visible": true,
      "locked": false,
      "group": null,
      "id": "nord-carrier-6",
      "assetId": "primitive:cube",
      "name": "Front shield",
      "position": [
        0,
        0,
        -3.1
      ],
      "rotation": [
        0,
        0,
        0
      ],
      "scale": [
        2,
        0.65,
        0.2
      ],
      "color": "#b94975",
      "metalness": 0,
      "roughness": 1,
      "texture": null
    }
  ],
  "assets": []
}
```

</details>

<details>
<summary>Complete assets/models/drone.blocksmith.json</summary>

```json
{
  "version": 2,
  "projectId": "b4db28ad-c210-4dc2-8aa9-59b25e00ff92",
  "name": "Untitled project",
  "blocks": [
    {
      "visible": true,
      "locked": false,
      "group": null,
      "id": "nord-drone-0",
      "assetId": "primitive:cube",
      "name": "Core",
      "position": [
        0,
        0,
        0
      ],
      "rotation": [
        0,
        0,
        0
      ],
      "scale": [
        1.3,
        0.7,
        1.2
      ],
      "color": "#bf525b",
      "metalness": 0,
      "roughness": 1,
      "texture": null
    },
    {
      "visible": true,
      "locked": false,
      "group": null,
      "id": "nord-drone-1",
      "assetId": "primitive:cube",
      "name": "Eye",
      "position": [
        0,
        0.1,
        -0.7
      ],
      "rotation": [
        0,
        0,
        0
      ],
      "scale": [
        0.6,
        0.25,
        0.15
      ],
      "color": "#ffca51",
      "metalness": 0,
      "roughness": 1,
      "texture": null
    },
    {
      "visible": true,
      "locked": false,
      "group": null,
      "id": "nord-drone-2",
      "assetId": "primitive:cube",
      "name": "Blade",
      "position": [
        -1,
        0,
        0.15
      ],
      "rotation": [
        0,
        -25,
        0
      ],
      "scale": [
        1.4,
        0.16,
        1.7
      ],
      "color": "#644b7b",
      "metalness": 0,
      "roughness": 1,
      "texture": null
    },
    {
      "visible": true,
      "locked": false,
      "group": null,
      "id": "nord-drone-3",
      "assetId": "primitive:cube",
      "name": "Blade",
      "position": [
        1,
        0,
        0.15
      ],
      "rotation": [
        0,
        25,
        0
      ],
      "scale": [
        1.4,
        0.16,
        1.7
      ],
      "color": "#644b7b",
      "metalness": 0,
      "roughness": 1,
      "texture": null
    }
  ],
  "assets": []
}
```

</details>

<details>
<summary>Complete assets/models/fighter.blocksmith.json</summary>

```json
{
  "version": 2,
  "projectId": "b4db28ad-c210-4dc2-8aa9-59b25e00ff92",
  "name": "Untitled project",
  "blocks": [
    {
      "visible": true,
      "locked": false,
      "group": null,
      "id": "nord-fighter-0",
      "assetId": "primitive:cube",
      "name": "Hull",
      "position": [
        0,
        0,
        0
      ],
      "rotation": [
        0,
        0,
        0
      ],
      "scale": [
        1.1,
        0.55,
        3.4
      ],
      "color": "#c9d9df",
      "metalness": 0,
      "roughness": 1,
      "texture": null
    },
    {
      "visible": true,
      "locked": false,
      "group": null,
      "id": "nord-fighter-1",
      "assetId": "primitive:cone",
      "name": "Nose",
      "position": [
        0,
        0,
        2
      ],
      "rotation": [
        90,
        0,
        0
      ],
      "scale": [
        0.65,
        1.6,
        0.65
      ],
      "color": "#e3eaf0",
      "metalness": 0,
      "roughness": 1,
      "texture": null
    },
    {
      "visible": true,
      "locked": false,
      "group": null,
      "id": "nord-fighter-2",
      "assetId": "primitive:cube",
      "name": "Canopy",
      "position": [
        0,
        0.45,
        0.5
      ],
      "rotation": [
        0,
        0,
        0
      ],
      "scale": [
        0.7,
        0.45,
        1.3
      ],
      "color": "#168fba",
      "metalness": 0,
      "roughness": 1,
      "texture": null
    },
    {
      "visible": true,
      "locked": false,
      "group": null,
      "id": "nord-fighter-3",
      "assetId": "primitive:cube",
      "name": "Left wing",
      "position": [
        -1.7,
        -0.05,
        -0.3
      ],
      "rotation": [
        0,
        22,
        0
      ],
      "scale": [
        2.6,
        0.14,
        1.3
      ],
      "color": "#dce6df",
      "metalness": 0,
      "roughness": 1,
      "texture": null
    },
    {
      "visible": true,
      "locked": false,
      "group": null,
      "id": "nord-fighter-4",
      "assetId": "primitive:cube",
      "name": "Right wing",
      "position": [
        1.7,
        -0.05,
        -0.3
      ],
      "rotation": [
        0,
        -22,
        0
      ],
      "scale": [
        2.6,
        0.14,
        1.3
      ],
      "color": "#dce6df",
      "metalness": 0,
      "roughness": 1,
      "texture": null
    },
    {
      "visible": true,
      "locked": false,
      "group": null,
      "id": "nord-fighter-5",
      "assetId": "primitive:cube",
      "name": "Fin",
      "position": [
        0,
        0.65,
        -1.1
      ],
      "rotation": [
        0,
        0,
        0
      ],
      "scale": [
        0.16,
        0.9,
        0.9
      ],
      "color": "#29bca3",
      "metalness": 0,
      "roughness": 1,
      "texture": null
    },
    {
      "visible": true,
      "locked": false,
      "group": null,
      "id": "nord-fighter-6",
      "assetId": "primitive:cylinder",
      "name": "Engine",
      "position": [
        -0.65,
        0,
        -1.8
      ],
      "rotation": [
        90,
        0,
        0
      ],
      "scale": [
        0.45,
        0.7,
        0.45
      ],
      "color": "#ff9b42",
      "metalness": 0,
      "roughness": 1,
      "texture": null
    },
    {
      "visible": true,
      "locked": false,
      "group": null,
      "id": "nord-fighter-7",
      "assetId": "primitive:cylinder",
      "name": "Engine",
      "position": [
        0.65,
        0,
        -1.8
      ],
      "rotation": [
        90,
        0,
        0
      ],
      "scale": [
        0.45,
        0.7,
        0.45
      ],
      "color": "#ff9b42",
      "metalness": 0,
      "roughness": 1,
      "texture": null
    }
  ],
  "assets": []
}
```

</details>

<details>
<summary>Complete assets/models/gate.blocksmith.json</summary>

```json
{
  "version": 2,
  "projectId": "b4db28ad-c210-4dc2-8aa9-59b25e00ff92",
  "name": "Untitled project",
  "blocks": [
    {
      "visible": true,
      "locked": false,
      "group": null,
      "id": "nord-gate-0",
      "assetId": "primitive:cube",
      "name": "Pylon",
      "position": [
        -4,
        0,
        0
      ],
      "rotation": [
        0,
        0,
        0
      ],
      "scale": [
        1,
        8,
        1.5
      ],
      "color": "#69768a",
      "metalness": 0,
      "roughness": 1,
      "texture": null
    },
    {
      "visible": true,
      "locked": false,
      "group": null,
      "id": "nord-gate-1",
      "assetId": "primitive:cube",
      "name": "Pylon",
      "position": [
        4,
        0,
        0
      ],
      "rotation": [
        0,
        0,
        0
      ],
      "scale": [
        1,
        8,
        1.5
      ],
      "color": "#69768a",
      "metalness": 0,
      "roughness": 1,
      "texture": null
    },
    {
      "visible": true,
      "locked": false,
      "group": null,
      "id": "nord-gate-2",
      "assetId": "primitive:cube",
      "name": "Crossbar",
      "position": [
        0,
        4,
        0
      ],
      "rotation": [
        0,
        0,
        0
      ],
      "scale": [
        9,
        1,
        1.5
      ],
      "color": "#a9b4c3",
      "metalness": 0,
      "roughness": 1,
      "texture": null
    },
    {
      "visible": true,
      "locked": false,
      "group": null,
      "id": "nord-gate-3",
      "assetId": "primitive:cube",
      "name": "Lamp",
      "position": [
        -2,
        3.6,
        -0.8
      ],
      "rotation": [
        0,
        0,
        0
      ],
      "scale": [
        0.6,
        0.2,
        0.15
      ],
      "color": "#34e6b4",
      "metalness": 0,
      "roughness": 1,
      "texture": null
    },
    {
      "visible": true,
      "locked": false,
      "group": null,
      "id": "nord-gate-4",
      "assetId": "primitive:cube",
      "name": "Lamp",
      "position": [
        0,
        3.6,
        -0.8
      ],
      "rotation": [
        0,
        0,
        0
      ],
      "scale": [
        0.6,
        0.2,
        0.15
      ],
      "color": "#34e6b4",
      "metalness": 0,
      "roughness": 1,
      "texture": null
    },
    {
      "visible": true,
      "locked": false,
      "group": null,
      "id": "nord-gate-5",
      "assetId": "primitive:cube",
      "name": "Lamp",
      "position": [
        2,
        3.6,
        -0.8
      ],
      "rotation": [
        0,
        0,
        0
      ],
      "scale": [
        0.6,
        0.2,
        0.15
      ],
      "color": "#34e6b4",
      "metalness": 0,
      "roughness": 1,
      "texture": null
    }
  ],
  "assets": []
}
```

</details>

<details>
<summary>Complete index.html</summary>

```html
<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Vector Patrol — retro rail shooter</title>
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

```json
{
  "format": 1,
  "name": "Vector Patrol",
  "id": "com.crowelian.vectorpatrol",
  "type": "3d",
  "engineVersion": "0.1.0",
  "startScene": "scenes/main.scene.json",
  "display": {
    "width": 960,
    "height": 540,
    "scale": "fit",
    "pixelArt": true,
    "background": "#163d57"
  },
  "physics": {
    "engine": "none",
    "gravity": [
      0,
      0,
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
      "fire": [
        "Space",
        "KeyJ"
      ],
      "roll": [
        "ShiftLeft",
        "ShiftRight"
      ],
      "retro": [
        "KeyC"
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

```json
{
  "format": 1,
  "name": "main",
  "settings": {},
  "entities": [
    {
      "id": "eeeeee25",
      "name": "Camera",
      "enabled": true,
      "tags": [],
      "layer": 0,
      "transform": {
        "pos": [
          0,
          2,
          -18
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
          "type": "camera",
          "fov": 65,
          "near": 0.1,
          "far": 450
        }
      ],
      "scripts": [],
      "children": [],
      "prefab": null
    },
    {
      "id": "eeeeee26",
      "name": "Fighter",
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
          0.75,
          0.75,
          0.75
        ]
      },
      "components": [
        {
          "type": "model",
          "path": "assets/models/fighter.glb",
          "unique": true
        }
      ],
      "scripts": [],
      "children": [],
      "prefab": null
    },
    {
      "id": "eeeeee27",
      "name": "Drone0",
      "enabled": true,
      "tags": [],
      "layer": 0,
      "transform": {
        "pos": [
          0,
          0,
          140
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
          "type": "model",
          "path": "assets/models/drone.glb",
          "unique": true
        }
      ],
      "scripts": [],
      "children": [],
      "prefab": null
    },
    {
      "id": "eeeeee28",
      "name": "Drone1",
      "enabled": true,
      "tags": [],
      "layer": 0,
      "transform": {
        "pos": [
          0,
          0,
          140
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
          "type": "model",
          "path": "assets/models/drone.glb",
          "unique": true
        }
      ],
      "scripts": [],
      "children": [],
      "prefab": null
    },
    {
      "id": "eeeeee29",
      "name": "Drone2",
      "enabled": true,
      "tags": [],
      "layer": 0,
      "transform": {
        "pos": [
          0,
          0,
          140
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
          "type": "model",
          "path": "assets/models/drone.glb",
          "unique": true
        }
      ],
      "scripts": [],
      "children": [],
      "prefab": null
    },
    {
      "id": "eeeeee2a",
      "name": "Drone3",
      "enabled": true,
      "tags": [],
      "layer": 0,
      "transform": {
        "pos": [
          0,
          0,
          140
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
          "type": "model",
          "path": "assets/models/drone.glb",
          "unique": true
        }
      ],
      "scripts": [],
      "children": [],
      "prefab": null
    },
    {
      "id": "eeeeee2b",
      "name": "Drone4",
      "enabled": true,
      "tags": [],
      "layer": 0,
      "transform": {
        "pos": [
          0,
          0,
          140
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
          "type": "model",
          "path": "assets/models/drone.glb",
          "unique": true
        }
      ],
      "scripts": [],
      "children": [],
      "prefab": null
    },
    {
      "id": "eeeeee2c",
      "name": "Drone5",
      "enabled": true,
      "tags": [],
      "layer": 0,
      "transform": {
        "pos": [
          0,
          0,
          140
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
          "type": "model",
          "path": "assets/models/drone.glb",
          "unique": true
        }
      ],
      "scripts": [],
      "children": [],
      "prefab": null
    },
    {
      "id": "eeeeee2d",
      "name": "Drone6",
      "enabled": true,
      "tags": [],
      "layer": 0,
      "transform": {
        "pos": [
          0,
          0,
          140
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
          "type": "model",
          "path": "assets/models/drone.glb",
          "unique": true
        }
      ],
      "scripts": [],
      "children": [],
      "prefab": null
    },
    {
      "id": "eeeeee2e",
      "name": "Drone7",
      "enabled": true,
      "tags": [],
      "layer": 0,
      "transform": {
        "pos": [
          0,
          0,
          140
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
          "type": "model",
          "path": "assets/models/drone.glb",
          "unique": true
        }
      ],
      "scripts": [],
      "children": [],
      "prefab": null
    },
    {
      "id": "eeeeee2f",
      "name": "Drone8",
      "enabled": true,
      "tags": [],
      "layer": 0,
      "transform": {
        "pos": [
          0,
          0,
          140
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
          "type": "model",
          "path": "assets/models/drone.glb",
          "unique": true
        }
      ],
      "scripts": [],
      "children": [],
      "prefab": null
    },
    {
      "id": "eeeeee2g",
      "name": "Drone9",
      "enabled": true,
      "tags": [],
      "layer": 0,
      "transform": {
        "pos": [
          0,
          0,
          140
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
          "type": "model",
          "path": "assets/models/drone.glb",
          "unique": true
        }
      ],
      "scripts": [],
      "children": [],
      "prefab": null
    },
    {
      "id": "eeeeee2h",
      "name": "Drone10",
      "enabled": true,
      "tags": [],
      "layer": 0,
      "transform": {
        "pos": [
          0,
          0,
          140
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
          "type": "model",
          "path": "assets/models/drone.glb",
          "unique": true
        }
      ],
      "scripts": [],
      "children": [],
      "prefab": null
    },
    {
      "id": "eeeeee2i",
      "name": "Drone11",
      "enabled": true,
      "tags": [],
      "layer": 0,
      "transform": {
        "pos": [
          0,
          0,
          140
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
          "type": "model",
          "path": "assets/models/drone.glb",
          "unique": true
        }
      ],
      "scripts": [],
      "children": [],
      "prefab": null
    },
    {
      "id": "eeeeee2j",
      "name": "Drone12",
      "enabled": true,
      "tags": [],
      "layer": 0,
      "transform": {
        "pos": [
          0,
          0,
          140
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
          "type": "model",
          "path": "assets/models/drone.glb",
          "unique": true
        }
      ],
      "scripts": [],
      "children": [],
      "prefab": null
    },
    {
      "id": "eeeeee2k",
      "name": "Drone13",
      "enabled": true,
      "tags": [],
      "layer": 0,
      "transform": {
        "pos": [
          0,
          0,
          140
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
          "type": "model",
          "path": "assets/models/drone.glb",
          "unique": true
        }
      ],
      "scripts": [],
      "children": [],
      "prefab": null
    },
    {
      "id": "eeeeee2l",
      "name": "Carrier",
      "enabled": true,
      "tags": [],
      "layer": 0,
      "transform": {
        "pos": [
          0,
          0,
          130
        ],
        "rot": [
          0,
          0,
          0
        ],
        "scale": [
          3.5,
          3.5,
          3.5
        ]
      },
      "components": [
        {
          "type": "model",
          "path": "assets/models/carrier.glb",
          "unique": true
        }
      ],
      "scripts": [],
      "children": [],
      "prefab": null
    },
    {
      "id": "eeeeee2m",
      "name": "Gate0",
      "enabled": true,
      "tags": [],
      "layer": 0,
      "transform": {
        "pos": [
          0,
          0,
          150
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
          "type": "model",
          "path": "assets/models/gate.glb",
          "unique": true
        }
      ],
      "scripts": [],
      "children": [],
      "prefab": null
    },
    {
      "id": "eeeeee2n",
      "name": "Gate1",
      "enabled": true,
      "tags": [],
      "layer": 0,
      "transform": {
        "pos": [
          0,
          0,
          150
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
          "type": "model",
          "path": "assets/models/gate.glb",
          "unique": true
        }
      ],
      "scripts": [],
      "children": [],
      "prefab": null
    },
    {
      "id": "eeeeee2o",
      "name": "Gate2",
      "enabled": true,
      "tags": [],
      "layer": 0,
      "transform": {
        "pos": [
          0,
          0,
          150
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
          "type": "model",
          "path": "assets/models/gate.glb",
          "unique": true
        }
      ],
      "scripts": [],
      "children": [],
      "prefab": null
    },
    {
      "id": "eeeeee2p",
      "name": "FlightGame",
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
          "path": "scripts/flight.js",
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
<summary>Complete scripts/audio-config.js</summary>

```js
export const AUDIO = {
  music: ['assets/audio/vector-flight.mp3', 'assets/audio/vector-boss.mp3'],
  sfx: {
    laser: 'assets/audio/laser.mp3',
    explosion: 'assets/audio/explosion.mp3',
    crash: 'assets/audio/crash.mp3',
    shield: 'assets/audio/shield.mp3',
    checkpoint: 'assets/audio/checkpoint.mp3',
    win: 'assets/audio/win.mp3',
  },
};
```

</details>

<details>
<summary>Complete scripts/mk.js</summary>

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
<summary>Complete scripts/retro-audio.js</summary>

```js
// Local MP3/WAV/OGG files, decoded on first user activation. No external service.
export class RetroAudio {
  constructor(config) {
    this.config = config;
    this.cache = new Map();
    this.voices = new Set();
    this.problem = '';
    this.muted = false;
  }
  async unlock() {
    this.ctx ??= new AudioContext();
    if (!this.master) {
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.55;
      this.master.connect(this.ctx.destination);
    }
    await this.ctx.resume();
  }
  async load(path) {
    if (!this.cache.has(path))
      this.cache.set(
        path,
        (async () => {
          const response = await fetch(path);
          if (!response.ok) throw Error(`${path}: HTTP ${response.status}`);
          return this.ctx.decodeAudioData(await response.arrayBuffer());
        })(),
      );
    return this.cache.get(path);
  }
  async voice(path, { volume = 0.5, loop = false, rate = 1 } = {}) {
    if (!this.ctx) return null;
    try {
      const buffer = await this.load(path);
      if (this.voices.size > 24 && !loop) return null;
      const source = this.ctx.createBufferSource(),
        gain = this.ctx.createGain();
      source.buffer = buffer;
      source.loop = loop;
      source.playbackRate.value = rate;
      gain.gain.value = volume;
      source.connect(gain);
      gain.connect(this.master);
      const voice = { source, gain };
      this.voices.add(voice);
      source.onended = () => {
        this.voices.delete(voice);
        source.disconnect();
        gain.disconnect();
      };
      source.start();
      return voice;
    } catch (error) {
      this.problem = error.message;
      console.warn('[retro audio]', error);
      return null;
    }
  }
  play(name, options = {}) {
    const path = this.config.sfx[name];
    return path ? this.voice(path, options) : Promise.resolve(null);
  }
  async music(index = 0) {
    const old = this.song,
      next = await this.voice(this.config.music[index % this.config.music.length], {
        loop: true,
        volume: 0,
      });
    if (!next) return;
    this.song = next;
    next.gain.gain.linearRampToValueAtTime(0.4, this.ctx.currentTime + 0.4);
    if (old) {
      old.gain.gain.linearRampToValueAtTime(0, this.ctx.currentTime + 0.4);
      old.source.stop(this.ctx.currentTime + 0.45);
    }
  }
  mute() {
    this.muted = !this.muted;
    if (this.master) this.master.gain.gain.value = this.muted ? 0 : 0.55;
    return this.muted;
  }
  suspend() {
    if (this.ctx?.state === 'running') return this.ctx.suspend();
  }
  resume() {
    if (this.ctx?.state === 'suspended') return this.ctx.resume();
  }
  async dispose() {
    if (this.ctx) await this.ctx.close();
    this.voices.clear();
  }
}
```

</details>

<details>
<summary>Complete scripts/retro-shader.js</summary>

```js
// Snap in projected space so the grid follows the screen, rather than world units.
export const vertexSource = `
precision highp float;
attribute vec3 position;
attribute vec3 normal;
uniform mat4 worldViewProjection;
uniform mat4 world;
uniform float uRetro;
uniform vec2 uGrid;
varying vec3 vNormal;

void main() {
  vec4 clip = worldViewProjection * vec4(position, 1.0);
  vec2 projected = clip.xy / clip.w;
  vec2 snapped = floor(projected * uGrid + 0.5) / uGrid;
  clip.xy = mix(clip.xy, snapped * clip.w, uRetro);
  gl_Position = clip;
  vNormal = normalize(mat3(world) * normal);
}
`;

// A 2×2 ordered dither offsets the sixteen-level colour quantization.
export const fragmentSource = `
precision highp float;
uniform vec3 uColor;
uniform float uRetro;
varying vec3 vNormal;

void main() {
  vec3 lightDirection = normalize(vec3(-0.4, 0.8, -0.5));
  float light = 0.45 + 0.55 * max(dot(normalize(vNormal), lightDirection), 0.0);
  vec3 color = uColor * light;
  vec2 pixel = mod(floor(gl_FragCoord.xy), 2.0);
  float dither = (pixel.x + pixel.y * 2.0) / 4.0 - 0.375;
  vec3 quantized = floor(
    clamp(color + dither / 15.0, 0.0, 1.0) * 15.0 + 0.5
  ) / 15.0;
  gl_FragColor = vec4(mix(color, quantized, uRetro), 1.0);
}
`;
```

</details>

<details>
<summary>Complete scripts/sim.js</summary>

```js
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export function newFlight() {
  return {
    time: 0,
    distance: 0,
    x: 0,
    y: 0,
    hp: 100,
    score: 0,
    roll: 0,
    shield: 0,
    fire: 0,
    spawn: 0,
    gate: 18,
    cell: 8,
    bossHP: 48,
    bossZ: 130,
    bossFire: 1,
    boss: false,
    won: false,
    lost: false,
    enemies: [],
    shots: [],
    hostile: [],
    gates: [],
    cells: [],
    serial: 0,
  };
}
export function tick(s, input, dt) {
  if (s.won || s.lost) return [];
  dt = Math.min(0.05, dt);
  const events = [];
  s.time += dt;
  s.distance += 22 * dt;
  s.x = clamp(s.x + input.x * 12 * dt, -9, 9);
  s.y = clamp(s.y + input.y * 9 * dt, -4.4, 5.2);
  s.roll = Math.max(0, s.roll - dt);
  s.shield = Math.max(0, s.shield - dt);
  s.fire -= dt;
  s.spawn -= dt;
  s.gate -= dt;
  s.cell -= dt;
  if (input.roll && s.roll === 0) {
    s.roll = 3;
    s.shield = 0.75;
    events.push('shield');
  }
  if (input.fire && s.fire <= 0) {
    s.fire = 0.16;
    s.shots.push({ x: s.x, y: s.y, z: 3 });
    events.push('laser');
  }
  if (s.time < 63 && s.spawn <= 0) {
    s.spawn = Math.max(0.7, 2 - s.time / 70);
    const id = s.serial++;
    s.enemies.push({
      id,
      x: Math.sin(id * 2.3) * 7,
      y: Math.cos(id * 1.7) * 3,
      z: 130,
      hp: 2,
      fire: 1.5 + (id % 3) * 0.3,
    });
  }
  if (s.gate <= 0 && s.time < 65) {
    s.gate = 12;
    s.gates.push({ x: Math.sin(s.serial) * 3, y: 0, z: 150 });
  }
  if (s.cell <= 0 && s.time < 65) {
    s.cell = 11;
    s.cells.push({ x: Math.sin(s.time) * 5, y: Math.cos(s.time) * 2, z: 110 });
  }
  const damage = (n) => {
    if (s.shield > 0 || s.won || s.lost) return;
    s.hp = Math.max(0, s.hp - n);
    s.shield = 1.2;
    events.push('crash');
    if (s.hp === 0) s.lost = true;
  };
  for (const e of s.enemies) {
    e.z -= 24 * dt;
    e.fire -= dt;
    if (e.fire <= 0 && e.z > 10) {
      e.fire = 2.8;
      s.hostile.push({
        x: e.x,
        y: e.y,
        z: e.z,
        vx: (s.x - e.x) * 0.3,
        vy: (s.y - e.y) * 0.3,
      });
    }
    if (Math.abs(e.z) < 2 && Math.hypot(e.x - s.x, e.y - s.y) < 2) {
      damage(18);
      e.hp = 0;
    }
  }
  if (s.time >= 65) {
    s.boss = true;
    s.bossZ = Math.max(48, s.bossZ - 14 * dt);
    s.bossFire -= dt;
    if (s.bossFire <= 0) {
      s.bossFire = 1;
      for (let i = -2; i <= 2; i++)
        s.hostile.push({
          x: i * 2,
          y: Math.sin(s.time) * 2,
          z: s.bossZ,
          vx: i * 0.8,
          vy: 0,
        });
    }
  }
  for (const shot of s.shots) {
    shot.z += 110 * dt;
    for (const e of s.enemies)
      if (
        e.hp > 0 &&
        Math.abs(shot.z - e.z) < 4 &&
        Math.hypot(shot.x - e.x, shot.y - e.y) < 1.7
      ) {
        e.hp--;
        shot.z = 999;
        if (e.hp === 0) {
          s.score += 100;
          events.push('explosion');
        }
        break;
      }
    if (
      !s.won &&
      !s.lost &&
      s.boss &&
      Math.abs(shot.z - s.bossZ) < 5 &&
      Math.abs(shot.x) < 5 &&
      Math.abs(shot.y) < 2.6
    ) {
      s.bossHP--;
      shot.z = 999;
      events.push('checkpoint');
      if (s.bossHP <= 0) {
        s.won = true;
        s.score += 2500;
        events.push('win');
      }
    }
  }
  for (const bullet of s.hostile) {
    bullet.z -= 46 * dt;
    bullet.x += bullet.vx * dt;
    bullet.y += bullet.vy * dt;
    if (Math.abs(bullet.z) < 2 && Math.hypot(bullet.x - s.x, bullet.y - s.y) < 1) {
      damage(12);
      bullet.z = -20;
    }
  }
  for (const gate of s.gates) {
    gate.z -= 22 * dt;
    if (Math.abs(gate.z) < 1 && !gate.passed) {
      gate.passed = true;
      if (Math.abs(s.x - gate.x) > 3 || Math.abs(s.y) > 2.8) damage(24);
      else {
        s.score += 150;
        events.push('checkpoint');
      }
    }
  }
  for (const cell of s.cells) {
    cell.z -= 22 * dt;
    if (Math.abs(cell.z) < 2 && Math.hypot(cell.x - s.x, cell.y - s.y) < 1.7) {
      cell.z = -20;
      s.hp = Math.min(100, s.hp + 20);
      s.score += 50;
      events.push('shield');
    }
  }
  s.enemies = s.enemies.filter((e) => e.hp > 0 && e.z > -8);
  s.shots = s.shots.filter((b) => b.z < 180);
  s.hostile = s.hostile.filter((b) => b.z > -10);
  s.gates = s.gates.filter((g) => g.z > -10);
  s.cells = s.cells.filter((c) => c.z > -10);
  if (s.time >= 110 && !s.won) s.lost = true;
  return events;
}
```

</details>

<details>
<summary>Complete scripts/view.js</summary>

```js
import { vertexSource, fragmentSource } from './retro-shader.js';
export class FlightView {
  constructor(script) {
    this.script = script;
    this.game = script.game;
    const b = this.game.backend;
    this.B = b.B;
    this.scene = b.scene;
    this.engine = b.engine;
    this.canvas = b.canvas;
    this.materials = new Map();
    this.originals = [];
    this.retro = true;
    this.visuals = [];
    for (const entity of script.scene.all())
      for (const mesh of entity.__meshes ?? []) {
        if (!mesh.getTotalVertices?.()) continue;
        const old = mesh.material,
          color = old?.albedoColor ?? old?.diffuseColor ?? this.B.Color3.White(),
          key = color.toHexString();
        let mat = this.materials.get(key);
        if (!mat) {
          mat = new this.B.ShaderMaterial(
            'retro-' + key,
            this.scene,
            { vertexSource, fragmentSource },
            {
              attributes: ['position', 'normal'],
              uniforms: ['worldViewProjection', 'world', 'uColor', 'uRetro', 'uGrid'],
            },
          );
          mat.setColor3('uColor', color);
          this.materials.set(key, mat);
        }
        this.originals.push([mesh, old]);
        mesh.material = mat;
      }
    this.player = script.scene.find('Fighter');
    this.carrier = script.scene.find('Carrier');
    this.drones = Array.from({ length: 14 }, (_, i) => script.scene.find('Drone' + i));
    this.gates = Array.from({ length: 3 }, (_, i) => script.scene.find('Gate' + i));
    const material = (name, color) => {
      const m = new this.B.StandardMaterial(name, this.scene);
      m.disableLighting = true;
      m.emissiveColor = this.B.Color3.FromHexString(color);
      return m;
    };
    this.green = material('player laser', '#6affbc');
    this.red = material('hostile laser', '#ff765a');
    this.dot = material('ground dot', '#4b9995');
    this.gold = material('energy cell', '#f8df75');
    const pool = (count, kind, mat, size) =>
      Array.from({ length: count }, (_, i) => {
        const mesh = this.B.MeshBuilder.CreateBox(
          kind + i,
          { width: size, height: size, depth: kind === 'shot' ? 1.6 : size },
          this.scene,
        );
        mesh.material = mat;
        this.visuals.push(mesh);
        return mesh;
      });
    this.shots = pool(40, 'shot', this.green, 0.12);
    this.hostile = pool(60, 'hostile', this.red, 0.28);
    this.cells = pool(6, 'cell', this.gold, 0.7);
    this.dots = pool(200, 'dot', this.dot, 0.14);
    this.terrain = new this.B.StandardMaterial('canyon', this.scene);
    this.terrain.diffuseColor = this.B.Color3.FromHexString('#28625d');
    this.terrain.specularColor = this.B.Color3.Black();
    this.ground = this.B.MeshBuilder.CreateGround(
      'canyon floor',
      { width: 300, height: 500 },
      this.scene,
    );
    this.ground.position.set(0, -5.7, 190);
    this.ground.material = this.terrain;
    this.visuals.push(this.ground);
    this.mountains = Array.from({ length: 18 }, (_, i) => {
      const m = this.B.MeshBuilder.CreateCylinder(
        'canyon ridge' + i,
        {
          diameterTop: 0,
          diameterBottom: 18 + (i % 3) * 7,
          height: 12 + (i % 4) * 4,
          tessellation: 4,
        },
        this.scene,
      );
      m.material = this.terrain;
      this.visuals.push(m);
      return m;
    });
    this.light = new this.B.HemisphericLight(
      'canyon light',
      new this.B.Vector3(-0.6, 1, -0.4),
      this.scene,
    );
    this.light.intensity = 0.95;
    this.scene.activeCamera.setTarget(new this.B.Vector3(0, 0, 40));
    this.setRetro(true);
  }
  setRetro(on) {
    this.retro = on;
    this.engine.setHardwareScalingLevel(
      on ? Math.max(1, this.canvas.clientWidth / 320) : 1,
    );
    this.canvas.style.imageRendering = on ? 'pixelated' : 'auto';
    for (const m of this.materials.values()) {
      m.setFloat('uRetro', on ? 1 : 0);
      m.setVector2(
        'uGrid',
        new this.B.Vector2(
          this.engine.getRenderWidth() / 2,
          this.engine.getRenderHeight() / 2,
        ),
      );
    }
  }
  draw(s) {
    this.player.pos = [s.x, s.y, 0];
    this.player.rot = [0, 0, s.roll > 2.25 ? ((3 - s.roll) / 0.75) * 360 : -s.x * 3];
    this.player.scale = s.shield > 0 ? [1.25, 1.25, 1.25] : [1.2, 1.2, 1.2];
    const entities = (pool, items, fn) =>
      pool.forEach((e, i) => {
        e.enabled = i < items.length;
        if (e.enabled) {
          e.pos = [items[i].x ?? 0, items[i].y ?? 0, items[i].z];
          fn?.(e, items[i]);
        }
      });
    entities(
      this.drones,
      s.enemies.slice(0, 14),
      (e, v) => (e.rot = [0, 0, Math.sin(s.time + v.id) * 12]),
    );
    entities(this.gates, s.gates);
    this.carrier.enabled = s.boss && !s.won;
    this.carrier.pos = [0, 0, s.bossZ];
    this.carrier.rot = [0, 0, 0];
    const native = (pool, items) =>
      pool.forEach((m, i) => {
        m.setEnabled(i < items.length);
        if (i < items.length) m.position.set(items[i].x, items[i].y, items[i].z);
      });
    native(this.shots, s.shots);
    native(this.hostile, s.hostile);
    native(this.cells, s.cells);
    this.dots.forEach((m, i) =>
      m.position.set(
        ((i % 10) - 4.5) * 8,
        -5.5,
        12 + Math.floor(i / 10) * 10 - (s.distance % 10),
      ),
    );
    this.mountains.forEach((m, i) =>
      m.position.set(
        (i % 2 ? -1 : 1) * (25 + (i % 3) * 5),
        0,
        20 + Math.floor(i / 2) * 28 - (s.distance % 28),
      ),
    );
  }
  dispose() {
    for (const [mesh, mat] of this.originals) if (!mesh.isDisposed()) mesh.material = mat;
    for (const m of this.materials.values()) m.dispose();
    for (const m of this.visuals) m.dispose();
    for (const m of [this.green, this.red, this.dot, this.gold]) m.dispose();
    this.terrain.dispose();
    this.light.dispose();
    this.engine.setHardwareScalingLevel(1);
  }
}
```

</details>
