---
title: 41 · Convert a Unity project or tutorial (for you and for AI)
section: Examples
order: 41
summary: A step-by-step playbook, mapping tables and prompts to turn any Unity tutorial or whole C# codebase into a Nord project. Written so an AI agent can follow it.
---

This page is the **playbook** for moving a Unity game (or following a Unity tutorial) into Nord. It is written for a person *and* for an AI agent: give the AI this page (`nord_guide {topic:"unity-conversion"}` over MCP) and it can do most of the work.

## The 7 steps
1. **Inventory** the Unity project. With MCP: `unity_scan {path}`. By hand: list `Assets/Scenes`, `Assets/Prefabs`, every `.cs` file, `Packages/manifest.json`, `ProjectSettings/TagManager.asset` (tags and layers), `InputManager.asset` (axes).
2. **Create the Nord project** (`project_new`, pick the 2D or 3D template) and set the display size to match the Unity Game view.
3. **Copy assets**: sprites to `assets/`, audio to `assets/`, models (`.glb`/`.fbx` converted to `.glb`) to `models/`. Skip `.meta`, `Library/`, `Temp/`.
4. **Convert scenes and prefabs** (`unity_scene_to_nord`) to get entities, hierarchy, transforms, sprites, colliders and script references. Everything it cannot map is printed in `todo`.
5. **Rewrite every script** from C# to a Nord script (rules below). Use `unity_cs_outline` as the checklist: fields become attributes, lifecycle methods map one to one.
6. **Rebuild UI, input, audio and settings** (tables below).
7. **Verify**: `check_project`, play it (`serve_start`), compare against the Unity build side by side, tick the checklist at the end.

## What maps to what
| Unity | Nord |
|---|---|
| `.unity` scene, `.prefab` (YAML) | `scenes/*.scene.json`, `prefabs/*.prefab.json` |
| GUID in `.meta` files | not needed: Nord references files by project path |
| `GameObject` + components | entity + components (`sprite`, `collider`, `rigidbody`, `camera`, `light`, `audioSource`, ...) |
| `MonoBehaviour` | script class extending `NordScript` (or `MonoBehaviour` from the Unity layer, see [Migration](ex-migration.html)) |
| `[SerializeField]` / public field | field in the class, shown in the Inspector (`attributes` in the scene file) |
| `ScriptableObject` | JSON file in `data/` loaded with `game.assets` (see [Data assets](ex-data-assets.html)) |
| `Canvas` + UGUI/TextMeshPro | a `.ui.json` scene made in the UI Designer ([HUD](ex-ui-hud.html)) |
| `Input.GetAxis` / Input System | `game.input.actions` ([Input](ex-input-movement.html)) |
| `Animator` + controller | Animator JSON ([Animation](ex-animation.html)) |
| `Tilemap` | tilemap editor ([Tilemaps](ex-tilemap-levels.html)) |
| Cinemachine, Packages | [Unity packages](ex-unity-packages.html) |
| Mirror, Netcode, Photon | rewrite with Nord multiplayer ([Multiplayer](ex-multiplayer.html)) |
| `UnityEditor` code, custom inspectors | drop them: the editor is different |

## Units, axes and sizes (the usual 2D traps)
- **Pixels, not units.** Unity 2D uses world units (default 100 pixels per unit, see the sprite import setting). Nord 2D uses pixels. Multiply positions and sizes by pixels-per-unit. `unity_scene_to_nord` does this (parameter `pixelsPerUnit`).
- **Y points down in Nord 2D.** Unity Y is up. Flip the sign of Y positions, of upward velocities and of `Vector2.up` forces. Rotation direction flips too.
- **Camera size.** Unity "Orthographic Size 5" shows 10 units of height. In Nord set the display height (e.g. 1000 px at 100 px/unit) and the camera zoom.
- **Gravity** is in px/s^2: Unity `-9.81` units/s^2 is about `981` px/s^2 downwards at 100 px/unit.
- **3D keeps world units and Y up.** Rotations are in degrees. Check the model's forward axis after importing.
- **Z order:** Unity sorting layers / order in layer become entity `layer` and the sprite's draw order. Check that the background really is behind.

