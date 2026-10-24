---
title: 29 · The editor for Unity users
section: Examples
order: 29
summary: Where every Unity window, menu and workflow lives in the Nord editor, with screenshots: layout, Hierarchy, Inspector, prefabs, materials, build settings, animation, particles.
---

If you have used Unity you already know this editor. This page maps the windows and the daily actions. (Menus are on the macOS menu bar; shortcuts follow Unity: Cmd instead of Ctrl.)

<figure class="shot"><img src="assets/screenshots/ed-unity-layout.png" alt="The Unity 2 by 3 layout: Hierarchy, Scene and Game side by side, Inspector on the right, Assets below" loading="lazy"><figcaption><b>Window ▸ Layout ▸ Unity 2 by 3</b>: Hierarchy, Scene, Game, Inspector, Assets and Console.</figcaption></figure>

## Windows
| Unity | Nord editor | Notes |
|---|---|---|
| Hierarchy | **Hierarchy** tab | right-click ▸ Create child, Create prefab, Unpack; drag to reparent; F2 renames |
| Scene view | **Scene** tab | Q hand, W move, E rotate, R scale, T rect; F frames; snapping with the magnet; 2D and 3D |
| Game view | **Game** tab | Play runs here; *Maximize on Play*, Fullscreen, Stats |
| Inspector | **Inspector** tab | Transform grid, components with ⋮ menus, **+ Add component**, **+ Add script**, prefab override markers |
| Project window | **Assets** tab | folders and a thumbnail grid; colour folders, tags and descriptions ([Organising](organise-project.html)) |
| Console | **Console** tab | tags, search, collapse, pause on error, double-click to open the file |
| Animation / Animator | **Animation** tab, **Animator** tab | clips from frames; state machine controllers |
| Timeline | **Timeline** tab | tracks and keyframes |
| Particle System | `particles` component + **Particles** tab | |
| Package Manager | **Library** tab | ready-made scripts, prefabs and kits you insert with one click |
| Profiler | **Window ▸ Profiler** | phases, per-script cost, network |
| UI Toolkit / Canvas | **UI Designer** tab | |
| Visual Scripting / Bolt | **Event sheets** and **Graph** tabs | no-code logic |
| ProBuilder | **3D Modeler** tab | |
| (no equivalent) | **Notes** tab | project notes and tasks |

## Create things (GameObject menu)
**GameObject / Hierarchy ▸ + Create** makes empty objects, sprites, text, lights, cameras, 3D shapes, UI elements. Drag an image from Assets onto the Scene view to make a sprite object at that spot; drop a model to make a `model` object; drop a script onto an object to attach it.

<figure class="shot"><img src="assets/screenshots/ed-new-scene.png" alt="The New scene dialog with a template list" loading="lazy"><figcaption><b>File ▸ New scene</b>: start from an empty scene or a template.</figcaption></figure>

## Components and scripts
Select an object ▸ Inspector ▸ **+ Add component** (sprite, rigidbody, collider, trigger, camera, light, audioSource, text, tilemap, particles, animator, netSync…) or **+ Add script**. A script's `static attributes` become fields ([First script](ex-first-script.html)).

## Prefabs
Right-click an object ▸ **Create prefab** (or drag it to Assets). Instances show blue changed values with a revert button; **Open prefab** edits it alone; **Create variant** makes a variant; **Unpack** breaks the link. ([Unity-style workflow](unity-workflow.html))

## Materials and 3D
**Assets ▸ Create ▸ Material** makes a shared `*.mat.json` with a lit preview ball.

<figure class="shot"><img src="assets/screenshots/ed-material-asset.png" alt="Inspector with a material asset and a lit preview sphere" loading="lazy"><figcaption>A material asset: colour, metallic, roughness, texture, emissive.</figcaption></figure>

## Build settings
**File ▸ Build Settings** lists the start scene, target and options; Export builds a folder, a zip, a single file, a Mac app or a desktop bundle.

<figure class="shot"><img src="assets/screenshots/ed-build-settings.png" alt="The Build Settings window" loading="lazy"><figcaption><b>File ▸ Build Settings</b>.</figcaption></figure>

## Particles and timelines
<figure class="shot"><img src="assets/screenshots/ed-particles.png" alt="The particle editor with a live preview" loading="lazy"><figcaption>The particle editor: live preview next to the settings.</figcaption></figure>

## Code editor
Scripts open in the **Code** tab (syntax colours, completion with the Nord API, find, project search, errors from the Console link to the line). You can also edit scripts in any external editor: the project is plain files and the editor reloads them.

## Keyboard shortcuts you already know
`Cmd+S` save, `Cmd+Z / Shift+Cmd+Z` undo / redo, `Cmd+C / V / D` copy / paste / duplicate, `Delete`, `W E R` move / rotate / scale, `F` focus, `Cmd+R` play (and stop), `Cmd+.` stop, `Cmd+K` command palette, `Cmd+P` quick open a file, `Cmd+Shift+F` search in project, `Cmd+1/2/3/4` show Scene / Game / Code / Assets, `Cmd+,` settings. Rebind them in **Settings ▸ Shortcuts**.

## Differences to keep in mind
* There is **no compile step** and no "domain reload": press Play and the new code runs; saving a script during play hot-reloads it.
* Scene and prefab files are readable JSON: they merge in Git. Meta files exist only for images (`.meta.json` next to a PNG for import settings, sprite animations, collision outline).
* A scene is built when it loads; everything in the Hierarchy at Play start is what runs. Nothing is left over from edit mode.
* Scripts are plain JavaScript modules: see [the migration guide](ex-migration.html).
