---
title: 3.7 · Reuse objects between projects with asset bundles
section: Examples
order: 3.7
summary: Export an object (the analog clock) with its models, materials and scripts as one .nordpkg file, then import it into a new project (a dashboard) and drag it into the scene. Like Unity's Export Package and prefabs.
---
**Goal:** take the analog clock from page [3.5](ex-clock.html) and the digital clock from page [3.6](ex-digital-clock.html), turn each into **one file**, and use both in a brand new **dashboard** project without copying anything by hand. This is what Unity calls *Export Package / Import Package*, and what a Unity or Godot **prefab** (a saved object you can drop into any scene) is for.

**Unity names in this page:** a *prefab* is a saved entity with its children and scripts. An *asset bundle* (file ending `.nordpkg`) is a prefab **plus all the files it uses** (meshes, materials, textures, scripts, sounds). Unity: *Assets ▸ Export Package…* and *Import Package*. Godot: *Export Resource Pack* and dragging a `.tscn` into a scene.

**Download:** the finished dashboard is in `examples/clock-dashboard` (with both `.nordpkg` files in its `bundles/` folder). Allow 15 minutes.

**Before you start:** finish pages 3.5 and 3.6, or open the projects `examples/clock` and `examples/digital-clock` from the engine folder. You open the two projects one after the other: an object can only be exported from the scene it is in.

## 1 Export the analog clock

1. Open the project `clock` (`examples/clock`) in Nord.
2. In the @ui[Hierarchy], right-click the object `Clock` (the root that holds the face, the indicators and the pivots).
3. Choose **Export asset bundle…**.
4. The save dialog opens in the project's `exports/` folder with the name `Clock.nordpkg`. Press **Save**.

You see the toast *Bundle saved (6 files): …/Clock.nordpkg*, and the @ui[Console] lists the same line. The six files are the prefab, the three materials (`clock-arm`, `hour-indicator`, `seconds-arm`) and the two scripts (`Clock.js`, `HourIndicators.js`). You did not pick any of them: the engine follows every file the clock refers to.

**Terminal** (in the engine folder), the same thing without the editor:
```bash
nord bundle export Clock -p examples/clock -o /tmp/analog-clock.nordpkg
```

**Console output:**
```
  assets/materials/clock-arm.mat.json
  assets/materials/hour-indicator.mat.json
  assets/materials/seconds-arm.mat.json
  prefabs/Clock.prefab.json
  scripts/Clock.js
  scripts/HourIndicators.js
exported 6 files → /tmp/analog-clock.nordpkg
```

> **What about the primitives?** The clock is built from `mesh` components (cube, cylinder), not from a model file, so there is no `.glb` in the bundle: the primitive is stored in the prefab. An object with a 3D model (`model` component, a `.glb` from the 3D Modeler) gets the model file and its textures in the bundle the same way.

To look inside a bundle: `nord bundle info /tmp/analog-clock.nordpkg` prints each file and its size.

## 2 Export the digital clock

Repeat step 1 in the project `digital-clock` (`examples/digital-clock`): right-click `Digital Clock` ▸ **Export asset bundle…** ▸ save as `Digital-Clock.nordpkg`.

**Terminal:**
```bash
nord bundle export "Digital Clock" -p examples/digital-clock -o /tmp/digital-clock.nordpkg
```

This bundle has seven files: the prefab, the five materials and `DigitalClock.js`.

## 3 Create the dashboard project

1. @ui[New project] ▸ name `dashboard` ▸ **3D** ▸ **Create**.
2. @ui[Project] tab ▸ **Project properties**: **Physics** `none`, then press **Apply project properties**.

**Terminal:**
```bash
nord new dashboard -t 3d
```

The scene is empty. That is all the setup the bundles need: nothing from the clock projects has to be copied.

## 4 Import the bundles

1. In the @ui[Assets] panel press **Import bundle…** (the box icon in the toolbar).
2. Pick `analog-clock.nordpkg`.
3. Repeat for `digital-clock.nordpkg`.

Each import shows a toast like *Imported 'clock'. Drag Clock.prefab.json into the Hierarchy or Scene* and opens the folder `prefabs/bundles/clock/` in @ui[Assets]. You see the prefab there.

> **Import files…** also accepts a `.nordpkg`: a picked file that ends in `.nordpkg` is imported as a bundle instead of being copied into the folder.

**Terminal** (in the `dashboard` folder), the same result:
```bash
nord bundle import /tmp/analog-clock.nordpkg -p .
nord bundle import /tmp/digital-clock.nordpkg -p .
```

**Console output:**
```
imported 6 files into 'clock'
prefab: prefabs/bundles/clock/Clock.prefab.json  (drag it into a scene)
imported 7 files into 'digital-clock'
prefab: prefabs/bundles/digital-clock/Digital-Clock.prefab.json  (drag it into a scene)
```

### Where the files went

Nothing of the dashboard was overwritten: every imported file is stored under a `bundles/<name>` folder that keeps its original top folder.

| In the clock project | In the dashboard |
|---|---|
| `prefabs/Clock.prefab.json` | `prefabs/bundles/clock/Clock.prefab.json` |
| `scripts/Clock.js` | `scripts/bundles/clock/Clock.js` |
| `assets/materials/seconds-arm.mat.json` | `assets/bundles/clock/materials/seconds-arm.mat.json` |
| `scripts/DigitalClock.js` | `scripts/bundles/digital-clock/DigitalClock.js` |

The paths written inside the files were rewritten to the new places, so the prefab finds its scripts and the scripts find their materials.

