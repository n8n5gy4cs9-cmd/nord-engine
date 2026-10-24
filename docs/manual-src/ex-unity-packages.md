---
title: 36 · Unity packages and features: what to use in Nord
section: Examples
order: 36
summary: Cinemachine, TextMeshPro, Input System, DOTween, NavMesh, Timeline, Addressables, Shader Graph, Localization, Netcode and more, mapped to Nord.
---

| Unity package / feature | In Nord | Notes |
|---|---|---|
| **Cinemachine** | `camera` component (`follow`, `lerp`, `deadzone`, `bounds`), library `camera-follow.js`, `camera-cinematic.js`, `camera-shake.js`, `camera-zoom.js`, 3D `camera-follow3d.js`, `orbit-cam.js` | no virtual-camera blending; switch with `getComponent('camera').activate()` (3D) |
| **TextMeshPro** | `text` component (world text), `ui.label`, UI Designer labels (rich text, outline, bold, fonts) | many bundled fonts, including pixel fonts ([UI](ex-ui-hud.html)) |
| **Input System** | project **actions** (`input.actions`), gamepad, touch (`ui-joystick.js`) | rebinding at runtime: [Options menu](ex-settings-menu.html) |
| **DOTween / LeanTween** | `this.tween(target, to, opts)`, `util-tween.js`, `tween-fade` snippet | easing names, yoyo, repeat, delay |
| **NavMesh / A\*** | `ai-astar.js` (grid), `click-move.js`, `ai-waypoints.js`, `ai-patrol.js` | no navmesh baking: grid or waypoints |
| **Timeline** | **Timeline** tab (tracks, keyframes) and scene `timelines` | cutscenes, camera moves ([Effects](effects-particles-timelines.html)) |
| **Animation / Animator** | Animation tab (clips), **Animator** tab (state machine), `animatedSprite`, `model.play` | [Animation](ex-animation.html) |
| **2D Tilemap, Rule Tiles** | `tilemap` + tilemap painter with terrain auto-tiling; `proc-autotile.js` | [Tilemaps](ex-tilemap-levels.html) |
| **2D Physics / 3D Physics** | arcade / matter (2D), Havok (3D) | [Physics recipes](ex-physics-recipes.html) |
| **Particle System / VFX Graph** | `particles` component + particle editor, `fx-particle-presets.js` | CPU particles (2D Phaser / 3D Babylon) |
| **Post-processing, URP volumes** | scene effects (2D) and the `postProcess` component (3D): bloom, vignette, tonemap, grain, colour grading | [Effects](effects-particles-timelines.html) |
| **Shader Graph / HLSL** | GLSL snippets in `library/shaders/` and material properties | outline, toon, dissolve, water… |
| **Lighting / light probes** | `light` component (+ `light2d.js`, `light2d-source.js` for 2D lights) | no baked lightmaps |
| **Addressables / Resources** | files loaded on demand: `scene.spawn(path)`, `game.loadJSON(path)`, `loadScene(path)` | everything is a file path; the build includes the project folder |
| **ScriptableObject** | JSON + `ScriptableObject.Load` | [Data assets](ex-data-assets.html) |
| **Localization package** | `strings` tables + `textKey` + `game.i18n` | [Options menu](ex-settings-menu.html) |
| **UI Toolkit / uGUI** | UI Designer (`.ui.json`) and `this.ui.*` | HTML-based, always sharp |
| **ProBuilder** | **3D Modeler** | [3D Modeler](modeler.html) |
| **Netcode / Mirror / Photon** | `game.net` (WebRTC peer to peer: host/join, spawn, netSync, RPC) | [Multiplayer](ex-multiplayer.html); no dedicated servers |
| **Save systems (Easy Save…)** | `game.save` slots, `save-slots.js` | JSON in the browser/app storage |
| **Unity Test Framework** | Node's `node --test` for logic, a headless browser smoke test for gameplay | [Testing](ex-optimization-testing.html) |
| **Profiler** | built-in profiler tab and `game.enableDebug()` | per-phase and per-script cost |
| **Cinemachine Impulse / Feel** | `game.camera.shake`, `fx-hitstop.js`, `ui-damage-numbers.js`, tweens | [Juice](ex-juice-effects.html) |
| **Visual Scripting / Bolt / PlayMaker** | **Event sheets** and **Graph** tabs | no-code logic |
| **Version control / Collab** | the project is plain JSON + JS: use Git | scene and prefab files merge well |
| **Asset Store** | the **Library** tab (ready-made scripts, prefabs, kits) and `.nordaddon` addons | `nord addon install` |
| **Burst / Jobs / DOTS** | – | not needed at this scale; keep entity counts reasonable and pool |
| **ML-Agents, Ads, IAP, Analytics** | – | out of scope for a local web/desktop engine |
| **Custom editors / gizmos** | `static attributes` with labels, tooltips, ranges; Library `@nord` header | the Inspector is generated from attributes |
| **WebGL build** | `nord build` (the main target) | [Build and publish](ex-build-publish.html) |
| **Standalone build (Win/Mac/Linux)** | `nord bundle-mac`, `nord bundle-portable` | [Build and publish](ex-build-publish.html) |
