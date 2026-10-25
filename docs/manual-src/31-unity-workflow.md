---
title: Unity-style workflow
section: Manual
group: Projects, objects and scripts
order: 31
summary: Layouts, menus, Scene-view tools, prefabs, materials, Build Settings, Game view, New scene and the first-10-minutes checklist.
---

## Use this page

This chapter explains **unity-style workflow**. Open a saved project before following editor steps. Use the topic links below for a specific task; follow [Tutorials](tutorials.html) when you want a complete project to build in order.

| Find the instructions for | Go to |
|---|---|
| Layouts and menus | [Read this section](#layouts-and-menus) |
| The Scene view | [Read this section](#the-scene-view) |
| Inspector, Hierarchy and prefabs | [Read this section](#inspector-hierarchy-and-prefabs) |
| Materials and import settings | [Read this section](#materials-and-import-settings) |

::: dummies
This is a reference chapter: you do not have to complete every section. Choose one task, make that change in the editor, and press Play to check the result. An **entity** is an object in your scene; a **component** adds a capability; a **script** adds your own rules.
:::

Nord Engine edits the way Unity does: Hierarchy, Inspector, Project, a Scene view and a Game view, with prefabs, material assets and Build Settings. This chapter is the quick tour. Screenshots show the native editor panels; the Scene and Game views are native web views that appear in the same places in the real window.

<figure class="shot"><img src="assets/screenshots/ed-unity-layout.png" alt="The Unity 2 by 3 layout: Hierarchy, Scene and Game side by side, Inspector on the right, Assets below" loading="lazy"><figcaption>Window ▸ Layout ▸ <b>Unity 2 by 3</b>: Hierarchy on the left, Scene and Game side by side, Inspector on the right, Assets / Console / Project below. The orange rail on the far left holds the tools.</figcaption></figure>

## Layouts and menus
**Window ▸ Layout** has *Unity 2 by 3*, *Unity Wide* (Game under Scene) and *Unity Tall*, plus the earlier 2D, 3D, Coding and Visual presets. Drag any tab to rearrange; the layout is remembered.

<figure class="shot"><img src="assets/screenshots/ed-layout-wide.png" alt="The Unity Wide layout with Game under Scene" loading="lazy"><figcaption><b>Unity Wide</b>: Scene on top, Game below it, tabs at the bottom.</figcaption></figure>

The menu bar follows Unity: **File** (New scene, Build Settings), **Edit**, **Assets** (Create ▸ folder, script, MonoBehaviour / Singleton / GameManager script, UI screen, graph, material), **GameObject** (every preset: cube, sphere, camera, light, UI, spawner…), **Component** (adds a component to the selected entity), **Window** (panels and layouts), **Project** (Play, Validate, Export) and **Help**.

## The Scene view
| Key | Tool |
|---|---|
| Q | Hand: drag to pan |
| W / E / R | Move / Rotate / Scale |
| T | Rect |
| F / Shift+F | Frame selected / Frame all |
| Cmd+Shift+F | Align camera with Scene view: the selected camera (else the active one; a new *Main Camera* if the scene has none) takes the Scene view's position and direction (2D: centre and zoom). Also in the Edit menu |

* **Navigation (3D):** Alt+left-drag orbits, Alt+Cmd+left-drag or middle-drag pans, the wheel zooms, hold the right button to look around and fly with WASDQE (Shift = faster, wheel = speed), Alt+right-drag zooms. **2D:** Alt+left-drag, middle-drag, right-drag or the Hand tool (Q) pans, the wheel zooms. The **axis gizmo** in the top-right corner of the 3D view shows where you are looking; click an axis to look along it.
* **FPS Level and 2D Level editors** use the same navigation: middle/right-drag, Space or Q (2D Level) pans, the wheel zooms about the cursor, **Ctrl/Cmd** flips snapping while dragging, **Home** fits everything and **Shift+F** frames the selection.
* **Local / Global** and **Pivot / Center** toggles sit in the toolbar and on the tool rail. Local makes the move and rotate gizmos follow the object. With several objects selected, **Pivot** puts the gizmo on the main object and **Center** puts it in the middle of the selection.
* **Snapping:** the magnet button turns snapping on; hold **Ctrl/Cmd** while dragging to flip it for one drag. Step sizes are in Settings.
* **Selecting:** click, Shift/Ctrl+click to add or remove, and in 2D drag on empty space for a marquee. Selected objects are outlined. The gizmo moves, rotates or scales every selected object together about the pivot, and a drag on empty space draws a marquee in both 2D and 3D.
* **Drag an asset** from Assets over the Scene view to see a ghost; drop it to create an entity there (snapping applies). Dropped **on an object** (in the Scene view or on a Hierarchy row), an image becomes that object's sprite, a model its model, a sound its audio source, a material its material, and a script is attached.
* The bar above the Scene has the scene name, projection, a **Gizmos ▾** menu (grid, camera/light icons, collider outlines), the Local/Global, snap and frame buttons, and a big **Play** button.

## Inspector, Hierarchy and prefabs
Each Hierarchy row has an **Active** checkbox; prefab instances are blue. Hover a row for its **lock** (not pickable in the Scene view) and **eye** (hidden in the Scene view) buttons; both only affect the editor. Every Inspector component has an **Enabled** checkbox (off = the component is not created in the game) and a **⋮** menu (Reset, Copy / Paste values, Move up / down, Docs, Remove). **+ Add component** is searchable and grouped (Rendering, Physics, Audio, UI, Gameplay, Effects). **Debug mode** at the bottom of the Inspector shows the entity's raw JSON. The padlock at the top keeps the Inspector on one entity while you click around. Under **Signals**, a ▾ next to the method box lists the methods found in the target's scripts.

**Prefabs:** right-click an entity ▸ **Create prefab**, or drag it from the Hierarchy onto the Assets panel. The entity becomes an instance. Changed fields show a blue marker and a revert button; the Inspector offers **Apply all** (write the instance's overrides into the prefab file), **Revert all overrides**, **Unpack** and **Unpack completely** (also unpacks nested prefabs). Next to each changed field the ⬆ button applies just that value to the prefab. The entities inside a prefab are listed under the instance in the Hierarchy; click one to change its components, scripts or effects. Those changes are stored as overrides on the instance.

**Prefab mode and variants:** right-click a prefab in Assets (or press *Open prefab* on an instance) to edit it on its own; the bar above the Scene shows **◀ Scene › Prefab: name** and leaving saves automatically. **Create variant** makes a new prefab that points at the original (`variantOf`) and stores only its own overrides, so later changes to the original flow into the variant.

**Several objects at once:** select more than one entity and the Inspector shows **Active** and **Transform** for all of them (mixed values show "—"; typing a value sets it on every one) and **Add component to all**.

## Materials and import settings
**Assets ▸ Create ▸ Material** makes a `*.mat.json` file. Select it to edit it in the Inspector, then set a `material` component's **asset** field to share it.

<figure class="shot"><img src="assets/screenshots/ed-material-asset.png" alt="Inspector showing a material asset with colour, metallic, roughness and a preview sphere" loading="lazy"><figcaption>A material asset in the Inspector: colour, metallic, roughness, textures, tiling and offset, with a quick preview sphere.</figcaption></figure>

Material previews are lit spheres (also used as Assets thumbnails). Select an image to set **Filter** (nearest = crisp pixels), **Wrap**, **Pixels per unit**, **Pivot** (nine presets, or the custom point from the Sprite editor), **Max size** (bigger images are scaled down when the game loads; sprites keep their size in the world) and open it in the **Sprite editor**. Select a model to set its **Scale** and, under **Materials**, to replace each material stored in the model with one of your material assets. Settings are stored next to the file as `<name>.meta.json`. In Assets, the ★ button filters to your favourites (right-click ▸ Favourite) and right-click ▸ **Find references** searches the project.

## New scene, Build Settings and the Game view
**File ▸ New scene…** asks for a name and a template (empty, 2D starter, 3D starter, UI host).

<figure class="shot"><img src="assets/screenshots/ed-new-scene.png" alt="The New scene dialog with a name box and template choices" loading="lazy"><figcaption>New scene with templates.</figcaption></figure>

**File ▸ Build Settings…** (Shift+Cmd+B) lists the scenes: untick a scene to leave it out of web exports; the radio sets the start scene (always included). **Build** exports; **Build And Run** exports a single-file page and opens it. Desktop apps use the Desktop app dialog. **Android / iOS ▸ Mobile project** writes `dist/mobile`: your game in `www/` plus a Capacitor wrapper and `README-MOBILE.md`; run `npx cap add android` or `npx cap add ios` there (Android Studio / Xcode needed) to get the native project.

<figure class="shot"><img src="assets/screenshots/ed-build-settings.png" alt="The Build Settings window with scenes in build and a platform list" loading="lazy"><figcaption>Build Settings.</figcaption></figure>

The Game view toolbar has a **Resolution** drop-down (phone, 16:9, 4:3, portrait…), a scale slider, **Maximize on Play**, **Error Pause** (pauses the game when an error is logged), a camera screenshot button (saved in `screenshots/`) and **Stats** (an fps overlay).

**Profiler and play-mode edits:** **Window ▸ Profiler** shows fps, a frame-time graph, object count, draw calls, memory and the slowest event-sheet blocks of the running game. While playing, the Inspector edits the live entity; **Apply to scene** writes its transform, active flag and existing field values into the saved scene.

**Tools:** event sheets have *Find in sheet*, a *Parameters* form for the selected condition or action (colour picker, checkbox, number drag, text with autocomplete), a green highlight on events that ran in the last moments while the game plays, and F1 over a condition or action opens its manual section. The node graph has *Group*, a minimap, *Docs* (F1), *Arrange*, **Make subgraph** (moves the selected nodes into their own graph file and leaves one *Run Graph File* node; two values go in as `a`/`b` and come back through a *Return* node) and a live green flash on nodes that run while the game plays. The UI Designer has an anchor preset grid, Copy / Paste (Ctrl/Cmd+C / V), on-canvas resize handles, a **canvas scaler** on the root node, sprite swap states for buttons, skin tints and **Make UI prefab** (a node saved as its own `.ui.json` and used through instance nodes).

## Shortcuts and the checklist
**Settings ▸ Shortcuts** lists every editor shortcut with its Unity default. Click a key box and press the new keys to rebind it (Esc cancels, ↺ restores the default; orange means two actions share the keys). **Help ▸ First 10 minutes** shows a checklist that ticks itself as you make an entity, attach a script, press Play, save and build.

<figure class="shot"><img src="assets/screenshots/ed-first-10-minutes.png" alt="The First 10 minutes checklist with progress bar" loading="lazy"><figcaption>The checklist.</figcaption></figure>

## Writing scripts the Unity way
See *Unity-style scripting* in [Scripting](scripting.html): `MonoBehaviour`, `Singleton`, `GameManager`, coroutines, `Mathf`, `Vector3`, `Time`, `Input.GetAxis` and more, with ready-made script templates in Assets ▸ Create.


## Check yourself

- Save the project, then repeat the action from the section you used. Confirm the stated result before moving on.
- If Play fails, check the Console for the first error and compare file paths and capitalisation with the example.
- For platform or feature limits, check [Known issues](known-issues.html).
