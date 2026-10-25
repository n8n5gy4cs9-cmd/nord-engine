---
title: Assets
section: Manual
group: 2D and 3D worlds
order: 11
summary: Importing, thumbnails, spritesheets, models, audio, fonts, optional packs.
---

Assets are the pictures, models, sounds and fonts your project uses. Store them inside the project and refer to them with a relative path.

::: dummies
assets/hero.png means the hero.png file inside your project’s assets folder. Spelling and capitals must match. A thumbnail is only a preview; the original file is what gets exported.
:::

Everything lives under `assets/`. Drag files from Finder into the **Assets** panel to import them (they are copied into the project). Paths in scenes are project-relative strings, e.g. `assets/sprites/hero.png`.

| Type | Formats | Notes |
|---|---|---|
| Images | PNG (also JPG/WebP) | spritesheet info in a `.meta.json` sidecar |
| Audio | WAV, OGG, MP3 | prefer OGG/WAV for loops; Rust tier: WAV/OGG only |
| Models | glTF / GLB | animations become named clips |
| Maps | Tiled JSON, Nord simple maps | |
| Data | JSON | load with `game.loader.json(path)` |
| Fonts | TTF/OTF/woff2 | UI fonts ship in `vendor/fonts` |

## Sidecar metadata
Only when non-default: `assets/foo.png.meta.json`
```json
{ "type": "spritesheet", "frameWidth": 32, "frameHeight": 32,
  "anims": { "walk": { "frames": [0, 3], "fps": 10, "loop": true } },
  "filter": "nearest", "tags": ["character"] }
```

### Import settings in the Inspector
Select an image in Assets to edit `<image>.meta.json`: **Filter**, **Wrap**, **Pixels per unit** (sprites are drawn at size ÷ value), **Pivot** (nine presets, or the custom point set in the Sprite editor, which you open with the button below) and **Max size** (larger images are scaled down when the game loads; sprites keep their size in the world). Select a model to set **Scale** and, under **Materials**, replace each material stored in the model with one of your `*.mat.json` assets (`"materials": { "<name in the file>": "assets/materials/x.mat.json" }`). Pivot presets and max size are applied by the 2D (Phaser) backend; the 3D backend applies filter, wrap, scale and the material remap.

## Thumbnails
`nord thumbs` (and the editor, lazily) write previews to `.nord-cache/thumbs`: real images, first sprite frame with a badge, audio waveforms, models rendered in the 3D view and materials as lit spheres (the thumbnail follows the texture a material uses).

## Built-in placeholder art
The engine ships generated placeholder textures, sprites, UI, audio and skyboxes, so a new project is never empty. `ASSETS.md` in the repository lists each group and how to replace it.
Replace a file at the **same path and format** and nothing else needs to change.

## Optional packs {#optional-packs}
Ready-to-use art lives in `assets/packs/`:

| Pack | Contents | Licence |
|---|---|---|
| `kenney-platformer-3d` | Kenney 3D Platformer Kit: glTF character, coin and platform models, six OGG sound effects, sprites | CC0 |
| `level2d-kenney` | Kenney terrain, character, industrial, dungeon, sports and shooter sprites used by the [2D Level Creator](level-creator-2d.html) | CC0 |
| `nord-amiga` | The original Amiga-style sprite collection used by the 2D Level Creator | Nord Engine (MIT) |

Re-fetch the downloadable packs with `tools/fetch-packs.sh`. Copy what you need into your project's `assets/`; the 2D Level Creator copies only the sheets a level uses.

## Rules
* Only use assets you may redistribute. Record packs' licences in `THIRD_PARTY.md`.
* Never reference remote URLs — builds fail the offline check (`nord check-offline`).
* Keep texture sizes sensible (see [Performance](performance.html)).

## Right-click and shortcuts in the Assets panel
Works on the folder tree (left), on files and folders (right) and on the empty background:

* **Files and folders:** Open, Open with default app, Rename (**F2**), Duplicate (**⌘/Ctrl+D**), Delete (**Del**), Reveal in Finder / Show in Explorer, Copy path.
* **Folders (and empty background):** New folder, New UI scene (`.ui.json`), New script (`.js`); the new item starts in rename mode.
* **Background:** also Import files…, Refresh.
* Click selects (highlighted); drag a file onto a folder in the tree to move it; drop files from Finder to import.


## Check yourself

- Save the project, then repeat the action from the section you used. Confirm the stated result before moving on.
- If Play fails, check the Console for the first error and compare file paths and capitalisation with the example.
- For platform or feature limits, check [Known issues](known-issues.html).

Next: [Choose a worked example](examples.html). Back to: [Manual reading paths](manual-paths.html).
