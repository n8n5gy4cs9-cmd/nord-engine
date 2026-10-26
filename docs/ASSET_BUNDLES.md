# Asset bundles (`.nordpkg`): export an object, import it anywhere

An **asset bundle** is one file that holds a prefab **and everything it needs**: 3D models, meshes, textures, materials, scripts, sounds, nested prefabs, animator controllers, shader files. You select an object in a project, press **Export asset bundle**, and get a `.nordpkg`. In any other project you **Import** it and drag the prefab into the scene. Scripts, materials and models all work without further steps.

It is Unity's *Assets ▸ Export Package / Import Package* and Godot's *Export Resource Pack* in one: a **prefab** (Unity/Godot "scene") plus an automatic dependency walk. Nord already had prefabs (`prefabs/x.prefab.json`, variants, overrides); the bundle adds the part that was missing, collecting the files and carrying them to another project. Step by step tutorial: manual page *Examples 3.7, Reuse objects between projects with asset bundles* (`docs/manual-src/ex-asset-bundles.md`).

## Use it

**Editor.**

| Do this | Where |
|---|---|
| Export an object of the open scene | @ui[Hierarchy] ▸ right-click the object ▸ **Export asset bundle…** ▸ choose where to save (starts in `exports/`) |
| Export an existing prefab | @ui[Assets] ▸ right-click `x.prefab.json` ▸ **Export asset bundle…** |
| Import | @ui[Assets] toolbar ▸ **Import bundle…**, or right-click in the Assets list ▸ **Import asset bundle (.nordpkg)…**, or **Import files…** and pick a `.nordpkg` |
| Use it | @ui[Assets] now shows `prefabs/bundles/<name>/`. Drag the prefab into @ui[Hierarchy] (or the Scene view) |

**Terminal** (`nord bundle`, in `nord-cli`):

```bash
nord bundle export "Clock" -p examples/clock -o clock.nordpkg     # entity of the start scene (or -s scenes/x.scene.json)
nord bundle export --prefab prefabs/coin.prefab.json -p . -o coin.nordpkg
nord bundle info clock.nordpkg                                    # list the contents
nord bundle import clock.nordpkg -p ../dashboard                  # --replace overwrites an earlier import
```

**AI agents (MCP):** `bundle_export` and `bundle_import` (docs/MCP.md).

## What is collected

Export follows every **string that is the path of a file in the project**, in the prefab and then, transitively, inside every JSON or script file it finds:

* component fields (`model.path`, `sprite.texture`, `material`, `audioSource.clip`, …), script `attributes`, behaviors, effects, connections, prefab `overrides`;
* scripts (`scripts/x.js`): quoted paths such as `'assets/sfx/hit.ogg'` or `import './Hands.js'`;
* materials (`*.mat.json` → textures), nested prefabs and `variantOf` bases, animator controllers, `.gltf` files and so on;
* the `.meta.json` sidecar of every asset (sprite sheet frames, filters, tags).

Never collected: `nord.project.json`, `index.html`, `runtime/`, `vendor/`, `exports/`, other `.nordpkg` files. Scene-level settings that are **not** on the entity (event sheet of the scene, global input actions, project quality settings) are not part of an object; export warns only about relative paths, so check those by hand (see Limits).

The exported prefab:

* an object from a scene becomes `prefabs/<Name>.prefab.json` in the bundle with the root saved at position `0, 0, 0` (rotation and scale are kept) so it drops in where you put it;
* a prefab *instance* exports its prefab; with overrides it exports a **variant** (`variantOf` + `overrides`) and bundles the base prefab too.

## The file format

`.nordpkg` is a zip (the same idea as `.nordaddon`). Builds are reproducible: no timestamps, files sorted.

```
bundle.json                       manifest
files/prefabs/Clock.prefab.json   every file under its original project path
files/scripts/Clock.js
files/assets/materials/clock-arm.mat.json
```

`bundle.json`:

```json
{ "format": 1, "kind": "nord-asset-bundle", "name": "Clock", "description": "", "engine": "0.5.0",
  "prefab": "prefabs/Clock.prefab.json",
  "files": [ { "path": "prefabs/Clock.prefab.json", "size": 1234, "sha256": "…" } ],
  "warnings": [] }
```

Import checks `kind`, `format`, that every path is relative and inside the project (no `..`, no absolute paths), that the prefab is listed, and the SHA-256 of every file; a damaged or foreign zip is rejected before anything is written.

## Where imported files go

Nothing in your project is overwritten. A file `<top>/<rest>` lands in **`<top>/bundles/<name>/<rest>`**, keeping the top folder so tools that expect `scripts/`, `assets/` or `prefabs/` still work:

| In the bundle | After import (bundle named `Clock`) |
|---|---|
| `prefabs/Clock.prefab.json` | `prefabs/bundles/clock/Clock.prefab.json` |
| `scripts/Clock.js` | `scripts/bundles/clock/Clock.js` |
| `assets/materials/clock-arm.mat.json` | `assets/bundles/clock/materials/clock-arm.mat.json` |

Every quoted project path inside the imported text files (`"…"`, `'…'`, `` `…` ``) is rewritten to the new location, so the prefab, materials and scripts point at each other correctly. Relative imports between files in the same folder (`import './Hands.js'`) stay valid because the folder structure is kept.

Importing the same bundle twice makes `clock-2` (so two versions can live side by side). **`--replace`** (CLI) overwrites the earlier import in place, which is how you update a bundle after changing the original.

## Limits (be honest)

* A relative path that points into a **different top folder** (a script in `scripts/` doing `import '../assets/x.js'`) is reported as a warning at export and may break after import. Use project paths (`'assets/x.png'`).
* Paths built at run time (`'assets/' + name + '.png'`) are invisible to the walk. Put such files next to a quoted reference or add them to a material/prefab so they are found.
* Scene-level and project-level data are not bundled: scene `settings`, the scene's event sheet, `nord.project.json` (input actions, physics engine, quality), addons. Objects that depend on them need those settings set in the target project. Event sheets attached to the object as a file *are* found when referenced by path.
* `EntityRef('Name')` attributes look objects up by name: if two things in the scene share the name (two copies of the same bundle), test that each copy finds its own parts.
* The browser editor cannot open `.nordpkg` files yet (no file dialog for them); use the desktop editor or the CLI.

## Code

`crates/nord-export/src/bundle.rs` (`export_entity`, `export_prefab`, `read_manifest`, `import`), the CLI in `crates/nord-cli/src/main.rs` (`nord bundle`), editor: `prefab.rs` (`export_bundle_*`, `import_bundle`), `panels/hierarchy.rs`, `panels/assets.rs`. Tests: `cargo test -p nord-export bundle`, `cargo test -p nord-editor --test ui asset_bundle`. Example: `examples/clock-dashboard`.
