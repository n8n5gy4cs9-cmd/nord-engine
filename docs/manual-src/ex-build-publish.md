---
title: 38 · Build, publish and ship
section: Examples
order: 38
summary: Run, build for the web, single-file and PWA, itch.io / GitHub Pages / Netlify, Mac / Windows / Linux apps, and the checks before you ship.
---

**Goal:** from "it runs in the editor" to something a friend can open.

## Run
* In the editor: @ui[Play] (Cmd+R) runs the game in the Game panel; *Open in browser* opens the same game in a real browser tab.
* From a terminal: `nord serve my-game` starts the dev server with live reload (`http://localhost:4173`); `nord serve my-game --lan` also gives phones on your Wi-Fi a link with a secret token.

## Check before you build

**Terminal** (in the folder that contains your project folder):
```bash
nord check my-game             # validates scenes and prefabs: unique ids, missing files, bad references
nord check-offline my-game     # fails if anything loads from an external web address (the game must work offline)
```
The editor's Console has **Validate project**, and the same checks run when you export.

## Build for the web (Unity: WebGL build)

**Terminal** (in the folder that contains your project folder):
```bash
nord build my-game                         # auto target, output in my-game/dist
nord build my-game -t web-2d -o out        # or html | web-2d | web-3d | web-3d-pc | web-wasm-game | web-wasm-app
nord build my-game --minify --optimize     # smaller JS/JSON, recompressed PNGs (and WAV to MP3 when ffmpeg is installed)
nord build my-game --single-file           # ONE index.html with everything inside: works from file:// and as an email attachment
nord build my-game --zip                   # also writes out.zip (for itch.io style uploads)
nord build my-game --pwa                   # installable offline web app: manifest + service worker (Add to Home Screen)
```
The output folder is static files: upload it anywhere. **File ▸ Build Settings** in the editor offers the same options with buttons.

## Hosting presets

**Terminal** (in the folder that contains your project folder):
```bash
nord build my-game --zip --host itch              # itch.io: a zip you upload as an HTML5 game
nord build my-game --host github-pages            # adds the files GitHub Pages needs
nord build my-game --host netlify                 # or vercel | docker  (adds the deploy files next to the build)
```
The presets only write files; the upload itself is yours (drag the folder / zip to the site, or `git push`).

## Desktop apps (Unity: Windows / macOS / Linux builds)

**Terminal** (in the folder that contains your project folder):
```bash
nord bundle-mac my-game --name "My Game" --icon icon.png --dmg          # macOS .app (and a .dmg), builds the project first
nord bundle-portable my-game --os windows --name "My Game"             # a folder + zip for Windows
nord bundle-portable my-game --os linux  --name "My Game"              # a folder + tar.gz for Linux
```
They wrap your web build in the small prebuilt `nord-player` shell (a native window with a web view); no compiler needed. Details and signing notes: [Desktop apps](desktop-apps.html), [Export](export.html).

## Project settings that matter for a release
**In the editor:** @ui[Project] tab ▸ **Project properties**: set **Name**, **Version** and **Icon**, then press **Apply project properties**. The export options (single file, minify, which scenes to include) are in @ui[File ▸ Build Settings]. The bundle id and the exact `id` are in the file.

**In the file** `nord.project.json`:
```json
"name": "My Game", "id": "com.you.mygame",
"display": { "width": 960, "height": 540, "scale": "fit", "pixelArt": false, "background": "#101418" },
"export": { "web": { "singleFile": false, "minify": true }, "mac": { "bundleId": "com.you.mygame", "icon": "assets/icon.png" } }
```
`id` is also the key of the save data in the browser: **do not change it after release** or old saves are not found. Exclude test scenes from builds with `export.excludeScenes`.

## Pre-release checklist
- [ ] `nord check` and `nord check-offline` are clean; the Console has no red lines in a full play-through.
- [ ] Turn the Dev Console off (`allowExec` off) or remove the prefab ([Dev Console](dev-console.html)).
- [ ] Sound starts after a click (browsers block autoplay): the game works with a title screen (library `ui-main-menu.js`) or the *touch to start* gate.
- [ ] Test the **built** version (`nord serve my-game/dist`), not only the editor: paths are case-sensitive on web servers (`Player.png` ≠ `player.png`).
- [ ] Phone check if you target it: touch controls, readable UI ([Mobile](ex-mobile-touch.html)).
- [ ] A start scene is set (@ui[File ▸ Build Settings]), and the first scene works when started on its own.
- [ ] Saves: play, close, reopen; the best score and options come back ([Saving](ex-save-load.html)).
- [ ] Size: `--optimize`, small textures, mp3/ogg instead of wav for music.

## Updating a published game
Players keep their save data as long as the project `id` and your save format stay compatible: use the save *version* and a `migrate` function when you change the shape of saved data ([Saving](ex-save-load.html)).
