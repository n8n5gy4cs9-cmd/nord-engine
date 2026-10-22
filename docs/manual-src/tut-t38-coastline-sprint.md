---
title: T38 Coastline Sprint — code an Amiga racer with two-player split-screen
section: Tutorials
order: 38
summary: Build a complete one-course pseudo-3D racer using the supplied Amiga Lotus-style cars: keyboard solo, keyboard/gamepad split-screen, traffic, nitro, checkpoints, MP3 music and SFX. All source and assets included.
---

Build **Coastline Sprint**, a complete arcade road-racing game: accelerate down a rolling coast, steer through curves, dodge traffic, manage nitro and reach the finish before the clock expires. Two checkpoints add time. Play solo on the keyboard, or race a friend in top/bottom split-screen: **player one uses the keyboard and player two uses a gamepad**.

The reference request was ZgzInfinity/OutRun. This tutorial uses the same broad pseudo-3D racing idea, but its playable code is original Nord JavaScript, extended from Nord's own Amiga Showcase. It does not require SFML, an arcade ROM or the reference game's files. The supplied red/white sports cars and roadside sprites are Nord's original Amiga collection. There is one shared course, not an unfinished menu leading to placeholder races.

**Allow two to three hours.** [Download the complete Coastline Sprint project](assets/downloads/coastline-sprint-source.zip). It includes all code, car/scenery sheets and metadata, two original music tracks and five SFX. A standard gamepad is needed only for player two. Hardware gamepad behavior still needs testing with your particular controller/browser; the automated split-screen checks use a synthetic standard pad.

<figure class="shot"><img src="assets/screenshots/ed-retro-coast-split.png" alt="Coastline Sprint top/bottom split-screen with independent red and white Amiga cars" loading="lazy"><figcaption>One course, two drivers and two cameras. The red car is keyboard player one; the white car is gamepad player two.</figcaption></figure>