**In the file** `prefabs/bundles/clock/Clock.prefab.json` (open it to check), the script and materials point at the imported copies:
```json
"scripts": [ { "path": "scripts/bundles/clock/Clock.js", "attributes": { … } } ]
```
**In the file** `prefabs/bundles/clock/Clock.prefab.json` (further down, inside a child object), a material component:
```json
{ "type": "material", "asset": "assets/bundles/clock/materials/hour-indicator.mat.json" }
```

## 5 Drag the clocks into the scene

1. In @ui[Assets] open `prefabs/bundles/clock/` and drag `Clock.prefab.json` onto the @ui[Hierarchy]. A new entity `Clock` appears, with the prefab icon.
2. Select it and set its **Position** to `-7, 0, 0`.
3. Open `prefabs/bundles/digital-clock/`, drag `Digital-Clock.prefab.json` into the Hierarchy, set its **Position** to `7, 0, 0`.
4. Add the camera and the light, as on page 3.5 section 3: @ui[Hierarchy ▸ + Create ▸ Camera] at **Position** `0, 0, −22`, and @ui[Hierarchy ▸ + Create ▸ Directional light] with **direction** `−0.321, −0.766, 0.557`.
5. @ui[Project] tab ▸ **Quality and lighting**: ambient `#8a93a3`, intensity `0.6`.
6. Press @ui[Play].

You see the analog clock on the left and the digital clock on the right, both showing your computer's time. No script was written and no material was set up in the dashboard.

**In the file** `scenes/main.scene.json`, each clock is a prefab **instance** (a few lines, not the whole clock):
```json
{ "name": "Analog Clock", "transform": { "pos": [-7, 0, 0], "rot": [0, 0, 0], "scale": [1, 1, 1] },
  "prefab": { "path": "prefabs/bundles/clock/Clock.prefab.json", "overrides": {} } },
{ "name": "Digital Clock", "transform": { "pos": [7, 0, 0], "rot": [0, 0, 0], "scale": [1, 1, 1] },
  "prefab": { "path": "prefabs/bundles/digital-clock/Digital-Clock.prefab.json", "overrides": {} } }
```

Because they are prefab instances you can change one of them in the @ui[Inspector] (a blue **●** marks a value that differs from the prefab; **✕ Revert to prefab value** undoes it) and the other stays as it is. Scale one clock `0.5` to get a small desk clock.

The finished project is `examples/clock-dashboard`.

## 6 Update a bundle later

You improved the clock in its own project. Export it again, then in the dashboard **import it again with replace** so the old copy is overwritten in place and the scene keeps working:

**Terminal** (in the dashboard folder):
```bash
nord bundle import /tmp/analog-clock.nordpkg -p . --replace
```

In the editor, **Import bundle…** never overwrites: a second import of the same bundle goes to `clock-2` (the folders `…/bundles/clock-2/`), which is handy to compare two versions side by side. Drag the new prefab in, or change `prefab.path` of the instance.

## How it works

1. **Export** reads the prefab (an object from a scene is first turned into one, with its position set to `0, 0, 0`), then looks at **every string** in it. A string that is the path of a project file (`scripts/Clock.js`, `assets/materials/…`) is a dependency. The same is done for each dependency that is text (materials, scripts, nested prefabs, animator controllers), until nothing new is found. The `.meta.json` file of each asset comes along.
2. The files are stored in a zip named `.nordpkg` with a `bundle.json` that lists every file with its size and SHA-256. The format is described in `docs/ASSET_BUNDLES.md` in the engine folder.
3. **Import** checks the list (a damaged or unsafe file is refused before anything is written), copies the files under `<top folder>/bundles/<name>/`, and rewrites the quoted paths inside the text files.

### Reference: the commands

| Command | What it does |
|---|---|
| `nord bundle export <entity> -p <project>` | export a scene entity (by name or id); `-s <scene>` picks another scene than the start scene |
| `nord bundle export --prefab <file> -p <project>` | export a prefab file |
| `-o <file>` | where to write (default `<project>/exports/<name>.nordpkg`) |
| `nord bundle info <file>` | list the files in a bundle |
| `nord bundle import <file> -p <project>` | import; `--replace` overwrites an earlier import of the same name |

## Limits and traps

> **Trap: paths built in code.** The export only sees paths written out in full. `'assets/sfx/' + name + '.ogg'` is invisible. Write each file once as a plain string somewhere in the prefab or script (a list, an attribute) so it is bundled.

> **Trap: relative paths across folders.** `import './Hands.js'` between two scripts in `scripts/` is fine. A script that reaches into another top folder with `'../assets/x.png'` gets a warning at export and can break after import. Use the project path `'assets/x.png'`.

* Bundles carry **objects**, not project settings. Input actions (`nord.project.json`), the scene's ambient light and the scene's event sheet are not in a bundle. The clocks need none of them.
* Names of things inside the scene (`EntityRef('Hours Arm Pivot')`) are looked up by name. Two copies of the analog clock in one scene are a thing to test before you rely on it.
* The browser editor cannot import `.nordpkg` yet. Use the desktop editor or the `nord bundle` command.

## Check yourself

* `nord bundle info` on the analog clock bundle lists the prefab, three materials and two scripts.
* After the import, @ui[Assets] shows `prefabs/bundles/clock/` and `scripts/bundles/clock/`, and the **Console** has no red errors.
* In play mode both clocks show the time; the seconds arm of the analog clock moves smoothly.
* If a clock appears but is white or untextured, the materials did not import: run `nord check` in the dashboard folder, it lists missing files.
* If the import refuses a file, the message says which file is damaged: export the bundle again.

Next: [Examples](examples.html) for more projects to export and reuse, or [Assets](assets.html) for the Assets panel. Back to: [Build a digital clock](ex-digital-clock.html).
