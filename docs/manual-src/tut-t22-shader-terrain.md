---
title: T22 Put a terrain shader in a Nord app
section: Tutorials
order: 22
summary: Render the provided synthwave shader in Play/export, add audio, click terrain and drop a cube onto a matching GPU height.
---
**Example:** `examples/shader-terrain/` — Shader Terrain Lab. It uses your provided “another synthwave sunset thing” GLSL, preserved as `terrain.glsl`, with a small WebGL2 host. It has audio, freeze/resume, click picking and a falling cube.

## 1. Open the example and press Play
Open `examples/shader-terrain` in the Nord editor. Press **Play**. The HTML tier loads `index.html`, which mounts the app. To recreate it in your own folder, copy the files listed below; no game engine scene is needed.

```text
my-shader-app/
  nord.project.json
  index.html
  app.js
  _kit.js
  style.css
  terrain.glsl
  assets/audio/ambience.wav
```

The project settings and start page are complete here:

::: example-code examples/shader-terrain/nord.project.json json
::: example-code examples/shader-terrain/index.html html

## 2. Keep the shader in its own file
Copy `examples/shader-terrain/terrain.glsl` into your folder. It is the exact pasted source, including its comments and optional defines. It supplies `mainImage`, `trinoise`, `map` and `intersect`.

The host supplies WebGL2 uniforms named `iResolution`, `iTime` and `iTimeDelta`, then calls `mainImage` for each pixel. A full-screen triangle covers the canvas. The original shader's `round()` and `texture()` syntax need WebGL2 rather than a WebGL1-only wrapper.

The host sets `iTimeDelta` to zero so the original per-pixel motion-blur jitter does not change the terrain between a rendered pixel and a collision probe.

::: dummies
A shader tells the graphics chip what colour each pixel should be. It can make a landscape look solid without creating a physical landscape object. Collision therefore needs its own representation of the same surface.
:::

## 3. Add the host and styling
Copy `examples/shader-terrain/_kit.js` to your folder; it is the existing Nord DOM helper. Create `app.js` and `style.css` using these complete files:

::: example-code examples/shader-terrain/app.js javascript
::: example-code examples/shader-terrain/style.css css

`mount(root)` creates the canvases and buttons, compiles the shader, starts a frame loop, and returns a cleanup function. Compile errors appear in the status area. No external scripts are downloaded.

## 4. Add the audio
Copy `examples/shader-terrain/assets/audio/ambience.wav` to the same path in your project. **Enable audio** starts this original local 16-second loop after a click; **Mute audio** stops it.

The loop now drives the shader through **`iChannel0`**. The host removes `#define disable_sound_texture_sampling` from the compiled copy; `terrain.glsl` stays unchanged on disk. This activates the original shader's audio-reactive terrain and sky, and its slower camera speed of **5**.

Here is the signal path: **WAV → Web Audio analyser → volume control → speakers**. Each animation frame, the analyser produces 512 frequency bins (FFT) and waveform samples. The host uploads a **512 × 2 red-channel texture**: bottom row = frequency strength, top row = waveform. Both the picture shader and the terrain-probe shader bind this texture to texture unit 0 and set `iChannel0` to 0. `iChannelResolution[0]` is `(512, 2, 1)`. The analyser reads before the quiet speaker volume, so the visual reaction remains visible.

::: dummies
Click **Enable audio**, then leave the terrain running. The sound now changes the landscape and sky as it plays. **Mute audio** stops playback and clears the sound input on the next unfrozen frame. To use your own music, replace `assets/audio/ambience.wav` with a local file and keep its filename, or change the URL in `app.js`. No microphone permission is needed.
:::

You can explicitly regenerate the default WAV with `node tools/gen_shader_audio.mjs` in the engine checkout.

## 5. Click terrain or drop a cube
Click visible ground. The host runs the original shader's `intersect()` in a **1×1 off-screen framebuffer** to find the ray's terrain distance. Clicking sky reports that there is no terrain hit. **Drop cube** uses a fixed point ahead of the camera instead.

The scene freezes both shader time and the audio-texture snapshot after a drop so the terrain remains still while the cube falls. The music can keep playing; its new samples reach the terrain when you resume. Click another point to drop again. **Resume terrain** returns to the original moving shader and clears the old cube.

## 6. Make the contact agree with the picture
The original terrain surface is:

**Excerpt** (from the shader in `terrain-shader.js` of the finished project):
```glsl
float height = 2.0 * trinoise(worldXZ).x;
```

The host evaluates that **same GLSL function on the GPU** instead of approximating its noise with a different CPU function. It encodes one height in two colour channels and reads it back. The encoded height range is −0.25 to 2.25, so audio displacement below zero is preserved. Five probes—centre plus four corners—give a conservative contact height under the cube's footprint.

Gravity changes the cube's height. When its bottom reaches the sampled ground height, the demo stops it there and displays both values. The cube is projected as a solid box onto a transparent canvas over the shader.

This is deliberately a small **height-probe demonstration**. It is not a complete terrain physics mesh or full depth-occlusion renderer. For large objects, steep terrain, rolling contact or a character walking everywhere, create a matching mesh/collider or a more complete collision model. A shader image by itself cannot supply a Havok/Matter collider automatically.

## 7. Export it
Use the editor's **Export… → HTML**, or:

**Terminal** (in the folder that contains your project folder):
```bash
nord export my-shader-app --target html
```

Serve/share the whole output folder, including the GLSL and WAV. The example requires WebGL2. If you change the shader's camera speed from its active audio-mode value of 5, update the host's `cameraZ()` to match, since that function projects the cube and reconstructs clicked positions.

The provided source did not name an author/licence; the example retains it without inventing an ownership claim. Host code and generated audio are original engine example work, credited Crowelian 2026 + Sonnet.