**Full-code learning route:** After the orientation below, continue to [the complete file-by-file walkthrough](#file-walkthrough). It teaches every main project file in consecutive sections, with the actual code, an explanation of what and why, and a change to try. The expandable complete files at the end are a reference, not the lesson.

## Start here: build it yourself, from an empty project {#build-from-scratch}

The sections after this one explain the finished game. **This section is the route from nothing to a running game.** Follow it first, top to bottom. The download is only for comparing when something breaks.

<p><span class="f">orange</span> = a file name · <span class="v">green</span> = a variable or function · <span class="k">purple</span> = a setting or key word · <span class="ui">blue</span> = a button or menu in Nord.</p>

### Step 1 — Create the project (which template?)

On the Welcome screen choose <span class="ui">New project</span>. Fill in:

```text
Project name : my-coastline-sprint
Location     : (any writable folder, e.g. your Documents)
Project type : HTML-lite        <-- pick this one
```

Pick <span class="ui">HTML-lite</span> ("Plain HTML/JS page with the tiny nord-lite runtime"). **Do not** pick 2D game, 3D game or the Rust/WASM types, and do not use anything from <span class="ui">Starter templates</span>. Coastline Sprint draws the road itself on a canvas with plain JavaScript, so it needs no scene, no Phaser and no Babylon. Press <span class="ui">Create project</span>.

Nord makes this folder:

```text
my-coastline-sprint/
  nord.project.json   <- project settings, leave it alone
  index.html          <- placeholder page, you replace it in Step 3
  scenes/ scripts/    <- empty, this game does not use them
  assets/
```

### Step 2 — Add the folders and empty files

All code files live **directly in the project folder**, next to <span class="f">index.html</span>, not in scripts/. Open Terminal, go into your project folder and run:

```sh
cd path/to/my-coastline-sprint
mkdir -p assets/sprites assets/audio ui lib
touch track.js render.js app.js audio-config.js audio.js
```

(Or make the same files in Finder.) In Nord open the <span class="ui">Assets</span> panel and refresh it. Double-click a file to open it in the code editor. Save with Cmd+S.

Now unzip the [download](assets/downloads/coastline-sprint-source.zip) somewhere else and **copy these things** into your project (art and sound are not code you type):

| Copy this from the zip | Into your project |
|---|---|
| <span class="f">assets/sprites/</span> (4 files: the car and roadside PNGs + meta) | <span class="f">assets/sprites/</span> |
| <span class="f">assets/audio/</span> (7 MP3 files) | <span class="f">assets/audio/</span> |
| <span class="f">audio.js</span> (92-line sound helper) | replace your empty <span class="f">audio.js</span> |
| <span class="f">lib/nord-ui.js</span> (the Nord UI runtime, a copy of <span class="f">runtime/core/uiscene.js</span>) | <span class="f">lib/nord-ui.js</span> |

You will read <span class="f">audio.js</span> later in the walkthrough, but you do not need to type it to get a working game.

### Step 3 — Replace index.html

Open <span class="f">index.html</span>, delete everything, and paste this whole file. It loads <span class="f">app.js</span> and calls its <span class="v">mount()</span> function:

```html
<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Coastline Sprint</title>
<style>html,body{margin:0;height:100%;background:#2e3440}#app{height:100vh}</style></head>
<body><div id="app"></div>
<script type="module">
import { mount } from './app.js';
try { await mount(document.getElementById('app')); window.__nord_ready = true; } catch (e) { console.error(e); window.__nord_error = String(e); }
</script></body></html>
```

### Step 4 — track.js: the rules (the code you asked about)

Open <span class="f">track.js</span>. **The very first lines of this file** are the <span class="v">COURSE</span> block:

```js
export const COURSE = {
  length: 180000,
  limit: 65,
  checkpoints: [60000, 120000],
  bonus: 18,
  maxSpeed: 4800,
};
```

| Word | Meaning |
|---|---|
| <span class="k">length</span> | course length in road units (the finish line) |
| <span class="k">limit</span> | starting time in seconds |
| <span class="k">checkpoints</span> | the two distances where you get time back |
| <span class="k">bonus</span> | seconds added at each checkpoint |
| <span class="k">maxSpeed</span> | top speed without nitro |

<span class="k">export</span> makes <span class="v">COURSE</span> usable from the other files with <span class="k">import</span>. Save. Then keep typing the rest of the file **in the order below**. Each part opens in the walkthrough with the exact code to paste *below the previous part*:

| Part | Adds | Walkthrough |
|---|---|---|
| 1.1 | <span class="v">clamp</span>, <span class="v">curve</span>, <span class="v">hill</span> (the road shape) | [1.1](#walk-track-js) |
| 1.2 | <span class="v">driver()</span> — one car's state | 1.2 |
| 1.3 | <span class="v">traffic()</span> — the other cars | 1.3 |
| 1.4 | <span class="v">updateDriver()</span> — speed and steering | 1.4 |
| 1.5–1.6 | sounds, collisions, checkpoints, finish | 1.5, 1.6 |
| 1.7 | <span class="v">padInput()</span> — gamepad to intent | 1.7 |

Note: part 1.1 repeats the <span class="v">COURSE</span> block above. Paste 1.1 *instead of* typing COURSE twice. Stop when <span class="f">track.js</span> ends with <span class="v">padInput</span>.

### Step 5 — render.js: the picture

Same method: open <span class="f">render.js</span> and paste parts [2.1 to 2.6](#walk-render-js) one after another. Order: background → road samples → road strips → sprite crop → depth sorting → car + HUD. It exports <span class="v">drawView</span>, which <span class="f">app.js</span> imports.

### Step 6 — audio-config.js: paste whole

This tiny file only lists sound file names. Paste it all:

```js
export const AUDIO = {
  music: ['assets/audio/coast-drive.mp3', 'assets/audio/coast-night.mp3'],
  sfx: {
    engine: 'assets/audio/engine.mp3',
    crash: 'assets/audio/crash.mp3',
    skid: 'assets/audio/skid.mp3',
    checkpoint: 'assets/audio/checkpoint.mp3',
    win: 'assets/audio/win.mp3',
  },
};
```

### Step 7 — Design the menu, then connect everything

**The menu is not code.** Open the <span class="ui">UI Designer</span> tab (Window menu), type <span class="f">ui/menu.ui.json</span> in the file box and press <span class="ui">New</span>. Build the screen visually: add an <span class="k">hbox</span> anchored to the top with five <span class="k">button</span> nodes and a <span class="k">select</span> (give each button an *Action* name: <span class="v">one</span>, <span class="v">two</span>, <span class="v">pause</span>, <span class="v">restart</span>, <span class="v">mute</span>), a <span class="k">label</span> named <span class="v">notice</span> anchored to the bottom with the text <span class="v">{notice}</span>, and a centred <span class="k">vbox</span> named <span class="v">overlay</span> holding two labels named <span class="v">ovTitle</span> and <span class="v">ovBody</span>. Save. Or copy the finished <span class="f">ui/menu.ui.json</span> from the zip and open it in the Designer to see how it is built; the file is explained in [part 4](#walk-ui-menu-ui-json).

Now <span class="f">app.js</span>, the largest code file. Paste parts [3.1 to 3.9](#walk-app-js) in order. It builds a tiny page frame, loads the UI file, loads the images, runs the game loop and draws one or two views. It first imports the other files, so make sure they exist and are saved.

### Step 8 — Play

Press <span class="ui">Play</span> in Nord's toolbar. Click <span class="ui">1 player</span>. If the screen is blank, open the <span class="ui">Console</span> panel: the first red line names the file and line to fix. The usual causes are a mistyped file name in an <span class="k">import</span>, a missing <span class="f">ui/menu.ui.json</span> or <span class="f">lib/nord-ui.js</span>, or an asset in the wrong folder.

<figure class="shot"><img src="assets/screenshots/ed-retro-coast-solo.png" alt="Coastline Sprint solo race, the result of this build" loading="lazy"><figcaption>What you should see after Step 8: sky, curving coast road, traffic, your car and the HUD.</figcaption></figure>

<figure class="shot"><img src="assets/screenshots/ed-retro-coast-split.png" alt="Two-player split screen" loading="lazy"><figcaption>Choose <b>2 player split</b> with a gamepad connected for this view.</figcaption></figure>

**If you are stuck:** compare your file with the same-named file in the download or the *Complete game source* at the end of this page.


## 1. Open and run the finished project

Extract the zip into a writable folder and open its nord.project.json in Nord. Press Play, then choose **1 player**. W/Up accelerates, S/Down brakes, A/D or Left/Right steer and Shift uses nitro. P or the Pause/Resume button pauses; Restart starts a fresh race. Choose either music track from the dropdown. Mute affects both music and SFX.

For a browser preview from the project parent folder:

```sh
nord serve coastline-sprint
```

Open the printed local URL. Click a start button to unlock browser audio. If you hear nothing, check Mute, your system output and the status line below the canvas. Missing audio files produce a visible error there instead of pretending to play.

For split-screen, connect a gamepad, press one of its buttons so the browser exposes it, then choose **2 player split**. The left stick steers, RT or A accelerates, LT or B brakes, and X uses nitro. The first connected pad belongs to P2. P1 remains keyboard-controlled. Disconnecting that pad pauses both views; reconnect it and choose Pause/Resume to continue.

**Checkpoint:** accelerate in solo, stop, then start split-screen. Keyboard input must not move the white car. Gamepad input must not move the red car.

## 2. Know which file owns each decision

| File | Responsibility |
|---|---|
| app.js | Nord HTML entry point, reactions to UI actions, loop, mode, pause, audio and split layout |
| ui/menu.ui.json | All menus and text, edited in the UI Designer |
| lib/nord-ui.js | The Nord UI runtime that builds menu.ui.json (library, not taught line by line) |
| track.js | Course data, driver state, input mapping and pure game rules |
| render.js | Road projection, scenery, traffic, car sprite frames and per-view HUD |
| audio.js | WebAudio unlock, decode/cache, voices, crossfade, mute and pause |
| audio-config.js | Music/SFX filenames you can replace |
| assets/sprites/ | Supplied car and roadside PNG sheets with metadata |
| assets/audio/ | Supplied original MP3 files |

This is Nord's **HTML tier**. It exports mount(root), which the generated index.html calls. There is no Scene-tab entity to attach it to; open the files in Assets/code editor, save, and restart Play. JavaScript modules separate rules from presentation without adding a framework.

For a coding-from-starter path, create an HTML project, add the listed files and copy the supplied asset folders. Keep the generated index entry importing mount from app.js. Follow the sections below, then use the complete source at the end to assemble the exact final files.

## 3. Define a finite course and independent drivers

The central course settings are deliberately small:

```js
export const COURSE = {
  length: 180000,
  limit: 65,
  checkpoints: [60000, 120000],
  bonus: 18,
  maxSpeed: 4800,
};
```

Distances are game-world units, not real metres. The HUD's KM/H is an arcade display conversion, not a vehicle simulation. curve(z) supplies horizontal bend and hill(z) supplies elevation. Both are smooth functions of progress, so the two players see the same course at different positions without storing duplicate maps.

`driver(index)` returns a **new object** containing lateral position x, distance z, speed, timer, nitro, checkpoint index, collision cooldown and result flags. Calling it twice matters: using the same object in both array entries would make steering one car move both.

The two drivers start slightly apart. They share traffic and the road but do not ram each other; the rival is a visible racing ghost. This keeps the tutorial's head-to-head race about driving rather than collision arbitration.

**Exercise:** lower maxSpeed and predict whether you must increase the time allowance. Change just one setting first, then Play the full course.

## 4. Turn inputs into movement, not pixels

updateDriver takes one driver, one input object, dt and the traffic list. A representative input is:

```js
{ steer: -0.5, accel: 1, brake: 0, boost: false }
```

The rules do not care whether that came from a keyboard or pad. steer is minus one to one; accel/brake are zero to one. dt is seconds. Acceleration, braking and coasting alter speed, then speed times dt advances distance.

```js
p.speed = clamp(p.speed +
  (input.accel * 2400 - input.brake * 4200 - 500) * dt,
  0, COURSE.maxSpeed * (boost ? 1.3 : 1));
p.z += p.speed * dt;
```

The final function also adds curve drift, clamps lateral bounds and slows off-road travel. Nitro drains while boosting and slowly recharges otherwise. It is a temporary speed advantage, not a toggle that makes the car permanently faster.

Return **events** such as crash, skid, checkpoint and win instead of playing sound inside the rules. That makes the same pure function easy to test and lets the app choose how a crash sounds. It also prevents a unit test from needing an AudioContext.

**Checkpoint:** release throttle and the car coasts down. Steer off the road and speed falls. Use nitro and its meter decreases, then recovers after release.

## 5. Project the road and draw back to front

The road is a sequence of projected strips, not a 3D engine scene. For a strip ahead of the player:

```js
const scale = 0.85 / distanceAhead;
const screenX = width / 2 + relativeWorldX * scale * width / 2;
const screenY = horizon + relativeHeight * scale * height / 2;
const halfWidth = roadWidth * scale * width / 2;
```

Farther geometry has a smaller scale. Camera-relative height makes hills rise or fall on screen. The renderer accumulates the curve into a lateral road centre, then draws four-point polygons between adjacent strips. Rumble strips are slightly wider than the road. Alternating world-distance bands make lane markings move with travel.

Draw distant strips first, near strips last. Then sort scenery/traffic by distance and draw far-to-near sprites. This painter-style ordering is enough for this compact course; it is not a general renderer for arbitrary bridges, intersections or overpasses.

The player car stays near the screen centre while road/camera offset reflects its lane. The renderer crops 64×40 cells from racing-cars.png: red left/back/right/front in the first row, white poses in the second. Steering chooses a discrete rear pose; it does not cycle all frames as a walk animation.

```js
g.drawImage(sheet, frame % 4 * 64, Math.floor(frame / 4) * 40,
  64, 40, destinationX, destinationY, width, height);
```

Set imageSmoothingEnabled=false so scaling preserves the pixels. The roadside sheet has eight 64×96 cells. PNG metadata ships with the project so users can inspect/reuse the sheets in other Nord projects too.

<figure class="shot"><img src="assets/screenshots/ed-retro-coast-curve.png" alt="The same coast course viewed farther into its curved, hilly section" loading="lazy"><figcaption>Elevation and curvature come from track functions. The art is supplied; you do not need to generate a new car before following the tutorial.</figcaption></figure>

## 6. Add traffic, collision grace and a real finish

Traffic positions/speeds are generated deterministically and advance once per frame, **not once per viewport**. Calling the traffic update inside each camera draw would make split-screen traffic move twice as fast as solo.

A collision requires close forward distance and close lane position. It reduces speed, counts a hit and starts a cooldown. The cooldown prevents a single overlapping traffic car from generating dozens of crashes and sound effects in adjacent frames.

Each checkpoint is awarded once by comparing the driver's checkpoint index and distance. It adds eighteen seconds and emits checkpoint. Finish is a fixed distance; running out of time sets lost. Once a driver has finished/lost, updateDriver returns without changing that run.

In split-screen one player can finish while the other continues. Each view displays its own finish time or timeout. The race enters the overall result state only when both drivers have a result. There is no second level hidden behind the finish.

**Checkpoint:** test a crash, pass both checkpoints, finish and Restart. Verify that Restart resets timers, traffic, nitro and result flags rather than leaving a finished driver in the new run.

## 7. Map a standard gamepad and split the canvas

padInput reads axis zero and standard buttons, applies a dead zone, then produces the same input shape as the keyboard:

```js
const axis = pad?.axes?.[0] ?? 0;
const steer = Math.abs(axis) > 0.14 ? axis : 0;
const accel = Math.max(button(7), button(0));
const brake = Math.max(button(6), button(1));
```

Optional chaining handles missing devices; nullish coalescing supplies zero. A dead zone removes small stick drift. Button values can be analog, so RT/LT allow partial throttle/braking. Controller layouts vary; inspect navigator.getGamepads in the browser when adapting a non-standard pad.

The app updates all driver states, then renders each into a clipped region:

```js
const viewHeight = canvas.height / mode;
g.save();
g.rect(0, playerIndex * viewHeight, canvas.width, viewHeight);
g.clip();
g.translate(0, playerIndex * viewHeight);
drawView(g, player, cars, players, images, canvas.width, viewHeight);
g.restore();
```

A clip stops one viewport drawing over the other. Translation lets the same drawView use local coordinates. Save/restore is essential: without it, transforms accumulate and the lower view drifts off the canvas.

Pause belongs to the **whole race**, not one driver. Browser focus loss clears held keys and pauses. Pad disconnect also pauses both; the resume button refuses to resume split-screen while the pad is missing. This avoids giving the keyboard player a free win while P2's input has disappeared.

## 8. Understand the supplied music and SFX

The archive contains two original tracks, coast-drive.mp3 and coast-night.mp3, plus engine.mp3, skid.mp3, crash.mp3, checkpoint.mp3 and win.mp3. These are actual local files. The engine sound loops with playback rate tied to speed; crash/checkpoint/win are one-shots. The track selector crossfades music.

Audio starts from the start-button gesture because browsers may block autoplay. The helper creates an AudioContext, fetches each file, decodes it and caches its Promise. A decoded buffer can be reused for many sound voices without refetching every collision.

```js
const response = await fetch(path);
if (!response.ok) throw Error(`${path}: HTTP ${response.status}`);
const buffer = await context.decodeAudioData(await response.arrayBuffer());
```

A gain node controls each voice; a master gain controls mute. The helper records a visible problem if a file fails. Pausing suspends the audio context as well as the race simulation. Music and engine nodes should not be recreated every animation frame.

## 9. Add your own MP3 music and SFX with code

Put your files **inside this project's assets/audio folder**, for example:

```text
coastline-sprint/
  assets/audio/my-summer-drive.mp3
  assets/audio/my-crash.mp3
```

Open audio-config.js and change only the intended paths:

```js
export const AUDIO = {
  music: ['assets/audio/my-summer-drive.mp3', 'assets/audio/coast-night.mp3'],
  sfx: {
    engine: 'assets/audio/engine.mp3',
    crash: 'assets/audio/my-crash.mp3',
    skid: 'assets/audio/skid.mp3',
    checkpoint: 'assets/audio/checkpoint.mp3',
    win: 'assets/audio/win.mp3',
  },
};
```

These are project-relative URL paths with forward slashes, not desktop file paths. Keep the sfx keys: game events use those names. To change a track's displayed name, edit its option text in app.js. To add a third track, add both a music-array path and a matching dropdown option.

Save the config and restart Play to clear cached decoded audio. Then start a race and test a collision. Finally rebuild/export and test that copy. A filename typo or uppercase/lowercase mismatch may work differently on another host; keep names simple and consistent.

The helper also accepts browser-supported WAV/OGG. MP3 is convenient but may add encoder padding, so use a carefully trimmed WAV/OGG if you need a tighter engine loop. Keep one-shot SFX short; a full song used as crash.mp3 will play on every crash. Change each call's volume option or the master gain to balance loud files.

Original audio can be regenerated in the engine with `python3 tools/gen_assets.py retro-audio` using Python with numpy/Pillow and ffmpeg. The source download already includes the generated files, so tutorial readers do not need that toolchain unless regenerating them.

## 10. Test and export your finished racer

Test solo and split separately. Check steering, throttle release, nitro recharge, collision cooldown, checkpoints, independent timers, pause, pad disconnect/reconnect, both result states, Restart, music change and mute. A connected pad in one browser does not prove a different controller/OS layout works.

From the project parent folder:

```sh
nord check coastline-sprint
nord build coastline-sprint --target html --out coast-web --zip
python3 -m http.server 8004 --directory coast-web
```

Open the exported copy, click a start button and test both views there. Upload the whole folder or zip with index.html at the root. All art, audio and code are local; no separate server is required for this racer beyond ordinary static hosting.

**Extensions:** tune one corner, change the checkpoint spacing, add a lap record, add an explicit gamepad selector, or replace one sprite sheet while retaining its frame contract. Keep traffic updates outside the viewport loop and input/state separate from drawing.

<!-- GENERATED FILE WALKTHROUGH -->

## Walk through every project file {#file-walkthrough}

Work through these files in order using your downloaded project in Nord. Each numbered part shows the **next consecutive lines** of that file, not a selection of highlights. Read the explanation before changing anything. Edit the existing code in place; do not append another copy of a function. Finish one experiment, observe its result, and undo that change before moving on. The complete files and download at the end remain your reference.

The walkthrough covers the app/game modules, shared helpers used by them, page, styles and project configuration. Binary art/audio/models and minified vendor dependencies are resources rather than lessons in their internal implementation; their paths and contracts are explained where the app uses them.

| File | What you will build or understand |
| --- | --- |
| [track.js](#walk-track-js) | Build every rule before connecting it to graphics: course, fresh drivers, traffic, movement, results and pad mapping. |
| [render.js](#walk-render-js) | Turn the simulation into a pseudo-3D picture, including every projection, sprite and HUD step. |
| [app.js](#walk-app-js) | Wire the whole racer together: a tiny page frame, the UI file, resources, intent, state changes, simulation loop and independent viewports. |
| [ui/menu.ui.json](#walk-ui-menu-ui-json) | Describe the whole menu as data: layout containers, buttons, a select, text with placeholders and the intro card. The UI Designer edits this file. |
| [audio.js](#walk-audio-js) | Build the complete local-audio helper: activation, cached decoding, voices, crossfade and cleanup. |
| [audio-config.js](#walk-audio-config-js) | Choose recordings through data rather than hardcoded paths in gameplay. |
| [index.html](#walk-index-html) | Read the complete Nord page entry point and its failure path. |
| [nord.project.json](#walk-nord-project-json) | Read every project field that tells Nord which host, display and services to use. |
| [assets/sprites/racing-cars.png.meta.json](#walk-assets-sprites-racing-cars-png-meta-json) | Read the supplied sprite sidecar used by Nord’s asset tools. |
| [assets/sprites/roadside.png.meta.json](#walk-assets-sprites-roadside-png-meta-json) | Read the supplied sprite sidecar used by Nord’s asset tools. |

### 1. track.js {#walk-track-js}

Build every rule before connecting it to graphics: course, fresh drivers, traffic, movement, results and pad mapping.

#### 1.1 — Course units and a reusable clamp

**Read:** `track.js`, lines 1–13.

<!-- taught-source: coastline-sprint/track.js:1-13 -->

```js
export const COURSE = {
  length: 180000,
  limit: 65,
  checkpoints: [60000, 120000],
  bonus: 18,
  maxSpeed: 4800,
};
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export function curve(z) {
  const t = z / COURSE.length;
  return t < 0.12 ? 0 : Math.sin(z / 8500) * 0.65 * (t > 0.9 ? 0.3 : 1);
}
export const hill = (z) => Math.sin(z / 12000) * 450 + Math.sin(z / 4700) * 90;
```

**What and why:** length and checkpoint distances use arbitrary road units; limit and bonus use seconds. clamp confines a value to a closed interval, which is useful for speed, nitro and steering position. curve uses normalized course progress to keep the opening straight and soften the final bends; hill combines two waves so elevation is not a single repetitive slope. These are sampled functions, not meshes.

**Try it / expected result:** Change limit from 65 to 10 and restart. You should lose sooner, while the road length and checkpoint positions remain unchanged; then restore 65.

#### 1.2 — Create independent drivers

**Read:** `track.js`, lines 14–30.

<!-- taught-source: coastline-sprint/track.js:14-30 -->

```js
export function driver(index = 0) {
  return {
    index,
    x: index ? 0.3 : -0.3,
    z: 0,
    speed: 0,
    time: COURSE.limit,
    elapsed: 0,
    nitro: 1,
    checkpoint: 0,
    hits: 0,
    cooldown: 0,
    finished: false,
    lost: false,
    steer: 0,
  };
}
```

**What and why:** Each call returns a new mutable object. x is across the road, z is progress along it, and speed is road units per second. elapsed measures the result time while time counts down. index selects controls and car colour. Nitro, checkpoint and collision timers belong to each player, preventing P2 activity from draining P1 resources.

**Try it / expected result:** Start split play and compare both timers/nitro displays. Accelerate only P2; P1 progress should stay independent.

#### 1.3 — Seed opponents without updating them twice

**Read:** `track.js`, lines 31–45.

<!-- taught-source: coastline-sprint/track.js:31-45 -->

```js
export const traffic = () =>
  Array.from({ length: 24 }, (_, i) => ({
    id: i,
    z: 7000 + i * 6900,
    x: [-0.64, 0, 0.64][i % 3],
    speed: 1350 + (i % 4) * 210,
  }));
export function updateDriver(p, input, dt, cars) {
  if (p.finished || p.lost) return [];
  dt = Math.min(dt, 0.05);
  const events = [];
  p.elapsed += dt;
  p.time = Math.max(0, p.time - dt);
  p.cooldown = Math.max(0, p.cooldown - dt);
  p.skid = Math.max(0, (p.skid ?? 0) - dt);
```

**What and why:** The factory creates 24 fresh traffic records with alternating lanes and a small set of speeds. updateDriver exits for a driver whose result is final, caps an unusually long frame, advances the two clocks and decays cooldowns toward zero. The app will move traffic once per frame, outside the per-player loop.

**Try it / expected result:** Restart twice and confirm traffic returns to its opening positions. Duplicating the traffic update inside each viewport would make split-screen traffic twice as fast.

#### 1.4 — Integrate speed and steering in seconds

**Read:** `track.js`, lines 46–59.

<!-- taught-source: coastline-sprint/track.js:46-59 -->

```js
  const boost = input.boost && p.nitro > 0 && input.accel > 0;
  p.nitro = clamp(p.nitro + (boost ? -0.4 : 0.14) * dt, 0, 1);
  p.speed = clamp(
    p.speed + (input.accel * 2400 - input.brake * 4200 - 500) * dt,
    0,
    COURSE.maxSpeed * (boost ? 1.3 : 1),
  );
  p.steer = input.steer;
  p.x +=
    input.steer * dt * (0.5 + p.speed / COURSE.maxSpeed) * 1.25 -
    ((curve(p.z) * p.speed) / COURSE.maxSpeed) * dt * 0.7;
  p.x = clamp(p.x, -1.8, 1.8);
  if (Math.abs(p.x) > 1.05) p.speed = Math.max(0, p.speed - 3200 * dt);
  if (
```

**What and why:** boost is a condition, not a stored second timer. Nitro drains while boosting and refills otherwise, with clamp keeping it between zero and one. Speed integrates throttle, braking and coasting drag using dt. The lateral expression combines player steering with outward curve drift. The off-road branch subtracts speed and clamps to zero, so grass cannot accelerate a stationary car.

**Try it / expected result:** Change the coasting term 500 to 1000. Release throttle on a straight and observe faster deceleration, then restore it.

#### 1.5 — Throttle repeated sound and collision responses

**Read:** `track.js`, lines 60–77.

<!-- taught-source: coastline-sprint/track.js:60-77 -->

```js
    p.skid === 0 &&
    p.speed > 1800 &&
    ((input.brake > 0.2 && Math.abs(input.steer) > 0.4) || Math.abs(p.x) > 1.15)
  ) {
    p.skid = 0.8;
    events.push('skid');
  }
  p.z += p.speed * dt;
  if (p.cooldown === 0)
    for (const car of cars)
      if (Math.abs(car.z - p.z) < 500 && Math.abs(car.x - p.x) < 0.23) {
        p.speed *= 0.3;
        p.cooldown = 1.4;
        p.hits++;
        events.push('crash');
        break;
      }
  if (
```

**What and why:** This continues the if condition opened immediately above. Skid requires speed and hard turning/braking or an off-road position; its timer prevents a sound on every frame. Progress then advances by speed times dt. Collision uses independent forward and lateral distance thresholds. The 1.4-second cooldown stops one overlapping traffic car from registering dozens of impacts.

**Try it / expected result:** Drive into traffic and watch HITS. It should increase once, not once per rendered frame. Reducing the cooldown is an intentional difficulty change, not a rendering change.

#### 1.6 — Consume checkpoints and finish once

**Read:** `track.js`, lines 78–94.

<!-- taught-source: coastline-sprint/track.js:78-94 -->

```js
    p.checkpoint < COURSE.checkpoints.length &&
    p.z >= COURSE.checkpoints[p.checkpoint]
  ) {
    p.checkpoint++;
    p.time += COURSE.bonus;
    events.push('checkpoint');
  }
  if (p.z >= COURSE.length) {
    p.z = COURSE.length;
    p.finished = true;
    events.push('win');
  } else if (p.time === 0) {
    p.lost = true;
    events.push('crash');
  }
  return events;
}
```

**What and why:** The checkpoint condition continues the preceding if. The index points to the next unclaimed checkpoint; incrementing it is what prevents repeated time bonuses. Reaching the course end clamps progress and sets finished; only otherwise can the zero-time branch set lost. Returning event names keeps audio outside these rules.

**Try it / expected result:** Pass one checkpoint slowly. The bonus should be awarded once even though you remain beyond its distance on later frames.

#### 1.7 — Translate hardware into game intent

**Read:** `track.js`, lines 95–104.

<!-- taught-source: coastline-sprint/track.js:95-104 -->

```js
export function padInput(pad) {
  const button = (i) => pad?.buttons?.[i]?.value ?? 0;
  const axis = pad?.axes?.[0] ?? 0;
  return {
    steer: Math.abs(axis) > 0.14 ? axis : 0,
    accel: Math.max(button(7), button(0)),
    brake: Math.max(button(6), button(1)),
    boost: button(2) > 0.5,
  };
}
```

**What and why:** Optional chaining makes a missing pad safe. The helper reads analog values for triggers/buttons, applies a dead zone to the stick, and returns the same steer/accel/brake/boost shape as keyboard input. Math.max allows either a trigger or a face button to request throttle. The simulation therefore does not need a special gamepad movement path.

**Try it / expected result:** Gently move the stick near centre. Small noise should be ignored; a larger motion should steer continuously. Hardware mappings still need checking on your controller.


### 2. render.js {#walk-render-js}

Turn the simulation into a pseudo-3D picture, including every projection, sprite and HUD step.

#### 2.1 — Paint a background in viewport coordinates

**Read:** `render.js`, lines 1–18.

<!-- taught-source: coastline-sprint/render.js:1-18 -->

```js
// Extended from Nord's own Amiga Showcase road/sprite presentation.
import { curve, hill, COURSE } from './track.js';
export function drawView(g, p, cars, others, images, w, h) {
  const horizon = h * 0.36;
  g.fillStyle = '#82bbce';
  g.fillRect(0, 0, w, h);
  g.fillStyle = '#eac48d';
  g.fillRect(0, horizon * 0.65, w, h * 0.2);
  g.fillStyle = '#657e86';
  g.beginPath();
  g.moveTo(0, horizon);
  for (let x = 0; x <= w; x += 20)
    g.lineTo(x, horizon - 18 - Math.sin(x * 0.02 + p.z * 0.00005) * 12);
  g.lineTo(w, horizon + 30);
  g.lineTo(0, horizon + 30);
  g.fill();
  g.fillStyle = '#487650';
  g.fillRect(0, horizon, w, h - horizon);
```

**What and why:** The renderer receives w and h instead of reading the full canvas size, so the same function works in a half-height view. Background layers overwrite the viewport every frame. A sine ridge gives a cheap skyline; its tiny progress-dependent phase makes the horizon react as you travel. None of these pixels changes the road collision rules.

**Try it / expected result:** Temporarily change the sky colour. Both split-screen views should change without affecting handling.

#### 2.2 — Project many road samples

**Read:** `render.js`, lines 19–36.

<!-- taught-source: coastline-sprint/render.js:19-36 -->

```js
  const SEG = 200,
    road = 2000,
    points = [];
  let x = 0,
    dx = 0;
  for (let i = 1; i <= 180; i++) {
    const z = p.z + i * SEG;
    dx += curve(z);
    x += dx;
    const scale = 0.85 / (i * SEG);
    points.push({
      z,
      scale,
      x: w / 2 + ((x - p.x * road) * scale * w) / 2,
      y: horizon + ((hill(p.z) + 950 - hill(z)) * scale * h) / 2,
      half: (road * scale * w) / 2,
    });
  }
```

**What and why:** SEG is longitudinal spacing and road is half-width in world-like units. dx accumulates curvature and x accumulates that change again, bending the road smoothly across depth. The reciprocal scale makes far samples smaller. The projected centre subtracts player lateral position, while projected height compares the local hill with the distant hill. Each point stores enough information for road and roadside objects to agree.

**Try it / expected result:** Change 180 samples to 90. The visible horizon distance shrinks; this does not shorten the course.

#### 2.3 — Join neighbouring samples into strips

**Read:** `render.js`, lines 37–61.

<!-- taught-source: coastline-sprint/render.js:37-61 -->

```js
  const quad = (a, b, ratio, color) => {
    g.fillStyle = color;
    g.beginPath();
    g.moveTo(a.x - a.half * ratio, a.y);
    g.lineTo(a.x + a.half * ratio, a.y);
    g.lineTo(b.x + b.half * ratio, b.y);
    g.lineTo(b.x - b.half * ratio, b.y);
    g.closePath();
    g.fill();
  };
  for (let i = points.length - 2; i >= 0; i--) {
    const a = points[i],
      b = points[i + 1];
    if (b.y >= a.y || b.y > h) continue;
    const stripe = Math.floor(a.z / 1200) % 2;
    quad(a, b, 1.08, stripe ? '#eee0c4' : '#9a4e45');
    quad(a, b, 1, stripe ? '#444750' : '#4c4e56');
    if (stripe) {
      for (const lane of [-0.33, 0.33]) {
        const aa = { ...a, x: a.x + a.half * lane, half: a.half * 0.014 },
          bb = { ...b, x: b.x + b.half * lane, half: b.half * 0.014 };
        quad(aa, bb, 1, '#d7d5bb');
      }
    }
  }
```

**What and why:** A quad connects two projected cross-sections. ratio widens or narrows the same geometry for shoulders, asphalt and lane paint. The loop runs far to near so closer strips cover distant ones. It skips folded/offscreen sections, alternates stripe colours by world distance, and makes thin lane quads by copying points with smaller widths.

**Try it / expected result:** Reverse the loop on a temporary copy and look for near/far overlap errors. Restore the far-to-near order before continuing.

#### 2.4 — Crop one sprite cell and anchor its feet

**Read:** `render.js`, lines 62–75.

<!-- taught-source: coastline-sprint/render.js:62-75 -->

```js
  const sprite = (image, frame, fw, fh, cols, cx, cy, sw, sh) => {
    g.imageSmoothingEnabled = false;
    g.drawImage(
      image,
      (frame % cols) * fw,
      Math.floor(frame / cols) * fh,
      fw,
      fh,
      Math.round(cx - sw / 2),
      Math.round(cy - sh),
      Math.round(sw),
      Math.round(sh),
    );
  };
```

**What and why:** drawImage receives a source rectangle followed by a destination rectangle. Modulo selects the sheet column, integer division selects its row, and fw/fh are cell dimensions. The destination subtracts half width and full height so cx/cy is the object base, not its top-left. Rounding and disabling smoothing preserve the supplied pixel art.

**Try it / expected result:** Choose a different player frame temporarily. The car should change pose without shifting the road or changing collision size.

#### 2.5 — Depth-sort scenery and traffic

**Read:** `render.js`, lines 76–96.

<!-- taught-source: coastline-sprint/render.js:76-96 -->

```js
  const objects = [];
  for (let i = 0; i < 32; i++) {
    const z = Math.floor(p.z / 1900) * 1900 + i * 1900;
    objects.push({ z, x: i % 2 ? -1.45 : 1.45, scenery: true, id: i });
  }
  for (const car of [...cars, ...others.filter((o) => o !== p)])
    if (car.z > p.z + 250 && car.z < p.z + 35000) objects.push(car);
  objects.sort((a, b) => b.z - a.z);
  for (const o of objects) {
    const depth = o.z - p.z,
      index = Math.round(depth / SEG) - 1,
      point = points[index];
    if (!point || depth < 250) continue;
    const xx = point.x + o.x * point.half,
      yy = point.y,
      size = Math.min(w * 0.4, point.scale * w * 260);
    if (o.scenery)
      sprite(images.roadside, o.id % 8, 64, 96, 8, xx, yy, size * 1.2, size * 1.8);
    else
      sprite(images.cars, o.index === 0 ? 1 : 5, 64, 40, 4, xx, yy, size, size * 0.625);
  }
```

**What and why:** Roadside records are generated around the current travel segment. Traffic and the other player join the same visible-object list only when ahead and inside the draw distance. Sorting by descending z paints distant sprites first. Matching each object to a road sample gives consistent curve, hill, lane offset and apparent size. The other player is a visible rival, not another traffic collision body.

**Try it / expected result:** Watch a traffic car near a hill while approaching. It should grow and follow the same projected road rather than sliding independently across the sky.

#### 2.6 — Finish with a local car and a data-driven HUD

**Read:** `render.js`, lines 97–125.

<!-- taught-source: coastline-sprint/render.js:97-125 -->

```js
  const carW = Math.min(w * 0.25, h * 0.6),
    frame = (p.index ? 4 : 0) + (p.steer < -0.15 ? 0 : p.steer > 0.15 ? 2 : 1);
  sprite(images.cars, frame, 64, 40, 4, w / 2, h * 0.91, carW, carW * 0.625);
  g.fillStyle = '#101a2bdf';
  g.fillRect(0, 0, w, 37);
  g.fillStyle = p.index ? '#f4eee2' : '#ffae9b';
  g.font = `bold ${h < 250 ? 11 : 14}px monospace`;
  g.fillText(
    `P${p.index + 1}  ${Math.round(p.speed / 20)} KM/H  TIME ${Math.ceil(p.time)}  ${Math.round((p.z / COURSE.length) * 100)}%`,
    8,
    16,
  );
  g.fillText(
    `NITRO ${Math.round(p.nitro * 100)}%  CP ${p.checkpoint}/2  HITS ${p.hits}`,
    8,
    31,
  );
  if (p.finished || p.lost) {
    g.fillStyle = '#081326dd';
    g.fillRect(w * 0.12, h * 0.4, w * 0.76, 60);
    g.fillStyle = '#ffe4a1';
    g.font = 'bold 18px monospace';
    g.fillText(
      p.finished ? `FINISH ${p.elapsed.toFixed(1)}s` : 'TIME UP',
      w * 0.2,
      h * 0.54,
    );
  }
}
```

**What and why:** The player car is drawn last in a fixed screen location; steering chooses its sprite cell. Width responds to viewport height, which keeps the split view usable. HUD text reads state rather than calculating it again. Result overlays test finished/lost and show elapsed time or TIME UP; they do not end the race themselves.

**Try it / expected result:** Resize the browser and compare solo/split HUDs. Restart from a result and confirm the overlay disappears when fresh driver state is created.


### 3. app.js {#walk-app-js}

Wire the whole racer together: a tiny page frame, the UI file, resources, intent, state changes, simulation loop and independent viewports.

#### 3.1 — Imports and a minimal page frame

**Read:** `app.js`, lines 1–19.

<!-- taught-source: coastline-sprint/app.js:1-19 -->

```js
import { COURSE, driver, traffic, updateDriver, padInput } from './track.js';
import { drawView } from './render.js';
import { RetroAudio } from './audio.js';
import { AUDIO } from './audio-config.js';
import { createUI } from './lib/nord-ui.js';
export async function mount(root) {
  // Page frame: a 16:9 canvas with room above/below for the UI bar and notice line.
  Object.assign(document.body.style, { margin: 0, background: '#101b2b' });
  const shell = Object.assign(document.createElement('div'), {
    style: 'position:relative;max-width:1100px;margin:auto;padding:56px 0 36px',
  });
  const canvas = Object.assign(document.createElement('canvas'), {
    width: 960,
    height: 540,
    tabIndex: 0,
    style: 'display:block;width:100%;image-rendering:pixelated',
  });
  shell.append(canvas);
  root.append(shell);
```

**What and why:** Imports give the host access to rules, renderer, audio, the UI runtime and file paths. mount receives the HTML-tier root. The only markup built in code is a shell and a 16:9 canvas, made with createElement and a few style properties; every menu, button and line of text now lives in ui/menu.ui.json instead of a giant HTML string. Padding above and below the canvas leaves room for the UI bar and notice line.

**Try it / expected result:** Change the shell padding top from 56px to 100px and reload. The canvas moves down, the UI bar stays anchored to the top of the shell; restore the value afterwards.

#### 3.2 — Load the UI file and keep handles

**Read:** `app.js`, lines 20–23.

<!-- taught-source: coastline-sprint/app.js:20-23 -->

```js
  // All menus and text live in ui/menu.ui.json (edit it in the UI Designer). The code only reacts to it.
  const menu = await createUI(shell).load('ui/menu.ui.json');
  const overlay = menu.$('overlay'),
    track = menu.$('track');
```

**What and why:** createUI(shell).load fetches ui/menu.ui.json, builds it into an isolated shadow root over the shell and returns a screen. menu.$('name') returns a node handle by the name you gave it in the Designer and throws a clear error if the name is missing. Handles are kept in constants so the game loop never searches the DOM; setting text or visible later touches only that node.

**Try it / expected result:** Open ui/menu.ui.json in the UI Designer, rename the node 'overlay' to 'intro', save, reload Play and read the Console: menu.$('overlay') should now throw a message naming the missing node. Rename it back.

#### 3.3 — Canvas context, images and shared state

**Read:** `app.js`, lines 24–54.

<!-- taught-source: coastline-sprint/app.js:24-54 -->

```js
  const g = canvas.getContext('2d'),
    sound = new RetroAudio(AUDIO),
    keys = new Set();
  const load = (src) =>
    new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(Error('Missing ' + src));
      image.src = src;
    });
  const images = {
    cars: await load('assets/sprites/racing-cars.png'),
    roadside: await load('assets/sprites/roadside.png'),
  };
  let players = [driver()],
    cars = traffic(),
    mode = 1,
    state = 'menu',
    paused = false,
    last = performance.now(),
    engine = null,
    starting = false;
  const pad = () => Array.from(navigator.getGamepads?.() ?? []).find((p) => p?.connected);
  const keyboard = () => ({
    steer:
      (keys.has('KeyD') || keys.has('ArrowRight') ? 1 : 0) -
      (keys.has('KeyA') || keys.has('ArrowLeft') ? 1 : 0),
    accel: keys.has('KeyW') || keys.has('ArrowUp') ? 1 : 0,
    brake: keys.has('KeyS') || keys.has('ArrowDown') ? 1 : 0,
    boost: keys.has('ShiftLeft') || keys.has('ShiftRight'),
  });
```

**What and why:** The 2D context, audio object and key set are created once. The image loader resolves only on load and rejects with the missing path on error, and await ensures both sheets exist before drawView receives them. Run variables then hold players, shared traffic, mode, menu/result state and the previous frame timestamp; pad and keyboard translate browser state into rule inputs.

**Try it / expected result:** Temporarily misspell a sprite filename, reopen Play and inspect the Console. Restore it; a missing resource should fail clearly instead of producing a silent empty car.

#### 3.4 — Reset one complete race from a button

**Read:** `app.js`, lines 55–83.

<!-- taught-source: coastline-sprint/app.js:55-83 -->

```js
  async function start(count) {
    if (starting) return;
    if (count === 2 && !pad()) {
      menu.set(
        'notice',
        'Connect a gamepad and press one of its buttons, then choose 2 player split.',
      );
      return;
    }
    starting = true;
    mode = count;
    players = Array.from({ length: mode }, (_, i) => driver(i));
    cars = traffic();
    paused = false;
    state = 'playing';
    keys.clear();
    overlay.visible = false;
    canvas.focus();
    try {
      await sound.unlock();
      await sound.music(track.index);
      if (engine) engine.source.stop();
      engine = await sound.play('engine', { loop: true, volume: 0.07 });
    } catch (error) {
      sound.problem = error.message;
    } finally {
      starting = false;
    }
  }
```

**What and why:** starting blocks overlapping asynchronous audio setup. Split mode first verifies a connected controller; no half-initialized second player is created when it is absent. New drivers and traffic replace old run state, held keys are cleared, and canvas focus returns to play. Audio activation stays inside this click path so the browser can authorize playback. finally releases the starting guard even if audio fails.

**Try it / expected result:** Restart while holding a key, then release it. Fresh state and key clearing should prevent the old run from continuing invisibly.

#### 3.5 — Pause logic and wire controls

**Read:** `app.js`, lines 84–93.

<!-- taught-source: coastline-sprint/app.js:84-93 -->

```js
  function togglePause() {
    if (state !== 'playing') return;
    if (paused && mode === 2 && !pad()) return;
    paused = !paused;
    overlay.visible = paused;
    menu.$('ovTitle').text = 'PAUSED';
    menu.$('ovBody').text = 'Pause / Resume continues. Connect P2 gamepad if disconnected.';
    paused ? sound.suspend() : sound.resume();
    keys.clear();
  }
```

**What and why:** The guard excludes menu/results. A disconnected P2 pad prevents unsafe resume. Pause updates state, overlay, sound context and keys together. The following button assignments connect page intent to these functions; mute changes the label from the helper result, and track change requests music only after a context exists.

**Try it / expected result:** Pause during a race and switch tracks. Resume and confirm the timer did not advance while paused.

#### 3.6 — React to named UI actions

**Read:** `app.js`, lines 94–103.

<!-- taught-source: coastline-sprint/app.js:94-103 -->

```js
  menu.on('one', () => start(1));
  menu.on('two', () => start(2));
  menu.on('restart', () => start(mode));
  menu.on('pause', togglePause);
  menu.on('mute', () => {
    menu.$('mute').text = sound.mute() ? 'Unmute' : 'Mute';
  });
  menu.on('track', () => {
    if (sound.ctx) sound.music(track.index);
  });
```

**What and why:** Each button in the UI file has an action name such as one, two, pause or restart. menu.on(action, fn) subscribes to that name, so the code never needs element IDs or querySelector. The select emits track when its choice changes, and the mute handler writes the new label back through the node's text property. Moving a button or restyling it in the Designer cannot break any of this.

**Try it / expected result:** In the Designer change the Restart button's action from restart to again and save without touching app.js. Pressing the button now does nothing until you also change menu.on('restart') to menu.on('again'); then undo both.

#### 3.7 — Maintain held keys instead of moving in key events

**Read:** `app.js`, lines 104–117.

<!-- taught-source: coastline-sprint/app.js:104-117 -->

```js
  window.addEventListener('keydown', (e) => {
    if (
      ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Space'].includes(e.code) &&
      state === 'playing'
    )
      e.preventDefault();
    if (e.code === 'KeyP' && !e.repeat) togglePause();
    keys.add(e.code);
  });
  window.addEventListener('keyup', (e) => keys.delete(e.code));
  window.addEventListener('blur', () => {
    keys.clear();
    if (state === 'playing' && !paused) togglePause();
  });
```

**What and why:** keydown/keyup update the Set; movement will read it once per simulation frame. preventDefault stops arrows/Space scrolling the page only while playing. P ignores auto-repeat. Blur clears held inputs and pauses, avoiding stuck steering when focus changes. These window listeners live for this mounted page, which Nord replaces when Play is reopened.

**Try it / expected result:** Hold steering, move focus away, return and resume. The car must not remain stuck turning after the key was released outside the page.

#### 3.8 — Advance the world once, then report results

**Read:** `app.js`, lines 118–133.

<!-- taught-source: coastline-sprint/app.js:118-133 -->

```js
  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    if (mode === 2 && state === 'playing' && !paused && !pad()) togglePause();
    if (state === 'playing' && !paused) {
      for (const car of cars) car.z += car.speed * dt;
      for (const p of players)
        for (const event of updateDriver(
          p,
          p.index ? padInput(pad()) : keyboard(),
          dt,
          cars,
        ))
          sound.play(event, { volume: event === 'crash' ? 0.65 : 0.5 });
      if (players.every((p) => p.finished || p.lost)) {
        state = 'result';
```

**What and why:** requestAnimationFrame supplies milliseconds; dividing by 1000 converts to the rules’ seconds. The cap avoids a giant step after a stalled frame. Disconnection can pause both views before simulation. Shared traffic moves once, each driver advances with its own input, and returned events trigger sounds. The whole race reaches result only when every driver has finished or lost.

**Try it / expected result:** In split mode let one timer expire first. The other driver should still be able to finish while the finished view displays its result.

#### 3.9 — Render two cameras without duplicating simulation

**Read:** `app.js`, lines 134–186.

<!-- taught-source: coastline-sprint/app.js:134-186 -->

```js
        if (engine) {
          engine.source.stop();
          engine = null;
        }
      }
    }
    if (engine) {
      engine.source.playbackRate.value = 0.7 + (players[0].speed / COURSE.maxSpeed) * 1.4;
      engine.gain.gain.value = paused
        ? 0
        : 0.035 + (players[0].speed / COURSE.maxSpeed) * 0.075;
    }
    const h = canvas.height / mode;
    players.forEach((p, i) => {
      g.save();
      g.beginPath();
      g.rect(0, i * h, canvas.width, h);
      g.clip();
      g.translate(0, i * h);
      drawView(g, p, cars, players, images, canvas.width, h);
      g.restore();
    });
    if (mode === 2) {
      g.fillStyle = '#0b1424';
      g.fillRect(0, h - 2, canvas.width, 4);
    }
    menu.set(
      'notice',
      sound.problem
        ? `Audio: ${sound.problem}`
        : mode === 2
          ? `P2 ${pad()?.id ?? 'GAMEPAD DISCONNECTED'} · ${state === 'result' ? 'Restart for a new race.' : 'P pauses both views.'}`
          : 'W/Up accelerates · S/Down brakes · A/D steer · Shift nitro · P pause',
    );
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
  // Read-only inspection seam used by browser checks; gameplay still runs through real inputs.
  window.__coast = {
    get players() {
      return players;
    },
    get paused() {
      return paused;
    },
    get state() {
      return state;
    },
    get sound() {
      return sound;
    },
  };
}
```

**What and why:** Engine rate/gain follows P1 speed. Each viewport saves canvas state, clips its own rectangle and translates the origin before calling drawView. restore prevents the second view inheriting the first view’s clip/translation. The separator is drawn once, notices reflect current pad/audio state, and scheduling the next frame keeps the loop alive even while paused so UI can still respond.

**Try it / expected result:** Remove restore only on a temporary copy and observe the broken second view; put it back. The getter object at the end is for inspection/tests, not another game loop.


### 4. ui/menu.ui.json {#walk-ui-menu-ui-json}

Describe the whole menu as data: layout containers, buttons, a select, text with placeholders and the intro card. The UI Designer edits this file.

#### 4.1 — Theme variables and the transparent root

**Read:** `ui/menu.ui.json`, lines 1–23.

<!-- taught-source: coastline-sprint/ui/menu.ui.json:1-23 -->

```json
{
  "version": 1,
  "name": "menu",
  "theme": {
    "bg": "#101b2b",
    "panel": "#0d172ae8",
    "border": "#7a9caa",
    "fg": "#e3edf0",
    "accent": "#304a61"
  },
  "root": {
    "type": "panel",
    "name": "root",
    "anchor": "fill",
    "style": {
      "background": "none",
      "border": "none",
      "boxShadow": "none",
      "padding": 0,
      "font": "15px monospace"
    },
    "children": [
      {
```

**What and why:** The file starts with a version and a name, then theme variables: bg, panel, border, fg and accent override the engine defaults for this screen only. The root is a full-size panel whose style removes the default background, border and padding, so it acts as an invisible layer above the canvas while its children are positioned by anchors.

**Try it / expected result:** Change the accent colour from #304a61 to #aa3355 and reload. All buttons change colour at once because they share the variable; restore the old value.

#### 4.2 — A row of buttons with action names

**Read:** `ui/menu.ui.json`, lines 24–84.

<!-- taught-source: coastline-sprint/ui/menu.ui.json:24-84 -->

```json
        "type": "hbox",
        "name": "bar",
        "anchor": "t",
        "w": "100%",
        "padding": 10,
        "gap": 8,
        "children": [
          {
            "type": "button",
            "name": "one",
            "text": "1 player",
            "on": {
              "pressed": "one"
            }
          },
          {
            "type": "button",
            "name": "two",
            "text": "2 player split",
            "on": {
              "pressed": "two"
            }
          },
          {
            "type": "button",
            "name": "pause",
            "text": "Pause / Resume",
            "on": {
              "pressed": "pause"
            }
          },
          {
            "type": "button",
            "name": "restart",
            "text": "Restart",
            "on": {
              "pressed": "restart"
            }
          },
          {
            "type": "button",
            "name": "mute",
            "text": "Mute",
            "on": {
              "pressed": "mute"
            }
          },
          {
            "type": "select",
            "name": "track",
            "options": [
              "Coast Drive",
              "Coast Night"
            ],
            "on": {
              "changed": "track"
            }
          }
        ]
      },
      {
```

**What and why:** An hbox lays its children out in a row with a gap and padding, anchored to the top edge at full width. Each button names an action under on.pressed; the game subscribes to those names with menu.on. The select lists its options and reports changes as the track action. Layout and wording are therefore editable without touching code.

**Try it / expected result:** Drag the Restart row above Pause in the Designer's tree and save. The order on screen changes, while the game still responds to every button.

#### 4.3 — Notice line and the intro card

**Read:** `ui/menu.ui.json`, lines 85–128.

<!-- taught-source: coastline-sprint/ui/menu.ui.json:85-128 -->

```json
        "type": "label",
        "name": "notice",
        "anchor": "b",
        "w": "100%",
        "padding": 8,
        "text": "{notice}",
        "rich": false,
        "wrap": false,
        "size": 15
      },
      {
        "type": "vbox",
        "name": "overlay",
        "anchor": "c",
        "y": 10,
        "w": "70%",
        "class": "card",
        "align": "center",
        "gap": 10,
        "style": {
          "background": "#0d172ae8",
          "padding": 18
        },
        "children": [
          {
            "type": "label",
            "name": "ovTitle",
            "text": "COASTLINE SPRINT",
            "size": 26,
            "bold": true,
            "color": "#f7d89b",
            "align": "center"
          },
          {
            "type": "label",
            "name": "ovBody",
            "text": "One coast. Two checkpoints. Beat the clock![br][br]P1: WASD/arrows · Shift nitro[br]P2: gamepad left stick · RT/A throttle · LT/B brake · X nitro[br][br]Choose 1 player or connect a gamepad and choose 2 player split.",
            "align": "center"
          }
        ]
      }
    ]
  }
}
```

**What and why:** The notice label shows the template text {notice}; the game fills it with menu.set('notice', ...) and only changed values touch the page. The overlay is a centred vertical box with a translucent card style. Its title and body labels use rich text: [b] for bold and [br] for line breaks, parsed safely into spans rather than injected as HTML.

**Try it / expected result:** Change the title text to [color=#ff8866]COASTLINE[/color] SPRINT, save and reload to see rich text colour part of the heading.


### 5. audio.js {#walk-audio-js}

Build the complete local-audio helper: activation, cached decoding, voices, crossfade and cleanup.

#### 5.1 — Own resources for one run

**Read:** `audio.js`, lines 1–18.

<!-- taught-source: coastline-sprint/audio.js:1-18 -->

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
```

**What and why:** The constructor records configuration separately from browser audio objects. A Map caches a promise for each path, and a Set tracks live voices. Keeping these on the instance gives one owner for cleanup and makes repeated effects reuse decoded audio. The AudioContext is deferred until a user gesture because browser playback permission belongs to that gesture.

**Try it / expected result:** Start a fresh page and inspect the helper before clicking Start: it has configuration but no running AudioContext.

#### 5.2 — Decode each path once

**Read:** `audio.js`, lines 19–30.

<!-- taught-source: coastline-sprint/audio.js:19-30 -->

```js
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
```

**What and why:** The first load stores the entire asynchronous fetch/decode operation in the Map. A second request receives that same promise even if downloading is still in progress. Checking response.ok turns a missing file into a meaningful error instead of attempting to decode an HTML error page. decodeAudioData produces a reusable buffer, not a playing sound.

**Try it / expected result:** Temporarily mistype one SFX path. Trigger it and observe the visible audio problem; restore the path and reopen Play to clear the rejected cached request.

#### 5.3 — Turn a buffer into a voice

**Read:** `audio.js`, lines 31–58.

<!-- taught-source: coastline-sprint/audio.js:31-58 -->

```js
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
```

**What and why:** A BufferSource is single-use: the cached buffer can be reused, but each playback needs a new source. A GainNode gives that voice its own volume before reaching the master. Loop/rate options handle music and engine pitch. The non-looping voice cap bounds overlapping effects; onended disconnects nodes and removes the finished voice from the Set. Errors become an inspectable problem rather than stopping gameplay.

**Try it / expected result:** Lower the voice volume for one event. Its loudness should change without affecting music or changing the file itself.

#### 5.4 — Keep game events independent of file paths

**Read:** `audio.js`, lines 59–76.

<!-- taught-source: coastline-sprint/audio.js:59-76 -->

```js
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
```

**What and why:** play looks up a symbolic name in config.sfx, so collision code can request crash without knowing where the recording lives. music creates a looping voice, fades its gain in, fades the old voice out and schedules the old source to stop. Capturing the old song lets both overlap briefly rather than cutting abruptly.

**Try it / expected result:** Switch between the two supplied music tracks while playing. Listen for the overlap; do not put music() inside the animation loop.

#### 5.5 — Pause and dispose the right owner

**Read:** `audio.js`, lines 77–92.

<!-- taught-source: coastline-sprint/audio.js:77-92 -->

```js
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

**What and why:** Mute changes the master gain, leaving individual volume relationships intact. Suspend/resume controls the AudioContext clock alongside a paused game. Dispose closes the whole context and clears voice ownership. This is distinct from caching a buffer: cached data may exist while no voice is playing.

**Try it / expected result:** Mute, unmute, pause and resume. Then restart the scene/app and verify there is one soundtrack rather than another copy layered over the old one.


### 6. audio-config.js {#walk-audio-config-js}

Choose recordings through data rather than hardcoded paths in gameplay.

#### 6.1 — Keep symbolic sound names stable

**Read:** `audio-config.js`, lines 1–11.

<!-- taught-source: coastline-sprint/audio-config.js:1-11 -->

```js
// Put your replacement MP3/WAV/OGG files in assets/audio and change these paths.
export const AUDIO = {
  music: ['assets/audio/coast-drive.mp3', 'assets/audio/coast-night.mp3'],
  sfx: {
    engine: 'assets/audio/engine.mp3',
    crash: 'assets/audio/crash.mp3',
    skid: 'assets/audio/skid.mp3',
    checkpoint: 'assets/audio/checkpoint.mp3',
    win: 'assets/audio/win.mp3',
  },
};
```

**What and why:** music is an ordered list used by the track selector. sfx maps event names returned by updateDriver to local files. Changing a path replaces a recording without editing physics or rendering; changing a key would require changing event producers too. Both music tracks and every referenced effect are included in the download.

**Try it / expected result:** Replace only crash with your own short recording, keeping the key crash. Reopen Play and collide with traffic to hear the replacement.


### 7. index.html {#walk-index-html}

Read the complete Nord page entry point and its failure path.

#### 7.1 — Load the local runtime and start the app

**Read:** `index.html`, lines 1–8.

<!-- taught-source: coastline-sprint/index.html:1-8 -->

```html
<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="nord-app-id" content="com.crowelian.coastlinesprint"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Coastline Sprint — Amiga road racer</title>
<style>html,body{margin:0;height:100%;background:#2e3440}#app{height:100vh}</style></head>
<body><div id="app"></div>
<script type="module">
import { mount } from './app.js';
try { await mount(document.getElementById('app')); window.__nord_ready = true; } catch (e) { console.error(e); window.__nord_error = String(e); }
</script></body></html>
```

**What and why:** The document declares encoding and viewport, creates the mount container and loads local code. The module imports mount from app.js and awaits initialization for the HTML-tier root. The ready/error flags are inspection signals used by browser checks; they are not a second simulation. The catch logs and exposes initialization errors. The page is served over HTTP so local module and asset URLs resolve consistently.

**Try it / expected result:** Temporarily rename the imported main module on a copy and reopen Play. Inspect the Console/error path, then restore the correct name.


### 8. nord.project.json {#walk-nord-project-json}

Read every project field that tells Nord which host, display and services to use.

#### 8.1 — Identify the project and choose its presentation

**Read:** `nord.project.json`, lines 1–22.

<!-- taught-source: coastline-sprint/nord.project.json:1-22 -->

```json
{
  "format": 1,
  "name": "Coastline Sprint",
  "id": "com.crowelian.coastlinesprint",
  "type": "html",
  "engineVersion": "0.1.0",
  "startScene": "",
  "display": {
    "width": 640,
    "height": 360,
    "scale": "fit",
    "pixelArt": false,
    "background": "#2e3440"
  },
  "physics": {
    "engine": "none",
    "gravity": [
      0,
      0,
      0
    ]
  },
```

**What and why:** format and engineVersion identify the serialized contract, while name/id give human and stable application identity. type chooses the host; startScene is used by a scene backend and is empty for these HTML apps. Display fields request dimensions, fit behaviour, pixel-art treatment and background. Physics selects a runtime engine; the rail shooter uses custom rules with none, while HTML-hosted libraries are initialized in their own modules.

**Try it / expected result:** Change only the display title/name in a copy and reopen the project. Do not change the stable ID casually if you want to keep the same save namespace.

#### 8.2 — Distinguish scene actions from HTML event handling

**Read:** `nord.project.json`, lines 23–64.

<!-- taught-source: coastline-sprint/nord.project.json:23-64 -->

```json
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
        "Space",
        "KeyW",
        "ArrowUp"
      ],
      "fire": [
        "Space",
        "Mouse0"
      ],
      "interact": [
        "KeyE",
        "Enter"
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

**What and why:** The input object maps action names to keyboard codes for Nord scene scripts. Vector Patrol reads these through this.input. HTML-tier hosts in the other projects read their own DOM events, so editing this action table alone does not rewrite those handlers. plugins/ui declare ordinary scene services and skin/theme; any remaining desktop configuration is the native capability contract rather than a browser CORS override.

**Try it / expected result:** For Vector Patrol, add a second fire key and test it. For an HTML app, locate its key handler instead of expecting this table to change DOM input.


### 9. assets/sprites/racing-cars.png.meta.json {#walk-assets-sprites-racing-cars-png-meta-json}

Read the supplied sprite sidecar used by Nord’s asset tools.

#### 9.1 — Describe cell geometry and asset identity

**Read:** `assets/sprites/racing-cars.png.meta.json`, lines 1–12.

<!-- taught-source: coastline-sprint/assets/sprites/racing-cars.png.meta.json:1-12 -->

```json
{
  "type": "spritesheet",
  "frameWidth": 64,
  "frameHeight": 40,
  "filter": "nearest",
  "anims": {},
  "tags": [
    "amiga",
    "original",
    "2d"
  ]
}
```

**What and why:** type declares a spritesheet, frameWidth/frameHeight specify each cell and nearest filtering preserves pixel edges. anims is empty because this racer picks static directional cells itself. Tags organize the asset in tools. The renderer’s explicit crop dimensions must agree with these cell dimensions; metadata is not an automatic steering animation.

**Try it / expected result:** Compare frame sizes with sprite() calls in render.js. Replace a sheet only after preserving that cell contract or updating both sides.


### 10. assets/sprites/roadside.png.meta.json {#walk-assets-sprites-roadside-png-meta-json}

Read the supplied sprite sidecar used by Nord’s asset tools.

#### 10.1 — Describe cell geometry and asset identity

**Read:** `assets/sprites/roadside.png.meta.json`, lines 1–12.

<!-- taught-source: coastline-sprint/assets/sprites/roadside.png.meta.json:1-12 -->

```json
{
  "type": "spritesheet",
  "frameWidth": 64,
  "frameHeight": 96,
  "filter": "nearest",
  "anims": {},
  "tags": [
    "amiga",
    "original",
    "2d"
  ]
}
```

**What and why:** type declares a spritesheet, frameWidth/frameHeight specify each cell and nearest filtering preserves pixel edges. anims is empty because this racer picks static directional cells itself. Tags organize the asset in tools. The renderer’s explicit crop dimensions must agree with these cell dimensions; metadata is not an automatic steering animation.

**Try it / expected result:** Compare frame sizes with sprite() calls in render.js. Replace a sheet only after preserving that cell contract or updating both sides.

<!-- END GENERATED FILE WALKTHROUGH -->

## Complete game source

Every JavaScript file, generated HTML, project metadata and sprite metadata is listed below. The [full source archive](assets/downloads/coastline-sprint-source.zip) also contains every PNG and MP3 used by the finished game and its licence. The reference repository was inspected for context; no reference game artwork, soundtrack or C++ code is needed to reproduce this original Nord project.

<!-- GENERATED GAME SOURCE: regenerate with node tools/build-code-workshops.mjs -->

<details>
<summary>Complete app.js</summary>

```js
import { COURSE, driver, traffic, updateDriver, padInput } from './track.js';
import { drawView } from './render.js';
import { RetroAudio } from './audio.js';
import { AUDIO } from './audio-config.js';
import { createUI } from './lib/nord-ui.js';
export async function mount(root) {
  // Page frame: a 16:9 canvas with room above/below for the UI bar and notice line.
  Object.assign(document.body.style, { margin: 0, background: '#101b2b' });
  const shell = Object.assign(document.createElement('div'), {
    style: 'position:relative;max-width:1100px;margin:auto;padding:56px 0 36px',
  });
  const canvas = Object.assign(document.createElement('canvas'), {
    width: 960,
    height: 540,
    tabIndex: 0,
    style: 'display:block;width:100%;image-rendering:pixelated',
  });
  shell.append(canvas);
  root.append(shell);
  // All menus and text live in ui/menu.ui.json (edit it in the UI Designer). The code only reacts to it.
  const menu = await createUI(shell).load('ui/menu.ui.json');
  const overlay = menu.$('overlay'),
    track = menu.$('track');
  const g = canvas.getContext('2d'),
    sound = new RetroAudio(AUDIO),
    keys = new Set();
  const load = (src) =>
    new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(Error('Missing ' + src));
      image.src = src;
    });
  const images = {
    cars: await load('assets/sprites/racing-cars.png'),
    roadside: await load('assets/sprites/roadside.png'),
  };
  let players = [driver()],
    cars = traffic(),
    mode = 1,
    state = 'menu',
    paused = false,
    last = performance.now(),
    engine = null,
    starting = false;
  const pad = () => Array.from(navigator.getGamepads?.() ?? []).find((p) => p?.connected);
  const keyboard = () => ({
    steer:
      (keys.has('KeyD') || keys.has('ArrowRight') ? 1 : 0) -
      (keys.has('KeyA') || keys.has('ArrowLeft') ? 1 : 0),
    accel: keys.has('KeyW') || keys.has('ArrowUp') ? 1 : 0,
    brake: keys.has('KeyS') || keys.has('ArrowDown') ? 1 : 0,
    boost: keys.has('ShiftLeft') || keys.has('ShiftRight'),
  });
  async function start(count) {
    if (starting) return;
    if (count === 2 && !pad()) {
      menu.set(
        'notice',
        'Connect a gamepad and press one of its buttons, then choose 2 player split.',
      );
      return;
    }
    starting = true;
    mode = count;
    players = Array.from({ length: mode }, (_, i) => driver(i));
    cars = traffic();
    paused = false;
    state = 'playing';
    keys.clear();
    overlay.visible = false;
    canvas.focus();
    try {
      await sound.unlock();
      await sound.music(track.index);
      if (engine) engine.source.stop();
      engine = await sound.play('engine', { loop: true, volume: 0.07 });
    } catch (error) {
      sound.problem = error.message;
    } finally {
      starting = false;
    }
  }
  function togglePause() {
    if (state !== 'playing') return;
    if (paused && mode === 2 && !pad()) return;
    paused = !paused;
    overlay.visible = paused;
    menu.$('ovTitle').text = 'PAUSED';
    menu.$('ovBody').text = 'Pause / Resume continues. Connect P2 gamepad if disconnected.';
    paused ? sound.suspend() : sound.resume();
    keys.clear();
  }
  menu.on('one', () => start(1));
  menu.on('two', () => start(2));
  menu.on('restart', () => start(mode));
  menu.on('pause', togglePause);
  menu.on('mute', () => {
    menu.$('mute').text = sound.mute() ? 'Unmute' : 'Mute';
  });
  menu.on('track', () => {
    if (sound.ctx) sound.music(track.index);
  });
  window.addEventListener('keydown', (e) => {
    if (
      ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Space'].includes(e.code) &&
      state === 'playing'
    )
      e.preventDefault();
    if (e.code === 'KeyP' && !e.repeat) togglePause();
    keys.add(e.code);
  });
  window.addEventListener('keyup', (e) => keys.delete(e.code));
  window.addEventListener('blur', () => {
    keys.clear();
    if (state === 'playing' && !paused) togglePause();
  });
  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    if (mode === 2 && state === 'playing' && !paused && !pad()) togglePause();
    if (state === 'playing' && !paused) {
      for (const car of cars) car.z += car.speed * dt;
      for (const p of players)
        for (const event of updateDriver(
          p,
          p.index ? padInput(pad()) : keyboard(),
          dt,
          cars,
        ))
          sound.play(event, { volume: event === 'crash' ? 0.65 : 0.5 });
      if (players.every((p) => p.finished || p.lost)) {
        state = 'result';
        if (engine) {
          engine.source.stop();
          engine = null;
        }
      }
    }
    if (engine) {
      engine.source.playbackRate.value = 0.7 + (players[0].speed / COURSE.maxSpeed) * 1.4;
      engine.gain.gain.value = paused
        ? 0
        : 0.035 + (players[0].speed / COURSE.maxSpeed) * 0.075;
    }
    const h = canvas.height / mode;
    players.forEach((p, i) => {
      g.save();
      g.beginPath();
      g.rect(0, i * h, canvas.width, h);
      g.clip();
      g.translate(0, i * h);
      drawView(g, p, cars, players, images, canvas.width, h);
      g.restore();
    });
    if (mode === 2) {
      g.fillStyle = '#0b1424';
      g.fillRect(0, h - 2, canvas.width, 4);
    }
    menu.set(
      'notice',
      sound.problem
        ? `Audio: ${sound.problem}`
        : mode === 2
          ? `P2 ${pad()?.id ?? 'GAMEPAD DISCONNECTED'} · ${state === 'result' ? 'Restart for a new race.' : 'P pauses both views.'}`
          : 'W/Up accelerates · S/Down brakes · A/D steer · Shift nitro · P pause',
    );
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
  // Read-only inspection seam used by browser checks; gameplay still runs through real inputs.
  window.__coast = {
    get players() {
      return players;
    },
    get paused() {
      return paused;
    },
    get state() {
      return state;
    },
    get sound() {
      return sound;
    },
  };
}
```

</details>

<details>
<summary>Complete assets/sprites/racing-cars.png.meta.json</summary>

```json
{
  "type": "spritesheet",
  "frameWidth": 64,
  "frameHeight": 40,
  "filter": "nearest",
  "anims": {},
  "tags": [
    "amiga",
    "original",
    "2d"
  ]
}
```

</details>

<details>
<summary>Complete assets/sprites/roadside.png.meta.json</summary>

```json
{
  "type": "spritesheet",
  "frameWidth": 64,
  "frameHeight": 96,
  "filter": "nearest",
  "anims": {},
  "tags": [
    "amiga",
    "original",
    "2d"
  ]
}
```

</details>

<details>
<summary>Complete audio-config.js</summary>

```js
// Put your replacement MP3/WAV/OGG files in assets/audio and change these paths.
export const AUDIO = {
  music: ['assets/audio/coast-drive.mp3', 'assets/audio/coast-night.mp3'],
  sfx: {
    engine: 'assets/audio/engine.mp3',
    crash: 'assets/audio/crash.mp3',
    skid: 'assets/audio/skid.mp3',
    checkpoint: 'assets/audio/checkpoint.mp3',
    win: 'assets/audio/win.mp3',
  },
};
```

</details>

<details>
<summary>Complete audio.js</summary>

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
<summary>Complete index.html</summary>

```html
<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="nord-app-id" content="com.crowelian.coastlinesprint"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Coastline Sprint — Amiga road racer</title>
<style>html,body{margin:0;height:100%;background:#2e3440}#app{height:100vh}</style></head>
<body><div id="app"></div>
<script type="module">
import { mount } from './app.js';
try { await mount(document.getElementById('app')); window.__nord_ready = true; } catch (e) { console.error(e); window.__nord_error = String(e); }
</script></body></html>
```

</details>

<details>
<summary>Complete nord.project.json</summary>

```json
{
  "format": 1,
  "name": "Coastline Sprint",
  "id": "com.crowelian.coastlinesprint",
  "type": "html",
  "engineVersion": "0.1.0",
  "startScene": "",
  "display": {
    "width": 640,
    "height": 360,
    "scale": "fit",
    "pixelArt": false,
    "background": "#2e3440"
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
      "jump": [
        "Space",
        "KeyW",
        "ArrowUp"
      ],
      "fire": [
        "Space",
        "Mouse0"
      ],
      "interact": [
        "KeyE",
        "Enter"
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
<summary>Complete render.js</summary>

```js
// Extended from Nord's own Amiga Showcase road/sprite presentation.
import { curve, hill, COURSE } from './track.js';
export function drawView(g, p, cars, others, images, w, h) {
  const horizon = h * 0.36;
  g.fillStyle = '#82bbce';
  g.fillRect(0, 0, w, h);
  g.fillStyle = '#eac48d';
  g.fillRect(0, horizon * 0.65, w, h * 0.2);
  g.fillStyle = '#657e86';
  g.beginPath();
  g.moveTo(0, horizon);
  for (let x = 0; x <= w; x += 20)
    g.lineTo(x, horizon - 18 - Math.sin(x * 0.02 + p.z * 0.00005) * 12);
  g.lineTo(w, horizon + 30);
  g.lineTo(0, horizon + 30);
  g.fill();
  g.fillStyle = '#487650';
  g.fillRect(0, horizon, w, h - horizon);
  const SEG = 200,
    road = 2000,
    points = [];
  let x = 0,
    dx = 0;
  for (let i = 1; i <= 180; i++) {
    const z = p.z + i * SEG;
    dx += curve(z);
    x += dx;
    const scale = 0.85 / (i * SEG);
    points.push({
      z,
      scale,
      x: w / 2 + ((x - p.x * road) * scale * w) / 2,
      y: horizon + ((hill(p.z) + 950 - hill(z)) * scale * h) / 2,
      half: (road * scale * w) / 2,
    });
  }
  const quad = (a, b, ratio, color) => {
    g.fillStyle = color;
    g.beginPath();
    g.moveTo(a.x - a.half * ratio, a.y);
    g.lineTo(a.x + a.half * ratio, a.y);
    g.lineTo(b.x + b.half * ratio, b.y);
    g.lineTo(b.x - b.half * ratio, b.y);
    g.closePath();
    g.fill();
  };
  for (let i = points.length - 2; i >= 0; i--) {
    const a = points[i],
      b = points[i + 1];
    if (b.y >= a.y || b.y > h) continue;
    const stripe = Math.floor(a.z / 1200) % 2;
    quad(a, b, 1.08, stripe ? '#eee0c4' : '#9a4e45');
    quad(a, b, 1, stripe ? '#444750' : '#4c4e56');
    if (stripe) {
      for (const lane of [-0.33, 0.33]) {
        const aa = { ...a, x: a.x + a.half * lane, half: a.half * 0.014 },
          bb = { ...b, x: b.x + b.half * lane, half: b.half * 0.014 };
        quad(aa, bb, 1, '#d7d5bb');
      }
    }
  }
  const sprite = (image, frame, fw, fh, cols, cx, cy, sw, sh) => {
    g.imageSmoothingEnabled = false;
    g.drawImage(
      image,
      (frame % cols) * fw,
      Math.floor(frame / cols) * fh,
      fw,
      fh,
      Math.round(cx - sw / 2),
      Math.round(cy - sh),
      Math.round(sw),
      Math.round(sh),
    );
  };
  const objects = [];
  for (let i = 0; i < 32; i++) {
    const z = Math.floor(p.z / 1900) * 1900 + i * 1900;
    objects.push({ z, x: i % 2 ? -1.45 : 1.45, scenery: true, id: i });
  }
  for (const car of [...cars, ...others.filter((o) => o !== p)])
    if (car.z > p.z + 250 && car.z < p.z + 35000) objects.push(car);
  objects.sort((a, b) => b.z - a.z);
  for (const o of objects) {
    const depth = o.z - p.z,
      index = Math.round(depth / SEG) - 1,
      point = points[index];
    if (!point || depth < 250) continue;
    const xx = point.x + o.x * point.half,
      yy = point.y,
      size = Math.min(w * 0.4, point.scale * w * 260);
    if (o.scenery)
      sprite(images.roadside, o.id % 8, 64, 96, 8, xx, yy, size * 1.2, size * 1.8);
    else
      sprite(images.cars, o.index === 0 ? 1 : 5, 64, 40, 4, xx, yy, size, size * 0.625);
  }
  const carW = Math.min(w * 0.25, h * 0.6),
    frame = (p.index ? 4 : 0) + (p.steer < -0.15 ? 0 : p.steer > 0.15 ? 2 : 1);
  sprite(images.cars, frame, 64, 40, 4, w / 2, h * 0.91, carW, carW * 0.625);
  g.fillStyle = '#101a2bdf';
  g.fillRect(0, 0, w, 37);
  g.fillStyle = p.index ? '#f4eee2' : '#ffae9b';
  g.font = `bold ${h < 250 ? 11 : 14}px monospace`;
  g.fillText(
    `P${p.index + 1}  ${Math.round(p.speed / 20)} KM/H  TIME ${Math.ceil(p.time)}  ${Math.round((p.z / COURSE.length) * 100)}%`,
    8,
    16,
  );
  g.fillText(
    `NITRO ${Math.round(p.nitro * 100)}%  CP ${p.checkpoint}/2  HITS ${p.hits}`,
    8,
    31,
  );
  if (p.finished || p.lost) {
    g.fillStyle = '#081326dd';
    g.fillRect(w * 0.12, h * 0.4, w * 0.76, 60);
    g.fillStyle = '#ffe4a1';
    g.font = 'bold 18px monospace';
    g.fillText(
      p.finished ? `FINISH ${p.elapsed.toFixed(1)}s` : 'TIME UP',
      w * 0.2,
      h * 0.54,
    );
  }
}
```

</details>

<details>
<summary>Complete track.js</summary>

```js
export const COURSE = {
  length: 180000,
  limit: 65,
  checkpoints: [60000, 120000],
  bonus: 18,
  maxSpeed: 4800,
};
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export function curve(z) {
  const t = z / COURSE.length;
  return t < 0.12 ? 0 : Math.sin(z / 8500) * 0.65 * (t > 0.9 ? 0.3 : 1);
}
export const hill = (z) => Math.sin(z / 12000) * 450 + Math.sin(z / 4700) * 90;
export function driver(index = 0) {
  return {
    index,
    x: index ? 0.3 : -0.3,
    z: 0,
    speed: 0,
    time: COURSE.limit,
    elapsed: 0,
    nitro: 1,
    checkpoint: 0,
    hits: 0,
    cooldown: 0,
    finished: false,
    lost: false,
    steer: 0,
  };
}
export const traffic = () =>
  Array.from({ length: 24 }, (_, i) => ({
    id: i,
    z: 7000 + i * 6900,
    x: [-0.64, 0, 0.64][i % 3],
    speed: 1350 + (i % 4) * 210,
  }));
export function updateDriver(p, input, dt, cars) {
  if (p.finished || p.lost) return [];
  dt = Math.min(dt, 0.05);
  const events = [];
  p.elapsed += dt;
  p.time = Math.max(0, p.time - dt);
  p.cooldown = Math.max(0, p.cooldown - dt);
  p.skid = Math.max(0, (p.skid ?? 0) - dt);
  const boost = input.boost && p.nitro > 0 && input.accel > 0;
  p.nitro = clamp(p.nitro + (boost ? -0.4 : 0.14) * dt, 0, 1);
  p.speed = clamp(
    p.speed + (input.accel * 2400 - input.brake * 4200 - 500) * dt,
    0,
    COURSE.maxSpeed * (boost ? 1.3 : 1),
  );
  p.steer = input.steer;
  p.x +=
    input.steer * dt * (0.5 + p.speed / COURSE.maxSpeed) * 1.25 -
    ((curve(p.z) * p.speed) / COURSE.maxSpeed) * dt * 0.7;
  p.x = clamp(p.x, -1.8, 1.8);
  if (Math.abs(p.x) > 1.05) p.speed = Math.max(0, p.speed - 3200 * dt);
  if (
    p.skid === 0 &&
    p.speed > 1800 &&
    ((input.brake > 0.2 && Math.abs(input.steer) > 0.4) || Math.abs(p.x) > 1.15)
  ) {
    p.skid = 0.8;
    events.push('skid');
  }
  p.z += p.speed * dt;
  if (p.cooldown === 0)
    for (const car of cars)
      if (Math.abs(car.z - p.z) < 500 && Math.abs(car.x - p.x) < 0.23) {
        p.speed *= 0.3;
        p.cooldown = 1.4;
        p.hits++;
        events.push('crash');
        break;
      }
  if (
    p.checkpoint < COURSE.checkpoints.length &&
    p.z >= COURSE.checkpoints[p.checkpoint]
  ) {
    p.checkpoint++;
    p.time += COURSE.bonus;
    events.push('checkpoint');
  }
  if (p.z >= COURSE.length) {
    p.z = COURSE.length;
    p.finished = true;
    events.push('win');
  } else if (p.time === 0) {
    p.lost = true;
    events.push('crash');
  }
  return events;
}
export function padInput(pad) {
  const button = (i) => pad?.buttons?.[i]?.value ?? 0;
  const axis = pad?.axes?.[0] ?? 0;
  return {
    steer: Math.abs(axis) > 0.14 ? axis : 0,
    accel: Math.max(button(7), button(0)),
    brake: Math.max(button(6), button(1)),
    boost: button(2) > 0.5,
  };
}
```

</details>

<details>
<summary>Complete ui/menu.ui.json</summary>

```json
{
  "version": 1,
  "name": "menu",
  "theme": {
    "bg": "#101b2b",
    "panel": "#0d172ae8",
    "border": "#7a9caa",
    "fg": "#e3edf0",
    "accent": "#304a61"
  },
  "root": {
    "type": "panel",
    "name": "root",
    "anchor": "fill",
    "style": {
      "background": "none",
      "border": "none",
      "boxShadow": "none",
      "padding": 0,
      "font": "15px monospace"
    },
    "children": [
      {
        "type": "hbox",
        "name": "bar",
        "anchor": "t",
        "w": "100%",
        "padding": 10,
        "gap": 8,
        "children": [
          {
            "type": "button",
            "name": "one",
            "text": "1 player",
            "on": {
              "pressed": "one"
            }
          },
          {
            "type": "button",
            "name": "two",
            "text": "2 player split",
            "on": {
              "pressed": "two"
            }
          },
          {
            "type": "button",
            "name": "pause",
            "text": "Pause / Resume",
            "on": {
              "pressed": "pause"
            }
          },
          {
            "type": "button",
            "name": "restart",
            "text": "Restart",
            "on": {
              "pressed": "restart"
            }
          },
          {
            "type": "button",
            "name": "mute",
            "text": "Mute",
            "on": {
              "pressed": "mute"
            }
          },
          {
            "type": "select",
            "name": "track",
            "options": [
              "Coast Drive",
              "Coast Night"
            ],
            "on": {
              "changed": "track"
            }
          }
        ]
      },
      {
        "type": "label",
        "name": "notice",
        "anchor": "b",
        "w": "100%",
        "padding": 8,
        "text": "{notice}",
        "rich": false,
        "wrap": false,
        "size": 15
      },
      {
        "type": "vbox",
        "name": "overlay",
        "anchor": "c",
        "y": 10,
        "w": "70%",
        "class": "card",
        "align": "center",
        "gap": 10,
        "style": {
          "background": "#0d172ae8",
          "padding": 18
        },
        "children": [
          {
            "type": "label",
            "name": "ovTitle",
            "text": "COASTLINE SPRINT",
            "size": 26,
            "bold": true,
            "color": "#f7d89b",
            "align": "center"
          },
          {
            "type": "label",
            "name": "ovBody",
            "text": "One coast. Two checkpoints. Beat the clock![br][br]P1: WASD/arrows · Shift nitro[br]P2: gamepad left stick · RT/A throttle · LT/B brake · X nitro[br][br]Choose 1 player or connect a gamepad and choose 2 player split.",
            "align": "center"
          }
        ]
      }
    ]
  }
}
```

</details>