## C# to Nord script: the rules
| C# | Nord JS |
|---|---|
| `class Player : MonoBehaviour` | `export default class Player extends NordScript` |
| `Awake / Start / Update / FixedUpdate / LateUpdate` | `init / start / update(dt) / fixedUpdate(dt) / lateUpdate(dt)` (lowercase) |
| `OnEnable / OnDisable / OnDestroy` | `onEnable / onDisable / onDestroy` |
| `Time.deltaTime` | the `dt` argument |
| `transform.position += v * speed * Time.deltaTime` | `this.entity.x += vx * speed * dt` |
| `GetComponent<Rigidbody2D>()` | `this.entity.rigidbody` / `this.entity.setVelocity(x, y)` |
| `Instantiate(prefab, pos, rot)` | `await this.game.spawn('prefabs/x.prefab.json', { x, y })` ([Spawn](ex-spawn-destroy.html)) |
| `Destroy(go, 2f)` | `entity.destroy()` / `this.after(2, () => entity.destroy())` |
| `StartCoroutine(Routine())` + `yield return new WaitForSeconds(1)` | `async` method with `await this.wait(1)` ([Coroutines](ex-time-coroutines.html)) |
| `OnTriggerEnter2D(Collider2D c)` / `OnCollisionEnter2D` | `onTriggerEnter(other)` / `onCollisionEnter(other)` ([Collisions](ex-collisions.html)) |
| `CompareTag("Coin")` | `other.hasTag('Coin')` |
| `FindObjectOfType<T>()`, `GameObject.Find` | `this.game.find(name)` / the singleton ([Game manager](ex-game-manager.html)) |
| `public static X Instance` | `Singleton` base class |
| `UnityEvent`, `event Action` | `EventBus` / `this.on('name', fn)` ([Events](ex-events.html)) |
| `PlayerPrefs` | `PlayerPrefs` (same names) or `game.save` ([Save/load](ex-save-load.html)) |
| `SceneManager.LoadScene("Level2")` | `this.game.loadScene('scenes/level2.scene.json')` |
| `Debug.Log` | `console.log` / `Debug.log` |
| `Random.Range(a, b)` | `this.game.rng.range(a, b)` (ints: `rng.int`) |
| `AudioSource.Play()` | `this.game.audio.play('assets/x.wav')` ([Audio](ex-audio.html)) |

Do not rename a *field* to a lifecycle name (`start`, `update`, ...): it replaces the method (see the migration traps).

## Prompt templates for an AI
**Whole project**
> Convert the Unity project at `/path/to/UnityProject` to my open Nord project. Read the guide topics `unity-conversion` and `ex-migration`. Run `unity_scan`, plan the order (scenes, prefabs, scripts, UI, audio), convert each scene with `unity_scene_to_nord`, rewrite every script (use `unity_cs_outline`), run `check_project` after each batch, and play the result. At the end list what could not be converted.

**One tutorial**
> I am following this Unity tutorial: (paste text and C# code). Build the same thing in my Nord project step by step. Read `unity-conversion` first. After each step run `check_project`, and describe how to test it.

**One script**
> Rewrite this C# script as a Nord script. Keep the same field names so the Inspector values still match. Use the mapping table in `unity-conversion`. (paste C#)

With MCP the prompts `convert-unity-project` and `convert-unity-tutorial` give the same instructions.

## Verification checklist
- [ ] `check_project` reports no errors; the game starts without red console lines.
- [ ] Same start position, camera framing and background as the Unity Game view.
- [ ] Movement speed and jump height feel the same (compare numbers after the pixels-per-unit conversion).
- [ ] Every Unity tag/layer you used is a Nord tag/layer; collision pairs still hit (or ignore) the same objects.
- [ ] Every serialized prefab reference (`coinPrefab: {fileID: 0}` in YAML) is assigned again in the Inspector.
- [ ] Audio plays once, not looped by accident; music starts in the right scene.
- [ ] UI scales on a small and a large window ([Mobile](ex-mobile-touch.html)).
- [ ] Save, load and scene changes still work ([Scenes](ex-scenes.html)).
- [ ] Build and run the exported game ([Build](ex-build-publish.html)).

## What is not converted
Shaders and Shader Graph (rebuild with the effects library), custom editors, `NavMesh` bake data, terrain, baked lighting, `Animation` clips from `.anim` (recreate in the Animation editor), and anything from a paid asset package: check the package licence before copying its art or code.
